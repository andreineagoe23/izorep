import type { RandSantier } from "../src/santier/agrega.js";
import type { Element, Izolatie, Jacheta } from "../src/santier/schema.js";
import type { Destinatie } from "../src/pricing/lists.js";
import { esc, nr, stare, tabel } from "./ecrane/tip.js";
import { celulaNumar, celulaText } from "./celula.js";
import type { Comparatie, StareComparatie } from "../src/lucrari/comparatie.js";
import { alegereSegment } from "./import/vizual.js";
import type { StareModel } from "./imagine.js";

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

const optiuni = <T extends string>(valori: [T | "", string][], ales: T | null): string =>
  valori.map(([v, t]) => `<option value="${v}"${(ales ?? "") === v ? " selected" : ""}>${esc(t)}</option>`).join("");

const IZOLATII: [Izolatie | "", string][] = [["vata_minerala", "Vată minerală"], ["elastomer", "Elastomer"], ["", "Fără"]];
const PROTECTII: [Jacheta | "", string][] = [["aluminiu", "Tablă aluminiu"], ["inox", "Tablă inox"], ["pvc", "PVC"], ["", "Fără"]];
const PIESE = (Object.keys(ELEMENT) as Element[]).map((e): [Element, string] => [e, ELEMENT[e].nume]);

/** Capul tabelului; pe ecran îngust, același text e eticheta din card (`data-eticheta`). */
const CAPETE = ["Diametru", "Piesă", "Izolație", "Grosime (mm)", "Protecție", "Cantitate", "UM", "Preț dublu", "Stare"];

/**
 * Un rând citit din poză, ca la „Verificare” din import (Andrei, 21 octombrie
 * 2026): fiecare câmp se scrie direct în tabel, fără „Modifică”, și se aplică
 * la fiecare tastă. Cantitatea schimbată față de ce s-a citit din poză e
 * galbenă și spune, sub mouse, ce s-a citit. Cum s-a adunat de pe foaie („6 + 4
 * + 2”) nu se mai arată: citirea scrisului de mână greșea des (Andrei, 21
 * octombrie 2026), iar coloana doar încurca.
 */
function randEditabil(p: PaginaSantier, r: RandSantier): string {
  const date = { pag: p.id, rand: r.id };
  const atr = `data-pag="${esc(p.id)}" data-rand="${esc(r.id)}"`;
  const cine = `${diametru(r)} · ${ELEMENT[r.element].nume}`;
  const sel = (camp: string, eticheta: string, html: string): string =>
    `<select data-sc="${camp}" ${atr} aria-label="${esc(`${eticheta}, ${cine}`)}">${html}</select>`;
  const td = (eticheta: string, continut: string, clasa = ""): string =>
    `<td${clasa ? ` class="${clasa}"` : ""} data-eticheta="${esc(eticheta)}">${continut}</td>`;
  const dePeFoaie = r.termeni.length > 0 ? Math.round(r.termeni.reduce((s, t) => s + t.cantitate * t.multiplicator, 0) * 100) / 100 : null;
  const schimbata = dePeFoaie !== null && dePeFoaie !== r.cantitate;
  const lipseste = lipsa(r);
  const motiv = lipseste ?? (r.nesigur ? "cifră greu de citit, uită-te pe poză" : "");
  const actiune = lipseste
    ? `<span class="imp-stare" data-stare="de_validat">De completat</span>`
    : r.nesigur
      ? `<button type="button" class="secundar" data-act="confirma" ${atr}>Confirmă</button>`
      : `<span class="imp-stare" data-stare="gata">Gata</span>`;
  return `<tr class="ver-poz" data-stare="${lipseste || r.nesigur ? "de_validat" : "gata"}">
    ${td("Diametru", `<div class="ver-diametru">${sel("diametru_tip", "Notația diametrului",
      optiuni([["exterior", "ø"], ["DN", "DN"]], r.diametru_tip ?? "exterior"))}${
      celulaNumar({ ed: "diam", valoare: r.diametru_valoare, eticheta: `Diametrul, ${cine}`, gol: "—", date })}</div>`)}
    ${td("Piesă", sel("element", "Piesa", optiuni(PIESE, r.element)))}
    ${td("Izolație", sel("izolatie", "Izolația", optiuni(IZOLATII, r.izolatie)))}
    ${td("Grosime (mm)", celulaNumar({ ed: "gros", valoare: r.grosime_mm, eticheta: `Grosimea izolației, ${cine}`, gol: "—", date }))}
    ${td("Protecție", sel("jacheta", "Protecția", optiuni(PROTECTII, r.jacheta)))}
    ${td("Cantitate", celulaNumar({ ed: "cant", valoare: r.cantitate, eticheta: `Cantitatea, ${cine}`, gol: "—", date,
      schimbat: schimbata, ...(schimbata ? { inainte: `Citit din poză: ${cifra(dePeFoaie!)}` } : {}) }), "n")}
    ${td("UM", esc(ELEMENT[r.element].um), "ver-text-cel")}
    ${td("Preț dublu", `<label class="sant-dublu"><input type="checkbox" data-sc="pret_dublu" ${atr}${r.pret_dublu ? " checked" : ""}
      aria-label="${esc(`Preț dublu, ${cine}`)}" /></label>`)}
    <td class="ver-stare"><div class="ver-actiuni">${actiune}
      <button type="button" class="cel-scoate" data-act="scoate-rand" ${atr} aria-label="${esc(`Scoate rândul ${cine}`)}" title="Scoate rândul">✕</button></div>
      ${motiv ? `<p class="ver-motiv">${esc(motiv)}</p>` : ""}</td>
  </tr>`;
}

