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
