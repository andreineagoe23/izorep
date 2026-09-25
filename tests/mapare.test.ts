/**
 * L1: maparea de coloane.
 *
 * Fixtura `fixtures-foaie-oferta.json` e foaia "Termice+Sanitare" din
 * `oferta-118-nisal.xlsx`, parsata, plus maparea inregistrata pentru layoutul
 * ei. Fisierele clientilor nu sunt in repo, deci testul isi cara foaia cu el —
 * altfel s-ar sari in CI, iar o suita sarita arata exact ca una care trece.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  aplicaMapare, valideazaMapare, laColoana, amprentaAntet,
  type MapareFoaie,
} from "../src/import/mapare.js";
import type { FoaieBruta } from "../src/import/parse-workbook.js";

const fixtura = (): { foaie: FoaieBruta; mapare: MapareFoaie } =>
  JSON.parse(readFileSync(new URL("./fixtures-foaie-oferta.json", import.meta.url), "utf8")) as
    { foaie: FoaieBruta; mapare: MapareFoaie };

const oferta = JSON.parse(
  readFileSync(new URL("./fixtures-oferta-118.json", import.meta.url), "utf8"),
) as { cod: string; cant: number; pu: number }[];

const RE_COD = /\b\d{2}\.\d{2}\.\d{2}\.\d{2}[A-Z]?\b/;

/** O foaie minima, scrisa de mana, pentru cazurile care nu au nevoie de fixtura. */
const MAPARE_SINTETICA: MapareFoaie = {
  rand_antet: 0, rand_start: 1,
  roluri: ["nr", "denumire", "dimensiune", "um", "cantitate", "observatii"],
  motiv: "test",
};

const foaieSintetica = (): FoaieBruta => ({
  nume: "Test",
  coloane: 6,
  randuri: [
    { rand: 1, celule: ["Nr", "Denumire", "Dimensiune", "UM", "Cantitate", "Obs"].map((v) => ({ v, span: 1 })) },
    {
      rand: 2,
      celule: [1, "Izolatie elastomer DN25", null, "ml", null, null].map((v) => ({ v, span: 1 })),
      linie: {
        index: 0, foaie: "Test", rand: 2,
        text: "Izolatie elastomer DN25", celule: [], um: "ml",
      },
    },
    {
      rand: 3,
      celule: [2, "Teava OL/OLZN DN15", "130/130", "buc", 6, "Rockwool"].map((v) => ({ v, span: 1 })),
      linie: { index: 1, foaie: "Test", rand: 3, text: "vechi", celule: [] },
    },
  ],
});

describe("cantitatea vine din coloana mapata, nu din euristica", () => {
  it("reproduce cantitatile din oferta semnata, linie cu linie", () => {
    // Inainte de L1, euristica "primul numar lipit de unitatea de masura" citea
    // PRETUL UNITAR ca fiind cantitatea: 5,99 in loc de 187. Toate cele 56 de
    // linii regasite in oferta semnata erau gresite, si nimic nu semnala asta,
    // pentru ca 5,99 e o cantitate perfect plauzibila.
    const { foaie, mapare } = fixtura();
    const asteptat = new Map(oferta.map((o) => [o.cod, o.cant]));

    // Codul de articol sta in coloana "nr", care dupa mapare nu mai intra in
    // textul liniei: se citeste din celule, nu din text.
    const cod = new Map<number, string>();
    for (const r of foaie.randuri) {
      if (!r.linie) continue;
      const m = RE_COD.exec(r.linie.text);
      if (m) cod.set(r.linie.index, m[0]);
    }

    aplicaMapare(foaie, mapare);

    let verificate = 0;
    for (const r of foaie.randuri) {
      const c = r.linie ? cod.get(r.linie.index) : undefined;
      const cant = c === undefined ? undefined : asteptat.get(c);
      if (cant === undefined) continue;
      verificate++;
      expect(r.linie!.cantitate, `pozitia ${c}`).toBeCloseTo(cant, 2);
    }
    // 47, nu 56: fixtura e o singura foaie din registru, cea principala.
    expect(verificate).toBe(47);
  });

  it("sterge cantitatea ghicita cand coloana mapata e goala pe rand", () => {
    // Mai bine fara cantitate decat cu una luata din alta coloana: prima se
    // vede in raport ca pozitie de completat, a doua ajunge in oferta.
    const foaie = foaieSintetica();
    foaie.randuri[1]!.linie!.cantitate = 5.99;   // ce ghicise euristica
    aplicaMapare(foaie, MAPARE_SINTETICA);
    expect(foaie.randuri[1]!.linie!.cantitate).toBeUndefined();
  });

  it("compune textul din denumire, dimensiune si observatii", () => {
    // Nu doar din denumire: dimensiunea golului si materialul din observatii
    // sunt singurele locuri in care apar, pe fisiere reale.
    const foaie = foaieSintetica();
    aplicaMapare(foaie, MAPARE_SINTETICA);
    expect(foaie.randuri[2]!.linie!.text).toBe("Teava OL/OLZN DN15 | 130/130 | Rockwool");
    expect(foaie.randuri[2]!.linie!.cantitate).toBe(6);
    expect(foaie.randuri[2]!.linie!.um).toBe("buc");
  });
});