/** O zonă de pe foaie: numele ei se scrie pe loc și mută toate rândurile ei. */
function tabelZona(p: PaginaSantier, zona: string, randuri: RandSantier[]): string {
  return `<section class="sant-zona">
    ${celulaText({ ed: "zona", text: zona, eticheta: `Numele zonei ${zona}`, clasa: "sant-zona-nume", date: { pag: p.id, zona } })}
    <table class="ver-tabel sant-tabel">
      <colgroup>${["diam", "piesa", "material", "gros", "prot", "n", "um", "dublu", "stare"].map((k) => `<col class="sant-col-${k}">`).join("")}</colgroup>
      <thead><tr>${CAPETE.map((t, k) => `<th scope="col"${k === 5 ? ' class="n"' : ""}>${t}</th>`).join("")}</tr></thead>
      <tbody>${randuri.map((r) => randEditabil(p, r)).join("")}</tbody>
    </table>
  </section>`;
}

export function cardPagina(p: PaginaSantier, nr: number, o: { destinatie: Destinatie; cuModel?: boolean }): string {
  const zone = [...new Set(p.randuri.map((r) => r.zona))];
  const nv = deVerificat(p);
  const titlu = `Pagina ${nr}`;
  const antetStare = p.stare === "citeste" ? stare("Se citește…", "neutru")
    : p.stare === "eroare" ? stare("Nu s-a putut citi", "atentie")
    : p.verificata ? stare("Verificată", "ok")
    : nv > 0 ? stare(`${nv} de verificat`, "atentie")
    : p.faraModel && p.randuri.length === 0 ? stare("Scrii de mână", "neutru") : stare("De verificat", "neutru");

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
          ? o.cuModel
            ? `<div class="sant-actiuni"><p class="hint">Poza n-a fost citită: când a fost adăugată, citirea automată nu era pornită.</p>
                <button type="button" class="primar" data-act="reciteste" data-pag="${esc(p.id)}">Citește poza acum</button></div>`
            : `<p class="hint">Scrie rândurile de mână, cu poza alături: „Adaugă rând”, jos.</p>`
          : ""}
        ${zone.map((z) => tabelZona(p, z, p.randuri.filter((r) => r.zona === z))).join("")}
        ${note}`;

  const verificare = p.stare !== "gata" ? "" : p.verificata
    ? `<button type="button" class="secundar" data-act="reverifica" data-pag="${esc(p.id)}">Mai verific o dată</button>`
    : `<button type="button" class="primar" data-act="verificata" data-pag="${esc(p.id)}"${poateFiVerificata(p) ? "" : " disabled"}>Am verificat pagina</button>
       ${nv > 0 ? `<span class="hint">Întâi ${nv === 1 ? "rândul marcat" : `cele ${nv} rânduri marcate`} mai sus.</span>` : ""}`;

  // Poza stă mică lângă titlu; clic → mare, în panoul de previzualizare (`previzualizare`).
  return `<section class="imp-card sant-card" aria-label="${esc(titlu)}">
    <div class="sant-antet">
      <button type="button" class="sant-poza" data-act="mareste" data-pag="${esc(p.id)}" aria-label="${esc(`Mărește poza, ${titlu}`)}">
        <img src="${esc(p.url)}" alt="" /><span>Mărește</span>
      </button>
      <h2>${esc(titlu)} <span class="hint">· ${esc(p.nume)}</span></h2>
      ${antetStare}
    </div>
    <div class="sant-pagina">
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
 * Panoul cu poza mare, unul pe ecran: poza aleasă pe tot ecranul, cu ✕ în colț
 * (și Escape, și clic lângă poză) care o readuce la miniatură.
 */
