import type { CelulaBruta, FoaieBruta } from "../../src/import/parse-workbook.js";
import type { LinieProcesata } from "../../src/import/nucleu.js";
import { esc, eur } from "../ecrane/tip.js";
import { STARE, inteles, stareLinie } from "./text.js";

/**
 * Foaia clientului 1:1, ca in Excel.
 *
 * Nu e vederea de lucru — aia e lista de pozitii. E pentru momentul in care
 * omul vrea sa vada randul exact cum l-a trimis clientul, cu randurile de titlu
 * si coloanele lui, sau sa corecteze textul sursa. Numarul din margine e cel
 * din Excel, ca sa-l poata gasi in fisier.
 *
 * Celulele sunt editabile; corectia trece prin `scrieCelula` + `reconstruieste`
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

export function grilaFoaie(f: FoaieBruta, linii: ReadonlyMap<number, LinieProcesata>): string {
  if (f.randuri.length === 0) return `<p class="nota">Foaia „${esc(f.nume)}” e goală.</p>`;

  const capete = f.antet
    ? f.antet.celule.map((c) =>
        `<th scope="col"${c.span > 1 ? ` colspan="${c.span}"` : ""}>${esc(textCelula(c.v))}</th>`).join("")
      + umplutura(f.coloane - latime(f.antet.celule), "th")
    : Array.from({ length: f.coloane }, (_, i) => `<th scope="col" class="litera">${litera(i)}</th>`).join("");

  // Randurile de deasupra antetului (proiect, beneficiar, termen) nu impart
  // coloanele tabelului: stau deasupra lui, ca text.
  const inceput = f.antet ? f.antet.rand : 0;
  const preambul = f.randuri
    .filter((r) => r.rand < inceput)
    .map((r) => r.celule.map((c) => textCelula(c.v)).filter((t) => t.trim() !== "").join(" · "))
    .filter((t) => t !== "");

  const corp = f.randuri.filter((r) => r.rand > inceput).map((r) => {
    const l = r.linie ? linii.get(r.linie.index) : undefined;
    const celule = r.celule.map((c, i) =>
      `<td${c.span > 1 ? ` colspan="${c.span}"` : ""}><div class="camp" contenteditable="true" spellcheck="false"
        data-foaie="${esc(f.nume)}" data-rand="${r.rand}" data-cel="${i}">${esc(textCelula(c.v))}</div></td>`).join("");
    const extrase = l
      ? `<td class="extras">${esc(inteles(l.extras).join(", "))}</td>
         <td class="extras n">${l.pret ? eur(l.pret.total) : "—"}</td>
         <td class="extras fix"><span class="imp-stare" data-stare="${stareLinie(l)}">${STARE[stareLinie(l)]}</span></td>`
      : `<td class="extras"></td><td class="extras"></td><td class="extras"></td>`;
    return `<tr${l ? ` data-idx="${l.extras.index}"` : ""}><td class="gutter">${r.rand}</td>${celule}${
      umplutura(f.coloane - latime(r.celule))}${extrase}</tr>`;
  }).join("");

  return `<section class="imp-excel">
    <h3 class="imp-excel-foaie">${esc(f.nume)}</h3>
    ${preambul.length ? `<div class="preambul">${preambul.map((t) => `<span>${esc(t)}</span>`).join("")}</div>` : ""}
    <div class="tabelwrap" tabindex="0"><table>
      <thead><tr><th scope="col" class="gutter">${f.antet ? `r${f.antet.rand}` : "#"}</th>${capete}
        <th scope="col" class="extras">Am înțeles</th><th scope="col" class="extras n">Total</th><th scope="col" class="extras">Stare</th></tr></thead>
      <tbody>${corp}</tbody>
    </table></div>
  </section>`;
}
