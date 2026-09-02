import { tarifeaza } from "../../src/pricing/engine.js";
import { extrageDeterminist } from "../../src/import/extract-regex.js";
import { esc, eur, indicator, nota, tabel, type Ecran } from "./tip.js";

export const ecran: Ecran = {
  id: "import",
  titlu: "Import Excel",
  subtitlu: "Trage o listă de cantități aici. Totul rulează în browser — fișierul nu pleacă de pe calculatorul tău.",

  render(root) {
    root.innerHTML = `
      <label id="drop" class="drop" for="fisier">
        <strong>Trage un fișier .xlsx aici</strong>
        <span>sau click pentru a alege</span>
        <input id="fisier" type="file" accept=".xlsx" />
        <p class="hint">Rulează stratul determinist: parsare, extragere prin reguli, tarifare.
        Stratul cu model rulează local (<code>npm run import</code>) — o cheie API într-o pagină statică ar fi publică.</p>
      </label>
      <div id="raport"></div>`;

    const $ = <T extends HTMLElement>(s: string) => root.querySelector(s) as T;
    const drop = $("#drop");
    const input = $<HTMLInputElement>("#fisier");

    // Deschiderea selectorului vine din <label for>, nu din JS: asa functioneaza
    // si de la tastatura, iar inputul ramane focusabil (ascuns vizual, nu `hidden`).
    input.onchange = () => { if (input.files?.[0]) void proceseaza(input.files[0]); };
    drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("peste"); });
    drop.addEventListener("dragleave", () => drop.classList.remove("peste"));
    drop.addEventListener("drop", (e) => {
      e.preventDefault(); drop.classList.remove("peste");
      const f = e.dataTransfer?.files[0];
      if (f) void proceseaza(f);
    });

    async function proceseaza(fisier: File): Promise<void> {
      const out = $("#raport");
      out.innerHTML = `<p class="nota">Se citește ${esc(fisier.name)}…</p>`;
      try {
        // ExcelJS e ~940 kB: se încarcă la prima folosire, nu la deschiderea paginii.
        const { parseWorkbookBuffer } = await import("../../src/import/parse-workbook.js");
        const brute = await parseWorkbookBuffer(await fisier.arrayBuffer());

        const linii = brute.map((b) => {
          const { linie, complet } = extrageDeterminist(b.index, b.text, b.um);
          let pret: number | null = null, total: number | null = null, eroare: string | null = null;
          if (complet && linie.sistem && linie.diametru_valoare !== null && linie.diametru_tip) {
            try {
              const r = tarifeaza({
                diametru: { valoare: linie.diametru_valoare, tip: linie.diametru_tip },
                straturi: [{ sistem: linie.sistem, ...(linie.grosime_mm !== null ? { grosime_mm: linie.grosime_mm } : {}) }],
                forma: linie.forma ?? "ml",
                cantitate: b.cantitate ?? 1,
              });
              pret = r.pret_unitar; total = r.total;
            } catch (e) { eroare = e instanceof Error ? e.message : String(e); }
          }
          return { b, linie, pret, total, eroare };
        });

        const izo = linii.filter((l) => l.linie.sistem !== null);
        const tarifate = izo.filter((l) => l.pret !== null);
        const valoare = tarifate.reduce((s, l) => s + (l.total ?? 0), 0);
        const proc = izo.length ? `${((tarifate.length / izo.length) * 100).toFixed(0)}%` : "–";

        out.innerHTML = `
          <div class="stats">
            ${indicator(String(brute.length), "rânduri cu text")}
            ${indicator(String(izo.length), "poziții de izolație")}
            ${indicator(String(tarifate.length), "tarifate", proc)}
            ${indicator(String(izo.length - tarifate.length), "de rezolvat manual")}
            ${indicator(eur(valoare), "valoare tarifată")}
          </div>
          ${nota("Doar stratul determinist. Restul se rezolvă cu modelul și prin ecranul de validare, unde corecțiile se memorează pe client — al doilea proiect de la același client pornește de mult mai sus.")}
          ${tabel(
            ["Descriere", "Sistem", "ø", "gros.", "cant.", "P.U.", "Total"],
            izo.slice(0, 150).map((l) => `<tr>
              <td><span class="desc" title="${esc(l.b.text)}">${esc(l.b.text.replace(/\s+/g, " ").slice(0, 70))}</span></td>
              <td><span class="eticheta ton-neutru">${esc(l.linie.sistem!.replace("_", " "))}</span></td>
              <td class="n">${l.linie.diametru_valoare ?? "–"}</td>
              <td class="n">${l.linie.grosime_mm ?? "–"}</td>
              <td class="n">${l.b.cantitate ?? "–"}</td>
              <td class="n">${l.pret !== null ? eur(l.pret) : `<span class="rosu" title="${esc(l.eroare ?? "extragere incompletă")}">–</span>`}</td>
              <td class="n">${l.total !== null ? eur(l.total) : ""}</td></tr>`),
            ["", "", "n", "n", "n", "n", "n"])}
          ${izo.length > 150 ? `<p class="hint">… și încă ${izo.length - 150} poziții.</p>` : ""}`;
      } catch (e) {
        out.innerHTML = `<div class="alerta"><strong>Nu am putut citi fișierul</strong>
          ${esc(e instanceof Error ? e.message : String(e))}<br>
          Formatul .xls vechi nu e suportat în browser — salvează-l ca .xlsx.</div>`;
      }
    }
  },
};