export const previzualizare = (): string => `<dialog class="sant-mare" id="sant-mare" aria-label="Poza mărită">
    <img alt="" />
    <button type="button" class="cel-scoate" data-act="micsoreaza" aria-label="Închide poza" title="Închide">✕</button>
  </dialog>`;

/**
 * Pentru ce sunt pozele (Andrei, 2 octombrie 2026): masuratori inainte de
 * oferta (clientii din apropiere) sau ce s-a executat, pentru situatie.
 * Citirea si verificarea sunt aceleasi; difera unde pleaca randurile.
 */
export type Scop = "oferta" | "situatie" | "comanda";

/** Un santier in alegerea „Pentru situatie”. */
export interface SantierAles {
  id: string;
  denumire: string;
  client: string;
}

function alegereScop(scop: Scop): string {
  const optiuni: [Scop, string][] = [
    ["oferta", "Pentru ofertă"], ["situatie", "Pentru situație de lucrări"], ["comanda", "Pentru comanda de material"],
  ];
  return `<fieldset class="imp-segment"><legend>Pentru ce sunt măsurătorile</legend><div>${optiuni.map(([v, t]) =>
    `<label><input type="radio" name="scop" value="${v}"${v === scop ? " checked" : ""} /><span>${t}</span></label>`).join("")}</div></fieldset>`;
}

function alegereSantier(santiere: SantierAles[], ales: string, scop: Scop): string {
  if (santiere.length === 0) {
    return `<p class="hint" style="margin:0">Niciun șantier încă. Șantierul se face din ofertă: în
      <a href="#/import">Cerere nouă</a>, la pasul „Oferta”, „Creează șantierul”.</p>`;
  }
  return `<label>Șantierul (${scop === "comanda" ? "materialul vine pe el" : "situația se face pe pozițiile ofertei lui"})
    <select name="plan"><option value="">— alege șantierul —</option>${santiere.map((x) =>
      `<option value="${esc(x.id)}"${x.id === ales ? " selected" : ""}>${esc(x.denumire)}${x.client && x.client !== x.denumire ? ` · ${esc(x.client)}` : ""}</option>`).join("")}</select>
  </label>`;
}

/**
 * Ce face omul cand pozele nu se citesc singure. Fara mesajul asta pagina
 * trecea direct pe „scrii de mana”, iar omul credea ca modelul a citit poza si
 * n-a gasit nimic (14 octombrie 2026). Motivul tehnic (link demo, server fara
 * cheie) nu se spune: omului de la birou nu-i spune nimic (Andrei, 18 octombrie
 * 2026). Se spune doar ce are de facut.
 */
export function mesajModel(m: StareModel | undefined): string {
  if (m === undefined || m === "pornit") return "";
  const text = m === "nu-raspunde"
    ? "Pozele nu s-au putut citi acum. Apasă „Încearcă din nou” sau scrie rândurile de pe poză, lângă ea."
    : "Aici pozele nu se citesc singure. Încarcă poza, apoi scrie rândurile de pe ea în tabelul de lângă, cu „Adaugă rând”.";
  return `<div class="sant-model" role="status">
    <p>${stare(m === "nu-raspunde" ? "Nu s-au citit" : "Scrii de mână", "atentie")} ${esc(text)}</p>
    ${m === "nu-raspunde" ? `<button type="button" class="secundar" data-act="verifica-model">Încearcă din nou</button>` : ""}
  </div>`;
}

