/**
 * Serverul: rutele `/api/*`. Construit dintr-o functie, cu baza si firma
 * primite ca argumente, ca testele sa-l cheme direct (`app.request(...)`),
 * fara retea.
 *
 * Un server serveste o singura firma (`tenantId`), iar totul ruleaza in
 * `caTenant`, deci RLS vede doar firma lui. Din 21 octombrie 2026, cu conturi:
 * in afara de `/api/viu`, `/api/stare`, `/api/intrare` si `/api/iesire`, orice
 * cerere cere sesiunea din cookie (`intrare.ts`), iar fiecare scriere reusita
 * intra in jurnal (`jurnal.ts`). Pagina insasi e publica: ea arata intrarea.
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
import { ruteCurs, type OptiuniCurs } from "./curs.js";
import * as repo from "./repo.js";
import { Refuz } from "./repo.js";
import { inchideSantier } from "./inchidere.js";
import { DURATA_SESIUNE_MS, iesi, intra, omDinCookie, schimbaParola, type Om } from "./intrare.js";
import { actiuneDin, citesteJurnal, scrieInJurnal } from "./jurnal.js";
import { adresa, antete, cookieDin, cookieSesiune, limitaIncercari } from "./securitate.js";
import type { Context, Stare } from "./contract.js";

/** Ruta pe care o verifica Render ca sa stie daca serverul traieste. Publica: nu spune nimic despre firma. */
export const RUTA_VIATA = "/api/viu";

export const ANTET_CSRF = "x-izorep";

export interface OptiuniServer {
  db: Baza;
  /** Firma servita. Toate cererile ruleaza in contextul ei. */
  tenantId: string;
  /** Stratul cu model. Lipsa = fara cheie: ecranele merg pe reguli. */
  model?: OptiuniModel;
  /** Amprentele scripturilor inline din pagina (`amprenteScripturi`), pentru CSP. */
  scripturi?: string[];
  /** Cursul BNR din antet (`curs.ts`). Lipsa = de la BNR. */
  curs?: OptiuniCurs;
}

type Env = { Variables: { om: Om; cookie: string } };

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
  [/^\/api\/aviz$/, 15 * MB],
  [/^\/api\/comenzi\/[^/]+\/documente$/, 15 * MB],
];
export const LIMITA_IMPLICITA = 5 * MB;
const limitaPentru = (cale: string): number => LIMITE.find(([r]) => r.test(cale))?.[1] ?? LIMITA_IMPLICITA;

