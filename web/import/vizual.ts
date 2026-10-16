import type { LinieProcesata } from "../../src/import/nucleu.js";
import type { Destinatie } from "../../src/pricing/lists.js";
import type { IntrareIstoric } from "../istoric.js";
import { cate, dataScurta, esc, eur } from "../ecrane/tip.js";
import type { CampuriRand } from "../../src/import/editare.js";
import type { LinieExtrasa } from "../../src/import/schema.js";
import {
  FORME_EDITOR, GROSIMI, MATERIAL, MATERIALE, MOTIV, STARE,
  ajutorDiametru, inteles, motiveLinie, stareLinie, type CodMotiv, type Sistem, type Stare,
} from "./text.js";

/**
 * Bucatile ecranului de import, ca functii pure: date in, HTML out.
 *
 * Fara DOM si fara stare, ca sa se poata testa in Node — aceeasi regula ca la
 * `web/oferta.ts`. Ecranul (`web/ecrane/import.ts`) tine starea, asculta
 * evenimentele si pune bucatile astea in pagina. Orice text care vine din
 * fisierul clientului trece prin `esc`.
 *
 * Asezarea e gandita intai pentru ecranul mic: carduri una sub alta, butoane
 * cat degetul, actiunea principala intr-o bara lipita jos. Pe ecran lat,
 * CSS-ul intinde acelasi marcaj pe coloane — un singur marcaj, nu doua.
 */

export type Pas = 1 | 2 | 3;
export type FiltruStare = "toate" | Stare;

const SEGMENTE: { id: Exclude<Destinatie, "rafinarie">; eticheta: string }[] = [
  { id: "rezidential", eticheta: "Rezidențială" },
  { id: "industrial", eticheta: "Industrială" },
];
export const SEGMENT: Record<Destinatie, string> = {
  rezidential: "rezidențială", industrial: "industrială", rafinarie: "rafinărie",
};

const ICOANA = {
  incarca: `<svg aria-hidden="true" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4"/><path d="m7 9 5-5 5 5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/></svg>`,
  fisier: `<svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7z"/><path d="M14 3v4h4"/><path d="m9.5 12 5 5m0-5-5 5"/></svg>`,
};

const numar = (n: number): string => n.toLocaleString("ro-RO", { maximumFractionDigits: 2 });
const pozitii = (n: number): string => (n === 1 ? "1 poziție" : cate(n, "poziții"));

/* ------------------------------------------------------------------ pasii */

const PASI: [Pas, string][] = [[1, "Fișierul"], [2, "Verificare"], [3, "Oferta"]];

/** Unde e omul in drum. Pasii la care se poate sari sunt butoane. */
export function pasi(activ: Pas, disponibil: Record<Pas, boolean>): string {
  return `<ol class="imp-pasi">${PASI.map(([n, titlu]) => {
    const stare = n === activ ? "activ" : n < activ ? "facut" : "urmeaza";
    const semn = `<span class="imp-pas-nr" aria-hidden="true">${n < activ ? "✓" : n}</span>`
      + `<span class="imp-pas-titlu">${titlu}</span>`;
    const interior = disponibil[n] && n !== activ
      ? `<button type="button" data-pas="${n}">${semn}</button>`
      : `<span>${semn}</span>`;
    return `<li class="imp-pas" data-stare="${stare}"${n === activ ? ' aria-current="step"' : ""}>${interior}</li>`;
  }).join("")}</ol>`;
}

/** Tipul ofertei: doua optiuni mari, radio adevarat, nu butoane care se prefac. */
export function alegereSegment(d: Destinatie): string {
  return `<fieldset class="imp-segment"><legend>Tip ofertă</legend><div>${SEGMENTE.map((s) =>
    `<label><input type="radio" name="segment" value="${s.id}"${s.id === d ? " checked" : ""} />`
    + `<span>${s.eticheta}</span></label>`).join("")}</div></fieldset>`;
}

/* -------------------------------------------------------------- pasul 1 */

