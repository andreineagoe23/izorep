/**
 * Oferta în fișierul clientului (Etapa 5, `docs/plan-dupa-demo.md`, N9–N10):
 * firma vrea să trimită oferta „în formatul în care a venit cererea”, cu foile
 * clientului neschimbate și doar coloanele noastre adăugate la sfârșit.
 *
 * Se scrie direct în XML-ul foii, cu JSZip, nu prin ExcelJS: ExcelJS rescrie
 * tot registrul și pierde ce nu înțelege (formatări condiționale, imagini,
 * validări, foi ascunse). Aici, fiecare fișier din arhivă rămâne cum era, cu
 * trei excepții: foile cu poziții (celulele noi, după ultima coloană folosită,
 * plus `<dimension>` și `<cols>`), `styles.xml` (trei stiluri noi, adăugate la
 * coadă: indicii vechi nu se mută) și nimic altceva. Celulele clientului nu se
 * ating; pe rândurile atinse pleacă doar `spans`, care e un indiciu de citire,
 * nu conținut.
 *
 * Valori, nu formule: o formulă scrisă de noi peste cantitatea clientului ar
 * depinde de coloana pe care am citit-o, iar Excel ar recalcula alt total decât
 * cel din oferta salvată. Sumele sunt aceleași ca în oferta noastră
 * (`web/oferta.ts`): valoarea exactă pe linie, totalul rotunjit o dată.
 *
 * Fără DOM, ca `web/oferta.ts`: se testează în Node pe fișierele clienților.
 */
import JSZip from "jszip";
import { bani } from "../src/pricing/engine.js";
import type { LinieProcesata } from "../src/import/nucleu.js";
import { adaosFocIndustrial, totalOferta, valoareLinie } from "./oferta.js";

export class FisierNeXlsx extends Error {
  constructor() {
    super("Fișierul clientului nu e un .xlsx (poate e .xls vechi): oferta se poate descărca doar în formatul nostru.");
    this.name = "FisierNeXlsx";
  }
}

export interface OptiuniOfertaClient {
  /** Liniile care intră în ofertă, cu prețurile finale (după ajustare): `imparte(cuAjustare(…)).oferta`. */
  oferta: LinieProcesata[];
  destinatie: string;
  discountProcent?: number;
  /** Rândul de antet al fiecărei foi (1-based, ca în Excel), dacă s-a găsit: etichetele coloanelor stau acolo. */
  randAntet?: ReadonlyMap<string, number>;
  /**
   * Ultimul rând cu o poziție de izolație pe fiecare foaie, cu preț sau fără:
   * totalul stă sub el. Fără el, sub ultima poziție cu preț — pe Matari asta
   * punea totalul printre golurile EI180, care n-au preț.
   */
  ultimulRand?: ReadonlyMap<string, number>;
}

/** Ce s-a scris, pentru ecran și pentru teste. */
export interface RezultatOfertaClient {
  fisier: ArrayBuffer;
  /** Foile cu poziții, cu coloanele în care am scris (`["L", "M"]`). */
  foi: { nume: string; coloane: [string, string]; pozitii: number }[];
  totalGeneral: number;
}

/* --------------------------------------------------------------- XML mic */

const escXml = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const unescXml = (s: string): string =>
  s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");

/** „A” = 1, „AA” = 27. */
export const indexColoana = (litere: string): number =>
  [...litere.toUpperCase()].reduce((n, c) => n * 26 + (c.charCodeAt(0) - 64), 0);
export const literaColoana = (n: number): string => {
  let s = "";
  for (let x = n; x > 0; x = Math.floor((x - 1) / 26)) s = String.fromCharCode(65 + ((x - 1) % 26)) + s;
  return s;
};

const atribut = (tag: string, nume: string): string | undefined =>
  new RegExp(`\\s${nume}="([^"]*)"`).exec(tag)?.[1];

/** Calea foii în arhivă, după numele ei din registru. */
function caiFoi(workbook: string, rels: string): Map<string, string> {
  const tinte = new Map<string, string>();
  for (const m of rels.matchAll(/<Relationship\b[^>]*>/g)) {
    const id = atribut(m[0], "Id");
    const tinta = atribut(m[0], "Target");
    if (!id || !tinta) continue;
    tinte.set(id, tinta.startsWith("/") ? tinta.slice(1) : `xl/${tinta.replace(/^\.\//, "")}`);
  }
  const out = new Map<string, string>();
  for (const m of workbook.matchAll(/<sheet\b[^>]*>/g)) {
    const nume = atribut(m[0], "name");
    const id = atribut(m[0], "r:id") ?? /\s[\w]+:id="([^"]*)"/.exec(m[0])?.[1];
    const cale = id ? tinte.get(id) : undefined;
    if (nume !== undefined && cale) out.set(unescXml(nume), cale);
  }
  return out;
}

