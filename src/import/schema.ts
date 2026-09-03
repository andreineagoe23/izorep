import { z } from "zod";

/**
 * De unde vine extragerea unei linii.
 *
 * Sta aici, langa contractul de extragere, fiindca il folosesc si pipeline-ul,
 * si ecranul de import — iar ecranul nu are voie sa importe pipeline-ul, care
 * trage dupa el clientul OpenAI intr-un bundle de browser.
 *
 * `sablon` inseamna ca linia n-a fost citita de model: are acelasi tipar cu o
 * linie geamana din acelasi fisier, iar rolul ei a fost dus mai departe de
 * acolo, cu numerele recitite din propriul text. `memorie` e acelasi lucru,
 * dar tiparul vine dintr-o corectie umana de la un import anterior.
 */
export type Sursa = "regex" | "model" | "sablon" | "memorie";

export const SISTEME = ["elastomer", "vata_minerala", "tabla", "pvc", "goluri_foc"] as const;
export const FORME = [
  "ml", "mp", "manseta", "cot", "teu", "reductie", "robinet", "vana",
  "flansa", "contor", "compensator", "pompa", "filtru", "distribuitor", "schimbator",
] as const;

/**
 * Tinta extragerii. E deliberat MICA si INCHISA: cinci campuri cu domenii
 * enumerate. Asta e diferenta dintre o problema tratabila si una imposibila —
 * si motivul pentru care RAG-ul nu isi are locul aici.
 */
export const LinieExtrasa = z.object({
  /** Indexul liniei din fisierul sursa, ca sa poti reveni la ea. */
  index: z.number().int(),
  /** null = linia nu e o pozitie de izolatie (alta meserie, antet, total). */
  sistem: z.enum(SISTEME).nullable(),
  diametru_valoare: z.number().nullable(),
  diametru_tip: z.enum(["DN", "exterior", "interior"]).nullable(),
  grosime_mm: z.number().nullable(),
  forma: z.enum(FORME).nullable(),
  /**
   * Dimensiunile golului, in mm, la inchiderile goluri la foc. Scrise
   * "130/130" in coloana "dimensiune gol". Pretul acolo NU vine din
   * diametru si grosime, ci din suprafata golului — fara ele linia nu se
   * poate tarifa, oricat de sigur ar fi restul.
   */
  gol_latime_mm: z.number().nullable(),
  gol_inaltime_mm: z.number().nullable(),
  /** Straturi suplimentare peste primul, pentru pozitii compuse. */
  straturi_extra: z.array(z.object({
    sistem: z.enum(SISTEME),
    grosime_mm: z.number().nullable(),
  })),
  incredere: z.number().min(0).max(1),
  /** De ce a ales asa. Se afiseaza omului la validare. */
  motiv: z.string(),
});
export type LinieExtrasa = z.infer<typeof LinieExtrasa>;

export const RaspunsModel = z.object({ linii: z.array(LinieExtrasa) });

/**
 * Acelasi contract, in JSON Schema, pentru structured outputs.
 * OpenAI cere strict: additionalProperties false si toate campurile in required
 * (optionalitatea se exprima prin tipuri nullable).
 */
export const JSON_SCHEMA = {
  name: "extragere_linii_deviz",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["linii"],
    properties: {
      linii: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "index", "sistem", "diametru_valoare", "diametru_tip",
            "grosime_mm", "forma", "gol_latime_mm", "gol_inaltime_mm",
            "straturi_extra", "incredere", "motiv",
          ],
          properties: {
            index: { type: "integer" },
            sistem: { type: ["string", "null"], enum: [...SISTEME, null] },
            diametru_valoare: { type: ["number", "null"] },
            diametru_tip: { type: ["string", "null"], enum: ["DN", "exterior", "interior", null] },
            grosime_mm: { type: ["number", "null"] },
            forma: { type: ["string", "null"], enum: [...FORME, null] },
            gol_latime_mm: { type: ["number", "null"] },
            gol_inaltime_mm: { type: ["number", "null"] },
            straturi_extra: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["sistem", "grosime_mm"],
                properties: {
                  sistem: { type: "string", enum: [...SISTEME] },
                  grosime_mm: { type: ["number", "null"] },
                },
              },
            },
            incredere: { type: "number" },
            motiv: { type: "string" },
          },
        },
      },
    },
  },
} as const;
