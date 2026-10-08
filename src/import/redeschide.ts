/**
 * Un import salvat, refacut fara model: fisierul, corecturile de celula si
 * extragerile salvate (inclusiv ale modelului) puse peste, apoi recalculat.
 *
 * Il folosesc ecranul de import (cand redeschide un import din istoric) si
 * pagina „Măsurători” (cand compara masuratorile cu lista clientului). Pe un
 * singur drum, ca lista comparata sa fie exact cea pe care a vazut-o omul.
 * Izomorf: fara `node:*`, fara DOM; depozitul de istoric e al apelantului.
 */
import { parseFoiBuffer } from "./parse-workbook.js";
import { reconstruieste, scrieCelula } from "./editare.js";
import { proceseazaRegistru, reevalueaza, type OptiuniNucleu, type Rezultat } from "./nucleu.js";
import type { LinieExtrasa, Sursa } from "./schema.js";

/** Ce trebuie dintr-un import salvat ca sa fie refacut. */
export interface ImportSalvat {
  fisier: ArrayBuffer;
  editari: { foaie: string; rand: number; cel: number; v: string | number | null }[];
  extrase: { index: number; extras: LinieExtrasa; sursa: Sursa; text?: string }[];
}

export async function redeschideImport(s: ImportSalvat, optiuni: OptiuniNucleu): Promise<Rezultat> {
  const foi = await parseFoiBuffer(s.fisier);
  // Corecturile de celula se aplica INAINTE de extragere; extragerile salvate
  // (inclusiv ale modelului) se pun peste, fara sa se recheme modelul.
  for (const e of s.editari) {
    const rand = foi.find((f) => f.nume === e.foaie)?.randuri.find((r) => r.rand === e.rand);
    if (rand) { scrieCelula(rand, e.cel, e.v); reconstruieste(rand); }
  }
  const { extrage: _faraModel, ...fara } = optiuni;
  const rez = await proceseazaRegistru(foi, fara);
  for (const x of s.extrase) {
    rez.rezolvate.set(x.index, { extras: x.extras, sursa: x.sursa, ...(x.text !== undefined ? { text: x.text } : {}) });
  }
  reevalueaza(rez, fara);
  return rez;
}
