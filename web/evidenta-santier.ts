/**
 * Evidența materialului pe un șantier, în Excel (Faza 8.4): cât timp firma își
 * mai ține Excelul separat („se ține evidența materialului facturat, se mai
 * ține și un Excel separat”), aplicația îi dă rândurile gata de lipit.
 *
 * Primele 13 coloane sunt ale Excelului lor de evidență (`CAPETE_EVIDENTA`,
 * foaia „top valoric-cantitativ”), în aceeași ordine; o intrare de la furnizor
 * iese exact ca în „Descarcă evidența” din Comenzi. Excelul lor are doar
 * cumpărări, deci pentru restul mișcărilor (transfer, consum, retur, ajustare)
 * se adaugă la dreapta trei coloane: ce mișcare e, de unde sau unde, motivul.
 * Cantitatea e cu semn: plus ce a venit pe șantier, minus ce a plecat sau s-a
 * consumat. Prețul e cel de pe document; fără el, prețul mediu (S44).
 *
 * A doua foaie, „Sold pe material”: adus, consumat, plecat, ajustat și rămas,
 * în unitatea din aplicație (ml, m²). Rămasul e soldul șantierului din
 * `solduri`, deci cifrele Excelului ies din aceleași mișcări ca ecranul.
 *
 * Pur, fără DOM, ca `web/situatie.ts`; descărcarea e în `web/descarca.ts`.
 */
import { bani } from "../src/pricing/engine.js";
import { denumireComanda } from "../src/stoc/produse.js";
import { esteAnulata, laFurnizor, pretMediu, type Miscare } from "../src/stoc/registru.js";
import { CAPETE_EVIDENTA, randEvidenta, type Celula } from "./comanda-excel.js";

export const CAPETE_EVIDENTA_SANTIER = [...CAPETE_EVIDENTA, "TIP MISCARE", "DE UNDE / UNDE", "MOTIV / NOTA"] as const;
export const CAPETE_SOLD_SANTIER = ["DENUMIRE PRODUS", "UM", "ADUS", "CONSUMAT", "PLECAT", "AJUSTAT", "RAMAS PE SANTIER"] as const;

export interface EvidentaSantier {
  /** O mișcare pe rând, cu `CAPETE_EVIDENTA_SANTIER`. */
  miscari: Celula[][];
  /** Un material pe rând, cu `CAPETE_SOLD_SANTIER`. */
  sold: Celula[][];
}

const r2 = (x: number): number => Math.round(x * 100) / 100;

/** Ce fel de mișcare e, pentru om, văzută de pe șantier. */
function tipMiscare(m: Miscare, intra: boolean): string {
  if (m.tip === "intrare") return "intrare de la furnizor";
  if (laFurnizor(m)) return "retur la furnizor";
  if (m.tip === "consum") return "consum";
  if (m.tip === "ajustare") return "ajustare la inventar";
  if (m.tip === "retur") return intra ? "retur pe șantier" : "retur de pe șantier";
  return intra ? "transfer pe șantier" : "transfer de pe șantier";
}

/**
 * Evidența unui șantier, din mișcări: tot ce intră pe depozitul lui (`spre`)
 * și tot ce iese de pe el (`din`). Mișcările anulate și stornourile lor nu
 * apar (se anulează reciproc, ca în sold). `numeLoc` dă numele altui loc
 * (central, atelier, alt șantier) pentru coloana „de unde / unde”.
 */
export function evidentaSantier(
  miscari: readonly Miscare[], santier: string, proiect: string, numeLoc: (id: string) => string,
): EvidentaSantier {
  const pe = miscari
    .filter((m) => (m.spre === santier || m.din === santier) && !m.anuleaza && !m.exemplu && !esteAnulata(m, miscari))
    .sort((a, b) => a.data.localeCompare(b.data));
  const randuri: Celula[][] = [];
  const sold = new Map<string, { m: Miscare; adus: number; consumat: number; plecat: number; ajustat: number }>();
  for (const m of pe) {
    // Ajustarea are semnul ei; restul: plus ce intră pe șantier, minus ce iese.
    const intra = m.spre === santier;
    const semn: 1 | -1 = m.tip === "ajustare" ? (m.cantitate < 0 ? -1 : 1) : intra ? 1 : -1;
    const alt = intra ? m.din : m.spre;
    const undeE = m.tip === "intrare" || laFurnizor(m) ? (m.furnizor ?? "")
      : m.tip === "consum" || m.tip === "ajustare" ? "" : alt ? `${intra ? "din" : "spre"} ${numeLoc(alt)}` : "";
    randuri.push([
      ...randEvidenta(m, proiect, semn, m.pret ? null : pretMediu(miscari, m.articol.cheie)),
      tipMiscare(m, intra), undeE || null, (m.motiv ?? m.nota) || null,
    ]);
    const s = sold.get(m.articol.cheie) ?? { m, adus: 0, consumat: 0, plecat: 0, ajustat: 0 };
    const q = Math.abs(m.cantitate);
    if (m.tip === "ajustare") s.ajustat += m.cantitate;
    else if (intra) s.adus += q;
    else if (m.tip === "consum") s.consumat += q;
    else s.plecat += q;
    sold.set(m.articol.cheie, s);
  }
  return {
    miscari: randuri,
    sold: [...sold.values()].map((s) => [
      denumireComanda(s.m.articol).toUpperCase(), s.m.articol.um === "ml" ? "ML" : "MP",
      r2(s.adus), r2(s.consumat), r2(s.plecat), r2(s.ajustat), r2(s.adus - s.consumat - s.plecat + s.ajustat),
    ]),
  };
}

/** Totalul în euro al rândurilor cu preț (coloana VALOARE EUR). */
export const valoareEur = (e: EvidentaSantier): number =>
  bani(e.miscari.reduce((t, r) => t + (typeof r[11] === "number" ? r[11] : 0), 0));

export async function registruEvidentaSantier(e: EvidentaSantier, proiect: string): Promise<ArrayBuffer> {
  const { default: ExcelJS } = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Evidenta santier");
  ws.addRow([...CAPETE_EVIDENTA_SANTIER]).font = { bold: true };
  for (const r of e.miscari) ws.addRow(r);
  ws.columns.forEach((col, i) => { col.width = i === 4 ? 48 : i === 0 || i === 1 || i >= 13 ? 24 : 14; });
  const s = wb.addWorksheet("Sold pe material");
  s.addRow([`Materialul pe șantierul ${proiect}, din mișcările din aplicație`]).font = { bold: true };
  s.addRow([...CAPETE_SOLD_SANTIER]).font = { bold: true };
  for (const r of e.sold) s.addRow(r);
  s.columns.forEach((col, i) => { col.width = i === 0 ? 48 : 16; });
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}
