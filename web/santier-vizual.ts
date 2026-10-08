import { formula, type RandSantier } from "../src/santier/agrega.js";
import type { Element, Izolatie, Jacheta } from "../src/santier/schema.js";
import type { Destinatie } from "../src/pricing/lists.js";
import { esc, nr, stare, tabel } from "./ecrane/tip.js";
import type { Comparatie, StareComparatie } from "../src/lucrari/comparatie.js";
import { alegereSegment } from "./import/vizual.js";

/**
 * Marcajul ecranului „Măsurători". Pur, fara DOM, ca la import; regulile care
 * nu au voie sa se strice sunt in `tests/ecrane.test.ts`.
 *
 * Ecranul il foloseste omul de la birou care a primit pozele pe telefon: poza
 * sta langa randurile citite din ea, ca sa le compare cu ochiul. Modelul doar
 * propune; o pagina intra in oferta abia dupa „Am verificat pagina".
 */

export interface PaginaSantier {
  id: string;
  nume: string;
  /** Object URL pentru afisare. */
  url: string;
  stare: "citeste" | "gata" | "eroare";
  eroare: string;
  randuri: RandSantier[];
  note: string[];
  verificata: boolean;
  /** Citirea automata nu e disponibila: randurile le scrie omul. */
  faraModel: boolean;
}

export const ELEMENT: Record<Element, { nume: string; um: string }> = {
  ml: { nume: "Metri liniari", um: "ml" },
  cot: { nume: "Coturi", um: "buc" },
  teu: { nume: "Teuri", um: "buc" },
  robinet: { nume: "Robineți", um: "buc" },
  flansa: { nume: "Flanșe", um: "buc" },
  reductie: { nume: "Reducții", um: "buc" },
  alt: { nume: "Altceva", um: "buc" },
};

const IZOLATIE: Record<Izolatie, string> = { vata_minerala: "Vată minerală", elastomer: "Elastomer" };
const JACHETA: Record<Jacheta, string> = { aluminiu: "tablă aluminiu", inox: "tablă inox", pvc: "PVC" };

const cifra = (n: number): string => n.toLocaleString("ro-RO", { maximumFractionDigits: 2 });

export function straturi(r: Pick<RandSantier, "izolatie" | "grosime_mm" | "jacheta">): string {
  const iz = r.izolatie ? `${IZOLATIE[r.izolatie]}${r.grosime_mm !== null ? ` ${cifra(r.grosime_mm)} mm` : ""}` : "";
  const ja = r.jacheta ? JACHETA[r.jacheta] : "";
  if (iz && ja) return `${iz} + ${ja}`;
  if (ja) return `Doar ${ja}`;
  return iz || "—";
}

export function diametru(r: Pick<RandSantier, "diametru_valoare" | "diametru_tip">): string {
  if (r.diametru_valoare === null) return "—";
  return r.diametru_tip === "DN" ? `DN${cifra(r.diametru_valoare)}` : `ø${cifra(r.diametru_valoare)}`;
}

/** Ce lipseste ca randul sa poata fi tarifat: diametrul, cantitatea, orice strat. */
export function lipsa(r: RandSantier): string | null {
  if (r.diametru_valoare === null) return "lipsește diametrul";
  if (!(r.cantitate > 0)) return "lipsește cantitatea";
  if (!r.izolatie && !r.jacheta) return "lipsește izolația sau protecția";
  return null;
}

/** Randurile care opresc „Am verificat pagina": nesigure sau incomplete. */
export const deVerificat = (p: PaginaSantier): number => p.randuri.filter((r) => r.nesigur || lipsa(r)).length;

/** Pagina poate fi marcata verificata: citita, cu randuri, fara randuri nesigure. */
export const poateFiVerificata = (p: PaginaSantier): boolean =>
  p.stare === "gata" && p.randuri.length > 0 && deVerificat(p) === 0;

