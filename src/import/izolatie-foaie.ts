/**
 * Izolatia pe foaie: lista de tevi a instalatorului, fara izolatie pe rand.
 *
 * Cererea CET Constanta (ELSACO, 5 octombrie 2026) e asa: o foaie pe sistem
 * (GSS, OMS, PWS …), cu tevi, coturi, teuri, flanse, robineti, suruburi si
 * suporti, fiecare cu DN, material, cantitate si UM. Izolatia nu e scrisa pe
 * niciun rand: vine din specificatia proiectantului, pe sistem („Oil
 * Management System — 16.1-1-1, Mineral Wool Insulation with Cladding, Touch
 * Guard”), iar grosimea dintr-un tabel dupa diametru si temperatura
 * (`cerere-de-oferta-cet-constanta-clase-izolatie.pdf`).
 *
 * Omul alege, pe fiecare foaie, izolatia: materialul, grosimea (fixa sau dupa
 * un tabel) si protectia. Codul citeste tevile si piesele de pe foaie si le
 * scrie ca randuri de izolatie, in forma pe care importul o citeste determinist
 * (`textRand`, ca masuratorile din carnet). Nicio a doua cale de pret: lista
 * rezultata trece prin acelasi import, aceeasi tarifare si aceeasi oferta.
 *
 * Pur, fara ExcelJS: registrul il scrie apelantul (`registruCerere`).
 */
import type { FoaieBruta, RandBrut } from "./rand.js";
import { diametreDin, lista } from "../pricing/lists.js";
import { multiplicatorOptional } from "../pricing/engine.js";
import type { RandSantier } from "../santier/agrega.js";
import type { Element } from "../santier/schema.js";

/* ------------------------------------------------------- tevile de pe foaie */

export interface TeavaCitita {
  /** Randul din Excel. */
  rand: number;
  descriere: string;
  element: Element;
  diametru_valoare: number;
  diametru_tip: "exterior" | "DN";
  cantitate: number;
}

export interface TeviFoaie {
  foaie: string;
  tevi: TeavaCitita[];
  /** Randuri cu cantitate care nu se izoleaza: suruburi, suporti, aparate. */
  ignorate: number;
}

const normal = (s: string): string => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** Ce nu se izoleaza, oricat ar semana cu o piesa: prinderi, etansari, aparate de masura. */
const NU_SE_IZOLEAZA = /\b(screw|bolt|nut|washer|gasket|garnitur|surub|piulit|saib|support|suport|clamp|colier|bracket|hanger|thermowell|transmitter|gauge|manometer|thermometer|sensor|senzor|threadolet|weldolet|sockolet|nipple|niplu|cap|plug|dop|label|eticheta|exhaust|tecon|hilti|insulating joint)\b/;

/** Elementul, din descriere (engleza, romana, germana). Null = nu se izoleaza. */
export function elementDin(descriere: string): Element | null {
  const t = normal(descriere);
  if (NU_SE_IZOLEAZA.test(t)) return null;
  if (/\b(elbow|bend|cot|coturi|bogen|winkel)\b/.test(t)) return "cot";
  if (/\b(tee|teu|teuri|t-stuck)\b/.test(t)) return "teu";
  if (/\b(reducer|reductie|reductii|reduzier\w*)\b/.test(t)) return "reductie";
  // Robinetul inaintea flansei: „Ball valve … flanges will be …” e robinet.
  if (/\b(valve|robinet|robineti|vana|ventil|strainer|filtru|clapet)\b/.test(t)) return "robinet";
  if (/\b(flange|flansa|flanse|flansch)\b/.test(t)) return "flansa";
  if (/^\s*(pipe|teava|rohr|tube)\b|\b(teava|conducta)\b/.test(t)) return "ml";
  return null;
}

const nr = (s: string): number => Number(s.replace(",", "."));

/**
 * Diametrul: din descriere intai — „21.3x2.0”, „D 10x1.0”, „Da63xDa32”,
 * „- DN65” —, apoi din coloana DN („15”, „12mm”, „80x50”). La reductie si la
 * teul redus, primul e diametrul mare, ca in carnet („reductor 320 → 250”).
 */