interface Stiluri { numar: number; numarBold: number; textBold: number }

/**
 * Trei stiluri noi, la coada listelor: număr cu două zecimale (formatul
 * încorporat 4, „#,##0.00”), același îngroșat și text îngroșat. Indicii
 * existenți nu se schimbă, deci celulele clientului arată la fel.
 */
function adaugaStiluri(styles: string): { xml: string; s: Stiluri } | null {
  const fonts = /<fonts\b[^>]*>([\s\S]*?)<\/fonts>/.exec(styles);
  const xfs = /<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/.exec(styles);
  if (!fonts || !xfs) return null;
  const nrFonturi = (fonts[1]!.match(/<font\b/g) ?? []).length;
  const nrXf = (xfs[1]!.match(/<xf\b/g) ?? []).length;
  const bold = nrFonturi;
  const fonturiNoi = `<font><b/><sz val="11"/><name val="Calibri"/><family val="2"/></font>`;
  const xfNoi = `<xf numFmtId="4" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>`
    + `<xf numFmtId="4" fontId="${bold}" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>`
    + `<xf numFmtId="0" fontId="${bold}" fillId="0" borderId="0" xfId="0" applyFont="1"/>`;
  const cuNumar = (tag: string, n: number): string =>
    /\scount="\d+"/.test(tag) ? tag.replace(/\scount="\d+"/, ` count="${n}"`) : tag.replace(/>$/, ` count="${n}">`);
  let xml = styles.replace(fonts[0], cuNumar(/<fonts\b[^>]*>/.exec(fonts[0])![0], nrFonturi + 1) + fonts[1] + fonturiNoi + "</fonts>");
  const xfs2 = /<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/.exec(xml)!;
  xml = xml.replace(xfs2[0], cuNumar(/<cellXfs\b[^>]*>/.exec(xfs2[0])![0], nrXf + 3) + xfs2[1] + xfNoi + "</cellXfs>");
  return { xml, s: { numar: nrXf, numarBold: nrXf + 1, textBold: nrXf + 2 } };
}

type Celula = { col: number; html: (ref: string) => string };


const celulaNumar = (v: number, stil?: number): Celula["html"] => (ref) =>
  `<c r="${ref}"${stil !== undefined ? ` s="${stil}"` : ""}><v>${v}</v></c>`;
const celulaText = (t: string, stil?: number): Celula["html"] => (ref) =>
  `<c r="${ref}"${stil !== undefined ? ` s="${stil}"` : ""} t="inlineStr"><is><t xml:space="preserve">${escXml(t)}</t></is></c>`;

/**
 * Ultima coloană folosită pe foaie: celulele cu conținut (valoare, text,
 * formulă) și îmbinările. O celulă goală doar formatată (chenar, fundal) nu
 * contează: unele foi au stil până la coloana Z și coloanele noastre ar fi
 * ajuns departe de tabel.
 */
function ultimaColoana(foaie: string): number {
  let max = 0;
  for (const m of foaie.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
    if (!m[2] || !/<(?:v|is|f)\b/.test(m[2])) continue;
    const ref = /\sr="([A-Z]+)\d+"/.exec(m[1]!)?.[1];
    if (ref) max = Math.max(max, indexColoana(ref));
  }
  for (const m of foaie.matchAll(/<mergeCell\b[^>]*\sref="[A-Z]+\d+:([A-Z]+)\d+"/g)) max = Math.max(max, indexColoana(m[1]!));
  return max;
}

const CELULA = /<c\b[^>]*?(?:\/>|>[\s\S]*?<\/c>)/g;
const colCelulei = (xml: string): number => indexColoana(/\sr="([A-Z]+)\d+"/.exec(xml)?.[1] ?? "");

/**
 * Pune celulele noi pe rândurile lor, în ordinea coloanelor (Excel o cere); o
 * celulă goală, doar formatată, din coloana noastră se înlocuiește. Rândurile
 * care lipsesc se fac, în ordine.
 */
