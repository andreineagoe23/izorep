import { esc } from "./ecrane/tip.js";

/**
 * Celula editabilă, ca în Excel (Andrei, 15 octombrie 2026): pe ofertă și pe
 * necesar scrii direct în tabel. Celula schimbată e galbenă și spune, sub
 * mouse, ce era înainte; valoarea și totalurile se refac din ea.
 *
 * Doar marcajul și citirea numărului. Ce se întâmplă cu valoarea scrisă
 * hotărăște ecranul, din `data-ed` și din celelalte atribute `data-*`.
 */

/**
 * Numărul cum îl scrie omul: „1.234,5”, „1234,5”, „1234.5”. Gol sau greșit → null.
 * „1.250” e o mie două sute cincizeci, ca în Excelul românesc, nu 1,25.
 */
export function numarScris(text: string): number | null {
  let t = text.trim().replace(/\s/g, "");
  if (t === "") return null;
  if (t.includes(",") || /^[1-9]\d{0,2}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, "").replace(",", ".");
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** Numărul în celulă: cu virgulă, fără separator de mii, ca să se poată rescrie. */
export const numarInCelula = (n: number | null): string =>
  n === null ? "" : n.toLocaleString("ro-RO", { useGrouping: false, maximumFractionDigits: 3 });

export interface CelulaNumar {
  /** Ce face ecranul cu ea: „cant”, „pret” … */
  ed: string;
  valoare: number | null;
  /** Numele accesibil: „Cantitate, poziția 4”. */
  eticheta: string;
  /** Schimbată de om: galbenă, cu `inainte` sub mouse. */
  schimbat?: boolean;
  /** Ce era înainte, în cuvinte: „În fișierul clientului: 12”. */
  inainte?: string;
  /** Textul din celula goală: „din listă”, „fără preț”. */
  gol?: string;
  date?: Record<string, string | number>;
}

export function celulaNumar(c: CelulaNumar): string {
  const date = Object.entries(c.date ?? {}).map(([k, v]) => ` data-${k}="${esc(String(v))}"`).join("");
  const titlu = c.schimbat && c.inainte ? ` title="${esc(c.inainte)}"` : "";
  return `<input class="cel-ed${c.schimbat ? " schimbat" : ""}" data-ed="${esc(c.ed)}"${date} type="text" inputmode="decimal"
    autocomplete="off" spellcheck="false" value="${esc(numarInCelula(c.valoare))}"${c.gol ? ` placeholder="${esc(c.gol)}"` : ""}
    aria-label="${esc(c.eticheta)}"${titlu} />`;
}

/** Textul editabil pe loc (denumirea): se salvează la ieșirea din celulă. */
export function celulaText(c: { ed: string; text: string; eticheta: string; schimbat?: boolean; inainte?: string; clasa?: string;
  date?: Record<string, string | number> }): string {
  const date = Object.entries(c.date ?? {}).map(([k, v]) => ` data-${k}="${esc(String(v))}"`).join("");
  const titlu = c.schimbat && c.inainte ? ` title="${esc(c.inainte)}"` : "";
  return `<p class="cel-ed cel-text${c.clasa ? ` ${c.clasa}` : ""}${c.schimbat ? " schimbat" : ""}" data-ed="${esc(c.ed)}"${date}
    contenteditable="plaintext-only" role="textbox" spellcheck="false" aria-label="${esc(c.eticheta)}"${titlu}>${esc(c.text)}</p>`;
}

/** O țintă din pagină, regăsită după redesenare prin atributele ei `data-*`. */
function cheieTinta(gazda: HTMLElement, el: Element | null): string | null {
  if (!(el instanceof HTMLElement) || !gazda.contains(el)) return null;
  const date = Object.entries(el.dataset).map(([k, v]) =>
    `[data-${k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}="${CSS.escape(v ?? "")}"]`).join("");
  return date ? `${el.tagName.toLowerCase()}${date}` : null;
}

export interface LegareCelule {
  /**
   * Scrie valoarea celulei din care a plecat cursorul. Întoarce `true` când s-a
   * schimbat ceva de redesenat; `false` lasă pagina cum e (o celulă de text se
   * actualizează singură, pe loc).
   */
  scrie: (el: HTMLElement) => boolean;
  deseneaza: () => void;
  /** De câte ori s-a redesenat ecranul. */
  desenari: () => number;
}

/**
 * Celulele ecranului, ca în Excel: se salvează când pleacă cursorul din ele,
 * Enter coboară pe rândul următor, Escape renunță.
 *
 * Redesenarea (alt număr, alt total) făcută la apăsarea mouse-ului ar scoate
 * butonul de sub el înainte de clic. Când celula pleacă la un clic, se
 * redesenează după el, și doar dacă clicul n-a redesenat deja.
 */
export function legaCelule(gazda: HTMLElement, o: LegareCelule): void {
  let apasat: Element | null = null;
  let urmatoarea: string | null = null;
  gazda.addEventListener("pointerdown", (e) => {
    apasat = (e.target as Element).closest("button, a, input, select, [contenteditable]");
  }, true);
  // Apăsarea ține doar până ridici degetul: focusout-ul vine între cele două.
  for (const tip of ["pointerup", "pointercancel"]) gazda.addEventListener(tip, () => { apasat = null; }, true);

  gazda.addEventListener("focusin", (e) => {
    const el = e.target as HTMLElement;
    if (el.matches?.("p.cel-ed[data-ed]")) el.dataset["original"] = el.textContent ?? "";
  });
  gazda.addEventListener("keydown", (e) => {
    const el = e.target as HTMLElement;
    if (!el.matches?.(".cel-ed[data-ed]")) return;
    if (e.key === "Escape") {
      if (el instanceof HTMLInputElement) el.value = el.defaultValue;
      else el.textContent = el.dataset["original"] ?? el.textContent;
      urmatoarea = null;
      el.blur();
      return;
    }
    if (e.key !== "Enter") return;
    e.preventDefault();
    const toate = [...gazda.querySelectorAll<HTMLElement>(`.cel-ed[data-ed="${el.dataset["ed"]}"]`)];
    urmatoarea = cheieTinta(gazda, toate[toate.indexOf(el) + 1] ?? null);
    el.blur();
  });
  gazda.addEventListener("focusout", (e) => {
    const el = e.target as HTMLElement;
    if (!el.matches?.(".cel-ed[data-ed]")) return;
    const spre = urmatoarea ?? cheieTinta(gazda, (e as FocusEvent).relatedTarget as Element | null);
    const clic = apasat !== null && apasat !== el;
    urmatoarea = null;
    apasat = null;
    const mergi = (): void => { if (spre) gazda.querySelector<HTMLElement>(spre)?.focus(); };
    const input = el instanceof HTMLInputElement ? el : null;
    if (input && input.value.trim() === input.defaultValue.trim()) { mergi(); return; }
    if (!o.scrie(el)) {
      if (input) input.value = input.defaultValue;
      mergi();
      return;
    }
    if (!clic) { o.deseneaza(); mergi(); return; }
    const n = o.desenari();
    const dupa = (): void => { if (o.desenari() === n) o.deseneaza(); };
    gazda.addEventListener("click", () => setTimeout(dupa, 0), { once: true, capture: true });
    setTimeout(dupa, 1000);
  });
}