describe("validarea maparii", () => {
  it("accepta maparea inregistrata pentru foaia reala", () => {
    const { foaie, mapare } = fixtura();
    expect(valideazaMapare(foaie, mapare)).toEqual([]);
  });

  it("respinge o coloana de text marcata drept cantitate", () => {
    const { foaie, mapare } = fixtura();
    const iDenumire = mapare.roluri.indexOf("denumire");
    const stricata: MapareFoaie = {
      ...mapare,
      roluri: mapare.roluri.map((r, i) => (i === iDenumire ? "cantitate" : r === "cantitate" ? "ignora" : r)),
    };
    const av = valideazaMapare(foaie, stricata);
    expect(av.some((a) => a.rol === "cantitate")).toBe(true);
  });

  it("respinge acelasi rol dat pe doua coloane", () => {
    const { foaie, mapare } = fixtura();
    const roluri = [...mapare.roluri];
    roluri[roluri.indexOf("observatii")] = "denumire";
    const av = valideazaMapare(foaie, { ...mapare, roluri });
    expect(av.some((a) => a.mesaj.includes('rolul "denumire"'))).toBe(true);
  });

  it("respinge maparea care nu lasa niciun rand de date", () => {
    const { foaie, mapare } = fixtura();
    const av = valideazaMapare(foaie, { ...mapare, rand_start: foaie.randuri.length });
    expect(av.some((a) => a.mesaj.includes("niciun rand de date"))).toBe(true);
  });

  it("nu se plange de coloane de pret goale", () => {
    // O lista de cantitati de la client are coloanele de pret goale: pretul e
    // ce urmeaza sa punem noi. Prima varianta a validarii respingea din cauza
    // asta maparea corecta a lui Flower City, desi restul ei era bun.
    const foaie = foaieSintetica();
    const av = valideazaMapare(foaie, {
      ...MAPARE_SINTETICA,
      roluri: [...MAPARE_SINTETICA.roluri, "pret_unitar", "pret_total"],
    });
    expect(av).toEqual([]);
  });
});

describe("coloane si amprenta", () => {
  it("laColoana tine cont de imbinari, nu de indexul din vector", () => {
    const celule = [{ v: "a", span: 1 }, { v: "titlu", span: 3 }, { v: "b", span: 1 }];
    expect(laColoana(celule, 0)).toBe("a");
    expect(laColoana(celule, 1)).toBe("titlu");
    expect(laColoana(celule, 3)).toBe("titlu");
    expect(laColoana(celule, 4)).toBe("b");
    expect(laColoana(celule, 9)).toBeNull();
  });

  it("amprenta e stabila pentru acelasi antet si diferita pentru altul", () => {
    const { foaie, mapare } = fixtura();
    const a = amprentaAntet(foaie, mapare.rand_antet);
    expect(amprentaAntet(foaie, mapare.rand_antet)).toBe(a);
    expect(amprentaAntet(foaie, null)).not.toBe(a);
  });
});
