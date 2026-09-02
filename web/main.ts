import { MENIU, ROLURI, setRol, rolActiv, type Rol } from "./nav.js";
import { esc, type Ecran } from "./ecrane/tip.js";
import { CURS_BNR } from "./date/seed.js";

/** Ecranele construite. Restul apar in meniu ca destinatii viitoare. */
const ECRANE: Record<string, () => Promise<{ ecran: Ecran }>> = {
  tablou: () => import("./ecrane/tablou.js"),
  lucrari: () => import("./ecrane/lucrari.js"),
  clienti: () => import("./ecrane/clienti.js"),
  cereri: () => import("./ecrane/cereri.js"),
  deviz: () => import("./ecrane/deviz.js"),
  oferte: () => import("./ecrane/oferte.js"),
  preturi: () => import("./ecrane/preturi.js"),
  import: () => import("./ecrane/import.js"),
};

const $ = <T extends HTMLElement>(s: string) => document.querySelector(s) as T;

function deseneazaMeniu(): void {
  const activ = ruta();
  $("#meniu").innerHTML = MENIU.map((g) => `
    <div class="grup">
      <h3>${esc(g.titlu)}</h3>
      ${g.itemi.map((i) => i.construit
        ? `<a href="#/${i.id}" class="item${i.id === activ ? " activ" : ""}">${esc(i.eticheta)}</a>`
        : `<span class="item viitor" title="Face parte din sistem, dar nu e construit încă">${esc(i.eticheta)}<i>urmează</i></span>`
      ).join("")}
    </div>`).join("");
}

const ruta = (): string => location.hash.replace(/^#\/?/, "") || "tablou";

async function navigheaza(): Promise<void> {
  const id = ruta();
  const incarca = ECRANE[id];
  const root = $("#ecran");

  if (!incarca) {
    root.innerHTML = `<div class="titlu-ecran"><h1>Nu e construit încă</h1>
      <p>Ecranul <code>${esc(id)}</code> face parte din sistem, dar nu e livrat în această etapă.</p></div>`;
    deseneazaMeniu();
    return;
  }

  root.innerHTML = `<p class="nota">Se încarcă…</p>`;
  const { ecran } = await incarca();
  root.innerHTML = `<div class="titlu-ecran">
      <h1>${esc(ecran.titlu)}</h1>
      ${ecran.subtitlu ? `<p>${esc(ecran.subtitlu)}</p>` : ""}
    </div><div id="continut"></div>`;
  await ecran.render($("#continut"));
  deseneazaMeniu();
  document.title = `${ecran.titlu} · IzoERP`;
}

$("#rol").innerHTML = ROLURI.map((r) =>
  `<option value="${r.id}"${r.id === rolActiv ? " selected" : ""}>${esc(r.eticheta)}</option>`).join("");
$("#rol").addEventListener("change", (e) => {
  setRol((e.target as HTMLSelectElement).value as Rol);
  void navigheaza();
});

$("#curs").textContent = `1 € = ${CURS_BNR.toFixed(4)} lei`;
addEventListener("hashchange", () => void navigheaza());
void navigheaza();
