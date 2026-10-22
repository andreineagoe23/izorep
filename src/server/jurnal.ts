/**
 * Cine a schimbat ce (21 octombrie 2026). După fiecare scriere reușită pe
 * `/api/*`, un rând în `jurnal`: omul, ce a făcut, în cuvintele lui, și id-ul
 * a ce a atins. Citirile modelului (`/api/extrage`, `/api/poza`, `/api/aviz`)
 * nu schimbă nimic, deci nu intră.
 *
 * O rută care nu e în listă se scrie tot, cu metoda și calea: o scriere nouă
 * uitată aici se vede în jurnal, nu dispare.
 */
import { desc, lt } from "drizzle-orm";
import type { Baza } from "../db/client.js";
import { jurnal } from "../db/schema.js";

const ACTIUNI: [string, RegExp, string][] = [
  ["PUT", /^\/api\/cereri\/([^/]+)$/, "a salvat cererea"],
  ["DELETE", /^\/api\/cereri\/([^/]+)$/, "a șters cererea"],
  ["POST", /^\/api\/stergere$/, "a șters de tot o lucrare"],
  ["POST", /^\/api\/cereri\/([^/]+)\/oferte$/, "a salvat oferta"],
  ["PUT", /^\/api\/santiere\/([^/]+)$/, "a creat sau a refăcut șantierul"],
  ["DELETE", /^\/api\/santiere\/([^/]+)$/, "a șters șantierul"],
  ["POST", /^\/api\/santiere\/([^/]+)\/situatii$/, "a salvat o situație de lucrări"],
  ["DELETE", /^\/api\/santiere\/([^/]+)\/situatii\/[^/]+$/, "a șters ultima situație"],
  ["POST", /^\/api\/santiere\/([^/]+)\/inchide$/, "a închis șantierul"],
  ["POST", /^\/api\/miscari$/, "a trecut o mișcare de stoc"],
  ["PUT", /^\/api\/necesare\/([^/]+)$/, "a schimbat lista de materiale"],
  ["DELETE", /^\/api\/necesare\/([^/]+)$/, "a scos lista de materiale"],
  ["PUT", /^\/api\/depozite\/([^/]+)$/, "a schimbat cine răspunde de loc"],
  ["POST", /^\/api\/depozite\/([^/]+)\/pornire$/, "a trecut material de dinainte de aplicație"],
  ["POST", /^\/api\/depozite\/([^/]+)\/inventar$/, "a trecut un inventar"],
  ["PUT", /^\/api\/ambalaje$/, "a schimbat un ambalaj"],
  ["PUT", /^\/api\/comenzi\/([^/]+)$/, "a salvat o comandă"],
  ["DELETE", /^\/api\/comenzi\/([^/]+)$/, "a șters o ciornă de comandă"],
  ["POST", /^\/api\/comenzi\/([^/]+)\/trimite$/, "a trimis comanda"],
  ["POST", /^\/api\/comenzi\/([^/]+)\/anuleaza$/, "a anulat comanda"],
  ["POST", /^\/api\/comenzi\/([^/]+)\/receptii$/, "a recepționat marfă"],
  ["POST", /^\/api\/comenzi\/([^/]+)\/facturi$/, "a trecut o factură"],
  ["POST", /^\/api\/comenzi\/([^/]+)\/retururi$/, "a returnat marfă la furnizor"],
  ["POST", /^\/api\/comenzi\/([^/]+)\/documente$/, "a atașat un aviz sau o factură"],
  ["POST", /^\/api\/masuratori$/, "a salvat măsurători din poze"],
  ["POST", /^\/api\/mutare$/, "a mutat datele din browser pe server"],
  ["POST", /^\/api\/parola$/, "și-a schimbat parola"],
];

/** Citirile modelului: nu schimbă nimic în bază. */
const DOAR_CITIRI = /^\/api\/(extrage|poza|aviz)$/;

/** Ce se scrie în jurnal pentru o cerere reușită; null = nimic (citire). */
export function actiuneDin(metoda: string, cale: string): { actiune: string; obiect: string | null } | null {
  if (metoda === "GET" || metoda === "HEAD" || DOAR_CITIRI.test(cale)) return null;
  for (const [m, re, actiune] of ACTIUNI) {
    const r = m === metoda ? re.exec(cale) : null;
    if (r) return { actiune, obiect: r[1] ? decodeURIComponent(r[1]) : null };
  }
  return { actiune: `${metoda} ${cale}`, obiect: null };
}

export interface RandJurnal {
  cand: string;
  cine: string;
  actiune: string;
  obiect: string | null;
}

export async function scrieInJurnal(
  tx: Baza, tenantId: string, cine: { utilizatorId: string | null; nume: string }, actiune: string, obiect: string | null,
): Promise<void> {
  await tx.insert(jurnal).values({ tenantId, utilizatorId: cine.utilizatorId, cine: cine.nume, actiune, obiect });
}

/** Ultimele rânduri, cele mai noi întâi; `inainte` dă pagina următoare. */
export async function citesteJurnal(tx: Baza, inainte?: Date, cate = 200): Promise<RandJurnal[]> {
  const rows = await tx.select().from(jurnal)
    .where(inainte ? lt(jurnal.cand, inainte) : undefined)
    .orderBy(desc(jurnal.cand)).limit(cate);
  return rows.map((r) => ({ cand: r.cand.toISOString(), cine: r.cine, actiune: r.actiune, obiect: r.obiect }));
}
