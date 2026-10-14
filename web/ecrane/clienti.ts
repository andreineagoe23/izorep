import type { Ecran } from "./tip.js";
import { esc, eur, nota, nr, stare, tabel } from "./tip.js";
import type { Categorie, TipClient } from "../date/seed.js";
import { exemple, type Exemple } from "../date/exemple.js";
import { citesteOferte, citestePlanuri } from "../date.js";
import { vedeCosturi } from "../nav.js";
import type { OfertaEmisa } from "../oferte-local.js";
import type { PlanSantier } from "../../src/lucrari/situatii.js";

/**
 * Clienții sunt beneficiarii de pe antetul ofertelor salvate, cu ofertele și
 * șantierele lor (13 octombrie 2026). Până atunci ecranul arăta doar clienții
 * de exemplu din `seed.ts`, și pe server. Un client nu se scrie separat: apare
 * la prima ofertă descărcată pentru el.
 */
interface ClientDinOferte {
  denumire: string;
  oferte: OfertaEmisa[];
  santiere: PlanSantier[];
}

const cheie = (nume: string): string => nume.trim().replace(/\s+/g, " ").toLocaleLowerCase("ro-RO");

export function clientiDinOferte(oferte: OfertaEmisa[], planuri: PlanSantier[]): ClientDinOferte[] {
  const dupa = new Map<string, ClientDinOferte>();
  const al = (nume: string): ClientDinOferte | null => {
    if (!nume.trim()) return null;
    const k = cheie(nume);
    let c = dupa.get(k);
    if (!c) dupa.set(k, (c = { denumire: nume.trim(), oferte: [], santiere: [] }));
    return c;
  };
  for (const o of oferte) al(o.client)?.oferte.push(o);
  for (const p of planuri) al(p.client)?.santiere.push(p);
  const ultima = (c: ClientDinOferte): string => c.oferte.map((o) => o.cand).sort().at(-1) ?? "";
  return [...dupa.values()].sort((a, b) => ultima(b).localeCompare(ultima(a)) || a.denumire.localeCompare(b.denumire, "ro"));
}

function clientiReali(): string {
  const clienti = clientiDinOferte(Object.values(citesteOferte()), citestePlanuri());
  if (clienti.length === 0) {
    return `<p class="hint" style="margin:0">Niciun client încă. Un client apare aici după ce descarci prima ofertă
      pentru el, din <a href="#/import">Import Excel</a>: e beneficiarul scris pe antetul ofertei.</p>`;
  }
  const bani = vedeCosturi();
  const randuri = clienti.map((c) => `<tr>
    <td><strong>${esc(c.denumire)}</strong></td>
    <td>${c.oferte.length ? c.oferte.map((o) => `${esc(o.numar || "fără număr")}${o.obiectiv ? ` <span class="hint">${esc(o.obiectiv)}</span>` : ""}`).join("<br>") : "—"}</td>
    ${bani ? `<td class="n">${eur(c.oferte.reduce((s, o) => s + o.valoare, 0))}</td>` : ""}
    <td>${c.santiere.length ? c.santiere.map((p) => `${esc(p.denumire)}${p.inchis ? ` ${stare("închis", "ok")}` : ""}`).join("<br>") : "—"}</td>
  </tr>`);
  return tabel(["Client", "Oferte", ...(bani ? ["Valoare ofertată"] : []), "Șantiere"], randuri, ["", "", ...(bani ? ["n"] : []), ""]);
}

const CATEGORIE: Record<Categorie, string> = {
  rezidential: "Rezidențial",
  industrial: "Industrial",
  rafinarie: "Rafinărie",
};

const TIP_CLIENT: Record<TipClient, string> = {
  antreprenor_general: "Antreprenor general",
  beneficiar_final: "Beneficiar final",
  dezvoltator: "Dezvoltator",
};

/** Clienții din fișierele firmei: exemple, doar pe linkul demo. */
function clientiExemplu(ex: Exemple): string {
  // O coloana goala pe toti clientii (CUI-urile nu se inventeaza, termenul nu e
  // scris nicaieri) doar ocupa loc: nu se deseneaza.
  const cuCui = ex.CLIENTI.some((c) => c.cui);
  const cuTermen = ex.CLIENTI.some((c) => c.termenPlataZile !== null);
  const randuri = ex.CLIENTI.map((c) => {
    const nrLucrari = ex.LUCRARI.filter((l) => l.clientId === c.id).length;
    const nrDocumente = ex.DOCUMENTE.filter((d) => d.clientId === c.id).length;

    const contacte = c.contacte.length
      ? c.contacte
          .map((ct) => `${esc(ct.nume)}${ct.rol ? ` <span class="hint">(${esc(ct.rol)})</span>` : ""}`)
          .join("<br>")
      : `<span class="hint">—</span>`;

    return `<tr>
      <td><strong>${esc(c.denumire)}</strong><br><span class="hint">${esc(c.sursa)}</span></td>
      <td>${contacte}</td>
      ${cuCui ? `<td>${c.cui ? esc(c.cui) : "—"}</td>` : ""}
      <td>${esc(CATEGORIE[c.categorie])}</td>
      <td>${esc(TIP_CLIENT[c.tip])}</td>
      <td class="desc">${esc(c.formatSituatii)}</td>
      ${cuTermen ? `<td class="n">${c.termenPlataZile !== null ? `${nr(c.termenPlataZile)} zile` : "—"}</td>` : ""}
      <td class="n">${nr(nrLucrari)}</td>
      <td class="n">${nr(nrDocumente)}</td>
    </tr>`;
  });
  return `<section class="imp-card"><h2>Clienții din datele firmei</h2>
    <p class="hint" style="margin:0 0 12px">Exemple, citite din fișierele primite de la firmă.</p>
    ${tabel(
      ["Client", "Contacte", ...(cuCui ? ["CUI"] : []), "Categorie", "Tip", "Format situații", ...(cuTermen ? ["Termen plată"] : []), "Lucrări", "Documente"],
      randuri,
      ["", "", ...(cuCui ? [""] : []), "", "", "", ...(cuTermen ? ["n"] : []), "n", "n"],
    )}
  </section>`;
}

export const ecran: Ecran = {
  id: "clienti",
  titlu: "Clienți",
  subtitlu: "Beneficiarii ofertelor, cu ofertele și șantierele lor. Fiecare trimite cererile în alt format de tabel.",

  render(root) {
    const ex = exemple();
    root.innerHTML = `<div class="imp">
      <section class="imp-card"><h2>Clienții din oferte</h2>${clientiReali()}</section>
      ${ex ? clientiExemplu(ex) : ""}
      ${nota(
        "Fiecare client trimite alt tabel, dar oferta iese mereu în același format. Tipul ofertei (rezidențială sau " +
          "industrială) se alege la import, pentru fiecare ofertă, nu după client.",
      )}
    </div>`;
  },
};
