import { z } from "zod";

/**
 * Ce citeste modelul dintr-o poza cu notite de santier.
 *
 * Pe foaie, o linie arata asa: `ø60 (v.50 + Al) = 6 CT + 14 ml + 10 ml + 4 CT`.
 * Modelul NU aduna. Da cate un termen pentru fiecare cantitate scrisa (`6 CT`,
 * `14 ml`...), cu diametrul si straturile liniei din care face parte. Suma o
 * face codul, in `agrega.ts`: o adunare gresita de model ar arata ca o cifra
 * citita corect, iar omul n-ar avea cum s-o prinda.
 *
 * Aceeasi regula ca la import: schema mica si inchisa, domenii enumerate.
 */

export const IZOLATII = ["vata_minerala", "elastomer"] as const;
export const JACHETE = ["aluminiu", "inox", "pvc"] as const;
export const ELEMENTE = ["ml", "cot", "teu", "robinet", "flansa", "reductie", "alt"] as const;

export type Izolatie = (typeof IZOLATII)[number];
export type Jacheta = (typeof JACHETE)[number];
export type Element = (typeof ELEMENTE)[number];

export const TermenPoza = z.object({
  /** Antetul zonei de deasupra, cum e scris: „A) Zona ...", „Soda 1". */
  zona: z.string().nullable(),
  diametru_valoare: z.number().nullable(),
  /** `ø` = diametrul exterior al tevii, `DN` = diametrul nominal. */
  diametru_tip: z.enum(["exterior", "DN"]).nullable(),
  /** null = fara izolatie, doar jacheta („doar Al"). */
  izolatie: z.enum(IZOLATII).nullable(),
  grosime_mm: z.number().nullable(),
  jacheta: z.enum(JACHETE).nullable(),
  element: z.enum(ELEMENTE),
  /** Cantitatea scrisa in dreptul termenului, nu suma. `1,50` -> 1.5. */
  cantitate: z.number(),
  /** `× 2` scris langa un grup incadrat; altfel 1. */
  multiplicator: z.number(),
  /** „(pret dublu)" scris langa termen. */
  pret_dublu: z.boolean(),
  /** Exact ce scrie pe foaie pentru termenul asta: „6 CT", „1 ROB (pret dublu)". */
  text: z.string(),
  /** Cifra corectata peste alta, greu de citit, sau ghicita. */
  nesigur: z.boolean(),
});
export type TermenPoza = z.infer<typeof TermenPoza>;

export const RaspunsPoza = z.object({
  termeni: z.array(TermenPoza),
  /** Ce scrie pe pagina si nu e masuratoare: „se vor calcula preturi industriale". */
  note: z.array(z.string()),
});
export type RaspunsPoza = z.infer<typeof RaspunsPoza>;

/** Acelasi contract, pentru structured outputs: strict, totul in `required`. */
export const JSON_SCHEMA_POZA = {
  name: "notite_santier",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["termeni", "note"],
    properties: {
      termeni: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "zona", "diametru_valoare", "diametru_tip", "izolatie", "grosime_mm", "jacheta",
            "element", "cantitate", "multiplicator", "pret_dublu", "text", "nesigur",
          ],
          properties: {
            zona: { type: ["string", "null"] },
            diametru_valoare: { type: ["number", "null"] },
            diametru_tip: { type: ["string", "null"], enum: ["exterior", "DN", null] },
            izolatie: { type: ["string", "null"], enum: [...IZOLATII, null] },
            grosime_mm: { type: ["number", "null"] },
            jacheta: { type: ["string", "null"], enum: [...JACHETE, null] },
            element: { type: "string", enum: [...ELEMENTE] },
            cantitate: { type: "number" },
            multiplicator: { type: "number" },
            pret_dublu: { type: "boolean" },
            text: { type: "string" },
            nesigur: { type: "boolean" },
          },
        },
      },
      note: { type: "array", items: { type: "string" } },
    },
  },
} as const;
