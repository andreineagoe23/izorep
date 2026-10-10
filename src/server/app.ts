/**
 * Serverul: rutele `/api/*`. Construit dintr-o functie, cu baza si firma
 * primite ca argumente, ca testele sa-l cheme direct (`app.request(...)`),
 * fara retea.
 *
 * Fara intrare (scoasa pe 10 octombrie 2026, cerut de Andrei): un server
 * serveste o singura firma (`tenantId`), iar totul ruleaza in `caTenant`, deci
 * RLS vede doar firma lui. Fara conturi, serverul nu trebuie sa fie accesibil
 * din internet: `porneste.ts` asculta implicit doar pe 127.0.0.1.
 *
 * Orice cerere care schimba ceva trebuie sa poarte antetul `X-Izorep`: o
 * pagina de pe alt site nu poate pune un antet propriu fara acordul serverului
 * (preflight CORS), pe care serverul nu-l da.
 */
import { Hono, type Context as HonoCtx } from "hono";
import { bodyLimit } from "hono/body-limit";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { caTenant, type Baza } from "../db/client.js";
import { tenant } from "../db/schema.js";
import { optiuniModelDinMediu, ruteModel, type OptiuniModel } from "./model.js";
import * as repo from "./repo.js";
import { Refuz } from "./repo.js";
import type { Context, Stare } from "./contract.js";

export const ANTET_CSRF = "x-izorep";

export interface OptiuniServer {
  db: Baza;
  /** Firma servita. Toate cererile ruleaza in contextul ei. */
  tenantId: string;
  /** Stratul cu model. Lipsa = fara cheie: ecranele merg pe reguli. */
  model?: OptiuniModel;
}

type Env = { Variables: Record<string, never> };

/**
 * Cat poate avea o cerere. Fisierul clientului si poza din carnet vin in JSON
 * (base64, cu o treime mai mari); mutarea din browser le aduce pe toate
 * deodata. Restul sunt randuri de date.
 */
const MB = 1024 * 1024;
export const LIMITE: readonly [RegExp, number][] = [
  [/^\/api\/mutare$/, 100 * MB],
  [/^\/api\/cereri\/[^/]+$/, 25 * MB],
  [/^\/api\/masuratori$/, 15 * MB],
  [/^\/api\/poza$/, 15 * MB],
];
export const LIMITA_IMPLICITA = 5 * MB;
const limitaPentru = (cale: string): number => LIMITE.find(([r]) => r.test(cale))?.[1] ?? LIMITA_IMPLICITA;

/** Formele de pe fir, verificate doar cat trebuie ca o greseala sa nu ajunga in baza. */
const Id = z.string().min(1).max(200);
const Obiect = z.object({}).passthrough();
const CererePeFir = z.object({
  id: Id, nume: z.string(), marime: z.number().int().nonnegative(), cand: z.string(),
  model: z.string().nullable(), pozitii: z.number().int(), tarifate: z.number().int(), valoare: z.number(),
  extrase: z.array(z.unknown()), editari: z.array(z.unknown()), fisier: z.string().optional(),
}).passthrough();
const Plan = z.object({
  id: Id, creat: z.string(), denumire: z.string(), fisier: z.string(), firma: z.string(),
  pozitii: z.array(Obiect), situatii: z.array(Obiect),
}).passthrough();
const SituatieZ = z.object({ id: Id, nr: z.number().int().positive(), data: z.string(), cantitati: z.record(z.number()) }).passthrough();
const MiscareZ = z.object({
  id: Id, data: z.string(), tip: z.enum(["intrare", "transfer", "consum", "retur", "ajustare"]),
  cantitate: z.number(),
  articol: z.object({ cheie: Id, sistem: z.string(), um: z.enum(["ml", "m2"]), grosime_mm: z.number().nullable(), rand: z.number().nullable() }).passthrough(),
}).passthrough();
const NecesarZ = z.object({ id: Id, materiale: z.array(Obiect) }).passthrough();
const AmbalajZ = z.object({ cheie: Id, ambalaj: z.object({ unitate: z.string().min(1), continut: z.number().positive() }).nullable() });
const OfertaZ = z.object({
  firma: z.string(),
  continut: z.object({ linii: z.array(Obiect), antet: Obiect, provenienta: Obiect }).passthrough(),
});
const MasuratoareZ = z.object({
  scop: z.enum(["oferta", "situatie"]), santierId: z.string().optional(), poza: z.string().optional(), randuri: z.unknown(),
});
const MutareZ = z.object({
  cereri: z.array(CererePeFir), oferte: z.record(Obiect), planuri: z.array(Plan),
  depozit: z.object({ miscari: z.array(Obiect), necesare: z.array(NecesarZ), ambalaje: z.record(Obiect).optional() }).passthrough(),
});

