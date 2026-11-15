/**
 * „Comandă ce lipsește”, pentru un necesar: întâi ce există în alte locuri
 * (`propuneriDinDepozit`), cu bifă, apoi ciornele pe furnizorul obișnuit, cu
 * „Alt furnizor”. Până pe 15 noiembrie 2026 stătea doar în Materiale › De
 * cumpărat (`ecrane/stoc.ts`); acum o folosește și fila Materiale a lucrării
 * (`ecrane/santier-panou.ts`), deci e un singur loc pentru amândouă.
 *
 * Aici: ce se mută și ce se comandă (`planComanda`), cum arată (`ecranComanda`)
 * și ce se scrie (`aplicaComanda`). Ecranele țin doar alegerea omului și cheamă
 * `puneComanda` pe ciornele întoarse.
 */
import { esc } from "./ecrane/tip.js";
import { cantitate, numeArticol } from "./stoc-vizual.js";
import { citestePlanuri } from "./date.js";
import { deschis, depozitNecesar, ramasPeNecesar, titluNecesar } from "./materiale.js";
import type { NecesarLucrare, StareDepozit } from "./depozit-local.js";
import type { Miscare } from "../src/stoc/registru.js";
import {
  cantitateComanda, ciorneDinRamas, propuneriDinDepozit, type Comanda, type PropunereTransfer,
} from "../src/stoc/comenzi.js";
import { FURNIZORI } from "../src/stoc/furnizori.js";
import { pretPropus } from "../src/stoc/preturi-furnizori.js";
import { denumireComanda } from "../src/stoc/produse.js";

/** Ce a ales omul: ce nu se ia din depozit și furnizorul schimbat pe o ciornă. */
export interface AlegereComanda {
  /** Id-ul necesarului. */
  id: string;
  nebifate: Set<string>;
  /** Furnizorul propus → cel ales de om. */
  furnizori: Map<string, string>;
}

export const alegereNoua = (id: string): AlegereComanda => ({ id, nebifate: new Set(), furnizori: new Map() });

export const cheiePropunere = (p: PropunereTransfer): string => `${p.articol.cheie}|${p.din}`;

/** Mutările din depozit, ca mișcări de stoc spre șantierul necesarului. */
const transferuri = (n: NecesarLucrare, alese: PropunereTransfer[], id: () => string, data: string): Miscare[] =>
  alese.map((p) => ({
    id: id(), data, tip: "transfer", articol: p.articol, cantitate: p.cantitate,
    din: p.din, spre: depozitNecesar(n), nota: `pentru ${titluNecesar(n)}`,
  }));

/**
 * Ce face „Comandă ce lipsește”, înainte să se facă: ce se ia din depozit și
 * ciornele pentru rest, pe furnizorul ales. Ciornele se socotesc după mutările
 * bifate, deci ce vine din depozit nu se mai comandă.
 */
export function planComanda(st: StareDepozit, n: NecesarLucrare, a: AlegereComanda, id: () => string): {
  propuneri: PropunereTransfer[]; alese: PropunereTransfer[]; ciorne: Comanda[]; propusi: string[];
} {
  const propuneri = propuneriDinDepozit(ramasPeNecesar(st, n), deschis());
  const alese = propuneri.filter((p) => !a.nebifate.has(cheiePropunere(p)));
  const acum = new Date().toISOString();
  const dupa = { ...st, miscari: [...st.miscari, ...transferuri(n, alese, id, acum)] };
  const firma = citestePlanuri().find((p) => p.id === n.santier)?.firma ?? "RADOIA ISOLIRUNG SRL";
  const brute = ciorneDinRamas(ramasPeNecesar(dupa, n),
    { firma, spre: depozitNecesar(n), ...(n.santier ? { santier: n.santier } : {}) }, id, acum,
    (art, f) => pretPropus(art, f, st.miscari));
  const ciorne = brute.map((c) => {
    const f = a.furnizori.get(c.furnizor);
    if (!f || f === c.furnizor) return c;
    // Alt furnizor: prețurile propuse se iau de la el, ca pe ciornă.
    return { ...c, furnizor: f, linii: c.linii.map((l) => {
      const { pret: _p, ...fara } = l;
      const p = pretPropus(l.articol, f, st.miscari);
      return p ? { ...fara, pret: p } : fara;
    }) };
  });
  return { propuneri, alese, ciorne, propusi: brute.map((c) => c.furnizor) };
}