export function cardIncarca(o: {
  scop: Scop; destinatie: Destinatie; santiere: SantierAles[]; planAles: string; eroare: string; trimisa?: string;
  model?: StareModel;
}): string {
  return `<section class="imp-card imp-incarca">
    <div class="imp-campuri sant-sus">
      ${alegereScop(o.scop)}
      ${o.scop === "oferta" ? alegereSegment(o.destinatie) : alegereSantier(o.santiere, o.planAles, o.scop)}
    </div>
    <label class="imp-drop" id="drop" for="poze">
      <svg aria-hidden="true" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="m21 16-5-5-8 8"/></svg>
      <span class="imp-drop-buton">Alege pozele</span>
      <span class="imp-drop-sub">sau trage-le aici · o poză pentru fiecare pagină de carnet</span>
      <input id="poze" type="file" accept="image/*" multiple />
    </label>
    ${mesajModel(o.model)}
    ${o.eroare ? `<p class="alerta" role="alert">${esc(o.eroare)}</p>` : ""}
    ${o.trimisa ? `<p class="hint">${esc(o.trimisa)}</p>` : ""}
  </section>`;
}

/** Un import din istoric cu care se pot compara masuratorile. */
export interface ListaClient { id: string; nume: string }

export function cardTrimite(o: {
  pagini: PaginaSantier[]; titlu: string; scop?: Scop; santier?: SantierAles | null; lucreaza?: boolean;
  liste?: ListaClient[]; comparaCu?: string; mesaj?: string;
}): string {
  if (o.pagini.length === 0) return "";
  const neverificate = o.pagini.filter((p) => !p.verificata).length;
  const randuri = o.pagini.reduce((s, p) => s + p.randuri.filter((r) => r.cantitate > 0).length, 0);
  const dublu = o.pagini.reduce((s, p) => s + p.randuri.filter((r) => r.pret_dublu).length, 0);
  const dinPagini = `${randuri} rânduri din ${o.pagini.length === 1 ? "o pagină" : `${o.pagini.length} pagini`}`;
  const lipsa = neverificate > 0
    ? `<p class="imp-oferta-lipsa">Mai ${neverificate === 1 ? "e o pagină neverificată" : `sunt ${neverificate} pagini neverificate`}.
      ${o.scop === "situatie" ? "În situație intră" : o.scop === "comanda" ? "Comanda se face" : "Oferta se face"} doar din pagini verificate.</p>`
    : "";
  if (o.scop === "comanda") {
    const oprit = neverificate > 0 || randuri === 0 || !o.santier || o.lucreaza;
    return `<form class="imp-card imp-formular" id="trimite">
    <h2>Fă comanda pentru ce s-a măsurat</h2>
    <p class="hint">${dinPagini}. ${o.santier
      ? `Materialul pentru rândurile măsurate se calculează ca la ofertă (pierderi, tuburi până la prag, piese în metri),
        apoi se scade ce e acum pe șantierul „${esc(o.santier.denumire)}” și ce e comandat și n-a sosit. Ce rămâne se
        rotunjește la ambalaj și devine câte o ciornă pe furnizor, cu prețul lui, în Comenzi. O verifici și o trimiți de acolo.`
      : "Alege șantierul, sus."}</p>
    ${lipsa}
    ${o.mesaj ? `<p class="hint" role="status">${esc(o.mesaj)}</p>` : ""}
    <div class="imp-formular-butoane">
      <button type="submit" class="primar"${oprit ? " disabled" : ""}>${o.lucreaza ? "Se calculează materialele…" : "Fă ciornele comenzii"}</button>
    </div>
  </form>`;
  }
  if (o.scop === "situatie") {
    const oprit = neverificate > 0 || randuri === 0 || !o.santier || o.lucreaza;
    return `<form class="imp-card imp-formular" id="trimite">
    <h2>Pune în situația de lucrări</h2>
    <p class="hint">${dinPagini}. ${o.santier
      ? `Fiecare rând se pune pe poziția din oferta șantierului „${esc(o.santier.denumire)}” care e aceeași lucrare
        (material, grosime, diametru, formă). Se deschide o situație nouă, completată; o verifici și o salvezi în Șantiere.
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
