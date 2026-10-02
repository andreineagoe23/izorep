/**
 * Situația de lucrări ca `.xlsx`, ca oferta: același format pe care firma îl
 * trimite azi, pur, fără DOM (`Blob` stă în `web/descarca.ts`), testat în Node.
 *
 * Coloanele sunt cele obișnuite ale unei situații de lucrări: cantitatea din
 * ofertă, prețul unitar din ofertă, ce s-a executat înainte, acum și cumulat,
 * valoarea perioadei și cea cumulată. Formatul exact al firmei nu îl avem încă
 * (e cerut în `docs/intrebari-firma.md`); când vine, se schimbă doar aici.
 */
import { randuriSituatie, totalSituatie, type PlanSantier, type Situatie, type Totaluri } from "../src/lucrari/situatii.js";

const CAPETE = [
  "Nr.", "Denumire", "UM", "Cant. ofertă", "Preț unitar €",
  "Cant. anterioară", "Cant. în perioadă", "Cant. cumulată", "Valoare perioadă €", "Valoare cumulată €",
];

export async function registruSituatie(plan: PlanSantier, s: Situatie): Promise<ArrayBuffer> {
  const { default: ExcelJS } = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  wb.creator = plan.firma;
  const ws = wb.addWorksheet(`Situatia ${s.nr}`);
  ws.columns = [
    { width: 6 }, { width: 60 }, { width: 7 }, { width: 12 }, { width: 12 },
    { width: 13 }, { width: 13 }, { width: 13 }, { width: 16 }, { width: 16 },
  ];
  const data = new Date(s.data).toLocaleDateString("ro-RO", { day: "2-digit", month: "2-digit", year: "numeric" });
  ws.getCell("A1").value = `SITUATIE DE LUCRARI NR. ${s.nr} / ${data}`;
  ws.mergeCells("A1:J1");
  ws.getCell("A1").font = { bold: true, size: 14 };
  ws.getCell("A1").alignment = { horizontal: "center" };
  ws.getCell("A3").value = `Beneficiar : ${plan.client}`;
  ws.getCell("A4").value = `Obiectiv : ${plan.denumire}`;
  ws.getCell("A5").value = plan.oferta ? `Conform ofertei ${plan.oferta}` : `Conform ofertei din ${plan.fisier}`;
  if (s.nota) ws.getCell("A6").value = s.nota;

  const antet = ws.getRow(8);
  antet.values = CAPETE;
  antet.font = { bold: true };
  let r = 9;
  for (const x of randuriSituatie(plan, s)) {
    ws.getRow(r++).values = [
      x.poz.nr, x.poz.denumire, x.poz.um, x.poz.cantitate, x.poz.pretUnitar,
      x.anterior, x.curent, x.cumulat,
      Math.round(x.poz.pretUnitar * x.curent * 10000) / 10000,
      Math.round(x.poz.pretUnitar * x.cumulat * 10000) / 10000,
    ];
    for (const c of ["I", "J"]) ws.getCell(`${c}${r - 1}`).numFmt = "#,##0.00";
  }

  const { curent, cumulat } = totalSituatie(plan, s);
  r++;
  const rand = (eticheta: string, cheie: keyof Totaluri): void => {
    ws.getCell(`A${r}`).value = eticheta;
    ws.mergeCells(`A${r}:H${r}`);
    ws.getCell(`I${r}`).value = curent[cheie];
    ws.getCell(`J${r}`).value = cumulat[cheie];
    ws.getRow(r).font = { bold: true };
    r++;
  };
  rand("TOTAL LUCRARI (fara TVA)", "lucrari");
  if (plan.adaosFocProcent > 0) rand(`ADAOS INCHIDERI GOLURI LA FOC ${plan.adaosFocProcent} %`, "adaosFoc");
  if (plan.discountProcent > 0) rand(`DISCOUNT ${plan.discountProcent} %`, "discount");
  if (plan.adaosFocProcent > 0 || plan.discountProcent > 0) rand("TOTAL DE FACTURAT (fara TVA)", "total");

  r++;
  ws.getCell(`A${r}`).value = plan.firma;
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}

/** `Situatie-3-Transavia-29.09.2026.xlsx`: nume de fișier fără caractere care strică pe Windows. */
export function numeSituatie(plan: PlanSantier, s: Situatie): string {
  const zi = new Date(s.data).toLocaleDateString("ro-RO", { day: "2-digit", month: "2-digit", year: "numeric" });
  const obiectiv = plan.denumire.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, "-").slice(0, 40);
  return `Situatie-${s.nr}-${obiectiv}-${zi}.xlsx`;
}
