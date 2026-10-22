/**
 * `npm run server` — serverul local, pe portul 8787. `vite dev` ii trimite
 * cererile `/api/*` (vite.config.ts). In productie acelasi proces serveste si
 * pagina construita cu `npm run build:server` (`dist-web`), cand exista.
 *
 * Cu conturi (21 octombrie 2026): pagina de intrare cere emailul si parola
 * omului (`intrare.ts`); parola comuna pe site (`IZOREP_PAROLA`) a plecat.
 * Fara niciun cont, nimeni nu intra: serverul o spune la pornire, iar contul
 * se face cu `npm run om` (`om.ts`).
 *
 * Variabile, toate cu implicit pentru local:
 *   DATABASE_URL   conexiunea, cu rolul izorep_app (NOBYPASSRLS), niciodata proprietarul;
 *                  pe Render se compune din DATABASE_URL_PROPRIETAR + IZOREP_APP_PAROLA,
 *                  sau e chiar proprietarul, cand baza n-are izorep_app (fara CREATEROLE);
 *                  un rol care ocoleste RLS (superuser, BYPASSRLS) e refuzat
 *   PORT           8787
 *   HOST           127.0.0.1 (pe Render 0.0.0.0)
 *   TENANT_ID      firma servita; implicit singura din baza
 *   OPENAI_API_KEY si restul variabilelor modelului (`model.ts`), din .env
 *   IZOREP_PLAFON_LINII, IZOREP_PLAFON_POZE  plafonul zilnic pe model (`limita-model.ts`)
 */
import { existsSync, readFileSync } from "node:fs";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { alegeAplicatia, conecteaza, verificaRolul } from "../db/client.js";
import { tenant } from "../db/schema.js";
import { creeazaServer } from "./app.js";
import { conturiActive } from "./intrare.js";
import { amprenteScripturi } from "./securitate.js";
import { optiuniModelDinMediu } from "./model.js";
import { limitaDinBaza, plafoaneDinMediu } from "./limita-model.js";

// .env e gitignorat si tine cheia OpenAI. Node 21+ il incarca nativ.
if (existsSync(".env")) process.loadEnvFile(".env");

const port = Number(process.env["PORT"] ?? 8787);
const host = process.env["HOST"] ?? "127.0.0.1";
if (process.env["IZOREP_PAROLA"]) {
  console.warn("IZOREP_PAROLA nu mai e folosita: fiecare om intra cu contul lui. Poate fi scoasa din mediu.");
}
const aplicatia = await alegeAplicatia();
const { db } = conecteaza(aplicatia.url);
try {
  const rol = await verificaRolul(db);
  console.log(aplicatia.cuProprietarul
    ? `Baza: aplicatia intra cu proprietarul (${rol}); izorep_app nu exista, separarea firmelor o tine RLS-ul fortat`
    : `Baza: aplicatia intra ca ${rol}`);
} catch (e) {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
}

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
// Plafonul zilnic pe model: cine trece de parola nu cheama OpenAI fara limita.
const plafoane = plafoaneDinMediu();
const model = { ...optiuniModelDinMediu(), plafoane, limita: limitaDinBaza(db, plafoane) };
console.log(model.cheie
  ? `Stratul cu model: activ (${model.model}; pozele: ${model.modelPoze}; pe zi cel mult ${plafoane.linii} de randuri si ${plafoane.poze} de poze)`
  : "Stratul cu model: inactiv (OPENAI_API_KEY lipseste); importul merge pe reguli");

const conturi = await conturiActive(db, firma.id);
if (conturi === 0) console.warn("Niciun cont nu poate intra: fa unul cu npm run om -- <email> \"<nume>\"");

// Scriptul inline al temei din pagina construita intra in CSP dupa amprenta lui.
const pagina = existsSync("dist-web/index.html") ? readFileSync("dist-web/index.html", "utf8") : "";
const app = creeazaServer({ db, tenantId: firma.id, model, scripturi: amprenteScripturi(pagina) });

// Pagina servita de aici trebuie construita cu `npm run build:server`: cea de
// pe Pages (`build:web`) cere fisierele de la /izorep/ si, fara server,
// scrie datele in browser.
if (pagina) {
  if (pagina.includes("/izorep/assets/")) {
    console.error("dist-web e construit pentru GitHub Pages. Pentru server: npm run build:server");
  } else {
    app.use("/*", serveStatic({ root: "./dist-web" }));
  }
}

serve({ fetch: app.fetch, port, hostname: host }, () => {
  console.log(`Serverul Izorep pe http://${host}:${port} · firma: ${firma.denumire} · ${conturi} ${conturi === 1 ? "cont" : "conturi"}`);
});
