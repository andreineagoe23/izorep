/**
 * Etapa 5 (`docs/plan-dupa-demo.md`, N9–N10): oferta în fișierul clientului.
 * Pe fiecare fișier de client și pe cele două exemple: fișierul se redeschide,
 * celulele clientului ies identice (XML-ul lor, nu doar valoarea), fișierele
 * din arhivă pe care nu le atingem ies octet cu octet, iar prețurile și
 * totalul sunt ale ofertei noastre.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { CLIENTI, areClienti, cuClienti } from "./conditii.js";
import { parseFoi } from "../src/import/parse-workbook.js";
import { proceseazaRegistru } from "../src/import/nucleu.js";
import { mapariStatice } from "../src/import/mapari-statice.js";
import { stocInMemorie } from "../src/import/memorie.js";
import { imparte, totalOferta, valoareLinie } from "../web/oferta.js";
import { FisierNeXlsx, indexColoana, literaColoana, ofertaInFisierulClientului } from "../web/oferta-client.js";

const EXEMPLE = [
  join(__dirname, "../exemple-AI/exemplu-1-abur-industrial/1-cerere-de-oferta-fabrica-demo-abur.xlsx"),
  join(__dirname, "../exemple-AI/exemplu-2-cladire-rezidential/1-cerere-de-oferta-ansamblu-demo-bloc-c2.xlsx"),
];
const fisiereClienti = (): string[] => (areClienti
  ? readdirSync(CLIENTI).filter((f) => f.endsWith(".xlsx") && !f.startsWith("~$")).map((f) => join(CLIENTI, f))
  : []);

async function oferta(cale: string, destinatie: "rezidential" | "industrial" = "rezidential", discountProcent = 0) {
  const foi = await parseFoi(cale);
  const rez = await proceseazaRegistru(foi, { stoc: stocInMemorie(), mapari: mapariStatice(), destinatie });
  const linii = imparte(rez.linii).oferta;
  const randAntet = new Map(rez.foi.flatMap((f) => (f.antet ? [[f.nume, f.antet.rand] as const] : [])));
  const ultimulRand = new Map<string, number>();
  for (const l of rez.linii) if (l.extras.sistem !== null) ultimulRand.set(l.bruta.foaie, Math.max(ultimulRand.get(l.bruta.foaie) ?? 0, l.bruta.rand));
  const buf = readFileSync(cale);
  const original = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const r = await ofertaInFisierulClientului(original, { oferta: linii, destinatie, discountProcent, randAntet, ultimulRand });
  return { linii, original, r };
}

const celuleCuContinut = (xml: string): string[] =>
  [...xml.matchAll(/<c\b[^>]*?(?:\/>|>[\s\S]*?<\/c>)/g)].map((m) => m[0]);

async function verifica(cale: string): Promise<void> {
  const { linii, original, r } = await oferta(cale);
  const z0 = await JSZip.loadAsync(original);
  const z1 = await JSZip.loadAsync(r.fisier);
  const atinse = new Set<string>(["xl/styles.xml"]);
  const wb = await z0.file("xl/workbook.xml")!.async("string");
  const rels = await z0.file("xl/_rels/workbook.xml.rels")!.async("string");
  for (const f of r.foi) {
    const id = new RegExp(`<sheet\\b[^>]*name="${f.nume.replace(/&/g, "&amp;").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^>]*r:id="([^"]+)"`).exec(wb)?.[1];
    const tinta = new RegExp(`Id="${id}"[^>]*Target="([^"]+)"`).exec(rels)?.[1] ?? new RegExp(`Target="([^"]+)"[^>]*Id="${id}"`).exec(rels)?.[1];
    atinse.add(tinta!.startsWith("/") ? tinta!.slice(1) : `xl/${tinta}`);
  }
  // Ce nu atingem: octet cu octet.
  for (const nume of Object.keys(z0.files)) {
    if (atinse.has(nume) || z0.files[nume]!.dir) continue;
    const a = await z0.file(nume)!.async("uint8array");
    const b = await z1.file(nume)!.async("uint8array");
    expect(Buffer.from(b).equals(Buffer.from(a)), `${cale}: ${nume}`).toBe(true);
  }
  // Pe foile atinse: fiecare celulă a clientului cu conținut e acolo, neschimbată.
  for (const nume of atinse) {
    if (nume === "xl/styles.xml") continue;
    const inainte = celuleCuContinut(await z0.file(nume)!.async("string")).filter((c) => /<(?:v|is|f)\b/.test(c));
    const dupa = new Set(celuleCuContinut(await z1.file(nume)!.async("string")));
    for (const c of inainte) expect(dupa.has(c), `${cale}: ${nume} ${c.slice(0, 60)}`).toBe(true);
  }
  // Se redeschide, iar prețurile sunt pe rândurile lor.
  const wb1 = new ExcelJS.Workbook();
  await wb1.xlsx.load(r.fisier);
  for (const l of linii) {
    const f = r.foi.find((x) => x.nume === l.bruta.foaie)!;
    const ws = wb1.getWorksheet(l.bruta.foaie)!;
    expect(ws.getCell(`${f.coloane[0]}${l.bruta.rand}`).value).toBe(l.pret!.pret_unitar);
    expect(ws.getCell(`${f.coloane[1]}${l.bruta.rand}`).value).toBe(valoareLinie(l));
  }
  expect(r.totalGeneral).toBe(totalOferta(linii));
}

describe("oferta în fișierul clientului", () => {
  it("literele coloanelor, dus-întors", () => {
    expect([1, 26, 27, 52, 703].map(literaColoana)).toEqual(["A", "Z", "AA", "AZ", "AAA"]);
    expect(["A", "Z", "AA", "AZ", "AAA"].map(indexColoana)).toEqual([1, 26, 27, 52, 703]);
  });

  it.each(EXEMPLE)("exemplul lui Adrian: %s", async (cale) => { await verifica(cale); });

  cuClienti("toate fișierele clienților", async () => {
    const fisiere = fisiereClienti();
    expect(fisiere.length).toBeGreaterThan(8);
    for (const f of fisiere) await verifica(f);
  });

  cuClienti("TRANSAVIA: totalul de sub ultima poziție e totalul ofertei; cu discount, și totalul general", async () => {
    const cale = join(CLIENTI, "cerere-de-oferta-transavia-abur.xlsx");
    const { linii, r } = await oferta(cale, "rezidential", 3);
    expect(r.foi).toHaveLength(1);
    const f = r.foi[0]!;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(r.fisier);
    const ws = wb.getWorksheet(f.nume)!;
    const ultim = Math.max(...linii.map((l) => l.bruta.rand));
    const val = (rand: number, col: string): unknown => ws.getCell(`${col}${rand}`).value;
    expect([val(ultim + 1, f.coloane[0]), val(ultim + 1, f.coloane[1])]).toEqual(["TOTAL", totalOferta(linii)]);
    expect(val(ultim + 2, f.coloane[0])).toBe("Discount 3 %");
    expect(val(ultim + 3, f.coloane[0])).toBe("TOTAL GENERAL");
    expect(val(ultim + 3, f.coloane[1])).toBe(r.totalGeneral);
    // Foaia n-are antet (pozițiile încep pe rândul 1): etichetele coloanelor stau sub totaluri.
    expect([val(ultim + 4, f.coloane[0]), val(ultim + 4, f.coloane[1])]).toEqual(["Preț unitar (€)", "Valoare (€)"]);
    // Distribuitorul e „De verificat”: fără „E bine”, nu intră, deci rândul lui rămâne fără preț.
    expect(linii).toHaveLength(98);
  });

  cuClienti("Matari: totalul stă sub ultima poziție a foii, nu printre golurile EI180 fără preț", async () => {
    const { linii, r } = await oferta(join(CLIENTI, "oferta-118-1-matari-goluri-foc.xlsx"));
    const f = r.foi[0]!;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(r.fisier);
    const ws = wb.getWorksheet(f.nume)!;
    expect(ws.getCell(`${f.coloane[0]}14`).value).toBe("Preț unitar (€)");
    expect([ws.getCell(`${f.coloane[0]}84`).value, ws.getCell(`${f.coloane[1]}84`).value]).toEqual(["TOTAL", totalOferta(linii)]);
  });

  it("un fișier care nu e .xlsx: spune că doar în formatul nostru", async () => {
    await expect(ofertaInFisierulClientului(new TextEncoder().encode("nu e zip").buffer, { oferta: [], destinatie: "rezidential" }))
      .rejects.toBeInstanceOf(FisierNeXlsx);
  });
});