function randTabel(p: PaginaSantier, r: RandSantier): string {
  const de = r.termeni.length > 0 ? formula(r) : "scris de mână";
  const date = `data-pag="${esc(p.id)}" data-rand="${esc(r.id)}"`;
  // Doar randul care cere ochi are stare; un „Citit" pe fiecare rand e zgomot.
  const lipseste = lipsa(r);
  const st = lipseste
    ? `<p class="sant-nesigur">${stare("De completat", "atentie")} <span class="hint">${esc(lipseste)}</span></p>`
    : r.nesigur
      ? `<p class="sant-nesigur">${stare("De verificat", "atentie")} <span class="hint">cifră greu de citit, uită-te pe poză</span></p>`
      : "";
  return `<tr${lipseste || r.nesigur ? ' class="sant-rand-nesigur"' : ""}>
    <td><b>${esc(diametru(r))} · ${esc(ELEMENT[r.element].nume)}</b><br>
      <span class="hint">${esc(straturi(r))}${r.pret_dublu ? " · preț dublu" : ""}</span>${st}</td>
    <td class="n"><b>${esc(cifra(r.cantitate))} ${esc(ELEMENT[r.element].um)}</b></td>
    <td class="hint">${esc(de)}</td>
    <td><div class="sant-actiuni">
      ${r.nesigur && !lipseste ? `<button type="button" class="secundar" data-act="confirma" ${date}>Confirmă</button>` : ""}
      <button type="button" class="secundar" data-act="modifica" ${date}>Modifică</button>
      <button type="button" class="legatura" data-act="scoate-rand" ${date}>Scoate</button>
    </div></td>
  </tr>`;
}

const optiuni = <T extends string>(valori: [T | "", string][], ales: T | null): string =>
  valori.map(([v, t]) => `<option value="${v}"${(ales ?? "") === v ? " selected" : ""}>${esc(t)}</option>`).join("");

export function editorRand(p: PaginaSantier, r: RandSantier): string {
  const n = (v: number | null): string => (v === null ? "" : String(v));
  return `<form class="imp-card sant-editor" data-pag="${esc(p.id)}" data-rand="${esc(r.id)}">
    <h3>Corectează rândul</h3>
    <div class="imp-campuri sant-campuri">
      <label>Zona<input name="zona" value="${esc(r.zona)}" autocomplete="off" /></label>
      <label>Diametru<span class="sant-diametru">
        <select name="diametru_tip" aria-label="Notația diametrului">${optiuni([["exterior", "ø"], ["DN", "DN"]], r.diametru_tip ?? "exterior")}</select>
        <input name="diametru_valoare" type="number" inputmode="decimal" step="any" min="0" value="${n(r.diametru_valoare)}" aria-label="Diametrul" />
      </span></label>
      <label>Izolație<select name="izolatie">${optiuni<Izolatie>([["vata_minerala", "Vată minerală"], ["elastomer", "Elastomer"], ["", "Fără izolație"]], r.izolatie)}</select></label>
      <label>Grosimea izolației (mm)<input name="grosime_mm" type="number" inputmode="decimal" step="any" min="0" value="${n(r.grosime_mm)}" /></label>
      <label>Protecție<select name="jacheta">${optiuni<Jacheta>([["aluminiu", "Tablă aluminiu"], ["inox", "Tablă inox"], ["pvc", "PVC"], ["", "Fără protecție"]], r.jacheta)}</select></label>
      <label>Ce e<select name="element">${optiuni<Element>(
        (Object.keys(ELEMENT) as Element[]).map((e) => [e, ELEMENT[e].nume]), r.element)}</select></label>
      <label>Cantitate<input name="cantitate" type="number" inputmode="decimal" step="any" min="0" value="${n(r.cantitate)}" required /></label>
      <label class="sant-bifa"><input name="pret_dublu" type="checkbox"${r.pret_dublu ? " checked" : ""} /> Preț dublu (scris pe foaie)</label>
    </div>
    <div class="sant-actiuni">
      <button type="submit" class="primar">Salvează</button>
      <button type="button" class="secundar" data-act="renunta">Renunță</button>
    </div>
  </form>`;
}

