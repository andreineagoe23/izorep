// Din `rand.ts`, NU din `parse-workbook.ts`: acela incarca ExcelJS (~940 kB) la
// nivel de modul, iar ecranul de import importa fisierul asta ca valoare — deci
// importul de acolo ar face ExcelJS sa se incarce la deschiderea ecranului, nu
// la primul fisier tras in el.
import { construiesteLinie, type CelulaBruta, type RandBrut } from "./rand.js";

/**
 * Corecteaza o celula din grila editabila si o propaga pana la linia extrasa.
 *
 * Ecranul de import tine DOUA forme diferite ale aceluiasi rand: `RandBrut.celule`
 * (`CelulaBruta[]`), cu imbinarile stranse in `span`, pe care ecranul le
 * randeaza 1:1, si `LinieBruta.celule` (vectorul `brute`), cu valoarea unei
 * imbinari REPETATA pe fiecare pozitie — contractul de care depinde
 * `esteAntetSectiune` din `sectiuni.ts`. Cand omul corecteaza o celula in
 * grila, ecranul scria pana acum DOAR in prima forma: `LinieBruta.text/um/
 * cantitate` raman inghetate la ce iesise din `construiesteLinie` la parsare,
 * deci corectia se vede pe ecran, dar extragerea si pretul raman pe datele
 * vechi. Functiile de aici scriu in ambele forme si refac linia din ele.
 *
 * Izomorf: fara `node:*`, fara DOM — ruleaza identic in ecranul de import
 * (browser) si in teste (Node).
 */

/** Offsetul in `LinieBruta.celule` al celulei cu indexul `cel` din `RandBrut.celule`. */
export function offsetColoana(celule: CelulaBruta[], cel: number): number {
  let offset = 0;
  for (let i = 0; i < cel; i++) {
    const c = celule[i];
    if (c) offset += c.span;
  }
  return offset;
}

/**
 * Scrie o valoare intr-o celula si o propaga in `linie.celule`.
 *
 * Peticeste intervalul span-ului, NU reconstruieste array-ul: `linie.celule`
 * tine imbinarile VERTICALE (continuarea in jos a unei celule stapan e
 * `{v:null,span:1}` in `RandBrut.celule`, dar valoarea stapanului repetata in
 * `LinieBruta.celule`), iar `CelulaBruta[]` singur nu contine informatia
 * necesara ca sa le refaca. Desfacuta gresit aici, `esteAntetSectiune` — care
 * recunoaste antetul de sectiune exact dupa repetitia aia — pierde 53 de
 * pozitii de inchideri goluri la foc.
 */
export function scrieCelula(rand: RandBrut, cel: number, v: string | number | null): void {
  const celula = rand.celule[cel];
  if (!celula) return;
  celula.v = v;

  if (!rand.linie) return;
  const offset = offsetColoana(rand.celule, cel);
  for (let i = offset; i < offset + celula.span; i++) rand.linie.celule[i] = v;
}

/**
 * Reface `text`/`um`/`cantitate` din `linie.celule` (deja peticit de
 * `scrieCelula`), pastrand identitatea obiectului `linie`: ecranul si hartile
 * de extragere (rezolvate/reziduale, indexate dupa `linie.index`) tin
 * referinte catre el, deci se mutam campurile, nu se inlocuieste obiectul.
 *
 * Daca `rand.linie` lipseste, randul nu era pozitie inainte de editare si nu
 * devine unul acum — asta e DELIBERAT in afara scopului. A crea o pozitie
 * noua dintr-o editare ar cere alocarea unui index nou, iar indecsii sunt
 * cheia hartilor de extragere (`rezolvate`, `reziduale`, sabloanele deduplicate);
 * un index inventat aici ar coliza sau ar ramane orfan fata de ele.
 */
