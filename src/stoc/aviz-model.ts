/**
 * Citirea avizului sau a facturii cu modelul. Doar pe server: cheia OpenAI nu
 * ajunge in pagina (`src/server/model.ts`). Ce iese trece prin `CitireAviz`,
 * apoi prin `receptieDinCitire`, si ajunge la om ca formular completat.
 */
import { clientSiModel, cuLimitaDeRata } from "../import/extract-llm.js";
import { CitireAviz, JSON_SCHEMA_AVIZ } from "./aviz.js";

const PROMPT = `Primesti un aviz de insotire a marfii sau o factura de la un furnizor de materiale de izolatii termice (cochilii, tuburi si placi de elastomer, saltele de vata minerala, tabla). Il transcrii exact, fara sa calculezi nimic.

- "tip": "aviz" pentru aviz de insotire / aviz de expeditie; "factura" pentru factura.
- "serie" si "numar": cum sunt scrise ("Seria CS nr. 20261262" -> serie "CS", numar "20261262"). Daca seria e lipita de numar ("CS 202627295"), desparte-le.
- "data": data documentului, ca YYYY-MM-DD.
- "furnizor": numele firmei care emite documentul (furnizorul), nu al cumparatorului.
- "moneda": moneda preturilor ("RON" sau "EUR"); null pe aviz fara preturi.
- "curs": cursul scris pe document (lei pentru 1 euro), altfel null.
- "transport": valoarea fara TVA a unui rand de transport, altfel null. Randul de transport NU se pune in "linii".
- "linii": fiecare rand de produs, in ordine: "cod" (codul articolului, daca exista), "denumire" exact cum e scrisa, "cantitate" (numarul, cu punct zecimal), "um" cum e scrisa (ML, MP, KG, BUC), "pret_unitar" fara TVA daca e scris, altfel null.
- Nu inventa randuri si nu aduna nimic. Nu copia adrese, telefoane, emailuri, CNP sau numere de cont.`;

const acceptaTemperatura = (model: string): boolean => !/^(gpt-5|o\d)/.test(model);

/** `fisier` = data URL: `data:image/...;base64,` sau `data:application/pdf;base64,`. */
export async function citesteAviz(
  fisier: string, optiuni: { apiKey?: string; model?: string; nume?: string } = {},
): Promise<CitireAviz & { model: string }> {
  const { client, model } = clientSiModel(optiuni);
  const continut = fisier.startsWith("data:application/pdf")
    ? { type: "file" as const, file: { filename: optiuni.nume ?? "aviz.pdf", file_data: fisier } }
    : { type: "image_url" as const, image_url: { url: fisier, detail: "high" as const } };
  const raspuns = await cuLimitaDeRata(() => client.chat.completions.create({
    model,
    ...(acceptaTemperatura(model) ? { temperature: 0 } : {}),
    messages: [
      { role: "system", content: PROMPT },
      { role: "user", content: [{ type: "text", text: "Transcrie documentul." }, continut] },
    ],
    response_format: { type: "json_schema", json_schema: JSON_SCHEMA_AVIZ as never },
  }, { timeout: 180_000, maxRetries: 1 }));
  const text = raspuns.choices[0]?.message.content;
  if (!text) throw new Error("model fara continut in raspuns");
  return { ...CitireAviz.parse(JSON.parse(text)), model };
}
