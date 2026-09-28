/**
 * Marcajul stocului, ca functii pure: numele articolelor, cantitatile si
 * cardul „Materiale necesare" din pasul „Oferta" al importului. Ca
 * `web/import/vizual.ts`: fara DOM, testat in Node, orice text din date trece
 * prin `esc()`.
 */
import { esc, tabel } from "./ecrane/tip.js";
import { MATERIAL } from "./import/text.js";
import type { Sistem } from "../src/pricing/types.js";
import type { Necesar } from "../src/stoc/necesar.js";
import { articolDin, type UM } from "../src/stoc/registru.js";

/** 50 → „50", 0.8 → „0,8", 12.345 → „12,35". */
export const cifra = (n: number): string => n.toLocaleString("ro-RO", { maximumFractionDigits: 2 });

export const unitate = (um: UM): string => (um === "ml" ? "ml" : "m²");

export const cantitate = (n: number, um: UM): string => `${cifra(n)} ${unitate(um)}`;

/** „Vată minerală 50 mm · ø114", „Tablă aluminiu 0,8 mm · ø220", „Vată minerală 50 mm · pe suprafață". */
export function numeArticol(a: { sistem: string; grosime_mm: number | null; rand: number | null }): string {
  const material = MATERIAL[a.sistem as Sistem] ?? a.sistem;
  const grosime = a.grosime_mm !== null ? ` ${cifra(a.grosime_mm)} mm` : "";
  return `${material}${grosime} · ${a.rand !== null ? `ø${a.rand}` : "pe suprafață"}`;
}

export const ADAOSURI: [number, string][] = [[0, "fără adaos"], [0.05, "5 %"], [0.1, "10 %"]];

/**
 * Cardul din pasul „Oferta": cat material cere oferta, strat cu strat, si
 * butonul care il trimite la depozit ca necesar al lucrarii.
 */
export function cardNecesar(n: Necesar): string {
  const randuri = n.materiale.map((m) => {
    const um = articolDin(m).um;
    return `<tr>
      <td>${esc(numeArticol(m))}</td>
      <td class="n">${um === "ml" && m.ml > 0 ? cantitate(m.ml, "ml") : "—"}</td>
      <td class="n">${m.m2 > 0 ? cantitate(m.m2, "m2") : "—"}</td>
      <td class="n">${m.bucati > 0 ? `${cifra(m.bucati)} buc.` : "—"}</td>
    </tr>`;
  });
  const fara = n.faraNecesar.length;
  return `<section class="imp-card" id="necesar">
    <h2>Materiale necesare</h2>
    <p class="hint" title="Suprafața pe metru: π × (φ + 2 × grosime) / 1000, formula din registrul firmei.">Calculat
      din pozițiile cu preț, strat cu strat, după formula firmei. Coturile, teurile, flanșele și casetele se
      numără în bucăți.</p>
    <div class="imp-campuri">
      <label>Adaos pentru coturi și fitinguri (registrul firmei: 5–10 %)
        <select id="adaos-necesar">${ADAOSURI.map(([v, t]) =>
          `<option value="${v}"${v === n.adaos ? " selected" : ""}>${t}</option>`).join("")}</select>
      </label>
    </div>
    ${n.materiale.length
      ? tabel(["Material", "Metri liniari", "Suprafață", "Piese"], randuri, ["", "n", "n", "n"])
      : `<p class="nota">Nicio poziție cu preț din liste: nu e nimic de calculat.</p>`}
    ${fara > 0 ? `<p class="hint">${fara === 1 ? "O poziție nu are" : `${fara} poziții nu au`} necesar calculat
      (fără preț, preț pus de mână sau închideri la foc).</p>` : ""}
    ${n.materiale.length ? `<div class="imp-formular-butoane">
      <button type="button" class="primar" data-act="trimite-depozit">Trimite la depozit</button>
    </div>` : ""}
  </section>`;
}
