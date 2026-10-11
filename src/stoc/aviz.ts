/**
 * Avizul sau factura furnizorului, citite din poza sau din PDF (S31: „biroul
 * trece avizul primit si ataseaza poza sau PDF-ul lui”).
 *
 * Aceeasi regula ca la pozele din carnet: **modelul citeste, codul decide.**
 * Modelul transcrie antetul (tip, serie, numar, data, curs) si liniile (cod,
 * denumire, cantitate, UM, pret), cum sunt scrise. Pe ce linie a comenzii cade
 * fiecare o decide `articolDinDenumire` — aceeasi functie care citeste evidenta
 * firmei —, iar omul vede formularul de receptie completat si il trimite el.
 * Nimic nu intra in stoc din citire.
 *
 * `citesteAviz` (`aviz-model.ts`) cheama modelul, doar pe server; ce e aici e
 * pur si ruleaza si in pagina.
 */
import { z } from "zod";
import { articolDinDenumire, kgPeMp } from "./produse.js";
import { articolDin, cheieBaza } from "./registru.js";
import type { Comanda, DocumentIntrare, PretPeUnitate } from "./comenzi.js";

export const LinieCitita = z.object({
  cod: z.string().nullable(),
  denumire: z.string(),
  cantitate: z.number(),
  um: z.string().nullable(),
  /** Pretul unitar fara TVA, cand e scris (factura); pe aviz, null. */
  pret_unitar: z.number().nullable(),
});
export type LinieCitita = z.infer<typeof LinieCitita>;

export const CitireAviz = z.object({
  tip: z.enum(["aviz", "factura"]),
  serie: z.string().nullable(),
  numar: z.string().nullable(),
  /** YYYY-MM-DD. */
  data: z.string().nullable(),
  furnizor: z.string().nullable(),
  moneda: z.enum(["RON", "EUR"]).nullable(),
  /** Lei pentru 1 €, cand e scris pe document. */
  curs: z.number().nullable(),
  /** Transportul, fara TVA, cand e un rand separat. */
  transport: z.number().nullable(),
  linii: z.array(LinieCitita),
});
export type CitireAviz = z.infer<typeof CitireAviz>;

const nul = (t: string): { type: string[] } => ({ type: [t, "null"] });
export const JSON_SCHEMA_AVIZ = {
  name: "aviz_furnizor",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["tip", "serie", "numar", "data", "furnizor", "moneda", "curs", "transport", "linii"],
    properties: {
      tip: { type: "string", enum: ["aviz", "factura"] },
      serie: nul("string"), numar: nul("string"), data: nul("string"), furnizor: nul("string"),
      moneda: { type: ["string", "null"], enum: ["RON", "EUR", null] },
      curs: nul("number"), transport: nul("number"),
      linii: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["cod", "denumire", "cantitate", "um", "pret_unitar"],
          properties: {
            cod: nul("string"), denumire: { type: "string" }, cantitate: { type: "number" }, um: nul("string"),
            pret_unitar: nul("number"),
          },
        },
      },
    },
  },
} as const;

/* ------------------------------------------------------- pe linii, pur */

export interface ReceptieCitita {
  document: Partial<DocumentIntrare>;
  curs?: number;
  moneda?: "RON" | "EUR";
  transport?: number;
  /** Pe linia comenzii: cantitatea de pe document (kg la tabla) si pretul, daca e scris. */
  linii: Record<string, { cantitate: number; pret?: PretPeUnitate }>;
  /** Randurile documentului care nu cad pe nicio linie a comenzii: omul le vede. */
  nepotrivite: LinieCitita[];
  /** UM-ul de pe document nu e al articolului (ML la o placa): linia nu se completeaza. */
  umGresit: LinieCitita[];
}

/** UM-ul documentului, pe unitatea articolului: ML la tub, MP la placa si saltea, KG la tabla. */
function umPotrivita(um: string | null, forma: string, laKg: boolean): boolean {
  const u = (um ?? "").toUpperCase().replace(/[^A-Z2²]/g, "");
  if (laKg) return u === "KG";
  if (forma === "tub") return u === "ML" || u === "M";
  return u === "MP" || u === "M2" || u === "M²";
}

/**
 * Liniile citite, puse pe liniile comenzii dupa articol (sistem, forma,
 * grosime, ø — fara marca). Doua randuri pe acelasi articol se aduna.
 */
export function receptieDinCitire(c: Pick<Comanda, "linii">, citire: CitireAviz): ReceptieCitita {
  const out: ReceptieCitita = {
    document: {
      tip: citire.tip,
      ...(citire.serie ? { serie: citire.serie } : {}),
      ...(citire.numar ? { numar: citire.numar } : {}),
      ...(citire.data && /^\d{4}-\d{2}-\d{2}$/.test(citire.data) ? { data: citire.data } : {}),
    },
    ...(citire.curs && citire.curs > 0 ? { curs: citire.curs } : {}),
    ...(citire.moneda ? { moneda: citire.moneda } : {}),
    ...(citire.transport && citire.transport > 0 ? { transport: citire.transport } : {}),
    linii: {}, nepotrivite: [], umGresit: [],
  };
  for (const r of citire.linii) {
    const a = articolDinDenumire(r.denumire) ?? (r.cod ? articolDinDenumire(r.cod) : null);
    const cheie = a ? cheieBaza(articolDin(a)) : null;
    const lc = cheie ? c.linii.find((l) => cheieBaza(l.articol) === cheie) : undefined;
    if (!a || !lc) { out.nepotrivite.push(r); continue; }
    if (!umPotrivita(r.um, a.forma, kgPeMp(lc.articol) !== null)) { out.umGresit.push(r); continue; }
    const v = out.linii[lc.id] ?? { cantitate: 0 };
    v.cantitate = Math.round((v.cantitate + r.cantitate) * 1000) / 1000;
    if (r.pret_unitar !== null && r.pret_unitar > 0) v.pret = { valoare: r.pret_unitar, moneda: citire.moneda ?? "RON" };
    out.linii[lc.id] = v;
  }
  return out;
}
