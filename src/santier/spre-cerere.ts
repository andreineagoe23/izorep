import type { CampuriRand, RandSantier } from "./agrega.js";

/**
 * Randurile confirmate, scrise ca liniile unei cereri de oferta.
 *
 * Nu construim o a doua cale de tarifare: textul de aici e scris in forma pe
 * care stratul determinist al importului o citeste complet, deci pozitiile
 * trec prin acelasi motor, aceeasi verificare si aceeasi oferta ca un Excel de
 * la client. `tests/santier.test.ts` tine asta adevarat pentru fiecare
 * combinatie de element si straturi.
 */
export interface LinieCerere {
  zona: string;
  text: string;
  um: "ml" | "buc";
  cantitate: number;
}

/** Semnul dupa care importul recunoaste pozitiile cu pret dublu. */
export const MARCA_PRET_DUBLU = "(pret dublu)";

const IZOLATIE: Record<NonNullable<CampuriRand["izolatie"]>, string> = {
  vata_minerala: "vata minerala",
  elastomer: "elastomer",
};

const JACHETA: Record<NonNullable<CampuriRand["jacheta"]>, string> = {
  aluminiu: "tabla de aluminiu",
  inox: "tabla inox",
  pvc: "manta PVC",
};

function straturi(r: CampuriRand): string {
  const iz = r.izolatie ? `${IZOLATIE[r.izolatie]}${r.grosime_mm !== null ? ` ${r.grosime_mm} mm` : ""}` : "";
  const ja = r.jacheta ? JACHETA[r.jacheta] : "";
  if (iz && ja) return `cu ${iz} si protectie cu ${ja}`;
  return `cu ${iz || ja}`;
}

function diametru(r: CampuriRand): string {
  if (r.diametru_valoare === null) return "";
  return r.diametru_tip === "DN" ? `DN${r.diametru_valoare}` : `ø${r.diametru_valoare}`;
}

/**
 * Coturile si teurile se scriu ca in Oferta 284, „… - COT": forma dupa liniuta
 * e cea pe care importul o ia inaintea UM-ului (`formaExplicitaDinText`).
 */
export function textRand(r: CampuriRand): string {
  const d = diametru(r);
  const s = straturi(r);
  const conducta = r.izolatie ? "Izolatie conducta" : "Protectie conducta";
  const cap = {
    ml: conducta,
    cot: conducta,
    teu: conducta,
    robinet: "Caseta izolatie robinet",
    flansa: "Caseta izolatie flansa",
    reductie: "Reductie",
    alt: "Element",
  }[r.element];
  const coada = r.element === "cot" ? " - COT" : r.element === "teu" ? " - TEU" : "";
  const text = [cap, d, s].filter(Boolean).join(" ") + coada;
  return r.pret_dublu ? `${text} ${MARCA_PRET_DUBLU}` : text;
}

export function spreCerere(randuri: readonly RandSantier[]): LinieCerere[] {
  return randuri
    .filter((r) => r.cantitate > 0)
    .map((r) => ({ zona: r.zona, text: textRand(r), um: r.element === "ml" ? "ml" : "buc", cantitate: r.cantitate }));
}
