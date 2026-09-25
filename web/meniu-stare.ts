/**
 * Starea barei laterale, pastrata intre sesiuni.
 *
 * Doua stari, nu trei: `extins` (implicit) si `pliat`. Pe ecran ingust bara
 * devine sertar, iar sertarul NU se retine — se deschide la cerere si se
 * inchide la prima navigare. O bara deschisa peste continut la fiecare
 * incarcare ar fi un obstacol, nu o preferinta.
 *
 * Depozitul e injectabil ca sa poata fi testat in Node, si e best-effort:
 * in fereastra privata sau cu stocarea blocata orice apel arunca. Preferinta
 * se pierde, meniul functioneaza.
 */
export type StareMeniu = "extins" | "pliat";

export const CHEIE_MENIU = "izorep-meniu";

const alege = (d?: Storage): Storage | null => {
  if (d) return d;
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null; // acces blocat: nu exista depozit
  }
};

export function citesteMeniu(d?: Storage): StareMeniu {
  try {
    return alege(d)?.getItem(CHEIE_MENIU) === "pliat" ? "pliat" : "extins";
  } catch {
    return "extins";
  }
}

/**
 * `extins` sterge cheia in loc s-o scrie: implicitul nu are ce cauta in
 * depozit, iar o cheie absenta si una cu valoarea implicita citesc la fel.
 */
export function scrieMeniu(s: StareMeniu, d?: Storage): void {
  try {
    const dep = alege(d);
    if (!dep) return;
    if (s === "pliat") dep.setItem(CHEIE_MENIU, "pliat");
    else dep.removeItem(CHEIE_MENIU);
  } catch { /* preferinta nu se retine, meniul merge */ }
}

export const inverseaza = (s: StareMeniu): StareMeniu => (s === "pliat" ? "extins" : "pliat");

/* ------------------------------------------------ plierea ceruta de un ecran */

/**
 * Un ecran care are nevoie de toata latimea — importul, cand arata foaia
 * clientului ca in Excel — o cere cu evenimentul asta, iar bara se pliaza pana
 * cand cererea se retrage sau se schimba ecranul. Ecranele nu ating meniul
 * (contractul din `ui.md`); spun doar de ce au nevoie, iar `main.ts` decide.
 *
 * Plierea e TEMPORARA: nu scrie preferinta. Cine tine meniul deschis il
 * regaseste deschis pe celelalte ecrane.
 */
export const EVENIMENT_SPATIU = "izorep:spatiu-lat";

export function ceriSpatiu(de: EventTarget, lat: boolean): void {
  de.dispatchEvent(new CustomEvent<boolean>(EVENIMENT_SPATIU, { detail: lat, bubbles: true }));
}

export interface SpatiuCerut {
  /** Ecranul curent cere acum toata latimea. */
  cerut: boolean;
  /** Bara e pliata din cauza cererii, nu din preferinta omului. */
  pliatTemporar: boolean;
}

export const FARA_CERERE: SpatiuCerut = { cerut: false, pliatTemporar: false };

/**
 * Pliaza doar la TRECEREA de la „nu cere" la „cere". Ecranul de import
 * semnaleaza la fiecare redesenare; daca omul redeschide meniul in timp ce
 * verifica foaia, o redesenare n-are voie sa i-l inchida din nou.
 */
export function laCerere(s: SpatiuCerut, lat: boolean, preferinta: StareMeniu, mobil: boolean): SpatiuCerut {
  if (!lat) return FARA_CERERE;
  if (s.cerut) return s;
  return { cerut: true, pliatTemporar: !mobil && preferinta === "extins" };
}

/** Ce se vede: plierea temporara bate preferinta, nu o inlocuieste. */
export const stareEfectiva = (preferinta: StareMeniu, s: SpatiuCerut): StareMeniu =>
  s.pliatTemporar ? "pliat" : preferinta;
