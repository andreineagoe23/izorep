import type { LinieProcesata } from "../../src/import/nucleu.js";
import type { Destinatie } from "../../src/pricing/lists.js";
import type { DocumentOferta, PozitieOferta } from "../document-oferta.js";
import { cate, dataScurta, esc, eur } from "../ecrane/tip.js";
import type { CampuriRand } from "../../src/import/editare.js";
import { inteles, STARE } from "./text.js";
import type { OrigineImport } from "../istoric.js";
import {
  SEGMENT, actiuniPozitie, alegereSegment, detaliuValoare, editorPozitie, starePozitie, type FiltruStare,
} from "./vizual.js";

/**
 * Pasul „Oferta”: șablonul ofertei pe ecran, același pentru orice fișier.
 *
 * Până la 11 octombrie 2026 verificarea arăta foaia clientului 1:1, deci
 * fiecare import avea alt tabel: 12 fișiere, 12 forme. Acum se vede ce se
 * descarcă: capitolele, numerotarea, codul și textul clientului, specificația
 * noastră, prețul, starea. Foaia clientului rămâne la un clic, ca referință
 * („rândul 114 din foaia Izolatii”). În dreapta stau totalul, filtrele, datele
 * ofertei, descărcarea, șantierul și materialele.
 *
 * Pur, ca `vizual.ts`: date in, HTML out; orice text din fișier trece prin `esc`.
 */

const numar = (n: number): string => n.toLocaleString("ro-RO", { maximumFractionDigits: 2 });
const pozitii = (n: number): string => (n === 1 ? "o poziție" : cate(n, "poziții"));

const ICOANA_FISIER = `<svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7z"/><path d="M14 3v4h4"/><path d="m9.5 12 5 5m0-5-5 5"/></svg>`;

/** Datele ofertei, scrise de om în panou; se păstrează între redesenări. */
export interface DateOferta {
  firma: string;
  numar: string;
  data: string;
  client: string;
  obiectiv: string;
  persoana: string;
  localitate: string;
  ajustare: string;
  discount: string;
}

export interface OptiuniPozitie {
  linie: LinieProcesata;
  propunere: number | null;
  editeaza: boolean;
  /** Numele foii se scrie doar când fișierul are mai multe. */
  cuFoaie: boolean;
  campuri?: CampuriRand;
}

/**
 * O poziție a ofertei: numărul, codul și textul clientului, specificația
 * noastră, ce am înțeles, prețul, starea cu acțiunea ei. Aceleași coloane
 * pentru orice fișier, pe aceeași grilă ca până acum (`.imp-poz`).
 */
export function pozitieOferta(p: PozitieOferta, o: OptiuniPozitie): string {
  const l = o.linie;
  const text = p.textClient;
  const lung = text.length > 160;
  const sursa = `rândul ${p.sursa.rand}${o.cuFoaie ? ` din foaia ${p.sursa.foaie}` : ""}`;
  return `<article class="imp-poz" data-idx="${p.linie}" data-stare="${p.stare}" aria-labelledby="poz-${p.linie}">
    <div class="imp-poz-text">
      <p class="imp-poz-nr">${p.nr !== null ? `<b title="Numărul din ofertă">${p.nr}</b>` : `<span>nu intră în ofertă</span>`}${
        p.cod ? ` · <span class="imp-poz-cod">${esc(p.cod)}</span>` : ""} · ${esc(numar(p.cantitate))} ${esc(p.um || "buc")} · <button
        type="button" class="legatura imp-poz-sursa" data-act="la-rand" data-idx="${p.linie}"
        title="Arată rândul în fișierul clientului">${esc(sursa)}</button>${
        l.sursa === "om" ? ` · <span class="imp-verificat">verificat</span>` : ""}</p>
      <p id="poz-${p.linie}" class="imp-poz-descriere${lung ? " lung" : ""}">${esc(text)}</p>
      ${lung ? `<button type="button" class="legatura imp-poz-tot" data-act="tot-textul">Tot textul</button>` : ""}
      ${p.specificatie ? `<p class="imp-poz-spec"><span>Ofertăm:</span> ${esc(p.specificatie)}</p>` : ""}
    </div>
    <ul class="imp-poz-inteles" aria-label="Ce am înțeles">${inteles(l.extras, l.pret).map((e) => `<li>${esc(e)}</li>`).join("")}${
      p.gol ? `<li>${esc(numar(p.gol.suprafata))} m²</li>` : ""}</ul>
    <div class="imp-poz-pret">${p.valoare !== null
      ? `<strong>${eur(p.valoare)}</strong><span>${eur(p.pretUnitar!)} / ${esc(p.um || "buc")}</span>`
      : `<strong class="imp-fara-pret">—</strong>`}</div>
    <div class="imp-poz-stare">${starePozitie(l)}</div>
    <div class="imp-poz-actiuni">${actiuniPozitie(l, o.propunere, o.editeaza)}</div>
    ${o.editeaza ? editorPozitie(l, o.campuri ? { campuri: o.campuri } : {}) : ""}
  </article>`;
}

