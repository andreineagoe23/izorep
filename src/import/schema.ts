import { z } from "zod";

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
            "grosime_mm", "forma", "straturi_extra", "incredere", "motiv",
          ],
          properties: {
            index: { type: "integer" },
            sistem: { type: ["string", "null"], enum: [...SISTEME, null] },
            diametru_valoare: { type: ["number", "null"] },
            diametru_tip: { type: ["string", "null"], enum: ["DN", "exterior", "interior", null] },
            grosime_mm: { type: ["number", "null"] },
            forma: { type: ["string", "null"], enum: [...FORME, null] },
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
