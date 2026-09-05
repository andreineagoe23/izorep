import type { LinieProcesata } from "../src/import/nucleu.js";
import type { LinieExtrasa, Sursa } from "../src/import/schema.js";

/**
 * Logica a fluxului de validare din ecranul de import, separata de DOM.
 *
 * De ce nu sta in `import.ts`: exact motivul pentru care `invataDinCorectie`
 * sta in `memorie.ts` si nu intr-un handler de `change` — cod care decide CE
 * se confirma si CE se poate anula e riscant fara teste, iar un handler de
 * eveniment nu se testeaza direct. Ecranul ramane cu apeluri simple:
 * `potrivit` pentru filtrare, `confirma`/`anuleaza` pentru actiunea in masa.
 */

/**
 * Cele trei filtre ale gutter-ului de validare.
 *
 * `toate` e implicit la fiecare fisier nou incarcat — filtrul nu e o
 * preferinta persistenta, e o lentila temporara peste fisierul curent.
 */
export type Filtru = "toate" | "de_validat" | "netarifate";

/**
 * Daca linia intra in filtrul dat.
 *
 * `netarifate` cere explicit `sistem !== null`: o linie care nu e pozitie de
 * izolatie (antet, total, nota) nu are pret nici n-o sa aiba, deci n-are ce
 * cauta la "netarifate" — n-ar fi o problema de rezolvat, ar fi zgomot.
 * `de_validat` citeste direct `necesitaValidare`, calculat deja in nucleu
 * (incredere sub prag, avertisment, sau eroare de tarifare pe o linie care nu
 * vine de la om) — filtrul nu recalculeaza nimic, doar selecteaza.
 */
export function potrivit(l: LinieProcesata, f: Filtru): boolean {
  switch (f) {
    case "toate": return true;
    case "de_validat": return l.necesitaValidare;
    case "netarifate": return l.extras.sistem !== null && !l.pret;
  }
}

/** O intrare de dinainte de confirmare, cat sa poata fi pusa inapoi. */
export interface Instantaneu {
  intrari: { index: number; extras: LinieExtrasa; sursa: Sursa }[];
}

/**
 * Confirma liniile date: le pune `sursa: "om"` in `rezolvate` si intoarce
 * instantaneul de dinainte, ca sa poata fi anulat.
 *
 * NU invata sabloane. `invataDinCorectie` intra in memoria care rezolva
 * importurile viitoare; o confirmare in masa spune doar "am vazut si e bine",
 * nu "asta e tiparul corect". Daca ar invata, un click pe 40 de linii ar
 * propaga tacut 40 de tipare peste toate proiectele urmatoare — exact ce
 * interzice `memorie.ts` (se invata DOAR din corectia umana explicita, linie
 * cu linie, niciodata dintr-o bifare in masa).
 *
 * Nu atinge liniile deja `sursa: "om"`: n-au ce sa confirme a doua oara, si
 * nu intra in instantaneu — altfel anularea le-ar pune inapoi pe sursa lor
 * VECHE (model/sablon/memorie), stricand o confirmare mai veche pe care omul
 * n-a cerut s-o anuleze acum.
 */
export function confirma(
  indecsi: number[],
  rezolvate: Map<number, { extras: LinieExtrasa; sursa: Sursa }>,
): Instantaneu {
  const intrari: Instantaneu["intrari"] = [];
  for (const index of indecsi) {
    const r = rezolvate.get(index);
    if (!r || r.sursa === "om") continue;
    intrari.push({ index, extras: r.extras, sursa: r.sursa });
    rezolvate.set(index, { extras: r.extras, sursa: "om" });
  }
  return { intrari };
}

/**
 * Pune inapoi ce era inainte de `confirma`.
 *
 * Un singur nivel de anulare e responsabilitatea apelantului (tine un singur
 * `Instantaneu`, il arunca la urmatoarea confirmare sau la schimbarea
 * fisierului) — functia asta doar aplica un instantaneu dat, oricare ar fi el.
 */
export function anuleaza(
  inst: Instantaneu,
  rezolvate: Map<number, { extras: LinieExtrasa; sursa: Sursa }>,
): void {
  for (const { index, extras, sursa } of inst.intrari) rezolvate.set(index, { extras, sursa });
}