/** Formele de pe fir, verificate doar cat trebuie ca o greseala sa nu ajunga in baza. */
const Id = z.string().min(1).max(200);
const Obiect = z.object({}).passthrough();
const CererePeFir = z.object({
  id: Id, versiune: z.number().int().positive().optional(), nume: z.string(), marime: z.number().int().nonnegative(), cand: z.string(),
  model: z.string().nullable(), pozitii: z.number().int(), tarifate: z.number().int(), valoare: z.number(),
  extrase: z.array(z.unknown()), editari: z.array(z.unknown()), fisier: z.string().optional(),
}).passthrough();
const Plan = z.object({
  id: Id, creat: z.string(), denumire: z.string(), fisier: z.string(), firma: z.string(),
  pozitii: z.array(Obiect), situatii: z.array(Obiect),
}).passthrough();
/** O dată pe care `new Date` o înțelege: altfel baza ar da 500, nu un mesaj. */
const DataZ = z.string().max(40).refine((d) => !Number.isNaN(new Date(d).getTime()), "Data nu e o dată.");
/** O cantitate reală: finită, nu negativă, nu absurdă. */
const CantitateZ = z.number().finite().nonnegative().max(1e9);
// Situația: cantități pe numărul poziției din plan (`adaugaSituatie` verifică pozițiile).
const SituatieZ = z.object({
  id: Id, nr: z.number().int().positive(), data: DataZ, cantitati: z.record(z.string().regex(/^\d+$/), CantitateZ),
  nota: z.string().max(500).optional(),
}).passthrough();
const MiscareZ = z.object({
  id: Id, data: DataZ, tip: z.enum(["intrare", "transfer", "consum", "retur", "ajustare"]),
  cantitate: z.number().finite().min(-1e9).max(1e9), din: Id.optional(), spre: Id.optional(), nota: z.string().max(500).optional(),
  articol: z.object({ cheie: Id, sistem: z.string(), um: z.enum(["ml", "m2"]), grosime_mm: z.number().nullable(), rand: z.number().nullable() }).passthrough(),
}).passthrough();
// Lista de materiale: fiecare material cu cheia, sistemul și cantități reale.
const NecesarZ = z.object({
  id: Id, santier: Id.optional(), versiune: z.number().int().positive().optional(),
  fisier: z.string().max(300).optional(), obiectiv: z.string().max(300).optional(),
  materiale: z.array(z.object({
    cheie: Id, sistem: z.string().min(1).max(50), ml: CantitateZ, m2: CantitateZ, kg: CantitateZ.optional(),
    calculat: CantitateZ.optional(), valoareOferta: z.number().finite().nonnegative().optional(), manual: z.string().max(300).optional(),
  }).passthrough()).max(5000),
  scoase: z.array(Obiect).max(5000).optional(),
}).passthrough();
const AmbalajZ = z.object({ cheie: Id, ambalaj: z.object({ unitate: z.string().min(1), continut: z.number().positive() }).nullable() });
const OfertaZ = z.object({
  firma: z.string(),
  continut: z.object({ linii: z.array(Obiect), antet: Obiect, provenienta: Obiect }).passthrough(),
});
const MasuratoareZ = z.object({
  scop: z.enum(["oferta", "situatie", "comanda"]), santierId: z.string().optional(), poza: z.string().optional(), randuri: z.unknown(),
});
const PretZ = z.object({ valoare: z.number().nonnegative(), moneda: z.enum(["EUR", "RON"]) });
const ArticolZ = z.object({ cheie: Id, sistem: z.string(), um: z.enum(["ml", "m2"]), grosime_mm: z.number().nullable(), rand: z.number().nullable() }).passthrough();
const ComandaZ = z.object({
  id: Id, creat: z.string(), furnizor: z.string().min(1), firma: z.string().min(1), santier: z.string().optional(), spre: Id,
  linii: z.array(z.object({
    id: Id, articol: ArticolZ, cantitate: z.number().positive(),
    pret: PretZ.extend({ sursa: z.string().optional(), curs: z.number().positive().optional() }).optional(),
  }).passthrough()).min(1),
  suplimentara: z.string().optional(), nota: z.string().optional(),
}).passthrough();
const DocumentZ = z.object({ tip: z.enum(["aviz", "factura"]), serie: z.string().optional(), numar: z.string().min(1), data: z.string() });
const CandZ = z.object({ cand: z.string() });
const ReceptieZ = z.object({
  document: DocumentZ, curs: z.number().positive().optional(), transport: PretZ.optional(), spre: Id.optional(),
  linii: z.array(z.object({ linie: Id, cantitate: z.number().nonnegative(), pret: PretZ.optional(), marca: z.string().optional() })).min(1),
  ids: z.array(Id).min(1), data: z.string(),
});
const FacturaZ = z.object({
  aviz: z.string().min(1),
  factura: z.object({
    document: DocumentZ.extend({ tip: z.literal("factura") }), curs: z.number().positive().optional(),
    transport: PretZ.optional(), preturi: z.record(PretZ),
  }),
  ids: z.array(Id).min(1), data: z.string(),
});
const DocumentAtasatZ = z.object({
  id: Id, tip: z.enum(["aviz", "factura"]), numar: z.string().min(1), nume: z.string().min(1).max(200),
  // Doar poze și PDF: un SVG ar fi o pagină cu scripturi, deschisă de la noi.
  fisier: z.string().regex(/^data:(image\/(jpeg|png|webp|gif|heic|heif)|application\/pdf);base64,/),
});
const ReturZ = z.object({
  linie: Id, cantitate: z.number().positive(), din: Id, motiv: z.string().min(1), document: DocumentZ.optional(),
  id: Id, data: z.string(),
});

