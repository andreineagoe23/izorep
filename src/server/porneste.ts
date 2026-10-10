/**
 * `npm run server` — serverul local, pe portul 8787. `vite dev` ii trimite
 * cererile `/api/*` (vite.config.ts). In productie acelasi proces serveste si
 * pagina construita cu `npm run build:server` (`dist-web`), cand exista.
 *
 * Fara intrare (10 octombrie 2026): oricine ajunge la server vede datele
 * firmei si poate chema modelul pe cheia ei. De aceea asculta implicit doar pe
 * 127.0.0.1; `HOST=0.0.0.0` il deschide in retea, si atunci doar intr-o retea
 * a firmei, niciodata spre internet, pana se pun conturile la loc.
 *
 * Variabile, toate cu implicit pentru local:
 *   DATABASE_URL   conexiunea, cu rolul izorep_app (NOBYPASSRLS), niciodata proprietarul
 *   PORT           8787
 *   HOST           127.0.0.1
 *   TENANT_ID      firma servita; implicit singura din baza
 *   OPENAI_API_KEY si restul variabilelor modelului (`model.ts`), din .env
 */
import { existsSync, readFileSync } from "node:fs";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { conecteaza } from "../db/client.js";
import { tenant } from "../db/schema.js";
import { creeazaServer } from "./app.js";
import { optiuniModelDinMediu } from "./model.js";

// .env e gitignorat si tine cheia OpenAI. Node 21+ il incarca nativ.
if (existsSync(".env")) process.loadEnvFile(".env");

const port = Number(process.env["PORT"] ?? 8787);
const host = process.env["HOST"] ?? "127.0.0.1";
const { db } = conecteaza();

/** Firma servita: din `TENANT_ID`, sau singura din baza. Cu mai multe, trebuie spus care. */
async function firmaServita(): Promise<{ id: string; denumire: string }> {
  const toate = await db.select({ id: tenant.id, denumire: tenant.denumire }).from(tenant);
  const cerut = process.env["TENANT_ID"];
  const f = cerut ? toate.find((t) => t.id === cerut) : toate.length === 1 ? toate[0] : undefined;
  if (f) return f;
  throw new Error(cerut
    ? `TENANT_ID=${cerut} nu exista in baza.`
    : toate.length === 0
      ? "Baza n-are nicio firma: ruleaza npm run db:seed."
      : `Baza are ${toate.length} firme: alege una cu TENANT_ID (${toate.map((t) => `${t.denumire}=${t.id}`).join(", ")}).`);
}

const firma = await firmaServita();
const model = optiuniModelDinMediu();
console.log(model.cheie
  ? `Stratul cu model: activ (${model.model}; pozele: ${model.modelPoze})`
  : "Stratul cu model: inactiv (OPENAI_API_KEY lipseste); importul merge pe reguli");

const app = creeazaServer({ db, tenantId: firma.id, model });

// Pagina servita de aici trebuie construita cu `npm run build:server`: cea de
// pe Pages (`build:web`) cere fisierele de la /izorep/ si, fara server,
// scrie datele in browser.
if (existsSync("dist-web/index.html")) {
  if (readFileSync("dist-web/index.html", "utf8").includes("/izorep/assets/")) {
    console.error("dist-web e construit pentru GitHub Pages. Pentru server: npm run build:server");
  } else {
    app.use("/*", serveStatic({ root: "./dist-web" }));
  }
}

serve({ fetch: app.fetch, port, hostname: host }, () => {
  console.log(`Serverul Izorep pe http://${host}:${port} · firma: ${firma.denumire}`);
});