export function diametruDin(descriere: string, dn: string | number | null): { valoare: number; tip: "exterior" | "DN" } | null {
  const t = descriere.replace(/\s+/g, " ");
  let m = t.match(/\bDa\s?(\d{1,4}(?:[.,]\d+)?)/i);
  if (m) return { valoare: nr(m[1]!), tip: "exterior" };
  m = t.match(/(?:^|[\s-])D?\s?(\d{1,4}(?:[.,]\d+)?)\s?x\s?\d{1,2}(?:[.,]\d+)?(?!\d)/i);
  if (m && nr(m[1]!) >= 6) return { valoare: nr(m[1]!), tip: "exterior" };
  m = t.match(/\bDN\s?(\d{1,4})\b/i);
  if (m) return { valoare: nr(m[1]!), tip: "DN" };
  const c = String(dn ?? "").trim().toLowerCase();
  m = c.match(/^(\d{1,4}(?:[.,]\d+)?)\s*mm$/);
  if (m) return { valoare: nr(m[1]!), tip: "exterior" };
  m = c.match(/^(\d{1,4})(?:\s*x\s*\d+)?$/);
  if (m) return { valoare: nr(m[1]!), tip: "DN" };
  return null;
}

/** Celulele randului pe coloane, cu imbinarile desfacute (valoarea in prima coloana). */
function peColoane(r: RandBrut): (string | number | null)[] {
  const out: (string | number | null)[] = [];
  for (const c of r.celule) { out.push(c.v); for (let i = 1; i < c.span; i++) out.push(null); }
  return out;
}

const ETICHETE: Record<"descriere" | "dn" | "cantitate" | "um", RegExp> = {
  descriere: /^(description|descriere|denumire|item)/,
  dn: /^(dn|diametru|nominal)/,
  cantitate: /^(qty|quantity|cantitate|cant\.?|menge)/,
  um: /^(unit|um|u\.m\.?|unitate|einheit)$/,
};

/** Antetul listei de tevi: are descriere, DN, cantitate si UM. Cautat in primele 30 de randuri. */
function coloane(f: FoaieBruta): { rand: number; col: Record<keyof typeof ETICHETE, number> } | null {
  for (const r of f.randuri.slice(0, 30)) {
    const v = peColoane(r).map((x) => normal(String(x ?? "")).replace(/\s+/g, " ").trim());
    const col = {} as Record<keyof typeof ETICHETE, number>;
    for (const k of Object.keys(ETICHETE) as (keyof typeof ETICHETE)[]) {
      const i = v.findIndex((x) => ETICHETE[k].test(x));
      if (i < 0) break;
      col[k] = i;
    }
    if (Object.keys(col).length === 4) return { rand: r.rand, col };
  }
  return null;
}

/** Tevile si piesele de izolat de pe o foaie. Fara antet de lista de tevi, nimic. */
export function tevileFoii(f: FoaieBruta): TeviFoaie {
  const out: TeviFoaie = { foaie: f.nume, tevi: [], ignorate: 0 };
  const a = coloane(f);
  if (!a) return out;
  for (const r of f.randuri) {
    if (r.rand <= a.rand) continue;
    const v = peColoane(r);
    const descriere = String(v[a.col.descriere] ?? "").trim();
    const q = v[a.col.cantitate];
    const cantitate = typeof q === "number" ? q : nr(String(q ?? "").trim());
    if (!descriere || !(cantitate > 0)) continue;
    const element = elementDin(descriere);
    const um = normal(String(v[a.col.um] ?? "")).replace(/[^a-z]/g, "");
    const d = element ? diametruDin(descriere, v[a.col.dn] ?? null) : null;
    // Teava in metri, piesele in bucati; altfel randul nu e ce pare.
    const umBun = element === "ml" ? /^(m|ml|lm)$/.test(um) : /^(pcs|pc|buc|bucati|stk|st)$/.test(um);
    if (!element || !d || !umBun) { out.ignorate++; continue; }
    out.tevi.push({ rand: r.rand, descriere, element, diametru_valoare: d.valoare, diametru_tip: d.tip, cantitate });
  }
  return out;
}

/* ------------------------------------------------------- grosimea, din tabel */

/** ø exterior pe seria de otel, pentru DN (tabelul de conversie al firmei, coloana ISO). */
const OD: Readonly<Record<number, number>> = {
  10: 17.2, 15: 21.3, 20: 26.9, 25: 33.7, 32: 42.4, 40: 48.3, 50: 60.3, 65: 76.1, 80: 88.9, 100: 114.3,
  125: 139.7, 150: 168.3, 200: 219.1, 250: 273, 300: 323.9, 350: 355.6, 400: 406.4, 450: 457.2, 500: 508, 600: 609.6,
};
export const odDin = (t: Pick<TeavaCitita, "diametru_valoare" | "diametru_tip">): number =>
  t.diametru_tip === "DN" ? OD[t.diametru_valoare] ?? t.diametru_valoare : t.diametru_valoare;

/** Un tabel de grosimi: pe fiecare rand, ø exterior maxim al tevii → grosimea, mm. */
export type TabelGrosimi = readonly (readonly [number, number])[];

