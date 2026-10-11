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

const dataRo = (iso: string): string => {
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
 * valoarea cu minus, ca o factura storno in evidenta lor.
 */
export function randuriEvidenta(
  miscari: readonly Miscare[], proiect: (depozit: string | undefined) => string,
): (string | number | null)[][] {
  const out: (string | number | null)[][] = [];
  for (const m of miscari) {
    const retur = laFurnizor(m);
    if ((m.tip !== "intrare" && !retur) || m.anuleaza || m.exemplu || esteAnulata(m, miscari)) continue;
    const kg = kgPeMp(m.articol);
    const cant = (retur ? -1 : 1) * (kg !== null ? Math.round(m.cantitate * kg * 1000) / 1000 : m.cantitate);
    const um = kg !== null ? "KG" : m.articol.um === "ml" ? "ML" : "MP";
    // Pretul din stoc e pe unitatea articolului; in evidenta, pe unitatea de pe factura.
    const peDoc = (v: number): number => (kg !== null ? v / kg : v);
    const lei = m.pret?.lei !== undefined ? Math.round(peDoc(m.pret.lei) * 10000) / 10000 : null;
    const eur = m.pret ? Math.round(peDoc(m.pret.valoare) * 10000) / 10000 : null;
    const doc = m.document;
    const factura = doc?.tip === "factura" ? doc : null;
    const aviz = /\(aviz ([^)]+)\)/.exec(m.nota ?? "")?.[1] ?? (doc?.tip === "aviz" ? doc.numar : null);
    out.push([
      m.furnizor ?? null, proiect(retur ? m.din : m.spre), factura?.numar ?? doc?.numar ?? null, doc ? dataRo(doc.data) : dataRo(m.data),
      denumireComanda(m.articol).toUpperCase(), cant, um, lei, m.pret?.curs ?? null, eur,
      lei !== null ? Math.round(lei * cant * 100) / 100 : null, eur !== null ? Math.round(eur * cant * 100) / 100 : null,
      aviz,
    ]);
  }
  return out;
}

export async function registruEvidenta(randuri: (string | number | null)[][]): Promise<ArrayBuffer> {
  const { default: ExcelJS } = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("top valoric-cantitativ");
  ws.addRow([...CAPETE_EVIDENTA]).font = { bold: true };
  for (const r of randuri) ws.addRow(r);
  ws.columns.forEach((col, i) => { col.width = i === 4 ? 48 : i === 0 || i === 1 ? 22 : 14; });
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}
