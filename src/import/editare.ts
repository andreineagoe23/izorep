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
