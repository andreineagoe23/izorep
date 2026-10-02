/**
 * Ofertele descarcate din aplicatie, pe importul din care au iesit.
 *
 * „Cereri și oferte” arata ce s-a facut in aplicatie: fiecare import e o
 * cerere, iar „Descarcă oferta” o noteaza aici (numarul, clientul, valoarea).
 * Sters importul, se sterge si oferta lui — omul se asteapta ca un rand sters
 * sa dispara de peste tot (Andrei, 3 octombrie 2026).
 *
 * Ca `lucrari-local.ts`: doar pentru prototip, in `localStorage`; best-effort.
 */
export interface OfertaEmisa {
  /** „RAD284", sau gol daca oferta n-a primit numar. */
  numar: string;
  /** Data scrisa pe oferta: „27.05.2026". */
  data: string;
  client: string;
  obiectiv: string;
  /** Ce plateste clientul: dupa ajustare, adaosul de foc si discount (EUR). */
  valoare: number;
  pozitii: number;
  /** Cand s-a descarcat, ISO. */
  cand: string;
}

export const CHEIE_OFERTE = "izorep-oferte-emise";

const alege = (d?: Storage): Storage | null => {
  if (d) return d;
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
};

/** Pe id-ul importului (`SesiuneImport.id`). */
export function citesteOferte(d?: Storage): Record<string, OfertaEmisa> {
  try {
    const brut = alege(d)?.getItem(CHEIE_OFERTE);
    const o = brut ? (JSON.parse(brut) as unknown) : null;
    return o && typeof o === "object" && !Array.isArray(o) ? (o as Record<string, OfertaEmisa>) : {};
  } catch {
    return {};
  }
}

function scrie(o: Record<string, OfertaEmisa>, d?: Storage): void {
  try {
    alege(d)?.setItem(CHEIE_OFERTE, JSON.stringify(o));
  } catch {
    // Fara stocare, oferta tot s-a descarcat; doar lista n-o mai arata.
  }
}

/** Ultima oferta descarcata din import o inlocuieste pe cea de dinainte. */
export function noteazaOferta(importId: string, o: OfertaEmisa, d?: Storage): void {
  scrie({ ...citesteOferte(d), [importId]: o }, d);
}

export function uitaOferta(importId: string, d?: Storage): void {
  const toate = citesteOferte(d);
  if (!(importId in toate)) return;
  const { [importId]: _, ...rest } = toate;
  scrie(rest, d);
}
