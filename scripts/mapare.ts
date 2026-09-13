#!/usr/bin/env tsx
/**
 * L1: inregistreaza maparea de coloane a fiecarei foi dintr-un fisier.
 *
 *   npm run mapare -- ../attachments/clienti/cerere-de-oferta-spital.xlsx
 *   npm run mapare -- --lista
 *   npm run mapare -- --reindex
 *
 * Un apel la model per LAYOUT, nu per foaie: amprenta e antetul normalizat plus
 * latimea, deci cele sapte foi ale lui `cerere-de-oferta-spital.xlsx` costa un singur apel, iar
 * al doilea fisier cu acelasi antet costa zero.
 *
 * O mapare care nu trece de `valideazaMapare` NU se salveaza. Mai bine ramane
 * euristica de azi — pe care o stim si o masuram — decat o mapare gresita care
 * muta cantitatile pe alta coloana fara ca cineva sa observe.
 *
 * `--reindex` regenereaza `data/mapari/index.json` din directorul curent, fara
 * niciun apel la model. `scrieMapare()` il regenereaza deja la fiecare mapare
 * noua; flagul e pentru dupa o stergere sau editare manuala a unui fisier de
 * mapare, care nu trece prin `scrieMapare()`.
 */
import { existsSync } from "node:fs";
import { basename } from "node:path";
import { parseFoi } from "../src/import/parse-workbook.js";
import { amprentaFoaie, indexAntetFizic } from "../src/import/mapare.js";
import { mapeazaFoaie } from "../src/import/mapare-llm.js";
import { citesteMapari, scrieMapare, scrieIndex } from "../src/import/cache-mapari.js";
import { MODEL_IMPLICIT } from "../src/import/extract-llm.js";

if (existsSync(".env")) process.loadEnvFile(".env");

const args = process.argv.slice(2);

if (args.includes("--reindex")) {
  // Util dupa ce se sterge sau se editeaza manual o mapare pe disc: indexul se
  // regenereaza automat la `scrieMapare`, dar o stergere manuala nu trece pe
  // acolo, deci ramane in urma pana la un `--reindex` explicit.
  const cale = scrieIndex();
  console.log(`\n  ${cale}\n  ${citesteMapari().size} mapari\n`);
  process.exit(0);
}

if (args.includes("--lista")) {
  const mapari = citesteMapari();
  console.log(`\n  ${mapari.size} mapari in cache\n`);
  for (const m of mapari.values()) {
    const roluri = m.mapare.roluri.join(", ");
    console.log(`  ${m.fisier} / ${m.foaie}`);
    console.log(`    antet=${m.mapare.rand_antet ?? "lipsa"} start=${m.mapare.rand_start}  ${roluri}`);
  }
  console.log();
  process.exit(0);
}

const cale = args.find((a) => !a.startsWith("--"));
if (!cale) {
  console.error("folosire: npm run mapare -- <fisier.xlsx>   |   npm run mapare -- --lista");
  process.exit(1);
}

const model = process.env["OPENAI_MODEL"] ?? MODEL_IMPLICIT;
const foi = await parseFoi(cale);
const cache = citesteMapari();
console.log(`\n${cale}\n  ${foi.length} foi, model ${model}\n`);

for (const foaie of foi) {
  const amprenta = amprentaFoaie(foaie);
  if (cache.has(amprenta)) {
    console.log(`  "${foaie.nume}"  deja in cache (acelasi layout ca ${cache.get(amprenta)!.foaie})`);
    continue;
  }

  const { mapare, avertismente } = await mapeazaFoaie(foaie, { model });
  const fizic = indexAntetFizic(foaie);
  console.log(`  "${foaie.nume}"  antet=${mapare.rand_antet ?? "lipsa"} (fizic: ${fizic ?? "lipsa"}) start=${mapare.rand_start}`);
  console.log(`     ${mapare.roluri.join(", ")}`);
  console.log(`     ${mapare.motiv}`);

  if (avertismente.length > 0) {
    console.log(`     RESPINSA — ${avertismente.length} probleme:`);
    for (const a of avertismente) console.log(`       ! ${a.mesaj}`);
    continue;
  }

  const salvata = {
    amprenta, fisier: basename(cale), foaie: foaie.nume, model,
    generat: new Date().toISOString(), mapare,
  };
  cache.set(amprenta, salvata);
  console.log(`     -> ${scrieMapare(salvata)}`);
}
console.log();