export function cardPagina(p: PaginaSantier, nr: number, o: { editeaza: string | null; destinatie: Destinatie }): string {
  const zone = [...new Set(p.randuri.map((r) => r.zona))];
  const nv = deVerificat(p);
  const titlu = `Pagina ${nr}`;
  const antetStare = p.stare === "citeste" ? stare("Se citește…", "neutru")
    : p.stare === "eroare" ? stare("Nu s-a putut citi", "atentie")
    : p.verificata ? stare("Verificată", "ok")
    : nv > 0 ? stare(`${nv} de verificat`, "atentie") : stare("De verificat", "neutru");

  const industrial = o.destinatie !== "industrial" && p.note.some((n) => /industrial/i.test(n));
  const note = p.note.length === 0 ? "" : `<div class="sant-note">
    <h3>Scris pe pagină</h3>
    <ul>${p.note.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>
    ${industrial ? `<p class="imp-oferta-lipsa">Pe foaie scrie de prețuri industriale. Alege sus „Industrială” dacă e cazul.</p>` : ""}
  </div>`;

  const corp = p.stare === "citeste"
    ? `<p class="hint">Se citesc rândurile de pe poză. Durează câteva secunde.</p>`
    : p.stare === "eroare"
      ? `<p class="alerta" role="alert">${esc(p.eroare)}</p>
         <div class="sant-actiuni">
           <button type="button" class="primar" data-act="reciteste" data-pag="${esc(p.id)}">Citește din nou</button>
           <button type="button" class="secundar" data-act="de-mana" data-pag="${esc(p.id)}">Scriu de mână</button>
         </div>`
      : `${p.faraModel && p.randuri.length === 0
          ? `<p class="hint">Scrie rândurile de mână, cu poza alături: „Adaugă rând”, jos.</p>`
          : ""}
        ${zone.map((z) => {
          const randuri = p.randuri.filter((r) => r.zona === z);
          const edit = randuri.find((r) => `${p.id}:${r.id}` === o.editeaza);
          return `<section class="sant-zona">
            <h3>${esc(z)}</h3>
            ${tabel(["Poziție", "Cantitate", "Pe foaie", ""], randuri.map((r) => randTabel(p, r)), ["", "n", "", ""])}
            ${edit ? editorRand(p, edit) : ""}
          </section>`;
        }).join("")}
        ${note}`;

  const verificare = p.stare !== "gata" ? "" : p.verificata
    ? `<button type="button" class="secundar" data-act="reverifica" data-pag="${esc(p.id)}">Mai verific o dată</button>`
    : `<button type="button" class="primar" data-act="verificata" data-pag="${esc(p.id)}"${poateFiVerificata(p) ? "" : " disabled"}>Am verificat pagina</button>
       ${nv > 0 ? `<span class="hint">Întâi ${nv === 1 ? "rândul marcat" : `cele ${nv} rânduri marcate`} mai sus.</span>` : ""}`;

  return `<section class="imp-card sant-card" aria-label="${esc(titlu)}">
    <div class="sant-antet">
      <h2>${esc(titlu)} <span class="hint">· ${esc(p.nume)}</span></h2>
      ${antetStare}
    </div>
    <div class="sant-pagina">
      <div class="sant-poza">
        <a href="${esc(p.url)}" target="_blank" rel="noopener"><img src="${esc(p.url)}" alt="${esc(titlu)}, poza de pe șantier" /></a>
        <p class="hint">Clic pe poză o deschide mare, în altă filă.</p>
      </div>
      <div class="sant-randuri">
        ${corp}
        <div class="sant-actiuni">
          ${verificare}
          ${p.stare === "gata" ? `<button type="button" class="secundar" data-act="adauga" data-pag="${esc(p.id)}">Adaugă rând</button>` : ""}
          <button type="button" class="legatura" data-act="scoate-pagina" data-pag="${esc(p.id)}">Scoate pagina</button>
        </div>
      </div>
    </div>
  </section>`;
}

/**
 * Pentru ce sunt pozele (Andrei, 2 octombrie 2026): masuratori inainte de
 * oferta (clientii din apropiere) sau ce s-a executat, pentru situatie.
 * Citirea si verificarea sunt aceleasi; difera unde pleaca randurile.
 */
export type Scop = "oferta" | "situatie";

/** Un santier in alegerea „Pentru situatie”. */
export interface SantierAles {
  id: string;
  denumire: string;
  client: string;
}

