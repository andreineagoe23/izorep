/**
 * Etapa 6 (`docs/plan-dupa-demo.md`, 26 noiembrie 2026): întrebările pentru
 * client, scrise de aplicație din rândurile la care lipsește ce doar el știe.
 */
import { describe, expect, it } from "vitest";
import { join } from "node:path";
import ExcelJS from "exceljs";
import { parseFoi } from "../src/import/parse-workbook.js";
import { proceseazaRegistru } from "../src/import/nucleu.js";
import { mapariStatice } from "../src/import/mapari-statice.js";
import { stocInMemorie } from "../src/import/memorie.js";
import { cardIntrebari, excelIntrebari, intrebariClient, propozitieIntrebari, textEmailIntrebari } from "../web/import/intrebari.js";
import { deFacutLucrare, urmeaza } from "../web/lucrare.js";

const EX1 = join(__dirname, "../exemple-AI/exemplu-1-abur-industrial/1-cerere-de-oferta-fabrica-demo-abur.xlsx");
const EX2 = join(__dirname, "../exemple-AI/exemplu-2-cladire-rezidential/1-cerere-de-oferta-ansamblu-demo-bloc-c2.xlsx");
const importa = async (f: string) => proceseazaRegistru(await parseFoi(f), { stoc: stocInMemorie(), mapari: mapariStatice() });

describe("întrebările pentru client", () => {
  it("exemplul 2: exact cele cinci lipsuri de întrebat, pe rândurile lor", async () => {
    const q = intrebariClient((await importa(EX2)).linii);
    expect(q.map((x) => [x.foaie, x.rand, x.intrebare])).toEqual([
      ["Termice+Sanitare", 13, "Ce grosime are izolația?"],
      ["Termice+Sanitare", 25, "Din ce material e izolația (vată minerală, elastomer) și ce grosime are?"],
      ["Termice+Sanitare", 26, "Ce diametru are conducta?"],
      ["Ventilatie", 11, "Din ce e tabla de protecție: aluminiu sau inox?"],
      ["Treceri foc", 12, "Ce dimensiuni are golul (lățime × înălțime)?"],
    ]);
    // Ce ține de noi (peste listă, protecția la foc de pus de mână) nu e o întrebare pentru client.
    expect(q.some((x) => /DN250|EI120/.test(x.descriere))).toBe(false);
  });

  it("exemplul 1: și „buc” fără piesă e o întrebare", async () => {
    const q = intrebariClient((await importa(EX1)).linii);
    expect(q.length).toBe(10);
    expect(q.some((x) => x.intrebare.startsWith("Cantitatea e în bucăți"))).toBe(true);
  });

  it("textul de email: rândul, descrierea între ghilimele, întrebarea; foaia doar cu mai multe foi", async () => {
    const q = intrebariClient((await importa(EX2)).linii);
    const t = textEmailIntrebari(q, { despre: "Ansamblu DEMO", firma: "RADOIA ISOLIRUNG SRL", maiMulteFoi: true });
    expect(t).toContain("Pentru oferta la Ansamblu DEMO");
    expect(t).toContain("1. Rândul 13 (foaia Termice+Sanitare): „Izolare conducte PPR Ø40 cu Armaflex”\n   Ce grosime are izolația?");
    expect(t).toContain("nu sunt incluse în ofertă");
    expect(t.endsWith("RADOIA ISOLIRUNG SRL")).toBe(true);
    expect(textEmailIntrebari(q.slice(0, 1), { despre: "X" })).not.toContain("foaia");
  });

  it("Excelul: aceleași rânduri și o coloană goală de răspuns", async () => {
    const q = intrebariClient((await importa(EX2)).linii);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await excelIntrebari(q, { despre: "X", maiMulteFoi: true }));
    const ws = wb.worksheets[0]!;
    expect(ws.getRow(3).values).toEqual([undefined, "Foaia", "Rândul din lista dvs.", "Descrierea", "Întrebarea", "Răspunsul"]);
    expect(ws.rowCount).toBe(3 + q.length);
    expect(ws.getCell("B4").value).toBe(13);
  });

  it("propoziția și cardul: textul clientului nu poate injecta HTML", () => {
    expect([1, 5, 20].map(propozitieIntrebari)).toEqual([
      "Un lucru de întrebat clientul.", "5 lucruri de întrebat clientul.", "20 de lucruri de întrebat clientul.",
    ]);
    const h = cardIntrebari([{ index: 1, foaie: "F", rand: 2, descriere: "<script>x</script>", intrebare: "Ce grosime are izolația?" }], true, { despre: "<b>" });
    expect(h).not.toContain("<script>");
    expect(h).toContain("&lt;script&gt;");
    expect(cardIntrebari([], true, { despre: "X" })).toBe("");
  });
});

describe("„Urmează” cu întrebări", () => {
  const baza = { areCerere: true } as const;
  it("tot ce a rămas e de întrebat: așteaptă clientul, cu drum la ofertă; pe Acasă la „Așteaptă răspunsul clientului”", () => {
    const u = urmeaza({ ...baza, deVerificat: 5, intrebari: 5 });
    expect(u.text).toBe("Așteaptă răspunsul clientului la 5 întrebări.");
    expect([u.primar?.eticheta, u.alb?.eticheta]).toEqual(["Scrie întrebările", "Mergi la ofertă"]);
    const d = deFacutLucrare({ ...baza, deVerificat: 5, intrebari: 5 }, "2026-11-26T00:00:00Z");
    expect([d?.grup, d?.buton]).toEqual(["raspuns", "Vezi întrebările"]);
  });
  it("și altceva de verificat: verifici întâi, cu numărul întrebărilor spus", () => {
    expect(urmeaza({ ...baza, deVerificat: 7, intrebari: 1 }).text).toBe("7 poziții cer să te uiți (una e o întrebare pentru client).");
    expect(urmeaza({ ...baza, deVerificat: 7 }).text).toBe("7 poziții cer să te uiți.");
    expect(deFacutLucrare({ ...baza, deVerificat: 7, intrebari: 2 }, "2026-11-26T00:00:00Z")?.grup).toBe("birou");
  });
});