const PornireZ = z.object({
  id: Id, data: z.string(), articol: ArticolZ, cantitate: z.number().positive(),
  pret: z.number().nonnegative().optional(), nota: z.string().max(500).optional(),
});
const InventarZ = z.object({
  numarat: z.array(z.object({ articol: ArticolZ, cantitate: z.number().nonnegative(), motiv: z.string().max(200).optional() })).min(1),
  motiv: z.string().max(200), nota: z.string().max(500).optional(), ids: z.array(Id).min(1), data: z.string(),
});
/** Inchiderea santierului (Faza 7): ce a numarat seful de lucrare si unde pleaca fiecare rest. */
const DestinatieZ = z.discriminatedUnion("fel", [
  z.object({ fel: z.literal("depozit"), depozit: Id }),
  z.object({ fel: z.literal("furnizor"), furnizor: z.string().min(1) }),
  z.object({ fel: z.enum(["pierdut", "furat", "reciclat"]) }),
]);
const InchidereZ = z.object({
  inventar: z.array(z.object({
    cheie: Id, scriptic: z.number(), numarat: z.number().nonnegative(),
    destinatii: z.array(z.object({ unde: DestinatieZ, cantitate: z.number().positive() })),
  })),
  ids: z.array(Id), data: z.string(),
});

const MutareZ = z.object({
  cereri: z.array(CererePeFir), oferte: z.record(Obiect), planuri: z.array(Plan),
  depozit: z.object({
    miscari: z.array(Obiect), necesare: z.array(NecesarZ), ambalaje: z.record(Obiect).optional(),
    comenzi: z.array(ComandaZ.extend({ trimisa: z.string().optional(), anulata: z.string().optional() })).optional(),
  }).passthrough(),
});

