#!/usr/bin/env tsx
/**
 * Golden files: iesirea modelului pe fisierele reale, inghetata in repo.
 *
 *   npm run golden -- ../attachments/Izolatii\ Transavia.xlsx   # inregistreaza
 *   npm run golden -- --verifica                                # cauta deriva
 *
 * De ce exista: `OPENAI_MODEL` pointeaza spre un model care se poate schimba
 * sub noi — un alias mutat de OpenAI, sau un snapshot pe care il schimbam noi
 * din .env. Nimic din repo nu se modifica, dar acelasi fisier de la client
 * incepe sa dea alte pozitii, deci alte preturi in oferta. Fara o inregistrare
 * a ce raspundea modelul ieri, schimbarea nu are cum sa fie observata.
 *
 * Fisierul inregistrat serveste la doua lucruri diferite:
 *
 *   - `tests/golden.test.ts` reia OFFLINE partea determinista (validare +
 *     tarifare) peste iesirea inregistrata. Ruleaza in CI, fara cheie si fara
 *     retea, si pica atunci cand o schimbare de-a noastra muta preturile pe
 *     linii reale.
 *   - `--verifica` re-cheama modelul pe aceleasi texte si compara campurile
 *     care intra in tarifare. Ruleaza manual, costa tokeni, si e singurul
 *     lucru care poate spune "modelul raspunde altfel decat luna trecuta".
 *
 * Se inregistreaza doar textul liniilor si parametrii extrasi — nu preturile
 * firmei, care oricum nu trec niciodata prin model.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { parseWorkbook } from "../src/import/parse-workbook.js";
import { adaugaSectiuni } from "../src/import/sectiuni.js";
import { extrageDeterminist } from "../src/import/extract-regex.js";
import { extrageCuModel, MODEL_IMPLICIT } from "../src/import/extract-llm.js";
import { tarifeazaExtras } from "../src/import/pipeline.js";
import { valideazaExtragere } from "../src/import/valideaza.js";
import {
  amprenta, citesteGolden, goldenuri, DIR_GOLDEN,
  type Golden, type LinieGolden,
} from "./golden-store.js";

// Cheia sta in .env, gitignorat. Node 21+ il incarca nativ.
if (existsSync(".env")) process.loadEnvFile(".env");

const slug = (cale: string): string =>
  basename(cale).replace(/\.xlsx$/i, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** L0 + L2a: exact liniile pe care pipeline-ul le-ar trimite la model. */
async function reziduale(cale: string) {
  const brute = adaugaSectiuni(await parseWorkbook(cale));
  const out = [];
  for (const b of brute) {
    if (extrageDeterminist(b.index, b.text, b.um, b.sectiune).complet) continue;
    out.push({
      index: b.index, text: b.text,
      ...(b.um ? { um: b.um } : {}),
      ...(b.sectiune ? { sectiune: b.sectiune } : {}),
      ...(b.cantitate !== undefined ? { cantitate: b.cantitate } : {}),
    });
  }
  return out;
}

async function inregistreaza(cale: string): Promise<void> {
  const model = process.env["OPENAI_MODEL"] ?? MODEL_IMPLICIT;
  const surse = await reziduale(cale);
  console.log(`\n${cale}\n  reziduale  ${surse.length}\n  model      ${model}`);

  const extrase = await extrageCuModel(
    surse.map((s) => ({ index: s.index, text: s.text, ...(s.um ? { um: s.um } : {}) })),
    { model },
  );
  const dupaIndex = new Map(extrase.map((e) => [e.index, e]));

  const linii: LinieGolden[] = [];
  for (const s of surse) {
    const extras = dupaIndex.get(s.index);
    if (!extras) continue;
    const t = tarifeazaExtras(extras, s.cantitate ?? 1);
    linii.push({
      ...s, extras,
      avertismente: valideazaExtragere(extras, { text: s.text, ...(s.um ? { um: s.um } : {}) }).map((a) => a.cod),
      pret_unitar: t.pret?.pret_unitar ?? null,
      total: t.pret?.total ?? null,
      eroare: t.eroare ?? null,
    });
  }

  const golden: Golden = { fisier: basename(cale), model, generat: new Date().toISOString(), linii };
  mkdirSync(DIR_GOLDEN, { recursive: true });
  const tinta = join(DIR_GOLDEN, `${slug(cale)}.json`);
  writeFileSync(tinta, `${JSON.stringify(golden, null, 2)}\n`);

  const tarifate = linii.filter((l) => l.total !== null).length;
  const suspecte = linii.filter((l) => l.avertismente.length).length;
  console.log(`  inregistrate ${linii.length} linii, ${tarifate} tarifate, ${suspecte} cu avertisment`);
  console.log(`  -> tests/golden/${slug(cale)}.json\n`);
}

/**
 * Re-cheama modelul pe textele inregistrate si compara campurile de tarifare.
 *
 * NU spune cine are dreptate — spune doar ca raspunsul s-a schimbat. Acolo se
 * uita un om, exact ca la `npm run compara`.
 */
async function verifica(): Promise<void> {
  const fisiere = goldenuri();
  if (fisiere.length === 0) {
    console.error("Nu exista niciun golden file. Ruleaza intai: npm run golden -- <fisier.xlsx>");
    process.exit(1);
  }
  const model = process.env["OPENAI_MODEL"] ?? MODEL_IMPLICIT;
  let deriva = 0;

  for (const nume of fisiere) {
    const g = citesteGolden(nume);
    console.log(`\n${g.fisier}  (inregistrat cu ${g.model}, ${g.generat.slice(0, 10)})`);
    if (g.model !== model) console.log(`  ATENTIE: acum rulezi ${model}, alt model decat inregistrarea`);

    const acum = await extrageCuModel(
      g.linii.map((l) => ({ index: l.index, text: l.text, ...(l.um ? { um: l.um } : {}) })),
      { model },
    );
    const dupaIndex = new Map(acum.map((e) => [e.index, e]));

    const diferente: string[] = [];
    for (const l of g.linii) {
      const nou = dupaIndex.get(l.index);
      if (!nou) continue;
      if (amprenta(nou) === amprenta(l.extras)) continue;
      diferente.push(
        `  [${l.index}] ${l.text.replace(/\s+/g, " ").slice(0, 74)}\n` +
        `      inregistrat  ${amprenta(l.extras)}\n` +
        `      acum         ${amprenta(nou)}`,
      );
    }
    deriva += diferente.length;
    console.log(`  acord ${g.linii.length - diferente.length}/${g.linii.length}`);
    for (const d of diferente.slice(0, 15)) console.log(d);
    if (diferente.length > 15) console.log(`  … si inca ${diferente.length - 15}.`);
  }

  console.log(
    deriva === 0
      ? "\n  Zero deriva: modelul raspunde la fel ca la inregistrare.\n"
      : `\n  ${deriva} linii difera. De citit de om; daca noul raspuns e cel bun, reinregistreaza.\n`,
  );
  if (deriva > 0) process.exit(2);
}

const args = process.argv.slice(2);
if (args.includes("--verifica")) {
  await verifica();
} else {
  const cale = args.find((a) => !a.startsWith("--"));
  if (!cale) {
    console.error("folosire: npm run golden -- <fisier.xlsx>   |   npm run golden -- --verifica");
    process.exit(1);
  }
  await inregistreaza(cale);
}
