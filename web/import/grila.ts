import type { CelulaBruta, FoaieBruta, RandBrut } from "../../src/import/parse-workbook.js";
import { campuriRand } from "../../src/import/editare.js";
import type { LinieProcesata } from "../../src/import/nucleu.js";
import { esc, eur } from "../ecrane/tip.js";
import { inteles, stareLinie } from "./text.js";
import { actiuniPozitie, editorPozitie, starePozitie } from "./vizual.js";

/**
 * Foaia clientului ca in Excel — vederea implicita a verificarii.
 *
 * E forma pe care o cunoaste oricine a primit o lista de cantitati: aceleasi
 * randuri, aceleasi coloane, acelasi numar de rand ca in fisier. Dupa
 * coloanele clientului vin ale noastre — ce am inteles, pretul, starea si
 * butonul care rezolva randul — iar filtrele de deasupra ascund randurile care
 * nu se potrivesc, fara sa schimbe numerotarea.
 *
 * Celulele sunt editabile; corectura trece prin `scrieCelula` + `reconstruieste`
 * in ecran, deci reextrage si retarifeaza randul.
 */

const ISO = /^(\d{4})-(\d{2})-(\d{2})T[\d:.]+Z$/;

/**
 * Valoarea unei celule, cum o vede omul in Excel: numerele fara cifrele de
 * rotunjire ale lui ExcelJS (8084.330000000001), datele ca `04.09.2026`.
 */
export const textCelula = (v: string | number | null): string => {
  if (v === null) return "";
  if (typeof v === "number") return String(Number(v.toPrecision(12)));
  const d = ISO.exec(v);
  return d ? `${d[3]}.${d[2]}.${d[1]}` : v;
};

/** A, B, … Z, AA — antetul de rezerva, pentru foile fara rand de antet. */
function litera(i: number): string {
  let s = "";
  for (let n = i; n >= 0; n = Math.floor(n / 26) - 1) s = String.fromCharCode(65 + (n % 26)) + s;
  return s;
}

const latime = (celule: CelulaBruta[]): number => celule.reduce((s, c) => s + c.span, 0);
const umplutura = (n: number, tag = "td"): string => (n > 0 ? `<${tag}></${tag}>`.repeat(n) : "");

/* ------------------------------------------------------ antetul documentului */

export interface AntetDocument {
  titlu: string | null;
  /** Randurile fara eticheta: numarul ofertei, persoana de contact. */
  linii: string[];
  /** Perechile eticheta–valoare: „Beneficiar : …", „Nume proiect | …". */
  date: [string, string][];
}

const ETICHETA_VALOARE = /^([^:]{2,40}?)\s*:\s*(.+)$/;

/** Majoritar majuscule: asa se scrie titlul unei oferte („OFERTA LUCRARI…"). */
function eTitlu(s: string): boolean {
  const litere = s.replace(/[^A-Za-zĂÂÎȘȚŞŢăâîșțşţ]/g, "");
  if (litere.length < 6) return false;
  return litere.replace(/[^A-ZĂÂÎȘȚŞŢ]/g, "").length / litere.length >= 0.7;
}

/**
 * Randurile de deasupra tabelului, asezate ca antet de document.
 *
 * Randate ca atare ieseau sase randuri lipite una sub alta, cu titlul, numarul
 * si beneficiarul la aceeasi greutate. Aici se despart: cea mai lunga linie
 * scrisa cu majuscule e titlul; un rand cu doua celule, sau cu „eticheta :
 * valoare" intr-una, e o pereche; restul sunt linii de detaliu.
 */
