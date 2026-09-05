import { z } from "zod";
import type { CelulaBruta, FoaieBruta, RandBrut } from "./parse-workbook.js";
import { normalizeaza } from "./sabloane.js";

/**
 * L1: ce rol are fiecare coloana a unei foi.
 *
 * Azi nimic nu citeste randul de antet. Cantitatea se ghiceste — "primul numar
 * lipit de unitatea de masura" — iar `Flower City`, care are trei coloane de
 * cantitate deodata (`Cantitate / unitate`, `Nr. Unitati`, `Cantitate TOTAL`),
 * poate da factorul in loc de cantitate.
 *
 * Randul de antet exista si se gaseste fizic pe 14 din 15 foi masurate, dar nu
 * e pe pozitie fixa (r1, r2, r5, r6, r9, r12, r14, r15), iar pe doua foi regula
 * fizica greseste: una n-are antet deloc, alta are un rand de coduri de articol
 * care trece drept antet. De-aia maparea vine de la model.
 *
 * Si de-aia nu ramane acolo: modelul PROPUNE, iar `valideazaMapare` — cod
 * determinist peste datele foii — accepta sau respinge. O mapare care spune ca
 * o coloana de text e "cantitate" pica pe loc.
 */

export const ROLURI = [
  "nr", "denumire", "denumire_alt", "um", "cantitate", "cantitate_unitara",
  "nr_unitati", "pret_unitar", "pret_total", "dimensiune", "observatii", "ignora",
] as const;
export type RolColoana = (typeof ROLURI)[number];

export const MapareFoaie = z.object({
  /** Indexul randului de antet in `FoaieBruta.randuri`, sau null daca nu are. */
  rand_antet: z.number().int().nullable(),
  /** Primul rand de date, ca index in `FoaieBruta.randuri`. */
  rand_start: z.number().int(),
  /** Cate un rol per coloana, in ordinea coloanelor. */
  roluri: z.array(z.enum(ROLURI)),
  motiv: z.string(),
});
export type MapareFoaie = z.infer<typeof MapareFoaie>;

export const JSON_SCHEMA_MAPARE = {
  name: "mapare_coloane",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["rand_antet", "rand_start", "roluri", "motiv"],
    properties: {
      rand_antet: { type: ["integer", "null"] },
      rand_start: { type: "integer" },
      roluri: { type: "array", items: { type: "string", enum: [...ROLURI] } },
      motiv: { type: "string" },
    },
  },
} as const;

/**
 * Coloana reala a unei celule.
 *
 * Nu e indexul din vector: parserul strange imbinarile orizontale intr-o
 * singura celula cu `span`, deci pe un rand cu imbinari indexul se decaleaza
 * fata de coloana din Excel. Maparea vorbeste despre COLOANE, nu despre
 * pozitii in vector, altfel un titlu imbinat pe doua coloane ar muta rolurile
 * pe randul lui si numai pe el.
 */
export function laColoana(celule: CelulaBruta[], coloana: number): string | number | null {
  let c = 0;
  for (const cel of celule) {
    if (coloana >= c && coloana < c + cel.span) return cel.v;
    c += cel.span;
  }
  return null;
}

const UM_TOKEN = /^(ml|m|m²|m2|mp|buc|buc\.|pcs|stk|lm|kg|to|set|kpl)$/i;

const esteNumar = (v: string | number | null): boolean =>
  typeof v === "number" || (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v.replace(",", "."))));

const esteText = (v: string | number | null): boolean =>
  typeof v === "string" && v.trim().length > 3 && !esteNumar(v);

export interface AvertismentMapare {
  coloana: number;
  rol: RolColoana;
  mesaj: string;
}

/**
 * Verifica maparea peste datele foii, nu peste etichetele din antet.
 *
 * Eticheta poate sa mintă — "Cantitate" deasupra unei coloane goale, antet in
 * germana, foaie fara antet. Continutul coloanei nu minte: o coloana de
 * cantitate e numerica pe majoritatea randurilor de date, una de denumire e
 * text, una de UM contine tokeni de unitate.
 *
 * Pragul e 60% din randurile NEGOALE ale coloanei, nu din toate: coloanele
 * reale au goluri peste tot — subtotaluri, randuri de titlu, pozitii fara pret.
 */
