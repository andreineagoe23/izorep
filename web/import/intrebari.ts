/**
 * Întrebările pentru client (Etapa 6, `docs/plan-dupa-demo.md`): la aproape
 * tot ce lipsește din cerere firma a răspuns „întrebăm clientul”, iar rândul
 * nu intră în ofertă până răspunde (16 noiembrie 2026). Aplicația are deja
 * rândul, descrierea și ce lipsește, deci scrie ea întrebările: un text de
 * email gata de copiat și un Excel cu aceleași rânduri și o coloană de răspuns.
 *
 * Doar ce poate spune clientul: grosimea, materialul, tabla, golul, diametrul,
 * unitatea. Ce ține de noi (grosime care nu e în listă, preț de mână la
 * demontare sau la protecția la foc) nu e o întrebare pentru el.
 *
 * Fără DOM, cu teste (`tests/intrebari.test.ts`).
 */
import type { LinieProcesata } from "../../src/import/nucleu.js";
import { potrivit } from "../validare.js";

export interface Intrebare {
  index: number;
  foaie: string;
  /** Rândul din fișierul clientului, ca în Excel. */
  rand: number;
  /** Descrierea clientului, pe un rând. */
  descriere: string;
  intrebare: string;
}

const RECTANGULAR = /rectangular|dreptunghi|\d+\s*[x×*]\s*\d+/i;

/** Întrebarea pentru o poziție, sau nimic când lipsa nu e de întrebat clientul. */
export function intrebareFaraPret(l: LinieProcesata): string | null {
  const faraGrosime = l.extras.grosime_mm === null;
  if (potrivit(l, "netarifate")) {
    switch (l.codEroare) {
      case "grosime_ambigua":
        return "Ce grosime are izolația?";
      case "lipseste_materialul":
      case "pozitie_fara_straturi":
        return `Din ce material e izolația (vată minerală, elastomer)${faraGrosime ? " și ce grosime are" : ""}?`;
      case "tabla_fara_material":
        return "Din ce e tabla de protecție: aluminiu sau inox?";
      case "fara_diametru":
        return RECTANGULAR.test(l.bruta.text) ? "Ce dimensiuni are tubulatura (lățime × înălțime)?" : "Ce diametru are conducta?";
      case "dn_necunoscut":
        return "Ce diametru are conducta? DN-ul scris nu există în tabelul de conversie.";
      case "gol_fara_dimensiuni":
        return "Ce dimensiuni are golul (lățime × înălțime)?";
      case "diametru_conducta_lipsa":
        return "Ce diametru are conducta care trece prin gol?";
      case "material_conducta_lipsa":
        return "Țeava care trece prin gol e din oțel sau din plastic?";
      case "echipament":
        return "Ce dimensiuni are echipamentul (diametrul și lungimea)?";
      default:
        return null;
    }
  }
  if (potrivit(l, "de_validat")) {
    const m = l.pret?.motiveDeVerificat ?? [];
    if (m.includes("um_bucata")) return "Cantitatea e în bucăți: bucăți de ce (tuburi de câți metri, coturi, teuri)?";
    if (m.includes("um_lipsa")) return "În ce unitate e cantitatea: metri, bucăți sau m²?";
  }
  return null;
}

/** Descrierea clientului, fără coloanele goale și fără spațiile din celule. */
const descriereDin = (l: LinieProcesata): string =>
  l.bruta.text.split(" | ").map((t) => t.replace(/\s+/g, " ").trim()).filter(Boolean).join(" · ").slice(0, 300);

/** Întrebările cererii, în ordinea din fișier. */
export function intrebariClient(linii: readonly LinieProcesata[]): Intrebare[] {
  return linii.flatMap((l) => {
    if (l.extras.sistem === null && l.codEroare !== "lipseste_materialul") return [];
    const q = intrebareFaraPret(l);
    return q ? [{ index: l.extras.index, foaie: l.bruta.foaie, rand: l.bruta.rand, descriere: descriereDin(l), intrebare: q }] : [];
  });
}

/** „5 lucruri de întrebat clientul.” */
export const propozitieIntrebari = (n: number): string =>
  n === 1 ? "Un lucru de întrebat clientul." : `${n}${n % 100 >= 20 || (n > 0 && n % 100 === 0) ? " de" : ""} lucruri de întrebat clientul.`;

