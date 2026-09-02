import { tarifeaza } from "../src/pricing/engine.js";
import { PozitieNetarifata, type Forma, type Sistem, type Strat } from "../src/pricing/types.js";
import { grosimiLa, lista } from "../src/pricing/lists.js";
import { extrageDeterminist } from "../src/import/extract-regex.js";

const $ = <T extends HTMLElement>(s: string) => document.querySelector(s) as T;
const eur = (n: number) => n.toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

/* ---------------------------------------------------------------- taburi */
for (const tab of document.querySelectorAll<HTMLButtonElement>(".tab")) {
  tab.onclick = () => {
    for (const t of document.querySelectorAll(".tab")) t.classList.remove("activ");
    for (const p of document.querySelectorAll(".panou")) p.classList.remove("activ");
    tab.classList.add("activ");
    $(`#${tab.dataset["panou"]}`).classList.add("activ");
  };
}

/* ----------------------------------------------------------- calculator */
const SISTEME: [Sistem, string][] = [
  ["elastomer", "elastomer (Armaflex)"],
  ["vata_minerala", "vată minerală"],
  ["tabla", "protecție tablă"],
  ["pvc", "PVC"],
];

function randStrat(sistem: Sistem = "elastomer", grosime: number | "" = 13): HTMLDivElement {
  const div = document.createElement("div");
  div.className = "strat";
  div.innerHTML = `
    <label style="flex:1;margin:0">Sistem
      <select class="s">${SISTEME.map(([v, t]) => `<option value="${v}"${v === sistem ? " selected" : ""}>${t}</option>`).join("")}</select>
    </label>
    <label style="flex:0 0 92px;margin:0">Grosime
      <select class="g"></select>
    </label>
    <button class="sterge" title="șterge stratul">×</button>`;

  const sel = div.querySelector<HTMLSelectElement>(".s")!;
  const gro = div.querySelector<HTMLSelectElement>(".g")!;
  const umpleGrosimi = (pastreaza?: number | "") => {
    const g = lista(sel.value as Sistem).grosimi_mm;
    // Tabla si PVC nu au coloana de grosime aleasa de utilizator: e implicita.
    gro.innerHTML = g.length
      ? g.map((x) => `<option value="${x}"${x === pastreaza ? " selected" : ""}>${x} mm</option>`).join("")
      : `<option value="">auto</option>`;
    gro.disabled = g.length === 0;
  };
  umpleGrosimi(grosime);
  sel.onchange = () => { umpleGrosimi(); calc(); };
  gro.onchange = calc;
  div.querySelector<HTMLButtonElement>(".sterge")!.onclick = () => {
    if ($("#straturi").children.length > 1) { div.remove(); calc(); }
  };
  return div;
}

function citesteStraturi(): Strat[] {
  return [...$("#straturi").children].map((el) => {
    const sistem = el.querySelector<HTMLSelectElement>(".s")!.value as Sistem;
    const g = el.querySelector<HTMLSelectElement>(".g")!.value;
    return g === "" ? { sistem } : { sistem, grosime_mm: Number(g) };
  });
}

function calc(): void {
  const straturi = citesteStraturi();
  const cerere = {
    diametru: {
      valoare: Number($<HTMLInputElement>("#diam").value),
      tip: $<HTMLSelectElement>("#tipDiam").value as "DN" | "exterior",
    },
    straturi,
    forma: $<HTMLSelectElement>("#forma").value as Forma,
    cantitate: Number($<HTMLInputElement>("#cant").value) || 0,
  };

  try {
    const r = tarifeaza(cerere);
    $("#iesire").innerHTML = `
      <div class="pret">${eur(r.pret_unitar)} €<small>/ ${r.straturi.length && cerere.forma === "mp" ? "mp" : cerere.forma === "ml" ? "ml" : "buc"}</small></div>
      <div class="total">${eur(r.cantitate)} × ${eur(r.pret_unitar)} = <strong>${eur(r.total)} €</strong>${r.multiplicator !== 1 ? ` · multiplicator ×${r.multiplicator}` : ""}</div>
      <table>
        <thead><tr><th>Strat</th><th class="n">ø geometric</th><th class="n">rând listă</th><th class="n">preț</th></tr></thead>
        <tbody>${r.straturi.map((s) => `
          <tr>
            <td>${s.sistem.replace("_", " ")}${s.grosime_mm ? ` ${s.grosime_mm} mm` : ""}</td>
            <td class="n">${s.diametru_geometric.toFixed(1)}</td>
            <td class="n">${s.rand_lista}</td>
            <td class="n">${eur(s.pret_unitar)}</td>
          </tr>`).join("")}</tbody>
      </table>
      <div class="nota">Fiecare strat se rotunjește separat la 2 zecimale, apoi se însumează.
      Diametrul geometric pornește de la rândul primului strat și crește cu 2 × grosime.</div>`;
  } catch (e) {
    const p = e instanceof PozitieNetarifata;
    $("#iesire").innerHTML = `
      <div class="eroare"><strong>Poziție netarifabilă</strong>${esc(e instanceof Error ? e.message : String(e))}</div>
      <div class="nota">${p
        ? "Golul din matricea de prețuri înseamnă „nu se ofertează”, nu „preț zero”. Poziția se marchează pentru tarifare manuală — nu se ghicește."
        : "Verifică datele introduse."}</div>`;
  }
}

$("#straturi").append(randStrat("elastomer", 13));
$("#adauga").addEventListener("click", () => { $("#straturi").append(randStrat("vata_minerala", 40)); calc(); });
for (const id of ["#diam", "#tipDiam", "#forma", "#cant"]) $(id).addEventListener("input", calc);

