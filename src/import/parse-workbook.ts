import ExcelJS from "exceljs";
import { construiesteLinie, liniile, type CelulaBruta, type FoaieBruta, type LinieBruta, type RandBrut } from "./rand.js";

// Partea pura a lui L0 sta in `rand.ts`, ca sa nu traga ExcelJS in
// bundle-ul de browser prin `editare.ts`. Se re-exporta de aici: apelantii
// vechi importa in continuare din `parse-workbook.js`.
export { construiesteLinie, liniile } from "./rand.js";
export type { CelulaBruta, FoaieBruta, LinieBruta, RandBrut } from "./rand.js";

const valoare = (c: ExcelJS.CellValue): string | number | null => {
  if (c === null || c === undefined) return null;
  if (typeof c === "number" || typeof c === "string") return c;
  if (c instanceof Date) return c.toISOString();
  if (typeof c === "object") {
    if ("result" in c) return valoare(c.result as ExcelJS.CellValue);   // formula
    if ("richText" in c) return c.richText.map((r) => r.text).join("");
    if ("text" in c) return String(c.text);
    if ("error" in c) return null;                                      // #REF! etc
  }
  return null;
};

/**
 * Randul de antet al unei foi.
 *
 * Nu e pe pozitie fixa: in `Radoia.xlsx` e r6, in oferta Matari r14, in
 * `Flower City` r5, in `Book15` r1, iar in `Izolatii Transavia` nu exista
 * deloc — datele incep direct de la primul rand. De-aia se cauta, si de-aia
 * cautarea are voie sa nu gaseasca nimic.
 *
 * Regulile sunt fizice, ca peste tot in L0 — nu se uita la ce scrie in celule:
 *
 * 1. cel putin 3 celule pline — un titlu imbinat intra ca o singura celula
 *    (span), deci cade aici;
 * 2. nicio celula numerica — antetul e format din etichete, randul de date are
 *    cantitati si preturi;
 * 3. cel mult o eticheta lunga, si aia sub 120 de caractere. Nu e o limita
 *    aleasa din burta: antetul din `Oferta 27.04.2026` are o celula de 87 de
 *    caractere ("DENUMIRE MATERIAL, DATE TEHNICE, OPERATIUNI INCLUSE IN
 *    ARTICOL…"), deci un prag de 60 taia un antet real, iar un rand de
 *    descrieri de articol are mai multe celule lungi, nu una;
 * 4. nu mai mult de jumatate din celule pur numerice ca text — asta taie randul
 *    "1 2 3 4 5" de numerotare a coloanelor din `Flower City` si `Book15`.
 *
 * Se cauta doar in primele randuri: mai jos, un rand de date ar putea trece
 * regulile si ar muta antetul in mijlocul tabelului.
 */
const RANDURI_CAUTARE_ANTET = 30;
const DOAR_CIFRE = /^[\d.,\/=+xX%\s()-]+$/;
const ETICHETA_LUNGA = 40;
const ETICHETA_IMPOSIBILA = 120;

export function esteRandAntet(celule: CelulaBruta[]): boolean {
  const pline = celule.filter((c) => c.v !== null && String(c.v).trim() !== "");
  if (pline.length < 3) return false;
  if (pline.some((c) => typeof c.v === "number")) return false;
  const texte = pline.map((c) => String(c.v).trim());
  if (texte.some((t) => t.length > ETICHETA_IMPOSIBILA)) return false;
  if (texte.filter((t) => t.length > ETICHETA_LUNGA).length > 1) return false;
  if (texte.filter((t) => DOAR_CIFRE.test(t)).length * 2 > texte.length) return false;
  return true;
}

/**
 * L0: parsare fizica. Zero AI, zero interpretare.
 * Scoate din registru randurile care contin text substantial, impreuna cu
 * unitatea de masura si cantitatea daca sunt recognoscibile pe rand.
 */
export async function parseWorkbook(cale: string): Promise<LinieBruta[]> {
  return liniile(await incarca(cale));
}

/** Aceeasi parsare, pornind de la continutul fisierului. Varianta din browser. */
export async function parseWorkbookBuffer(buf: ArrayBuffer): Promise<LinieBruta[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  return liniile(extrageFoi(wb));
}

/** Registrul ca grila, foaie cu foaie, pentru afisarea 1:1 din ecranul de import. */
export async function parseFoi(cale: string): Promise<FoaieBruta[]> {
  return incarca(cale);
}

/** Aceeasi grila, pornind de la continutul fisierului. Varianta din browser. */
export async function parseFoiBuffer(buf: ArrayBuffer): Promise<FoaieBruta[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  return extrageFoi(wb);
}

async function incarca(cale: string): Promise<FoaieBruta[]> {
  if (!cale.toLowerCase().endsWith(".xlsx")) {
    throw new Error(".xls vechi (BIFF8) nu e suportat de ExcelJS; converteste in .xlsx");
  }
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(cale);
  return extrageFoi(wb);
}

function extrageFoi(wb: ExcelJS.Workbook): FoaieBruta[] {
  const foi: FoaieBruta[] = [];
  let index = 0;

  for (const ws of wb.worksheets) {
    const randuri: RandBrut[] = [];

    ws.eachRow({ includeEmpty: false }, (row, nr) => {
      // Doua forme ale aceluiasi rand: `brute` pastreaza valoarea repetata a
      // imbinarilor (contractul lui `LinieBruta`), `celule` o desface in span.
      const brute: (string | number | null)[] = [];
      const celule: CelulaBruta[] = [];

      row.eachCell({ includeEmpty: true }, (c) => {
        const v = valoare(c.value);
        brute.push(v);
        const stapan = c.isMerged ? c.master : c;
        if (stapan === c) { celule.push({ v, span: 1 }); return; }
        // Continuare de imbinare: pe orizontala creste span-ul celulei stapan,
        // pe verticala ramane o celula goala, ca sa nu se repete valoarea in
        // jos si sa nu se strice alinierea coloanelor.
        const ultima = celule[celule.length - 1];
        if (stapan.row === c.row && ultima) ultima.span++;
        else celule.push({ v: null, span: 1 });
      });

      const rand: RandBrut = { rand: nr, celule };
      randuri.push(rand);

      const linie = construiesteLinie(brute, { index, foaie: ws.name, rand: nr });
      if (linie) { rand.linie = linie; index++; }
    });

    const antet = randuri.slice(0, RANDURI_CAUTARE_ANTET).find((r) => esteRandAntet(r.celule));
    const coloane = randuri.reduce((max, r) => Math.max(max, latime(r.celule)), 0);
    foi.push({ nume: ws.name, randuri, coloane, ...(antet ? { antet } : {}) });
  }
  return foi;
}

const latime = (celule: CelulaBruta[]): number => celule.reduce((s, c) => s + c.span, 0);
