import { MENIU, ROLURI, VIITOR, setRol, rolActiv, type Rol } from "./nav.js";
import { esc, type Ecran } from "./ecrane/tip.js";
import { icoana } from "./icoane.js";
import {
  citesteMeniu, scrieMeniu, inverseaza, laCerere, stareEfectiva, EVENIMENT_SPATIU, FARA_CERERE,
  type SpatiuCerut, type StareMeniu,
} from "./meniu-stare.js";
import {
  amMutat, areDateDeMutat, cereLink, confirmaLink, dateInBrowser, EroareServer, euCurent, iesi, laEroare,
  laReimprospatare, modDate, mutaDinBrowser, porneste, reimprospateaza,
} from "./date.js";

const ECRANE: Record<string, () => Promise<{ ecran: Ecran }>> = {
  tablou: () => import("./ecrane/tablou.js"),
  lucrari: () => import("./ecrane/lucrari.js"),
  documente: () => import("./ecrane/documente.js"),
  deviz: () => import("./ecrane/deviz.js"),
  import: () => import("./ecrane/import.js"),
  masuratori: () => import("./ecrane/santier.js"),
  stoc: () => import("./ecrane/stoc.js"),
  clienti: () => import("./ecrane/clienti.js"),
  preturi: () => import("./ecrane/preturi.js"),
};

/** Rutele vechi, dinainte ca cererile si ofertele sa ajunga pe acelasi ecran. */
const ALIAS: Record<string, string> = { cereri: "documente", oferte: "documente", santier: "masuratori" };

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
  // Cererea de spatiu e a ecranului care pleaca. Se retrage INAINTE de randare:
  // importul isi redeschide singur sesiunea in `render` si o cere din nou.
  renuntaLaSpatiu();
  const root = $("#ecran");

  // Linkul din email: `#/intrare/<token>`. Tokenul se trimite cu POST, din pagina,
  // ca scanerele de email (care deschid linkurile) sa nu-l consume.
  const token = /^#\/intrare\/(.+)$/.exec(location.hash)?.[1];
  if (token) { await intraCuLink(token); return; }
  if (stareDate === "intrare") { deseneazaIntrare(); return; }
  if (stareDate === "fara-server") { deseneazaFaraServer(); return; }

  delete document.documentElement.dataset["intrare"];
  const id = ruta();
  const incarca = ECRANE[id];

  if (!incarca) {
    root.innerHTML = `<div class="titlu-ecran"><h1>Ecran inexistent</h1>
      <p>Adresa <code>${esc(id)}</code> nu corespunde niciunui ecran.
      <a href="#/tablou">Înapoi la tabloul de bord</a>.</p></div>`;
    deseneazaMeniu();
    laInceput();
    return;
  }

  root.innerHTML = `<p class="nota">Se încarcă…</p>`;
  // Pe server, datele se iau la fiecare ecran: ce a scris un coleg intre timp se vede.
  try {
    await reimprospateaza();
  } catch (e) {
    if (e instanceof EroareServer && e.status === 401) { stareDate = "intrare"; deseneazaIntrare(); return; }
    arataEroare(`Datele nu s-au putut lua de pe server: ${e instanceof Error ? e.message : String(e)}. Se arată ultimele primite.`);
  }
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
let spatiu: SpatiuCerut = FARA_CERERE;