function alegereScop(scop: Scop): string {
  const optiuni: [Scop, string][] = [["oferta", "Pentru ofertă"], ["situatie", "Pentru situație de lucrări"]];
  return `<fieldset class="imp-segment"><legend>Pentru ce sunt măsurătorile</legend><div>${optiuni.map(([v, t]) =>
    `<label><input type="radio" name="scop" value="${v}"${v === scop ? " checked" : ""} /><span>${t}</span></label>`).join("")}</div></fieldset>`;
}

function alegereSantier(santiere: SantierAles[], ales: string): string {
  if (santiere.length === 0) {
    return `<p class="hint" style="margin:0">Niciun șantier încă. Șantierul se face din ofertă: în
      <a href="#/import">Import Excel</a>, la pasul „Oferta”, „Creează șantierul”.</p>`;
  }
  return `<label>Șantierul (situația se face pe pozițiile ofertei lui)
    <select name="plan"><option value="">— alege șantierul —</option>${santiere.map((x) =>
      `<option value="${esc(x.id)}"${x.id === ales ? " selected" : ""}>${esc(x.denumire)}${x.client && x.client !== x.denumire ? ` · ${esc(x.client)}` : ""}</option>`).join("")}</select>
  </label>`;
}

export function cardIncarca(o: {
  scop: Scop; destinatie: Destinatie; santiere: SantierAles[]; planAles: string; eroare: string; trimisa?: string;
}): string {
  return `<section class="imp-card imp-incarca">
    <div class="imp-campuri">
      ${alegereScop(o.scop)}
      ${o.scop === "oferta" ? alegereSegment(o.destinatie) : alegereSantier(o.santiere, o.planAles)}
    </div>
    <label class="imp-drop" id="drop" for="poze">
      <span class="imp-drop-buton">Alege pozele</span>
      <span class="imp-drop-sub">sau trage-le aici · o poză pentru fiecare pagină de carnet</span>
      <input id="poze" type="file" accept="image/*" multiple />
    </label>
    ${o.eroare ? `<p class="alerta" role="alert">${esc(o.eroare)}</p>` : ""}
    ${o.trimisa ? `<p class="hint">${esc(o.trimisa)}</p>` : ""}
  </section>`;
}

/** Un import din istoric cu care se pot compara masuratorile. */
export interface ListaClient { id: string; nume: string }

export function cardTrimite(o: {
  pagini: PaginaSantier[]; titlu: string; scop?: Scop; santier?: SantierAles | null; lucreaza?: boolean;
  liste?: ListaClient[]; comparaCu?: string;
}): string {
  if (o.pagini.length === 0) return "";
  const neverificate = o.pagini.filter((p) => !p.verificata).length;
  const randuri = o.pagini.reduce((s, p) => s + p.randuri.filter((r) => r.cantitate > 0).length, 0);
  const dublu = o.pagini.reduce((s, p) => s + p.randuri.filter((r) => r.pret_dublu).length, 0);
  const dinPagini = `${randuri} rânduri din ${o.pagini.length === 1 ? "o pagină" : `${o.pagini.length} pagini`}`;
  const lipsa = neverificate > 0
    ? `<p class="imp-oferta-lipsa">Mai ${neverificate === 1 ? "e o pagină neverificată" : `sunt ${neverificate} pagini neverificate`}.
      ${o.scop === "situatie" ? "În situație intră" : "Oferta se face"} doar din pagini verificate.</p>`
    : "";
  if (o.scop === "situatie") {
    const oprit = neverificate > 0 || randuri === 0 || !o.santier || o.lucreaza;
    return `<form class="imp-card imp-formular" id="trimite">
    <h2>Pune în situația de lucrări</h2>
    <p class="hint">${dinPagini}. ${o.santier
      ? `Fiecare rând se pune pe poziția din oferta șantierului „${esc(o.santier.denumire)}” care e aceeași lucrare
        (material, grosime, diametru, formă). Se deschide o situație nouă, completată; o verifici și o salvezi în Lucrări.
        Ce nu se potrivește sigur rămâne de ales de tine.`
      : "Alege șantierul, sus."}</p>
    ${lipsa}
    <div class="imp-formular-butoane">
      <button type="submit" class="primar"${oprit ? " disabled" : ""}>${o.lucreaza ? "Se potrivesc rândurile…" : "Pune în situație"}</button>
    </div>
  </form>`;
  }
  return `<form class="imp-card imp-formular" id="trimite">
    <h2>Trimite la ofertă</h2>
    <div class="imp-campuri">
      <label>Obiectiv (apare în titlul listei)<input name="titlu" value="${esc(o.titlu)}" autocomplete="off" placeholder="de ex. Stație de epurare" /></label>
    </div>
    <p class="hint">${dinPagini}. Rândurile trec prin
      verificarea de la import, apoi se descarcă oferta, ca la o listă în Excel.${dublu > 0
        ? ` La ${dublu === 1 ? "un rând" : `${dublu} rânduri`} cu „preț dublu” prețul e de două ori cel din listă; se vede la verificare.` : ""}</p>
    ${lipsa}
    ${(o.liste ?? []).length > 0 ? `<div class="imp-campuri">
      <label>Compară cu lista clientului (opțional)
        <select name="compara-cu">
          <option value="">— fără comparație —</option>
          ${o.liste!.map((l) => `<option value="${esc(l.id)}"${l.id === o.comparaCu ? " selected" : ""}>${esc(l.nume)}</option>`).join("")}
        </select>
      </label>
    </div>` : ""}
    <div class="imp-formular-butoane">
      ${(o.liste ?? []).length > 0 ? `<button type="button" data-act="compara"${!o.comparaCu || randuri === 0 || o.lucreaza ? " disabled" : ""}>${o.lucreaza ? "Se compară…" : "Compară"}</button>` : ""}
      <button type="submit" class="primar"${neverificate > 0 || randuri === 0 ? " disabled" : ""}>Trimite la ofertă</button>
    </div>
  </form>`;
}

