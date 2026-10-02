import type { Ecran } from "./tip.js";
import { card, dataScurta, esc, eur, indicator, nota, nr, stare, tabel } from "./tip.js";
import { DOCUMENTE, FIRME, client, type Document } from "../date/seed.js";
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
  "d-transavia-abur": "↳ ofertată prin Oferta 284; importul ei dă exact oferta semnată",
  "d-284": "↳ răspunsul la cererea TRANSAVIA",
};

/** Partea din legatura care spune bani: doar pentru rolurile care vad valori. */
const LANT_VALOARE: Record<string, string> = {
  "d-284": ": 94.575,06 € − discount 3 %",
};

function indicatori(): string {
  const cereri = DOCUMENTE.filter((d) => d.tip === "cerere" && d.stare === "cerere");
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
    const hint = LANT[doc.id] && LANT[doc.id] + (arataValoare ? LANT_VALOARE[doc.id] ?? "" : "");
    // O cerere ofertata nu e „trimisa": a primit o oferta.
    const st = doc.tip === "cerere" && doc.stare === "ofertata" ? { text: "Ofertată", ton: "ok" as const } : STARE_INFO[doc.stare];
    // Numarul contine si data ("118 / 27.04.2026"); data are coloana ei.
    const numar = doc.numar.split("/")[0]?.trim() || "—";
    const actiune = doc.tip === "cerere" && doc.stare === "cerere" ? `<a href="#/import">Importă cererea</a>` : "";
    const firma = doc.firmaId ? FIRME.find((f) => f.id === doc.firmaId)?.denumire : undefined;
    // Legatura dintre documente sta sub titlu, nu sub numar: coloana de numar
    // e ingusta si o nota de un rand acolo intinde randul pe sase linii.
    return `<tr>
      <td class="fix">${esc(numar)}</td>
      <td class="fix">${doc.data ? dataScurta(doc.data) : "—"}</td>
      <td>${esc(TIP_ETICHETA[doc.tip])}</td>
      <td>${esc(c?.denumire ?? "—")}</td>
      <td><span class="desc" title="${esc(doc.titlu)}">${esc(doc.titlu)}</span>
        <br><span class="hint">${hint ? `${esc(hint)} · ` : ""}${firma ? `emisă de ${esc(firma)} · ` : ""}${esc(doc.fisierSursa)}</span></td>
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
    "Cererile clienților și ofertele trimise, pe drumul lor: cerere → ofertă → contract → situație de lucrări.",

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
        "Cum se face oferta din cererea clientului",
        `<div class="grid grid-2">
          <p><strong>Excel-ul clientului, așa cum vine.</strong> Fiecare client trimite alt tabel. Aplicația
          găsește singură coloanele (descriere, UM, cantitate) și citește rândurile. Doar rândurile pe care nu
          le înțelege le trimite la AI.</p>
          <p><strong>Prețul vine din listele firmei, nu de la AI.</strong> Fiecare poziție iese „Gata”,
          „De verificat” (cu motivul) sau „Fără preț” (cu cauza). Ce ai corectat o dată, aplicația ține
          minte data viitoare.</p>
        </div>
        <p class="hint">Nimic nu ajunge în oferta descărcată fără ca un om să fi văzut pozițiile marcate.
        Cererea TRANSAVIA importată dă, rând cu rând, exact Oferta 284 semnată.</p>`,
      )}
      ${nota(
        "Oferta 5997 a devenit <strong>Anexa 1</strong> la contractul 5998, iar situația de lucrări 6009 are " +
        "aceleași poziții, fără prețuri, ca s-o confirme clientul.",
      )}
      ${nota(
        "Ofertele 118 și 118.1 sunt pentru <strong>același șantier</strong> (XXXLutz + Momax Balotești), pe " +
        "două tipuri de lucrare. De aceea au numerele 118 și 118.1.",
      )}
      ${nota(
        "O ofertă trimisă <strong>nu se mai modifică</strong>: dacă trebuie schimbată, se face o ofertă nouă. " +
        "Prețurile rămân cele din ziua ofertei, chiar dacă lista de prețuri se schimbă mai târziu.",
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
