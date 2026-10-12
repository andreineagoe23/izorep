/**
 * Datele demo față de ofertele semnate din care au fost scrise.
 *
 * Demo-ul arată firmei propriile ei oferte. Până pe 28 septembrie 2026 lucrările
 * 118 și 118.1 apăreau cu valoarea dublată (341.038,78 în loc de 170.519,39 —
 * rândurile de TOTAL adunate o dată în plus), iar anexa 5997 cu 585,40 din 10
 * rânduri, în loc de 706,90 din 16. Firma și-ar fi recunoscut greșeala pe loc.
 *
 * Totalul se citește din rândul „TOTAL GENERAL", altfel din ultimul „TOTAL"
 * al fiecărei foi, adunat pe foi. Același tipar ca în `oferte-semnate.test.ts`:
 * fișierele firmei nu sunt în repo, deci fără ele testul nu verifică nimic
 * despre ele și nu se sare.
 */
import { describe, it, expect } from "vitest";
import { CLIENTI, cuClienti } from "./conditii.js";
import ExcelJS from "exceljs";
import { DOCUMENTE, LUCRARI } from "../web/date/seed.js";

const DIR = CLIENTI;

async function totalSemnat(fisier: string): Promise<number> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(`${DIR}/${fisier}`);
  let general: number | undefined;
  let total = 0;
  for (const ws of wb.worksheets) {
    let peFoaie: number | undefined;
    ws.eachRow((r) => {
      const v = (r.values as unknown[]).slice(1)
        .map((x) => (x && typeof x === "object" && "result" in x ? (x as { result: unknown }).result : x));
      const text = v.find((x): x is string => typeof x === "string") ?? "";
      const numar = v.filter((x): x is number => typeof x === "number").pop();
      if (numar === undefined) return;
      if (/^TOTAL\s+GENERAL/i.test(text)) general = numar;
      else if (/^TOTAL/i.test(text)) peFoaie = numar;
    });
    total += peFoaie ?? 0;
  }
  return Math.round((general ?? total) * 100) / 100;
}

describe("datele demo au valorile ofertelor semnate", () => {
  cuClienti("fiecare ofertă cu fișier are exact totalul semnat, iar lucrarea ei la fel", async () => {
    const oferte = DOCUMENTE.filter((d) => d.tip === "oferta" && d.valoare !== null);
    expect(oferte.length).toBeGreaterThan(0);
    for (const d of oferte) {
      expect(d.valoare, d.fisierSursa).toBe(await totalSemnat(d.fisierSursa));
      const lucrare = LUCRARI.find((l) => l.id === d.lucrareId);
      if (lucrare) expect(lucrare.contractat, lucrare.id).toBe(d.valoare);
    }
  });

  it("fișierele documentelor sunt cele din attachments, cu numele de azi", () => {
    // Numele vechi („Oferta 27.04.2026.xlsx") nu mai există pe disc din
    // 13 septembrie 2026; un nume vechi în demo nu poate fi verificat.
    for (const d of DOCUMENTE) expect(d.fisierSursa, d.id).toMatch(/^[a-z0-9-]+\.xlsx$/);
  });

  it("nicio dată inventată: cererile fără dată în fișier o au null", () => {
    const transavia = DOCUMENTE.filter((d) => d.fisierSursa.startsWith("cerere-de-oferta-transavia"));
    expect(transavia.map((d) => d.data)).toEqual([null, null]);
  });
});
