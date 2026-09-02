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
 * L0: parsare fizica. Zero AI, zero interpretare.
 * Scoate din registru randurile care contin text substantial, impreuna cu
 * unitatea de masura si cantitatea daca sunt recognoscibile pe rand.
 */
export async function parseWorkbook(cale: string): Promise<LinieBruta[]> {
  if (!cale.toLowerCase().endsWith(".xlsx")) {
    throw new Error(".xls vechi (BIFF8) nu e suportat de ExcelJS; converteste in .xlsx");
  }
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(cale);
  return extrageRanduri(wb);
}

/** Aceeasi parsare, pornind de la continutul fisierului. Varianta din browser. */
export async function parseWorkbookBuffer(buf: ArrayBuffer): Promise<LinieBruta[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  return extrageRanduri(wb);
}

function extrageRanduri(wb: ExcelJS.Workbook): LinieBruta[] {
  const out: LinieBruta[] = [];
  let index = 0;
  for (const ws of wb.worksheets) {
    ws.eachRow({ includeEmpty: false }, (row, nr) => {
      const celule: (string | number | null)[] = [];
      row.eachCell({ includeEmpty: true }, (c) => celule.push(valoare(c.value)));

      const texte = celule.filter((c): c is string => typeof c === "string" && c.trim().length > 3);
      if (texte.length === 0) return;
      const text = texte.join(" | ").trim();
      if (text.length < 12) return;

      const iUm = celule.findIndex((c) => typeof c === "string" && UM.test(c.trim()));
      const um = iUm >= 0 ? String(celule[iUm]).trim() : undefined;

      out.push({
        index: index++, foaie: ws.name, rand: nr, text, celule,
        ...(um ? { um } : {}),
        ...(() => {
          const q = cantitate(celule, iUm);
          return q === undefined ? {} : { cantitate: q };
        })(),
      });
    });
  }
  return out;
}
