/**
 * Istoric (21 octombrie 2026; „Cine a schimbat ce” până pe 22): jurnalul scrierilor, cele mai noi
 * întâi, câte 200, cu „Mai vechi”. Id-urile din jurnal se arată cu numele lor
 * (șantierul, comanda, cererea), când pagina le știe.
 */
import { esc, tabel, type Ecran } from "./tip.js";
import { citesteDepozit, citesteJurnal, citestePlanuri, listeaza, modDate } from "../date.js";
import type { RandJurnal } from "../../src/server/jurnal.js";

const cand = (iso: string): string => new Date(iso).toLocaleString("ro-RO", {
  day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Bucharest",
});

export const ecran: Ecran = {
  id: "jurnal",
  titlu: "Istoric",

  async render(root) {
    if (modDate() !== "server") {
      root.innerHTML = `<section class="imp-card"><p class="hint" style="margin:0">Pe linkul demo nu există jurnal: datele stau în acest browser.</p></section>`;
      return;
    }
    // Numele a ce a atins fiecare rând, din ce știe deja pagina.
    const nume = new Map<string, string>();
    for (const p of citestePlanuri()) nume.set(p.id, `șantierul ${p.denumire}`);
    const dep = citesteDepozit();
    for (const c of dep.comenzi ?? []) nume.set(c.id, `comanda ${c.furnizor}`);
    for (const n of dep.necesare) nume.set(n.id, `lista ${n.obiectiv || n.fisier}`);
    for (const c of await listeaza()) nume.set(c.id, `cererea ${c.nume}`);

    let randuri: RandJurnal[] = [];
    let maiSunt = true;
    const deseneaza = (): void => {
      root.innerHTML = randuri.length === 0
        ? `<section class="imp-card"><p class="hint" style="margin:0">Nimic scris încă.</p></section>`
        : `<section class="imp-card">${tabel(["Când", "Cine", "Ce a făcut"], randuri.map((r) => `<tr>
            <td class="fix">${esc(cand(r.cand))}</td><td>${esc(r.cine)}</td>
            <td>${esc(r.actiune)}${r.obiect ? `<br><span class="hint">${esc(nume.get(r.obiect) ?? r.obiect)}</span>` : ""}</td>
          </tr>`), ["", "", ""])}
          ${maiSunt ? `<div class="imp-formular-butoane"><button type="button" class="secundar" id="mai-vechi">Mai vechi</button></div>` : ""}</section>`;
      root.querySelector("#mai-vechi")?.addEventListener("click", () => void incarca());
    };
    const incarca = async (): Promise<void> => {
      const noi = await citesteJurnal(randuri.at(-1)?.cand);
      randuri = [...randuri, ...noi];
      maiSunt = noi.length === 200;
      deseneaza();
    };
    await incarca();
  },
};
