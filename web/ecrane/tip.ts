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

/** Data in coloana de tabel: forma lunga rupe randul pe doua-trei linii. */
export const dataScurta = (iso: string): string =>
  new Date(iso).toLocaleDateString("ro-RO", { day: "2-digit", month: "2-digit", year: "numeric" });

/** Escapare obligatorie pentru orice text care ajunge in innerHTML. */
export const esc = (s: string): string =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

/** Card cu titlu si continut. */
export const card = (titlu: string, continut: string, clasa = ""): string =>
  `<section class="card ${clasa}"><h2>${esc(titlu)}</h2>${continut}</section>`;

/** Indicator numeric mare. Se pune intr-un container `.stats`. */
export const indicator = (valoare: string, eticheta: string, detaliu = ""): string =>
  `<div class="stat"><b>${esc(valoare)}</b><span>${esc(eticheta)}</span>${
    detaliu ? `<em>${esc(detaliu)}</em>` : ""
  }</div>`;

/**
 * Bara de progres, 0..100, cu valoarea scrisa alaturi: o bara goala si una
 * lipsa arata identic, iar 0% e o informatie, nu absenta ei.
 */
export const progres = (p: number): string => {
  const v = Math.max(0, Math.min(100, p));
  return `<div class="progres-rand"><div class="progres" aria-hidden="true"><i style="width:${v}%"></i></div>
    <span class="progres-val">${v}%</span></div>`;
};

/** Eticheta colorata de stare. */
export const stare = (text: string, ton: "ok" | "atentie" | "neutru" = "neutru"): string =>
  `<span class="eticheta ton-${ton}">${esc(text)}</span>`;

/**
 * Tabel generic. `randuri` contine deja HTML de celule.
 *
 * `scope="col"` nu e decorativ: fara el, un cititor de ecran nu leaga celula de
 * antetul ei, iar tabelele astea au 8-10 coloane. `tabindex="0"` face zona
 * derulabila accesibila de la tastatura — altfel coloanele din dreapta sunt
 * inaccesibile fara mouse pe ecran ingust.
 */
export const tabel = (capete: string[], randuri: string[], clase: string[] = []): string => `
  <div class="tabelwrap" tabindex="0">
    <table>
      <thead><tr>${capete
        .map((c, i) => `<th scope="col" class="${clase[i] ?? ""}">${esc(c)}</th>`)
        .join("")}</tr></thead>
      <tbody>${randuri.join("")}</tbody>
    </table>
  </div>`;

/** Nota explicativa sub un ecran. Aici se explica REGULA de business. */
export const nota = (text: string): string => `<p class="nota">${text}</p>`;

/**
 * Linie din lista "necesita atentia ta". Nu foloseste `.alerta`: rosul e
 * rezervat erorilor reale (o pozitie care nu se poate tarifa), nu unei oferte
 * care asteapta raspuns. `text` contine deja HTML escapat de apelant.
 */
export const atentionare = (href: string, text: string): string =>
  `<a class="atentionare" href="${href}">${text}</a>`;
