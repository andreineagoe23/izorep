import { clientSiModel, cuLimitaDeRata } from "../import/extract-llm.js";
import { JSON_SCHEMA_POZA, RaspunsPoza } from "./schema.js";

/**
 * Citirea unei poze cu notite de santier. Doar pe server: cheia OpenAI nu
 * ajunge in pagina (vezi `scripts/vite-plugin-model.ts`).
 *
 * Modelul citeste, nu calculeaza: da termenii asa cum sunt scrisi, iar suma,
 * textul pentru motor si pretul le face codul. Ce iese e o PROPUNERE — omul o
 * confirma rand cu rand, cu poza alaturi.
 */
const PROMPT = `Primesti poza unei pagini dintr-un carnet de santier, scrisa de mana, pentru o firma de IZOLATII TERMICE pe conducte. Pagina are masuratori pe zone. Le transcrii ca termeni, fara sa aduni nimic.

NOTATIA DE PE FOAIE:
- Un antet de zona, de obicei subliniat sau incercuit: "(A) ZONA ...", "b) Zona filtre", "SODA 1". Pune-l in "zona", cum e scris, pentru toti termenii de sub el, pana la urmatorul antet.
- O linie incepe cu diametrul: "ø60" = diametrul exterior al tevii 60 mm (diametru_tip "exterior"); "DN400" = diametru nominal (diametru_tip "DN").
- In paranteza, straturile: "v.50" sau "v 50" = vata minerala 50 mm; "Al" = jacheta din tabla de aluminiu; "inox" = tabla inox; "elastomer 19" = elastomer 19 mm.
- "(doar Al)" = numai tabla de aluminiu, FARA vata: izolatie null, grosime null. Daca "(doar Al)" e in antetul zonei, se aplica tuturor liniilor din zona.
- Dupa "=" urmeaza cantitatile, legate cu "+", care pot continua pe randurile de dedesubt. Toate apartin diametrului liniei pana cand incepe o linie noua cu alt "ø" sau "DN".
- Unitati: "ml" = metri liniari (element "ml"); "CT" = coturi (element "cot"); "Teu", "Teuri" = "teu"; "ROB" = robinet (element "robinet"), inclusiv "carcasa ROB" si "vana (ROB)"; "flansa" = "flansa"; "reductor" sau "reductie" = "reductie", cu diametrul MARE ("reductor 320 -> 250" are diametrul 320). Orice alta piesa = "alt".
- Un grup de linii incadrat de o acolada sau paranteza cu "x 2" (sau "× 2", "x 2 buc") alaturi: multiplicator 2 pentru FIECARE termen din grup. Altfel multiplicator 1.
- "(pret dublu)" langa un termen: pret_dublu true pentru acel termen.

REGULI:
- Un termen pentru fiecare cantitate scrisa. "6 CT + 14 ml + 10 ml" = trei termeni: 6 cot, 14 ml, 10 ml. NU aduna.
- Zecimalele cu virgula: "1,50 ml" -> 1.5.
- O cifra scrisa peste alta: ia cifra finala, cea scrisa deasupra, si pune nesigur true. La fel cand nu poti citi sigur o cifra sau o unitate.
- "text" = exact ce scrie pentru termen, de ex. "6 CT", "1 ROB (pret dublu)".
- Nu inventa termeni. Ce e taiat complet nu se transcrie.
- In "note" pui textul de pe pagina care NU e masuratoare, dar conteaza pentru oferta: "se vor calcula preturi industriale", beneficiarul, obiectivul, data. NU copia adrese de email sau numere de telefon.`;

/**
 * Modelul pentru poze, ales pe `npm run compara-poze` (29 septembrie 2026, 4
 * rulari pe 4 pagini): 39–45 de randuri exacte din 50, 32–34 din 35 pe cele
 * citite sigur; gpt-4.1, modelul importului, 28.
 *
 * Snapshot DATAT, ca la import: acelasi model azi si peste un an. `gpt-5.6-terra`
 * a iesit putin mai bine si mai stabil (42–45), dar n-are snapshot, deci
 * OpenAI il poate muta fara nicio urma in repo. Cand apare unul, se reruleaza
 * comparatia. `IZOREP_MODEL_POZE` din `.env` il schimba fara commit.
 */
export const MODEL_POZE_IMPLICIT = "gpt-5.5-2026-04-23";

export interface OptiuniPoza {
  apiKey?: string;
  model?: string;
}

/** Familia gpt-5 si modelele o* resping `temperature: 0`: accepta doar implicitul. */
const acceptaTemperatura = (model: string): boolean => !/^(gpt-5|o\d)/.test(model);

export interface RezultatPoza extends RaspunsPoza {
  model: string;
  tokeni: { intrare: number; iesire: number };
  secunde: number;
}

/** `imagine` = data URL (`data:image/jpeg;base64,...`). */
export async function citestePoza(imagine: string, optiuni: OptiuniPoza = {}): Promise<RezultatPoza> {
  const { client, model } = clientSiModel({ ...optiuni, model: optiuni.model ?? MODEL_POZE_IMPLICIT });
  const t0 = Date.now();
  const raspuns = await cuLimitaDeRata(() => client.chat.completions.create({
    model,
    ...(acceptaTemperatura(model) ? { temperature: 0 } : {}),
    messages: [
      { role: "system", content: PROMPT },
      {
        role: "user",
        content: [
          { type: "text", text: "Transcrie termenii de pe pagina asta." },
          { type: "image_url", image_url: { url: imagine, detail: "high" } },
        ],
      },
    ],
    response_format: { type: "json_schema", json_schema: JSON_SCHEMA_POZA as never },
  // O reincercare, nu patru: in comparatie o pagina blocata a tinut 20 de
  // minute. Pica de doua ori, omul vede eroarea si „Citește din nou".
  }, { timeout: 180_000, maxRetries: 1 }));

  const continut = raspuns.choices[0]?.message.content;
  if (!continut) throw new Error("model fara continut in raspuns");
  const citit = RaspunsPoza.parse(JSON.parse(continut));
  return {
    ...citit,
    model,
    tokeni: { intrare: raspuns.usage?.prompt_tokens ?? 0, iesire: raspuns.usage?.completion_tokens ?? 0 },
    secunde: (Date.now() - t0) / 1000,
  };
}
