import ExcelJS from "exceljs";

/**
 * Registrul de ofertă recitit, pe roluri: testele nu mai depind de litera
 * coloanei, care se schimbă după ofertă (codul doar cu coduri, golul doar la
 * foc). Antetul tabelului e pe rândul 15, ca în ofertele semnate.
 */
export interface PozitieCitita {
  rand: number;
  nr: number;
  cod: string | null;
  /** Toată celula, cu textul roșu lipit. */
  denumire: string;
  /** Doar partea scrisă cu roșu: specificația noastră. */
  rosu: string;
  um: string;
  cantitate: number;
  gol: string | null;
  pretUnitar: number;
  valoare: number;
}

export interface OfertaCitita {
  wb: ExcelJS.Workbook;
  coloane: string[];
  pozitii: PozitieCitita[];
  /** Rândurile de total și de capitol, cu valoarea din ultima coloană (sau null). */
  randuri: { rand: number; text: string; valoare: number | null }[];
  /** Tot textul foii „Ofertă”, pentru căutări. */
  text: string;
  /** Tot textul foii „Pentru noi”. */
  intern: string;
}

const simplu = (v: ExcelJS.CellValue): unknown => {
  if (v && typeof v === "object" && "result" in v) return v.result;
  if (v && typeof v === "object" && "richText" in v) return v.richText.map((p) => p.text).join("");
  return v;
};

const tot = (ws: ExcelJS.Worksheet | undefined): string => {
  const t: string[] = [];
  ws?.eachRow((r) => r.eachCell((c) => t.push(String(simplu(c.value) ?? ""))));
  return t.join(" | ");
};

export async function citesteOferta(buf: ArrayBuffer): Promise<OfertaCitita> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const ws = wb.getWorksheet("Ofertă")!;
  const coloane = (ws.getRow(15).values as unknown[]).slice(1).map((v) => String(v ?? ""));
  const i = (titlu: string): number => coloane.indexOf(titlu) + 1;
  const n = coloane.length;
  const pozitii: PozitieCitita[] = [];
  const randuri: OfertaCitita["randuri"] = [];
  ws.eachRow((r, nr) => {
    if (nr <= 15) return;
    const a = simplu(r.getCell(1).value);
    if (typeof a === "number") {
      const den = r.getCell(i("Denumire")).value;
      pozitii.push({
        rand: nr, nr: a,
        cod: i("Cod") ? (String(simplu(r.getCell(i("Cod")).value) ?? "") || null) : null,
        denumire: String(simplu(den) ?? ""),
        rosu: den && typeof den === "object" && "richText" in den
          ? den.richText.filter((p) => p.font?.color?.argb === "FFFF0000").map((p) => p.text).join("") : "",
        um: String(simplu(r.getCell(i("UM")).value) ?? ""),
        cantitate: Number(simplu(r.getCell(i("Cantitate")).value)),
        gol: i("Dimensiune gol") ? (String(simplu(r.getCell(i("Dimensiune gol")).value) ?? "") || null) : null,
        pretUnitar: Number(simplu(r.getCell(n - 1).value)),
        valoare: Number(simplu(r.getCell(n).value)),
      });
    } else if (typeof a === "string" && a !== "") {
      const v = simplu(r.getCell(n).value);
      randuri.push({ rand: nr, text: a, valoare: typeof v === "number" ? v : null });
    }
  });
  return { wb, coloane, pozitii, randuri, text: tot(ws), intern: tot(wb.getWorksheet("Pentru noi")) };
}

/** Valoarea rândului de total care începe cu `eticheta`. */
export const totalul = (o: OfertaCitita, eticheta: string): number | null =>
  o.randuri.find((r) => r.text.startsWith(eticheta))?.valoare ?? null;
