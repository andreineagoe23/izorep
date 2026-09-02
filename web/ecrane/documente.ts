import type { Ecran } from "./tip.js";
import { card, dataScurta, esc, eur, indicator, nota, nr, stare, tabel } from "./tip.js";
import { DOCUMENTE, client, type Document } from "../date/seed.js";
import { vedeCosturi } from "../nav.js";

/**
 * Cererile si ofertele erau doua ecrane separate peste acelasi `DOCUMENTE`,
 * filtrat dupa `tip`. Sunt insa acelasi obiect in stadii diferite ale
 * aceluiasi flux — o cerere devine ofertă, oferta devine anexa contractului,
 * anexa devine situatie de lucrari. Un singur tabel cu filtru arata lantul;
 * doua ecrane il ascundeau.
 */
type Filtru = "toate" | Document["tip"];

const FILTRE: { id: Filtru; eticheta: string }[] = [
  { id: "toate", eticheta: "Toate" },
  { id: "cerere", eticheta: "Cereri" },
  { id: "oferta", eticheta: "Oferte" },
  { id: "contract", eticheta: "Contracte" },
  { id: "situatie", eticheta: "Situații" },
];

const TIP_ETICHETA: Record<Document["tip"], string> = {
  cerere: "Cerere",
  oferta: "Ofertă",
  contract: "Contract",
  situatie: "Situație",
};

const STARE_INFO: Record<Document["stare"], { text: string; ton: "ok" | "atentie" | "neutru" }> = {
  cerere: { text: "De ofertat", ton: "atentie" },
  ofertata: { text: "Trimisă", ton: "neutru" },
  acceptata: { text: "Acceptată", ton: "ok" },
  contractata: { text: "Contractată", ton: "ok" },
  confirmata: { text: "Confirmată", ton: "ok" },
};

/** Legaturile reale dintre documente, altfel invizibile intr-un tabel plat. */
const LANT: Record<string, string> = {
  "d-118": "↳ subnumerotare cu 118.1 — aceeași lucrare, alt tip de lucrare",
  "d-118-1": "↳ subnumerotare a ofertei 118",
  "d-5997": "↳ devine Anexa 1 la contractul 5998",
  "d-5998": "↳ conține oferta 5997 ca Anexa 1",
  "d-6009": "↳ aceeași structură ca anexa contractului 5998, fără coloane de preț",
};

function indicatori(): string {
  const cereri = DOCUMENTE.filter((d) => d.tip === "cerere");
  const oferte = DOCUMENTE.filter((d) => d.tip === "oferta");
  const valoare = oferte.reduce((s, d) => s + (d.valoare ?? 0), 0);

  const stat = [
    indicator(nr(cereri.length), "Cereri de ofertat", `${nr(cereri.reduce((s, d) => s + d.linii, 0))} poziții`),
    indicator(nr(oferte.length), "Oferte emise"),
  ];
  if (vedeCosturi()) stat.push(indicator(eur(valoare), "Valoare ofertată"));

  return `<div class="stats">${stat.join("")}</div>`;
}

function randuri(lista: Document[], arataValoare: boolean): string[] {
  return lista.map((doc) => {
    const c = client(doc.clientId);
    const hint = LANT[doc.id];
    const st = STARE_INFO[doc.stare];
    // Numarul contine si data ("118 / 27.04.2026"); data are coloana ei.
    const numar = doc.numar.split("/")[0]?.trim() || "—";
    const actiune = doc.tip === "cerere" ? `<a href="#/deviz">Calculează devizul</a>` : "";
    // Legatura dintre documente sta sub titlu, nu sub numar: coloana de numar
    // e ingusta si o nota de un rand acolo intinde randul pe sase linii.
    return `<tr>
      <td class="fix">${esc(numar)}</td>
      <td class="fix">${dataScurta(doc.data)}</td>
      <td>${esc(TIP_ETICHETA[doc.tip])}</td>
      <td>${esc(c?.denumire ?? "—")}</td>
      <td><span class="desc" title="${esc(doc.titlu)}">${esc(doc.titlu)}</span>
        <br><span class="hint">${hint ? `${esc(hint)} · ` : ""}${esc(doc.fisierSursa)}</span></td>
      <td class="n">${nr(doc.linii)}</td>
      ${arataValoare ? `<td class="n">${doc.valoare != null ? eur(doc.valoare) : "—"}</td>` : ""}
      <td>${stare(st.text, st.ton)}</td>
      <td class="fix">${actiune}</td>
    </tr>`;
  });
}

