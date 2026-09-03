/**
 * Formatul golden files si citirea lor. Fara efecte la import.
 *
 * Sta separat de `golden.ts` fiindca acela e un CLI: are cod la nivel de modul
 * care citeste argv si porneste inregistrarea. Testul care rejoaca fisierele
 * importa DOAR de aici, altfel simplul import ar declansa scriptul.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { LinieExtrasa } from "../src/import/schema.js";

export const DIR_GOLDEN = new URL("../tests/golden/", import.meta.url).pathname;

export interface LinieGolden {
  index: number;
  text: string;
  um?: string;
  sectiune?: string;
  cantitate?: number;
  /** Ce a raspuns modelul, dupa validarea de plauzibilitate. */
  extras: LinieExtrasa;
  /** Codurile avertismentelor, recalculate offline de test. */
  avertismente: string[];
  /** Rezultatul tarifarii deterministe peste `extras`. */
  pret_unitar: number | null;
  total: number | null;
  eroare: string | null;
}

export interface Golden {
  fisier: string;
  model: string;
  generat: string;
  linii: LinieGolden[];
}

const CAMPURI = [
  "sistem", "diametru_valoare", "diametru_tip",
  "grosime_mm", "forma", "gol_latime_mm", "gol_inaltime_mm",
] as const;

/** Doar campurile care intra in tarifare. `incredere` si `motiv` sunt pentru om. */
export const amprenta = (l: LinieExtrasa): string =>
  CAMPURI.map((c) => `${c}=${l[c] ?? "-"}`).join(" ");

export const goldenuri = (): string[] =>
  existsSync(DIR_GOLDEN) ? readdirSync(DIR_GOLDEN).filter((f) => f.endsWith(".json")).sort() : [];

export const citesteGolden = (nume: string): Golden =>
  JSON.parse(readFileSync(join(DIR_GOLDEN, nume), "utf8")) as Golden;
