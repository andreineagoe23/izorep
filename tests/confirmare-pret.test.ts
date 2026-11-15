/**
 * Bugul „g48 → Confirmă → Fără preț” (14 noiembrie 2026): pe TRANSAVIA, o
 * descriere schimbată cu „g48” se recitea cu grosimea cea mai apropiată din
 * listă (50 mm), cu preț; după „Confirmă”, poziția trecea pe „Fără preț”.
 * Cauza: confirmarea punea `sursa: "om"` pe extragerea brută, fără grosime
 * (48 nu e în listă), iar completările pe care le vedea omul (grosimea scrisă,
 * a conductei, cea uzuală) nu se fac pe linia omului. Regula firmei: la import
 * nicio poziție nu rămâne fără preț. Poziția confirmată păstrează prețul pe
 * care îl vedea omul.
 */
import { describe, expect } from "vitest";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { CLIENTI, cuClienti } from "./conditii.js";
import { parseFoi } from "../src/import/parse-workbook.js";
import { proceseazaRegistru, reevalueaza, type OptiuniNucleu, type Rezultat } from "../src/import/nucleu.js";
import { reconstruieste, scrieCelula } from "../src/import/editare.js";
import { mapariStatice } from "../src/import/mapari-statice.js";
import { stocInMemorie } from "../src/import/memorie.js";
import { confirma, vazute } from "../web/validare.js";

describe("poziția confirmată păstrează prețul pe care îl vedea omul", () => {
  cuClienti("TRANSAVIA, caseta DN100 cu „g48” scris în descriere", async () => {
    const o: OptiuniNucleu = { stoc: stocInMemorie(), mapari: mapariStatice(), descrieriSchimbate: new Set() };
    const rez = await proceseazaRegistru(await parseFoi(join(CLIENTI, "cerere-de-oferta-transavia-abur.xlsx")), o);
    const l = rez.linii[0]!;
    const rand = rez.foi.find((f) => f.nume === l.bruta.foaie)!.randuri.find((r) => r.rand === l.bruta.rand)!;
    scrieCelula(rand, 1, `${String(rand.celule[1]!.v)} g48`);
    reconstruieste(rand);
    reevalueaza(rez, o);
    const inainte = rez.linii.find((x) => x.extras.index === l.extras.index)!;
    expect(inainte.extras.grosime_mm).toBe(48);
    expect(inainte.pret).toBeDefined();
    confirma([l.extras.index], rez.rezolvate, vazute(rez));
    reevalueaza(rez, o);
    const dupa = rez.linii.find((x) => x.extras.index === l.extras.index)!;
    expect(dupa.sursa).toBe("om");
    expect(dupa.eroare).toBeUndefined();
    expect(dupa.pret?.pret_unitar).toBe(inainte.pret!.pret_unitar);
    expect(dupa.necesitaValidare).toBe(false);
  });

  for (const destinatie of ["rezidential", "industrial"] as const) {
    cuClienti(`pe ${destinatie}: toate pozițiile cu preț, confirmate, au același preț, în fiecare fișier`, async () => {
      const diferite: string[] = [];
      for (const f of readdirSync(CLIENTI).filter((x) => x.endsWith(".xlsx") && !x.startsWith("~$"))) {
        const o: OptiuniNucleu = { stoc: stocInMemorie(), mapari: mapariStatice(), destinatie };
        const rez: Rezultat = await proceseazaRegistru(await parseFoi(join(CLIENTI, f)), o);
        const inainte = new Map(rez.linii.filter((l) => l.pret).map((l) => [l.extras.index, l.pret!.pret_unitar]));
        confirma([...inainte.keys()], rez.rezolvate, vazute(rez));
        reevalueaza(rez, o);
        for (const l of rez.linii) {
          const p = inainte.get(l.extras.index);
          if (p !== undefined && l.pret?.pret_unitar !== p) {
            diferite.push(`${f} r${l.bruta.rand}: ${p} → ${l.pret?.pret_unitar ?? l.codEroare}`);
          }
        }
      }
      expect(diferite).toEqual([]);
    });
  }
});
