import type { Ecran } from "./tip.js";
import { esc, nota, nr, tabel } from "./tip.js";
import { CLIENTI, DOCUMENTE, LUCRARI, type Categorie, type TipClient } from "../date/seed.js";

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

export const ecran: Ecran = {
  id: "clienti",
  titlu: "Clienți",
  subtitlu:
    `${CLIENTI.length} clienți în sistem — fiecare cu propriul format de situație de lucrări, așa cum vine el de la client.`,

  render(root) {
    const randuri = CLIENTI.map((c) => {
      const nrLucrari = LUCRARI.filter((l) => l.clientId === c.id).length;
      const nrDocumente = DOCUMENTE.filter((d) => d.clientId === c.id).length;

      const contacte = c.contacte.length
        ? c.contacte
            .map((ct) => `${esc(ct.nume)}${ct.rol ? ` <span class="hint">(${esc(ct.rol)})</span>` : ""}`)
            .join("<br>")
        : `<span class="hint">—</span>`;

      return `<tr>
        <td><strong>${esc(c.denumire)}</strong><br><span class="hint">${esc(c.sursa)}</span></td>
        <td>${contacte}</td>
        <td>${c.cui ? esc(c.cui) : "—"}</td>
        <td>${esc(CATEGORIE[c.categorie])}</td>
        <td>${esc(TIP_CLIENT[c.tip])}</td>
        <td class="desc">${esc(c.formatSituatii)}</td>
        <td class="n">${c.termenPlataZile !== null ? `${nr(c.termenPlataZile)} zile` : "—"}</td>
        <td class="n">${nr(nrLucrari)}</td>
        <td class="n">${nr(nrDocumente)}</td>
      </tr>`;
    });

    root.innerHTML = `
      ${tabel(
        ["Client", "Contacte", "CUI", "Categorie", "Tip", "Format situații", "Termen plată", "Lucrări", "Documente"],
        randuri,
        ["", "", "", "", "", "", "n", "n", "n"],
      )}
      ${nota(
        "Categoria clientului determină lista de prețuri implicită — un client de rafinărie primește alte tarife " +
          "decât unul rezidențial. Prețul poate fi oricând suprascris manual pe deviz, cu marcaj vizibil pe linie, " +
          "pentru abaterile negociate care apar în ofertele reale.",
      )}
      ${nota(
        "Fiecare client impune propriul format de situație de lucrări (vezi coloana „Format situații”). Maparea " +
          "coloanelor din Excel-ul lui cu formatul intern se face o singură dată, per client, apoi se refolosește " +
          "automat la fiecare import ulterior.",
      )}
    `;
  },
};
