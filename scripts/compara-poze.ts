import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { agrega } from "../src/santier/agrega.js";
import { citestePoza, type RezultatPoza } from "../src/santier/extrage-poza.js";
import { scor, type RandRef, type Scor } from "../src/santier/scor.js";

/**
 * Care model citeste cel mai bine pozele de pe santier.
 *
 *   npm run compara-poze -- gpt-4.1 gpt-5.4 o3 [--repetari 2]
 *
 * Pozele stau in ../attachments/santier (nu sunt in repo); raspunsul corect e
 * transcrierea din tests/fixtures-santier-ecoterm.json. Scorul e pe randuri:
 * acelasi diametru, aceleasi straturi, acelasi element si ACEEASI cantitate
 * totala. O cantitate aproape buna e tot gresita — in oferta ar iesi alt pret.
 *
 * Raspunsurile brute se salveaza in .rezultate-poze/ (gitignorat), ca sa poata
 * fi recitite fara sa se plateasca din nou.
 */
if (existsSync(".env")) process.loadEnvFile(".env");

const DIR_POZE = "../attachments/santier";
const DIR_REZ = ".rezultate-poze";

interface Referinta { pagini: { fisier: string; note: string[]; randuri: RandRef[] }[] }

const argumente = process.argv.slice(2);
const iRep = argumente.indexOf("--repetari");
const repetari = iRep >= 0 ? Number(argumente[iRep + 1]) || 1 : 1;
const modele = argumente.filter((a, i) => !a.startsWith("--") && (iRep < 0 || i !== iRep + 1));
if (modele.length === 0) {
  console.error("Utilizare: npm run compara-poze -- <model> [<model> ...] [--repetari N]");
  process.exit(1);
}

const referinta = JSON.parse(readFileSync("tests/fixtures-santier-ecoterm.json", "utf8")) as Referinta;
const poze = new Map(referinta.pagini.map((p) => [
  p.fisier, `data:image/jpeg;base64,${readFileSync(join(DIR_POZE, p.fisier)).toString("base64")}`,
]));
mkdirSync(DIR_REZ, { recursive: true });

interface Rulare { model: string; rep: number; scoruri: Scor[]; tokeni: number; secunde: number; eroare?: string }

async function ruleaza(model: string, rep: number): Promise<Rulare> {
  const t0 = Date.now();
  let tokeni = 0;
  try {
    // Paginile in paralel: sunt independente, iar latenta e dominata de generare.
    const rez = await Promise.all(referinta.pagini.map(async (p) => {
      const r: RezultatPoza = await citestePoza(poze.get(p.fisier)!, { model });
      writeFileSync(join(DIR_REZ, `${model}-${rep}-${p.fisier}.json`), JSON.stringify(r, null, 2));
      return { p, r };
    }));
    const scoruri = rez.map(({ p, r }) => {
      tokeni += r.tokeni.intrare + r.tokeni.iesire;
      return scor(p.randuri, agrega(r.termeni));
    });
    return { model, rep, scoruri, tokeni, secunde: (Date.now() - t0) / 1000 };
  } catch (e) {
    return { model, rep, scoruri: [], tokeni, secunde: (Date.now() - t0) / 1000, eroare: e instanceof Error ? e.message.slice(0, 160) : String(e) };
  }
}

const rulari: Rulare[] = [];
for (const model of modele) {
  for (let rep = 1; rep <= repetari; rep++) {
    process.stdout.write(`${model} #${rep} … `);
    const r = await ruleaza(model, rep);
    rulari.push(r);
    if (r.eroare) { console.log(`EROARE: ${r.eroare}`); continue; }
    const c = r.scoruri.reduce((s, x) => s + x.corecte, 0);
    const t = r.scoruri.reduce((s, x) => s + x.total, 0);
    const plus = r.scoruri.reduce((s, x) => s + x.inPlus.length, 0);
    const cs = r.scoruri.reduce((s, x) => s + x.corecteSigure, 0);
    const ts = r.scoruri.reduce((s, x) => s + x.totalSigure, 0);
    console.log(`${c}/${t} randuri exacte (${cs}/${ts} pe cele sigure), ${plus} in plus · ${r.tokeni} tokeni · ${r.secunde.toFixed(0)} s`);
  }
}

writeFileSync(join(DIR_REZ, `rezumat-${Date.now()}.json`), JSON.stringify(rulari, null, 2));

console.log("\nPe pagini (exacte / total):");
for (const r of rulari.filter((x) => !x.eroare)) {
  console.log(`  ${r.model.padEnd(24)} #${r.rep}  ${r.scoruri.map((s) => `${s.corecte}/${s.total}`).join("  ")}`);
}
