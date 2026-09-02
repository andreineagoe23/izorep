/** Contractul pe care il respecta fiecare ecran. */
export interface Ecran {
  id: string;
  titlu: string;
  subtitlu?: string;
  /** Deseneaza ecranul in `root`. Root-ul e gol la apel. */
  render(root: HTMLElement): void | Promise<void>;
}

/* ------------------------------------------------------------- utilitare */

export const eur = (n: number): string =>
  n.toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";

export const nr = (n: number, zecimale = 0): string =>
  n.toLocaleString("ro-RO", { minimumFractionDigits: zecimale, maximumFractionDigits: zecimale });

export const data = (iso: string): string =>
  new Date(iso).toLocaleDateString("ro-RO", { day: "numeric", month: "long", year: "numeric" });

/** Escapare obligatorie pentru orice text care ajunge in innerHTML. */
export const esc = (s: string): string =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

/** Card cu titlu si continut. */
export const card = (titlu: string, continut: string, clasa = ""): string =>
  `<section class="card ${clasa}"><h2>${esc(titlu)}</h2>${continut}</section>`;

/** Indicator numeric mare pentru tabloul de bord. */
export const indicator = (valoare: string, eticheta: string, detaliu = ""): string =>
  `<div class="stat"><b>${esc(valoare)}</b><span>${esc(eticheta)}</span>${
    detaliu ? `<em>${esc(detaliu)}</em>` : ""
  }</div>`;

/** Bara de progres, 0..100. */
export const progres = (p: number): string =>
  `<div class="progres" role="img" aria-label="${p}%"><i style="width:${Math.max(0, Math.min(100, p))}%"></i></div>`;

/** Eticheta colorata de stare. */
export const stare = (text: string, ton: "ok" | "atentie" | "neutru" = "neutru"): string =>
  `<span class="eticheta ton-${ton}">${esc(text)}</span>`;

/** Tabel generic. `randuri` contine deja HTML de celule. */
export const tabel = (capete: string[], randuri: string[], clase: string[] = []): string => `
  <div class="tabelwrap">
    <table>
      <thead><tr>${capete.map((c, i) => `<th class="${clase[i] ?? ""}">${esc(c)}</th>`).join("")}</tr></thead>
      <tbody>${randuri.join("")}</tbody>
    </table>
  </div>`;

/** Nota explicativa sub un ecran. Aici se explica REGULA de business. */
export const nota = (text: string): string => `<p class="nota">${text}</p>`;
