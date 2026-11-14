/**
 * Ce învață importul, pe firmă (planul UX, Faza 6, 14 noiembrie 2026):
 * coloanele foilor de client (L1). Până acum stăteau doar în repo
 * (`data/mapari`, din `npm run mapare`), deci un client nou, încărcat din
 * ecran, cădea pe euristica de cantitate.
 *
 * - `POST /api/mapare`: foaia cu antet necunoscut; modelul propune,
 *   `valideazaMapare` decide (aceleași reguli ca `/api/extrage`: sesiune,
 *   `X-Izorep`, plafonul zilnic, răspunsul trecut prin schemă), iar
 *   rezultatul, acceptat sau respins, se ține în `mapare_coloane`.
 * - `GET /api/mapari`: ce știe firma, la fiecare import.
 * - `PUT /api/mapari`: coloanele alese de om („schimbă”), verificate la fel;
 *   `mapare: null` le scoate („Anulează” pe un antet necunoscut înainte).
 */
import { Hono, type Context as HonoCtx } from "hono";
import { z } from "zod";
import { eq } from "drizzle-orm";
import type { Baza } from "../db/client.js";
import { mapareColoane } from "../db/schema.js";
import { amprentaFoaie, MapareFoaie, valideazaMapare } from "../import/mapare.js";
import { foaieDinFir, type FoaiePeFir } from "../import/coloane.js";
import type { FoaieBruta } from "../import/rand.js";
import { mesajPlafon, PLAFOANE_IMPLICITE } from "./limita-model.js";
import type { OptiuniModel } from "./model.js";
import type { Context } from "./contract.js";
import { Refuz } from "./repo.js";

/** Cât din foaie trece prin model: blocul de antet (`blocAntet`, 15 rânduri). Se numără ca rânduri din Excel. */
const RANDURI_MAPARE = 15;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type InTenant = <T>(c: HonoCtx<any>, lucru: (tx: Baza, ctx: Context) => Promise<T>) => Promise<T>;

const Valoare = z.union([z.string().max(4000), z.number(), z.null()]);
const FoaieZ = z.object({
  nume: z.string().max(300),
  coloane: z.number().int().positive().max(500),
  antet: z.number().int().nonnegative().nullable(),
  randuri: z.array(z.object({
    rand: z.number().int().nonnegative(),
    celule: z.array(z.object({ v: Valoare, span: z.number().int().positive().max(500) })).max(500),
  })).max(20000),
});

/** O mapare a firmei, cum o primește pagina. */
export interface MapareFirmei {
  amprenta: string;
  mapare: MapareFoaie;
  acceptata: boolean;
  sursa: "model" | "om";
  fisier: string | null;
  foaie: string | null;
  model: string | null;
  actualizat: string;
}

export async function mapariFirmei(tx: Baza): Promise<MapareFirmei[]> {
  const rows = await tx.select().from(mapareColoane);
  return rows.map((r) => ({
    amprenta: r.amprenta, mapare: r.mapare as MapareFoaie, acceptata: r.acceptata, sursa: r.sursa as "model" | "om",
    fisier: r.fisier, foaie: r.foaie, model: r.model, actualizat: r.actualizatLa.toISOString(),
  }));
}

async function puneMapare(tx: Baza, ctx: Context, m: Omit<MapareFirmei, "actualizat">): Promise<void> {
  const val = {
    mapare: m.mapare, acceptata: m.acceptata, sursa: m.sursa, fisier: m.fisier, foaie: m.foaie, model: m.model,
    actualizatLa: new Date(), actualizatDe: ctx.nume ?? null,
  };
  await tx.insert(mapareColoane).values({ tenantId: ctx.tenantId, amprenta: m.amprenta, ...val })
    .onConflictDoUpdate({ target: [mapareColoane.tenantId, mapareColoane.amprenta], set: val });
}

/** Maparea propusă de model pentru o foaie (`mapeazaFoaie` din `mapare-llm.ts`), înlocuibilă în teste. */
export type Mapeaza = (foaie: FoaieBruta, o: { apiKey: string; model: string }) => Promise<unknown>;

