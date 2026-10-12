/**
 * Locurile cu material și drumul lui (Faza 5).
 *
 * Firma (S33, S34, S36, S37, S46, răspunsul 4 de la final):
 * - locurile sunt depozitul central, atelierul din București și câte un depozit
 *   pe fiecare șantier; pe șantier răspunde șeful de șantier desemnat;
 * - șeful de șantier cere la atelier („10 ml ø100, 3 coturi și 10 carcase”),
 *   biroul trece tabla din central în atelier, tabla croită se pune deoparte
 *   pentru acel șantier și apoi pleacă pe șantier „prin noi”;
 * - materialul se mută și direct de pe un șantier pe altul;
 * - stocul e „în principiu separat” pe firme, „dar se mai amestecă”: mutarea
 *   între firme trebuie să se vadă.
 *
 * Nimic nou în registru: tabla pusă deoparte e un transfer în atelier cu
 * `lucrareId` = șantierul pentru care se croiește (același câmp pe care îl
 * poartă recepția unei comenzi de șantier). Tabla rămâne în m² și croită
 * (decizia „Atelierul”, `docs/plan-implementare.md`): piesele nu sunt articole.
 *
 * Pur, fără I/O, ca `registru.ts`.
 */
import { cheieBaza, esteAnulata, type Articol, type Miscare } from "./registru.js";

export const CENTRAL = "central";
export const ATELIER = "atelier";

export type TipLoc = "central" | "atelier" | "santier";

export interface Loc {
  id: string;
  nume: string;
  tip: TipLoc;
  /** Firma care ține stocul (S46). */
  firma: string;
  responsabil?: string;
}

/** Firma depozitului central și a atelierului: RADOIA (seed-ul bazei, S46). */
export const FIRMA_CENTRAL = "RADOIA ISOLIRUNG SRL";

/**
 * Locurile, în ordinea în care se folosesc: centralul, atelierul, apoi
 * șantierele (cu firma lor, din ofertă). Responsabilii sunt ai omului.
 */
export function locuri(
  santiere: readonly { id: string; denumire: string; firma?: string }[],
  responsabili: Readonly<Record<string, string>> = {},
): Loc[] {
  const cu = (l: Loc): Loc => (responsabili[l.id] ? { ...l, responsabil: responsabili[l.id]! } : l);
  return [
    cu({ id: CENTRAL, nume: "Depozit central", tip: "central", firma: FIRMA_CENTRAL }),
    cu({ id: ATELIER, nume: "Atelier București", tip: "atelier", firma: FIRMA_CENTRAL }),
    ...santiere.map((s) => cu({ id: s.id, nume: `Șantier ${s.denumire}`, tip: "santier", firma: s.firma || FIRMA_CENTRAL })),
  ];
}

/**
 * Transferul trece materialul de la o firmă la alta: întoarce cele două firme,
 * altfel null. Un depozit necunoscut (șantier șters) nu se socotește.
 */
export function intreFirme(m: Pick<Miscare, "tip" | "din" | "spre">, l: readonly Loc[]): { din: string; spre: string } | null {
  if (m.tip !== "transfer" && m.tip !== "retur") return null;
  const din = l.find((x) => x.id === m.din)?.firma;
  const spre = l.find((x) => x.id === m.spre)?.firma;
  return din && spre && din !== spre ? { din, spre } : null;
}

/** Ce stă în atelier: pe material și pe șantierul pentru care e pus deoparte (`null` = liber). */
export interface InAtelier {
  articol: Articol;
  pentru: string | null;
  cantitate: number;
  /** Ce trebuie făcut din ea, din notele transferurilor în atelier încă neplecate. */
  cereri: string[];
}

/**
 * Stocul atelierului, despărțit pe șantiere. Intră cu transferul în atelier
 * (`lucrareId` = pentru cine), iese cu transferul din atelier spre șantier
 * (scade de la șantierul acela; dacă acolo nu era nimic pus deoparte, din ce
 * e liber). Stornourile scot mișcarea anulată, ca la solduri.
 */
export function inAtelier(miscari: readonly Miscare[]): InAtelier[] {
  const acc = new Map<string, InAtelier>();
  const cheie = (a: Articol, p: string | null): string => `${a.cheie}#${p ?? ""}`;
  const pune = (a: Articol, p: string | null, q: number, nota?: string): void => {
    const k = cheie(a, p);
    const x = acc.get(k) ?? { articol: a, pentru: p, cantitate: 0, cereri: [] };
    x.cantitate += q;
    if (nota && q > 0) x.cereri.push(nota);
    acc.set(k, x);
  };
  for (const m of miscari) {
    if (m.anuleaza || esteAnulata(m, miscari)) continue;
    if (m.spre === ATELIER && m.din !== ATELIER) pune(m.articol, m.lucrareId ?? null, m.cantitate, m.nota);
    if (m.din === ATELIER && m.tip !== "intrare") {
      const destinatie = m.lucrareId ?? m.spre ?? null;
      const rezervat = acc.get(cheie(m.articol, destinatie));
      pune(m.articol, rezervat && rezervat.cantitate > 0 ? destinatie : null, -m.cantitate);
    }
  }
  return [...acc.values()]
    .map((x) => ({ ...x, cantitate: Math.round(x.cantitate * 100) / 100 }))
    .filter((x) => x.cantitate > 0);
}

/** Un pas din drumul unui material spre un șantier. */
export interface Pas {
  data: string;
  /** furnizor → central, central → atelier, atelier → șantier, șantier → șantier … */
  din: string;
  spre: string;
  cantitate: number;
  miscare: Miscare;
}

/**
 * Drumul unui material spre un șantier: de la furnizor, prin central și
 * atelier, până pe șantier (gata când-ul Fazei 5). Intră intrările acelui
 * material în central sau direct pe șantier, transferurile făcute pentru el
 * (`lucrareId`) și orice transfer care ajunge pe șantier sau pleacă de pe el.
 * Mărcile nu despart drumul (`cheieBaza`). `din` / `spre` sunt id-uri de loc,
 * iar la intrare `din` e furnizorul (sau motivul, „stoc de pornire”; altfel
 * „furnizor”).
 */
export function drumul(miscari: readonly Miscare[], material: string, santier: string): Pas[] {
  return miscari
    .filter((m) => !m.anuleaza && !esteAnulata(m, miscari) && cheieBaza(m.articol) === material)
    .filter((m) => (m.tip === "intrare" && (m.spre === CENTRAL || m.spre === ATELIER || m.spre === santier))
      || m.lucrareId === santier || m.spre === santier || m.din === santier)
    .map((m) => ({
      data: m.data,
      // Stocul de pornire (Faza 8) nu vine de la un furnizor: drumul îl spune ca atare.
      din: m.tip === "intrare" ? (m.furnizor ?? m.motiv ?? "furnizor") : m.din ?? "",
      spre: m.spre ?? (m.furnizor ? `${m.furnizor} (retur)` : ""),
      cantitate: m.cantitate,
      miscare: m,
    }))
    .sort((a, b) => a.data.localeCompare(b.data));
}