export interface OptiuniStart {
  destinatie: Destinatie;
  istoric: IntrareIstoric[];
  /** Importul pe care omul a apasat „Șterge": sub el, panoul cu ce se sterge (`confirmare`). */
  stergeDe: string | null;
  /** Panoul de confirmare al stergerii, deja marcat (`panouStergere`). */
  confirmare?: string;
  eroare: string;
  /**
   * Ofertele salvate, pe id-ul importului: unde există, rândul arată oferta
   * (număr și valoare, cu discountul), ca în „Oferte și cereri”. Valoarea
   * importului e înainte de discount: TRANSAVIA arăta 94.575,06 aici și
   * 91.737,81 acolo (16 octombrie 2026).
   */
  oferte?: Record<string, { numar: string; valoare: number }>;
}

export function ecranStart(o: OptiuniStart): string {
  const istoric = o.istoric.length === 0 ? "" : `
    <section class="imp-card imp-istoric" aria-labelledby="imp-istoric-titlu">
      <h2 id="imp-istoric-titlu">Importuri recente</h2>
      <ul>${o.istoric.map((i) => `
        <li>
          <div class="imp-istoric-info">
            <strong>${esc(i.nume)}</strong>
            <span>${esc(dataScurta(i.cand))} · ${pozitii(i.pozitii)} · ${o.oferte?.[i.id]
              ? `oferta ${esc(o.oferte[i.id]!.numar || "fără număr")}, ${esc(eur(o.oferte[i.id]!.valoare))}` : esc(eur(i.valoare))}${
              i.destinatie && i.destinatie !== "rezidential" ? ` · ${esc(SEGMENT[i.destinatie])}` : ""}</span>
          </div>
          <div class="imp-istoric-actiuni">
            <button type="button" class="secundar" data-act="deschide" data-id="${esc(i.id)}">Deschide</button>
            <button type="button" class="legatura" data-act="sterge" data-id="${esc(i.id)}" aria-expanded="${o.stergeDe === i.id}"
              aria-label="Șterge importul ${esc(i.nume)}">Șterge</button>
          </div>
          ${o.stergeDe === i.id && o.confirmare ? o.confirmare : ""}
        </li>`).join("")}
      </ul>
    </section>`;

  return `<div class="imp-start${o.istoric.length ? " cu-istoric" : ""}">
    <section class="imp-card imp-incarca">
      ${alegereSegment(o.destinatie)}
      <label class="imp-drop" id="drop" for="fisier">
        ${ICOANA.incarca}
        <span class="imp-drop-buton">Alege fișierul Excel</span>
        <span class="imp-drop-sub">sau trage-l aici</span>
        <input id="fisier" type="file" accept=".xlsx" />
      </label>
      ${o.eroare ? `<p class="alerta" role="alert">${o.eroare}</p>` : ""}
    </section>
    ${istoric}
  </div>`;
}

/** Cat timp se citeste fisierul. `procent` lipsa = nu stim inca cat dureaza. */
export function ecranProgres(text: string, procent: number | null): string {
  const p = procent === null ? null : Math.max(0, Math.min(100, Math.round(procent)));
  return `<section class="imp-card imp-progres" role="status" aria-live="polite">
    <p>${esc(text)}</p>
    <div class="imp-progres-bara"${p === null ? ' data-nedefinit="da"' : ""}><i style="width:${p ?? 35}%"></i></div>
  </section>`;
}

/* -------------------------------------------------------------- pasul 2 */

export interface OptiuniAntet {
  nume: string;
  cand: string;
  destinatie: Destinatie;
}

export function antetVerificare(o: OptiuniAntet): string {
  return `<div class="imp-antet">
    <div class="imp-antet-fisier">
      ${ICOANA.fisier}
      <div>
        <strong>${esc(o.nume)}</strong>
        <span>${esc(dataScurta(o.cand))} · <button type="button" class="legatura" data-act="schimba-fisier">Schimbă fișierul</button></span>
      </div>
    </div>
    <div class="imp-antet-optiuni">${alegereSegment(o.destinatie)}</div>
  </div>`;
}

/** O foaie a registrului, ca tab: numele si cate pozitii cer atentie pe ea. */
export interface TabFoaie { nume: string; deRezolvat: number }

