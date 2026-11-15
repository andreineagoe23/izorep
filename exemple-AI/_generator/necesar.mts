import { writeFileSync, readFileSync } from "node:fs";
// Se ruleaza din radacina proiectului izorep.
const R = process.cwd() + "/";
const { importaFisier } = await import(R + "src/import/pipeline.js");
const { necesarDinLinii } = await import(R + "src/stoc/necesar.js");
const { denumireComanda } = await import(R + "src/stoc/produse.js");
const [cale, dest, disc, out] = process.argv.slice(2);
const r = await importaFisier(cale!, { faraModel: true, destinatie: dest, stoc: { toate: () => [], pune: () => {}, sterge: () => {} } });
// ca in oferta: doar pozitiile cu pret
const linii = r.linii.filter((l: any) => l.extras.sistem !== null && l.pret);
const n = necesarDinLinii(linii, { discountProcent: Number(disc) });
const pf = JSON.parse(readFileSync(R + "data/preturi-furnizori.json", "utf8")).preturi;
const m = n.materiale.map((x: any) => ({
  cheie: x.cheie, den: denumireComanda({ sistem: x.sistem, grosime_mm: x.grosime_mm, rand: x.rand, forma: x.categorie }),
  cat: x.categorie, ml: x.ml, m2: x.m2, kg: x.kg ?? null, piese: x.piese, presupuse: x.piesePresupuse, pierdere: x.pierdere,
  valoareOferta: x.valoareOferta, pret: pf[x.cheie] ?? null,
}));
writeFileSync(out!, JSON.stringify({ pragTub: n.pragTub, pestePrag: n.pestePrag, materiale: m, fara: n.faraNecesar }, null, 1));
for (const x of m) console.log(x.cheie.padEnd(34), x.den.padEnd(52), "ml", x.ml, "m2", x.m2, "kg", x.kg, "piese", x.piese, "| pret", x.pret ? x.pret.map((p: any) => `${p.furnizor} ${p.valoare} ${p.moneda}`).join("; ") : "-");
console.log("fara:", n.faraNecesar.map((f: any) => `${f.rand}:${f.motiv}`).join(" | "), "pestePrag", n.pestePrag);
