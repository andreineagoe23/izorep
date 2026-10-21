import type { LinieProcesata } from "../../src/import/nucleu.js";
import type { CampuriRand } from "../../src/import/editare.js";
import type { FoaieBruta } from "../../src/import/parse-workbook.js";
import { esc, eur, tabel } from "../ecrane/tip.js";
import type { DocumentOferta, PozitieOferta } from "../document-oferta.js";
import { STARE } from "./text.js";
import type { FiltruStare } from "./vizual.js";

/**
 * Pasul de verificare, în două taburi (Andrei, 21 octombrie 2026):
 * „Verificare”, ce a înțeles aplicația și angajatul corectează
 * (`verificare-vizual.ts`), și „Cum iese oferta”, exact Excelul care s-ar
 * descărca în clipa aceea. Amândouă din `documentOferta`, documentul din care
 * se scrie Excelul (`web/registru-oferta.ts`), deci ce se vede e ce pleacă.
 * Foaia clientului ca în Excel a ieșit: descrierea și rândul lui stau la
 * „Verificare”.
 *
 * Pur, fără DOM, ca restul marcajului importului: testat în Node.
 */

/** Cele două taburi de la verificare: ce a înțeles aplicația, și Excelul cum ar ieși acum. */
export type Vedere = "verificare" | "export";

/** Datele de pe antetul ofertei, cum le scrie omul la pasul „Oferta”; se țin în sesiune. */
export interface AntetScris {
  firma: string;
  numar: string;
  data: string;
  client: string;
  obiectiv: string;
  persoana: string;
  localitate: string;
  discount: number;
}

/* ------------------------------------------------- antetul din fișier */

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


const ETICHETE: [keyof Pick<AntetScris, "client" | "obiectiv" | "persoana">, RegExp][] = [
  ["client", /^(beneficiar|client|investitor|antreprenor|owner|customer)\b/i],
  ["obiectiv", /^(obiectiv|proiect|nume proiect|lucrare|santier|șantier|project|object)\b/i],
  ["persoana", /^(in atentia|în atenția|attn|contact|persoana de contact)\b/i],
];

/**
 * Beneficiarul, obiectivul și persoana, citite din rândurile de deasupra
 * tabelului („Beneficiar : Construct Nord SRL”). Până pe 14 octombrie 2026
 * pasul „Oferta” propunea ca beneficiar numele fișierului („Cerere Chitila”),
 * deși pasul de verificare arăta beneficiarul scris în fișier.
 */
export function antetDinFisier(foi: readonly FoaieBruta[]): Partial<Pick<AntetScris, "client" | "obiectiv" | "persoana">> {
  const out: Partial<Pick<AntetScris, "client" | "obiectiv" | "persoana">> = {};
  for (const f of foi) {
    const inceput = f.antet ? f.antet.rand : 0;
    if (inceput <= 1) continue;
    const a = antetDocument(f.randuri.filter((r) => r.rand < inceput)
      .map((r) => r.celule.map((c) => (c.v === null || c.v === undefined ? "" : String(c.v)))));
    for (const [k, v] of a.date) {
      const camp = ETICHETE.find(([, re]) => re.test(k.trim()))?.[0];
      if (camp && !out[camp] && v.trim()) out[camp] = v.trim();
    }
  }
  return out;
}

/* ------------------------------------------------------------ bara */

const VEDERI: [Vedere, string][] = [["verificare", "Verificare"], ["export", "Cum iese oferta"]];

/** Filtrele de stare, cu cifra lor. Aceleași butoane ca până acum. */
function butoaneStare(numere: Record<FiltruStare, number>, activ: FiltruStare): string {
  const b = (f: FiltruStare, e: string): string =>
    `<button type="button" class="imp-filtru" data-filtru="${f}"${f === "toate" ? "" : ` data-stare="${f}"`}
      aria-pressed="${f === activ}">${e} <b>${numere[f]}</b></button>`;
  return b("toate", "Toate") + b("gata", STARE.gata) + b("de_validat", STARE.de_validat) + b("netarifate", STARE.netarifate);
}

/**
 * Bara de deasupra pozițiilor: în stânga ce arăt (filtrele, doar la
 * verificare: Excelul are doar pozițiile gata), în dreapta tabul. Două
 * coloane ~70 / 30, cu un text scurt deasupra fiecărui control.
 */