export function valideazaMapare(
  foaie: FoaieBruta,
  m: MapareFoaie,
  prag = 0.6,
): AvertismentMapare[] {
  const av: AvertismentMapare[] = [];
  const date = foaie.randuri.slice(m.rand_start);

  if (m.rand_antet !== null && m.rand_antet >= m.rand_start) {
    av.push({ coloana: -1, rol: "ignora", mesaj: "randul de antet nu e deasupra datelor" });
  }
  if (date.length === 0) {
    av.push({ coloana: -1, rol: "ignora", mesaj: "maparea nu lasa niciun rand de date" });
    return av;
  }

  const unice: RolColoana[] = ["denumire", "um", "cantitate", "pret_unitar", "pret_total"];
  for (const rol of unice) {
    const n = m.roluri.filter((r) => r === rol).length;
    if (n > 1) av.push({ coloana: -1, rol, mesaj: `rolul "${rol}" e dat pe ${n} coloane` });
  }

  const proportie = (coloana: number, test: (v: string | number | null) => boolean): number | null => {
    const valori = date.map((r) => laColoana(r.celule, coloana))
      .filter((v) => v !== null && String(v).trim() !== "");
    if (valori.length === 0) return null;
    return valori.filter(test).length / valori.length;
  };

  /**
   * Rolurile pe care pipeline-ul chiar le CITESTE. Doar la ele o coloana goala
   * e o problema.
   *
   * O lista de cantitati de la client are aproape intotdeauna coloanele de pret
   * goale — pretul e ce urmeaza sa punem noi. Prima varianta a validarii
   * respingea maparea lui `Flower City` exact pentru asta, desi restul ei era
   * corect. Goliciunea unei coloane pe care nu o folosim nu spune nimic despre
   * calitatea mapari.
   */
  const CONSUMATE = new Set<RolColoana>(["denumire", "um", "cantitate", "cantitate_unitara"]);

  const cere = (coloana: number, rol: RolColoana, test: (v: string | number | null) => boolean, ce: string): void => {
    const p = proportie(coloana, test);
    if (p === null) {
      if (CONSUMATE.has(rol)) {
        av.push({ coloana, rol, mesaj: `coloana marcata "${rol}" e goala pe toate randurile de date` });
      }
    } else if (p < prag) {
      av.push({ coloana, rol, mesaj: `coloana marcata "${rol}" e ${ce} doar in ${(p * 100).toFixed(0)}% din randuri` });
    }
  };

  for (const [coloana, rol] of m.roluri.entries()) {
    switch (rol) {
      case "cantitate": case "cantitate_unitara": case "nr_unitati":
      case "pret_unitar": case "pret_total":
        cere(coloana, rol, esteNumar, "numerica");
        break;
      case "denumire": case "denumire_alt":
        cere(coloana, rol, esteText, "text");
        break;
      case "um":
        cere(coloana, rol, (v) => typeof v === "string" && UM_TOKEN.test(v.trim()), "unitate de masura");
        break;
      default:
        break;
    }
  }
  return av;
}

/**
 * Amprenta layoutului unei foi: etichetele de antet normalizate plus latimea.
 *
 * E cheia de cache. `Radoia.xlsx` are sapte foi cu antet identic — o mapare,
 * sapte foi — iar a doua lista cu acelasi layout nu mai cheama modelul deloc.
 * Fara antet, amprenta e doar latimea plus numele foii: slaba, dar suficienta
 * ca sa nu se reintrebe modelul de doua ori in acelasi import.
 */
export function amprentaAntet(foaie: FoaieBruta, randAntet: number | null): string {
  const rand: RandBrut | undefined = randAntet === null ? undefined : foaie.randuri[randAntet];
  const etichete = rand
    ? rand.celule.map((c) => (c.v === null ? "" : normalizeaza(String(c.v)))).join("|")
    : `fara-antet:${normalizeaza(foaie.nume)}`;
  return `${foaie.coloane}::${etichete}`;
}

/**
 * Indexul randului pe care regula fizica il crede antet, daca exista.
 *
 * E doar un CANDIDAT — pe 15 foi masurate il gaseste pe 14, dar pe una ia un
 * rand de coduri de articol drept antet, iar pe alta nu exista antet deloc.
 * Serveste la amprenta de cache, care trebuie sa fie calculabila FARA model.
 */
export const indexAntetFizic = (foaie: FoaieBruta): number | null => {
  if (!foaie.antet) return null;
  const i = foaie.randuri.indexOf(foaie.antet);
  return i >= 0 ? i : null;
};

/** Amprenta de cache a unei foi, calculata fara niciun apel la model. */
export const amprentaFoaie = (foaie: FoaieBruta): string =>
  amprentaAntet(foaie, indexAntetFizic(foaie));

/** Primele randuri ale foii, ca text, pentru intrebarea catre model. */
export function blocAntet(foaie: FoaieBruta, randuri = 15): string {
  return foaie.randuri.slice(0, randuri).map((r, i) => {
    const celule = r.celule.map((c) => (c.v === null ? "" : String(c.v).replace(/\s+/g, " ").slice(0, 40)));
    return `[${i}] ${celule.join(" | ")}`;
  }).join("\n");
}

