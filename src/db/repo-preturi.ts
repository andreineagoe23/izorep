import { and, eq, lte, or, isNull, desc } from "drizzle-orm";
import type { Baza } from "./client.js";
import { listaPreturi } from "./schema.js";
import type { Catalog, ListaGoluriFoc, ListaPreturi } from "../pricing/lists.js";
import type { Sistem, SistemRezidential } from "../pricing/types.js";

export type { Catalog };

export class ListaLipsa extends Error {
  constructor(readonly sistem: Sistem, readonly la: string, readonly destinatie: Destinatie) {
    super(`nu exista lista de preturi activa pentru ${sistem} (${destinatie}) la ${la}`);
    this.name = "ListaLipsa";
  }
}

/**
 * Prima axa a listelor: aceeasi teava, acelasi material, alt pret.
 * Vezi `.claude/liste-preturi.md`.
 */
export type Destinatie = "rezidential" | "industrial" | "rafinarie";

/**
 * Destinatia pe care ruleaza motorul cat timp nu exista regula de alegere.
 *
 * NU e o preferinta: e singura destinatie pe care o reproduc cele 130 de teste
 * ale motorului si singura din care se genereaza `data/price-lists/`. Din
 * momentul in care baza tine si listele industriale, o interogare care nu
 * filtreaza pe destinatie ar intoarce DOUA liste active pe acelasi sistem si
 * ar alege-o pe cea mai recenta — adica industrialul, tacut. De aceea
 * destinatia e in `where`, nu in `order by`.
 */
export const DESTINATIE_IMPLICITA: Destinatie = "rezidential";

// Cele 4 sisteme cu lista REZIDENTIALA. Tabla de inox nu e printre ele — n-are
// lista rezidentiala (vezi SistemRezidential) — deci un catalog de destinatie
// "industrial" cerut prin functia asta nu-l poate incarca; el ramane azi doar
// in baza, cerut direct pe sistem, nu prin catalogDinBaza.
const SISTEME_MATRICE: SistemRezidential[] = ["elastomer", "vata_minerala", "tabla", "pvc"];

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
async function listaActiva(
  db: Baza, sistem: Sistem, la: string, destinatie: Destinatie,
): Promise<unknown> {
  const [rand] = await db
    .select({ continut: listaPreturi.continut })
    .from(listaPreturi)
    .where(and(
      eq(listaPreturi.sistem, sistem),
      eq(listaPreturi.destinatie, destinatie),
      eq(listaPreturi.status, "activa"),
      lte(listaPreturi.valabilDeLa, la),
      or(isNull(listaPreturi.valabilPanaLa), lte(listaPreturi.valabilPanaLa, "9999-12-31")),
    ))
    .orderBy(desc(listaPreturi.valabilDeLa))
    .limit(1);

  if (!rand) throw new ListaLipsa(sistem, la, destinatie);
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
 *
 * `destinatie` e explicita si implicit rezidentiala. Motorul nu stie inca sa
 * o aleaga singur (intrebarea 12 din `.claude/stare.md`): pe Oferta 284, o
 * lucrare industriala a fost tarifata pe lista rezidentiala, deci alegerea nu
 * se deduce din tipul lucrarii.
 */
export async function catalogDinBaza(
  db: Baza, la = azi(), destinatie: Destinatie = DESTINATIE_IMPLICITA,
): Promise<Catalog> {
  const perechi = await Promise.all(
    SISTEME_MATRICE.map(async (s) => [s, await listaActiva(db, s, la, destinatie)] as const),
  );
  return {
    matrice: Object.fromEntries(perechi) as Record<SistemRezidential, ListaPreturi>,
    // Inchiderile goluri la foc au venit doar pe rezidential; pana vine si
    // varianta industriala, catalogul oricarei destinatii o ia de acolo.
    goluriFoc: (await listaActiva(db, "goluri_foc", la, "rezidential")) as ListaGoluriFoc,
  };
}

/** Data de azi in format ISO, fara ora. Listele sunt valabile pe zile. */
export const azi = (): string => new Date().toISOString().slice(0, 10);
