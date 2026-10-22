/**
 * Serverul, în teste, cu un cont adevărat (21 octombrie 2026, odată cu
 * conturile): la prima cerere face un om în tenantul serverului, intră prin
 * `/api/intrare` ca pagina și trimite apoi cookie-ul de sesiune. Fără o ușă
 * ocolitoare în server: testele trec pe același drum ca omul.
 */
import { caTenant } from "../src/db/client.js";
import { utilizator } from "../src/db/schema.js";
import { ANTET_CSRF, creeazaServer, type OptiuniServer } from "../src/server/app.js";
import { COOKIE } from "../src/server/securitate.js";
import { hashParola } from "../src/server/parola.js";

export const PAROLA_TEST = "parola-de-test-42";
let hash: Promise<string> | null = null;
let contor = 0;

export function serverCuCont(o: OptiuniServer, nume = "Om de test"): {
  app: ReturnType<typeof creeazaServer>;
  request: (cale: string, init?: RequestInit) => Promise<Response>;
} {
  const app = creeazaServer(o);
  let cookie: Promise<string> | null = null;
  const intra = async (): Promise<string> => {
    const email = `test-${process.pid}-${Date.now()}-${++contor}@izorep.test`;
    hash ??= hashParola(PAROLA_TEST);
    const parolaHash = await hash;
    await caTenant(o.db, o.tenantId, (tx) => tx.insert(utilizator).values({ tenantId: o.tenantId, email, nume, rol: "birou", parolaHash }));
    const r = await app.request("/api/intrare", {
      method: "POST", headers: { "content-type": "application/json", [ANTET_CSRF]: "1" },
      body: JSON.stringify({ email, parola: PAROLA_TEST }),
    });
    const m = new RegExp(`${COOKIE}=([^;]+)`).exec(r.headers.get("set-cookie") ?? "");
    if (r.status !== 200 || !m) throw new Error(`intrarea de test a eșuat: ${r.status} ${await r.text()}`);
    return m[1]!;
  };
  return {
    app,
    async request(cale, init = {}) {
      cookie ??= intra();
      const h = new Headers(init.headers);
      h.set("cookie", `${COOKIE}=${await cookie}`);
      return app.request(cale, { ...init, headers: h });
    },
  };
}
