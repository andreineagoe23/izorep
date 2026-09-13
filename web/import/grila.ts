import type { CelulaBruta, FoaieBruta } from "../../src/import/parse-workbook.js";
import type { LinieProcesata } from "../../src/import/nucleu.js";
import { esc, eur } from "../ecrane/tip.js";
import { inteles, stareLinie } from "./text.js";
import { actiuniPozitie, editorPozitie, starePozitie } from "./vizual.js";

/**
 * Foaia clientului ca in Excel — vederea implicita a verificarii.
 *
 * E forma pe care o cunoaste oricine a primit o lista de cantitati: aceleasi
 * randuri, aceleasi coloane, acelasi numar de rand ca in fisier. Dupa
 * coloanele clientului vin ale noastre — ce am inteles, pretul, starea si
 * butonul care rezolva randul — iar filtrele de deasupra ascund randurile care
 * nu se potrivesc, fara sa schimbe numerotarea.
 *
 * Celulele sunt editabile; corectura trece prin `scrieCelula` + `reconstruieste`
 * in ecran, deci reextrage si retarifeaza randul.
 */

const ISO = /^(\d{4})-(\d{2})-(\d{2})T[\d:.]+Z$/;

/**
 * Valoarea unei celule, cum o vede omul in Excel: numerele fara cifrele de
 * rotunjire ale lui ExcelJS (8084.330000000001), datele ca `04.09.2026`.
 */
export const textCelula = (v: string | number | null): string => {
  if (v === null) return "";
  if (typeof v === "number") return String(Number(v.toPrecision(12)));
  const d = ISO.exec(v);
  return d ? `${d[3]}.${d[2]}.${d[1]}` : v;
};

/** A, B, … Z, AA — antetul de rezerva, pentru foile fara rand de antet. */
function litera(i: number): string {
  let s = "";
  for (let n = i; n >= 0; n = Math.floor(n / 26) - 1) s = String.fromCharCode(65 + (n % 26)) + s;
  return s;
}

const latime = (celule: CelulaBruta[]): number => celule.reduce((s, c) => s + c.span, 0);
const umplutura = (n: number, tag = "td"): string => (n > 0 ? `<${tag}></${tag}>`.repeat(n) : "");

/* ------------------------------------------------------ antetul documentului */

export interface AntetDocument {
  titlu: string | null;
  /** Randurile fara eticheta: numarul ofertei, persoana de contact. */
  linii: string[];
  /** Perechile eticheta–valoare: „Beneficiar : …", „Nume proiect | …". */
  date: [string, string][];
}

const ETICHETA_VALOARE = /^([^:]{2,40}?)\s*:\s*(.+)$/;

/** Majoritar majuscule: asa se scrie titlul unei oferte („OFERTA LUCRARI…"). */
function eTitlu(s: string): boolean {
  const litere = s.replace(/[^A-Za-zĂÂÎȘȚŞŢăâîșțşţ]/g, "");
  if (litere.length < 6) return false;
  return litere.replace(/[^A-ZĂÂÎȘȚŞŢ]/g, "").length / litere.length >= 0.7;
}

/**
 * Randurile de deasupra tabelului, asezate ca antet de document.
 *
 * Randate ca atare ieseau sase randuri lipite una sub alta, cu titlul, numarul
 * si beneficiarul la aceeasi greutate. Aici se despart: cea mai lunga linie
 * scrisa cu majuscule e titlul; un rand cu doua celule, sau cu „eticheta :
 * valoare" intr-una, e o pereche; restul sunt linii de detaliu.
 */
export function antetDocument(randuri: string[][]): AntetDocument {
  const simple: string[] = [];
  const date: [string, string][] = [];
  for (const celule of randuri) {
    const c = celule.map((x) => x.trim()).filter((x) => x !== "");
    if (c.length === 0) continue;
    if (c.length === 2) { date.push([c[0]!.replace(/\s*:\s*$/, ""), c[1]!]); continue; }
    const kv = c.length === 1 ? ETICHETA_VALOARE.exec(c[0]!) : null;
    if (kv) { date.push([kv[1]!.trim(), kv[2]!.trim()]); continue; }
    simple.push(c.join(" · "));
  }
  let iTitlu = -1;
  simple.forEach((s, i) => {
    if (eTitlu(s) && (iTitlu < 0 || s.length > simple[iTitlu]!.length)) iTitlu = i;
  });
  return {
    titlu: iTitlu >= 0 ? simple[iTitlu]! : null,
    linii: simple.filter((_, i) => i !== iTitlu),
    date,
  };
}

