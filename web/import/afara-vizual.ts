/**
 * Fila „Lăsate afară · N” de la verificare (planul UX, Faza 6, punctul 3):
 * rândurile cu UM și cantitate care nu sunt poziții (`lasateAfara`), fiecare
 * cu „E izolație”. Marcaj pur; tabelul comun (`tabel()`), card pe telefon.
 */
import type { LasatAfara } from "../../src/import/lasate-afara.js";
import { esc, tabel } from "../ecrane/tip.js";

const DE_CE: Record<NonNullable<LasatAfara["motiv"]>, string> = {
  preizolat: "vine izolat de la producător",
  scos: "scos de tine din ofertă",
};

export function listaAfara(randuri: readonly LasatAfara[], cuFoaie: boolean): string {
  if (randuri.length === 0) {
    return `<section class="imp-card"><p class="imp-gol">Niciun rând cu cantitate n-a rămas afară.</p></section>`;
  }
  const linii = randuri.map((r) => `<tr data-idx="${r.index}">
    <td>${cuFoaie ? `${esc(r.foaie)} · ` : ""}${r.rand}</td>
    <td>${esc(r.text)}${r.motiv ? `<br><span class="hint">${DE_CE[r.motiv]}</span>` : ""}</td>
    <td>${esc(r.um)}</td>
    <td class="n">${r.cantitate.toLocaleString("ro-RO", { maximumFractionDigits: 3 })}</td>
    <td class="fix"><button type="button" class="secundar" data-act="e-izolatie" data-idx="${r.index}">E izolație</button></td>
  </tr>`);
  return `<section class="imp-card" aria-label="Lăsate afară">
    <p class="hint">Rânduri cu unitate de măsură și cantitate care nu au intrat în ofertă. Dacă unul e izolație, apasă „E izolație”: trece la verificare, unde alegi materialul și grosimea.</p>
    ${tabel(["Rând", "Descrierea clientului", "UM", "Cantitate", ""], linii, ["", "", "", "n", "fix"], false)}
  </section>`;
}
