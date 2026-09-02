import type { Ecran } from "./tip.js";
import { card, data, esc, indicator, nota, nr, stare, tabel } from "./tip.js";
import { client, DOCUMENTE } from "../date/seed.js";

const CERERI = DOCUMENTE.filter((d) => d.tip === "cerere");

export const ecran: Ecran = {
  id: "cereri",
  titlu: "Cereri",
  subtitlu:
    "Cererea e punctul de intrare în sistem — un Excel primit de la client sau o poză cu foaia de măsurători.",

  render(root) {
    const randuri = CERERI.map((d) => {
      const c = client(d.clientId);
      const numar = d.numar.trim();
      return `<tr>
        <td>${esc(numar || "—")}</td>
        <td>${esc(data(d.data))}</td>
        <td>${c ? esc(c.denumire) : "—"}</td>
        <td class="desc">${esc(d.titlu)}</td>
        <td>${indicator(nr(d.linii), "poziții")}</td>
        <td class="hint">${esc(d.fisierSursa)}</td>
        <td>${stare("Cerere", "atentie")}</td>
        <td><a href="#/deviz">Calculează devizul</a></td>
      </tr>`;
    });

    root.innerHTML = `
      ${tabel(
        ["Număr", "Dată", "Client", "Titlu", "Poziții", "Fișier sursă", "Stare", ""],
        randuri,
      )}

      ${card(
        "Cum ajunge o cerere în sistem",
        `<div class="grid-2">
          <div>
            <p><strong>Excel de la client.</strong> Sistemul citește fișierul primit, propune o mapare a
            coloanelor pe câmpurile interne și o memorează pentru clientul respectiv — la următorul import
            se aplică automat.</p>
          </div>
          <div>
            <p><strong>Poză cu foaia de măsurători.</strong> Un model de vision extrage câmpurile direct din
            imagine, cu un scor de încredere pentru fiecare valoare citită.</p>
          </div>
        </div>
        <p class="hint">În ambele cazuri urmează obligatoriu un ecran de validare — nimic nu ajunge în bază
        de date fără ca un om să confirme.</p>`,
      )}

      ${nota(
        "Ce e construit azi: parsarea Excel și extragerea deterministă funcționează (vezi ecranul „Import " +
          "Excel”). Maparea de coloane per client și ecranul de validare urmează.",
      )}
    `;
  },
};
