import { DN_TO_OD } from "../pricing/dn-table.js";
import { lista } from "../pricing/lists.js";
import type { SistemMatrice } from "../pricing/types.js";
import type { LinieExtrasa } from "./schema.js";

/**
 * Validarea de PLAUZIBILITATE a ce iese din model.
 *
 * Zod verifica FORMA raspunsului: tipuri, enum-uri, campuri obligatorii. Nu
 * verifica SENSUL. `diametru_valoare: 76` trece perfect si cand in linia sursa
 * scria `Di60` — masurat pe `Izolatii Transavia.xlsx` cu gpt-4.1-mini. Un
 * diametru gresit inseamna alt rand in matricea de preturi, deci alt pret, si
 * nu se vede nicaieri: modelul e sigur pe el, incredere 0,95.
 *
 * De-aia stratul asta e determinist si aici, nu in prompt. O regula scrisa in
 * prompt e o rugaminte; una scrisa aici e o verificare cu test.
 *
 * Ce NU face: nu corecteaza si nu ghiceste. Marcheaza linia pentru omul care
 * valideaza si atat. Motorul de preturi ramane singurul care decide preturi.
 */

export type CodAvertisment =
  | "diametru_necitat"
  | "grosime_necitata"
  | "gol_necitat"
  | "dn_necunoscut"
  | "grosime_in_afara_listei"
  | "forma_contrazice_um";

export interface Avertisment {
  cod: CodAvertisment;
  mesaj: string;
}

/**
 * Tolii, din tabelul de conversie primit de la firma (vezi `.claude/tevi.md`).
 *
 * Exista aici ca sa NU dea alarma falsa: linia "Dn 2''" e o citare corecta a
 * lui DN50, chiar daca cifra 50 nu apare nicaieri in text. Fara tabelul asta,
 * fiecare pozitie scrisa in toli ar fi marcata pentru validare degeaba — iar un
 * avertisment care se aprinde mereu nu mai e citit de nimeni.
 */
const TOLI_DN: Readonly<Record<string, number>> = {
  "3/8": 10, "1/2": 15, "3/4": 20, "1": 25, "1 1/4": 32, "1 1/2": 40,
  "2": 50, "2 1/2": 65, "3": 80, "4": 100, "5": 125, "6": 150, "8": 200,
  "10": 250, "12": 300, "14": 350, "16": 400, "18": 450, "20": 500,
  "24": 600, "28": 700, "32": 800, "36": 900, "40": 1000,
};

/** `2 1/2"`, `1 1/4”`, `3/4''`, `2 toli`. Ghilimeaua e obligatorie: fara ea,
 *  "1/2" din "130/130" ar deveni DN15. */
