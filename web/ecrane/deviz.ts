import { tarifeaza } from "../../src/pricing/engine.js";
import { PozitieNetarifata, type Forma, type Sistem, type Strat } from "../../src/pricing/types.js";
import { lista } from "../../src/pricing/lists.js";
import { esc, eur, nota, tabel, type Ecran } from "./tip.js";

const SISTEME: [Sistem, string][] = [
  ["elastomer", "elastomer (Armaflex)"],
  ["vata_minerala", "vată minerală"],
  ["tabla", "protecție tablă"],
  ["pvc", "PVC"],
];

/** Poziții reale din Oferta 118 / 27.04.2026, ca demonstrație. */
const EXEMPLE: Record<string, { diam: number; tip: string; forma: string; cant: number; straturi: [Sistem, number | ""][] }> = {
  dn80: { diam: 80, tip: "DN", forma: "ml", cant: 345, straturi: [["elastomer", 13], ["vata_minerala", 40], ["tabla", ""]] },
  dn100: { diam: 100, tip: "DN", forma: "ml", cant: 60, straturi: [["elastomer", 13], ["vata_minerala", 40], ["tabla", ""]] },
  tub: { diam: 100, tip: "DN", forma: "mp", cant: 460, straturi: [["vata_minerala", 50], ["tabla", ""]] },
  fail: { diam: 315, tip: "exterior", forma: "ml", cant: 100, straturi: [["elastomer", 9]] },
};