export function antetDocument(randuri: string[][]): AntetDocument {
  const simple: string[] = [];
  const date: [string, string][] = [];
  for (const celule of randuri) {
    const c = celule.map((x) => x.trim()).filter((x) => x !== "");
    if (c.length === 0) continue;
    if (c.length === 2) { date.push([c[0]!.replace(/\s*:\s*$/, ""), c[1]!]); continue; }
    const kv = c.length === 1 ? ETICHETA_VALOARE.exec(c[0]!) : null;
    if (kv) { date.push([kv[1]!.trim(), kv[2]!.trim()]); continue; }
    simple.push(c.join(" · "));
  }
  let iTitlu = -1;
  simple.forEach((s, i) => {
    if (eTitlu(s) && (iTitlu < 0 || s.length > simple[iTitlu]!.length)) iTitlu = i;
  });
  return {
    titlu: iTitlu >= 0 ? simple[iTitlu]! : null,
    linii: simple.filter((_, i) => i !== iTitlu),
    date,
  };
}

function antetHtml(a: AntetDocument, foaie: string | null): string {
  if (!foaie && !a.titlu && a.linii.length === 0 && a.date.length === 0) return "";
  return `<header class="imp-doc">
    ${foaie ? `<p class="imp-doc-foaie">Foaia „${esc(foaie)}”</p>` : ""}
    ${a.titlu ? `<h3 class="imp-doc-titlu">${esc(a.titlu)}</h3>` : ""}
    ${a.linii.length ? `<p class="imp-doc-linii">${a.linii.map((l) => `<span>${esc(l)}</span>`).join("")}</p>` : ""}
    ${a.date.length ? `<dl class="imp-doc-date">${a.date.map(([k, v]) =>
      `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>` : ""}
  </header>`;
}

/* ------------------------------------------------------------------ tabelul */

export interface OptiuniGrila {
  /** Indecsii pozitiilor care trec de filtre; `null` = tot fisierul, cu titluri si note. */
  vizibile: ReadonlySet<number> | null;
  editIdx: number | null;
  propunere: (l: LinieProcesata) => number | null;
  /** Numele foii se scrie doar cand registrul are mai multe. */
  cuNumeFoaie: boolean;
}

/**
 * Coloanele noastre de pe randul unei pozitii, doua in loc de patru: ce am
 * inteles cu pretul sub el, si starea cu butonul care o rezolva. Patru coloane
 * separate cereau ~560 px doar pentru ele, deci foaia clientului nu mai incapea
 * fara derulare laterala. Ecranul le reface pe loc dupa o corectura de celula.
 */
export function celuleExtrase(l: LinieProcesata, o: Pick<OptiuniGrila, "editIdx" | "propunere">): string {
  const p = l.pret;
  return `<td class="extras">${inteles(l.extras, l.pret).map((e) => `<span class="imp-eticheta">${esc(e)}</span>`).join("")}
      <span class="imp-grila-pret">${p ? `<strong>${eur(p.total)}</strong><small>${eur(p.pret_unitar)} / ${esc(l.bruta.um ?? "buc")}</small>` : "—"}</span></td>
    <td class="extras imp-grila-stare">${starePozitie(l)}
      <div class="imp-grila-actiuni">${actiuniPozitie(l, o.propunere(l), o.editIdx === l.extras.index)}</div></td>`;
}

/** Cate coloane pune ecranul dupa cele ale fisierului. */
const COLOANE_EXTRASE = 2;
/**
 * Latimile fixe, in pixeli: numarul randului, „Am înțeles · preț" si „Stare".
 * Continutul lor e cunoscut (o eticheta, un pret, doua butoane), deci nu
 * cresc cu ecranul: pe un ecran lat, tot ce ramane merge la coloanele
 * clientului, iar „Stare" sta lipita de marginea din dreapta (Andrei, 14
 * octombrie 2026: „starea e prea in stanga"). 214 px tin „Confirmă" si
 * „Modifică" pe acelasi rand.
 */
const PX_RAND = 44;
const PX_INTELES = 230;
const PX_STARE = 214;
/**
 * Cat „cere" o coloana de descriere: intre 40 si 90 de caractere, dupa
 * mediana ei. Celelalte coloane cu text (observatii, model de referinta) sunt
 * plafonate la 16: descrierea e primul lucru la care se uita omul, iar o
 * coloana de observatii cat jumatate din ea lasa descrierea rupta pe sase
 * randuri langa o celula aproape goala.
 */
const DESCRIERE_MIN = 40;
const DESCRIERE_MAX = 90;
const PLAFON_ALTE = 16;

/**
 * Coloanele goale pe toate randurile de sub antet. Nu se deseneaza: Flower City
 * are 16 coloane din care 7 n-au nimic, iar fiecare cerea loc pe ecran.
 *
 * O celula imbinata cu text nu are voie sa ramana fara nicio coloana sub ea:
 * daca toate coloanele pe care le acopera sunt goale altfel, prima ramane.
 */
function coloaneGoale(n: number, randuri: RandBrut[]): Set<number> {
  const pline = new Set<number>();
  for (const r of randuri) {
    let c = 0;
    for (const cel of r.celule) {
      if (cel.span === 1 && textCelula(cel.v).trim() !== "") pline.add(c);
      c += cel.span;
    }
  }
  const goale = new Set<number>();
  for (let k = 0; k < n; k++) if (!pline.has(k)) goale.add(k);
  for (const r of randuri) {
    let c = 0;
    for (const cel of r.celule) {
      if (cel.span > 1 && textCelula(cel.v).trim() !== "") {
        let toate = true;
        for (let k = c; k < c + cel.span; k++) if (!goale.has(k)) toate = false;
        if (toate) goale.delete(c);
      }
      c += cel.span;
    }
  }
  return goale;
}

/**
 * Latimea relativa a fiecarei coloane vizibile, in „caractere".
 *
 * Tabelul are `table-layout: fixed` pe latimea ecranului: latimile se dau aici,
 * ca procente, si nu mai depind de continut — deci niciun text lung nu poate
 * impinge tabelul peste marginea ecranului. Descrierile primesc cel mai mult
 * loc (`DESCRIERE_MIN`…`DESCRIERE_MAX`); celelalte coloane cu text sunt
 * plafonate (`PLAFON_ALTE`), iar cele scurte primesc cat le trebuie numerelor
 * si celui mai lung cuvant din capul lor, ca „Cantitate" sa nu se rupa pe litere.
 */
function latimi(f: FoaieBruta, randuri: RandBrut[], ascunse: ReadonlySet<number>, descrieri: ReadonlySet<number>): number[] {
  // Mediana pe randurile de POZITIE, nu maximul pe toata foaia: o nota de
  // subsol de 100 de caractere in coloana „Identificare" (care altfel tine
  // „IZOLATII") ii dadea cat descrierii, iar pretul ramanea cu capul rupt.
  const pozitii = randuri.some((r) => r.linie) ? randuri.filter((r) => r.linie) : randuri;
  const lungimi: number[][] = Array.from({ length: f.coloane }, () => []);
  for (const r of pozitii) {
    let c = 0;
    for (const cel of r.celule) {
      const t = textCelula(cel.v).trim();
      if (cel.span === 1 && t !== "") lungimi[c]!.push(t.length);
      c += cel.span;
    }
  }
  const max = lungimi.map((l) => (l.length ? l.sort((a, b) => a - b)[Math.floor(l.length / 2)]! : 0));
  // La descrieri, al treilea sfert: randurile de continuare scurte nu au voie
  // sa traga in jos latimea pozitiilor intregi de deasupra lor.
  const sfert3 = lungimi.map((l) => (l.length ? l[Math.floor(l.length * 0.75)]! : 0));
  const cuvant = new Array<number>(f.coloane).fill(0);
  if (f.antet) {
    let c = 0;
    for (const cel of f.antet.celule) {
      if (cel.span === 1) {
        cuvant[c] = Math.max(0, ...textCelula(cel.v).split(/\s+/).map((w) => w.length));
      }
      c += cel.span;
    }
  }
  // Cu multe coloane (Book15 are unsprezece), descrierea cedeaza din plafon,
  // ca „UNIT" si „QUANTITY" sa-si pastreze cifrele pe un rand.
  const altele = Array.from({ length: f.coloane }, (_, k) => k).filter((k) => !ascunse.has(k) && !descrieri.has(k)).length;
  const plafon = Math.max(DESCRIERE_MIN, DESCRIERE_MAX - 4 * altele);
  const out: number[] = [];
  for (let k = 0; k < f.coloane; k++) {
    if (ascunse.has(k)) continue;
    out.push(descrieri.has(k)
      ? Math.min(Math.max(sfert3[k]!, DESCRIERE_MIN), plafon)
      : Math.max(Math.min(max[k]!, PLAFON_ALTE), Math.min(cuvant[k]!, 12), 6) + 2);
  }
  return out;
}

/** Foaia, sau sirul gol cand filtrele n-au lasat niciun rand pe ea. */
export function grilaFoaie(f: FoaieBruta, linii: ReadonlyMap<number, LinieProcesata>, o: OptiuniGrila): string {
  const inceput = f.antet ? f.antet.rand : 0;
  const pozitie = (idx: number | undefined): LinieProcesata | undefined => {
    const l = idx === undefined ? undefined : linii.get(idx);
    return l && l.extras.sistem !== null ? l : undefined;
  };

  const sub = f.randuri.filter((r) => r.rand > inceput);
  const randuri = sub.filter((r) =>
    o.vizibile === null || (r.linie !== undefined && o.vizibile.has(r.linie.index) && pozitie(r.linie.index) !== undefined));
  if (randuri.length === 0 && o.vizibile !== null) return "";

  // Coloanele se decid pe toata foaia, nu pe ce lasa filtrul: altfel tabelul
  // si-ar schimba forma la fiecare clic pe un filtru.
  const ascunse = coloaneGoale(f.coloane, sub);
  const vizibileIn = (start: number, span: number): number => {
    let n = 0;
    for (let k = start; k < start + span; k++) if (!ascunse.has(k)) n++;
    return n;
  };
  const nrVizibile = vizibileIn(0, f.coloane);
  /** Celulele unui rand, fara coloanele ascunse; `i` ramane indexul din fisier. */
  const celuleVizibile = (celule: CelulaBruta[], tag: "td" | "th", randeaza: (c: CelulaBruta, i: number, lung: boolean) => string): string => {
    let c = 0;
    let html = "";
    celule.forEach((cel, i) => {
      const span = vizibileIn(c, cel.span);
      if (span > 0) {
        const inner = randeaza(cel, i, cel.span === 1 && coloaneLungi.has(c));
        html += `<${tag}${span > 1 ? ` colspan="${span}"` : ""}${inner}</${tag}>`;
      }
      c += cel.span;
    });
    return html + umplutura(vizibileIn(latime(celule), Math.max(0, f.coloane - latime(celule))), tag);
  };

  // Coloanele cu descrieri: cele in care MAJORITATEA pozitiilor au text lung.
  // Decis pe o singura celula, o nota de subsol sau un rand de total intindea
  // coloane care altfel tin „IZOLATII" sau „buc".
  const coloana = (celule: CelulaBruta[], i: number): number => celule.slice(0, i).reduce((s, c) => s + c.span, 0);
  const randuriPozitii = sub.filter((r) => r.linie !== undefined);
  const lungiPe = new Map<number, number>();
  for (const r of randuriPozitii) {
    r.celule.forEach((c, i) => {
      if (c.span === 1 && textCelula(c.v).length > 40) lungiPe.set(coloana(r.celule, i), (lungiPe.get(coloana(r.celule, i)) ?? 0) + 1);
    });
  }
  // Majoritatea, sau macar un sfert cand e coloana cu cele mai multe texte
  // lungi: in Book15 jumatate din pozitii sunt randuri de continuare („Same -
  // Ø125 mm"), iar descrierea ramanea cat coloana „Comments".
  const celeMaiMulte = Math.max(0, ...lungiPe.values());
  const coloaneLungi = new Set([...lungiPe].filter(([, n]) =>
    n * 2 >= randuriPozitii.length || (n === celeMaiMulte && n * 4 >= randuriPozitii.length)).map(([k]) => k));

  const capete = f.antet
    ? celuleVizibile(f.antet.celule, "th", (c) => ` scope="col">${esc(textCelula(c.v))}`)
    : Array.from({ length: f.coloane }, (_, i) => i).filter((i) => !ascunse.has(i))
      .map((i) => `<th scope="col" class="litera">${litera(i)}</th>`).join("");

  const antet = antetDocument(f.randuri.filter((r) => r.rand < inceput).map((r) => r.celule.map((c) => textCelula(c.v))));

  // Numele coloanei pe fiecare celula: pe ecran ingust randul devine card, iar
  // fara capul tabelului „120" si „ml" n-ar mai spune ce sunt.
  const numeColoana = new Map<number, string>();
  if (f.antet) {
    let c = 0;
    for (const cel of f.antet.celule) {
      const t = textCelula(cel.v).replace(/\s+/g, " ").trim();
      if (t) numeColoana.set(c, t);
      c += cel.span;
    }
  }
  const eticheta = (k: number): string => numeColoana.get(k) ?? `Coloana ${litera(k)}`;

  const corp = randuri.map((r) => {
    const l = pozitie(r.linie?.index);
    const celule = celuleVizibile(r.celule, "td", (c, i, lung) => {
      const text = textCelula(c.v);
      const k = coloana(r.celule, i);
      return `${lung ? ` class="imp-desc"` : ""}${text.trim() === "" ? ` data-gol` : ""} data-eticheta="${esc(eticheta(k))}"><div class="camp${lung ? " lung" : ""}${typeof c.v === "number" ? " nr" : ""}"
        contenteditable="true" spellcheck="false" data-foaie="${esc(f.nume)}" data-rand="${r.rand}" data-cel="${i}">${esc(text)}</div>`;
    });
    const extrase = l ? celuleExtrase(l, o) : `<td class="extras"></td>`.repeat(COLOANE_EXTRASE);
    const rand = `<tr${l ? ` data-idx="${l.extras.index}" data-stare="${stareLinie(l)}"` : ""}><td class="gutter" data-eticheta="Rândul">${r.rand}</td>${
      celule}${extrase}</tr>`;
    const editor = l && o.editIdx === l.extras.index
      ? `<tr class="imp-grila-editor"><td colspan="${nrVizibile + 1 + COLOANE_EXTRASE}">${editorPozitie(l, { campuri: campuriRand(r, f.antet) })}</td></tr>`
      : "";
    return rand + editor;
  }).join("");

  // Numarul randului si coloanele noastre au latime fixa, in pixeli; coloanele
  // clientului primesc procente care insumeaza 100%, iar cu `table-layout:
  // fixed` browserul le imparte doar ce ramane dupa cele fixe. Asa „Stare" e
  // mereu ultima, lipita de marginea din dreapta, iar celelalte vin pana la ea.
  const client = latimi(f, sub, ascunse, coloaneLungi);
  const sumaClient = client.reduce((a, b) => a + b, 0);
  const coloane = [`<col style="width:${PX_RAND}px">`,
    ...client.map((w) => `<col style="width:${((w / sumaClient) * 100).toFixed(2)}%">`),
    `<col style="width:${PX_INTELES}px">`, `<col style="width:${PX_STARE}px">`].join("");

  return `<section class="imp-card imp-excel">
    ${antetHtml(antet, o.cuNumeFoaie ? f.nume : null)}
    <div class="tabelwrap" tabindex="0"><table>
      <colgroup>${coloane}</colgroup>
      <thead><tr><th scope="col" class="gutter">${f.antet ? `r${f.antet.rand}` : "#"}</th>${capete}
        <th scope="col" class="extras">Am înțeles · preț</th>
        <th scope="col" class="extras">Stare</th></tr></thead>
      <tbody>${corp}</tbody>
    </table></div>
  </section>`;
}
