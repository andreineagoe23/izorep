import { MENIU, ROLURI, VIITOR, setRol, rolActiv, type Rol } from "./nav.js";
import { esc, type Ecran } from "./ecrane/tip.js";
import { CURS_BNR } from "./date/seed.js";

const ECRANE: Record<string, () => Promise<{ ecran: Ecran }>> = {
  tablou: () => import("./ecrane/tablou.js"),
  lucrari: () => import("./ecrane/lucrari.js"),
  documente: () => import("./ecrane/documente.js"),
  deviz: () => import("./ecrane/deviz.js"),
  import: () => import("./ecrane/import.js"),
  clienti: () => import("./ecrane/clienti.js"),
  preturi: () => import("./ecrane/preturi.js"),
};

/** Rutele vechi, dinainte ca cererile si ofertele sa ajunga pe acelasi ecran. */
const ALIAS: Record<string, string> = { cereri: "documente", oferte: "documente" };

const $ = <T extends HTMLElement>(s: string) => document.querySelector(s) as T;

const ruta = (): string => {
  const id = location.hash.replace(/^#\/?/, "") || "tablou";
  return ALIAS[id] ?? id;
};

function deseneazaMeniu(): void {
  const activ = ruta();
  const grupuri = MENIU.map((g) => `
    <div class="grup">
      <h3>${esc(g.titlu)}</h3>
      ${g.itemi.map((i) => `<a href="#/${i.id}" class="item"${
        i.id === activ ? ' aria-current="page"' : ""
      }>${esc(i.eticheta)}</a>`).join("")}
    </div>`).join("");

  // Harta sistemului ramane vizibila, dar pliata: clientul vede unde se ajunge
  // fara ca navigatia zilnica sa fie pe jumatate goala.
  const viitor = `
    <details class="viitor">
      <summary>Module care urmează (${VIITOR.length})</summary>
      <ul>${VIITOR.map((m) => `<li>${esc(m)}</li>`).join("")}</ul>
    </details>`;

  $("#meniu").innerHTML = grupuri + viitor;
}

async function navigheaza(mutaFocus = false): Promise<void> {
  const id = ruta();
  const incarca = ECRANE[id];
  const root = $("#ecran");

  if (!incarca) {
    root.innerHTML = `<div class="titlu-ecran"><h1>Ecran inexistent</h1>
      <p>Adresa <code>${esc(id)}</code> nu corespunde niciunui ecran.
      <a href="#/tablou">Înapoi la tabloul de bord</a>.</p></div>`;
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
  // Dupa o navigare din meniu, focusul trece pe continut: altfel cititorul de
  // ecran ramane pe link si nu anunta ca s-a schimbat ecranul.
  if (mutaFocus) root.focus();
}

/* ------------------------------------------------------------------- tema */

type Tema = "sistem" | "light" | "dark";
const TEME: { id: Tema; eticheta: string }[] = [
  { id: "sistem", eticheta: "Sistem" },
  { id: "light", eticheta: "Deschis" },
  { id: "dark", eticheta: "Închis" },
];

const citesteTema = (): Tema => {
  try {
    const t = localStorage.getItem("izorep-tema");
    return t === "light" || t === "dark" ? t : "sistem";
  } catch {
    return "sistem"; // localStorage blocat (fereastra privata, cookies off)
  }
};

/**
 * "sistem" inseamna absenta atributului, nu o a treia paleta: asa raspunde
 * pagina la schimbarea temei din sistem in timp ce e deschisa.
 */
function aplicaTema(t: Tema): void {
  if (t === "sistem") delete document.documentElement.dataset["tema"];
  else document.documentElement.dataset["tema"] = t;
  try {
    if (t === "sistem") localStorage.removeItem("izorep-tema");
    else localStorage.setItem("izorep-tema", t);
  } catch { /* preferinta nu se retine, dar tema se aplica */ }
  deseneazaTema(t);
}

function deseneazaTema(activ: Tema): void {
  $("#tema").innerHTML = TEME.map((t) =>
    `<button type="button" data-tema="${t.id}" aria-pressed="${t.id === activ}">${esc(t.eticheta)}</button>`,
  ).join("");
}

deseneazaTema(citesteTema());
$("#tema").addEventListener("click", (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-tema]");
  if (b) aplicaTema(b.dataset["tema"] as Tema);
});

/* ------------------------------------------------------------------- rol */

$("#rol").innerHTML = ROLURI.map((r) =>
  `<option value="${r.id}"${r.id === rolActiv ? " selected" : ""}>${esc(r.eticheta)}</option>`).join("");
$("#rol").addEventListener("change", (e) => {
  setRol((e.target as HTMLSelectElement).value as Rol);
  void navigheaza();
});

// Rutarea e pe hash, deci un link ancora ar strica ruta: sarim cu focus.
$("#sari").addEventListener("click", () => $("#ecran").focus());

$("#curs").textContent = `1 € = ${CURS_BNR.toFixed(4)} lei`;
addEventListener("hashchange", () => void navigheaza(true));
void navigheaza();
