/**
 * Randuri de continuare ("Same - Ø125 mm"), care mostenesc descrierea
 * pozitiei de deasupra.
 *
 * Nu citim fisiere din `../attachments/` aici — nu sunt in repo, iar suita
 * trebuie sa treaca in CI fara ele. Liniile se construiesc direct, ca in
 * `sabloane.test.ts` si in blocul "antetul de sectiune" din
 * `goluri-foc.test.ts`.
 */
import { describe, it, expect } from "vitest";
import { esteContinuare, aplicaContinuare } from "../src/import/continuare.js";
import { extrageDeterminist } from "../src/import/extract-regex.js";
import type { LinieCuSectiune } from "../src/import/sectiuni.js";

/** Helper de fixtura, in stilul `rand()` din goluri-foc.test.ts. */
const linie = (p: {
  index: number; foaie: string; rand: number; text: string;
  um?: string; cantitate?: number; sectiune?: string; celule?: (string | number | null)[];
}): LinieCuSectiune => ({
  index: p.index, foaie: p.foaie, rand: p.rand, text: p.text,
  celule: p.celule ?? [p.text],
  ...(p.um !== undefined ? { um: p.um } : {}),
  ...(p.cantitate !== undefined ? { cantitate: p.cantitate } : {}),
  ...(p.sectiune !== undefined ? { sectiune: p.sectiune } : {}),
});

/** O celula de antet de sectiune, fizic: text repetat, fara UM si fara cantitate. */
const antet = (index: number, foaie: string, rand: number, text: string): LinieCuSectiune =>
  linie({ index, foaie, rand, text, celule: [text, text] });

describe("esteContinuare", () => {
  it("recunoaste 'Same' dupa coloana de cod, nu doar la inceputul absolut al textului", () => {
    // Forma reala din Book15.xlsx: `LinieBruta.text` e mai multe celule
    // alaturate cu " | " (parse-workbook.ts), iar coloana de cod ("E3.1.1.2")
    // vine INAINTEA descrierii. O ancorare stricta la text[0] n-ar prinde
    // niciodata marcajul.
    expect(esteContinuare("E3.1.1.2 | Same - Ø125 mm | Same - Ø125 mm")).toBe(true);
  });

  it("nu recunoaste 'idem' la finalul liniei, cand nu e semnal de continuare", () => {
    // Radoia.xlsx: "Dn 20 (3/4'') | CIRCUIT RACIRE / idem" — randul are deja
    // descrierea completa (elastomer, Dn), "idem" se refera la circuit, nu
    // la lipsa descrierii. Ancorarea la inceputul unei celule exclude cazul.
    expect(esteContinuare("Dn 20 (3/4'') | CIRCUIT RACIRE / idem")).toBe(false);
  });

  it("nu recunoaste 'același' cand randul are descriere proprie completa", () => {
    // Book15.xlsx are randuri unde coloana romana rezuma cu "Același difuzor
    // – 600 x 600 mm" langa un text englezesc complet, cu toate
    // specificatiile — nu e o continuare, deci "același" nu e in lista de
    // marcaje (vezi comentariul din continuare.ts).
    expect(esteContinuare("Swirl type supply diffuzer... | Același difuzor – 600 x 600 mm")).toBe(false);
  });
});

