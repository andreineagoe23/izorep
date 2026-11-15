// tsx ruleaza.ts <fisier.xlsx> <rezidential|industrial> <model|fara> <iesire.json>
import { existsSync, writeFileSync } from "node:fs";
// Se ruleaza din radacina proiectului izorep: npx tsx exemple-AI/_generator/ruleaza.mts ...
const { importaFisier } = await import(process.cwd() + "/src/import/pipeline.js");

if (existsSync(".env")) process.loadEnvFile(".env");
const [cale, dest, mod, out] = process.argv.slice(2);
const r = await importaFisier(cale!, {
  faraModel: mod !== "model",
  destinatie: dest as "rezidential" | "industrial",
  stoc: { toate: () => [], pune: () => {}, sterge: () => {} },
});
const linii = r.linii.map((l) => {
  const p = l.pret as Record<string, unknown> | undefined;
  return {
    foaie: l.bruta.foaie, rand: l.bruta.rand, text: l.bruta.text, um: l.bruta.um ?? null, cantitate: l.bruta.cantitate ?? null,
    sistem: l.extras.sistem, dtip: l.extras.diametru_tip, d: l.extras.diametru_valoare, g: l.extras.grosime_mm,
    forma: l.extras.forma, extra: l.extras.straturi_extra, gol: [l.extras.gol_latime_mm, l.extras.gol_inaltime_mm],
    incredere: l.extras.incredere, motivModel: l.extras.motiv, sursa: l.sursa,
    pret: p ? p["pret_unitar"] : null,
    straturi: p && "straturi" in p ? (p["straturi"] as { sistem: string; grosime_mm: number | null; rand_lista: number; inclus: boolean }[])
      .map((s) => `${s.sistem}${s.grosime_mm ?? ""}@${s.rand_lista}${s.inclus ? "" : "(exclus)"}`).join(" + ") : null,
    motive: p ? p["motiveDeVerificat"] ?? [] : [], note: p ? p["note"] ?? [] : [],
    validare: l.necesitaValidare, eroare: l.eroare ?? null, cod: l.codEroare ?? null,
    avert: (l.avertismente ?? []).map((a) => a.cod), preizolat: l.preizolat ?? false,
  };
});
const { linii: _x, ...stat } = r;
writeFileSync(out!, JSON.stringify({ stat, linii }, null, 1));
console.log(JSON.stringify(stat));
