/**
 * Marcajul consumului (Faza 6), ca functii pure: cardul „Materialul pe
 * șantier” din Lucrări si randurile pentru „Necesită atenția ta” din tabloul de
 * bord. Ca `stoc-vizual.ts`: fara DOM, orice text din date trece prin `esc()`.
 * Logica e in `src/stoc/consum.ts`.
 */
import { esc, stare, tabel } from "./ecrane/tip.js";
import { cantitate, cifra, numeArticol } from "./stoc-vizual.js";
import type { PlanSantier } from "../src/lucrari/situatii.js";
import type { StareDepozit } from "./depozit-local.js";
import { PRAG_PIERDERE, consumSantier, type ConsumMaterial, type ConsumSantier } from "../src/stoc/consum.js";

const PRAG = PRAG_PIERDERE * 100;

/** Consumul unui șantier, din necesarul lui (dacă are) și din mișcări. */
export const consumPlan = (p: PlanSantier, s: StareDepozit): ConsumSantier =>
  consumSantier(p, s.necesare.find((n) => n.santier === p.id)?.materiale ?? [], s.miscari);

function celulaPierdere(m: ConsumMaterial): string {
  if (m.pierdereProcent === null) return m.consumReal > 0 ? `<span class="hint">fără situații</span>` : "—";
  const semn = m.pierdere > 0 ? "+" : m.pierdere < 0 ? "−" : "";
  return `${semn}${cantitate(Math.abs(m.pierdere), m.um)}<br><span class="hint">${cifra(m.pierdereProcent)} %</span>${
    m.pierdereProcent > PRAG ? ` ${stare(`peste ${cifra(PRAG)} %`, "atentie")}` : ""}`;
}

/**
 * Cardul din Lucrări: ce a venit pe șantier, ce s-a întors, ce a rămas, cât
 * arată situațiile și cât s-a consumat de fapt. Dedesubt, consumul notat de
 * mână (S7 b), pliat.
 */
export function cardConsum(c: ConsumSantier): string {
  const randuri = c.materiale.map((m) => `<tr>
    <td>${esc(numeArticol(m.articol))}</td>
    <td class="n">${m.necesar > 0 ? cantitate(m.necesar, m.um) : "—"}</td>
    <td class="n">${cantitate(m.trimis, m.um)}</td>
    <td class="n">${m.returnat ? cantitate(m.returnat, m.um) : "—"}</td>
    <td class="n"><strong>${cantitate(m.ramas, m.um)}</strong></td>
    <td class="n">${cantitate(m.consumCalculat, m.um)}</td>
    <td class="n">${cantitate(m.consumReal, m.um)}${m.consumScris.mana
      ? `<br><span class="hint">${cantitate(m.consumScris.mana, m.um)} notat de mână</span>` : ""}</td>
    <td class="n">${celulaPierdere(m)}</td>
  </tr>`);
  const total = c.pierdereProcent === null
    ? (c.situatii === 0 ? `Consumul se scrie la prima situație de lucrări.` : "")
    : `Pierdere pe tot șantierul, după valoarea materialului: <strong>${cifra(c.pierdereProcent)} %</strong>
      (normal până la ${cifra(PRAG)} %)${c.pestePrag ? ` ${stare("peste prag", "atentie")}` : ""}.`;
  const optiuni = c.materiale.map((m) => `<option value="${esc(m.cheie)}">${esc(numeArticol(m.articol))}</option>`).join("");
  return `<section class="imp-card"><h2>Materialul pe șantier</h2>
    <p class="hint" style="margin:0 0 12px">La fiecare situație, consumul se scrie singur: cât s-a executat × materialul
      poziției, cu pierderea la croit din necesar. Consumul real e ce a plecat spre șantier, minus ce s-a întors,
      minus ce a rămas; diferența față de situații e pierderea.</p>
    ${total ? `<p style="margin:0 0 12px">${total}</p>` : ""}
    ${c.materiale.length
      ? tabel(["Material", "Necesar", "Venit", "Întors", "Rămas", "Din situații", "Consum real", "Pierdere"], randuri,
        ["", "n", "n", "n", "n", "n", "n", "n"])
      : `<p class="hint" style="margin:0 0 12px">Niciun material pe șantier încă.</p>`}
    ${c.materiale.length ? `<details class="imp-card">
      <summary>Notează consum de mână</summary>
      <p class="hint" style="margin:0 0 12px">Ce s-a pus în plus față de situații, sau un material care nu e pe nicio
        poziție din ofertă. Iese din stocul șantierului.</p>
      <form class="imp-campuri" id="consum-mana">
        <label>Material<select name="cheie">${optiuni}</select></label>
        <label>Cantitate (ml la tub, m² altfel)<input name="cantitate" type="number" inputmode="decimal" step="any" min="0" required /></label>
        <label>Notă (cine, unde)<input name="nota" autocomplete="off" /></label>
        <div class="imp-formular-butoane"><button type="submit" class="secundar">Scrie consumul</button></div>
      </form>
    </details>` : ""}
  </section>`;
}

/** Șantierele cu pierderea peste prag, pentru „Necesită atenția ta”. */
export function santiereCuPierdere(planuri: readonly PlanSantier[], s: StareDepozit): { plan: PlanSantier; procent: number }[] {
  return planuri.flatMap((p) => {
    const c = consumPlan(p, s);
    return c.pestePrag && c.pierdereProcent !== null ? [{ plan: p, procent: c.pierdereProcent }] : [];
  });
}

/** Rândul din tabloul de bord. */
export const textPierdere = (x: { plan: PlanSantier; procent: number }): string =>
  `Pe șantierul <b>${esc(x.plan.denumire)}</b> s-a consumat cu <b>${cifra(x.procent)} %</b> mai mult material decât
  arată situațiile (normal până la ${cifra(PRAG)} %).`;