describe("aplicaContinuare", () => {
  it("cazul 1: 'Same - Ø125 mm' mosteneste sistemul si iese cu diametrul PROPRIU, nu al parintelui", () => {
    // Parintele are si el un diametru (Ø100 mm) — exact ca in Book15.xlsx,
    // rand 13. Daca ordinea de concatenare ar fi gresita, extrageDeterminist
    // ar lua Ø100 (primul O/DN/Di gasit de `.match()` fara flag `g`) in loc
    // de Ø125, care e valoarea REALA a acestei pozitii (74 ml, nu 6 ml).
    const parinte = linie({
      index: 0, foaie: "F", rand: 1,
      text: "Izolatie cu vata minerala, grosime 30 mm, Ø100 mm",
      um: "lm", cantitate: 6,
    });
    const copil = linie({
      index: 1, foaie: "F", rand: 2,
      text: "Same - Ø125 mm",
      um: "lm", cantitate: 74,
    });

    const rezultat = aplicaContinuare([parinte, copil]);
    const propriu = rezultat[1]!;
    expect(propriu.text).not.toBe(copil.text); // s-a schimbat: a mostenit ceva
    expect(propriu.text).toContain("Ø125 mm"); // numarul propriu ramane citibil

    const extras = extrageDeterminist(propriu.index, propriu.text, propriu.um, propriu.sectiune, propriu.cantitate);
    expect(extras.linie.sistem).toBe("vata_minerala");
    expect(extras.linie.diametru_valoare).toBe(125);
    expect(extras.linie.diametru_tip).toBe("exterior");
  });

  it("cazul 2: doua continuari la rand mostenesc AMANDOUA de la acelasi parinte, nu una de la alta", () => {
    const parinte = linie({
      index: 0, foaie: "F", rand: 1,
      text: "Izolatie cu vata minerala, Ø100 mm", um: "lm", cantitate: 6,
    });
    const c1 = linie({ index: 1, foaie: "F", rand: 2, text: "Same - Ø125 mm", um: "lm", cantitate: 74 });
    const c2 = linie({ index: 2, foaie: "F", rand: 3, text: "Same - Ø160 mm", um: "lm", cantitate: 88 });

    const [, r1, r2] = aplicaContinuare([parinte, c1, c2]);

    // Amandoua citesc descrierea parintelui...
    expect(r1!.text).toContain("vata minerala");
    expect(r2!.text).toContain("vata minerala");
    // ...dar a doua NU a mostenit de la prima (nu contine Ø125 al ei).
    expect(r2!.text).not.toContain("Ø125");

    const e1 = extrageDeterminist(r1!.index, r1!.text, r1!.um, r1!.sectiune, r1!.cantitate);
    const e2 = extrageDeterminist(r2!.index, r2!.text, r2!.um, r2!.sectiune, r2!.cantitate);
    expect(e1.linie.diametru_valoare).toBe(125);
    expect(e2.linie.diametru_valoare).toBe(160);
  });

  it("cazul 3a: continuarea nu trece peste granita de foaie", () => {
    const parinte = linie({
      index: 0, foaie: "Foaie A", rand: 1,
      text: "Izolatie cu vata minerala, Ø100 mm", um: "lm", cantitate: 6,
    });
    const peAltaFoaie = linie({
      index: 1, foaie: "Foaie B", rand: 1, text: "Same - Ø125 mm", um: "lm", cantitate: 74,
    });

    const rezultat = aplicaContinuare([parinte, peAltaFoaie]);
    // Neschimbat: nu exista parinte pe foaia noua.
    expect(rezultat[1]!.text).toBe(peAltaFoaie.text);
  });

  it("cazul 3b: continuarea nu trece peste un antet de sectiune", () => {
    const parinte = linie({
      index: 0, foaie: "F", rand: 1,
      text: "Izolatie cu vata minerala, Ø100 mm", um: "lm", cantitate: 6,
    });
    // Fizic antet: text repetat pe mai multe celule, fara UM si fara cantitate.
    const capSectiune = antet(1, "F", 2, "Alta sectiune de lucrari");
    const dupaAntet = linie({
      index: 2, foaie: "F", rand: 3, text: "Same - Ø125 mm", um: "lm", cantitate: 74,
    });

    const rezultat = aplicaContinuare([parinte, capSectiune, dupaAntet]);
    expect(rezultat[1]).toBe(capSectiune); // antetul iese neatins
    // Neschimbat: parintele e inainte de antet, deci nu se mai mosteneste.
    expect(rezultat[2]!.text).toBe(dupaAntet.text);
  });

  it("cazul 4: un rand cu sistem deja in text nu e atins", () => {
    const parinte = linie({
      index: 0, foaie: "F", rand: 1,
      text: "Izolatie cu vata minerala, Ø100 mm", um: "lm", cantitate: 6,
    });
    // Incepe cu "Same", dar spune deja "elastomer" — l-ar dubla degeaba.
    const cuSistemPropriu = linie({
      index: 1, foaie: "F", rand: 2, text: "Same - elastomer Ø125 mm", um: "lm", cantitate: 30,
    });

    const rezultat = aplicaContinuare([parinte, cuSistemPropriu]);
    expect(rezultat[1]!.text).toBe(cuSistemPropriu.text);
  });

  it("cazul 5: un rand de total sau o nota (fara UM si fara cantitate) nu mosteneste nimic", () => {
    const parinte = linie({
      index: 0, foaie: "F", rand: 1,
      text: "Izolatie cu vata minerala, Ø100 mm", um: "lm", cantitate: 6,
    });
    // Text de continuare, dar fara masura: nu e o pozitie (la fel ca
    // `faraMasura` din extract-regex.ts).
    const nota = linie({ index: 1, foaie: "F", rand: 2, text: "Same - Ø125 mm" });

    const rezultat = aplicaContinuare([parinte, nota]);
    expect(rezultat[1]!.text).toBe(nota.text);
  });
});