export function creeazaServer(o: OptiuniServer): Hono<Env> {
  const app = new Hono<Env>();

  app.onError((err, c) => {
    if (err instanceof Refuz) return c.json({ eroare: err.message }, err.cod);
    if (err instanceof z.ZodError) return c.json({ eroare: "Datele trimise nu au forma așteptată.", detalii: err.issues.slice(0, 5) }, 400);
    // restrict_violation din trigger-ele de imutabilitate, foreign_key_violation, unique_violation.
    const cod = (err as { code?: string; cause?: { code?: string } }).code ?? (err as { cause?: { code?: string } }).cause?.code;
    if (cod === "23001" || cod === "23503" || cod === "23505") {
      return c.json({ eroare: "Baza a refuzat schimbarea: înregistrarea e deja folosită sau nu se mai poate modifica." }, 409);
    }
    console.error(err);
    return c.json({ eroare: "Eroare pe server." }, 500);
  });

  app.use("/api/*", (c, next) => bodyLimit({
    maxSize: limitaPentru(c.req.path),
    onError: (c) => c.json({ eroare: "Fișierul sau datele trimise sunt prea mari." }, 413),
  })(c, next));

  app.use("/api/*", async (c, next) => {
    if (c.req.method !== "GET" && c.req.header(ANTET_CSRF) !== "1") return c.json({ eroare: "Cerere refuzată." }, 403);
    await next();
  });

  const ctx: Context = { tenantId: o.tenantId, utilizatorId: null };
  const inTenant = <T>(lucru: (tx: Baza, ctx: Context) => Promise<T>): Promise<T> =>
    caTenant(o.db, ctx.tenantId, (tx) => lucru(tx, ctx));
  const ok = (c: HonoCtx<Env>) => c.json({ ok: true });

  app.route("/api", ruteModel(o.model ?? optiuniModelDinMediu({})));

  app.get("/api/stare", async (c) => {
    const [t] = await o.db.select({ denumire: tenant.denumire }).from(tenant).where(eq(tenant.id, o.tenantId));
    return c.json({ firma: t?.denumire ?? "" } satisfies Stare);
  });
  app.get("/api/date", async (c) => c.json(await inTenant((tx) => repo.dateComune(tx))));

  app.get("/api/cereri", async (c) => c.json(await inTenant((tx) => repo.listaCereri(tx))));
  app.get("/api/cereri/:id", async (c) => {
    const r = await inTenant((tx) => repo.citesteCerere(tx, c.req.param("id")));
    return r ? c.json(r) : c.json({ eroare: "Cererea nu există." }, 404);
  });
  app.put("/api/cereri/:id", async (c) => {
    const corp = CererePeFir.parse(await c.req.json());
    if (corp.id !== c.req.param("id")) throw new Refuz(400, "Id-ul cererii nu se potrivește.");
    await inTenant((tx, ctx) => repo.salveazaCerere(tx, ctx, corp as never));
    return ok(c);
  });
  app.delete("/api/cereri/:id", async (c) => {
    await inTenant((tx) => repo.stergeCerere(tx, c.req.param("id")));
    return ok(c);
  });

  app.post("/api/cereri/:id/oferte", async (c) => {
    const corp = OfertaZ.parse(await c.req.json());
    return c.json(await inTenant((tx, ctx) => repo.salveazaOferta(tx, ctx, c.req.param("id"), corp as never)));
  });
  app.get("/api/cereri/:id/oferte", async (c) => c.json(await inTenant((tx) => repo.versiuniOferta(tx, c.req.param("id")))));

  app.put("/api/santiere/:id", async (c) => {
    const corp = Plan.parse(await c.req.json());
    if (corp.id !== c.req.param("id")) throw new Refuz(400, "Id-ul șantierului nu se potrivește.");
    await inTenant((tx, ctx) => repo.puneSantier(tx, ctx, corp as never));
    return ok(c);
  });
  app.delete("/api/santiere/:id", async (c) => {
    await inTenant((tx) => repo.stergeSantier(tx, c.req.param("id")));
    return ok(c);
  });
  app.post("/api/santiere/:id/situatii", async (c) => {
    const corp = SituatieZ.parse(await c.req.json());
    await inTenant((tx, ctx) => repo.adaugaSituatie(tx, ctx, c.req.param("id"), corp as never));
    return ok(c);
  });
  // Numarul spune care e ultima; id-ul, ca e aceeasi situatie pe care a vazut-o
  // omul: altfel, stearsa si scrisa din nou de un coleg, ar pleca a colegului.
  app.delete("/api/santiere/:id/situatii/:nr", async (c) => {
    const id = Id.parse(c.req.query("id"));
    await inTenant((tx) => repo.stergeSituatie(tx, c.req.param("id"), Number(c.req.param("nr")), id));
    return ok(c);
  });

  app.post("/api/miscari", async (c) => {
    const corp = MiscareZ.parse(await c.req.json());
    await inTenant((tx, ctx) => repo.adaugaMiscare(tx, ctx, corp as never));
    return ok(c);
  });
  app.put("/api/necesare/:id", async (c) => {
    const corp = NecesarZ.parse(await c.req.json());
    if (corp.id !== c.req.param("id")) throw new Refuz(400, "Id-ul necesarului nu se potrivește.");
    await inTenant((tx, ctx) => repo.puneNecesar(tx, ctx, corp as never));
    return ok(c);
  });
  app.delete("/api/necesare/:id", async (c) => {
    await inTenant((tx) => repo.stergeNecesar(tx, c.req.param("id")));
    return ok(c);
  });
  app.put("/api/ambalaje", async (c) => {
    const corp = AmbalajZ.parse(await c.req.json());
    await inTenant((tx, ctx) => repo.puneAmbalaj(tx, ctx, corp.cheie, corp.ambalaj));
    return ok(c);
  });

  app.post("/api/masuratori", async (c) => {
    const corp = MasuratoareZ.parse(await c.req.json());
    await inTenant((tx, ctx) => repo.adaugaMasuratoare(tx, ctx, corp as never));
    return ok(c);
  });

  app.post("/api/mutare", async (c) => {
    const corp = MutareZ.parse(await c.req.json());
    return c.json(await inTenant((tx, ctx) => repo.muta(tx, ctx, corp as never)));
  });

  return app;
}

