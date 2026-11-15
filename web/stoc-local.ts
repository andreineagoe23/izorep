import type { SablonInvatat, StocSabloane } from "../src/import/memorie.js";

/**
 * Memoria de sabloane a demo-ului, in `localStorage`.
 *
 * Pe server sabloanele stau in baza, pe firma (`web/stoc-sabloane.ts`, din 14
 * noiembrie 2026): o corectie facuta de un coleg ajuta pe toata lumea. Aici
 * e doar linkul demo, fara server, deci raman in browserul celui care a facut
 * corectia. Ce era aici inainte se muta o data pe server.
 *
 * Orice acces la `localStorage` poate arunca (fereastra privata, cookies
 * blocate, capturi de ecran automate). Un depozit care crapa nu are voie sa
 * opreasca importul: la eroare se comporta ca un depozit gol.
 */
const CHEIE = "izorep-sabloane";

const citeste = (): SablonInvatat[] => {
  try {
    const brut = localStorage.getItem(CHEIE);
    return brut ? (JSON.parse(brut) as SablonInvatat[]) : [];
  } catch {
    return [];
  }
};

const scrie = (v: SablonInvatat[]): void => {
  try {
    localStorage.setItem(CHEIE, JSON.stringify(v));
  } catch {
    // Memoria e o optimizare, nu o garantie. Importul merge si fara ea.
  }
};

export const stocLocal = (): StocSabloane => ({
  toate: citeste,
  pune(s) {
    const v = citeste().filter((x) => x.tipar !== s.tipar);
    v.push(s);
    scrie(v);
  },
  sterge(tipar) {
    scrie(citeste().filter((x) => x.tipar !== tipar));
  },
});