const RE_TOLI = /(\d+\s+\d\/\d|\d\/\d|\d+)\s*(?:"|”|“|''|′′|″|\btoli\b)/gi;

/** Toate numerele care apar literal in text, cu virgula normalizata la punct. */
function numereDinText(text: string): Set<number> {
  const out = new Set<number>();
  for (const m of text.matchAll(/\d+(?:[.,]\d+)?/g)) {
    out.add(Number(m[0]!.replace(",", ".")));
  }
  return out;
}

/** DN-urile deductibile corect din text fara ca cifra lor sa apara: toli si ISO. */
function dnImplicite(text: string, numere: Set<number>): Set<number> {
  const out = new Set<number>();
  for (const m of text.matchAll(RE_TOLI)) {
    const dn = TOLI_DN[m[1]!.replace(/\s+/g, " ").trim()];
    if (dn !== undefined) out.add(dn);
  }
  // "ø88,9" e DN80 scris ca diametru exterior: conversia e corecta, nu inventata.
  for (const [dn, od] of Object.entries(DN_TO_OD)) {
    if (numere.has(od)) out.add(Number(dn));
  }
  return out;
}

/**
 * Un numar e CITAT daca apare in textul sursa, direct sau printr-o conversie
 * legitima (toli -> DN, DN <-> diametru exterior din tabelul ISO).
 *
 * Regula vine din promptul propriu al stratului cu model — "nu inventa valori,
 * daca un camp nu apare in text pune null". Aici se verifica daca a respectat-o.
 */
function citat(valoare: number, numere: Set<number>, dnImplicit: Set<number>): boolean {
  if (numere.has(valoare)) return true;
  if (dnImplicit.has(valoare)) return true;
  const od = DN_TO_OD[valoare];
  return od !== undefined && numere.has(od);
}

/** Ce forme sunt compatibile cu unitatea de masura de pe rand. */
const FORME_ELEMENT = new Set<LinieExtrasa["forma"]>([
  "manseta", "cot", "teu", "reductie", "robinet", "vana", "flansa", "contor",
  "compensator", "pompa", "filtru", "distribuitor", "schimbator",
]);

function umContrazice(um: string, forma: NonNullable<LinieExtrasa["forma"]>): boolean {
  const u = um.trim().toLowerCase();
  if (/^(buc\.?|pcs|stk)$/.test(u)) return forma === "ml" || forma === "mp";
  if (/^(ml|m|lm)$/.test(u)) return forma === "mp" || FORME_ELEMENT.has(forma);
  if (/^(mp|m2|m²)$/.test(u)) return forma === "ml" || FORME_ELEMENT.has(forma);
  return false;
}

const MATRICE = new Set<string>(["elastomer", "vata_minerala", "tabla", "pvc"]);

/**
 * Verifica o linie extrasa fata de textul din care a fost extrasa.
 *
 * Lista goala inseamna "nimic suspect", nu "corect": validatorul prinde
 * inventarea si imposibilul, nu confuzia intre doua valori care apar amandoua
 * in text. Aia ramane treaba omului de la validare.
 */
export function valideazaExtragere(
  l: LinieExtrasa,
  sursa: { text: string; um?: string },
): Avertisment[] {
  const av: Avertisment[] = [];
  const numere = numereDinText(sursa.text);
  const dnImplicit = dnImplicite(sursa.text, numere);

  if (l.diametru_valoare !== null && !citat(l.diametru_valoare, numere, dnImplicit)) {
    av.push({
      cod: "diametru_necitat",
      mesaj: `diametrul ${l.diametru_valoare} nu apare in textul sursa`,
    });
  }

  if (l.diametru_tip === "DN" && l.diametru_valoare !== null
      && DN_TO_OD[l.diametru_valoare] === undefined) {
    av.push({
      cod: "dn_necunoscut",
      mesaj: `DN${l.diametru_valoare} nu exista in tabelul de conversie`,
    });
  }

  const grosimi: (number | null)[] = [l.grosime_mm, ...l.straturi_extra.map((s) => s.grosime_mm)];
  for (const g of grosimi) {
    if (g !== null && !numere.has(g)) {
      av.push({ cod: "grosime_necitata", mesaj: `grosimea ${g} mm nu apare in textul sursa` });
    }
  }

  // Grosimea trebuie sa existe in lista sistemului ei, nu in a altuia: 40 mm e
  // valid la vata minerala si imposibil la elastomer.
  const straturi: { sistem: LinieExtrasa["sistem"]; grosime_mm: number | null }[] = [
    { sistem: l.sistem, grosime_mm: l.grosime_mm },
    ...l.straturi_extra,
  ];
  for (const s of straturi) {
    if (s.sistem === null || !MATRICE.has(s.sistem) || s.grosime_mm === null) continue;
    const disponibile = lista(s.sistem as SistemMatrice).grosimi_mm;
    if (disponibile.length > 0 && !disponibile.includes(s.grosime_mm)) {
      av.push({
        cod: "grosime_in_afara_listei",
        mesaj: `${s.sistem} nu se oferteaza in grosimea ${s.grosime_mm} mm (lista: ${disponibile.join(", ")})`,
      });
    }
  }

  if (l.sistem === "goluri_foc") {
    for (const [nume, v] of [["latimea", l.gol_latime_mm], ["inaltimea", l.gol_inaltime_mm]] as const) {
      if (v !== null && !numere.has(v)) {
        av.push({ cod: "gol_necitat", mesaj: `${nume} golului (${v}) nu apare in textul sursa` });
      }
    }
  }

  if (sursa.um && l.forma && umContrazice(sursa.um, l.forma)) {
    av.push({
      cod: "forma_contrazice_um",
      mesaj: `forma "${l.forma}" contrazice unitatea de masura "${sursa.um}"`,
    });
  }

  return av;
}

/**
 * Aplica validarea si coboara increderea la 0 pe liniile suspecte.
 *
 * Increderea vine de la model si nu e o masura de adevar — pe `Di60` citit ca
 * 76 raportase 0,95. Un avertisment de aici o anuleaza, deci linia trece
 * obligatoriu pe la om, oricat de sigur ar fi fost modelul. Pretul nu se
 * sterge: omul vede si propunerea, si motivul pentru care nu e de incredere.
 */
export function aplicaValidarea(
  linii: LinieExtrasa[],
  surse: Map<number, { text: string; um?: string }>,
): LinieExtrasa[] {
  return linii.map((l) => {
    const sursa = surse.get(l.index);
    if (!sursa) return l;
    const av = valideazaExtragere(l, sursa);
    if (av.length === 0) return l;
    return {
      ...l,
      incredere: 0,
      motiv: `${l.motiv} | NEVERIFICAT: ${av.map((a) => a.mesaj).join("; ")}`,
    };
  });
}
