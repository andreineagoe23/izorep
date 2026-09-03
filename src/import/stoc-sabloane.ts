import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { SablonInvatat, StocSabloane } from "./memorie.js";

/**
 * Memoria de sabloane pe disc, pentru CLI si teste.
 *
 * Un singur fisier, nu unul per sablon: se citeste intreg la fiecare import si
 * are cateva sute de intrari, nu milioane. Cand apare serverul, acelasi
 * `StocSabloane` se implementeaza peste o tabela, per tenant — de-aia interfata
 * exista, si de-aia `memorie.ts` nu stie nimic despre fisiere.
 *
 * Modul de Node, deliberat separat: `memorie.ts` e izomorf si se importa si din
 * browser, unde depozitul e `localStorage`.
 */
export const CALE_SABLOANE = new URL("../../data/sabloane.json", import.meta.url).pathname;

export function stocPeDisc(cale = CALE_SABLOANE): StocSabloane {
  const citeste = (): SablonInvatat[] =>
    existsSync(cale) ? (JSON.parse(readFileSync(cale, "utf8")) as SablonInvatat[]) : [];

  const scrie = (v: SablonInvatat[]): void => {
    mkdirSync(dirname(cale), { recursive: true });
    // Ordonat dupa tipar: fisierul e commit-uit, iar un diff care se reordoneaza
    // singur la fiecare scriere nu se poate citi la code review.
    writeFileSync(cale, `${JSON.stringify([...v].sort((a, b) => a.tipar.localeCompare(b.tipar)), null, 2)}\n`);
  };

  return {
    toate: citeste,
    pune(s) {
      const v = citeste().filter((x) => x.tipar !== s.tipar);
      v.push(s);
      scrie(v);
    },
    sterge(tipar) {
      scrie(citeste().filter((x) => x.tipar !== tipar));
    },
  };
}
