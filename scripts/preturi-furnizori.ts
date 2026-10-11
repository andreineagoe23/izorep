/**
 * Preturile de achizitie pe articol, de pus pe ciorna comenzii (Faza 4, S26):
 *
 *   - lista K-Flex ST de la Banda Tech (24 iunie 2026), in €/ml;
 *   - ultima factura din evidenta firmei (ambele firme, din 2025), pe
 *     furnizor si articol, in lei, cu cursul de pe ea.
 *
 * Scrie `data/preturi-furnizori.json`, importat static ca listele de vanzare.
 * Denumirile se citesc cu `articolDinDenumire`, aceeasi functie ca la aviz si
 * factura: un articol pe care ea nu-l recunoaste nu primeste pret.
 *
 *   npm run preturi-furnizori -- ../attachments
 */
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { articolDinDenumire } from "../src/stoc/produse.js";
import { articolDin, cheieBaza } from "../src/stoc/registru.js";
import { numeFurnizor, type PreturiFurnizori, type PretFurnizor } from "../src/stoc/preturi-furnizori.js";

const ExcelJS = createRequire(import.meta.url)("exceljs") as typeof import("exceljs");
const dir = process.argv[2] ?? "../attachments";

const KFLEX = join(dir, "achizitii/furnizori/pret-furnizor-bandatech-kflex-st.xlsx");
const KFLEX_DATA = "2026-06-24";
const EVIDENTE = [
  join(dir, "achizitii/evidenta-achizitii-radoia-2017-2026.xlsx"),
  join(dir, "achizitii/evidenta-achizitii-isorad-2017-2026.xlsx"),
];
/** Preturile mai vechi nu mai spun nimic despre ce cere furnizorul azi. */
const DE_LA = "2025-01-01";
/** Cele doua firme isi vand una alteia: nu sunt furnizori. */
const INTRE_FIRME = /ISORAD|RADOIA/i;

const celula = (v: unknown): unknown => (v && typeof v === "object" && "result" in v ? (v as { result: unknown }).result : v);
const text = (v: unknown): string => String(celula(v) ?? "").trim();
const numar = (v: unknown): number | null => {
  const x = celula(v);
  const n = typeof x === "number" ? x : Number(String(x ?? "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
};

const preturi: Record<string, PretFurnizor[]> = {};
function pune(cheie: string, p: PretFurnizor): void {
  const lista = (preturi[cheie] ??= []);
  const i = lista.findIndex((x) => x.furnizor === p.furnizor);
  if (i < 0) lista.push(p);
  else if (p.data >= lista[i]!.data) lista[i] = p;
}

/** Unitatea de pe document trebuie sa fie a articolului, altfel pretul nu e pe ce credem. */
const umPotrivita = (forma: string, laKg: boolean | undefined, um: string): boolean =>
  laKg ? um === "KG" : forma === "tub" ? um === "ML" : um === "MP";

const kflex = new ExcelJS.Workbook();
await kflex.xlsx.readFile(KFLEX);
let dinKflex = 0;
kflex.worksheets[0]!.eachRow((r) => {
  const produs = text(r.getCell(1).value);
  // „ST SA” e tubul autoadeziv, alt produs, mai scump: pe comanda merge tubul simplu.
  if (!/^ST\s+\d/i.test(produs)) return;
  const pret = numar(r.getCell(5).value);
  const a = articolDinDenumire(produs);
  if (!a || pret === null || !umPotrivita(a.forma, a.laKg, text(r.getCell(4).value).toUpperCase())) return;
  pune(cheieBaza(articolDin(a)), {
    furnizor: "Banda Tech", valoare: pret, moneda: "EUR", data: KFLEX_DATA, sursa: "lista K-Flex ST, 24.06.2026",
  });
  dinKflex++;
});

let dinEvidenta = 0;
for (const f of EVIDENTE) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(f);
  wb.worksheets[0]!.eachRow((r, i) => {
    if (i < 3) return;
    const d = celula(r.getCell(4).value);
    if (!(d instanceof Date)) return;
    const data = d.toISOString().slice(0, 10);
    const furnizor = text(r.getCell(1).value);
    if (data < DE_LA || !furnizor || furnizor === "null" || INTRE_FIRME.test(furnizor)) return;
    const a = articolDinDenumire(text(r.getCell(5).value));
    const lei = numar(r.getCell(8).value);
    const curs = numar(r.getCell(9).value);
    if (!a || lei === null || !umPotrivita(a.forma, a.laKg, text(r.getCell(7).value).toUpperCase())) return;
    const doc = text(r.getCell(3).value);
    const [an, luna, zi] = data.split("-");
    pune(cheieBaza(articolDin(a)), {
      furnizor: numeFurnizor(furnizor), valoare: lei, moneda: "RON", data,
      sursa: `factura ${doc} din ${zi}.${luna}.${an}`, ...(curs ? { curs } : {}),
    });
    dinEvidenta++;
  });
}

for (const lista of Object.values(preturi)) lista.sort((a, b) => b.data.localeCompare(a.data) || a.furnizor.localeCompare(b.furnizor));
const iesire: PreturiFurnizori = {
  generat: new Date().toISOString().slice(0, 10),
  surse: ["lista K-Flex ST de la Banda Tech, 24.06.2026", `evidența de achiziții RADOIA și ISORAD, facturile din ${DE_LA}`],
  preturi: Object.fromEntries(Object.entries(preturi).sort(([a], [b]) => a.localeCompare(b))),
};
writeFileSync(new URL("../data/preturi-furnizori.json", import.meta.url), `${JSON.stringify(iesire, null, 1)}\n`);
console.log(`K-Flex: ${dinKflex} randuri; evidenta: ${dinEvidenta} randuri; ${Object.keys(preturi).length} articole cu pret.`);
