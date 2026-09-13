import type {
  CodAvertisment, CodNetarifare, LinieProcesata,
} from "../src/import/nucleu.js";
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
 * Cauza unui blocaj, oricare din cele doua feluri.
 *
 * Cele doua enumerari se suprapun deliberat pe `dn_necunoscut`: motorul si
 * validatorul ajung la aceeasi concluzie pe drumuri diferite (unul cade la
 * conversie, celalalt se uita in tabel inainte), iar pentru omul de la validare
 * e acelasi lucru. Uniunea le colapseaza, deci si eticheta e una singura.
 */
export type CodBlocaj = CodNetarifare | CodAvertisment;

/**
 * Lentila peste grila: fie una dintre cele trei de dinainte, fie o cauza
 * anume.
 *
 * Varianta pe cod e obiect, nu inca un sir in uniune: `Filtru` e o multime
 * inchisa de trei valori care apar in `data-lentila` si in
 * `ETICHETA_CONFIRMARE`, iar amestecarea celor ~20 de coduri acolo ar fi cerut
 * un `Record` cu 23 de intrari pentru un buton care spune acelasi lucru.
 */
export type Lentila = Filtru | { cod: CodBlocaj };

/**
 * Ce inseamna fiecare cod pentru omul care valideaza, si care intrebare
 * deschisa catre firma il deblocheaza.
 *
 * Trimiterea la intrebare nu e decor: masurat pe cele 10 fisiere reale, 64 din
 * cele 130 de pozitii netarifate sunt acelasi raspuns neprimit (intrebarea 9).
 * Fara harta asta, ecranul spune "130 de pozitii n-au pret" si omul cauta 130
 * de cauze; cu ea, spune ca **jumatate** din ele se rezolva cu un singur
 * telefon. Numerele sunt cele din `.claude/stare.md`, „Intrebari deschise".
 */
export const ETICHETE_BLOCAJ: Record<CodBlocaj, { eticheta: string; intrebare?: number }> = {
  /* --- fara pret (CodNetarifare) --- */
  fara_coeficient_de_forma: { eticheta: "niciun strat n-are coeficient pe banda lui", intrebare: 9 },
  grosime_inexistenta: { eticheta: "grosime care nu există în listă" },
  peste_maximul_listei: { eticheta: "diametru peste maximul listei", intrebare: 4 },
  dn_necunoscut: { eticheta: "DN inexistent în seria de oțel", intrebare: 10 },
  // Fara intrebare fixa: vezi `intrebareaPentru`.
  grosime_ambigua: { eticheta: "grosimea nu e scrisă, iar sistemul are mai multe la rândul ăla" },
  banda_inexistenta: { eticheta: "diametrul nu cade în nicio bandă de multiplicatori" },
  lista_goala: { eticheta: "lista de prețuri e goală" },
  pozitie_fara_straturi: { eticheta: "poziție fără niciun strat" },
  fara_pret_pe_mp: { eticheta: "nu există preț pe mp pentru grosimea cerută" },
  gol_fara_dimensiuni: { eticheta: "închidere de gol fără dimensiunile golului" },
  gol_dimensiuni_invalide: { eticheta: "dimensiunile golului nu sunt pozitive" },
  banda_wrap_inexistenta: { eticheta: "banda WRAP nu e ofertată la diametrul ăsta" },
  colier_inexistent: { eticheta: "colierul PROMASTOP nu e ofertat la diametrul ăsta" },
  diametru_conducta_lipsa: { eticheta: "lipsește diametrul conductei" },
  material_conducta_lipsa: { eticheta: "lipsește materialul conductei (oțel sau plastic)" },
  gol_foc_in_matrice: { eticheta: "închidere de gol la foc trimisă pe matricea ø × grosime" },
  fara_diametru: { eticheta: "poziția n-are diametru (tubulatură rectangulară?): listele se caută doar pe ø" },
  /* --- au pret, dar sunt marcate (CodAvertisment) --- */
  notatie_contrazice_materialul: { eticheta: "scrie DN, dar materialul dă diametrul exterior", intrebare: 10 },
  diametru_necitat: { eticheta: "diametrul nu apare în textul sursă" },
  grosime_necitata: { eticheta: "grosimea nu apare în textul sursă" },
  gol_necitat: { eticheta: "dimensiunea golului nu apare în textul sursă" },
  grosime_in_afara_listei: { eticheta: "grosime pe care sistemul ăla nu o ofertează" },
  forma_contrazice_um: { eticheta: "forma contrazice unitatea de măsură" },
};

