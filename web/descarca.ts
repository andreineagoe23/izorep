/**
 * Singurul loc din aplicație care scoate un fișier din browser.
 *
 * Până acum nu exista niciunul — nimic nu ieșea din aplicație. Există într-un
 * fișier propriu, cu o singură funcție, tocmai ca să rămână unul singur:
 * secvența `Blob` → `createObjectURL` → `<a download>` → click → `revoke` e
 * scurtă și tentant de copiat, iar copiată de trei ori uită de fiecare dată
 * altceva. Cel mai des `revokeObjectURL`, care nu se vede că lipsește: URL-ul
 * ține bufferul viu până la închiderea tabului, iar un registru de câteva sute
 * de kB per descărcare se adună într-o sesiune de lucru.
 *
 * `<a>`-ul nu se atașează la DOM: `click()` pe un element detașat funcționează
 * în toate browserele curente și nu lasă nimic în urmă dacă ceva aruncă între
 * creare și click.
 */

/** Tipul MIME al registrelor `.xlsx`. */
export const MIME_XLSX =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/**
 * Dă fișierul omului, cu numele cerut.
 *
 * `revokeObjectURL` e amânat un tick: revocat sincron imediat după `click()`,
 * unele browsere anulează descărcarea care abia a pornit.
 */
export function descarca(continut: ArrayBuffer, nume: string, mime = MIME_XLSX): void {
  const url = URL.createObjectURL(new Blob([continut], { type: mime }));
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = nume;
    a.click();
  } finally {
    setTimeout(() => { URL.revokeObjectURL(url); }, 0);
  }
}

/**
 * Numele fișierului de ofertă: `Oferta RAD284 27.05.2026.xlsx`.
 *
 * Fără caracterele pe care Windows le refuză într-un nume de fișier. Nu e
 * paranoia: numărul și data vin dintr-un formular, iar un `/` tastat acolo ar
 * face descărcarea să eșueze fără niciun mesaj.
 */
export const numeOferta = (serie: string, numar: string, data: string): string =>
  `Oferta ${serie}${numar} ${data}.xlsx`.replace(/[/\\?%*:|"<>]/g, "-");
