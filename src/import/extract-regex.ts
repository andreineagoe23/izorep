import type { LinieExtrasa } from "./schema.js";

/**
 * Stratul determinist de extragere. Prinde ~55% din liniile reale masurate pe
 * cele 7 fisiere de client din attachments/.
 *
 * Nu exista din motive de cost — la ~350 de linii pe proiect si 20 de proiecte
 * pe luna, trecerea tuturor liniilor prin model ar costa cativa euro. Exista
 * pentru ca ce se poate rezolva determinist trebuie sa aiba teste care pica
 * atunci cand cineva strica regula.
 */
const SISTEM: [LinieExtrasa["sistem"], RegExp][] = [
  ["elastomer", /elastomer|armaflex|cauciuc\s+sinte|a?uciuc\s+sinte|k[aä]lteiso|k-?flex|kaiflex|kautschuk/i],
  ["vata_minerala", /vat[aă]\s+mineral|mineralwolle|rockwool|isolshell|fiberglass|saltele\s+de\s+vat/i],
  ["pvc", /\bpvc\b/i],
  // Cere notiunea de GOL sau de TRECERE prin perete, nu doar mentiunea focului.
  // "Protectie la foc EI 60 pentru tubulaturile din tabla zincata" din
  // Radoia.xlsx e protectia tubulaturii, alta lucrare, si nu are lista de
  // preturi. Cu "rezistent la foc" sau "EI 60" ca semnal, 28 de randuri de
  // acolo intrau ca inchideri de gol, iar dimensiunea tubulaturii
  // rectangulare ("1000/500") era citita drept dimensiune de gol.
  // "Teceri" nu e greseala mea: asa scrie antetul din oferta 118.1.
  ["goluri_foc", /inchideri?\s+goluri|goluri\s+la\s+foc|\b(?:t|tr)eceri\s+prin\s+pereti|\bwrap\b|promastop/i],
];

/** Alte meserii din caietul de sarcini: se resping explicit, nu se ghicesc. */
const ALTE_MESERII =
  /gril[aă]|difuzor|clapet[aă]|demont|dismant|relocare|relocation|ventilator|cazan|boiler|chiller|\bAHU\b|centrala de tratare|vas de expansiune|grundu|priming|swirl|anemostat|plenum|recuperator/i;

const RE_DN = /\b(?:DN|Dn|dn)\s*\.?\s*(\d{1,3})\b/;
const RE_DI = /\bDi\s*(\d{1,3})\b/;
const RE_OD = /[øØ]\s*(\d{1,3})\b/;
const RE_PLASTIC = /\b(?:PPR|PP|PEHD|PEX)\s*[D]?\s*(\d{1,3})\b/;
const RE_GROSIME = /(?:g\s*[=.]?\s*|gr\.?\s*|S\s*=\s*|grosime[a]?\s+de\s+|[-–]\s*)(\d{1,3})\s*mm/i;
const RE_GROSIME_COMPACT = /\bg\s?(\d{2,3})\b/;
const RE_MM = /(\d{1,3})\s*mm\b/g;
/**
 * Dimensiunea golului la inchiderile goluri la foc: "130/130", "1400/600".
 * Cere minimum doua cifre de fiecare parte, ca sa nu inghita tolii ("1/2").
 */
const RE_GOL = /\b(\d{2,4})\s*\/\s*(\d{2,4})\b/;
const GROSIMI_PLAUZIBILE = new Set([9, 13, 19, 25, 32, 20, 30, 40, 50, 60, 80, 100]);

const FORMA: [LinieExtrasa["forma"], RegExp][] = [
  ["cot", /\bCOT\b|\bcot\b|coturi/], ["teu", /\bTEU\b|\bteu\b/],
  ["manseta", /manset/i], ["reductie", /reductie/i], ["flansa", /flans/i],
  ["contor", /contor/i], ["filtru", /filtru\s*Y|filtru/i], ["pompa", /pomp[aă]/i],
  ["robinet", /robinet|van[aă]/i], ["mp", /\bmp\b|\bm²\b|\bm2\b/i], ["ml", /\bML\b|\bml\b|\bm\b/],
];