export interface OptiuniPaginaOferta {
  doc: DocumentOferta;
  /** Pozițiile de desenat, deja trecute prin filtre: `null` = toate. */
  vizibile: ReadonlySet<number> | null;
  pozitie: (p: PozitieOferta) => string;
  fisier: { nume: string; cand: string; origine?: OrigineImport | undefined };
  destinatie: Destinatie;
  filtru: FiltruStare;
  /** Alertele, filtrele pe motiv și acțiunile în masă, gata desenate. */
  deasupra: string;
  detalii: string;
  date: DateOferta;
  firme: readonly { id: string; denumire: string }[];
  ajustare: number;
  materiale: string;
}

const FILTRE: [FiltruStare, string][] = [
  ["toate", "Toate"], ["gata", STARE.gata], ["de_validat", STARE.de_validat], ["netarifate", STARE.netarifate],
];

/** Totalul și ce intră în el; partea care se schimbă la fiecare tastă din „Ajustare” și „Discount”. */
export function sumaOferta(d: DocumentOferta, ajustare: number): string {
  const discount = d.discount > 0
    ? `<span>Discount ${esc(numar(d.antet.discountProcent ?? 0))} %: −${eur(d.discount)}</span><span>Total general: <b>${eur(d.totalGeneral)}</b></span>`
    : "";
  return `<p class="imp-oferta-suma"><span>Total ofertă, fără TVA</span><strong id="valoare-oferta">${eur(d.total)}</strong>
      <span>${pozitii(d.numarate.gata)} · ofertă ${SEGMENT[d.destinatie as Destinatie] ?? d.destinatie}</span>${discount}</p>
    <p class="hint" id="detaliu-valoare">${detaliuValoare(d.adaosFoc, ajustare)}</p>`;
}

function panou(o: OptiuniPaginaOferta): string {
  const d = o.doc;
  const n = d.numarate;
  const numere: Record<FiltruStare, number> = { toate: n.gata + n.de_validat + n.netarifate, ...n };
  const filtre = FILTRE.map(([f, e]) =>
    `<button type="button" class="imp-of-filtru" data-filtru="${f}"${f === "toate" ? "" : ` data-stare="${f}"`}
      aria-pressed="${f === o.filtru}"><span>${esc(e)}</span><b>${numere[f]}</b></button>`).join("");
  const camp = (nume: keyof DateOferta, eticheta: string, extra = ""): string =>
    `<label>${eticheta}<input name="${nume}" value="${esc(o.date[nume])}" ${extra} /></label>`;
  const afara = n.de_validat + n.netarifate;
  return `<div class="imp-of-panou" role="region" aria-label="Totalul și datele ofertei">
    <section class="imp-card imp-of-total" id="of-total">
      <div id="suma-oferta">${sumaOferta(d, o.ajustare)}</div>
      <div class="imp-of-filtre" role="group" aria-label="Arată pozițiile">${filtre}</div>
    </section>
    <form class="imp-card imp-formular" id="antet-oferta">
      ${alegereSegment(o.destinatie)}
      <div class="imp-campuri imp-of-campuri">
        <label>Firma<select name="firma">${o.firme.map((f) =>
          `<option value="${esc(f.id)}"${f.id === o.date.firma ? " selected" : ""}>${esc(f.denumire)}</option>`).join("")}</select></label>
        ${camp("numar", "Număr ofertă", 'required inputmode="numeric" autocomplete="off"')}
        ${camp("data", "Data", "required")}
        ${camp("client", "Beneficiar", "required")}
        ${camp("obiectiv", "Obiectiv")}
        ${camp("persoana", "În atenția")}
        ${camp("localitate", "Localitate", "required")}
        ${camp("ajustare", "Ajustare prețuri (%)", 'type="number" inputmode="decimal" min="-50" max="100" step="any" aria-describedby="ajutor-ajustare"')}
        <p class="imp-ajutor" id="ajutor-ajustare">10 = toate prețurile cu 10 % mai mari, −5 = mai mici.</p>
        ${camp("discount", "Discount (%)", 'type="number" inputmode="decimal" min="0" max="100" step="any"')}
      </div>
      ${afara > 0 ? `<p class="imp-oferta-lipsa">Oferta descărcată nu va conține ${pozitii(afara)}: ${n.de_validat} de verificat
        și ${n.netarifate} fără preț. Le găsești în fișier, pe foaia „Pentru noi”.</p>` : ""}
      <div class="imp-formular-butoane imp-of-butoane">
        <button type="submit" class="primar">Descarcă oferta</button>
        <button type="button" class="secundar" data-act="creeaza-santier">Creează șantierul</button>
      </div>
    </form>
    <details class="imp-card imp-of-materiale" id="of-materiale">
      <summary>Materiale de comandat</summary>
      ${o.materiale}
    </details>
  </div>`;
}

