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

/**
 * „Vată minerală 50 mm · tub ø114", „Vată minerală 50 mm · plăci, m²",
 * „Tablă aluminiu 0,8 mm · m²". Izolația cu ø e tub; fără ø se comandă pe
 * suprafață (plăci, saltele, tablă în coli sau rolă).
 */
export function numeArticol(a: { sistem: string; grosime_mm: number | null; rand: number | null }): string {
  const material = MATERIAL[a.sistem as Sistem] ?? a.sistem;
  const grosime = a.grosime_mm !== null ? ` ${cifra(a.grosime_mm)} mm` : "";
  const izolatie = a.sistem === "elastomer" || a.sistem === "vata_minerala";
  return `${material}${grosime} · ${a.rand !== null ? `tub ø${a.rand}` : izolatie ? "plăci, m²" : "m²"}`;
}

export const ADAOSURI: [number, string][] = [[0, "fără rezervă"], [0.05, "5 %"], [0.1, "10 %"]];

/**
 * Cardul din pasul „Oferta": cât material cere oferta, strat cu strat, după
 * regulile firmei, și butonul care face șantierul din ofertă.
 */
export function cardNecesar(n: Necesar): string {
  const randuri = n.materiale.map((m) => {
    const um = articolDin(m).um;
    return `<tr>
      <td>${esc(numeArticol(m))}</td>
      <td class="n"><strong>${cantitate(um === "ml" ? m.ml : m.m2, um)}</strong></td>
      <td class="n">${m.ml > 0 ? cantitate(m.ml, "ml") : "—"}</td>
      <td class="n">${m.bucati > 0 ? `${cifra(m.bucati)} buc.` : "—"}</td>
    </tr>`;
  });
  const fara = n.faraNecesar.length;
  return `<section class="imp-card" id="necesar">
    <h2>Materiale de comandat</h2>
    <p class="hint">Doar pozițiile care intră în ofertă. Până la 3 țoli (ø90) se comandă tuburi, pe diametru și grosime. Peste 3 țoli, plăci pe m²:
      (ø + 2 × grosime) / 1000 × 3,14, rotunjit la două zecimale, × metrii de țeavă. Coturile și teurile peste 3 țoli
      intră în m²: dintr-un metru se fac 3 piese la ø114–140, 2 la ø159–168, una de la ø219 (de confirmat). Tabla, pe m².</p>
    <div class="imp-campuri">
      <label>Rezervă peste calcul (lista de prețuri include manopera; comandăm cât trebuie, ca să nu rămână pe stoc)
        <select id="adaos-necesar">${ADAOSURI.map(([v, t]) =>
          `<option value="${v}"${v === n.adaos ? " selected" : ""}>${t}</option>`).join("")}</select>
      </label>
    </div>
    ${n.materiale.length
      ? tabel(["Material", "Se comandă", "Metri de țeavă", "Piese"], randuri, ["", "n", "n", "n"])
      : `<p class="nota">Nicio poziție cu preț din liste: nu e nimic de calculat.</p>`}
    ${fara > 0 ? `<p class="hint">${fara === 1 ? "O poziție nu are" : `${fara} poziții nu au`} necesar calculat
      (fără preț, preț pus de mână sau închideri la foc).</p>` : ""}
    <p class="hint">„Creează șantierul” face planul de șantier din ofertă (pozițiile, cantitățile și prețurile de mai sus,
      cu ajustarea și discountul din formular), iar materialele merg la depozit, pe șantierul nou. Pe plan se fac
      situațiile de lucrări.</p>
    <div class="imp-formular-butoane">
      <button type="button" class="primar" data-act="creeaza-santier">Creează șantierul</button>
    </div>
  </section>`;
}
