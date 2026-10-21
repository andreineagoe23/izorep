/**
 * Cursul BNR al zilei, doar pentru antetul aplicatiei (21 octombrie 2026,
 * cerut de Andrei): `GET /api/curs`.
 *
 * E o informatie pe ecran, nimic mai mult. Niciun calcul nu-l citeste: oferta
 * e in euro, iar la depozit si la comenzi euro = lei / cursul de pe document
 * (`src/stoc/comenzi.ts`). Un curs care se schimba zilnic n-are voie sa
 * schimbe o suma deja scrisa.
 *
 * Il cere serverul, nu pagina: BNR nu da voie altor site-uri sa-l citeasca din
 * browser (CORS), iar pe linkul demo, fara server, antetul ramane fara curs.
 * BNR publica o data pe zi lucratoare, in jur de 13:00, deci serverul il tine
 * o ora in memorie. Cand BNR nu raspunde, ramane ultimul curs citit, cu data
 * lui; fara niciunul, ruta spune 503 si antetul nu arata nimic.
 */
import { Hono } from "hono";

/** Fisierul zilei. `www.bnr.ro/nbrfxrates.xml` trimite acum spre prima pagina. */
export const URL_BNR = "https://curs.bnr.ro/nbrfxrates.xml";
export const VALABIL_MS = 60 * 60 * 1000;
const ASTEPTARE_MS = 8000;

/** Raspunsul rutei: lei pentru 1 €, din ziua `data` (YYYY-MM-DD) a BNR. */
export interface CursBnr {
  eur: number;
  data: string;
}

/** EUR si data din XML-ul BNR. Orice alta forma → null. */
export function citesteCursBnr(xml: string): CursBnr | null {
  const data = /<Cube\s+date="(\d{4}-\d{2}-\d{2})"/.exec(xml)?.[1];
  const eur = Number(/<Rate\s+currency="EUR"[^>]*>\s*([\d.]+)\s*<\/Rate>/.exec(xml)?.[1]);
  return data && Number.isFinite(eur) && eur > 0 ? { eur, data } : null;
}

export interface OptiuniCurs {
  /** Inlocuibil in teste: fara retea. */
  aduce?: () => Promise<string>;
  acum?: () => number;
}

async function aduceBnr(): Promise<string> {
  const r = await fetch(URL_BNR, { signal: AbortSignal.timeout(ASTEPTARE_MS) });
  if (!r.ok) throw new Error(`BNR a raspuns ${r.status}`);
  return r.text();
}

export function ruteCurs(o: OptiuniCurs = {}): Hono {
  const aduce = o.aduce ?? aduceBnr;
  const acum = o.acum ?? Date.now;
  let ultimul: CursBnr | null = null;
  let luat = -Infinity;
  /** O singura cerere la BNR, oricate pagini se deschid deodata. */
  let inCurs: Promise<void> | null = null;

  const improspateaza = (): Promise<void> => (inCurs ??= (async () => {
    try {
      const c = citesteCursBnr(await aduce());
      if (c) ultimul = c;
      else console.error("Cursul BNR: fisierul nu are forma asteptata");
    } catch (e) {
      console.error(`Cursul BNR nu s-a putut citi: ${e instanceof Error ? e.message : String(e)}`);
    }
    // Si dupa o greseala: urmatoarea incercare peste o ora, nu la fiecare pagina.
    luat = acum();
    inCurs = null;
  })());

  const app = new Hono();
  app.get("/curs", async (c) => {
    if (acum() - luat >= VALABIL_MS) await improspateaza();
    return ultimul ? c.json(ultimul satisfies CursBnr) : c.json({ eroare: "Cursul BNR nu e disponibil acum." }, 503);
  });
  return app;
}