export function baraVerificare(numere: Record<FiltruStare, number>, filtru: FiltruStare, vedere: Vedere): string {
  return `<section class="imp-card imp-bara-foi">
    <div class="imp-bara-stanga">${vedere === "verificare"
      ? `<p class="imp-eticheta-control" id="eticheta-filtre">Arată pozițiile</p>
      <div class="imp-filtre" role="group" aria-labelledby="eticheta-filtre">${butoaneStare(numere, filtru)}</div>`
      : `<p class="imp-eticheta-control">Exact ce descarci acum, la pasul „Oferta”</p>
      <p class="imp-ajutor">Doar pozițiile gata. Ce schimbi la „Verificare” se vede aici.</p>`}
    </div>
    <div class="imp-bara-dreapta">
      <fieldset class="imp-segment imp-vedere">
        <legend>Ce vezi</legend>
        <div>${VEDERI.map(([v, e]) => `<label><input type="radio" name="vedere" value="${v}"${v === vedere ? " checked" : ""} />`
          + `<span>${e}</span></label>`).join("")}</div>
      </fieldset>
    </div>
  </section>`;
}

/* ------------------------------------------------------- documentul */

export interface OptiuniDocument {
  /** Liniile importului, pe index: starea, ce am înțeles, acțiunile. */
  linii: ReadonlyMap<number, LinieProcesata>;
  /** Pozițiile care trec de filtre; `null` = toate. */
  vizibile: ReadonlySet<number> | null;
  editIdx: number | null;
  propunere: (l: LinieProcesata) => number | null;
  /** Celulele rândului din fișier, pentru editorul deschis. */
  campuri?: CampuriRand;
  /** Fișierul are mai multe foi: rândul spune și foaia. */
  cuFoaie: boolean;
  /**
   * Ce a schimbat omul pe poziție (denumirea, cantitatea, prețul unitar),
   * fiecare cu ce era înainte, în cuvinte: caseta e galbenă și o spune.
   */
  schimbari?: (p: PozitieOferta) => SchimbariPozitie;
}

/** Câmpurile scrise de om pe o poziție; valoarea e ce era înainte. */
export interface SchimbariPozitie {
  den?: string;
  cant?: string;
  pret?: string;
}

const numar = (n: number): string => n.toLocaleString("ro-RO", { maximumFractionDigits: 3 });

/** Coloanele, după document: codul doar cu coduri, golul doar la foc. Aceleași ca în Excel, fără diacritice. */
function capete(d: DocumentOferta): [string, string][] {
  return [
    ["Nr.", "nr"],
    ...(d.coloanaCod ? [["Cod", "cod"] as [string, string]] : []),
    ["Denumire", "den"],
    ["UM", "um"],
    ["Cantitate", "n"],
    ...(d.coloaneGol ? [["Dimensiune gol", "gol"], ["Suprafata (mp)", "n"]] as [string, string][] : []),
    ["Pret unitar Euro", "n"],
    ["Pret total Euro", "n"],
  ];
}

/**
 * Tabul „Cum iese oferta”: Excelul care s-ar descărca acum, doar citire, cu
 * aceleași rânduri ca foaia „Ofertă” din `registru-oferta.ts`: titlul,
 * numărul, „In atentia”, beneficiarul, obiectivul, pozițiile gata pe capitole
 * cu subtotal, specificația noastră cu roșu în denumire, totalurile, nota,
 * elementele speciale și semnătura. Fără logo: îl pune doar Excelul.
 */
