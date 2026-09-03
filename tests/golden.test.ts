/**
 * Rejucarea golden files: partea DETERMINISTA, peste iesirea reala a modelului.
 *
 * Nu cheama niciun API si nu are nevoie de cheie — ruleaza in CI. Ce verifica:
 * validarea de plauzibilitate si motorul de preturi dau, pe raspunsuri reale
 * ale modelului la linii reale de client, exact ce dadeau cand s-a inregistrat
 * fisierul.
 *
 * Ce prinde: o schimbare de-a NOASTRA care muta preturile pe linii adevarate —
 * o regula noua in validator, o valoare schimbata in tabelul DN, o atingere a
 * motorului. Suita din `pricing.test.ts` acopera pozitiile din ofertele
 * semnate; asta acopera drumul complet, cu tot cu ce intelege modelul din text.
 *
 * Ce NU prinde: deriva modelului. Aia cere reapelarea lui, deci retea si
 * tokeni: `npm run golden -- --verifica`.
 *
 * Fara niciun golden file inregistrat, suita trece si spune de ce.
 */
import { describe, it, expect } from "vitest";
import { citesteGolden, goldenuri } from "../scripts/golden-store.js";
import { tarifeazaExtras } from "../src/import/pipeline.js";
import { valideazaExtragere } from "../src/import/valideaza.js";

const fisiere = goldenuri();

describe.runIf(fisiere.length > 0)("golden files", () => {
  for (const nume of fisiere) {
    const g = citesteGolden(nume);

    describe(`${g.fisier} (${g.model})`, () => {
      it("validarea de plauzibilitate da aceleasi avertismente", () => {
        const acum = g.linii.map((l) => ({
          index: l.index,
          coduri: valideazaExtragere(l.extras, { text: l.text, ...(l.um ? { um: l.um } : {}) })
            .map((a) => a.cod),
        }));
        expect(acum).toEqual(g.linii.map((l) => ({ index: l.index, coduri: l.avertismente })));
      });

      it("tarifarea da aceleasi preturi", () => {
        // Se compara si erorile: o pozitie care ieri era marcata "netarifata" si
        // azi primeste pret in tacere e exact felul de schimbare pe care nu o
        // vede nimeni la timp.
        const acum = g.linii.map((l) => {
          const t = tarifeazaExtras(l.extras, l.cantitate ?? 1);
          return {
            index: l.index,
            pret_unitar: t.pret?.pret_unitar ?? null,
            total: t.pret?.total ?? null,
            eroare: t.eroare ?? null,
          };
        });
        expect(acum).toEqual(g.linii.map((l) => ({
          index: l.index, pret_unitar: l.pret_unitar, total: l.total, eroare: l.eroare,
        })));
      });
    });
  }
});

/**
 * Testul asta ruleaza INTOTDEAUNA, si cu zero golden files inregistrate.
 *
 * Nu e cosmetic: CI pica daca vreo suita se sare (`it.skipIf`), fiindca o
 * suita sarita arata exact ca una care trece si asa s-ar putea ascunde o baza
 * care n-a pornit. Cu fisierele de client lipsa — un dezvoltator nou nu are
 * `../attachments/` — suitele de mai sus n-au ce rula, deci verificarea de
 * forma ramane singura, si trebuie sa treaca fara sa sara.
 */
it("golden files inregistrate au forma asteptata", () => {
  for (const nume of fisiere) {
    const g = citesteGolden(nume);
    expect(g.model, `${nume}: model`).toBeTruthy();
    expect(g.linii.length, `${nume}: linii`).toBeGreaterThan(0);
    for (const l of g.linii) {
      expect(l.extras.index, `${nume}: index`).toBe(l.index);
    }
  }
});
