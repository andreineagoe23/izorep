import { MENIU, ROLURI, VIITOR, setRol, rolActiv, type Rol } from "./nav.js";
import { esc, type Ecran } from "./ecrane/tip.js";
import { campParola, legaArataParola } from "./parola-vizual.js";
import { icoana } from "./icoane.js";
import {
  citesteMeniu, scrieMeniu, inverseaza, laCerere, stareEfectiva, EVENIMENT_SPATIU, FARA_CERERE,
  type SpatiuCerut, type StareMeniu,
} from "./meniu-stare.js";
import {
  amMutat, areDateDeMutat, cursBnr, dateInBrowser, eu, iesi, intra, laEroare, laNeautentificat,
  laReimprospatare, modDate, mutaDinBrowser, porneste, reimprospateaza, schimbaParola,
} from "./date.js";

const ECRANE: Record<string, () => Promise<{ ecran: Ecran }>> = {
  tablou: () => import("./ecrane/tablou.js"),
  lucrari: () => import("./ecrane/lucrari.js"),
  documente: () => import("./ecrane/documente.js"),
  deviz: () => import("./ecrane/deviz.js"),
  import: () => import("./ecrane/import.js"),
  masuratori: () => import("./ecrane/santier.js"),
  materiale: () => import("./ecrane/stoc.js"),
  comenzi: () => import("./ecrane/comenzi.js"),
  depozit: () => import("./ecrane/depozit.js"),
  clienti: () => import("./ecrane/clienti.js"),
  preturi: () => import("./ecrane/preturi.js"),
  cont: () => import("./ecrane/cont.js"),
  jurnal: () => import("./ecrane/jurnal.js"),
};

/** Rutele vechi: cererile si ofertele pe acelasi ecran; „Necesar și depozit” (`stoc`) e „Materiale” din 21 octombrie 2026. */
const ALIAS: Record<string, string> = {
  cereri: "documente", oferte: "documente", santier: "masuratori", santiere: "lucrari", stoc: "materiale",
};

/** Filele unui ecran din meniu: pe ele, itemul lui ramane aprins. */
const IN_MENIU: Record<string, string> = { comenzi: "materiale", depozit: "materiale" };

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

