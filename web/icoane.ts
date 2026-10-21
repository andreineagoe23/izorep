/**
 * Pictogramele meniului.
 *
 * Exista pentru bara pliata: fara eticheta, un item trebuie sa ramana
 * recognoscibil. Cat timp bara e extinsa, pictograma e decor si de-aia e
 * `aria-hidden` — eticheta o citeste cititorul de ecran, nu desenul.
 *
 * Contur, nu umplere, si `currentColor`: aceleasi doua teme, fara a doua
 * paleta. Un set de pictograme colorate ar aduce culori in afara jetoanelor
 * din `style.css`.
 */
const CAI: Record<string, string> = {
  tablou: '<rect x="3" y="3" width="7.5" height="7.5" rx="1.6"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.6"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.6"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.6"/>',
  lucrari: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7"/><path d="M3 12h18"/>',
  documente: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h4"/>',
  deviz: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7.5h8"/><path d="M8.5 12h0M12 12h0M15.5 12h0M8.5 16h0M12 16h0M15.5 16h0"/>',
  import: '<path d="M12 15V4"/><path d="M8 8l4-4 4 4"/><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>',
  clienti: '<path d="M15 20v-1.5A3.5 3.5 0 0 0 11.5 15h-4A3.5 3.5 0 0 0 4 18.5V20"/><circle cx="9.5" cy="8" r="3.4"/><path d="M20 20v-1.5a3.5 3.5 0 0 0-2.6-3.4"/><path d="M15.2 4.8a3.4 3.4 0 0 1 0 6.4"/>',
  preturi: '<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0l-7-7A2 2 0 0 1 3 12.2V5a2 2 0 0 1 2-2h7.2a2 2 0 0 1 1.4.6l7 7a2 2 0 0 1 0 2.8Z"/><circle cx="7.6" cy="7.6" r="1.4"/>',
  /* Un carnet cu spirala: notitele de pe santier. */
  masuratori: '<rect x="5" y="3" width="15" height="18" rx="2"/><path d="M5 7H3M5 12H3M5 17H3"/><path d="M9 8h7M9 12h7M9 16h4"/>',
  /* Un clipboard cu bifa: comanda la furnizor. */
  comenzi: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1"/><path d="M8.5 12.5l2.2 2.2 4.8-4.8"/>',
  /* Un raft cu cutii: depozitul. */
  materiale: '<path d="M3 21V8l9-5 9 5v13"/><path d="M3 21h18"/><rect x="7" y="13" width="4" height="4" rx=".6"/><rect x="13" y="13" width="4" height="4" rx=".6"/><rect x="10" y="8.5" width="4" height="4" rx=".6"/>',
  /* Bara laterala insasi: un panou cu marginea din stanga ingrosata. */
  bara: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>',
};

/** Pictograma cu id-ul dat. Id necunoscut: nimic, nu un patrat gol. */
export const icoana = (id: string): string => {
  const cai = CAI[id];
  if (!cai) return "";
  return `<svg class="ico" viewBox="0 0 24 24" width="19" height="19" fill="none"
    stroke="currentColor" stroke-width="1.7" stroke-linecap="round"
    stroke-linejoin="round" aria-hidden="true" focusable="false">${cai}</svg>`;
};