function scrieCelule(foaie: string, pe: Map<number, Celula[]>): string {
  const sd = /<sheetData\s*\/>|<sheetData\b[^>]*>([\s\S]*?)<\/sheetData>/.exec(foaie);
  if (!sd) throw new Error("Foaia n-are <sheetData>.");
  const continut = sd[1] ?? "";
  const randuri: { r: number; xml: string }[] = [];
  for (const m of continut.matchAll(/<row\b[^>]*?(?:\/>|>[\s\S]*?<\/row>)/g)) {
    const r = Number(atribut(/<row\b[^>]*>/.exec(m[0])![0], "r"));
    // Rânduri sau celule fără adresă (voie în format, rar, de la alte programe): nu ghicim unde suntem.
    if (!Number.isInteger(r) || [...m[0].matchAll(/<c\b[^>]*>/g)].some((c) => !/\sr="[A-Z]+\d+"/.test(c[0]))) {
      throw new Error("Foaia are rânduri fără adresă: nu se poate scrie sigur în ea.");
    }
    randuri.push({ r, xml: m[0] });
  }
  for (const [r, cel] of pe) {
    const noi = cel.map((c) => ({ col: c.col, xml: c.html(`${literaColoana(c.col)}${r}`) }));
    const ale = new Set(noi.map((c) => c.col));
    const ex = randuri.find((x) => x.r === r);
    if (!ex) { randuri.push({ r, xml: `<row r="${r}">${noi.sort((a, b) => a.col - b.col).map((c) => c.xml).join("")}</row>` }); continue; }
    const deschis = /<row\b[^>]*?\/?>/.exec(ex.xml)![0];
    const inceput = deschis.replace(/\sspans="[^"]*"/, "").replace(/\s*\/>$/, ">");
    const interior = deschis.endsWith("/>") ? "" : ex.xml.slice(deschis.length, -"</row>".length);
    const vechi = [...interior.matchAll(CELULA)].map((m) => ({ col: colCelulei(m[0]), xml: m[0] }));
    // Peste o celulă cu conținut nu se scrie niciodată: coloanele noastre sunt după ultima folosită.
    if (vechi.some((c) => ale.has(c.col) && /<(?:v|is|f)\b/.test(c.xml))) throw new Error(`Rândul ${r} are deja ceva în coloanele noi.`);
    const rest = interior.replace(CELULA, "");
    const toate = [...vechi.filter((c) => !ale.has(c.col)), ...noi].sort((a, b) => a.col - b.col);
    ex.xml = `${inceput}${toate.map((c) => c.xml).join("")}${rest}</row>`;
  }
  randuri.sort((a, b) => a.r - b.r);
  return foaie.replace(sd[0], `<sheetData>${randuri.map((x) => x.xml).join("")}</sheetData>`);
}

function latimiColoane(foaie: string, de: number, pana: number): string {
  const col = `<col min="${de}" max="${pana}" width="16" customWidth="1"/>`;
  const cols = /<cols>([\s\S]*?)<\/cols>/.exec(foaie);
  if (cols) {
    // O coloană a clientului întinsă peste ale noastre (max="16384") le dă lățimea ei: nu se suprapune nimic.
    const acopera = [...cols[1]!.matchAll(/<col\b[^>]*>/g)].some((m) => Number(atribut(m[0], "max")) >= de);
    return acopera ? foaie : foaie.replace(cols[0], `<cols>${cols[1]}${col}</cols>`);
  }
  return foaie.replace(/<sheetData\b/, `<cols>${col}</cols><sheetData`);
}

function dimensiune(foaie: string, col: number, rand: number): string {
  return foaie.replace(/(<dimension\b[^>]*\sref=")([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?(")/, (_t, a, c1, r1, c2, r2, z) => {
    const cMax = Math.max(indexColoana(c2 ?? c1), col);
    const rMax = Math.max(Number(r2 ?? r1), rand);
    return `${a}${c1}${r1}:${literaColoana(cMax)}${rMax}${z}`;
  });
}

/* ------------------------------------------------------------- oferta */

/**
 * Fișierul clientului, cu „Preț unitar (€)” și „Valoare (€)” pe rândurile din
 * ofertă și totalul sub ultima poziție a fiecărei foi. Cu mai multe foi, pe
 * ultima: totalul ofertei; apoi, pe ofertele care le au, adaosul de foc și
 * discountul, și totalul general. Rândurile care nu intră în ofertă rămân fără
 * preț, ca în oferta noastră.
 */
