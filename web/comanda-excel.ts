/**
 * Doua registre `.xlsx`, ca `web/oferta.ts`: pure, fara DOM, testate in Node.
 *
 * - **Comanda** pentru furnizor (S27): ce se cere, cat, pentru ce obiectiv si
 *   pe ce firma vine factura. Merge atasata la emailul din `textEmail`.
 * - **Evidenta cumpararilor**, cu coloanele Excelului firmei
 *   (`EVIDENTA MATERIALE … 2025.xlsx`, foaia „top valoric-cantitativ”):
 *   FURNIZOR · NUME PROIECT · NR.DOC. · DATA DOC. · DENUMIRE PRODUS ·
 *   CANTITATE · UM · PRET UNITAR RON · CURS VALUTAR · PRET UNITAR EURO ·
 *   VALOARE RON · VALOARE EUR · AVIZE FACTURI. Faza 8: cat timp firma isi mai
 *   tine Excelul, intrarile din aplicatie se lipesc in el fara rescriere.
 */
import type { Comanda } from "../src/stoc/comenzi.js";
import { cantitateComanda } from "../src/stoc/comenzi.js";
import { denumireComanda, kgPeMp } from "../src/stoc/produse.js";
import { esteAnulata, laFurnizor, type Miscare } from "../src/stoc/registru.js";
import { estePornire } from "../src/stoc/inventar.js";
import { bani } from "../src/pricing/engine.js";

export type Celula = string | number | null;

export const dataRo = (iso: string): string => {
  const [a, l, z] = iso.slice(0, 10).split("-");
  return `${z}.${l}.${a}`;
};

export async function registruComanda(c: Comanda, obiectiv: string): Promise<ArrayBuffer> {
  const { default: ExcelJS } = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Comanda");
  ws.columns = [{ width: 6 }, { width: 58 }, { width: 26 }];
  ws.addRow([`Comandă către ${c.furnizor}`]).font = { bold: true, size: 13 };
  ws.addRow([`Obiectiv: ${obiectiv || "stocul general"}`]);
  ws.addRow([`Data: ${dataRo(c.trimisa ?? c.creat)}`]);
  ws.addRow([`Factura pe ${c.firma}`]);
  if (c.suplimentara) ws.addRow([`Comandă suplimentară: ${c.suplimentara}`]);
  ws.addRow([]);
  ws.addRow(["Nr.", "Material", "Cantitate"]).font = { bold: true };
  c.linii.forEach((l, i) => ws.addRow([i + 1, denumireComanda(l.articol), cantitateComanda(l)]));
  if (c.nota) { ws.addRow([]); ws.addRow([c.nota]); }
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}

export const CAPETE_EVIDENTA = [
  "FURNIZOR", "NUME PROIECT", "NR.DOC.", "DATA DOC.", "DENUMIRE PRODUS", "CANTITATE", "UM",
  "PRET UNITAR RON - FARA TVA", "CURS VALUTAR", "PRET UNITAR EURO - FARA TVA",
  "VALOARE VANZARE RON - FARA TVA", "VALOARE VANZARE EUR - FARA TVA", "AVIZE FACTURI",
] as const;

/**
 * Un rand de evidenta pe fiecare intrare de la furnizor, neanulata. Tabla e la
 * kg, ca pe factura; restul in ml sau mp. `proiect` da numele lucrarii dupa
 * depozitul in care a intrat marfa. Returul la furnizor iese cu cantitatea si
 * valoarea cu minus, ca o factura storno in evidenta lor. Stocul de pornire
 * (Faza 8) nu e o cumparare: nu intra.
 */
export function randuriEvidenta(
  miscari: readonly Miscare[], proiect: (depozit: string | undefined) => string,
): Celula[][] {
  const out: Celula[][] = [];
  for (const m of miscari) {
    const retur = laFurnizor(m);
    if ((m.tip !== "intrare" && !retur) || estePornire(m) || m.anuleaza || m.exemplu || esteAnulata(m, miscari)) continue;
    out.push(randEvidenta(m, proiect(retur ? m.din : m.spre), retur ? -1 : 1));
  }
  return out;
}

/**
 * Randul unei miscari cu coloanele `CAPETE_EVIDENTA`, cantitatea si valoarea
 * cu semnul dat. Pretul e cel de pe document; fara el (transfer, consum,
 * ajustare), `pretMediu` in euro, daca e dat (S44: ce vine din depozit sau de
 * pe alt santier, la pretul mediu).
 */
export function randEvidenta(m: Miscare, proiect: string, semn: 1 | -1, pretMediu: number | null = null): Celula[] {
  const kg = kgPeMp(m.articol);
  const q = Math.abs(m.cantitate);
  const cant = semn * (kg !== null ? Math.round(q * kg * 1000) / 1000 : q);
  const um = kg !== null ? "KG" : m.articol.um === "ml" ? "ML" : "MP";
  // Pretul din stoc e pe unitatea articolului; in evidenta, pe unitatea de pe factura.
  const peDoc = (v: number): number => (kg !== null ? v / kg : v);
  const r4 = (v: number): number => Math.round(v * 10000) / 10000;
  const lei = m.pret?.lei !== undefined ? r4(peDoc(m.pret.lei)) : null;
  const eurUnitate = m.pret ? m.pret.valoare : pretMediu;
  const eur = eurUnitate !== null ? r4(peDoc(eurUnitate)) : null;
  const doc = m.document;
  const factura = doc?.tip === "factura" ? doc : null;
  const aviz = /\(aviz ([^)]+)\)/.exec(m.nota ?? "")?.[1] ?? (doc?.tip === "aviz" ? doc.numar : null);
  return [
    m.furnizor ?? null, proiect, factura?.numar ?? doc?.numar ?? null, doc ? dataRo(doc.data) : dataRo(m.data),
    denumireComanda(m.articol).toUpperCase(), cant, um, lei, m.pret?.curs ?? null, eur,
    lei !== null ? bani(lei * cant) : null, eur !== null ? bani(eur * cant) : null,
    aviz,
  ];
}

export async function registruEvidenta(randuri: Celula[][]): Promise<ArrayBuffer> {
  const { default: ExcelJS } = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("top valoric-cantitativ");
  ws.addRow([...CAPETE_EVIDENTA]).font = { bold: true };
  for (const r of randuri) ws.addRow(r);
  ws.columns.forEach((col, i) => { col.width = i === 4 ? 48 : i === 0 || i === 1 ? 22 : 14; });
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}
