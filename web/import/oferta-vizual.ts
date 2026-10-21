import type { LinieProcesata } from "../../src/import/nucleu.js";
import type { CampuriRand } from "../../src/import/editare.js";
import type { FoaieBruta } from "../../src/import/parse-workbook.js";
import { cate, esc, eur, tabel } from "../ecrane/tip.js";
import { logoFirmei } from "../date/firme.js";
import type { DocumentOferta, PozitieOferta } from "../document-oferta.js";
import { antetDocument } from "./grila.js";
import { inteles, STARE } from "./text.js";
import { celulaNumar, celulaText } from "../celula.js";
import { actiuniPozitie, starePozitie, editorPozitie, type FiltruStare } from "./vizual.js";

/**
 * Verificarea importului în formatul ofertei (14 octombrie 2026, cerut de
 * Andrei): „cererile vin în structuri diferite, dar când ajung la noi pe
 * pagină și la export trebuie să aibă același format”.
 *
 * Ce se vede e `documentOferta`, adică exact documentul din care se scrie
 * Excelul (`web/registru-oferta.ts`): aceleași coloane pentru orice fișier
 * (Nr., Cod doar cu coduri, Denumire, UM, Cantitate, golul doar la foc, Preț
 * unitar, Valoare), capitolele clientului cu subtotal, totalul și discountul.
 * Lângă fiecare poziție, ce i-a trebuit omului ca s-o verifice: rândul din
 * fișier, ce am înțeles, starea și butonul care o rezolvă.
 *
 * Pozițiile „De verificat” și „Fără preț” stau la locul lor în capitol, fără
 * număr: nu pleacă la client până nu sunt rezolvate (`imparte`), exact ca în
 * Excel. Fișierul clientului rămâne la un clic, ca referință.
 *
 * Pur, fără DOM, ca restul marcajului importului: testat în Node.
 */

export type Vedere = "oferta" | "fisier";

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

const VEDERI: [Vedere, string][] = [["oferta", "Ca în ofertă"], ["fisier", "Fișierul clientului"]];

/** Filtrele de stare, cu cifra lor. Aceleași butoane ca până acum. */
function butoaneStare(numere: Record<FiltruStare, number>, activ: FiltruStare): string {
  const b = (f: FiltruStare, e: string): string =>
    `<button type="button" class="imp-filtru" data-filtru="${f}"${f === "toate" ? "" : ` data-stare="${f}"`}
      aria-pressed="${f === activ}">${e} <b>${numere[f]}</b></button>`;
  return b("toate", "Toate") + b("gata", STARE.gata) + b("de_validat", STARE.de_validat) + b("netarifate", STARE.netarifate);
}

/**
 * Bara de deasupra pozițiilor: în stânga ce arăt (filtrele), în dreapta cum
 * arăt (oferta sau fișierul clientului). Două coloane ~70 / 30, cu un text
 * scurt deasupra fiecărui control, ca antetul de deasupra ei.
 */
