/**
 * „Încearcă din nou” doar pe rândurile necitite (planul UX, Faza 6, punctul 7):
 * un lot căzut la model nu mai cere reîncărcarea fișierului. Rândurile rămase
 * necitite nu sunt „Gata” și nu dispar; reîncercarea trimite doar rândurile
 * astea, de două ori, și păstrează tot restul (inclusiv corecturile omului).
 */
import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { parseFoiBuffer } from "../src/import/parse-workbook.js";
import {
  diferenteDinMotiv, proceseazaRegistru, recitesteNecitite, reevalueaza, type Extractor, type OptiuniNucleu,
} from "../src/import/nucleu.js";
import { stocInMemorie } from "../src/import/memorie.js";
import { lasateAfara } from "../src/import/lasate-afara.js";
import { potrivit } from "../web/validare.js";
import type { LinieExtrasa } from "../src/import/schema.js";

const extrasa = (p: Partial<LinieExtrasa>): LinieExtrasa => ({
  index: 0, sistem: "elastomer", diametru_valoare: 22, diametru_tip: "exterior", grosime_mm: 19,
  forma: "ml", gol_latime_mm: null, gol_inaltime_mm: null, straturi_extra: [], incredere: 0.97, motiv: "model", ...p,
});

/** Rânduri pe care regulile nu le citesc întregi: pleacă toate la model. */
const TEXTE = [
  // Regulile nu văd nimic aici (fără material cunoscut).
  "Spuma armacell perete 19 tub 22 rece",
  // Regulile văd materialul (kaiflex, armaflex, elastomer), dar nu diametrul: citire parțială.
  "Spuma kaiflex rece tub 28 perete 13",
  "Izolatie elastomer pe conducta de apa rece, executie speciala",
  "Spuma armaflex tub 35 perete 19 rece",
];

async function foi() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Lista");
  ws.addRow(["Nr. crt.", "Denumire articol", "UM", "Cantitate"]);
  TEXTE.forEach((t, i) => ws.addRow([i + 1, t, "ml", 10]));
  return parseFoiBuffer((await wb.xlsx.writeBuffer()) as ArrayBuffer);
}

/** Citirea „corectă” a unui rând din TEXTE: diametrul după „tub”, grosimea după „perete”. */
const citeste = (index: number, text: string): LinieExtrasa => extrasa({
  index, diametru_valoare: Number(/tub (\d+)/.exec(text)?.[1] ?? 42), grosime_mm: Number(/perete (\d+)/.exec(text)?.[1] ?? 19),
});

/** Model fals: rândurile al căror text conține unul din `cad` nu se întorc (lotul lor a căzut). */
function model(cad: string[], jurnal: { citire: number; texte: string[] }[] = [], cadeDoarA2a = false): Extractor {
  return async (linii, ctx) => {
    jurnal.push({ citire: ctx.citire ?? 0, texte: linii.map((l) => l.text) });
    return linii
      .filter((l) => !cad.some((c) => l.text.includes(c)) || (cadeDoarA2a && ctx.citire === 1))
      .map((l) => citeste(l.index, l.text));
  };
}

const idx = (rez: Awaited<ReturnType<typeof proceseazaRegistru>>, bucata: string): number =>
  rez.brute.find((b) => b.text.includes(bucata))!.index;