/** Pagina „Comandă ce lipsește”; `inapoi` e textul legăturii de întoarcere. */
export function ecranComanda(
  st: StareDepozit, n: NecesarLucrare, a: AlegereComanda, numeDepozit: (id?: string) => string, inapoi: string,
): string {
  let k = 0;
  // Cardul fiecărei ciorne ține furnizorul propus, ca alegerea omului să rămână pe ea.
  const { propuneri, alese, ciorne, propusi } = planComanda(st, n, a, () => `p${++k}`);
  const pas = propuneri.length > 0 ? 2 : 1;
  const buton = alese.length > 0 && ciorne.length > 0
    ? `Mută din depozit și fă ${ciorne.length === 1 ? "comanda" : `cele ${ciorne.length} comenzi`}`
    : alese.length > 0 ? "Mută din depozit" : ciorne.length === 1 ? "Fă comanda" : `Fă cele ${ciorne.length} comenzi`;
  return `<section class="imp-card">
    <p style="margin:0 0 8px"><button type="button" class="legatura" data-act="inapoi">‹ ${esc(inapoi)}</button></p>
    <h2>Comandă ce lipsește · ${esc(titluNecesar(n))}</h2>
    <p class="hint" style="margin:0">Întâi se ia ce există în depozit, apoi se comandă restul, la furnizorul de la care cumpărați de obicei.</p>
    ${propuneri.length > 0 ? `<h3>1. Din depozit</h3>
      <div class="mat-bife">${propuneri.map((p) => `<label class="mat-bifa">
        <input type="checkbox" data-act="bifa" value="${esc(cheiePropunere(p))}"${a.nebifate.has(cheiePropunere(p)) ? "" : " checked"} />
        <span>${esc(numeArticol(p.articol))}: <strong>${cantitate(p.cantitate, p.articol.um)}</strong> din ${esc(numeDepozit(p.din))}</span>
      </label>`).join("")}</div>` : ""}
    <h3>${pas}. De comandat${ciorne.length ? `: ${ciorne.length === 1 ? "o comandă" : `${ciorne.length} comenzi`}` : ""}</h3>
    ${ciorne.length === 0 ? `<p class="hint" style="margin:0">Nimic: ce lipsește se ia din depozit.</p>` : `<div class="mat-ciorne">${ciorne.map((c, i) => {
      const cheie = propusi[i]!;
      const furnizori = [...new Set([c.furnizor, ...FURNIZORI.map(([f]) => f)])];
      return `<div class="mat-ciorna">
        <div class="mat-ciorna-cap"><strong>${esc(c.furnizor)}</strong>
          <label>Alt furnizor<select data-act="furnizor" data-propus="${esc(cheie)}">${furnizori.map((f) =>
            `<option${f === c.furnizor ? " selected" : ""}>${esc(f)}</option>`).join("")}</select></label></div>
        <ul>${c.linii.map((l) => `<li><span>${esc(denumireComanda(l.articol))}</span><strong>${esc(cantitateComanda(l))}</strong></li>`).join("")}</ul>
      </div>`;
    }).join("")}</div>
    <p class="hint">Cantitățile sunt la ambalaj întreg, cum cumpărați. Le poți schimba pe ciornă, în Comenzi, înainte s-o trimiți.</p>`}
    <div class="imp-formular-butoane">
      ${alese.length > 0 || ciorne.length > 0 ? `<button type="button" class="primar" data-act="confirma" data-id="${esc(n.id)}">${buton}</button>` : ""}
      <button type="button" class="secundar" data-act="inapoi">Renunță</button>
    </div>
  </section>`;
}

/** „Mută din depozit și fă comenzile”: starea cu mutările scrise și ciornele de pus. */
export function aplicaComanda(st: StareDepozit, n: NecesarLucrare, a: AlegereComanda, id: () => string): {
  st: StareDepozit; mutate: number; ciorne: Comanda[];
} {
  const { alese, ciorne } = planComanda(st, n, a, id);
  const dupa = alese.length > 0 ? { ...st, miscari: [...st.miscari, ...transferuri(n, alese, id, new Date().toISOString())] } : st;
  return { st: dupa, mutate: alese.length, ciorne };
}

/** O bifă sau un furnizor schimbat în pagina comenzii; `true` dacă era al ei. */
export function schimbaAlegerea(a: AlegereComanda, t: HTMLInputElement | HTMLSelectElement): boolean {
  if (t.dataset["act"] === "bifa") {
    if ((t as HTMLInputElement).checked) a.nebifate.delete(t.value); else a.nebifate.add(t.value);
    return true;
  }
  if (t.dataset["act"] === "furnizor") { a.furnizori.set(t.dataset["propus"]!, t.value); return true; }
  return false;
}