/** Cate pozitii are fiecare motiv, descrescator. */
export function numaraMotive(linii: LinieProcesata[]): [CodMotiv, number][] {
  const c = new Map<CodMotiv, number>();
  for (const l of linii) for (const m of motiveLinie(l)) c.set(m, (c.get(m) ?? 0) + 1);
  return [...c].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

/** Al doilea rand de filtre, pe motiv. Apare doar cand exista de ales. */
export function filtreMotiv(motive: [CodMotiv, number][], activ: CodMotiv | null): string {
  if (motive.length < 2 && activ === null) return "";
  return `<div class="imp-motive" role="group" aria-label="De ce">${motive.map(([m, n]) =>
    `<button type="button" class="imp-motiv" data-motiv="${m}" aria-pressed="${m === activ}">${esc(MOTIV[m])} <b>${n}</b></button>`,
  ).join("")}</div>`;
}

export interface OptiuniActiuni {
  deConfirmat: number;
  grosimi: number;
}

/**
 * Actiunile in masa ale filtrului curent. Fara nicio actiune nu se randeaza
 * nimic: un rand gol ar strica spatiul egal dintre blocuri.
 */
export function actiuniLista(o: OptiuniActiuni): string {
  if (o.deConfirmat === 0 && o.grosimi === 0) return "";
  return `<div class="imp-actiuni">
    ${o.deConfirmat > 0 ? `<button type="button" class="secundar" data-act="confirma-tot">Confirmă ${
      o.deConfirmat === 1 ? "poziția" : `toate cele ${cate(o.deConfirmat, "poziții")}`}</button>` : ""}
    ${o.grosimi > 0 ? `<button type="button" class="secundar" data-act="grosimi">Pune grosimea uzuală la ${pozitii(o.grosimi)}</button>` : ""}
  </div>`;
}

export interface OptiuniCard {
  /** Grosimea uzuala a firmei pentru linie, cand lipseste. */
  propunere: number | null;
  editeaza: boolean;
  /** Numele foii se scrie doar cand registrul are mai multe. */
  cuFoaie: boolean;
  /** Celulele randului, pentru editorul deschis. Vezi `OptiuniEditor`. */
  campuri?: CampuriRand;
}

/** Detaliul tehnic, pentru `title`: cine vrea sa stie exact de ce. */
function detaliu(l: LinieProcesata): string {
  return [
    l.eroare,
    ...(l.avertismente ?? []).map((a) => a.mesaj),
    ...(l.pret?.noteDeVerificat ?? []),
  ].filter(Boolean).join(" · ");
}

/**
 * Butoanele care rezolva o pozitie, aceleasi in card si in randul din tabel:
 * de verificat → „Confirmă"; fara pret, cu grosime uzuala → „Pune X mm";
 * oricare → „Modifică".
 */
export function actiuniPozitie(l: LinieProcesata, propunere: number | null, editeaza: boolean): string {
  const idx = l.extras.index;
  const stare = stareLinie(l);
  return [
    stare === "de_validat" ? `<button type="button" class="primar" data-act="confirma" data-idx="${idx}">Confirmă</button>` : "",
    stare === "netarifate" && propunere !== null
      ? `<button type="button" class="primar" data-act="pune-grosime" data-idx="${idx}" data-g="${propunere}">Pune ${numar(propunere)} mm</button>`
      : "",
    `<button type="button" class="secundar" data-act="modifica" data-idx="${idx}" aria-expanded="${editeaza}">Modifică</button>`,
  ].join("");
}

/** Starea in cuvinte, cu motivul dedesubt; detaliul tehnic in `title`. */
export function starePozitie(l: LinieProcesata): string {
  const stare = stareLinie(l);
  const motive = motiveLinie(l).map((m) => MOTIV[m]);
  return `<span class="imp-stare" data-stare="${stare}"${detaliu(l) ? ` title="${esc(detaliu(l))}"` : ""}>${STARE[stare]}</span>`
    + (motive.length ? `<span class="imp-poz-motiv">${esc(motive.join(" · "))}</span>` : "");
}

export function cardPozitie(l: LinieProcesata, o: OptiuniCard): string {
  const idx = l.extras.index;
  const stare = stareLinie(l);
  const text = l.bruta.text.replace(/\s+/g, " ").trim();
  const um = l.bruta.um ?? "buc";
  const cantitate = l.bruta.cantitate ?? 1;
  const p = l.pret;

  return `<article class="imp-poz" data-idx="${idx}" data-stare="${stare}" aria-labelledby="poz-${idx}">
    <div class="imp-poz-text">
      <p id="poz-${idx}" class="imp-poz-descriere">${esc(text)}</p>
      <p class="imp-poz-meta">Rândul ${l.bruta.rand}${o.cuFoaie ? ` · ${esc(l.bruta.foaie)}` : ""} · ${esc(numar(cantitate))} ${esc(um)}${
        l.sursa === "om" ? ` · <span class="imp-verificat">verificat</span>` : ""}</p>
    </div>
    <ul class="imp-poz-inteles" aria-label="Ce am înțeles">${inteles(l.extras, l.pret).map((e) => `<li>${esc(e)}</li>`).join("")}</ul>
    <div class="imp-poz-pret">${p
      ? `<strong>${eur(p.total)}</strong><span>${eur(p.pret_unitar)} / ${esc(um)}</span>`
      : `<strong class="imp-fara-pret">—</strong>`}</div>
    <div class="imp-poz-stare">${starePozitie(l)}</div>
    <div class="imp-poz-actiuni">${actiuniPozitie(l, o.propunere, o.editeaza)}</div>
    ${o.editeaza ? editorPozitie(l, o.campuri ? { campuri: o.campuri } : {}) : ""}
  </article>`;
}

export interface OptiuniEditor {
  /**
   * Celulele randului pe care editorul le corecteaza direct: descrierea, UM-ul,
   * cantitatea (`campuriRand`). Lipsa = doar campurile extrase.
   */
  campuri?: CampuriRand;
}

const MATERIALE_STRAT = MATERIALE.filter((s) => s !== "goluri_foc");
const numarCamp = (v: number | null): string => (v === null ? "" : String(v));

/** Un strat peste primul, in editor: materialul, grosimea lui si „×". */
export function randStrat(i: number, s: { sistem: Sistem; grosime_mm: number | null }): string {
  return `<div class="imp-strat">
    <select name="strat_sistem" aria-label="Materialul stratului">${MATERIALE_STRAT.map((m) =>
      `<option value="${m}"${m === s.sistem ? " selected" : ""}>${MATERIAL[m]}</option>`).join("")}</select>
    <input name="strat_grosime" type="number" inputmode="decimal" step="any" min="0" list="ed-g-${i}-${s.sistem}"
      value="${numarCamp(s.grosime_mm)}" placeholder="mm" aria-label="Grosimea stratului, în mm" />
    <button type="button" class="imp-scoate" data-act="scoate-strat" title="Scoate stratul" aria-label="Scoate stratul">×</button>
  </div>`;
}

/**
 * Corectura unei pozitii, deschisa sub card sau sub randul din foaie. Tot ce
 * decide pretul, cu numele obisnuite: descrierea, materialul, diametrul,
 * grosimea, forma, celelalte straturi (jacheta, cu grosimea ei), UM-ul si
 * cantitatea. „Nu e izolație" scoate randul din lista.
 *
 * Straturile erau pana acum invizibile aici: o jacheta citita din text nu se
 * putea scoate, una lipsa nu se putea adauga, iar la inox grosimea ei nu se
 * putea pune deloc — deci pozitia ramanea fara pret orice ar fi facut omul.
 */
export function editorPozitie(l: LinieProcesata, o: OptiuniEditor = {}): string {
  const e = l.extras;
  const i = e.index;
  const gol = e.sistem === "goluri_foc";
  const optiuni = MATERIALE.map((s) => `<option value="${s}"${s === e.sistem ? " selected" : ""}>${MATERIAL[s]}</option>`).join("");
  const val = numarCamp;
  const c = o.campuri;
  // Descrierea, pe mai multe randuri; celulele scurte („IZOLATII", un cod de
  // articol) raman editabile, dar pe un rand si alaturi: ca niste casete mari,
  // pareau fiecare inca o descriere.
  const lungi = (c?.texte ?? []).filter((t) => String(t.v).trim().length > 12);
  const scurte = (c?.texte ?? []).filter((t) => String(t.v).trim().length <= 12);
  const texte = c && c.texte.length > 0 ? `<div class="imp-editor-descriere">
      ${lungi.map((t) => `<label>${esc(t.eticheta.slice(0, 60))}
        <textarea name="text" data-cel="${t.cel}" rows="${String(t.v).length > 120 ? 5 : String(t.v).length > 60 ? 3 : 2}" spellcheck="false">${esc(String(t.v))}</textarea></label>`).join("")}
      ${scurte.length > 0 ? `<div class="imp-editor-scurte">${scurte.map((t) => `<label>${esc(t.eticheta.slice(0, 40))}
        <input name="text" data-cel="${t.cel}" value="${esc(String(t.v))}" spellcheck="false" /></label>`).join("")}</div>` : ""}
      <button type="button" class="secundar" data-act="reciteste" data-idx="${i}">Citește din descriere</button>
    </div>` : "";
  const forme = FORME_EDITOR.map(([f, et]) =>
    `<option value="${f}"${f === (e.forma ?? "ml") ? " selected" : ""}>${et}</option>`).join("");
  const liste = MATERIALE_STRAT.filter((m) => GROSIMI[m]).map((m) =>
    `<datalist id="ed-g-${i}-${m}">${GROSIMI[m]!.map((g) => `<option value="${g}"></option>`).join("")}</datalist>`).join("");
  const cantitate = `${c?.cantitate ? `<label>${esc(c.cantitate.eticheta.slice(0, 30))}
      <input name="cantitate" data-cel="${c.cantitate.cel}" type="number" inputmode="decimal" step="any" min="0" value="${c.cantitate.v}" /></label>` : ""}
    ${c?.um ? `<label>${esc(c.um.eticheta.slice(0, 30))}
      <input name="um" data-cel="${c.um.cel}" value="${esc(String(c.um.v))}" list="ed-um-${i}" autocomplete="off" />
      <datalist id="ed-um-${i}"><option value="ml"></option><option value="buc"></option><option value="mp"></option></datalist></label>` : ""}`;

  const ajutor = ajutorDiametru(l);
  // Pretul pus de mana: pentru ce nu acopera listele (echipamente la comanda,
  // livrarea tevii cu izolatia inclusa). Gol = pretul din lista.
  const manual = l.pret && "manual" in l.pret && l.pret.manual ? String(l.pret.pret_unitar) : "";
  const pretManual = `<label class="imp-editor-pret">Preț unitar pus de mână (€)
      <input name="pret_manual" type="number" inputmode="decimal" step="any" min="0" value="${manual}" placeholder="din listă" />
      <span class="imp-ajutor">Gol = prețul din listă. Pentru ce nu acoperă listele.</span></label>`;

  return `<form class="imp-editor" data-idx="${i}">
    <p class="imp-editor-titlu">Corectează poziția · rândul ${l.bruta.rand} din fișier</p>
    ${texte}
    <div class="imp-editor-campuri">
      <label>Material
        <select name="sistem">${optiuni}<option value=""${e.sistem === null ? " selected" : ""}>Nu e izolație (scoate din listă)</option></select></label>
      <div class="imp-editor-teava"${gol || e.sistem === null ? " hidden" : ""}>
        <div class="imp-camp">
          <span id="ed-d-${i}">Diametru</span>
          <div class="imp-rand-campuri">
            <select name="diametru_tip" aria-labelledby="ed-d-${i}">
              <option value="DN"${e.diametru_tip === "DN" ? " selected" : ""}>DN</option>
              <option value="exterior"${e.diametru_tip === "exterior" || e.diametru_tip === null ? " selected" : ""}>Ø</option>
              <option value="interior"${e.diametru_tip === "interior" ? " selected" : ""}>Di</option>
            </select>
            <input name="diametru" type="number" inputmode="decimal" step="any" min="0" value="${val(e.diametru_valoare)}" aria-labelledby="ed-d-${i}" />
          </div>
          ${ajutor ? `<p class="imp-ajutor">${esc(ajutor)}</p>` : ""}
        </div>
        <label>Grosime (mm)
          <input name="grosime" type="number" inputmode="decimal" step="any" min="0" list="ed-g-${i}-${e.sistem ?? "vata_minerala"}" value="${val(e.grosime_mm)}" /></label>
        <label>Formă
          <select name="forma">${forme}</select></label>
        <fieldset class="imp-straturi">
          <legend>Straturi peste izolație</legend>
          <div class="imp-straturi-lista">${e.straturi_extra.map((s) => randStrat(i, s)).join("")}</div>
          <button type="button" class="secundar" data-act="adauga-strat" data-idx="${i}">Adaugă strat</button>
        </fieldset>
      </div>
      <div class="imp-editor-gol"${gol ? "" : " hidden"}>
        <label>Lățime gol (mm)<input name="gol_latime" type="number" inputmode="numeric" min="0" value="${val(e.gol_latime_mm)}" /></label>
        <label>Înălțime gol (mm)<input name="gol_inaltime" type="number" inputmode="numeric" min="0" value="${val(e.gol_inaltime_mm)}" /></label>
      </div>
      ${cantitate}
      ${pretManual}
    </div>
    ${liste}
    <div class="imp-editor-butoane">
      <button type="submit" class="primar">Salvează</button>
      <button type="button" class="secundar" data-act="renunta">Renunță</button>
    </div>
  </form>`;
}

/**
 * Campurile extrase din formularul editorului, ca `patch` peste linie. Pur, ca
 * sa se poata testa: ecranul doar il aplica. Straturile vin in ordinea din
 * formular; o grosime lasata goala ramane `null` (la aluminiu motorul o
 * deduce, la inox pozitia ramane fara pret).
 */
export function patchDinFormular(date: FormData): Partial<LinieExtrasa> {
  const nr = (v: FormDataEntryValue | null | undefined): number | null => {
    const s = String(v ?? "").trim().replace(",", ".");
    return s === "" || Number.isNaN(Number(s)) ? null : Number(s);
  };
  const sistem = (String(date.get("sistem") ?? "") || null) as LinieExtrasa["sistem"];
  if (sistem === "goluri_foc") {
    return { sistem, gol_latime_mm: nr(date.get("gol_latime")), gol_inaltime_mm: nr(date.get("gol_inaltime")) };
  }
  const grosimi = date.getAll("strat_grosime");
  const diametru = nr(date.get("diametru"));
  return {
    sistem,
    diametru_valoare: diametru,
    diametru_tip: diametru === null ? null : String(date.get("diametru_tip")) as LinieExtrasa["diametru_tip"],
    grosime_mm: nr(date.get("grosime")),
    forma: (String(date.get("forma") ?? "") || null) as LinieExtrasa["forma"],
    straturi_extra: date.getAll("strat_sistem").map((s, k) => ({
      sistem: String(s) as Sistem,
      grosime_mm: nr(grosimi[k]),
    })),
  };
}

export function toast(text: string, cuAnulare: boolean): string {
  return `<div class="imp-toast" role="status">${esc(text)}${
    cuAnulare ? ` <button type="button" class="legatura" data-act="anuleaza">Anulează</button>` : ""}</div>`;
}

/* -------------------------------------------------------------- pasul 3 */

export interface OptiuniOferta {
  gata: number;
  valoare: number;
  /** Adaosul de 20 % pe închiderile la foc, pe o ofertă industrială; inclus în `valoare`. */
  adaosFoc: number;
  /** Ajustarea tehnicului pe toate prețurile, în procente. */
  ajustare: number;
  deVerificat: number;
  faraPret: number;
  destinatie: Destinatie;
  /** Ce a scris omul pe antet (păstrat în sesiune), sau ce s-a citit din fișier. */
  antet: {
    firma: string; numar: string; data: string; client: string; obiectiv: string;
    persoana: string; localitate: string; discount: number;
  };
  firme: readonly { id: string; denumire: string; serieOferta: string }[];
  eroare: string;
}

/** Sub valoarea ofertei: ce e inclus în ea, dincolo de prețurile din liste. */
export function detaliuValoare(adaosFoc: number, ajustare: number, discount = 0): string {
  const parti = [
    ajustare ? `prețuri ajustate cu ${ajustare > 0 ? "+" : ""}${String(ajustare).replace(".", ",")} %` : "",
    adaosFoc > 0 ? `include ${eur(adaosFoc)}: +20 % pe totalul închiderilor la foc (ofertă industrială)` : "",
    discount > 0 ? `după discountul de ${String(discount).replace(".", ",")} %` : "",
  ].filter(Boolean);
  return parti.length ? esc(parti.join(" · ")) : "Prețurile din liste, neajustate.";
}

export function ecranOferta(o: OptiuniOferta): string {
  const camp = (nume: string, eticheta: string, valoare: string, extra = ""): string =>
    `<label>${eticheta}<input name="${nume}" value="${esc(valoare)}" ${extra} /></label>`;
  const afara = o.deVerificat + o.faraPret;
  return `<div class="imp-oferta">
    <section class="imp-card imp-oferta-rezumat">
      <p class="imp-oferta-suma"><span>Intră în ofertă</span><strong id="valoare-oferta">${eur(o.valoare)}</strong>
        <span>${pozitii(o.gata)} · ofertă ${SEGMENT[o.destinatie]}</span></p>
      <p class="hint" id="detaliu-valoare">${detaliuValoare(o.adaosFoc, o.ajustare, o.antet.discount)}</p>
      ${afara > 0 ? `<p class="imp-oferta-afara">Nu intră: ${o.deVerificat} de verificat, ${o.faraPret} fără preț.
        <button type="button" class="legatura" data-act="la-verificare">Înapoi la verificare</button></p>` : ""}
    </section>
    <form class="imp-card imp-formular" id="antet-oferta">
      <h2>Datele ofertei</h2>
      <div class="imp-campuri">
        <label>Firma<select name="firma">${o.firme.map((f) =>
          `<option value="${esc(f.id)}"${f.id === o.antet.firma ? " selected" : ""}>${esc(f.denumire)}</option>`).join("")}</select></label>
        ${camp("numar", "Număr ofertă", o.antet.numar, 'required inputmode="numeric" autocomplete="off"')}
        ${camp("data", "Data", o.antet.data, "required")}
        ${camp("client", "Beneficiar", o.antet.client, "required")}
        ${camp("obiectiv", "Obiectiv (numele șantierului)", o.antet.obiectiv)}
        ${camp("persoana", "În atenția", o.antet.persoana)}
        ${camp("localitate", "Localitate", o.antet.localitate, "required")}
        ${camp("ajustare", "Ajustare prețuri (%)", String(o.ajustare),
          'type="number" inputmode="decimal" min="-50" max="100" step="any" aria-describedby="ajutor-ajustare"')}
        ${camp("discount", "Discount (%)", String(o.antet.discount), 'type="number" inputmode="decimal" min="0" max="100" step="any"')}
        <p class="imp-ajutor" id="ajutor-ajustare">Ajustarea mută toate prețurile: 10 = cu 10 % mai mari, −5 = mai mici.</p>
      </div>
      ${o.eroare ? `<p class="alerta" role="alert">${esc(o.eroare)}</p>` : ""}
      ${afara > 0 ? `<p class="imp-oferta-lipsa">Oferta descărcată nu va conține ${pozitii(afara)}: ${o.deVerificat} de verificat
        și ${o.faraPret} fără preț. Dacă trebuie să fie în ofertă, rezolvă-le întâi la verificare.</p>` : ""}
      <div class="imp-formular-butoane">
        <button type="submit" class="primar">Descarcă oferta</button>
      </div>
    </form>
  </div>`;
}