export interface RezultatRegex {
  linie: LinieExtrasa;
  /** true daca sistem + diametru + grosime au fost toate determinate. */
  complet: boolean;
}

export function extrageDeterminist(
  index: number, text: string, um?: string, sectiune?: string,
): RezultatRegex {
  const gol: LinieExtrasa = {
    index, sistem: null, diametru_valoare: null, diametru_tip: null,
    grosime_mm: null, forma: null, gol_latime_mm: null, gol_inaltime_mm: null,
    straturi_extra: [], incredere: 0, motiv: "",
  };

  if (ALTE_MESERII.test(text)) {
    return { linie: { ...gol, incredere: 0.95, motiv: "alta meserie, nu se oferteaza" }, complet: true };
  }

  // Sistemul se cauta intai in linie. Daca linia tace, se intreaba sectiunea:
  // "Teava OL/OLZN DN15" nu spune nimic, dar antetul de deasupra —
  // "Treceri prin pereti rezistenti la foc EI30" — spune tot. Sectiunea NU
  // se foloseste la diametru, grosime sau gol: alea trebuie sa fie pe rand,
  // altfel o pozitie ar mosteni valorile alteia.
  const sistem = SISTEM.find(([, re]) => re.test(text))?.[0]
    ?? (sectiune ? SISTEM.find(([, re]) => re.test(sectiune))?.[0] ?? null : null);

  let diametru_valoare: number | null = null;
  let diametru_tip: LinieExtrasa["diametru_tip"] = null;
  let m: RegExpMatchArray | null;
  if ((m = text.match(RE_PLASTIC))) {
    // Plastic: dimensiunea nominala ESTE diametrul exterior.
    diametru_valoare = Number(m[1]); diametru_tip = "exterior";
  } else if ((m = text.match(RE_DN))) {
    diametru_valoare = Number(m[1]); diametru_tip = "DN";
  } else if ((m = text.match(RE_OD))) {
    diametru_valoare = Number(m[1]); diametru_tip = "exterior";
  } else if ((m = text.match(RE_DI))) {
    diametru_valoare = Number(m[1]); diametru_tip = "interior";
  }

  let grosime_mm: number | null = null;
  const g = text.match(RE_GROSIME) ?? text.match(RE_GROSIME_COMPACT);
  if (g && GROSIMI_PLAUZIBILE.has(Number(g[1]))) {
    grosime_mm = Number(g[1]);
  } else {
    const toate = [...text.matchAll(RE_MM)].map((x) => Number(x[1])).filter((n) => GROSIMI_PLAUZIBILE.has(n));
    grosime_mm = toate.at(-1) ?? null;
  }

  const dinUm = um ? FORMA.find(([, re]) => re.test(um))?.[0] : undefined;
  const forma = dinUm ?? FORMA.find(([, re]) => re.test(text))?.[0] ?? null;

  // Dimensiunea golului se citeste DOAR daca linia e deja identificata ca
  // inchidere la foc. "130/130" e un tipar prea comun ca sa fie semnal de
  // sistem in sine — ar prinde fractii, rapoarte si dimensiuni de tubulatura.
  let gol_latime_mm: number | null = null;
  let gol_inaltime_mm: number | null = null;
  if (sistem === "goluri_foc") {
    const d = text.match(RE_GOL);
    if (d) { gol_latime_mm = Number(d[1]); gol_inaltime_mm = Number(d[2]); }
  }

  // Inchiderile la foc se tarifeaza pe SUPRAFATA golului: diametrul si
  // grosimea nu le fac complete, dimensiunile golului da.
  const complet = sistem === "goluri_foc"
    ? gol_latime_mm !== null && gol_inaltime_mm !== null
    : sistem !== null && diametru_valoare !== null && grosime_mm !== null;

  return {
    linie: {
      ...gol, sistem, diametru_valoare, diametru_tip, grosime_mm, forma,
      gol_latime_mm, gol_inaltime_mm,
      incredere: complet ? 0.99 : 0.3,
      motiv: complet ? "extras determinist din text" : "extragere determinista incompleta",
    },
    complet,
  };
}