export function creeazaServer(o: OptiuniServer): Hono<Env> {
  const app = new Hono<Env>();

  // Prima, ca sa acopere si pagina, pe care porneste.ts o adauga dupa.
  app.use("*", antete(o.scripturi));
  // Inaintea portii: Render o intreaba ca sa stie ca serverul traieste.
  app.get(RUTA_VIATA, (c) => c.text("ok"));

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

  /* ------------------------------------------------ intrarea, publica */

  // Cursul BNR e public oricum; pagina îl cere doar după intrare.
  app.route("/api", ruteCurs(o.curs));

  const incercari = limitaIncercari();
  const eu = (om: Om) => ({ nume: om.nume, email: om.email, rol: om.rol, parolaTemporara: om.parolaTemporara });

  app.get("/api/stare", async (c) => {
    const [t] = await o.db.select({ denumire: tenant.denumire }).from(tenant).where(eq(tenant.id, o.tenantId));
    const om = await omDinCookie(o.db, o.tenantId, cookieDin(c));
    return c.json({ firma: t?.denumire ?? "", eu: om ? eu(om) : null } satisfies Stare);
  });

  app.post("/api/intrare", async (c) => {
    if (!incercari.permis(adresa(c))) {
      return c.json({ eroare: "Prea multe încercări de pe acest calculator. Încearcă din nou peste un sfert de oră." }, 429);
    }
    const { email, parola } = z.object({ email: z.string().max(200), parola: z.string().max(200) }).parse(await c.req.json());
    const r = await intra(o.db, o.tenantId, email, parola);
    if (r.fel === "blocat") {
      const ora = r.pana.toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Bucharest" });
      return c.json({ eroare: `Prea multe parole greșite: contul e blocat până la ${ora}. Încearcă atunci, sau cere o parolă nouă.` }, 423);
    }
    if (r.fel === "gresit") return c.json({ eroare: "Emailul sau parola nu sunt bune." }, 401);
    await caTenant(o.db, o.tenantId, (tx) => scrieInJurnal(tx, o.tenantId, r.om, "a intrat în aplicație", null));
    c.header("Set-Cookie", cookieSesiune(c, r.cookie, Math.floor(DURATA_SESIUNE_MS / 1000)));
    return c.json({ eu: eu(r.om) });
  });

  app.post("/api/iesire", async (c) => {
    const cookie = cookieDin(c);
    if (cookie) await iesi(o.db, o.tenantId, cookie);
    c.header("Set-Cookie", cookieSesiune(c, "", 0));
    return c.json({ ok: true });
  });

  /* ------------------------------------------- de aici, doar cu sesiune */

  app.use("/api/*", async (c, next) => {
    const cookie = cookieDin(c);
    const om = cookie ? await omDinCookie(o.db, o.tenantId, cookie) : null;
    if (!om) return c.json({ eroare: "Intră din nou în cont: sesiunea s-a încheiat." }, 401);
    // Cu parola dată de noi, omul își alege întâi alta: până atunci nu vede și nu schimbă nimic.
    if (om.parolaTemporara && c.req.path !== "/api/parola") {
      return c.json({ eroare: "Alege-ți întâi o parolă nouă." }, 403);
    }
    c.set("om", om);
    c.set("cookie", cookie);
    await next();
    // Scrierea reușită intră în jurnal. După răspuns, în tranzacția ei: dacă
    // jurnalul ar cădea, schimbarea e deja făcută, iar eroarea se vede în log.
    const a = c.res.status < 400 ? actiuneDin(c.req.method, c.req.path) : null;
    if (a) {
      try {
        await caTenant(o.db, o.tenantId, (tx) => scrieInJurnal(tx, o.tenantId, om, a.actiune, a.obiect));
      } catch (e) { console.error("jurnal:", e); }
    }
  });

  const inTenant = <T>(c: HonoCtx<Env>, lucru: (tx: Baza, ctx: Context) => Promise<T>): Promise<T> => {
    const om = c.get("om");
    return caTenant(o.db, o.tenantId, (tx) => lucru(tx, { tenantId: o.tenantId, utilizatorId: om.utilizatorId, nume: om.nume }));
  };
  const ok = (c: HonoCtx<Env>) => c.json({ ok: true });

  app.post("/api/parola", async (c) => {
    const { veche, noua } = z.object({ veche: z.string().max(200), noua: z.string().max(200) }).parse(await c.req.json());
    const problema = await schimbaParola(o.db, o.tenantId, c.get("om"), c.get("cookie"), veche, noua);
    if (problema) throw new Refuz(400, problema);
    return ok(c);
  });

  app.get("/api/jurnal", async (c) => {
    const inainte = c.req.query("inainte");
    return c.json(await inTenant(c, (tx) => citesteJurnal(tx, inainte ? new Date(inainte) : undefined)));
  });

  app.route("/api", ruteModel(o.model ?? optiuniModelDinMediu({})));
  app.get("/api/date", async (c) => c.json(await inTenant(c, (tx) => repo.dateComune(tx))));

  app.get("/api/cereri", async (c) => c.json(await inTenant(c, (tx) => repo.listaCereri(tx))));
  app.get("/api/cereri/:id", async (c) => {
    const r = await inTenant(c, (tx) => repo.citesteCerere(tx, c.req.param("id")));
    return r ? c.json(r) : c.json({ eroare: "Cererea nu există." }, 404);
  });
  app.put("/api/cereri/:id", async (c) => {
    const corp = CererePeFir.parse(await c.req.json());
    if (corp.id !== c.req.param("id")) throw new Refuz(400, "Id-ul cererii nu se potrivește.");
    const versiune = await inTenant(c, (tx, ctx) => repo.salveazaCerere(tx, ctx, corp as never));
    return c.json({ ok: true, versiune });
  });
  // Ștergerea de tot, după confirmare (`web/stergere.ts`): cererea cu tot ce
  // s-a făcut din ea, sau șantierul cu tot ce ține de el.
  app.post("/api/stergere", async (c) => {
    const corp = z.union([z.object({ cerere: Id }), z.object({ santier: Id })]).parse(await c.req.json());
    return c.json(await inTenant(c, (tx, ctx) => repo.stergeLucrarea(tx, ctx, corp)));
  });
  app.delete("/api/cereri/:id", async (c) => {
    await inTenant(c, (tx) => repo.stergeCerere(tx, c.req.param("id")));
    return ok(c);
  });

  app.post("/api/cereri/:id/oferte", async (c) => {
    const corp = OfertaZ.parse(await c.req.json());
    return c.json(await inTenant(c, (tx, ctx) => repo.salveazaOferta(tx, ctx, c.req.param("id"), corp as never)));
  });
  app.get("/api/oferte/urmatorul", async (c) => {
    const cod = z.string().min(1).max(50).parse(c.req.query("firma"));
    return c.json({ numar: await inTenant(c, (tx) => repo.urmatorulNumar(tx, cod)) });
  });
  app.get("/api/cereri/:id/oferte", async (c) => c.json(await inTenant(c, (tx) => repo.versiuniOferta(tx, c.req.param("id")))));

  app.put("/api/santiere/:id", async (c) => {
    const corp = Plan.parse(await c.req.json());
    if (corp.id !== c.req.param("id")) throw new Refuz(400, "Id-ul șantierului nu se potrivește.");
    await inTenant(c, (tx, ctx) => repo.puneSantier(tx, ctx, corp as never));
    return ok(c);
  });
  app.delete("/api/santiere/:id", async (c) => {
    await inTenant(c, (tx) => repo.stergeSantier(tx, c.req.param("id")));
    return ok(c);
  });
  // Situatia scrie si consumul ei, in aceeasi tranzactie (Faza 6).
  app.post("/api/santiere/:id/situatii", async (c) => {
    const corp = SituatieZ.parse(await c.req.json());
    const consum = await inTenant(c, (tx, ctx) => repo.adaugaSituatie(tx, ctx, c.req.param("id"), corp as never));
    return c.json({ ok: true, consum });
  });
  // Numarul spune care e ultima; id-ul, ca e aceeasi situatie pe care a vazut-o
  // omul: altfel, stearsa si scrisa din nou de un coleg, ar pleca a colegului.
  app.delete("/api/santiere/:id/situatii/:nr", async (c) => {
    const id = Id.parse(c.req.query("id"));
    await inTenant(c, (tx, ctx) => repo.stergeSituatie(tx, ctx, c.req.param("id"), Number(c.req.param("nr")), id, new Date().toISOString()));
    return ok(c);
  });

  app.post("/api/santiere/:id/inchide", async (c) => {
    const { inventar, ids, data } = InchidereZ.parse(await c.req.json());
    const scrise = await inTenant(c, (tx, ctx) => inchideSantier(tx, ctx, c.req.param("id"), inventar as never, ids, data));
    return c.json({ scrise });
  });

  app.post("/api/miscari", async (c) => {
    const corp = MiscareZ.parse(await c.req.json());
    if (corp["situatieId"] !== undefined) throw new Refuz(400, "Consumul din situații îl scrie serverul, la salvarea situației.");
    await inTenant(c, (tx, ctx) => repo.adaugaMiscare(tx, ctx, corp as never));
    return ok(c);
  });
  app.put("/api/necesare/:id", async (c) => {
    const corp = NecesarZ.parse(await c.req.json());
    if (corp.id !== c.req.param("id")) throw new Refuz(400, "Id-ul necesarului nu se potrivește.");
    const versiune = await inTenant(c, (tx, ctx) => repo.puneNecesar(tx, ctx, corp as never));
    return c.json({ ok: true, versiune });
  });
  app.delete("/api/necesare/:id", async (c) => {
    await inTenant(c, (tx) => repo.stergeNecesar(tx, c.req.param("id")));
    return ok(c);
  });
  app.put("/api/depozite/:id", async (c) => {
    const corp = z.object({ responsabil: z.string().max(200) }).parse(await c.req.json());
    await inTenant(c, (tx, ctx) => repo.puneResponsabil(tx, ctx, c.req.param("id"), corp.responsabil.trim()));
    return ok(c);
  });
  /* Faza 8: stocul de pornire si inventarul, calculate pe server din miscarile din baza. */
  app.post("/api/depozite/:id/pornire", async (c) => {
    const { id, data, ...p } = PornireZ.parse(await c.req.json());
    const scrise = await inTenant(c, (tx, ctx) => repo.treceStocDePornire(tx, ctx, c.req.param("id"), p as never, id, data));
    return c.json({ scrise });
  });
  app.post("/api/depozite/:id/inventar", async (c) => {
    const { ids, data, ...inv } = InventarZ.parse(await c.req.json());
    const scrise = await inTenant(c, (tx, ctx) => repo.inventariaza(tx, ctx, c.req.param("id"), inv as never, ids, data));
    return c.json({ scrise });
  });
  app.put("/api/ambalaje", async (c) => {
    const corp = AmbalajZ.parse(await c.req.json());
    await inTenant(c, (tx, ctx) => repo.puneAmbalaj(tx, ctx, corp.cheie, corp.ambalaj));
    return ok(c);
  });

  /* Comenzile (Faza 4): operatii proprii, nu diferente de stare. */
  app.put("/api/comenzi/:id", async (c) => {
    const corp = ComandaZ.parse(await c.req.json());
    if (corp.id !== c.req.param("id")) throw new Refuz(400, "Id-ul comenzii nu se potrivește.");
    await inTenant(c, (tx, ctx) => repo.puneComanda(tx, ctx, corp as never));
    return ok(c);
  });
  app.delete("/api/comenzi/:id", async (c) => {
    await inTenant(c, (tx) => repo.stergeComanda(tx, c.req.param("id")));
    return ok(c);
  });
  app.post("/api/comenzi/:id/trimite", async (c) => {
    const { cand } = CandZ.parse(await c.req.json());
    await inTenant(c, (tx) => repo.trimiteComanda(tx, c.req.param("id"), cand));
    return ok(c);
  });
  app.post("/api/comenzi/:id/anuleaza", async (c) => {
    const { cand } = CandZ.parse(await c.req.json());
    await inTenant(c, (tx) => repo.anuleazaComanda(tx, c.req.param("id"), cand));
    return ok(c);
  });
  app.post("/api/comenzi/:id/receptii", async (c) => {
    const { ids, data, ...r } = ReceptieZ.parse(await c.req.json());
    const scrise = await inTenant(c, (tx, ctx) => repo.receptioneaza(tx, ctx, c.req.param("id"), r as never, ids, data));
    return c.json({ scrise });
  });
  app.post("/api/comenzi/:id/facturi", async (c) => {
    const { aviz, factura, ids, data } = FacturaZ.parse(await c.req.json());
    const scrise = await inTenant(c, (tx, ctx) => repo.treceFactura(tx, ctx, c.req.param("id"), aviz, factura as never, ids, data));
    return c.json({ scrise });
  });
  app.post("/api/comenzi/:id/retururi", async (c) => {
    const { id, data, ...r } = ReturZ.parse(await c.req.json());
    const scrise = await inTenant(c, (tx, ctx) => repo.returneaza(tx, ctx, c.req.param("id"), r as never, id, data));
    return c.json({ scrise });
  });

  app.post("/api/comenzi/:id/documente", async (c) => {
    const corp = DocumentAtasatZ.parse(await c.req.json());
    await inTenant(c, (tx, ctx) => repo.ataseazaDocument(tx, ctx, { ...corp, comanda: c.req.param("id") }));
    return ok(c);
  });
  app.get("/api/documente/:id", async (c) => {
    const d = await inTenant(c, (tx) => repo.fisierDocument(tx, c.req.param("id")));
    if (!d) return c.json({ eroare: "Documentul nu există." }, 404);
    return c.body(new Uint8Array(d.fisier), 200, {
      "Content-Type": d.tip,
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(d.nume)}`,
    });
  });

  app.post("/api/masuratori", async (c) => {
    const corp = MasuratoareZ.parse(await c.req.json());
    await inTenant(c, (tx, ctx) => repo.adaugaMasuratoare(tx, ctx, corp as never));
    return ok(c);
  });

  app.post("/api/mutare", async (c) => {
    const corp = MutareZ.parse(await c.req.json());
    return c.json(await inTenant(c, (tx, ctx) => repo.muta(tx, ctx, corp as never)));
  });

  return app;
}