export function reconstruieste(rand: RandBrut): void {
  const linie = rand.linie;
  if (!linie) return;

  const noua = construiesteLinie(linie.celule, { index: linie.index, foaie: linie.foaie, rand: linie.rand });

  if (noua === null) {
    // Randul nu mai e pozitie dupa corectie (ex: descrierea a fost golita).
    // Nu stergem linia: indexul ei ramane cheie in hartile de extragere, iar
    // un text gol iese oricum ca nepozitie mai departe in pipeline
    // (`faraMasura`, `extrageDeterminist`), deci ramane netarifata fara sa
    // strice indecsii celorlalte linii.
    linie.text = "";
    delete linie.um;
    delete linie.cantitate;
    return;
  }

  linie.text = noua.text;
  if (noua.um !== undefined) linie.um = noua.um;
  else delete linie.um;
  if (noua.cantitate !== undefined) linie.cantitate = noua.cantitate;
  else delete linie.cantitate;
}

/** O celula pe care editorul de pozitie o arata ca atare. `cel` e indexul din `RandBrut.celule`. */
export interface CelulaEditabila {
  cel: number;
  /** Capul coloanei din antetul foii, sau un nume generic cand foaia n-are antet. */
  eticheta: string;
  v: string | number;
}

export interface CampuriRand {
  /** Celulele cu text: descrierea, intr-una sau mai multe coloane (Book15 o are in engleza si in romana). */
  texte: CelulaEditabila[];
  um?: CelulaEditabila;
  cantitate?: CelulaEditabila;
}

/**
 * Celulele unui rand pe care le corecteaza editorul de pozitie — descrierea,
 * unitatea de masura si cantitatea — cu capul coloanei lor.
 *
 * UM-ul si cantitatea se cauta dupa VALOAREA pe care a citit-o linia
 * (`linie.um`, `linie.cantitate`), nu dupa o coloana fixa: cu maparea de
 * coloane (L1) cantitatea vine din coloana mapata, fara ea din euristica de
 * langa UM, iar editorul trebuie sa scrie exact in celula din care s-a citit
 * pretul. Cand valoarea nu e in nicio celula, campul lipseste: editorul nu
 * ghiceste unde sa scrie.
 */
export function campuriRand(rand: RandBrut, antet?: RandBrut): CampuriRand {
  const linie = rand.linie;
  const eticheta = (cel: number, implicit: string): string => {
    const col = offsetColoana(rand.celule, cel);
    let offset = 0;
    for (const c of antet?.celule ?? []) {
      if (col < offset + c.span) {
        const t = typeof c.v === "string" ? c.v.replace(/\s+/g, " ").trim() : "";
        return t || implicit;
      }
      offset += c.span;
    }
    return implicit;
  };

  const texte: CelulaEditabila[] = [];
  let um: CelulaEditabila | undefined;
  const cuCantitatea: number[] = [];
  rand.celule.forEach((c, cel) => {
    if (typeof c.v === "string") {
      if (!um && linie?.um !== undefined && c.v.trim() === linie.um) um = { cel, eticheta: eticheta(cel, "UM"), v: c.v };
      else if (c.v.trim().length > 3) texte.push({ cel, eticheta: eticheta(cel, "Descriere"), v: c.v });
    } else if (typeof c.v === "number" && c.v === linie?.cantitate) {
      cuCantitatea.push(cel);
    }
  });

  // Aceeasi valoare poate sta in doua celule — „Nr. 1 | ... | ml | 1". Cantitatea
  // e cea mai apropiata de UM, iar la egalitate cea de dupa ea, ca in `rand.ts`.
  const langa = um?.cel ?? rand.celule.length;
  const cel = [...cuCantitatea].sort((a, b) => Math.abs(a - langa) - Math.abs(b - langa) || b - a)[0];
  const cantitate: CelulaEditabila | undefined = cel === undefined
    ? undefined
    : { cel, eticheta: eticheta(cel, "Cantitate"), v: rand.celule[cel]!.v as number };

  return { texte, ...(um ? { um } : {}), ...(cantitate ? { cantitate } : {}) };
}
