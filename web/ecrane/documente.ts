import type { Ecran } from "./tip.js";
import { dataScurta, esc, eur, nr, stare, tabel } from "./tip.js";
import { citesteOferte, citestePlanuri, listeaza, puneCurent, sterge, uitaOferta } from "../date.js";
import type { IntrareIstoric } from "../istoric.js";
import type { OfertaEmisa } from "../oferte-local.js";
import type { Document } from "../date/seed.js";
import { FIRME } from "../date/firme.js";
import { exemple, type Exemple } from "../date/exemple.js";
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

function randuri(ex: Exemple, lista: Document[], arataValoare: boolean): string[] {
  return lista.map((doc) => {
    const c = ex.client(doc.clientId);
    const hint = ex.LANT[doc.id] && ex.LANT[doc.id] + (arataValoare ? ex.LANT_VALOARE[doc.id] ?? "" : "");
    // O cerere ofertata nu e „trimisa": a primit o oferta.
    const st = doc.tip === "cerere" && doc.stare === "ofertata" ? { text: "Ofertată", ton: "ok" as const } : STARE_INFO[doc.stare];
    // Numarul contine si data ("118 / 27.04.2026"); data are coloana ei.
    const numar = doc.numar.split("/")[0]?.trim() || "—";
    const actiune = doc.tip === "cerere" && doc.stare === "cerere" ? `<a href="#/import">Importă cererea</a>` : "";
    const firma = doc.firmaId ? FIRME.find((f) => f.id === doc.firmaId)?.denumire : undefined;
    // Legatura dintre documente sta sub titlu, nu sub numar: coloana de numar
    // e ingusta si o nota de un rand acolo intinde randul pe sase linii.
    // Titlul e primul: pe telefon e titlul cardului, iar tipul si numarul stau sub el.
    return `<tr>
      <td><span class="desc" title="${esc(doc.titlu)}">${esc(doc.titlu)}</span>
        <br><span class="hint">${esc(TIP_ETICHETA[doc.tip])}${numar !== "—" ? ` nr. ${esc(numar)}` : ""}${
          hint ? ` · ${esc(hint)}` : ""}${firma ? ` · emisă de ${esc(firma)}` : ""} · ${esc(doc.fisierSursa)}</span></td>
      <td>${esc(c?.denumire ?? "—")}</td>
      <td class="fix">${doc.data ? dataScurta(doc.data) : "—"}</td>
      <td class="n">${nr(doc.linii)}</td>
      ${arataValoare ? `<td class="n">${doc.valoare != null ? eur(doc.valoare) : "—"}</td>` : ""}
      <td>${stare(st.text, st.ton)}</td>
      <td class="fix">${actiune}</td>
    </tr>`;
  });
}

const TIP_OFERTA: Record<string, string> = { rezidential: "Rezidențială", industrial: "Industrială", rafinarie: "Rafinărie" };

/** Un import din aplicatie: cererea, oferta descarcata din ea si santierul facut din oferta. */
function randImport(m: IntrareIstoric, o: OfertaEmisa | undefined, santier: boolean, arataValoare: boolean, stergeDe: string | null): string {
  const st = santier ? stare("Șantier făcut", "ok") : o ? stare("Ofertă descărcată", "ok") : stare("De ofertat", "atentie");
  return `<tr>
    <td><strong>${esc(o?.client || m.nume)}</strong><br><span class="hint">${o?.client ? `${esc(m.nume)} · ` : ""}importată pe ${esc(dataScurta(m.cand))}</span></td>
    <td>${esc(TIP_OFERTA[m.destinatie ?? "rezidential"] ?? "")}</td>
    <td class="n">${nr(m.tarifate)} din ${nr(m.pozitii)}<br><span class="hint">cu preț</span></td>
    <td>${o ? `${esc(o.numar || "fără număr")} · ${esc(o.data)}${o.client ? `<br><span class="hint">${esc(o.client)}</span>` : ""}` : "—"}</td>
    ${arataValoare ? `<td class="n">${o ? eur(o.valoare) : "—"}</td>` : ""}
    <td>${st}</td>
    <td class="fix"><button type="button" class="secundar" data-act="deschide" data-id="${esc(m.id)}">Deschide</button>
      <button type="button" class="legatura pericol" data-act="sterge" data-id="${esc(m.id)}">${stergeDe === m.id ? "Sigur ștergi?" : "Șterge"}</button></td>
  </tr>`;
}