export function ruteImportFirma(o: OptiuniModel & { mapeaza?: Mapeaza }, inTenant: InTenant): Hono {
  const app = new Hono();

  app.get("/mapari", async (c) => c.json(await inTenant(c, (tx) => mapariFirmei(tx))));

  app.post("/mapare", async (c) => {
    const corp = z.object({ foaie: FoaieZ, fisier: z.string().max(300).optional() }).parse(await c.req.json());
    const foaie = foaieDinFir(corp.foaie as FoaiePeFir);
    const amprenta = amprentaFoaie(foaie);
    // Un coleg a citit deja antetul: nimic de cerut modelului.
    const are = await inTenant(c, async (tx) => (await tx.select().from(mapareColoane).where(eq(mapareColoane.amprenta, amprenta)))[0]);
    if (are) return c.json({ amprenta, mapare: are.mapare, acceptata: are.acceptata });
    if (!o.cheie) return c.json({ eroare: "Citirea cu model nu e pornită pe server." }, 503);
    if (o.limita && !(await o.limita("linii", RANDURI_MAPARE))) {
      console.warn("model: plafonul de azi atins (linii), maparea refuzata");
      return c.json({ eroare: mesajPlafon("linii", o.plafoane ?? PLAFOANE_IMPLICITE) }, 429);
    }
    console.info(`model: citesc coloanele foii „${foaie.nume}” (${o.model})`);
    const mapeaza: Mapeaza = o.mapeaza ?? (async (f, x) => {
      const { mapeazaFoaie } = await import("../import/mapare-llm.js");
      return (await mapeazaFoaie(f, x)).mapare;
    });
    const brut = await mapeaza(foaie, { apiKey: o.cheie, model: o.model });
    // Ca la `/api/extrage`: ce iese din model trece prin schemă, iar un
    // răspuns stricat e vina modelului (502), nu a paginii.
    const verificat = MapareFoaie.safeParse(brut);
    if (!verificat.success) return c.json({ eroare: "Modelul a răspuns în altă formă decât cea cerută." }, 502);
    const mapare = verificat.data;
    // Modelul propune, codul decide: aceeași verificare ca la `npm run mapare`.
    const acceptata = mapare.roluri.length <= foaie.coloane && valideazaMapare(foaie, mapare).length === 0;
    await inTenant(c, (tx, ctx) => puneMapare(tx, ctx, {
      amprenta, mapare, acceptata, sursa: "model", fisier: corp.fisier ?? null, foaie: foaie.nume, model: o.model,
    }));
    return c.json({ amprenta, mapare, acceptata });
  });

  app.put("/mapari", async (c) => {
    const corp = z.object({ foaie: FoaieZ, mapare: z.unknown(), fisier: z.string().max(300).optional() }).parse(await c.req.json());
    const foaie = foaieDinFir(corp.foaie as FoaiePeFir);
    const amprenta = amprentaFoaie(foaie);
    // „Anulează” după o alegere pe un antet care nu era cunoscut: firma nu mai știe nimic despre el.
    if (corp.mapare === null) {
      await inTenant(c, (tx) => tx.delete(mapareColoane).where(eq(mapareColoane.amprenta, amprenta)));
      return c.json({ amprenta, mapare: null, acceptata: false });
    }
    const mapare = MapareFoaie.parse(corp.mapare);
    if (mapare.roluri.length > foaie.coloane || valideazaMapare(foaie, mapare).length > 0) {
      throw new Refuz(400, "Coloanele alese nu se potrivesc cu ce e scris în foaie.");
    }
    await inTenant(c, (tx, ctx) => puneMapare(tx, ctx, {
      amprenta, mapare, acceptata: true, sursa: "om", fisier: corp.fisier ?? null, foaie: foaie.nume, model: null,
    }));
    return c.json({ amprenta, mapare, acceptata: true });
  });

  return app;
}