export const ecran: Ecran = {
  id: "documente",
  titlu: "Cereri și oferte",
  subtitlu:
    "Același document, în stadii diferite: cerere primită → ofertă → contract (cu oferta ca anexă) → situație de lucrări.",

  render(root) {
    const arataValoare = vedeCosturi();
    const capete = [
      "Număr", "Dată", "Tip", "Client", "Titlu", "Linii",
      ...(arataValoare ? ["Valoare"] : []),
      "Stare", "",
    ];
    const clase = [
      "", "", "", "", "", "n",
      ...(arataValoare ? ["n"] : []),
      "", "",
    ];

    root.innerHTML = `
      ${indicatori()}
      <div class="filtre" role="group" aria-label="Filtrează după tipul documentului">
        ${FILTRE.map((f) => `<button class="filtru" data-f="${f.id}" aria-pressed="${f.id === "toate"}">${esc(f.eticheta)}</button>`).join("")}
      </div>
      <div id="tabel-documente"></div>
      ${card(
        "Cum ajunge o cerere în sistem",
        `<div class="grid grid-2">
          <p><strong>Excel de la client.</strong> Sistemul citește fișierul primit, propune o mapare a
          coloanelor pe câmpurile interne și o memorează pentru clientul respectiv — la următorul import
          se aplică automat.</p>
          <p><strong>Poză cu foaia de măsurători.</strong> Un model de vision extrage câmpurile direct din
          imagine, cu un scor de încredere pentru fiecare valoare citită.</p>
        </div>
        <p class="hint">În ambele cazuri urmează obligatoriu un ecran de validare — nimic nu ajunge în baza
        de date fără ca un om să confirme.</p>`,
      )}
      ${nota(
        "Oferta 5997 devine <strong>Anexa 1</strong> a contractului 5998, iar situația de lucrări 6009 reia " +
        "exact aceleași poziții. Anexa la contract și situația de lucrări nu sunt două documente diferite — " +
        "sunt <strong>aceeași structură de date</strong>, citită o dată cu coloanele de preț (anexa) și o " +
        "dată fără ele (situația, spre confirmare de client).",
      )}
      ${nota(
        "Oferta 118 și oferta 118.1 sunt <strong>același obiect comercial</strong> — șantierul XXXLutz + " +
        "Momax Balotești — împărțit pe două tipuri de lucrare. De-asta numerotarea are nevoie de " +
        "subnumerotare (118, 118.1), nu doar de un număr întreg.",
      )}
      ${nota(
        "O ofertă emisă <strong>nu se mai editează niciodată</strong> — se corectează printr-o versiune nouă. " +
        "Prețul se copiază în linia de deviz (snapshot), nu se referențiază din lista curentă, ca oferta să " +
        "rămână reproductibilă peste ani chiar dacă lista de prețuri s-a schimbat între timp.",
      )}`;

    const gazda = root.querySelector<HTMLElement>("#tabel-documente")!;

    function deseneaza(f: Filtru): void {
      const lista = f === "toate" ? DOCUMENTE : DOCUMENTE.filter((d) => d.tip === f);
      gazda.innerHTML = lista.length
        ? tabel(capete, randuri(lista, arataValoare), clase)
        : `<p class="nota">Niciun document de acest tip.</p>`;
    }

    for (const b of root.querySelectorAll<HTMLButtonElement>("button.filtru")) {
      b.onclick = () => {
        for (const alt of root.querySelectorAll<HTMLButtonElement>("button.filtru")) {
          alt.setAttribute("aria-pressed", String(alt === b));
        }
        deseneaza(b.dataset["f"] as Filtru);
      };
    }
    deseneaza("toate");
  },
};