export const ecran: Ecran = {
  id: "documente",
  titlu: "Oferte și cereri",
  subtitlu: "Cererile importate în aplicație și ofertele făcute din ele.",

  render(root) {
    const arataValoare = vedeCosturi();
    const capete = [
      "Document", "Client", "Dată", "Linii",
      ...(arataValoare ? ["Valoare"] : []),
      "Stare", "",
    ];
    const clase = [
      "", "", "", "n",
      ...(arataValoare ? ["n"] : []),
      "", "",
    ];

    // Pe server doar ce e in baza; documentele firmei sunt exemple, doar pe linkul demo.
    const ex = exemple();
    root.innerHTML = `<div class="imp">
      <section class="imp-card" id="cererile-tale"></section>
      ${ex ? `<section class="imp-card">
        <h2>Documentele firmei</h2>
        <p class="hint" style="margin:0 0 12px">Cererile și ofertele reale primite de la firmă, pe care am verificat
          aplicația. Sunt exemple: nu se schimbă din aplicație.</p>
        <div class="filtre" role="group" aria-label="Filtrează după tipul documentului">
          ${FILTRE.map((f) => `<button class="filtru" data-f="${f.id}" aria-pressed="${f.id === "toate"}">${esc(f.eticheta)}</button>`).join("")}
        </div>
        <div id="tabel-documente"></div>
      </section>` : ""}
    </div>`;

    const tale = root.querySelector<HTMLElement>("#cererile-tale")!;
    let stergeDe: string | null = null;

    async function deseneazaTale(): Promise<void> {
      const importuri = await listeaza();
      const oferte = citesteOferte();
      const santiere = new Set(citestePlanuri().map((p) => p.fisier));
      tale.innerHTML = `<h2>Cererile importate</h2>
        ${importuri.length === 0
          ? `<p class="hint" style="margin:0">Nicio cerere încă. O cerere intră aici când o aduci în aplicație, din
            <a href="#/import">Cerere nouă</a> sau din <a href="#/masuratori">Poze de pe șantier</a>; oferta descărcată din ea
            apare pe același rând.</p>`
          : tabel(
              ["Cererea", "Tip ofertă", "Poziții", "Oferta", ...(arataValoare ? ["Valoare"] : []), "Stare", ""],
              importuri.map((m) => randImport(m, oferte[m.id], santiere.has(m.nume), arataValoare, stergeDe)),
              ["", "", "n", "", ...(arataValoare ? ["n"] : []), "", ""],
            )}`;
    }

    tale.addEventListener("click", (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-act]");
      const id = b?.dataset["id"];
      if (!b || !id) return;
      if (b.dataset["act"] === "deschide") {
        // Importul se redeschide singur pe importul curent, fara sa cheme modelul din nou.
        puneCurent(id);
        location.hash = "#/import";
        return;
      }
      if (stergeDe !== id) {
        stergeDe = id;
        void deseneazaTale().then(() => tale.querySelector<HTMLElement>(`[data-act="sterge"][data-id="${CSS.escape(id)}"]`)?.focus());
        return;
      }
      stergeDe = null;
      uitaOferta(id);
      void sterge(id).then(deseneazaTale);
    });
    void deseneazaTale();

    if (!ex) return;
    const gazda = root.querySelector<HTMLElement>("#tabel-documente")!;
    const deseneaza = (f: Filtru): void => {
      const lista = f === "toate" ? ex.DOCUMENTE : ex.DOCUMENTE.filter((d) => d.tip === f);
      gazda.innerHTML = lista.length
        ? tabel(capete, randuri(ex, lista, arataValoare), clase)
        : `<p class="nota">Niciun document de acest tip.</p>`;
    };

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
