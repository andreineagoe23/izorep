/**
 * Bariere de structura.
 *
 * Proiectul e un singur pachet, nu un monorepo cu foldere separate pentru
 * server si interfata. Alegerea e deliberata: motorul de preturi si
 * pipeline-ul de import sunt IZOMORFE — acelasi cod ruleaza in Node (CLI,
 * teste) si in browser (demo-ul tarifeaza local, fara server). Intr-un split
 * backend/frontend, motorul n-ar avea unde sa stea fara sa fie duplicat.
 *
 * Pretul alegerii: nimic din structura nu impiedica un ecran sa importe
 * stratul de baza de date. Testele de aici sunt gardul.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const RADACINA = new URL("..", import.meta.url).pathname;

function fisiereTs(dir: string): string[] {
  const out: string[] = [];
  for (const nume of readdirSync(dir)) {
    const cale = join(dir, nume);
    if (statSync(cale).isDirectory()) out.push(...fisiereTs(cale));
    else if (nume.endsWith(".ts")) out.push(cale);
  }
  return out;
}

const relativ = (c: string) => c.slice(RADACINA.length);

describe("codul de browser nu atinge stratul de Node", () => {
  it("niciun ecran nu importa src/db/", () => {
    // `src/db/` foloseste driverul `postgres`, care are nevoie de `net` si
    // `tls`. Importat dintr-un ecran, build-ul pica — dar cu un stack trace
    // de Rollup, nu cu un motiv. Testul asta da motivul.
    //
    // Interfata NU vorbeste direct cu baza. Cand apare serverul, ecranele il
    // cheama prin fetch; pana atunci tarifeaza local, cu listele importate
    // static.
    const vinovate = fisiereTs(join(RADACINA, "web"))
      .filter((f) => /from\s+["'][^"']*src\/db\//.test(readFileSync(f, "utf8")))
      .map(relativ);

    expect(vinovate).toEqual([]);
  });

  it("motorul de preturi ramane izomorf: fara import de Node", () => {
    // Momentul in care `src/pricing/` importa `node:fs` sau driverul de baza,
    // demo-ul din browser si testele nu mai ruleaza acelasi cod — iar
    // "aceleasi preturi peste tot" devine o presupunere, nu o garantie.
    const interzise = /from\s+["'](node:|fs|path|postgres|drizzle-orm\/postgres-js)/;
    const vinovate = fisiereTs(join(RADACINA, "src", "pricing"))
      .filter((f) => interzise.test(readFileSync(f, "utf8")))
      .map(relativ);

    expect(vinovate).toEqual([]);
  });

  it("niciun ecran nu importa direct extract-regex.js, sabloane.js sau valideaza.js", () => {
    // Exact drift-ul asta a produs cele trei bug-uri masurate in nucleu.ts:
    // ecranul de import reimplementa L2a-L4 in loc sa treaca prin
    // `proceseazaRegistru`, si a ramas in urma — guardrails care nu rulau pe
    // ecran, `modelFaraRaspuns` numarat doar in CLI, plafonul de linii trimise
    // la model aplicat per apel in loc de per import. Orice ecran nou care
    // vrea sa extraga sau sa valideze trebuie sa treaca prin `nucleu.js`.
    // `memorie.js` ramane permis: ecranul cheama `invataDinCorectie` direct.
    const interzise = /from\s+["'][^"']*src\/import\/(extract-regex|sabloane|valideaza)\.js["']/;
    const vinovate = fisiereTs(join(RADACINA, "web"))
      .filter((f) => interzise.test(readFileSync(f, "utf8")))
      .map(relativ);

    expect(vinovate).toEqual([]);
  });

  it("niciun ecran nu cheama OpenAI direct: nici clientul, nici cititorul de poze", () => {
    // Cheia sta pe server (`src/server/model.ts`); ecranul cere prin
    // fetch. Importat intr-un ecran, `extrage-poza.js` sau `extract-llm.js` ar
    // trage clientul OpenAI in bundle si ar cere cheia in pagina.
    const interzise = /from\s+["'](openai|[^"']*src\/(santier\/extrage-poza|import\/extract-llm)\.js)["']/;
    const vinovate = fisiereTs(join(RADACINA, "web"))
      .filter((f) => interzise.test(readFileSync(f, "utf8")))
      .map(relativ);

    expect(vinovate).toEqual([]);
  });
});
