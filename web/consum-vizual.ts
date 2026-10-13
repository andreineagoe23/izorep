/**
 * Marcajul consumului (Faza 6), ca functii pure: pierderea si consumul de mana,
 * puse in cardul „Materialul șantierului” din Lucrări (`cardMaterial`, Faza 7).
 * Ca `stoc-vizual.ts`: fara DOM, orice text din date trece prin `esc()`. Logica
 * e in `src/stoc/consum.ts`.
 */
import { esc, stare } from "./ecrane/tip.js";
import { cantitate, cifra, numeArticol } from "./stoc-vizual.js";
import type { PlanSantier } from "../src/lucrari/situatii.js";
import type { StareDepozit } from "./depozit-local.js";
import { PRAG_PIERDERE, consumSantier, type ConsumMaterial, type ConsumSantier } from "../src/stoc/consum.js";

const PRAG = PRAG_PIERDERE * 100;

/** Consumul unui șantier, din necesarul lui (dacă are) și din mișcări. */
export const consumPlan = (p: PlanSantier, s: StareDepozit): ConsumSantier =>
  consumSantier(p, s.necesare.find((n) => n.santier === p.id)?.materiale ?? [], s.miscari);

export function celulaPierdere(m: ConsumMaterial): string {
  if (m.pierdereProcent === null) return m.consumReal > 0 ? `<span class="hint">fără situații</span>` : "—";
  const semn = m.pierdere > 0 ? "+" : m.pierdere < 0 ? "−" : "";
  return `${semn}${cantitate(Math.abs(m.pierdere), m.um)}<br><span class="hint">${cifra(m.pierdereProcent)} %</span>${
    m.pierdereProcent > PRAG ? ` ${stare(`peste ${cifra(PRAG)} %`, "atentie")}` : ""}`;
}

/** Pierderea pe tot șantierul, deasupra tabelului; fără situații, ce urmează. */
export function randPierdere(c: ConsumSantier): string {
  const total = c.pierdereProcent === null
    ? (c.situatii === 0 ? `Consumul se scrie singur la fiecare situație de lucrări: cât s-a executat × materialul poziției.` : "")
    : `Pierdere pe tot șantierul, după valoarea materialului: <strong>${cifra(c.pierdereProcent)} %</strong>
      (normal până la ${cifra(PRAG)} %)${c.pestePrag ? ` ${stare("peste prag", "atentie")}` : ""}.`;
  return total ? `<p class="hint" style="margin:0 0 12px">${total}</p>` : "";
}

/** Consumul notat de mână (S7 b), pliat sub tabelul materialului. */
export function formularConsumMana(c: ConsumSantier): string {
  if (c.materiale.length === 0) return "";
  const optiuni = c.materiale.map((m) => `<option value="${esc(m.cheie)}">${esc(numeArticol(m.articol))}</option>`).join("");
  return `<details class="imp-card">
      <summary>Notează consum de mână</summary>
      <p class="hint" style="margin:0 0 12px">Ce s-a pus în plus față de situații, sau un material care nu e pe nicio
        poziție din ofertă. Iese din stocul șantierului.</p>
      <form class="imp-campuri" id="consum-mana">
        <label>Material<select name="cheie">${optiuni}</select></label>
        <label>Cantitate (ml la tub, m² altfel)<input name="cantitate" type="number" inputmode="decimal" step="any" min="0" required /></label>
        <label>Notă (cine, unde)<input name="nota" autocomplete="off" /></label>
        <div class="imp-formular-butoane"><button type="submit" class="secundar">Scrie consumul</button></div>
      </form>
    </details>`;
}