function antetHtml(a: AntetDocument, foaie: string | null): string {
  if (!foaie && !a.titlu && a.linii.length === 0 && a.date.length === 0) return "";
  return `<header class="imp-doc">
    ${foaie ? `<p class="imp-doc-foaie">Foaia „${esc(foaie)}”</p>` : ""}
    ${a.titlu ? `<h3 class="imp-doc-titlu">${esc(a.titlu)}</h3>` : ""}
    ${a.linii.length ? `<p class="imp-doc-linii">${a.linii.map((l) => `<span>${esc(l)}</span>`).join("")}</p>` : ""}
    ${a.date.length ? `<dl class="imp-doc-date">${a.date.map(([k, v]) =>
      `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>` : ""}
  </header>`;
}

/* ------------------------------------------------------------------ tabelul */

export interface OptiuniGrila {
  /** Indecsii pozitiilor care trec de filtre; `null` = tot fisierul, cu titluri si note. */
  vizibile: ReadonlySet<number> | null;
  editIdx: number | null;
  propunere: (l: LinieProcesata) => number | null;
  /** Numele foii se scrie doar cand registrul are mai multe. */
  cuNumeFoaie: boolean;
}

/** Coloanele noastre de pe randul unei pozitii. Ecranul le reface pe loc dupa o corectura de celula. */
export function celuleExtrase(l: LinieProcesata, o: Pick<OptiuniGrila, "editIdx" | "propunere">): string {
  const p = l.pret;
  return `<td class="extras">${inteles(l.extras).map((e) => `<span class="imp-eticheta">${esc(e)}</span>`).join("")}</td>
    <td class="extras n">${p ? `<strong>${eur(p.total)}</strong><small>${eur(p.pret_unitar)} / ${esc(l.bruta.um ?? "buc")}</small>` : "—"}</td>
    <td class="extras imp-grila-stare">${starePozitie(l)}</td>
    <td class="extras imp-grila-actiuni">${actiuniPozitie(l, o.propunere(l), o.editIdx === l.extras.index)}</td>`;
}

/** Foaia, sau sirul gol cand filtrele n-au lasat niciun rand pe ea. */
export function grilaFoaie(f: FoaieBruta, linii: ReadonlyMap<number, LinieProcesata>, o: OptiuniGrila): string {
  const inceput = f.antet ? f.antet.rand : 0;
  const pozitie = (idx: number | undefined): LinieProcesata | undefined => {
    const l = idx === undefined ? undefined : linii.get(idx);
    return l && l.extras.sistem !== null ? l : undefined;
  };

  const randuri = f.randuri.filter((r) => r.rand > inceput).filter((r) =>
    o.vizibile === null || (r.linie !== undefined && o.vizibile.has(r.linie.index) && pozitie(r.linie.index) !== undefined));
  if (randuri.length === 0 && o.vizibile !== null) return "";

  const capete = f.antet
    ? f.antet.celule.map((c) =>
        `<th scope="col"${c.span > 1 ? ` colspan="${c.span}"` : ""}>${esc(textCelula(c.v))}</th>`).join("")
      + umplutura(f.coloane - latime(f.antet.celule), "th")
    : Array.from({ length: f.coloane }, (_, i) => `<th scope="col" class="litera">${litera(i)}</th>`).join("");

  const antet = antetDocument(f.randuri.filter((r) => r.rand < inceput).map((r) => r.celule.map((c) => textCelula(c.v))));

  // Coloanele cu descrieri: cele in care MAJORITATEA pozitiilor au text lung.
  // Decis pe o singura celula, o nota de subsol sau un rand de total intindea
  // coloane care altfel tin „IZOLATII" sau „buc".
  const coloana = (celule: CelulaBruta[], i: number): number => celule.slice(0, i).reduce((s, c) => s + c.span, 0);
  const randuriPozitii = f.randuri.filter((r) => r.rand > inceput && r.linie !== undefined);
  const lungiPe = new Map<number, number>();
  for (const r of randuriPozitii) {
    r.celule.forEach((c, i) => {
      if (c.span === 1 && textCelula(c.v).length > 40) lungiPe.set(coloana(r.celule, i), (lungiPe.get(coloana(r.celule, i)) ?? 0) + 1);
    });
  }
  const coloaneLungi = new Set([...lungiPe].filter(([, n]) => n * 2 >= randuriPozitii.length).map(([k]) => k));

  const corp = randuri.map((r) => {
    const l = pozitie(r.linie?.index);
    const celule = r.celule.map((c, i) => {
      const text = textCelula(c.v);
      return `<td${c.span > 1 ? ` colspan="${c.span}"` : ""}><div class="camp${c.span === 1 && coloaneLungi.has(coloana(r.celule, i)) ? " lung" : ""}"
        contenteditable="true" spellcheck="false" data-foaie="${esc(f.nume)}" data-rand="${r.rand}" data-cel="${i}">${esc(text)}</div></td>`;
    }).join("");
    const extrase = l ? celuleExtrase(l, o) : `<td class="extras"></td>`.repeat(4);
    const rand = `<tr${l ? ` data-idx="${l.extras.index}" data-stare="${stareLinie(l)}"` : ""}><td class="gutter">${r.rand}</td>${
      celule}${umplutura(f.coloane - latime(r.celule))}${extrase}</tr>`;
    const editor = l && o.editIdx === l.extras.index
      ? `<tr class="imp-grila-editor"><td colspan="${f.coloane + 5}">${editorPozitie(l)}</td></tr>`
      : "";
    return rand + editor;
  }).join("");

  return `<section class="imp-card imp-excel">
    ${antetHtml(antet, o.cuNumeFoaie ? f.nume : null)}
    <div class="tabelwrap" tabindex="0"><table>
      <thead><tr><th scope="col" class="gutter">${f.antet ? `r${f.antet.rand}` : "#"}</th>${capete}
        <th scope="col" class="extras">Am înțeles</th><th scope="col" class="extras n">Preț</th>
        <th scope="col" class="extras">Stare</th><th scope="col" class="extras"><span class="doar-citit">Acțiuni</span></th></tr></thead>
      <tbody>${corp}</tbody>
    </table></div>
  </section>`;
}