function aplicaBara(): void {
  const efectiva = stareEfectiva(stareBara, spatiu);
  radacina.dataset["meniu"] = efectiva;
  const sertar = MOBIL.matches && sertarDeschis;
  if (sertar) radacina.dataset["sertar"] = "deschis";
  else delete radacina.dataset["sertar"];
  $("#fundal-sertar").hidden = !sertar;

  const deschisa = MOBIL.matches ? sertarDeschis : efectiva === "extins";
  const buton = $<HTMLButtonElement>("#pliaza");
  const eticheta = deschisa ? "Ascunde meniul" : "Arată meniul";
  buton.setAttribute("aria-expanded", String(deschisa));
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
  } else if (spatiu.pliatTemporar) {
    // Pliata de ecran, nu de om: o redeschide fara sa-i schimbe preferinta.
    spatiu = { ...spatiu, pliatTemporar: false };
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

function renuntaLaSpatiu(): void {
  if (spatiu === FARA_CERERE) return;
  spatiu = FARA_CERERE;
  aplicaBara();
}

// Importul cere toata latimea cand arata foaia clientului: bara se pliaza,
// temporar. Vezi `laCerere` in meniu-stare.ts.
document.addEventListener(EVENIMENT_SPATIU, (e) => {
  const inainte = spatiu;
  spatiu = laCerere(spatiu, (e as CustomEvent<boolean>).detail, stareBara, MOBIL.matches);
  if (spatiu === inainte) return;
  // Fara animatie: ecranul isi masoara latimea imediat dupa cerere.
  radacina.dataset["faraTranzitie"] = "";
  aplicaBara();
  void radacina.offsetWidth;
  requestAnimationFrame(() => delete radacina.dataset["faraTranzitie"]);
});

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
  { id: "sistem", eticheta: "Automat" },
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

/* ---------------------------------------------- datele comune: intrarea */

/*
 * Unde stau datele se afla la pornire (`porneste` din date.ts): pe server, cu
 * cont, sau in browser, pe linkul demo. Pana intra omul, orice ruta arata
 * formularul de intrare.
 */
let stareDate: "browser" | "server" | "intrare" | "fara-server" = "browser";
let eroarePornire = "";

function arataEroare(mesaj: string): void {
  const el = document.createElement("p");
  el.className = "alerta";
  el.setAttribute("role", "alert");
  el.innerHTML = `<span>${esc(mesaj)}</span><button type="button" class="secundar">Am înțeles</button>`;
  el.querySelector("button")!.addEventListener("click", () => el.remove());
  $("#mesaje").append(el);
}
laEroare(arataEroare);
// Dupa o scriere refuzata, ecranul se deseneaza din copia noua (date.ts).
laReimprospatare(() => { void navigheaza(); });

function deseneazaCont(): void {
  const eu = euCurent();
  const cont = $("#cont");
  cont.hidden = !eu;
  if (!eu) { cont.innerHTML = ""; return; }
  cont.innerHTML = `<span class="nume" title="${esc(eu.email)}">${esc(eu.nume)}</span>
    <button type="button" class="secundar" id="iesi">Ieși</button>`;
  $("#iesi").addEventListener("click", async () => {
    try { await iesi(); } catch { /* sesiunea moare oricum la expirare */ }
    stareDate = "intrare";
    deseneazaCont();
    location.hash = "#/tablou";
    deseneazaIntrare();
  });
}

function pregatesteIntrare(titlu: string, subtitlu: string): HTMLElement {
  document.documentElement.dataset["intrare"] = "";
  document.title = `${titlu} · IzoERP`;
  const root = $("#ecran");
  root.innerHTML = `<div class="titlu-ecran"><h1>${esc(titlu)}</h1><p>${esc(subtitlu)}</p></div><div id="continut"></div>`;
  laInceput();
  return $("#continut");
}

function deseneazaIntrare(mesaj = ""): void {
  const c = pregatesteIntrare("Intră în aplicație", "Fără parolă: primești un link pe email.");
  c.innerHTML = `<div class="imp intrare"><section class="imp-card">
    <form class="imp-formular" id="form-intrare" novalidate>
      <label>Adresa ta de email
        <input type="email" name="email" autocomplete="email" required inputmode="email">
      </label>
      ${mesaj ? `<p class="alerta" role="alert">${esc(mesaj)}</p>` : ""}
      <div class="imp-formular-butoane"><button type="submit" class="primar">Trimite-mi linkul</button></div>
    </form></section></div>`;
  const form = $<HTMLFormElement>("#form-intrare");
  form.querySelector("input")!.focus();
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = String(new FormData(form).get("email") ?? "").trim();
    if (!email.includes("@")) { deseneazaIntrare("Scrie adresa de email cu care ai primit cont."); return; }
    const buton = form.querySelector<HTMLButtonElement>("button")!;
    buton.disabled = true;
    buton.textContent = "Se trimite…";
    try {
      await cereLink(email);
      c.innerHTML = `<div class="imp intrare"><section class="imp-card">
        <h2>Verifică emailul</h2>
        <p style="margin:0">Dacă <strong>${esc(email)}</strong> are cont, ți-am trimis un link. Deschide-l pe acest
          calculator, în următoarele 15 minute. Linkul merge o singură dată.</p>
        <div class="imp-formular-butoane"><button type="button" class="secundar" id="alt-email">Altă adresă</button></div>
      </section></div>`;
      $("#alt-email").addEventListener("click", () => deseneazaIntrare());
    } catch (err) {
      deseneazaIntrare(`Linkul nu s-a putut trimite: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
}

async function intraCuLink(token: string): Promise<void> {
  pregatesteIntrare("Intră în aplicație", "Se verifică linkul…");
  try {
    await confirmaLink(token);
  } catch (e) {
    stareDate = "intrare";
    history.replaceState(null, "", "#/tablou");
    deseneazaIntrare(e instanceof Error ? e.message : "Linkul nu mai e valabil. Cere altul.");
    return;
  }
  stareDate = "server";
  delete document.documentElement.dataset["intrare"];
  deseneazaCont();
  location.hash = "#/tablou";
  void propuneMutarea();
}

function deseneazaFaraServer(): void {
  const c = pregatesteIntrare("Serverul nu răspunde", "Datele firmei stau pe server.");
  c.innerHTML = `<p class="alerta" role="alert">${esc(eroarePornire)}</p>`;
}

/**
 * Ce a ramas in browserul asta din vremea prototipului, cand datele stateau
 * aici: un singur buton le muta pe server. Mutarea nu dubleaza nimic, deci
 * butonul se poate apasa si a doua oara fara grija.
 */
async function propuneMutarea(): Promise<void> {
  if (stareDate !== "server" || modDate() !== "server" || amMutat() || $("#card-mutare")) return;
  const d = await dateInBrowser();
  if (!areDateDeMutat(d) || $("#card-mutare")) return;
  const miscari = d.depozit.miscari.filter((m) => !m.exemplu).length;
  const parti = [
    [d.cereri.length, "cerere importată", "cereri importate"],
    [d.planuri.length, "șantier", "șantiere"],
    [miscari, "mișcare de stoc", "mișcări de stoc"],
  ].filter(([n]) => (n as number) > 0).map(([n, unu, multe]) => `${n} ${n === 1 ? unu : multe}`);
  // In `.imp`, ca pe ecrane: de acolo vin spatiile cardului si latimea butonului.
  const invelis = document.createElement("div");
  invelis.className = "imp";
  invelis.id = "card-mutare";
  const card = document.createElement("section");
  card.className = "imp-card";
  invelis.append(card);
  card.innerHTML = `<h2>Datele din acest browser</h2>
    <p style="margin:0">Aici au rămas ${esc(parti.join(", "))} din perioada în care aplicația ținea datele doar pe
      calculator. Mută-le pe server, ca să le vadă și colegii. Datele de exemplu nu se mută.</p>
    <div class="imp-formular-butoane"><button type="button" class="primar">Mută datele pe server</button></div>`;
  const buton = card.querySelector("button")!;
  buton.addEventListener("click", async () => {
    buton.disabled = true;
    buton.textContent = "Se mută…";
    try {
      const r = await mutaDinBrowser();
      const total = r.cereri + r.oferte + r.santiere + r.situatii + r.miscari + r.necesare + r.ambalaje;
      card.innerHTML = `<h2>Datele au fost mutate</h2>
        <p style="margin:0">${total === 0 ? "Totul era deja pe server." : esc(
          `Au intrat: ${r.cereri} cereri, ${r.oferte} oferte, ${r.santiere} șantiere cu ${r.situatii} situații, ` +
          `${r.miscari} mișcări de stoc, ${r.necesare} necesaruri de materiale.`)}${
          r.oferteFaraCerere > 0 ? esc(` ${r.oferteFaraCerere} oferte n-au mai avut cererea în browser și nu s-au mutat.`) : ""}</p>
        <div class="imp-formular-butoane"><button type="button" class="secundar">Am înțeles</button></div>`;
      card.querySelector("button")!.addEventListener("click", () => invelis.remove());
      void navigheaza();
    } catch (e) {
      buton.disabled = false;
      buton.textContent = "Mută datele pe server";
      arataEroare(`Mutarea nu a reușit: ${e instanceof Error ? e.message : String(e)}`);
    }
  });
  $("#mesaje").prepend(invelis);
}

addEventListener("hashchange", () => void navigheaza(true));

void (async () => {
  try {
    stareDate = await porneste();
  } catch (e) {
    stareDate = "fara-server";
    eroarePornire = e instanceof Error ? e.message : String(e);
  }
  if (stareDate === "server") delete document.documentElement.dataset["intrare"];
  deseneazaCont();
  await navigheaza();
  void propuneMutarea();
})();
