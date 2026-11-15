/**
 * Fila „Lăsate afară” (planul UX, Faza 6, punctul 3): rândurile cu UM și
 * cantitate care nu au devenit poziții, numărate pe fișierele clienților, și
 * „E izolație”, care le face poziții de verificat fără să miște restul.
 */
import { describe, expect } from "vitest";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { CLIENTI, cuClienti } from "./conditii.js";
import { parseFoi } from "../src/import/parse-workbook.js";
import { proceseazaRegistru, reevalueaza, type OptiuniNucleu } from "../src/import/nucleu.js";
import { mapariStatice } from "../src/import/mapari-statice.js";
import { stocInMemorie } from "../src/import/memorie.js";
import { faPozitie, lasateAfara } from "../src/import/lasate-afara.js";
import { confirma, potrivit } from "../web/validare.js";

const deschide = async (f: string) => {
  const o: OptiuniNucleu = { stoc: stocInMemorie(), mapari: mapariStatice() };
  return { o, rez: await proceseazaRegistru(await parseFoi(join(CLIENTI, f)), o) };
};

describe("rândurile lăsate afară", () => {
  cuClienti("se numără pe fiecare fișier al clienților", async () => {
    const numar: Record<string, number> = {};
    for (const f of readdirSync(CLIENTI).filter((x) => x.endsWith(".xlsx") && !x.startsWith("~$")).sort()) {
      numar[f] = lasateAfara((await deschide(f)).rez).length;
    }
    // Cifrele sunt în `.claude/import.md`. Cererile reproduse 1:1 față de
    // ofertele semnate nu lasă nimic afară.
    expect(numar).toEqual({
      "cerere-de-oferta-book15.xlsx": 257,
      "cerere-de-oferta-cet-constanta-motoare-termice.xlsx": 81,
      "cerere-de-oferta-flower-city.xlsx": 0,
      "cerere-de-oferta-spital.xlsx": 58,
      "cerere-de-oferta-sru-craiova-hvac.xlsx": 15,
      "cerere-de-oferta-transavia-abur.xlsx": 0,
      "cerere-de-oferta-transavia-inox.xlsx": 0,
      "oferta-118-1-matari-goluri-foc.xlsx": 0,
      "oferta-118-nisal.xlsx": 3,
      "oferta-284-transavia-abur.xlsx": 0,
      "oferta-manopera-anexa-contract-2024.xlsx": 0,
    });
  });

  cuClienti("NISAL: canalul de desfumare cu „Wärmedämm.” e printre ele; „E izolație” îl face poziție de verificat", async () => {
    const { o, rez } = await deschide("oferta-118-nisal.xlsx");
    const afara = lasateAfara(rez);
    const canal = afara.find((a) => /Entrauchungskanal/.test(a.text))!;
    expect(canal).toMatchObject({ um: "m²", cantitate: 17 });
    const inainte = new Map(rez.linii.filter((l) => l.pret).map((l) => [l.extras.index, l.pret!.pret_unitar]));
    rez.rezolvate.set(canal.index, faPozitie(rez, canal));
    reevalueaza(rez, o);
    const l = rez.linii.find((x) => x.extras.index === canal.index)!;
    expect(l.extras.sistem).not.toBeNull();
    expect(potrivit(l, "gata")).toBe(false);
    expect(lasateAfara(rez).map((a) => a.index)).not.toContain(canal.index);
    // Restul pozițiilor nu se mișcă.
    for (const x of rez.linii) if (inainte.has(x.extras.index)) expect(x.pret?.pret_unitar).toBe(inainte.get(x.extras.index));
    // A doua recalculare (o tastă oarecare) nu-l scoate înapoi.
    reevalueaza(rez, o);
    expect(rez.linii.find((x) => x.extras.index === canal.index)!.extras.sistem).not.toBeNull();
  });

  cuClienti("spital: rândul pus de om are preț și stă la „De verificat” până îl confirmă", async () => {
    const { o, rez } = await deschide("cerere-de-oferta-spital.xlsx");
    const a = lasateAfara(rez)[0]!;
    rez.rezolvate.set(a.index, faPozitie(rez, a));
    reevalueaza(rez, o);
    const l = rez.linii.find((x) => x.extras.index === a.index)!;
    expect(potrivit(l, "de_validat")).toBe(true);
    confirma([a.index], rez.rezolvate);
    reevalueaza(rez, o);
    expect(potrivit(rez.linii.find((x) => x.extras.index === a.index)!, "gata")).toBe(true);
  });

  cuClienti("Book15: un rând care vine izolat de la producător intră și el, dacă omul spune că e izolație", async () => {
    const { o, rez } = await deschide("cerere-de-oferta-book15.xlsx");
    const a = lasateAfara(rez).find((x) => x.motiv === "preizolat")!;
    rez.rezolvate.set(a.index, faPozitie(rez, a));
    reevalueaza(rez, o);
    expect(rez.linii.find((x) => x.extras.index === a.index)!.extras.sistem).not.toBeNull();
  });
});