describe("rândurile necitite", () => {
  it("un lot căzut: rândurile lui rămân necitite, nu „Gata”, și nu dispar", async () => {
    const necitite = new Set<number>();
    const o: OptiuniNucleu = { stoc: stocInMemorie(), necitite, extrage: model(["armacell", "executie speciala"]) };
    const rez = await proceseazaRegistru(await foi(), o);
    expect([...necitite].sort()).toEqual([idx(rez, "armacell"), idx(rez, "executie speciala")].sort());
    expect(rez.statistici.modelFaraRaspuns).toBe(2);
    // Cu citire parțială (materialul): poziție „De verificat” / „Fără preț”, cu motivul.
    const partiala = rez.linii.find((l) => l.extras.index === idx(rez, "executie speciala"))!;
    expect(partiala.extras.sistem).toBe("elastomer");
    expect(potrivit(partiala, "gata")).toBe(false);
    expect(partiala.avertismente?.map((a) => a.cod)).toContain("necitit");
    // Fără nimic citit: la „Lăsate afară”, cu motivul.
    const afara = lasateAfara(rez, necitite);
    expect(afara.find((a) => a.index === idx(rez, "armacell"))?.motiv).toBe("necitit");
    // Restul e citit și „Gata”.
    const bun = rez.linii.find((l) => l.extras.index === idx(rez, "armaflex"))!;
    expect(potrivit(bun, "gata")).toBe(true);
  });

  it("„Încearcă din nou” trimite doar rândurile necitite, de două ori, și păstrează corectura omului", async () => {
    const necitite = new Set<number>();
    const o: OptiuniNucleu = { stoc: stocInMemorie(), necitite, extrage: model(["kaiflex", "armaflex", "executie speciala"]) };
    const rez = await proceseazaRegistru(await foi(), o);
    expect(necitite.size).toBe(3);

    // Omul corectează între timp un rând necitit și unul citit.
    const scris = idx(rez, "armaflex");
    const citit = idx(rez, "armacell");
    rez.rezolvate.set(scris, { extras: extrasa({ index: scris, diametru_valoare: 35, grosime_mm: 25 }), sursa: "om" });
    rez.rezolvate.set(citit, { extras: extrasa({ index: citit, diametru_valoare: 22, grosime_mm: 13 }), sursa: "om" });
    reevalueaza(rez, o);
    expect(necitite.has(scris)).toBe(false);
    expect(rez.statistici.modelFaraRaspuns).toBe(2);

    const jurnal: { citire: number; texte: string[] }[] = [];
    const r = await recitesteNecitite(rez, { ...o, extrage: model([], jurnal) });
    expect(r).toEqual({ trimise: 2, citite: 2 });
    expect(jurnal.map((j) => j.citire).sort()).toEqual([1, 2]);
    expect(jurnal.every((j) => j.texte.length === 2 && j.texte.every((t) => /kaiflex|executie speciala/.test(t)))).toBe(true);
    expect(necitite.size).toBe(0);
    expect(rez.statistici.modelFaraRaspuns).toBe(0);
    // Corecturile omului au rămas.
    expect(rez.rezolvate.get(scris)?.sursa).toBe("om");
    expect(rez.linii.find((l) => l.extras.index === citit)!.extras.grosime_mm).toBe(13);
    // Rândurile recitite sunt poziții, fără „necitit”.
    const kaiflex = rez.linii.find((l) => l.extras.index === idx(rez, "kaiflex"))!;
    expect(kaiflex.extras.diametru_valoare).toBe(28);
    expect(kaiflex.avertismente?.some((a) => a.cod === "necitit") ?? false).toBe(false);
  });

  it("o singură citire întoarsă nu ajunge: rândul rămâne necitit; la reîncercare, citit diferit merge la om", async () => {
    const necitite = new Set<number>();
    const o: OptiuniNucleu = { stoc: stocInMemorie(), necitite, extrage: model(["kaiflex"], [], true) };
    const rez = await proceseazaRegistru(await foi(), o);
    expect(necitite.has(idx(rez, "kaiflex"))).toBe(true);

    // A doua citire vede altă grosime.
    const diferit: Extractor = async (linii, ctx) => linii.map((l) => ({ ...citeste(l.index, l.text), ...(ctx.citire === 2 ? { grosime_mm: 19 } : {}) }));
    await recitesteNecitite(rez, { ...o, extrage: diferit });
    const l = rez.linii.find((x) => x.extras.index === idx(rez, "kaiflex"))!;
    expect(necitite.size).toBe(0);
    expect(l.avertismente?.map((a) => a.cod)).toContain("citit_diferit");
    expect(potrivit(l, "gata")).toBe(false);
    expect(diferenteDinMotiv(l.extras.motiv)).toEqual([{ camp: "grosime", prima: "13 mm", adoua: "19 mm" }]);
  });

  it("modelul care tot nu răspunde: rândul rămâne necitit", async () => {
    const necitite = new Set<number>();
    const o: OptiuniNucleu = { stoc: stocInMemorie(), necitite, extrage: model(["kaiflex"]) };
    const rez = await proceseazaRegistru(await foi(), o);
    const r = await recitesteNecitite(rez, o);
    expect(r).toEqual({ trimise: 1, citite: 0 });
    expect([...necitite]).toEqual([idx(rez, "kaiflex")]);
  });
});

describe("alerta de sus", async () => {
  const { alertaNecitite } = await import("../web/import/vizual.js");
  it("cu buton cât se poate citi; cu plafonul, mesajul lui (escapat); fără citire automată, de mână", () => {
    expect(alertaNecitite(0, { plafon: "", cuModel: true, inLucru: false })).toBe("");
    const cu = alertaNecitite(12, { plafon: "", cuModel: true, inLucru: false });
    expect(cu).toContain("12 rânduri n-au fost citite.");
    expect(cu).toContain('data-act="reincearca"');
    const plafon = alertaNecitite(3, { plafon: "Plafonul de azi <s-a atins>", cuModel: true, inLucru: false });
    expect(plafon).not.toContain("reincearca");
    expect(plafon).toContain("&lt;s-a atins&gt;");
    expect(alertaNecitite(1, { plafon: "", cuModel: false, inLucru: false })).toContain("Un rând n-a fost citit.");
  });
});
