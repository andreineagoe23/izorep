/**
 * Câmpul de parolă cu ochiul din dreapta (Andrei, 22 octombrie 2026: „ca la
 * orice arată parola”, în locul butonului cu text). Ochiul deschis arată
 * parola, ochiul tăiat o ascunde; cititorul de ecran aude „Arată parola” /
 * „Ascunde parola”. Folosit pe intrare, pe „Alege-ți parola” și în „Contul meu”.
 */
import { esc } from "./ecrane/tip.js";

const OCHI = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8"
  stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
  <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>`;
const OCHI_TAIAT = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8"
  stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
  <path d="M10.6 5.1A10.4 10.4 0 0 1 12 5c6.4 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.1"/>
  <path d="M6.6 6.6A17.4 17.4 0 0 0 2 12s3.6 7 10 7a9.7 9.7 0 0 0 5.4-1.6"/>
  <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/><path d="m3 3 18 18"/></svg>`;

/** Eticheta și caseta de parolă, cu ochiul în dreapta casetei. */
export function campParola(eticheta: string, nume: string, autocomplete: string, extra = ""): string {
  return `<label>${esc(eticheta)}<span class="parola">
    <input name="${nume}" type="password" autocomplete="${autocomplete}" ${extra} />
    <button type="button" class="ochi" data-arata-parola aria-pressed="false" aria-label="Arată parola" title="Arată parola">${OCHI}</button>
  </span></label>`;
}

/** Ochiul comută între parola ascunsă și cea arătată; focusul rămâne în casetă. */
export function legaArataParola(f: HTMLElement): void {
  f.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-arata-parola]");
    const input = b?.parentElement?.querySelector<HTMLInputElement>("input");
    if (!b || !input) return;
    const arata = input.type === "password";
    input.type = arata ? "text" : "password";
    b.innerHTML = arata ? OCHI_TAIAT : OCHI;
    const text = arata ? "Ascunde parola" : "Arată parola";
    b.setAttribute("aria-label", text);
    b.title = text;
    b.setAttribute("aria-pressed", String(arata));
    input.focus();
  });
}