/** Ecranul din adresa; ce e dupa al doilea „/” (`#/depozit/istoric`) e pagina din ecran, a lui de citit. */
const ruta = (): string => {
  const id = location.hash.replace(/^#\/?/, "").split("/")[0] || "tablou";
  return ALIAS[id] ?? id;
};

function deseneazaMeniu(): void {
  const activ = IN_MENIU[ruta()] ?? ruta();
  // Eticheta e mereu in marcaj, si cand bara e pliata: acolo CSS-ul o muta
  // langa item ca tooltip. Ascunsa cu `display:none` ar disparea si din numele
  // accesibil al linkului, iar pe banda ar ramane sapte linkuri fara nume.
  const grupuri = MENIU.map((g) => `
    <div class="grup">
      ${g.titlu ? `<h3>${esc(g.titlu)}</h3>` : ""}
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

  if (stareDate === "fara-server") { deseneazaFaraServer(); return; }
  // Pe server, fără cont intrat: pagina de intrare; cu parola dată de noi: alegerea parolei.
  if (stareDate === "server" && !eu()) { deseneazaIntrarea(); return; }
  if (stareDate === "server" && eu()?.parolaTemporara) { deseneazaParolaNoua(); return; }
  arataOmul();

  delete document.documentElement.dataset["faraMeniu"];
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
    arataEroare(`Nu am putut aduce datele noi: ${e instanceof Error ? e.message : String(e)}. Vezi datele de mai devreme.`);
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

/* --------------------------------------------- datele comune: serverul */

/*
 * Unde stau datele se afla la pornire (`porneste` din date.ts): pe server, sau
 * in browser, pe linkul demo. Fara intrare: conturile au fost scoase pe
 * 10 octombrie 2026, pana devin necesare.
 */
let stareDate: "browser" | "server" | "fara-server" = "browser";
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

function deseneazaFaraServer(): void {
  document.documentElement.dataset["faraMeniu"] = "";
  document.title = "Aplicația nu se deschide · IzoERP";
  $("#ecran").innerHTML = `<div class="titlu-ecran"><h1>Aplicația nu se deschide acum</h1><p>Încearcă din nou peste câteva minute.</p></div>
    <div id="continut"><p class="alerta" role="alert">${esc(eroarePornire)}</p></div>`;
  laInceput();
}

/* ------------------------------------------------------------ intrarea */

/*
 * Pagina de intrare (21 octombrie 2026), în locul ferestrei de parolă a
 * browserului: emailul și parola omului, „Intră”. Fără meniu până intră.
 * După intrare pagina se reîncarcă: datele, cursul și meniul pornesc curat.
 */
function faraMeniu(titlu: string): void {
  document.documentElement.dataset["faraMeniu"] = "";
  // Pagina de intrare e pe tot ecranul: fără bara laterală și fără antet.
  document.documentElement.dataset["intrare"] = "";
  document.title = `${titlu} · IzoERP`;
  $("#om").hidden = true;
}

/**
 * Sus pe paginile de intrare: logo-urile celor două firme, din ofertele lor
 * (RADOIA pe 284, ISORAD pe 118), centrate pe o plăcuță albă (JPEG-urile au fond
 * alb, deci și în tema închisă arată ca în Excel), apoi doar titlul: „IzoERP”
 * și numele firmei au plecat (Andrei, 22 octombrie 2026).
 */
function antetIntrare(titlu: string): string {
  return `<div class="intrare-sus">
    <div class="intrare-logo">
      <img src="logo-radoia.jpg" alt="RADOIA ISOLIRUNG" width="218" height="40" />
      <img src="logo-isorad.jpg" alt="ISORAD System Engineering Insulation" width="150" height="68" />
    </div>
    <h1>${esc(titlu)}</h1>
  </div>`;
}

function deseneazaIntrarea(mesaj = ""): void {
  faraMeniu("Intră în cont");
  $("#ecran").innerHTML = `<div class="intrare">
    ${antetIntrare("Intră în cont")}
    <section class="imp-card">
      <form id="form-intrare" novalidate>
        <label>Emailul<input name="email" type="email" autocomplete="username" inputmode="email" required /></label>
        ${campParola("Parola", "parola", "current-password", "required")}
        <p class="alerta" role="alert"${mesaj ? "" : " hidden"}>${esc(mesaj)}</p>
        <button type="submit" class="primar">Intră</button>
      </form>
    </section>
  </div>`;
  const f = $<HTMLFormElement>("#form-intrare");
  legaArataParola(f);
  f.querySelector<HTMLInputElement>('[name="email"]')!.focus();
  f.addEventListener("submit", async (e) => {
    e.preventDefault();
    const d = new FormData(f);
    const email = String(d.get("email") ?? "").trim();
    const parola = String(d.get("parola") ?? "");
    const alerta = f.querySelector<HTMLElement>(".alerta")!;
    if (!email || !parola) { alerta.textContent = "Scrie emailul și parola."; alerta.hidden = false; return; }
    const buton = f.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    buton.disabled = true;
    buton.textContent = "Se verifică…";
    const gresit = await intra(email, parola);
    if (!gresit) { location.reload(); return; }
    alerta.textContent = gresit;
    alerta.hidden = false;
    buton.disabled = false;
    buton.textContent = "Intră";
    f.querySelector<HTMLInputElement>('[name="parola"]')!.select();
  });
  laInceput();
}


/** Intrat cu parola dată de noi: își alege una a lui înainte de orice. */
function deseneazaParolaNoua(): void {
  faraMeniu("Alege-ți parola");
  $("#ecran").innerHTML = `<div class="intrare">
    ${antetIntrare("Alege-ți parola")}
    <p class="hint" style="margin:0;text-align:center">Ai intrat cu o parolă primită. Alege una a ta, de cel puțin 10 caractere.</p>
    <section class="imp-card">
      <form id="form-parola" novalidate>
        ${campParola("Parola primită", "veche", "current-password", "required")}
        ${campParola("Parola nouă", "noua", "new-password", 'minlength="10" required')}
        <label>Parola nouă, încă o dată<input name="repeta" type="password" autocomplete="new-password" required /></label>
        <p class="alerta" role="alert" hidden></p>
        <button type="submit" class="primar">Salvează parola</button>
      </form>
    </section>
    <p><button type="button" class="legatura" id="iesi-parola">Ieși</button></p>
  </div>`;
  const f = $<HTMLFormElement>("#form-parola");
  legaArataParola(f);
  $("#iesi-parola").addEventListener("click", () => void iesi().then(() => location.reload()));
  f.addEventListener("submit", async (e) => {
    e.preventDefault();
    const d = new FormData(f);
    const alerta = f.querySelector<HTMLElement>(".alerta")!;
    const noua = String(d.get("noua") ?? "");
    if (noua !== String(d.get("repeta") ?? "")) { alerta.textContent = "Cele două parole noi nu sunt la fel."; alerta.hidden = false; return; }
    const gresit = await schimbaParola(String(d.get("veche") ?? ""), noua);
    if (!gresit) { location.reload(); return; }
    alerta.textContent = gresit;
    alerta.hidden = false;
  });
  laInceput();
}

/** În antet, numele omului (spre „Contul meu”) și „Ieși”. */
function arataOmul(): void {
  const om = eu();
  const el = $("#om");
  if (!om) { el.hidden = true; return; }
  el.innerHTML = `<a href="#/cont" title="Contul meu">${esc(om.nume)}</a>
    <button type="button" class="pliaza antet-iesi" id="iesi" aria-label="Ieși din cont" title="Ieși din cont">${icoana("iesi")}</button>`;
  el.hidden = false;
}

document.addEventListener("click", (e) => {
  if ((e.target as HTMLElement).closest("#iesi")) void iesi().then(() => { location.hash = ""; location.reload(); });
});

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

/*
 * Cursul BNR in antet (21 octombrie 2026): doar de citit. Oferta e in euro, iar
 * la depozit si la comenzi se foloseste cursul de pe document, deci cifra de
 * aici nu intra in nicio suma. BNR il schimba o data pe zi; pagina il reia din
 * ora in ora, pentru cine o tine deschisa de ieri.
 */
async function arataCursul(): Promise<void> {
  const c = await cursBnr();
  const el = $("#curs");
  if (!c) { el.hidden = true; return; }
  const zi = new Date(`${c.data}T12:00:00`).toLocaleDateString("ro-RO", { day: "numeric", month: "short" });
  const lei = c.eur.toLocaleString("ro-RO", { minimumFractionDigits: 4, maximumFractionDigits: 4 });
  // Pe telefon ziua si „1 € =” ies: ramane „Curs BNR: 5,3297 lei”.
  el.innerHTML = `Curs BNR<span class="antet-curs-lung"> ${esc(zi)}</span>: <span class="antet-curs-lung">1 € = </span>${esc(lei)} lei`;
  el.title = `Cursul BNR din ${zi}. Doar informativ: prețurile din oferte nu se schimbă după el.`;
  el.hidden = false;
}

addEventListener("hashchange", () => void navigheaza(true));
// Sesiunea s-a încheiat în timpul lucrului (expirată, ieșit din alt tab): intrarea, cu motivul.
laNeautentificat(() => { if (stareDate === "server") deseneazaIntrarea("Sesiunea s-a încheiat: intră din nou în cont."); });

void (async () => {
  try {
    stareDate = await porneste();
  } catch (e) {
    stareDate = "fara-server";
    eroarePornire = e instanceof Error ? e.message : String(e);
  }
  await navigheaza();
  void propuneMutarea();
  if (stareDate === "server" && eu() && !eu()!.parolaTemporara) {
    void arataCursul();
    setInterval(() => void arataCursul(), 60 * 60 * 1000);
  }
})();