export function baraVerificare(numere: Record<FiltruStare, number>, filtru: FiltruStare, vedere: Vedere): string {
  return `<section class="imp-card imp-bara-foi">
    <div class="imp-bara-stanga">
      <p class="imp-eticheta-control" id="eticheta-filtre">Arată pozițiile</p>
      <div class="imp-filtre" role="group" aria-labelledby="eticheta-filtre">${butoaneStare(numere, filtru)}</div>
    </div>
    <div class="imp-bara-dreapta">
      <fieldset class="imp-segment imp-vedere">
        <legend>Mod de afișare</legend>
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
   * Tabelul se scrie pe loc, ca în Excel (15 octombrie 2026): denumirea,
   * cantitatea și prețul unitar sunt celule. Întoarce ce a schimbat omul pe
   * poziție, fiecare cu ce era înainte, în cuvinte.
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
const lipsa = `<span class="of-gol">—</span>`;

/** Antetul documentului, ca pe oferta firmei; ce nu e scris încă se completează la pasul „Oferta”. */
function antetOferta(d: DocumentOferta): string {
  const a = d.antet;
  const camp = (eticheta: string, valoare: string): string =>
    `<div><dt>${eticheta}</dt><dd>${valoare.trim() ? esc(valoare) : `<span class="of-gol">de completat</span>`}</dd></div>`;
  const logo = logoFirmei(a.firma);
  return `<header class="of-antet">
    <div class="of-antet-titlu">
      ${logo ? `<img class="of-logo" src="${logo.fisier}" alt="${esc(a.firma)}" width="${logo.latime}" height="${logo.inaltime}" />` : ""}
      <h2>Oferta lucrări izolații termice</h2>
      <p>${a.numar.trim() ? `Nr. ${esc(a.serie)}${esc(a.numar)} / ${esc(a.data)}` : `Fără număr încă · ${esc(a.data)}`} · ${esc(a.firma)}</p>
    </div>
    <dl class="of-antet-date">
      ${camp("Beneficiar", a.client)}
      ${camp("Obiectiv", a.obiectiv)}
      ${camp("În atenția", a.persoana)}
    </dl>
    <button type="button" class="secundar" data-pas="3">Completează datele ofertei</button>
  </header>`;
}

/** Denumirea: textul clientului, ce am completat noi și de unde vine rândul. */
function denumire(p: PozitieOferta, l: LinieProcesata, cuFoaie: boolean, s?: SchimbariPozitie): string {
  const sursa = `Excel: rândul ${p.sursa.rand}${cuFoaie ? `, foaia ${esc(p.sursa.foaie)}` : ""}`;
  const text = s
    ? celulaText({ ed: "den", text: p.textClient, eticheta: `Denumire, ${numePozitie(p)}`, clasa: "of-text",
      schimbat: s.den !== undefined, ...(s.den !== undefined ? { inainte: s.den } : {}), date: { idx: p.linie } })
    : `<p class="of-text">${esc(p.textClient)}</p>`;
  return `${text}
    ${p.specificatie ? `<p class="of-spec"><span>Completat de noi:</span> ${esc(p.specificatie)}</p>` : ""}
    <p class="of-meta"><span>${sursa}</span>${inteles(l.extras, l.pret).map((e) => `<span class="of-inteles">${esc(e)}</span>`).join("")}${
      l.sursa === "om" ? `<span class="imp-verificat">verificat de tine</span>` : ""}</p>`;
}

/** Coloanele, după document: codul doar cu coduri, golul doar la foc. Aceleași ca în Excel. */
function capete(d: DocumentOferta): [string, string][] {
  return [
    ["Nr.", "nr"],
    ...(d.coloanaCod ? [["Cod", "cod"] as [string, string]] : []),
    ["Denumire", "den"],
    ["UM", "um"],
    ["Cantitate", "n"],
    ...(d.coloaneGol ? [["Dimensiune gol", "gol"], ["Suprafață (mp)", "n"]] as [string, string][] : []),
    ["Preț unitar Euro", "n"],
    ["Preț total Euro", "n"],
    ["Stare", "stare"],
  ];
}

const numePozitie = (p: PozitieOferta): string => (p.nr === null ? "poziția fără număr" : `poziția ${p.nr}`);

function randPozitie(d: DocumentOferta, p: PozitieOferta, o: OptiuniDocument): string {
  const l = o.linii.get(p.linie)!;
  const editeaza = o.editIdx === p.linie;
  const s = o.schimbari?.(p);
  const cantitate = s
    ? celulaNumar({ ed: "cant", valoare: p.cantitate, eticheta: `Cantitate, ${numePozitie(p)}`,
      schimbat: s.cant !== undefined, ...(s.cant !== undefined ? { inainte: s.cant } : {}), date: { idx: p.linie } })
    : numar(p.cantitate);
  const pret = s
    ? celulaNumar({ ed: "pret", valoare: p.pretUnitar, eticheta: `Preț unitar, ${numePozitie(p)}`, gol: "fără preț",
      schimbat: s.pret !== undefined, ...(s.pret !== undefined ? { inainte: s.pret } : {}), date: { idx: p.linie } })
    : p.pretUnitar === null ? lipsa : eur(p.pretUnitar);
  const scoate = s ? `<button type="button" class="cel-scoate" data-act="scoate-pozitie" data-idx="${p.linie}"
      aria-label="Scoate ${numePozitie(p)} din ofertă" title="Scoate din ofertă">✕</button>` : "";
  const celule = [
    `<td class="of-nr" data-eticheta="Nr.">${p.nr ?? `<span class="of-gol" title="Nu intră încă în ofertă">—</span>`}</td>`,
    ...(d.coloanaCod ? [`<td class="of-cod" data-eticheta="Cod">${p.cod ? esc(p.cod) : ""}</td>`] : []),
    `<td class="of-den">${denumire(p, l, o.cuFoaie, s)}</td>`,
    `<td class="of-um" data-eticheta="UM">${esc(p.um || "—")}</td>`,
    s
      ? `<td class="n" data-eticheta="Cantitate"><span class="cel-cu-um">${cantitate}<span class="of-um-card">${esc(p.um)}</span></span></td>`
      : `<td class="n" data-eticheta="Cantitate">${cantitate}<span class="of-um-card"> ${esc(p.um)}</span></td>`,
    ...(d.coloaneGol ? [
      `<td class="of-gol-dim" data-eticheta="Dimensiune gol">${p.gol ? esc(p.gol.dimensiune) : ""}</td>`,
      `<td class="n" data-eticheta="Suprafață">${p.gol ? numar(p.gol.suprafata) : ""}</td>`,
    ] : []),
    `<td class="n" data-eticheta="Preț unitar Euro">${pret}</td>`,
    `<td class="n of-valoare" data-eticheta="Preț total Euro">${p.valoare === null ? lipsa : eur(p.valoare)}</td>`,
    `<td class="of-stare">${starePozitie(l)}<div class="of-actiuni">${actiuniPozitie(l, o.propunere(l), editeaza)}${scoate}</div></td>`,
  ];
  const n = capete(d).length;
  return `<tr class="of-poz" data-idx="${p.linie}" data-stare="${p.stare}"${p.nr === null ? ' data-afara="da"' : ""}>${celule.join("")}</tr>`
    + (editeaza ? `<tr class="of-editor"><td colspan="${n}">${editorPozitie(l, o.campuri ? { campuri: o.campuri } : {})}</td></tr>` : "");
}

/**
 * Oferta pe ecran: antetul, tabelul pe capitole, totalul. Filtrele ascund
 * rânduri, nu schimbă numerotarea: numărul e cel din ofertă, ca în Excel.
 */
export function documentPeEcran(d: DocumentOferta, o: OptiuniDocument): string {
  const col = capete(d);
  const n = col.length;
  const cuTitlu = d.capitole.filter((c) => c.titlu).length > 0;
  const vede = (p: PozitieOferta): boolean => o.vizibile === null || o.vizibile.has(p.linie);
  const corp = d.capitole.map((cap) => {
    const vazute = cap.pozitii.filter(vede);
    if (vazute.length === 0) return "";
    const inOferta = cap.pozitii.filter((p) => p.nr !== null).length;
    const titlu = cap.titlu ? `<tr class="of-capitol"><th colspan="${n}" scope="colgroup">${esc(cap.titlu)}
        <span>${inOferta === cap.pozitii.length ? cate(cap.pozitii.length, "poziții") : `${inOferta} din ${cap.pozitii.length} în ofertă`}</span></th></tr>` : "";
    const subtotal = cap.titlu && d.capitole.length > 1
      ? `<tr class="of-subtotal"><td colspan="${n - 2}">Total ${esc(cap.titlu)}</td><td class="n">${eur(cap.subtotal)}</td><td></td></tr>` : "";
    return `<tbody>${titlu}${vazute.map((p) => randPozitie(d, p, o)).join("")}${subtotal}</tbody>`;
  }).join("");

  const afara = d.numarate.de_validat + d.numarate.netarifate;
  const total = (eticheta: string, valoare: number, clasa = ""): string =>
    `<div class="of-total${clasa}"><span>${eticheta}</span><strong>${clasa.includes("minus") ? "−" : ""}${eur(valoare)}</strong></div>`;
  const totaluri = `<div class="of-totaluri">
    ${d.adaosFoc > 0 ? total("Adaos închideri goluri la foc, ofertă industrială, 20 %", d.adaosFoc) : ""}
    ${total("Total lucrări izolații termice (fără TVA)", d.total, d.discount > 0 ? "" : " of-total-final")}
    ${d.discount > 0 ? total(`Discount ${String(d.antet.discountProcent ?? 0).replace(".", ",")} %`, d.discount, " of-minus")
      + total("Total general (fără TVA)", d.totalGeneral, " of-total-final") : ""}
    ${afara > 0 ? `<p class="of-afara">Nu intră încă în ofertă: ${d.numarate.de_validat} de verificat și ${d.numarate.netarifate} fără preț.
      Rezolvate, primesc număr și intră în total.</p>` : ""}
  </div>`;

  return `<section class="imp-card of" aria-label="Oferta">
    ${antetOferta(d)}
    ${corp && o.schimbari ? `<p class="cel-legenda"><span><span class="mostra" aria-hidden="true"></span>scris de tine (ține mouse-ul pe celulă: vezi ce era)</span>
      <span>Scrii direct în tabel, ca în Excel. Prețul gol = cel din listă. ✕ scoate poziția din ofertă.</span></p>` : ""}
    ${corp ? `<div class="of-tabelwrap"><table class="of-tabel${cuTitlu ? " cu-capitole" : ""}">
      <colgroup>${col.map(([, c]) => `<col class="of-col-${c}">`).join("")}</colgroup>
      <thead><tr>${col.map(([t, c]) => `<th scope="col" class="${c === "n" ? "n" : ""}">${t}</th>`).join("")}</tr></thead>
      ${corp}
    </table></div>` : `<p class="imp-gol">Nicio poziție aici.</p>`}
    ${totaluri}
    <ul class="of-note">${d.note.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
    ${d.speciale.map((t) => `<div class="of-speciale"><p>${esc(t.titlu)}</p>${
      tabel(t.capete, t.randuri.map((r) => `<tr>${r.map((v) => `<td>${esc(v)}</td>`).join("")}</tr>`))}</div>`).join("")}
  </section>`;
}

/** Foile registrului, ca taburi, în vederea fișierului clientului; cifra = câte poziții cer atenție. */
export function taburiFoi(foi: readonly { nume: string; deRezolvat: number }[], activa: string | null): string {
  return `<section class="imp-card">
    <p class="imp-eticheta-control" id="eticheta-foi">Foile din fișier <span>· cifra arată câte poziții cer atenție pe foaie</span></p>
    <div class="imp-taburi" role="group" aria-labelledby="eticheta-foi" style="margin-top:8px">${foi.map((f) =>
      `<button type="button" class="imp-tab" data-act="foaie-tab" data-foaie="${esc(f.nume)}" aria-pressed="${f.nume === activa}">${esc(f.nume)}${
        f.deRezolvat > 0 ? ` <b>${f.deRezolvat}</b>` : ""}</button>`).join("")}</div>
  </section>`;
}