/* Exemple: pozitii reale din Oferta 118 / 27.04.2026 */
const EXEMPLE: Record<string, { diam: number; tip: string; forma: string; cant: number; straturi: [Sistem, number | ""][] }> = {
  dn80: { diam: 80, tip: "DN", forma: "ml", cant: 345, straturi: [["elastomer", 13], ["vata_minerala", 40], ["tabla", ""]] },
  dn100: { diam: 100, tip: "DN", forma: "ml", cant: 60, straturi: [["elastomer", 13], ["vata_minerala", 40], ["tabla", ""]] },
  tub: { diam: 100, tip: "DN", forma: "mp", cant: 460, straturi: [["vata_minerala", 50], ["tabla", ""]] },
  fail: { diam: 315, tip: "exterior", forma: "ml", cant: 100, straturi: [["elastomer", 9]] },
};
for (const chip of document.querySelectorAll<HTMLButtonElement>(".chip")) {
  chip.onclick = () => {
    const ex = EXEMPLE[chip.dataset["ex"]!]!;
    $<HTMLInputElement>("#diam").value = String(ex.diam);
    $<HTMLSelectElement>("#tipDiam").value = ex.tip;
    $<HTMLSelectElement>("#forma").value = ex.forma;
    $<HTMLInputElement>("#cant").value = String(ex.cant);
    $("#straturi").innerHTML = "";
    for (const [s, g] of ex.straturi) $("#straturi").append(randStrat(s, g));
    calc();
  };
}
calc();

/* --------------------------------------------------------------- import */
const drop = $("#drop");
const input = $<HTMLInputElement>("#fisier");
drop.onclick = () => input.click();
input.onchange = () => { if (input.files?.[0]) proceseaza(input.files[0]); };
drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("peste"); });
drop.addEventListener("dragleave", () => drop.classList.remove("peste"));
drop.addEventListener("drop", (e) => {
  e.preventDefault(); drop.classList.remove("peste");
  const f = e.dataTransfer?.files[0];
  if (f) proceseaza(f);
});

async function proceseaza(fisier: File): Promise<void> {
  const out = $("#raport");
  out.innerHTML = `<p class="hint" style="margin-top:20px">Se citește ${esc(fisier.name)}…</p>`;
  try {
    // ExcelJS e ~900 kB: se incarca la prima folosire, nu la deschiderea paginii.
    const { parseWorkbookBuffer } = await import("../src/import/parse-workbook.js");
    const brute = await parseWorkbookBuffer(await fisier.arrayBuffer());

    const linii = brute.map((b) => {
      const { linie, complet } = extrageDeterminist(b.index, b.text, b.um);
      let pret: number | null = null;
      let total: number | null = null;
      let eroare: string | null = null;
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
      return { b, linie, complet, pret, total, eroare };
    });

    const izo = linii.filter((l) => l.linie.sistem !== null);
    const tarifate = izo.filter((l) => l.pret !== null);
    const valoare = tarifate.reduce((s, l) => s + (l.total ?? 0), 0);
    const proc = (n: number) => (izo.length ? `${((n / izo.length) * 100).toFixed(0)}%` : "–");

    out.innerHTML = `
      <div class="stats">
        <div class="stat"><b>${brute.length}</b><span>rânduri cu text</span></div>
        <div class="stat"><b>${izo.length}</b><span>poziții de izolație</span></div>
        <div class="stat"><b>${tarifate.length}</b><span>tarifate · ${proc(tarifate.length)}</span></div>
        <div class="stat"><b>${izo.length - tarifate.length}</b><span>de rezolvat manual</span></div>
        <div class="stat"><b>${eur(valoare)} €</b><span>valoare tarifată</span></div>
      </div>
      <div class="nota">Doar stratul determinist. Restul pozițiilor se rezolvă cu modelul (rulează local,
      <code>npm run import</code>) și prin ecranul de validare, unde corecțiile se memorează pe client.</div>
      <div class="tabelwrap">
        <table>
          <thead><tr><th>Descriere</th><th>Sistem</th><th class="n">ø</th><th class="n">gros.</th><th class="n">cant.</th><th class="n">P.U.</th><th class="n">Total</th></tr></thead>
          <tbody>${izo.slice(0, 120).map((l) => `
            <tr>
              <td class="desc" title="${esc(l.b.text)}">${esc(l.b.text.replace(/\s+/g, " ").slice(0, 70))}</td>
              <td><span class="eticheta">${l.linie.sistem!.replace("_", " ")}</span></td>
              <td class="n">${l.linie.diametru_valoare ?? "–"}</td>
              <td class="n">${l.linie.grosime_mm ?? "–"}</td>
              <td class="n">${l.b.cantitate ?? "–"}</td>
              <td class="n">${l.pret !== null ? eur(l.pret) : `<span class="eroare" title="${esc(l.eroare ?? "extragere incompletă")}">–</span>`}</td>
              <td class="n">${l.total !== null ? eur(l.total) : ""}</td>
            </tr>`).join("")}</tbody>
        </table>
        ${izo.length > 120 ? `<p class="hint">… și încă ${izo.length - 120} poziții.</p>` : ""}
      </div>`;
  } catch (e) {
    out.innerHTML = `<div class="nota eroare">Nu am putut citi fișierul: ${esc(e instanceof Error ? e.message : String(e))}<br>
      Formatul .xls vechi nu e suportat în browser — salvează-l ca .xlsx.</div>`;
  }
}
