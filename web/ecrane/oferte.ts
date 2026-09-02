import type { Ecran } from "./tip.js";
import { eur, nr, data, esc, card, stare, tabel, nota } from "./tip.js";
import { DOCUMENTE, client, type Document } from "../date/seed.js";
import { vedeCosturi } from "../nav.js";

/** Etichete pentru tipurile de document afisate aici. Cererile au ecran propriu (cereri.ts). */
const TIP_ETICHETA: Record<Document["tip"], string> = {
  cerere: "Cerere",
  oferta: "Ofertă",
  contract: "Contract",
  situatie: "Situație",
};

/** Ton vizual pentru fiecare stare posibila a unui document. */
const STARE_INFO: Record<Document["stare"], { text: string; ton: "ok" | "atentie" | "neutru" }> = {
  cerere: { text: "Cerere", ton: "neutru" },
  ofertata: { text: "Ofertată", ton: "neutru" },
  acceptata: { text: "Acceptată", ton: "ok" },
  contractata: { text: "Contractată", ton: "ok" },
  confirmata: { text: "Confirmată", ton: "ok" },
};

/**
 * Legaturile reale dintre documente, ca sa nu ramana ascunse intr-un tabel plat.
 * Regula generala din spatele fiecarui caz e explicata in notele de mai jos.
 */
const LANT: Record<string, string> = {
  "d-118": "↳ subnumerotare cu 118.1 — aceeași lucrare, alt tip de lucrare",
  "d-118-1": "↳ subnumerotare a ofertei 118",
  "d-5997": "↳ devine Anexa 1 la contractul 5998",
  "d-5998": "↳ conține oferta 5997 ca Anexa 1",
  "d-6009": "↳ aceeași structură ca anexa contractului 5998, fără coloane de preț",
};

export const ecran: Ecran = {
  id: "oferte",
  titlu: "Oferte și contracte",
  subtitlu: "Lanțul real: ofertă → contract (cu oferta ca anexă) → situație de lucrări.",
  render(root) {
    const documente = DOCUMENTE.filter(
      (d) => d.tip === "oferta" || d.tip === "contract" || d.tip === "situatie",
    );
    const arataValoare = vedeCosturi();

    const capete = [
      "Număr", "Dată", "Tip", "Client", "Titlu", "Linii",
      ...(arataValoare ? ["Valoare"] : []),
      "Stare", "Sursă",
    ];
    const clase = [
      "", "", "", "", "", "n",
      ...(arataValoare ? ["n"] : []),
      "", "",
    ];

    const randuri = documente.map((doc) => {
      const c = client(doc.clientId);
      const hint = LANT[doc.id];
      const st = STARE_INFO[doc.stare];
      return `<tr>
        <td>${esc(doc.numar)}${hint ? `<br><span class="hint">${esc(hint)}</span>` : ""}</td>
        <td>${data(doc.data)}</td>
        <td>${esc(TIP_ETICHETA[doc.tip])}</td>
        <td>${esc(c?.denumire ?? "—")}</td>
        <td class="desc" title="${esc(doc.titlu)}">${esc(doc.titlu)}</td>
        <td class="n">${nr(doc.linii)}</td>
        ${arataValoare ? `<td class="n">${doc.valoare != null ? eur(doc.valoare) : "—"}</td>` : ""}
        <td>${stare(st.text, st.ton)}</td>
        <td class="hint">${esc(doc.fisierSursa)}</td>
      </tr>`;
    });

    root.innerHTML =
      card("Documente", tabel(capete, randuri, clase)) +
      nota(
        "Oferta 5997 devine <strong>Anexa 1</strong> a contractului 5998, iar situația de lucrări 6009 " +
        "reia exact aceleași poziții. Anexa la contract și situația de lucrări nu sunt două documente " +
        "diferite — sunt <strong>aceeași structură de date</strong>, citită o dată cu coloanele de preț " +
        "(anexa, pentru contract) și o dată fără ele (situația, spre confirmare de client).",
      ) +
      nota(
        "Oferta 118 și oferta 118.1 sunt <strong>același obiect comercial</strong> — șantierul XXXLutz + " +
        "Momax Balotești — împărțit pe două tipuri de lucrare (izolații termice, respectiv închideri " +
        "goluri la foc). De-asta numerotarea ofertelor are nevoie de subnumerotare (118, 118.1), nu doar " +
        "de un număr întreg.",
      ) +
      nota(
        "Regula cheie: o ofertă emisă <strong>nu se mai editează niciodată</strong> — se corectează printr-o " +
        "versiune nouă. Prețul se copiază în linia de deviz (snapshot), nu se referențiază din lista curentă, " +
        "ca oferta să rămână reproductibilă peste ani chiar dacă lista de prețuri s-a schimbat între timp.",
      );
  },
};
