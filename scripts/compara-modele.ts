import { existsSync } from "node:fs";
import { parseWorkbook } from "../src/import/parse-workbook.js";
import { adaugaSectiuni } from "../src/import/sectiuni.js";
import { extrageDeterminist } from "../src/import/extract-regex.js";
import { extrageCuModel } from "../src/import/extract-llm.js";
import type { LinieExtrasa } from "../src/import/schema.js";

/**
 * Compara doua modele pe ACELEASI linii reziduale.
 *
 *   npm run compara -- <fisier.xlsx> gpt-4o gpt-4.1-mini
 *
 * De ce exista: schimbarea modelului nu e o preferinta, e o decizie care
 * afecteaza fiecare oferta. Singurul mod onest de a o lua e sa masori pe
 * fisierele reale ale firmei, nu sa te iei dupa plafoanele din pagina de
 * limite.
 *
 * Ce compara: campurile care intra efectiv in tarifare — sistem, diametru,
 * grosime, forma, dimensiunile golului. `incredere` si `motiv` sunt ignorate:
 * sunt pentru omul care valideaza, nu pentru pret.
 *
 * Ce NU poate spune: care model are DREPTATE. Doar unde difera. Acolo unde
 * difera, se uita un om — de-asta se tipareste linia sursa.
 */

// Cheia sta in .env, gitignorat. Node 21+ il incarca nativ.
if (existsSync(".env")) process.loadEnvFile(".env");

const CAMPURI = [
  "sistem", "diametru_valoare", "diametru_tip",
  "grosime_mm", "forma", "gol_latime_mm", "gol_inaltime_mm",
] as const;

const amprenta = (l: LinieExtrasa): string =>
  CAMPURI.map((c) => `${c}=${l[c] ?? "-"}`).join(" ");

async function main(): Promise<void> {
  const [cale, ...modele] = process.argv.slice(2);
  if (!cale || modele.length < 2) {
    console.error("Utilizare: npm run compara -- <fisier.xlsx> <model-a> <model-b> [...]");
    process.exit(1);
  }

  const brute = adaugaSectiuni(await parseWorkbook(cale));
  const reziduale: { index: number; text: string; um?: string }[] = [];
  for (const b of brute) {
    const r = extrageDeterminist(b.index, b.text, b.um, b.sectiune);
    if (!r.complet) reziduale.push({ index: b.index, text: b.text, ...(b.um ? { um: b.um } : {}) });
  }

  console.log(`\n${cale}`);
  console.log(`  randuri            ${brute.length}`);
  console.log(`  reziduale          ${reziduale.length}  (astea pleaca la model)\n`);

  const rezultate = new Map<string, Map<number, LinieExtrasa>>();
  for (const model of modele) {
    const t0 = Date.now();
    try {
      const linii = await extrageCuModel(reziduale, { model });
      rezultate.set(model, new Map(linii.map((l) => [l.index, l])));
      const cuSistem = linii.filter((l) => l.sistem !== null).length;
      console.log(`  ${model.padEnd(16)} ${((Date.now() - t0) / 1000).toFixed(1).padStart(6)}s  ${String(cuSistem).padStart(4)} linii cu sistem`);
    } catch (e) {
      console.log(`  ${model.padEnd(16)} EROARE: ${e instanceof Error ? e.message.slice(0, 90) : String(e)}`);
    }
  }

  const [a, b] = modele as [string, string];
  const ra = rezultate.get(a);
  const rb = rezultate.get(b);
  if (!ra || !rb) return;

  const textul = new Map(brute.map((x) => [x.index, x.text]));
  let identice = 0;
  const diferente: string[] = [];

  for (const { index } of reziduale) {
    const la = ra.get(index);
    const lb = rb.get(index);
    if (!la || !lb) continue;
    if (amprenta(la) === amprenta(lb)) { identice++; continue; }
    diferente.push(
      `  [${index}] ${(textul.get(index) ?? "").replace(/\s+/g, " ").slice(0, 74)}\n` +
      `      ${a.padEnd(14)} ${amprenta(la)}\n` +
      `      ${b.padEnd(14)} ${amprenta(lb)}`,
    );
  }

  const total = identice + diferente.length;
  const proc = total ? ((identice / total) * 100).toFixed(1) : "-";
  console.log(`\n  acord pe campurile care conteaza: ${identice}/${total}  (${proc}%)`);
  if (diferente.length) {
    console.log(`\n  --- ${diferente.length} diferente, de citit de om ---`);
    for (const d of diferente.slice(0, 20)) console.log(d);
    if (diferente.length > 20) console.log(`  … si inca ${diferente.length - 20}.`);
  }
  console.log();
}

await main();
