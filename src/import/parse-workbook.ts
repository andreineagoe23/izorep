import ExcelJS from "exceljs";

export interface LinieBruta {
  index: number;
  foaie: string;
  rand: number;
  /** Textul concatenat al celulelor de tip text din rand. */
  text: string;
  um?: string;
  cantitate?: number;
  celule: (string | number | null)[];
}

/**
 * O celula din grila afisata 1:1. `span` e latimea imbinarii, ca ecranul sa
 * redea titlul intins peste sase coloane ca pe un singur titlu, nu ca pe
 * aceeasi valoare repetata de sase ori.
 *
 * ATENTIE: imbinarile se desfac DOAR aici. `LinieBruta.celule` pastreaza
 * valoarea repetata, pentru ca `esteAntetSectiune` recunoaste antetul de
 * sectiune exact dupa repetitia aia — desfacut acolo, extragerea inchiderilor
 * goluri la foc pierde sectiunea si, cu ea, 53 de pozitii.
 */
export interface CelulaBruta {
  v: string | number | null;
  span: number;
}

export interface RandBrut {
  /** Numarul randului din Excel, cel din gutter-ul aplicatiei. */
  rand: number;
  celule: CelulaBruta[];
  /** Pozitia extrasa din randul asta, cand randul e o pozitie. */
  linie?: LinieBruta;
}

/** O foaie din registru, asa cum se vede in Excel. */
export interface FoaieBruta {
  /** Numele foii, exact cum e scris in registru. */
  nume: string;
  /** Randul de antet, daca s-a gasit unul. Lipseste la foile fara antet. */
  antet?: RandBrut;
  /** Toate randurile care contin ceva, in ordinea din fisier, antetul inclus. */
  randuri: RandBrut[];
  /** Latimea grilei: randul cel mai lat da numarul de coloane. */
  coloane: number;
}

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

const UM = /^(ml|m|m²|m2|mp|buc|buc\.|pcs|stk|lm|kg|to)$/i;

/**
 * Cantitatea de pe rand.
 *
 * Euristica provizorie: cantitatea sta lipita de unitatea de masura — dupa ea
 * in listele de cantitati (Nr | Denumire | UM | Cantitate), inainte in oferte
 * (Nr | Denumire | Cant | UM | Pret). Primul numar de pe rand e aproape
 * intotdeauna numarul curent al pozitiei, nu cantitatea.
 *
 * Asta e o ghicitoare si trebuie sa ramana asa doar pana exista maparea de
 * coloane per client (L1). Odata mapata coloana, euristica nu se mai foloseste.
 */
function cantitate(celule: (string | number | null)[], iUm: number): number | undefined {
  const nr = (i: number) => (typeof celule[i] === "number" && (celule[i] as number) > 0 ? (celule[i] as number) : undefined);
  if (iUm >= 0) {
    for (let i = iUm + 1; i < celule.length; i++) { const v = nr(i); if (v !== undefined) return v; }
    for (let i = iUm - 1; i >= 0; i--) { const v = nr(i); if (v !== undefined) return v; }
    return undefined;
  }
  const numere = celule.filter((c): c is number => typeof c === "number" && c > 0);
  return numere.length > 1 ? numere[1] : numere[0];
}

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

/**
 * Liniile de pozitie, in ordinea din registru. Sunt aceleasi obiecte care stau
 * si in grila: indexul se atribuie o singura data, la parcurgerea foilor, deci
 * randul din tabel si linia trimisa la model nu pot ajunge sa se refere la
 * randuri diferite.
 */
export const liniile = (foi: FoaieBruta[]): LinieBruta[] =>
  foi.flatMap((f) => f.randuri.flatMap((r) => (r.linie ? [r.linie] : [])));

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

      const texte = brute.filter((c): c is string => typeof c === "string" && c.trim().length > 3);
      if (texte.length === 0) return;
      const text = texte.join(" | ").trim();
      if (text.length < 12) return;

      const iUm = brute.findIndex((c) => typeof c === "string" && UM.test(c.trim()));
      const um = iUm >= 0 ? String(brute[iUm]).trim() : undefined;

      rand.linie = {
        index: index++, foaie: ws.name, rand: nr, text, celule: brute,
        ...(um ? { um } : {}),
        ...(() => {
          const q = cantitate(brute, iUm);
          return q === undefined ? {} : { cantitate: q };
        })(),
      };
    });

    const antet = randuri.slice(0, RANDURI_CAUTARE_ANTET).find((r) => esteRandAntet(r.celule));
    const coloane = randuri.reduce((max, r) => Math.max(max, latime(r.celule)), 0);
    foi.push({ nume: ws.name, randuri, coloane, ...(antet ? { antet } : {}) });
  }
  return foi;
}

const latime = (celule: CelulaBruta[]): number => celule.reduce((s, c) => s + c.span, 0);
