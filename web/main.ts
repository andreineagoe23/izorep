import { MENIU, ROLURI, VIITOR, setRol, rolActiv, type Rol } from "./nav.js";
import { esc, type Ecran } from "./ecrane/tip.js";
import { CURS_BNR } from "./date/seed.js";
import { icoana } from "./icoane.js";
import { citesteMeniu, scrieMeniu, inverseaza, type StareMeniu } from "./meniu-stare.js";

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

/*
 * Ecran nou inseamna pagina noua: se citeste de la inceput.
 *
 * Rutarea e pe hash, deci nu exista navigare reala care sa mute scroll-ul —
 * fara asta, treci de pe lista de lucrari derulata la jumatate pe tabloul de
 * bord si aterizezi in mijlocul lui.
 */
const laInceput = (): void => scrollTo({ top: 0, left: 0, behavior: "auto" });

/*
 * La refresh, browserul restaureaza singur pozitia. Aici e gresit de doua ori:
 * ecranul se redeseneaza de la zero, deci pozitia veche nu mai corespunde
 * aceluiasi continut, iar unele ecrane isi randeaza continutul dupa un `await`,
 * cand restaurarea deja s-a intamplat. Preluam noi treaba, in `navigheaza`.
 *
 * Costul, asumat: si butonul de inapoi aduce sus, nu unde erai.
 */
if ("scrollRestoration" in history) history.scrollRestoration = "manual";

const ruta = (): string => {
  const id = location.hash.replace(/^#\/?/, "") || "tablou";
  return ALIAS[id] ?? id;
};

function deseneazaMeniu(): void {
  const activ = ruta();
  // Eticheta e mereu in marcaj, si cand bara e pliata: acolo CSS-ul o muta
  // langa item ca tooltip. Ascunsa cu `display:none` ar disparea si din numele
  // accesibil al linkului, iar pe banda ar ramane sapte linkuri fara nume.
  const grupuri = MENIU.map((g) => `
    <div class="grup">
      <h3>${esc(g.titlu)}</h3>
      ${g.itemi.map((i) => `<a href="#/${i.id}" class="item"${
        i.id === activ ? ' aria-current="page"' : ""
      }>${icoana(i.id)}<span class="eticheta-item">${esc(i.eticheta)}</span></a>`).join("")}
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
  inchideSertar();
  const id = ruta();
  const incarca = ECRANE[id];
  const root = $("#ecran");

  if (!incarca) {
    root.innerHTML = `<div class="titlu-ecran"><h1>Ecran inexistent</h1>
      <p>Adresa <code>${esc(id)}</code> nu corespunde niciunui ecran.
      <a href="#/tablou">Înapoi la tabloul de bord</a>.</p></div>`;
    deseneazaMeniu();
    laInceput();
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
  laInceput();
  // Dupa o navigare din meniu, focusul trece pe continut: altfel cititorul de
  // ecran ramane pe link si nu anunta ca s-a schimbat ecranul.
  // `preventScroll`, altfel focusarea trage pagina inapoi peste `laInceput`.
  if (mutaFocus) root.focus({ preventScroll: true });
}

/* ------------------------------------------------------------ bara laterala */

/*
 * Un singur buton pentru doua comportamente, pentru ca sunt aceeasi intentie:
 * "da meniul la o parte". Pe ecran larg bara se plieaza la o banda de
 * pictograme si preferinta se retine; pe ecran ingust bara alunecă peste
 * continut ca sertar, iar starea lui NU se retine — un sertar deschis la
 * fiecare incarcare ar acoperi ecranul pe care omul tocmai a venit sa-l vada.
 */
const MOBIL = matchMedia("(max-width: 860px)");
const radacina = document.documentElement;

let stareBara: StareMeniu = citesteMeniu();
let sertarDeschis = false;

function aplicaBara(): void {
  radacina.dataset["meniu"] = stareBara;
  const sertar = MOBIL.matches && sertarDeschis;
  if (sertar) radacina.dataset["sertar"] = "deschis";
  else delete radacina.dataset["sertar"];
  $("#fundal-sertar").hidden = !sertar;

  const deschisa = MOBIL.matches ? sertarDeschis : stareBara === "extins";
  const buton = $<HTMLButtonElement>("#pliaza");
  const eticheta = deschisa ? "Ascunde meniul" : "Arată meniul";
  buton.setAttribute("aria-expanded", String(deschisa));
  buton.title = eticheta;
  $("#pliaza-eticheta").textContent = eticheta;
}

function inchideSertar(): void {
  if (!sertarDeschis) return;
  sertarDeschis = false;
  aplicaBara();
}

function comutaBara(): void {
  if (MOBIL.matches) {
    sertarDeschis = !sertarDeschis;
  } else {
    stareBara = inverseaza(stareBara);
    scrieMeniu(stareBara);
  }
  aplicaBara();
  // Sertarul deschis ia focusul pe primul link; inchis, focusul se intoarce pe
  // buton — altfel ar ramane pe un element care tocmai a iesit din ecran.
  if (MOBIL.matches && sertarDeschis) {
    document.querySelector<HTMLAnchorElement>("#meniu .item")?.focus();
  } else if (MOBIL.matches) {
    $("#pliaza").focus();
  }
}

// Navigarea inchide sertarul prin `navigheaza`, dar un click pe ecranul curent
// nu schimba hash-ul, deci nu ajunge acolo: sertarul ar ramane deschis peste
// exact ecranul pe care omul tocmai l-a cerut.
$("#meniu").addEventListener("click", (e) => {
  if ((e.target as HTMLElement).closest(".item")) inchideSertar();
});

$("#pliaza").insertAdjacentHTML("afterbegin", icoana("bara"));
$("#pliaza").addEventListener("click", comutaBara);
$("#fundal-sertar").addEventListener("click", inchideSertar);
addEventListener("keydown", (e) => {
  if (e.key === "Escape" && sertarDeschis) {
    inchideSertar();
    $("#pliaza").focus();
  }
});
// Trecerea peste prag lasa in urma un sertar deschis care, pe ecran larg, nu
// mai are cum sa fie inchis: fundalul lui dispare odata cu media query-ul.
MOBIL.addEventListener("change", () => {
  sertarDeschis = false;
  aplicaBara();
});
aplicaBara();

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