export interface DateEmail {
  /** Obiectivul sau, altfel, numele fișierului: despre ce cerere e vorba. */
  despre: string;
  firma?: string;
  /** Câte foi are fișierul: cu una singură, foaia nu se mai spune. */
  maiMulteFoi?: boolean;
}

/**
 * Textul de email, gata de copiat. Pe rândul din fișierul clientului, ca să-l
 * găsească repede, cu descrierea lui între ghilimele.
 */
export function textEmailIntrebari(intrebari: readonly Intrebare[], d: DateEmail): string {
  const randuri = intrebari.map((q, i) => {
    const unde = `Rândul ${q.rand}${d.maiMulteFoi ? ` (foaia ${q.foaie})` : ""}`;
    return `${i + 1}. ${unde}: „${q.descriere}”\n   ${q.intrebare}`;
  });
  return [
    "Bună ziua,",
    "",
    `Pentru oferta la ${d.despre} avem nevoie de câteva lămuriri la rândurile de mai jos din lista trimisă:`,
    "",
    ...randuri,
    "",
    "Până primim răspunsul, aceste poziții nu sunt incluse în ofertă.",
    "",
    "Mulțumim,",
    ...(d.firma ? [d.firma] : []),
  ].join("\n");
}

/** Același conținut ca Excel: foaia, rândul, descrierea, întrebarea și o coloană goală pentru răspuns. */
export async function excelIntrebari(intrebari: readonly Intrebare[], d: DateEmail): Promise<ArrayBuffer> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Intrebari");
  ws.addRow([`Întrebări pentru oferta la ${d.despre}`]).font = { bold: true, size: 13 };
  ws.addRow([]);
  const cap = ws.addRow([...(d.maiMulteFoi ? ["Foaia"] : []), "Rândul din lista dvs.", "Descrierea", "Întrebarea", "Răspunsul"]);
  cap.font = { bold: true };
  for (const q of intrebari) ws.addRow([...(d.maiMulteFoi ? [q.foaie] : []), q.rand, q.descriere, q.intrebare, ""]);
  const latimi = [...(d.maiMulteFoi ? [18] : []), 12, 70, 50, 40];
  latimi.forEach((w, i) => { const c = ws.getColumn(i + 1); c.width = w; c.alignment = { wrapText: true, vertical: "top" }; });
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}

/**
 * Cardul de pe fila Cerere: propoziția și „Scrie întrebările”; deschis, textul
 * de email (de citit și de copiat) și Excelul. Butoanele sunt albe: albastrul
 * paginii rămâne pasul din „Urmează”.
 */
export function cardIntrebari(intrebari: readonly Intrebare[], deschis: boolean, d: DateEmail): string {
  if (intrebari.length === 0) return "";
  const esc = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const ce = [...new Set(intrebari.map((q) => q.intrebare.split(/[?:(]/)[0]!.trim().toLocaleLowerCase("ro-RO")))].slice(0, 3);
  const text = textEmailIntrebari(intrebari, d);
  return `<section class="imp-card intrebari-client" aria-labelledby="titlu-intrebari">
    <div class="intrebari-sus">
      <p id="titlu-intrebari" style="margin:0"><b>${esc(propozitieIntrebari(intrebari.length))}</b>
        <span class="hint">${esc(ce.join(" · "))}${intrebari.length > ce.length ? " …" : ""}</span></p>
      <button type="button" class="secundar" data-act="intrebari" aria-expanded="${deschis}">${deschis ? "Ascunde întrebările" : "Scrie întrebările"}</button>
    </div>
    ${deschis ? `<p class="hint" style="margin:0">Rândurile acestea nu intră în ofertă până răspunde clientul. Când răspunde,
        scrie răspunsul pe rândul lui, mai jos.</p>
      <textarea class="intrebari-text" readonly rows="${Math.min(18, text.split("\n").length + 1)}" aria-label="Textul emailului">${esc(text)}</textarea>
      <div class="mat-actiuni">
        <button type="button" class="secundar" data-act="intrebari-copiaza">Copiază textul</button>
        <button type="button" class="secundar" data-act="intrebari-excel">Descarcă Excel</button>
      </div>` : ""}
  </section>`;
}
