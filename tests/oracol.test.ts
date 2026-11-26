/**
 * Oracolul (testul complet, 26 noiembrie 2026): două cereri inventate, cu
 * prețul așteptat calculat de `scripts/oracol/genereaza*.py` DIRECT din
 * listele de prețuri (JSON), cu regulile scrise ale firmei (`pricing.md`,
 * `tevi.md`), fără nimic din motor. Aici motorul trebuie să dea exact
 * aceleași prețuri și stări, pe ambele tipuri de ofertă: dacă pică, ori
 * motorul a schimbat o regulă, ori o listă s-a schimbat (atunci se regenerează
 * cu scriptul și se verifică diferența).
 *
 * Prima cerere: conducte pe DN și pe ø de plastic, piese, m², rectangular în
 * metri, greșeli de scris, cantitate 0, lipsuri de întrebat, goluri la foc. A
 * doua, pe alt format (Cod | Cant. | U.M. | Descriere): Di cu „- COT”, țoli,
 * PVC, două straturi, cupru, inox, cantitatea citită corect.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseFoi } from "../src/import/parse-workbook.js";
import { proceseazaRegistru } from "../src/import/nucleu.js";
import { mapariStatice } from "../src/import/mapari-statice.js";
import { stocInMemorie } from "../src/import/memorie.js";
import { potrivit } from "../web/validare.js";

interface Asteptare { foaie: string; rand: number; seg: "rezidential" | "industrial"; text: string; stare: string; pret: number | null; cantitate?: number }

const D = join(__dirname, "oracol");
const stare = (l: Parameters<typeof potrivit>[0] | undefined): string =>
  !l ? "afara" : potrivit(l, "gata") ? "gata" : potrivit(l, "de_validat") ? "verif" : potrivit(l, "netarifate") ? "fara" : "afara";

describe.each([["cerere-oracol.xlsx", "asteptari.json"], ["cerere-oracol-2.xlsx", "asteptari-2.json"]])("oracolul: %s", (fis, ast) => {
  const asteptari: Asteptare[] = JSON.parse(readFileSync(join(D, ast), "utf8"));
  it.each(["rezidential", "industrial"] as const)("%s: fiecare rând dă prețul și starea calculate independent", async (seg) => {
    const rez = await proceseazaRegistru(await parseFoi(join(D, fis)), { stoc: stocInMemorie(), mapari: mapariStatice(), destinatie: seg });
    const gasit = asteptari.filter((a) => a.seg === seg).map((a) => {
      const l = rez.linii.find((x) => x.bruta.foaie === a.foaie && x.bruta.rand === a.rand);
      return { rand: `${a.foaie} r${a.rand}`, stare: stare(l), pret: a.stare === "fara" ? null : l?.pret?.pret_unitar ?? null,
        ...(a.cantitate !== undefined ? { cantitate: l?.bruta.cantitate } : {}) };
    });
    const asteptat = asteptari.filter((a) => a.seg === seg).map((a) => ({ rand: `${a.foaie} r${a.rand}`, stare: a.stare,
      pret: a.stare === "fara" ? null : a.pret, ...(a.cantitate !== undefined ? { cantitate: a.cantitate } : {}) }));
    expect(gasit).toEqual(asteptat);
  });
});
