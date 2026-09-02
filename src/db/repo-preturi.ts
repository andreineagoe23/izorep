import { and, eq, lte, or, isNull, desc } from "drizzle-orm";
import type { Baza } from "./client.js";
import { listaPreturi } from "./schema.js";
import type { Catalog, ListaGoluriFoc, ListaPreturi } from "../pricing/lists.js";
import type { Sistem, SistemMatrice } from "../pricing/types.js";

export type { Catalog };

export class ListaLipsa extends Error {
  constructor(readonly sistem: Sistem, readonly la: string) {
    super(`nu exista lista de preturi activa pentru ${sistem} la ${la}`);
    this.name = "ListaLipsa";
  }
}

const SISTEME_MATRICE: SistemMatrice[] = ["elastomer", "vata_minerala", "tabla", "pvc"];

/**
 * Lista activa pentru un sistem, la o data.
 *
 * "Activa la data D" inseamna: status activ, inceputa cel tarziu la D, si
 * fie fara data de sfarsit, fie cu una dupa D. Indexul unic partial din
 * schema garanteaza ca nu pot fi doua active simultan pe acelasi sistem —
 * altfel nimeni n-ar sti dupa care s-a ofertat.
 *
 * `db` trebuie sa vina din `caTenant`: filtrarea pe tenant o face RLS, nu
 * un `where` scris aici. Daca contextul lipseste, interogarea intoarce gol.
 */
async function listaActiva(db: Baza, sistem: Sistem, la: string): Promise<unknown> {
  const [rand] = await db
    .select({ continut: listaPreturi.continut })
    .from(listaPreturi)
    .where(and(
      eq(listaPreturi.sistem, sistem),
      eq(listaPreturi.status, "activa"),
      lte(listaPreturi.valabilDeLa, la),
      or(isNull(listaPreturi.valabilPanaLa), lte(listaPreturi.valabilPanaLa, "9999-12-31")),
    ))
    .orderBy(desc(listaPreturi.valabilDeLa))
    .limit(1);

  if (!rand) throw new ListaLipsa(sistem, la);
  return rand.continut;
}

/**
 * Incarca tot catalogul unui tenant.
 *
 * Se incarca INTREG, nu pe bucati: motorul are nevoie de toate sistemele ca
 * sa tarifeze o pozitie compusa (elastomer + vata + tabla), iar listele sunt
 * mici — cateva zeci de kilobytes. O incarcare per cerere de ofertare e mai
 * ieftina decat complexitatea unui cache care trebuie invalidat la fiecare
 * versiune noua de lista.
 */
export async function catalogDinBaza(db: Baza, la = azi()): Promise<Catalog> {
  const perechi = await Promise.all(
    SISTEME_MATRICE.map(async (s) => [s, await listaActiva(db, s, la)] as const),
  );
  return {
    matrice: Object.fromEntries(perechi) as Record<SistemMatrice, ListaPreturi>,
    goluriFoc: (await listaActiva(db, "goluri_foc", la)) as ListaGoluriFoc,
  };
}

/** Data de azi in format ISO, fara ora. Listele sunt valabile pe zile. */
export const azi = (): string => new Date().toISOString().slice(0, 10);
