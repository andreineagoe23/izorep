import OpenAI from "openai";
import { JSON_SCHEMA, RaspunsModel, type LinieExtrasa } from "./schema.js";

/**
 * Stratul de completare cu model, pentru liniile pe care regex-ul nu le rezolva.
 *
 * Reguli care nu se negociaza:
 *   - structured outputs, schema stricta. Modelul nu returneaza text liber.
 *   - temperature 0. Altfel acelasi import da rezultate diferite.
 *   - primeste DOAR liniile reziduale, nu tot fisierul.
 *   - NU vede si NU calculeaza preturi. Extrage parametri, atat.
 *     Tarifarea e in src/pricing/, determinista si testata.
 */
const SYSTEM_PROMPT = `Esti un asistent care extrage parametri tehnici din linii de deviz pentru lucrari de IZOLATII TERMICE, in limba romana, engleza sau germana.

Pentru fiecare linie primita, returnezi parametrii izolatiei. Reguli:

SISTEM:
- "elastomer" - cauciuc sintetic expandat: Armaflex, K-Flex, Kaiflex, "Kaelteisolierung", "Kautschuk", "cauciuc sintetic"
- "vata_minerala" - vata minerala, "Mineralwolle", Rockwool, Isolshell, saltele de vata
- "tabla" - protectie/jachetare cu tabla de aluminiu, inox sau zincata, "Blech", "jacketing"
- "pvc" - manta de PVC
- "goluri_foc" - inchideri goluri la foc, banda WRAP, coliere Promastop, clase EI30/EI60/EI120
- null - linia NU e o pozitie de izolatie: antet de sectiune, total, sau alta meserie
  (grile, difuzoare, clapete, ventilatoare, cazane, demontari, relocari)

DIAMETRU - cel mai important camp, atentie la notatie:
- "DN" - diametru nominal de teava de OTEL. Ex: "DN80", "Dn 100 (4\\")".
  Include si tolii: 1/2" = DN15, 3/4" = DN20, 1" = DN25, 1 1/4" = DN32, 2" = DN50.
- "exterior" - diametrul exterior real, in mm. Foloseste-l pentru:
  conducte de PLASTIC (PPR, PP, PEHD, PEX) unde dimensiunea nominala E diametrul
  exterior (ex: "PEHD D110x4.3" -> 110 exterior), tubulatura SPIRO, si orice "ø123".
- "interior" - notatia "Di", folosita de unii clienti.
Daca linia zice "DN20" dar contextul e teava de plastic (PPR/PP/PEHD), atunci
diametru_tip este "exterior", nu "DN".

GROSIME: grosimea stratului de izolatie in mm. Valori uzuale: elastomer 9/13/19/25/32,
vata minerala 20/30/40/50/60/80/100. NU confunda cu grosimea peretelui tevii
("PEHD D110x4.3" -> diametrul e 110, 4.3 e peretele tevii, NU grosimea izolatiei).

FORMA: "ml" pentru metru liniar, "mp" pentru metru patrat (tubulatura), sau tipul
elementului special: cot, teu, manseta, flansa, robinet, contor, filtru, pompa.
Foloseste unitatea de masura din coloana UM daca exista.

STRATURI_EXTRA: pentru pozitii compuse, straturile de PESTE primul, in ordine.
Ex: "DN80 elastomer 13mm + vata 40mm + tabla" -> sistem=elastomer, grosime=13,
straturi_extra=[{vata_minerala,40},{tabla,null}].

INCREDERE: 0..1. Pune sub 0.85 daca ghicesti orice camp. E mai bine sa trimiti
linia la validare umana decat sa nimeresti gresit.

MOTIV: o propozitie scurta in romana, ce ai dedus si de ce.

Nu inventa valori. Daca un camp nu apare in text, pune null.`;

export interface OptiuniModel {
  apiKey?: string;
  model?: string;
  /** Cate linii pe apel. Batch-uri prea mari degradeaza acuratetea. */
  dimensiuneLot?: number;
  /**
   * Cate loturi in acelasi timp. Latenta e dominata de generarea raspunsului,
   * nu de reteaua: masurat pe Oferta Matari, un lot de 25 de linii ia ~19s, iar
   * patru loturi secventiale ~80s. In paralel, aceleasi linii ies in ~20s.
   */
  concurenta?: number;
}

export async function extrageCuModel(
  linii: { index: number; text: string; um?: string }[],
  optiuni: OptiuniModel = {},
): Promise<LinieExtrasa[]> {
  if (linii.length === 0) return [];

  const apiKey = optiuni.apiKey ?? process.env["OPENAI_API_KEY"];
  if (!apiKey) throw new Error("OPENAI_API_KEY lipseste. Copiaza .env.example in .env.");

  // 90s per apel: un lot blocat nu are voie sa tina importul la nesfarsit.
  const client = new OpenAI({ apiKey, timeout: 90_000 });
  const model = optiuni.model ?? process.env["OPENAI_MODEL"] ?? "gpt-4o-2024-08-06";
  const lot = optiuni.dimensiuneLot ?? 12;
  const concurenta = Math.max(1, optiuni.concurenta ?? 4);

  const loturi: (typeof linii)[] = [];
  for (let i = 0; i < linii.length; i += lot) loturi.push(linii.slice(i, i + lot));

  async function proceseaza(bucata: typeof linii): Promise<LinieExtrasa[]> {
    const payload = bucata
      .map((l) => `[${l.index}]${l.um ? ` (UM: ${l.um})` : ""} ${l.text.replace(/\s+/g, " ").slice(0, 900)}`)
      .join("\n");

    const raspuns = await client.chat.completions.create({
      model,
      temperature: 0,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Extrage parametrii pentru fiecare linie. Returneaza cate un obiect per linie, cu acelasi index.\n\n${payload}` },
      ],
      response_format: { type: "json_schema", json_schema: JSON_SCHEMA as never },
    });

    const continut = raspuns.choices[0]?.message.content;
    if (!continut) throw new Error("model fara continut in raspuns");
    // Validarea nu e optionala: ce nu trece de schema nu ajunge in aplicatie.
    return RaspunsModel.parse(JSON.parse(continut)).linii;
  }

  // Rezultatele se aseaza pe pozitia lotului, nu in ordinea in care se intorc:
  // paralelismul nu are voie sa schimbe iesirea pentru aceeasi intrare.
  const rezultate: LinieExtrasa[][] = new Array(loturi.length);
  let urmator = 0;
  const lucrator = async (): Promise<void> => {
    for (let i = urmator++; i < loturi.length; i = urmator++) {
      rezultate[i] = await proceseaza(loturi[i]!);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurenta, loturi.length) }, lucrator));
  return rezultate.flat();
}