const numar = (v: string | number | null): number | undefined => {
  if (typeof v === "number") return v > 0 ? v : undefined;
  if (typeof v !== "string") return undefined;
  const n = Number(v.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

/**
 * Aplica maparea peste liniile deja extrase din foaie.
 *
 * Modifica liniile PE LOC, si asta e deliberat: ecranul de import tine aceleasi
 * obiecte si in grila, si in lista trimisa la extragere, tocmai ca o corectie
 * facuta intr-un rand sa se vada in linia care pleaca mai departe. Daca aici
 * s-ar construi linii noi, cele doua s-ar desparti in tacere.
 *
 * Ce se schimba, cand maparea o spune:
 *  - `text` devine DOAR coloana de denumire. Azi e concatenarea tuturor
 *    celulelor de text, deci codul de articol si observatiile pleaca la model
 *    degeaba.
 *  - `um` si `cantitate` vin din coloanele lor, nu din euristica "primul numar
 *    lipit de unitatea de masura". La `Flower City`, unde exista
 *    "Cantitate / unitate", "Nr. Unitati" si "Cantitate TOTAL", euristica poate
 *    lua factorul in loc de cantitate.
 *
 * Randurile de deasupra `rand_start` raman neatinse: acolo sunt antetul si
 * titlurile, iar contextul de sectiune se calculeaza pe ele.
 */
/**
 * Aplica maparea pe UN singur rand deja extras.
 *
 * Separata de bucla peste foaie fiindca dupa o corectie de celula in ecranul
 * de import, `editare.reconstruieste` reface `linie.text/um/cantitate` din
 * `construiesteLinie` — care nu stie nimic despre mapare — deci maparea
 * trebuie reaplicata pe ACEL rand, nu pe toata foaia. Reaplicata pe toata
 * foaia, corectia ar costa un rescan inutil al randurilor neatinse; deloc
 * reaplicata, coloana mapata nu se mai citeste dupa prima editare din foaia
 * aia si randul cade inapoi pe euristica de cantitate.
 */
export function aplicaMapareRand(rand: RandBrut, m: MapareFoaie): void {
  if (!rand.linie) return;

  const col = (rol: RolColoana): number => m.roluri.indexOf(rol);
  const cUm = col("um");
  const cCantitate = col("cantitate") >= 0 ? col("cantitate") : col("cantitate_unitara");
  // Coloanele care descriu POZITIA, in ordinea lor din foaie.
  //
  // Nu doar denumirea: masurat pe fisierele reale, taierea la denumire lasa
  // `Oferta Matari` cu 0 pozitii din 53, fiindca dimensiunea golului
  // ("130/130") sta in coloana ei, iar pretul inchiderilor la foc vine din ea.
  // Pe `Book15` pierdea 4 pozitii din 9: fisierul are descrierea de doua ori,
  // in engleza si in romana, iar "vata minerala" apare doar in coloana romana.
  // De-aia exista `denumire_alt`.
  //
  // Ce ramane afara sunt numarul curent, cantitatea si preturile — adica exact
  // zgomotul din care euristica de azi ghiceste gresit.
  const cText = m.roluri
    .map((rol, i) => ({ rol, i }))
    .filter((x) => x.rol === "denumire" || x.rol === "denumire_alt"
      || x.rol === "dimensiune" || x.rol === "observatii")
    .map((x) => x.i);

  if (cText.length > 0) {
    const bucati = cText
      .map((i) => laColoana(rand.celule, i))
      .filter((v): v is string | number => v !== null && String(v).trim() !== "")
      .map((v) => String(v).trim());
    // Randul fara nimic in coloanele descriptive e un subtotal sau o
    // continuare: acolo textul concatenat e tot ce avem si ramane cum era.
    if (bucati.join(" | ").length > 3) rand.linie.text = bucati.join(" | ");
  }

  if (cUm >= 0) {
    const v = laColoana(rand.celule, cUm);
    if (typeof v === "string" && UM_TOKEN.test(v.trim())) rand.linie.um = v.trim();
    else delete rand.linie.um;
  }

  if (cCantitate >= 0) {
    const q = numar(laColoana(rand.celule, cCantitate));
    // Cantitatea din coloana mapata BATE euristica, inclusiv cand lipseste:
    // o cantitate ghicita dintr-o coloana gresita e mai rea decat una absenta.
    if (q === undefined) delete rand.linie.cantitate;
    else rand.linie.cantitate = q;
  }
}

export function aplicaMapare(foaie: FoaieBruta, m: MapareFoaie): number {
  let rafinate = 0;
  for (const r of foaie.randuri.slice(m.rand_start)) {
    if (!r.linie) continue;
    rafinate++;
    aplicaMapareRand(r, m);
  }
  return rafinate;
}