/** Pagina „Oferta”: capitolele în stânga, panoul în dreapta; pe telefon panoul coboară, totalul rămâne sus. */
export function paginaOferta(o: OptiuniPaginaOferta): string {
  const d = o.doc;
  const cuTitluri = d.capitole.length > 1 || d.capitole.some((c) => c.titlu);
  const capitole = d.capitole.map((c, i) => {
    const vazute = c.pozitii.filter((p) => o.vizibile === null || o.vizibile.has(p.linie));
    if (vazute.length === 0) return "";
    const gata = c.pozitii.filter((p) => p.nr !== null).length;
    const titlu = cuTitluri
      ? `<header class="imp-of-capitol-antet"><h2 id="cap-${i}">${esc(c.titlu ?? "Pozițiile din cerere")}</h2>
          <span>${pozitii(c.pozitii.length)}${gata < c.pozitii.length ? `, ${gata} în ofertă` : ""} · ${eur(c.subtotal)}</span></header>`
      : "";
    return `<section class="imp-of-capitol"${cuTitluri ? ` aria-labelledby="cap-${i}"` : ""}>${titlu}
      <div class="imp-lista">${vazute.map(o.pozitie).join("")}</div></section>`;
  }).join("") || `<p class="imp-gol">Nicio poziție aici.</p>`;

  return `<div class="imp-of">
    <div class="imp-of-lipit"><span>Total ofertă</span><strong>${eur(d.total)}</strong>${
      d.numarate.de_validat ? `<span>${d.numarate.de_validat} de verificat</span>` : ""}
      <button type="button" class="legatura" data-act="la-panou">Datele și descărcarea</button></div>
    <div class="imp-of-stanga">
      <section class="imp-card imp-of-antet">${antetSursa(o.fisier)}</section>
      ${o.deasupra}
      ${capitole}
      ${formAdauga()}
      ${o.detalii}
    </div>
    ${panou(o)}
  </div>`;
}

/**
 * De unde vine oferta. Un fișier de client se numește ca fișierul; registrul
 * făcut de aplicație (paginile din carnet, lista de țevi cu izolația aleasă pe
 * foaie) nu: omul n-a încărcat niciun „… - masuratori santier.xlsx”.
 */
function antetSursa(f: OptiuniPaginaOferta["fisier"]): string {
  const titlu = f.origine?.tip === "masuratori" ? "Măsurători din carnet"
    : f.origine?.tip === "izolatie_foaie" ? f.origine.fisier : f.nume;
  const detaliu = f.origine?.tip === "masuratori" ? ` · ${f.origine.pagini === 1 ? "o pagină" : cate(f.origine.pagini, "pagini")}`
    : f.origine?.tip === "izolatie_foaie" ? " · izolația aleasă pe foaie" : "";
  const referinta = f.origine ? "Vezi rândurile citite" : "Vezi fișierul clientului";
  return `<div class="imp-antet-fisier">
      ${ICOANA_FISIER}
      <div>
        <strong>${esc(titlu)}</strong>
        <span>${esc(dataScurta(f.cand) + detaliu)} · <button type="button" class="legatura" data-act="schimba-fisier">${
          f.origine ? "Alt import" : "Schimbă fișierul"}</button>
          · <button type="button" class="legatura" data-act="vezi-fisier">${referinta}</button></span>
      </div>
    </div>`;
}

/**
 * „Adaugă poziție”: o lucrare pe care clientul n-a scris-o. Se scrie ca un rând
 * de cerere și trece pe același drum (citire, preț, editor), la capitolul
 * „Adăugate de mână”.
 */
export function formAdauga(): string {
  return `<details class="imp-card imp-of-adauga" id="of-adauga">
    <summary>Adaugă poziție</summary>
    <form class="imp-of-adauga-form" id="adauga-pozitie">
      <p class="hint">Scrie ca într-o cerere: materialul, grosimea, diametrul și ce e (cot, teu, casetă).
        O citim ca pe orice rând; ce lipsește completezi apoi la „Modifică”.</p>
      <label>Descriere<textarea name="text" rows="2" required minlength="12" spellcheck="false"
        placeholder="Izolatie vata minerala 50 mm si tabla aluminiu DN100 - COT"></textarea></label>
      <div class="imp-of-adauga-rand">
        <label>UM<input name="um" value="ml" list="adauga-um" required autocomplete="off" />
          <datalist id="adauga-um"><option value="ml"></option><option value="buc"></option><option value="mp"></option></datalist></label>
        <label>Cantitate<input name="cantitate" type="number" inputmode="decimal" step="any" min="0" required /></label>
      </div>
      <div class="imp-formular-butoane"><button type="submit" class="primar">Adaugă în ofertă</button></div>
    </form>
  </details>`;
}

/** Bara de deasupra foii clientului, în vederea de referință: drumul înapoi la ofertă. */
export function baraFisier(nume: string, origine?: OrigineImport): string {
  const ce = origine ? `<strong>Rândurile citite</strong> · ${origine.tip === "masuratori" ? "din paginile carnetului" : "din lista de țevi, cu izolația aleasă"}`
    : `<strong>Fișierul clientului</strong> · ${esc(nume)}`;
  return `<section class="imp-card imp-of-referinta">
    <p>${ce}. Aici corectezi direct în celule; oferta se reface singură.</p>
    <button type="button" class="primar" data-act="la-oferta">Înapoi la ofertă</button>
  </section>`;
}