export function exportPeEcran(d: DocumentOferta): string {
  const a = d.antet;
  const col = capete(d);
  const n = col.length;
  const cuNumar = d.capitole.filter((c) => c.pozitii.some((p) => p.nr !== null));
  const corp = cuNumar.map((cap) => {
    const randuri = cap.pozitii.filter((p) => p.nr !== null).map((p) => `<tr>
      <td data-eticheta="Nr.">${p.nr}</td>${d.coloanaCod ? `<td class="ex-cod" data-eticheta="Cod">${esc(p.cod ?? "")}</td>` : ""}
      <td>${esc(p.textOferta)}${p.specificatie ? ` <span class="ex-rosu">${esc(p.specificatie)}</span>` : ""}</td>
      <td data-eticheta="UM">${esc(p.um)}</td><td class="n" data-eticheta="Cantitate">${numar(p.cantitate)}</td>
      ${d.coloaneGol ? `<td data-eticheta="Dimensiune gol">${p.gol ? esc(p.gol.dimensiune) : ""}</td>`
        + `<td class="n" data-eticheta="Suprafata (mp)">${p.gol ? numar(p.gol.suprafata) : ""}</td>` : ""}
      <td class="n" data-eticheta="Pret unitar Euro">${eur(p.pretUnitar!)}</td><td class="n" data-eticheta="Pret total Euro">${eur(p.valoare!)}</td></tr>`).join("");
    const titlu = cap.titlu ? `<tr class="ex-capitol"><th colspan="${n}" scope="colgroup">${esc(cap.titlu)}</th></tr>` : "";
    const subtotal = cap.titlu && cuNumar.length > 1
      ? `<tr class="ex-total"><td colspan="${n - 1}">Total ${esc(cap.titlu)}</td><td class="n">${eur(cap.subtotal)}</td></tr>` : "";
    return `<tbody>${titlu}${randuri}${subtotal}</tbody>`;
  }).join("");
  const total = (eticheta: string, valoare: number): string =>
    `<div class="ex-suma"><span>${eticheta}</span><strong>${eur(valoare)}</strong></div>`;
  const afara = d.numarate.de_validat + d.numarate.netarifate;
  const camp = (v: string): string => (v.trim() ? esc(v) : `<span class="of-gol">de completat</span>`);
  return `<section class="imp-card ex" aria-label="Cum iese oferta">
    ${afara > 0 ? `<p class="of-afara">Nu intră încă: ${d.numarate.de_validat} de verificat și ${d.numarate.netarifate} fără preț. Le rezolvi la „Verificare”.</p>` : ""}
    <header class="ex-antet">
      <h2>OFERTA LUCRARI IZOLATII TERMICE</h2>
      <p>${a.numar.trim() ? `Nr. ${esc(a.serie)}${esc(a.numar)} / ${esc(a.data)}` : `Nr. <span class="of-gol">de completat</span> / ${esc(a.data)}`}</p>
      <dl>
        <div><dt>In atentia</dt><dd>${camp(a.persoana)}</dd></div>
        <div><dt>Beneficiar</dt><dd>${camp(a.client)}</dd></div>
        <div><dt>Obiectiv</dt><dd>${camp(a.obiectiv)}</dd></div>
      </dl>
      <button type="button" class="secundar" data-pas="3">Completează datele ofertei</button>
    </header>
    ${corp ? `<div class="tabelwrap ex-tabelwrap" tabindex="0"><table class="ex-tabel">
      <thead><tr>${col.map(([t, c]) => `<th scope="col" class="ex-col-${c}${c === "n" ? " n" : ""}">${t}</th>`).join("")}</tr></thead>
      ${corp}
    </table></div>` : `<p class="imp-gol">Nicio poziție gata încă.</p>`}
    <div class="ex-sume">
      ${d.adaosFoc > 0 ? total("ADAOS INCHIDERI GOLURI LA FOC, OFERTA INDUSTRIALA 20 %", d.adaosFoc) : ""}
      ${total("TOTAL LUCRARI IZOLATII TERMICE (fara TVA)", d.total)}
      ${d.discount > 0 ? total(`DISCOUNT ${String(d.antet.discountProcent ?? 0).replace(".", ",")} %`, d.discount)
        + total("TOTAL GENERAL (FARA TVA)", d.totalGeneral) : ""}
    </div>
    <div class="ex-nota"><p><strong>Nota :</strong></p>${d.note.map((x) => `<p>${esc(x)}</p>`).join("")}</div>
    ${d.speciale.map((t) => `<div class="of-speciale"><p>${esc(t.titlu)}</p>${
      tabel(t.capete, t.randuri.map((r) => `<tr>${r.map((v) => `<td>${esc(v)}</td>`).join("")}</tr>`))}</div>`).join("")}
    <footer class="ex-semnatura"><p>${esc(a.localitate)},<br>${esc(a.data)}</p><p>${esc(a.firma)}</p></footer>
  </section>`;
}