/**
 * Intrebarea deschisa catre firma care deblocheaza linia, pentru cauza data.
 *
 * Aproape mereu e cea din `ETICHETE_BLOCAJ`. Exceptia e `grosime_ambigua`, cu
 * doua situatii diferite sub acelasi cod: la tabla de inox lista are trei
 * grosimi la fiecare rand, iar clientul nu scrie niciodata care — intrebarea
 * 15; la vata sau elastomer grosimea lipsa se completeaza cu cea uzuala a
 * firmei, deci nu asteapta pe nimeni. Cu intrebarea fixa, cele 24 de casete de
 * vata de pe cererea Abur trimiteau la o intrebare despre inox.
 */
export function intrebareaPentru(cod: CodBlocaj, l: LinieProcesata): number | undefined {
  if (cod === "grosime_ambigua") {
    const cuInox = l.extras.sistem === "tabla_inox"
      || l.extras.straturi_extra.some((s) => s.sistem === "tabla_inox");
    return cuInox ? 15 : undefined;
  }
  return ETICHETE_BLOCAJ[cod].intrebare;
}

export interface Blocaj {
  cod: CodBlocaj;
  /** Cate pozitii de izolatie sunt oprite de cauza asta, pe foile date. */
  n: number;
  eticheta: string;
  intrebare?: number;
}

/**
 * Grupeaza pozitiile pe CAUZA, nu pe simptom.
 *
 * Ecranul spunea pana acum *cate* pozitii n-au pret, niciodata *de ce* —
 * `eroare` e text liber, iar lentila „Netarifate" da o lista, nu un
 * diagnostic. Aici se raspunde la intrebarea pe care si-o pune omul cand
 * deschide fisierul: ce anume trebuie rezolvat, si in ce ordine.
 *
 * O pozitie poate aparea in DOUA galeti — SPIRO ø160 n-are pret
 * (`dn_necunoscut`) SI poarta avertismentul de notatie — si e corect asa:
 * galetile sunt cauze, nu o impartire a pozitiilor. Antetul numara insa
 * pozitii DISTINCTE, ca sa nu iasa un total mai mare decat fisierul.
 *
 * Ordinea e descrescatoare dupa numar, apoi alfabetica pe cod: cauza care
 * blocheaza cel mai mult sta prima, iar doua cauze la egalitate nu-si schimba
 * locul intre doua redesenari.
 */
export function blocaje(linii: LinieProcesata[]): Blocaj[] {
  const contor = new Map<CodBlocaj, number>();
  const intrebari = new Map<CodBlocaj, number>();
  const adauga = (c: CodBlocaj, l: LinieProcesata): void => {
    contor.set(c, (contor.get(c) ?? 0) + 1);
    const q = intrebareaPentru(c, l);
    if (q !== undefined) intrebari.set(c, q);
  };

  for (const l of linii) {
    if (l.extras.sistem === null) continue;   // antet, nota, total: nu e pozitie
    if (!l.pret && l.codEroare) adauga(l.codEroare, l);
    for (const a of l.avertismente ?? []) adauga(a.cod, l);
  }

  return [...contor]
    .map(([cod, n]) => {
      const intrebare = intrebari.get(cod);
      return { cod, n, eticheta: ETICHETE_BLOCAJ[cod].eticheta, ...(intrebare !== undefined ? { intrebare } : {}) };
    })
    .sort((a, b) => b.n - a.n || a.cod.localeCompare(b.cod));
}

/** Cate pozitii DISTINCTE sunt atinse de cel putin un blocaj. */
export function nrBlocate(linii: LinieProcesata[]): number {
  return linii.filter((l) =>
    l.extras.sistem !== null
    && ((!l.pret && l.codEroare !== undefined) || (l.avertismente?.length ?? 0) > 0)).length;
}

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
export function potrivit(l: LinieProcesata, f: Lentila): boolean {
  if (typeof f === "object") {
    // Aceeasi regula ca la `blocaje`: o linie care nu e pozitie de izolatie nu
    // poate fi blocata de nimic, deci nu intra sub nicio lentila de cauza.
    if (l.extras.sistem === null) return false;
    if (!l.pret && l.codEroare === f.cod) return true;
    return (l.avertismente ?? []).some((a) => a.cod === f.cod);
  }
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
