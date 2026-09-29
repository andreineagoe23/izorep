import type { LinieCerere } from "./spre-cerere.js";

/**
 * Randurile confirmate din poze, ca registru `.xlsx` cu antet si zone.
 *
 * Ecranul de import primeste fisierul ca pe al unui client: aceeasi parsare,
 * aceeasi verificare, aceeasi oferta. Zona sta ca rand de sectiune.
 */
export async function registruCerere(linii: readonly LinieCerere[], titlu: string): Promise<ArrayBuffer> {
  const { default: ExcelJS } = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Masuratori");
  ws.addRow([titlu]);
  ws.addRow(["Nr.", "Denumire", "UM", "Cantitate"]);
  let zona: string | null = null;
  let nr = 0;
  for (const l of linii) {
    if (l.zona !== zona) {
      zona = l.zona;
      // Imbinata peste toate coloanele: asa arata un antet de sectiune intr-un
      // registru de client, si asa il recunoaste `esteAntetSectiune`.
      const r = ws.addRow([zona]);
      ws.mergeCells(r.number, 1, r.number, 4);
    }
    ws.addRow([++nr, l.text, l.um, l.cantitate]);
  }
  ws.getColumn(2).width = 80;
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}
