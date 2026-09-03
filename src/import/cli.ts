#!/usr/bin/env tsx
/**
 * Import de proba pe un fisier de la client.
 *
 *   npm run import -- ../attachments/Book15.xlsx
 *   npm run import -- ../attachments/Book15.xlsx --fara-model
 */
import { existsSync } from "node:fs";
import { importaFisier } from "./pipeline.js";
import { MODEL_IMPLICIT } from "./extract-llm.js";

// .env e gitignorat si contine cheia OpenAI. Node 21+ il incarca nativ.
if (existsSync(".env")) process.loadEnvFile(".env");

const args = process.argv.slice(2);
const cale = args.find((a) => !a.startsWith("--"));
if (!cale) {
  console.error("folosire: npm run import -- <fisier.xlsx> [--fara-model]");
  process.exit(1);
}

const faraModel = args.includes("--fara-model");

// Modelul se afiseaza pentru ca OPENAI_MODEL din .env bate implicitul din cod,
// iar .env e gitignorat: un commit care schimba implicitul nu atinge fisierul
// nimanui. Fara linia asta, un dezvoltator poate rula luni la rand pe alt model
// decat crede — si plafoanele difera de zece ori intre ele.
console.log(faraModel
  ? "\n  model: dezactivat (--fara-model), doar stratul determinist"
  : `\n  model: ${process.env["OPENAI_MODEL"] ?? `${MODEL_IMPLICIT} (implicit)`}`);

const raport = await importaFisier(cale, { faraModel });

const proc = (n: number) => raport.liniiIzolatie ? `${(n / raport.liniiIzolatie * 100).toFixed(1)}%` : "-";
console.log(`\n${raport.fisier}`);
console.log(`  foi                      ${raport.foi}  (${raport.foiMapate} cu mapare de coloane)`);
console.log(`  randuri cu text          ${raport.total}  (${raport.faraMasura} fara UM/cantitate: note, titluri)`);
console.log(`  pozitii de izolatie      ${raport.liniiIzolatie}`);
console.log(`    rezolvate determinist  ${raport.prinRegex}  (${proc(raport.prinRegex)})`);
console.log(`    rezolvate cu modelul   ${raport.prinModel}  (${proc(raport.prinModel)})`);
console.log(`    deduse din sablon      ${raport.prinSablon}  (${proc(raport.prinSablon)})`);
console.log(`    din memorie            ${raport.prinMemorie}  (${proc(raport.prinMemorie)})`);
console.log(`  TARIFATE automat         ${raport.tarifate}  (${proc(raport.tarifate)})`);
console.log(`  de validat de om         ${raport.deValidat}`);
console.log(`    din care neverificate  ${raport.cuAvertisment}  (model, contrazis de textul sursa)`);
if (raport.modelFaraRaspuns > 0) {
  console.log(`  fara raspuns de la model ${raport.modelFaraRaspuns}  (trimise, dar neintoarse)`);
}
console.log(`  netarifate               ${raport.netarifate}`);
console.log(`  valoare                  ${raport.valoareTotala.toFixed(2)} EUR`);
if (raport.reziduale > 0) {
  const economie = raport.reziduale - raport.trimiseLaModel;
  console.log(`  linii la model           ${raport.trimiseLaModel} din ${raport.reziduale} reziduale` +
    (economie > 0 ? `  (-${(economie / raport.reziduale * 100).toFixed(0)}%, deduplicare pe sablon)` : ""));
}
console.log();

for (const l of raport.linii.filter((x) => x.pret).slice(0, 12)) {
  const e = l.extras;
  // Inchiderile la foc au componente (gol + banda + colier), nu straturi.
  const p = l.pret!;
  const detaliu = "straturi" in p
    ? p.straturi.map((s) => `${s.sistem}${s.grosime_mm ?? ""}@${s.rand_lista}`).join(" + ")
    : p.componente.map((c) => c.descriere).join(" + ");
  console.log(`  ${l.pret!.pret_unitar.toFixed(2).padStart(8)} x ${String(l.bruta.cantitate ?? 1).padStart(6)} = ${l.pret!.total.toFixed(2).padStart(10)}  [${l.sursa}] ${detaliu}`);
  console.log(`           ${e.diametru_tip}${e.diametru_valoare} · ${l.bruta.text.replace(/\s+/g, " ").slice(0, 78)}`);
}

// Avertismentele se tiparesc separat de pozitiile netarifate: alea n-au pret
// deloc, astea AU un pret care arata rezonabil si tocmai de-aia sunt periculoase.
const suspecte = raport.linii.filter((x) => x.avertismente?.length);
if (suspecte.length) {
  console.log(`\n  --- ${suspecte.length} linii pe care modelul nu se verifica in text ---`);
  for (const l of suspecte.slice(0, 10)) {
    console.log(`  ? ${l.avertismente!.map((a) => a.mesaj).join("; ")}`);
    console.log(`      ${l.bruta.text.replace(/\s+/g, " ").slice(0, 90)}`);
  }
  if (suspecte.length > 10) console.log(`  … si inca ${suspecte.length - 10}.`);
}

const problema = raport.linii.filter((x) => x.extras.sistem && !x.pret);
if (problema.length) {
  console.log(`\n  --- ${problema.length} pozitii de rezolvat manual ---`);
  for (const l of problema.slice(0, 10)) {
    console.log(`  ! ${l.eroare ?? "extragere incompleta"}`);
    console.log(`      ${l.bruta.text.replace(/\s+/g, " ").slice(0, 90)}`);
  }
}
