/**
 * Stratul cu model pe server: `/api/extrage` (liniile din Excel pe care
 * regulile nu le-au citit) si `/api/poza` (pozele din carnetul de santier).
 *
 * Pana la Faza 3 traiau doar in `vite dev`, deci pe serverul adevarat importul
 * ramanea pe reguli, iar Masuratorile din poze nu mergeau deloc. Aici stau
 * dupa intrare: le cheama doar un om cu cont, iar cheia OpenAI ramane in
 * procesul serverului, niciodata in pagina.
 *
 * Contractul cu ecranele e cel de pana acum: GET spune daca modelul e
 * disponibil, POST face treaba. Ce iese din model trece prin schema inca o data
 * inainte sa plece spre pagina; preturile nu trec niciodata pe aici.
 */
import { Hono } from "hono";
import { z } from "zod";
import { extrageCuModel, MODEL_IMPLICIT } from "../import/extract-llm.js";
import { RaspunsModel, type LinieExtrasa } from "../import/schema.js";
import { citestePoza, MODEL_POZE_IMPLICIT, type RezultatPoza } from "../santier/extrage-poza.js";

/** Plafon per cerere: un fisier de 3.000 de randuri nu porneste 3.000 de extrageri dintr-un clic gresit. */
export const MAX_LINII = 400;

export interface LinieDeExtras { index: number; text: string; um?: string; sectiune?: string }

export interface OptiuniModel {
  /** Fara cheie, rutele spun „indisponibil” si ecranele merg pe reguli, ca pe Pages. */
  cheie?: string;
  model: string;
  modelPoze: string;
  prag: number;
  lot: number;
  concurenta: number;
  /** Inlocuibile in teste: fara retea, fara OpenAI. */
  extrage?: (linii: LinieDeExtras[], o: { apiKey: string; model: string; dimensiuneLot: number; concurenta: number }) => Promise<LinieExtrasa[]>;
  citeste?: (imagine: string, o: { apiKey: string; model: string }) => Promise<Pick<RezultatPoza, "termeni" | "note" | "model">>;
}

/** Din mediu, cu aceleasi variabile si implicite ca CLI-ul si `vite dev` de pana acum. */
export function optiuniModelDinMediu(env: NodeJS.ProcessEnv = process.env): OptiuniModel {
  const nr = (c: string, i: number): number => {
    const v = Number(env[c]);
    return Number.isFinite(v) && v > 0 ? Math.floor(v) : i;
  };
  return {
    ...(env["OPENAI_API_KEY"] ? { cheie: env["OPENAI_API_KEY"] } : {}),
    model: env["OPENAI_MODEL"] ?? MODEL_IMPLICIT,
    modelPoze: env["IZOREP_MODEL_POZE"] ?? MODEL_POZE_IMPLICIT,
    prag: Number(env["IZOREP_CONFIDENCE_THRESHOLD"] ?? 0.85),
    lot: nr("IZOREP_LOT", 25),
    // Prima manevra cand contul OpenAI da 429: IZOREP_CONCURENTA=1.
    concurenta: nr("IZOREP_CONCURENTA", 4),
  };
}

const CerereExtragere = z.object({
  linii: z.array(z.object({
    index: z.number().int().nonnegative(), text: z.string().max(4000),
    um: z.string().max(50).optional(), sectiune: z.string().max(1000).optional(),
  })),
});
const CererePoza = z.object({ imagine: z.string().startsWith("data:image/") });

/** Rutele, de montat sub `/api` dupa verificarea intrarii. */
export function ruteModel(o: OptiuniModel): Hono {
  const app = new Hono();
  const extrage = o.extrage ?? extrageCuModel;
  const citeste = o.citeste ?? citestePoza;

  app.get("/extrage", (c) => c.json({
    disponibil: Boolean(o.cheie), model: o.model, prag: o.prag, lot: o.lot, concurenta: o.concurenta,
  }));
  app.post("/extrage", async (c) => {
    if (!o.cheie) return c.json({ eroare: "Citirea cu model nu e pornită pe server." }, 503);
    const toate = CerereExtragere.parse(await c.req.json()).linii;
    const linii: LinieDeExtras[] = toate.slice(0, MAX_LINII).map(({ index, text, um, sectiune }) => ({
      index, text, ...(um !== undefined ? { um } : {}), ...(sectiune !== undefined ? { sectiune } : {}),
    }));
    if (linii.length === 0) return c.json({ linii: [], trunchiat: 0 });
    console.info(`model: extrag ${linii.length} linii reziduale (${o.model})`);
    const extrase = await extrage(linii, { apiKey: o.cheie, model: o.model, dimensiuneLot: o.lot, concurenta: o.concurenta });
    // Validarea nu e optionala: aceeasi schema ca in CLI, inca o data. Un
    // raspuns stricat e vina modelului, nu a paginii: 502, nu 400.
    const verificat = RaspunsModel.safeParse({ linii: extrase });
    if (!verificat.success) return c.json({ eroare: "Modelul a răspuns în altă formă decât cea cerută." }, 502);
    return c.json({ linii: verificat.data.linii, trunchiat: toate.length - linii.length });
  });

  app.get("/poza", (c) => c.json({ disponibil: Boolean(o.cheie), model: o.modelPoze }));
  app.post("/poza", async (c) => {
    if (!o.cheie) return c.json({ eroare: "Citirea cu model nu e pornită pe server." }, 503);
    const { imagine } = CererePoza.parse(await c.req.json());
    console.info(`model: citesc o poza de santier (${o.modelPoze})`);
    const r = await citeste(imagine, { apiKey: o.cheie, model: o.modelPoze });
    return c.json({ termeni: r.termeni, note: r.note, model: r.model });
  });

  return app;
}