export const ecran: Ecran = {
  id: "deviz",
  titlu: "Calcul deviz",
  subtitlu: "Tarifare deterministă din listele firmei. Aceleași reguli care reproduc ofertele istorice la bănuț.",

  render(root) {
    root.innerHTML = `
      <div class="grid grid-2">
        <section class="card">
          <h2>Poziție</h2>
          <label>Diametru
            <div class="rand">
              <input id="diam" type="number" value="80" min="1" step="1" />
              <select id="tipDiam">
                <option value="DN">DN (țeavă oțel)</option>
                <option value="exterior">exterior (plastic, SPIRO)</option>
              </select>
            </div>
          </label>
          <label>Formă
            <select id="forma">
              <option value="ml">metru liniar</option>
              <option value="mp">metru pătrat</option>
              <option value="cot">cot</option><option value="teu">teu</option>
              <option value="manseta">manșetă</option><option value="flansa">flanșă</option>
              <option value="robinet">robinet / vană</option><option value="contor">contor</option>
              <option value="filtru">filtru Y</option><option value="pompa">pompă</option>
            </select>
          </label>
          <label>Cantitate <input id="cant" type="number" value="345" min="0" step="1" /></label>

          <h2>Straturi <span class="hint">dinspre țeavă spre exterior</span></h2>
          <div id="straturi"></div>
          <button id="adauga" class="secundar" type="button">+ adaugă strat</button>

          <div class="exemple">
            <span class="hint">poziții reale din oferta 118:</span>
            <button class="chip" type="button" data-ex="dn80">DN80 compus</button>
            <button class="chip" type="button" data-ex="dn100">DN100 compus</button>
            <button class="chip" type="button" data-ex="tub">tubulatură /mp</button>
            <button class="chip" type="button" data-ex="fail">netarifabilă</button>
          </div>
        </section>

        <section class="card"><h2>Rezultat</h2>
          <div id="iesire" aria-live="polite"></div></section>
      </div>`;

    const $ = <T extends HTMLElement>(s: string) => root.querySelector(s) as T;

    function randStrat(sistem: Sistem = "elastomer", grosime: number | "" = 13): HTMLDivElement {
      const div = document.createElement("div");
      div.className = "strat";
      div.innerHTML = `
        <label style="flex:1;margin:0">Sistem
          <select class="s">${SISTEME.map(([v, t]) => `<option value="${v}"${v === sistem ? " selected" : ""}>${t}</option>`).join("")}</select>
        </label>
        <label style="flex:0 0 112px;margin:0">Grosime <select class="g"></select></label>
        <button class="sterge" type="button" aria-label="Șterge stratul">×</button>`;

      const sel = div.querySelector<HTMLSelectElement>(".s")!;
      const gro = div.querySelector<HTMLSelectElement>(".g")!;
      const umple = (pastreaza?: number | "") => {
        const g = lista(sel.value as Sistem).grosimi_mm;
        // Tabla și PVC nu au grosime aleasă de utilizator: e implicită.
        gro.innerHTML = g.length
          ? g.map((x) => `<option value="${x}"${x === pastreaza ? " selected" : ""}>${x} mm</option>`).join("")
          : `<option value="">auto</option>`;
        gro.disabled = g.length === 0;
      };
      umple(grosime);
      sel.onchange = () => { umple(); calc(); };
      gro.onchange = calc;
      div.querySelector<HTMLButtonElement>(".sterge")!.onclick = () => {
        if ($("#straturi").children.length > 1) { div.remove(); calc(); }
      };
      return div;
    }

    function citeste(): Strat[] {
      return [...$("#straturi").children].map((el) => {
        const sistem = el.querySelector<HTMLSelectElement>(".s")!.value as Sistem;
        const g = el.querySelector<HTMLSelectElement>(".g")!.value;
        return g === "" ? { sistem } : { sistem, grosime_mm: Number(g) };
      });
    }

    function calc(): void {
      const forma = $<HTMLSelectElement>("#forma").value as Forma;
      try {
        const r = tarifeaza({
          diametru: {
            valoare: Number($<HTMLInputElement>("#diam").value),
            tip: $<HTMLSelectElement>("#tipDiam").value as "DN" | "exterior",
          },
          straturi: citeste(),
          forma,
          cantitate: Number($<HTMLInputElement>("#cant").value) || 0,
        });
        const um = forma === "mp" ? "mp" : forma === "ml" ? "ml" : "buc";
        $("#iesire").innerHTML = `
          <div class="pret">${eur(r.pret_unitar)}<small>/ ${um}</small></div>
          <div class="total">${r.cantitate} × ${eur(r.pret_unitar)} = <strong>${eur(r.total)}</strong>${
            r.multiplicator !== 1 ? ` · multiplicator ×${r.multiplicator}` : ""}</div>
          ${tabel(["Strat", "ø geometric", "rând listă", "preț"],
            r.straturi.map((s) => `<tr>
              <td>${esc(s.sistem.replace("_", " "))}${s.grosime_mm ? ` ${s.grosime_mm} mm` : ""}</td>
              <td class="n">${s.diametru_geometric.toFixed(1)}</td>
              <td class="n">${s.rand_lista}</td>
              <td class="n">${eur(s.pret_unitar)}</td></tr>`),
            ["", "n", "n", "n"])}
          ${nota("Fiecare strat se rotunjește separat la 2 zecimale, apoi se însumează. Diametrul geometric pornește de la rândul primului strat și crește cu 2 × grosime.")}`;
      } catch (e) {
        const p = e instanceof PozitieNetarifata;
        $("#iesire").innerHTML = `
          <div class="alerta"><strong>Poziție netarifabilă</strong>${esc(e instanceof Error ? e.message : String(e))}</div>
          ${nota(p
            ? "Golul din matricea de prețuri înseamnă „nu se ofertează”, nu „preț zero”. Poziția se marchează pentru tarifare manuală — nu se ghicește."
            : "Verifică datele introduse.")}`;
      }
    }

    $("#straturi").append(randStrat("elastomer", 13));
    $("#adauga").addEventListener("click", () => { $("#straturi").append(randStrat("vata_minerala", 40)); calc(); });
    for (const id of ["#diam", "#tipDiam", "#forma", "#cant"]) $(id).addEventListener("input", calc);

    for (const chip of root.querySelectorAll<HTMLButtonElement>(".chip")) {
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
  },
};