export async function ofertaInFisierulClientului(fisier: ArrayBuffer, o: OptiuniOfertaClient): Promise<RezultatOfertaClient> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(fisier);
  } catch {
    throw new FisierNeXlsx();
  }
  const wb = await zip.file("xl/workbook.xml")?.async("string");
  const rels = await zip.file("xl/_rels/workbook.xml.rels")?.async("string");
  if (!wb || !rels) throw new FisierNeXlsx();
  const cai = caiFoi(wb, rels);

  const stylesXml = await zip.file("xl/styles.xml")?.async("string");
  const st = stylesXml ? adaugaStiluri(stylesXml) : null;
  if (st) zip.file("xl/styles.xml", st.xml);
  const s: Partial<Stiluri> = st?.s ?? {};

  // Foile în ordinea registrului, fiecare cu pozițiile ei.
  const ordine = [...cai.keys()];
  const peFoaie = new Map<string, LinieProcesata[]>();
  for (const l of o.oferta) {
    if (!cai.has(l.bruta.foaie)) throw new Error(`Foaia „${l.bruta.foaie}” nu mai e în fișier.`);
    peFoaie.set(l.bruta.foaie, [...(peFoaie.get(l.bruta.foaie) ?? []), l]);
  }
  const foi = ordine.filter((n) => peFoaie.has(n));
  const total = totalOferta(o.oferta);
  const adaos = adaosFocIndustrial(o.oferta, o.destinatie);
  const brut = bani(total + adaos);
  const procent = o.discountProcent ?? 0;
  const discount = procent > 0 ? bani(brut * procent / 100) : 0;
  const totalGeneral = bani(brut - discount);

  const scrise: RezultatOfertaClient["foi"] = [];
  for (const [i, nume] of foi.entries()) {
    const cale = cai.get(nume)!;
    let xml = (await zip.file(cale)?.async("string")) ?? "";
    if (!xml) throw new Error(`Foaia „${nume}” lipsește din arhivă.`);
    const linii = peFoaie.get(nume)!.slice().sort((a, b) => a.bruta.rand - b.bruta.rand);
    const cPret = ultimaColoana(xml) + 1;
    const cVal = cPret + 1;
    const pe = new Map<number, Celula[]>();
    const pune = (r: number, ...c: Celula[]): void => { pe.set(r, [...(pe.get(r) ?? []), ...c]); };

    const prima = linii[0]!.bruta.rand;
    const antet = o.randAntet?.get(nume);
    const randEtichete = antet !== undefined && antet < prima ? antet : prima - 1;
    const etichete = (rand: number): void => pune(rand, { col: cPret, html: celulaText("Preț unitar (€)", s.textBold) },
      { col: cVal, html: celulaText("Valoare (€)", s.textBold) });
    if (randEtichete >= 1) etichete(randEtichete);
    for (const l of linii) {
      pune(l.bruta.rand, { col: cPret, html: celulaNumar(l.pret!.pret_unitar, s.numar) },
        { col: cVal, html: celulaNumar(valoareLinie(l), s.numar) });
    }
    let r = Math.max(linii.at(-1)!.bruta.rand, o.ultimulRand?.get(nume) ?? 0) + 1;
    const rand = (eticheta: string, v: number): void => {
      pune(r++, { col: cPret, html: celulaText(eticheta, s.textBold) }, { col: cVal, html: celulaNumar(v, s.numarBold) });
    };
    const ultima = i === foi.length - 1;
    if (foi.length > 1) rand(`Total foaia ${nume}`, totalOferta(linii));
    if (ultima) {
      rand(foi.length > 1 ? "TOTAL OFERTĂ" : "TOTAL", total);
      if (adaos) rand("Adaos închideri la foc", adaos);
      if (discount) rand(`Discount ${String(procent).replace(".", ",")} %`, -discount);
      if (adaos || discount) rand("TOTAL GENERAL", totalGeneral);
    }
    // Foaia începe direct cu pozițiile (TRANSAVIA, de la rândul 1): etichetele, sub totaluri.
    if (randEtichete < 1) etichete(r++);
    xml = scrieCelule(xml, pe);
    xml = dimensiune(xml, cVal, r - 1);
    xml = latimiColoane(xml, cPret, cVal);
    zip.file(cale, xml);
    scrise.push({ nume, coloane: [literaColoana(cPret), literaColoana(cVal)], pozitii: linii.length });
  }
  const out = await zip.generateAsync({ type: "arraybuffer", compression: "DEFLATE" });
  return { fisier: out, foi: scrise, totalGeneral };
}