const STARE_COMPARATIE: Record<StareComparatie, [string, "ok" | "atentie" | "neutru"]> = {
  la_fel: ["La fel", "ok"],
  diferit: ["Cantitate diferită", "atentie"],
  doar_in_lista: ["Nu s-a măsurat", "atentie"],
  doar_masurat: ["Lipsește din listă", "atentie"],
};

/**
 * Lista clientului fata de masuratori (`comparaCuLista`). Sus, ce nu se
 * potriveste; pozitiile la fel stau la final, ca omul sa nu le caute printre.
 */
export function cardComparatie(c: Comparatie, numeLista: string): string {
  const ordine: StareComparatie[] = ["diferit", "doar_in_lista", "doar_masurat", "la_fel"];
  const pozitii = [...c.pozitii].sort((a, b) => ordine.indexOf(a.stare) - ordine.indexOf(b.stare));
  const deVazut = pozitii.filter((p) => p.stare !== "la_fel").length;
  const cant = (x: number): string => (x === 0 ? "—" : nr(x, x % 1 ? 2 : 0));
  return `<section class="imp-card" id="comparatie">
    <h2>Lista clientului față de măsurători</h2>
    <p class="hint">Lista: ${esc(numeLista)}. ${deVazut === 0
      ? "Toate pozițiile se potrivesc."
      : `${deVazut === 1 ? "O poziție nu se potrivește" : `${deVazut} poziții nu se potrivesc`}.`}
      Pozițiile se compară după material, grosime, diametru și formă; cantitățile se adună pe toate zonele.
      Oferta se face din măsurători.</p>
    ${tabel(["Poziție", "În listă", "Măsurat", "Diferență", "Stare"], pozitii.map((p) => {
      const [text, ton] = STARE_COMPARATIE[p.stare];
      const dif = p.masurat - p.lista;
      return `<tr><td>${esc(p.text)}</td><td>${cant(p.lista)}</td><td>${cant(p.masurat)}</td>
        <td>${p.stare === "la_fel" ? "—" : `${dif > 0 ? "+" : ""}${nr(dif, dif % 1 ? 2 : 0)}`}</td><td>${stare(text, ton)}</td></tr>`;
    }))}
    ${c.necomparabile.length ? `<p class="hint">Nu s-au putut compara ${c.necomparabile.length === 1 ? "un rând" : `${c.necomparabile.length} rânduri`}
      (n-au fost citite complet): ${c.necomparabile.map((x) => `${esc(x.text.slice(0, 60))} (${x.sursa === "lista" ? "din listă" : "măsurat"})`).join("; ")}.</p>` : ""}
  </section>`;
}