/**
 * DIN 4140:2003-05, tabelul D.2 (izolatie la cald, clasa C), din specificatia
 * CET: pe coloane temperaturile 50 … 600 °C. „next largest value for
 * temperature”: o temperatura intre coloane ia coloana de deasupra.
 */
export const DIN4140_D2_TEMPERATURI = [50, 100, 150, 200, 250, 300, 350, 400, 450, 500, 550, 600] as const;
const DIN4140_D2: readonly (readonly [number, readonly number[]])[] = [
  [26.9, [30, 40, 50, 60, 60, 70, 80, 80, 90, 90, 100, 110]],
  [33.7, [40, 50, 60, 70, 70, 80, 90, 90, 100, 110, 110, 120]],
  [48.3, [40, 60, 70, 80, 90, 100, 110, 110, 120, 130, 140, 140]],
  [60.3, [50, 70, 80, 90, 100, 110, 120, 130, 130, 140, 150, 160]],
  [88.9, [60, 80, 100, 110, 120, 130, 140, 150, 160, 170, 180, 190]],
  [114.3, [70, 90, 110, 120, 130, 150, 160, 170, 180, 190, 200, 210]],
  [139.7, [70, 100, 120, 130, 150, 160, 170, 180, 200, 210, 220, 230]],
  [168.3, [80, 110, 130, 140, 160, 170, 190, 200, 210, 220, 240, 250]],
  [219.1, [90, 120, 140, 160, 180, 190, 210, 220, 230, 250, 260, 280]],
  [273, [90, 130, 150, 170, 190, 210, 220, 240, 250, 270, 290, 300]],
  [323.9, [100, 140, 160, 180, 200, 220, 240, 260, 270, 290, 310, 320]],
  [355.6, [100, 140, 170, 190, 210, 230, 250, 260, 280, 300, 320, 330]],
  [406.4, [110, 150, 180, 200, 220, 240, 260, 280, 300, 310, 330, 350]],
  [508, [110, 160, 190, 210, 240, 260, 280, 300, 320, 340, 360, 380]],
  [609.6, [120, 170, 200, 230, 250, 280, 300, 320, 340, 360, 380, 400]],
  [711.2, [130, 180, 210, 240, 270, 290, 310, 340, 360, 380, 400, 430]],
  [812.8, [130, 180, 220, 250, 280, 300, 330, 350, 380, 400, 420, 450]],
  [914.4, [140, 190, 230, 260, 290, 320, 340, 370, 390, 410, 440, 460]],
  [1016, [140, 200, 240, 270, 300, 330, 350, 380, 400, 430, 450, 480]],
  [1219.2, [150, 210, 250, 290, 320, 350, 380, 400, 430, 460, 480, 510]],
];

/** Coloana din D.2 pentru o temperatura de lucru. */
export function tabelDin4140Cald(temperatura: number): TabelGrosimi {
  const i = DIN4140_D2_TEMPERATURI.findIndex((t) => t >= temperatura);
  const col = i < 0 ? DIN4140_D2_TEMPERATURI.length - 1 : i;
  return DIN4140_D2.map(([od, g]) => [od, g[col]!] as const);
}

export const TABELE: Readonly<Record<"atingere" | "rece", { nume: string; sursa: string; tabel: TabelGrosimi }>> = {
  /** Specificatia CET, capitolul 6: 100 °C in teava, 50 °C la suprafata izolatiei. */
  atingere: {
    nume: "Protecție la atingere (100 °C în țeavă, 50 °C la suprafață)",
    sursa: "specificația CET Constanța, cap. 6",
    tabel: [[63, 40], [168.3, 50], [457.2, 60], [609.6, 70], [914.4, 80]],
  },
  /** DIN 4140 tabelul D.4, coloana 5 °C: izolatia la rece cu elastomer (specificatia CET, cap. 3). */
  rece: {
    nume: "Izolație la rece, elastomer (DIN 4140 D.4, 5 °C)",
    sursa: "DIN 4140:2003-05, tabelul D.4",
    tabel: [[26.9, 14], [33.7, 16], [48.3, 20], [60.3, 22], [88.9, 26], [114.3, 29], [139.7, 31], [168.3, 33],
      [219.1, 36], [273, 39], [323.9, 41], [355.6, 42], [406.4, 43], [508, 46], [609.6, 47]],
  },
};

/** Grosimea din tabel pentru o teava: randul cu ø exterior egal sau imediat mai mare. */
export function grosimeDinTabel(od: number, tabel: TabelGrosimi): number {
  // Toleranta de rotunjire: tabelul CET scrie ø21 pentru 21,3 si ø168 pentru 168,3.
  const r = tabel.find(([max]) => od <= max + 0.5);
  return (r ?? tabel[tabel.length - 1]!)[1];
}

