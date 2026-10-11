/**
 * Pozițiile adăugate de mână în ofertă, ca o foaie în plus a registrului.
 *
 * Oferta se face din liniile importului. O poziție pe care clientul n-a scris-o
 * (o casetă uitată, o lucrare cerută la telefon) trebuie să treacă pe același
 * drum: aceeași citire, același preț, același editor, aceeași numerotare. De
 * aceea nu e un rând separat al ofertei, ci un rând al unei foi „Adăugate de
 * mână” construite în memorie și puse după foile clientului. Fișierul
 * clientului rămâne neatins; în import se salvează doar rândurile scrise de om.
 *
 * Indecșii continuă după ultimul rând al clientului, deci extragerile salvate
 * pe foile lui rămân pe aceiași indecși.
 */
import { construiesteLinie, type FoaieBruta, type RandBrut } from "./rand.js";

export interface PozitieAdaugata {
  text: string;
  um: string;
  cantitate: number;
}

export const FOAIE_ADAUGATE = "Adăugate de mână";

export function cuAdaugate(foi: FoaieBruta[], adaugate: readonly PozitieAdaugata[]): FoaieBruta[] {
  const clientului = foi.filter((f) => f.nume !== FOAIE_ADAUGATE);
  if (adaugate.length === 0) return clientului;
  let index = clientului.reduce((n, f) => n + f.randuri.filter((r) => r.linie).length, 0);
  const randuri: RandBrut[] = adaugate.map((a, i) => {
    const brute: (string | number | null)[] = [a.text, a.um, a.cantitate];
    const rand: RandBrut = { rand: i + 1, celule: brute.map((v) => ({ v, span: 1 })) };
    const linie = construiesteLinie(brute, { index, foaie: FOAIE_ADAUGATE, rand: i + 1 });
    if (linie) { rand.linie = linie; index++; }
    return rand;
  });
  return [...clientului, { nume: FOAIE_ADAUGATE, randuri, coloane: 3 }];
}
