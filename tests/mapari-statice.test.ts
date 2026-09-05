/**
 * `mapariStatice()` fata de sursa ei de adevar, `citesteMapari()`.
 *
 * `data/mapari/index.json` e generat, nu scris de mana: testul asta e
 * bariera de sincronizare. Fara el, cineva ruleaza `npm run mapare -- <fisier>`
 * (care il regenereaza singur) sau editeaza directorul manual fara
 * `--reindex`, indexul ramane in urma tacut, iar ecranul de import din
 * browser — care citeste DOAR indexul — ar tarifa pe o mapare veche, fara
 * niciun semnal.
 */
import { describe, it, expect } from "vitest";
import { citesteMapari } from "../src/import/cache-mapari.js";
import { mapariStatice } from "../src/import/mapari-statice.js";
import { MapareFoaie } from "../src/import/mapare.js";

describe("mapariStatice() e sincronizat cu directorul de pe disc", () => {
  it("aceleasi amprente si aceleasi mapari ca citesteMapari()", () => {
    // Comparatie intre cele doua surse, nu cu o cifra scrisa de mana: testul
    // trebuie sa treaca si maine, cand cineva adauga a noua mapare cu
    // `npm run mapare -- <fisier>` — regenerarea automata a indexului tine
    // testul verde, o desincronizare tacuta il pica.
    const dePeDisc = citesteMapari();
    const dinIndex = mapariStatice();

    expect(new Set(dinIndex.keys())).toEqual(new Set(dePeDisc.keys()));

    for (const [amprenta, salvataDisc] of dePeDisc) {
      expect(dinIndex.get(amprenta)).toEqual(salvataDisc);
    }
  });

  it("fiecare mapare din index trece de MapareFoaie.parse", () => {
    // mapariStatice() nu arunca daca formatul e valid, si intoarce macar
    // atatea mapari cate sunt pe disc azi (8, la data scrierii testului) —
    // pragul e ">=" ca sa nu se strice cand se mai adauga mapari.
    const mapari = mapariStatice();
    expect(mapari.size).toBeGreaterThanOrEqual(8);
    for (const m of mapari.values()) {
      expect(() => MapareFoaie.parse(m.mapare)).not.toThrow();
    }
  });
});

describe("citesteMapari() ignora index.json", () => {
  it("numarul de mapari citite de pe disc ramane cel al fisierelor de mapare, nu +1", () => {
    // index.json sta in acelasi director si se termina tot in ".json" — daca
    // citesteMapari() l-ar confunda cu o mapare, ar incerca sa parseze
    // { generat, mapari: [...] } cu schema MapareFoaie si ar crapa, sau —
    // si mai rau — l-ar adauga tacut ca o mapare in plus, cu amprenta
    // "undefined".
    const dePeDisc = citesteMapari();
    expect(dePeDisc.has("undefined")).toBe(false);
    expect(dePeDisc.size).toBe(mapariStatice().size);
  });
});