/** Grosimile din listele firmei: specificatia cere un minim, deci se urca la urmatoarea. */
export const GROSIMI_LISTA: Readonly<Record<"vata_minerala" | "elastomer", readonly number[]>> = {
  vata_minerala: [20, 30, 40, 50, 60, 80, 100],
  elastomer: [9, 13, 19, 25, 32],
};

/**
 * Grosimea ceruta, urcata la urmatoarea din lista (14 → 19 la elastomer).
 * Peste ultima ramane cum e: importul ia cea mai groasa si marcheaza pozitia
 * „De verificat” (`grosime_peste_lista`), fiindca acolo trebuie doua straturi
 * sau alt material, iar asta decide omul.
 */
export function grosimeInLista(ceruta: number, sistem: keyof typeof GROSIMI_LISTA): number {
  return GROSIMI_LISTA[sistem].find((g) => g >= ceruta) ?? ceruta;
}

/* --------------------------------------------------- alegerea, pe foaie */

export interface IzolatieAleasa {
  izolatie: "vata_minerala" | "elastomer";
  /** O grosime pe toata foaia, sau un tabel dupa diametru. */
  grosime: { fixa: number } | { tabel: TabelGrosimi };
  jacheta: "aluminiu" | "inox" | null;
  /** Coturi, teuri si reductii. */
  piese: boolean;
  /** Robineti si flanse, ca casete. */
  armaturi: boolean;
}

/**
 * Coturile, teurile si reductiile fara protectie, pe banda pe care lista n-are
 * coeficient de forma (18–60 la vata si la elastomer, `cot_teu_reductie: null`):
 * nu se tarifeaza separat, intra in pretul pe metru. Aceeasi regula ca stratul
 * fara coeficient de sub tabla, confirmata de firma pe 11 septembrie 2026
 * (`pricing.md`, regula 4): stratul contribuie cu geometria, nu cu pretul.
 */
export function piesaInclusaInMetri(x: Pick<TeavaCitita, "element" | "diametru_valoare" | "diametru_tip">, a: Pick<IzolatieAleasa, "izolatie" | "jacheta">): boolean {
  if (a.jacheta || (x.element !== "cot" && x.element !== "teu" && x.element !== "reductie")) return false;
  const od = odDin(x);
  const randuri = diametreDin(lista(a.izolatie));
  // Randul listei pe care cade teava (seria rotunjita: 21,3 → 22, 60,3 → 60).
  const rand = randuri.find((r) => r >= od - 0.8) ?? randuri[randuri.length - 1]!;
  return multiplicatorOptional(a.izolatie, rand, x.element) === null;
}

export interface FoaieIzolata {
  randuri: RandSantier[];
  /** Piese fara pret separat (`piesaInclusaInMetri`), ca omul sa stie unde au plecat. */
  incluse: number;
}

/**
 * Randurile de izolatie ale unei foi, ca randurile din carnet: acelasi drum spre
 * import (`spreCerere` → `registruCerere`). Zona e numele foii (sistemul).
 * Acelasi diametru, element si grosime de pe randuri diferite se aduna.
 */
export function randuriIzolate(t: TeviFoaie, a: IzolatieAleasa): FoaieIzolata {
  const acc = new Map<string, RandSantier>();
  let incluse = 0;
  for (const x of t.tevi) {
    if ((x.element === "cot" || x.element === "teu" || x.element === "reductie") && !a.piese) continue;
    if ((x.element === "robinet" || x.element === "flansa") && !a.armaturi) continue;
    if (piesaInclusaInMetri(x, a)) { incluse += x.cantitate; continue; }
    const ceruta = "fixa" in a.grosime ? a.grosime.fixa : grosimeDinTabel(odDin(x), a.grosime.tabel);
    const grosime = grosimeInLista(ceruta, a.izolatie);
    const cheie = [x.element, x.diametru_tip, x.diametru_valoare, grosime].join("|");
    const r = acc.get(cheie) ?? {
      id: `${t.foaie}|${cheie}`, zona: t.foaie, diametru_valoare: x.diametru_valoare, diametru_tip: x.diametru_tip,
      izolatie: a.izolatie, grosime_mm: grosime, jacheta: a.jacheta, element: x.element, pret_dublu: false,
      cantitate: 0, termeni: [], nesigur: false,
    };
    r.cantitate = Math.round((r.cantitate + x.cantitate) * 1000) / 1000;
    r.termeni.push({ text: `r${x.rand}: ${x.descriere}`, cantitate: x.cantitate, multiplicator: 1, nesigur: false });
    acc.set(cheie, r);
  }
  return { randuri: [...acc.values()], incluse };
}
