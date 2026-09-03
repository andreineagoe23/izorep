import OpenAI from "openai";
import { JSON_SCHEMA, RaspunsModel, type LinieExtrasa } from "./schema.js";
import { aplicaValidarea } from "./valideaza.js";

/**
 * Stratul de completare cu model, pentru liniile pe care regex-ul nu le rezolva.
 *
 * Reguli care nu se negociaza:
 *   - structured outputs, schema stricta. Modelul nu returneaza text liber.
 *   - temperature 0. Altfel acelasi import da rezultate diferite.
 *   - primeste DOAR liniile reziduale, nu tot fisierul.
 *   - NU vede si NU calculeaza preturi. Extrage parametri, atat.
 *     Tarifarea e in src/pricing/, determinista si testata.
 *   - ce iese trece prin `aplicaValidarea` INAINTE sa plece de aici. Locul e
 *     ales: e singurul punct prin care trec toate caile — CLI, ruta din vite,
 *     scriptul de comparare — deci nu poate fi sarit dintr-un apelant nou.
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

GOL_LATIME_MM / GOL_INALTIME_MM: doar la sistem="goluri_foc". Dimensiunile golului
taiat in perete, scrise "130/130", "1400/600" intr-o coloana "dimensiune gol".
Acolo pretul vine din SUPRAFATA golului, nu din diametrul conductei, deci fara
ele linia nu se poate tarifa. La orice alt sistem, null.

STRATURI_EXTRA: pentru pozitii compuse, straturile de PESTE primul, in ordine.
Ex: "DN80 elastomer 13mm + vata 40mm + tabla" -> sistem=elastomer, grosime=13,
straturi_extra=[{vata_minerala,40},{tabla,null}].

INCREDERE: 0..1. Pune sub 0.85 daca ghicesti orice camp. E mai bine sa trimiti
linia la validare umana decat sa nimeresti gresit.

MOTIV: o propozitie scurta in romana, ce ai dedus si de ce.

Nu inventa valori. Daca un camp nu apare in text, pune null.`;

/**
 * Snapshot DATAT, nu aliasul `gpt-4.1`.
 *
 * Aliasul e mutat de OpenAI pe alt snapshot fara sa se schimbe nimic in repo:
 * acelasi fisier, acelasi cod, alt rezultat, si nicio urma in `git log`. La un
 * import care produce oferte trimise clientilor, aia e o schimbare de pret
 * fara autor. Snapshot-ul se schimba printr-un commit, dupa `npm run compara`.
 */
export const MODEL_IMPLICIT = "gpt-4.1-2025-04-14";

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

/** Numar din mediu, cu implicit. Valorile aiurea sunt ignorate, nu explodeaza. */
function nrDinMediu(cheie: string, implicit: number): number {
  const v = Number(process.env[cheie]);
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : implicit;
}

/**
 * Limita de rata a contului OpenAI, atinsa dupa reincercari.
 *
 * Merita tip propriu: nu e o eroare de extragere, e o problema de debit. Se
 * rezolva cu IZOREP_CONCURENTA=1, cu un lot mai mic, sau asteptand — nu
 * schimband nimic la prompt sau la fisier.
 */
export class LimitaDeRata extends Error {
  constructor(readonly cauza: string) {
    super(
      `limita de rata OpenAI atinsa: ${cauza}. ` +
      `Daca e limita pe MINUT (TPM/RPM): IZOREP_CONCURENTA=1. ` +
      `Daca e cea pe ZI (TPD): IZOREP_LOT mai MARE, un model cu plafon mai mare, ` +
      `sau --fara-model.`,
    );
    this.name = "LimitaDeRata";
  }
}

/**
 * Clientul si modelul, dintr-un singur loc.
 *
 * Exista ca sa nu se configureze de doua ori: maparea de coloane (L1) foloseste
 * acelasi cont, acelasi snapshot si aceleasi reincercari ca extragerea. Doua
 * configurari separate ar insemna ca o schimbare de model se aplica pe jumatate.
 */
export function clientSiModel(optiuni: OptiuniModel = {}): { client: OpenAI; model: string } {
  const apiKey = optiuni.apiKey ?? process.env["OPENAI_API_KEY"];
  if (!apiKey) throw new Error("OPENAI_API_KEY lipseste. Copiaza .env.example in .env.");
  return {
    // 90s per apel: un lot blocat nu are voie sa tina importul la nesfarsit.
    //
    // maxRetries e EXPLICIT, nu lasat pe implicitul SDK-ului: la 429 clientul
    // reincearca cu backoff in loc sa piarda lotul.
    client: new OpenAI({ apiKey, timeout: 90_000, maxRetries: 4 }),
    model: optiuni.model ?? process.env["OPENAI_MODEL"] ?? MODEL_IMPLICIT,
  };
}

/** Traduce 429-ul in ceva ce spune ce ai de facut. */
export async function cuLimitaDeRata<T>(f: () => Promise<T>): Promise<T> {
  try {
    return await f();
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    if (/429|rate limit|quota/i.test(m)) throw new LimitaDeRata(m.slice(0, 200));
    throw e;
  }
}

export async function extrageCuModel(
  linii: { index: number; text: string; um?: string }[],
  optiuni: OptiuniModel = {},
): Promise<LinieExtrasa[]> {
  if (linii.length === 0) return [];

  const { client, model } = clientSiModel(optiuni);
  // gpt-4.1, nu gpt-4o. Pe contul firmei gpt-4o are 90.000 de tokeni pe zi,
  // adica doua fisiere ca Radoia.xlsx; gpt-4.1 are 900.000, la aceeasi limita
  // pe minut. Masurat pe doua fisiere reale, nicio diferenta de calitate.
  //
  // Familia gpt-5 are plafoane si mai mari, dar RESPINGE temperature 0 —
  // accepta doar 1 — iar regula "temperature 0, altfel acelasi import da
  // rezultate diferite" nu e negociabila aici. In plus arde tokeni de
  // rationament: pentru un raspuns de 6 tokeni, gpt-5-nano a consumat 338.
  //
  // gpt-4.1-mini are 2.000.000 pe zi si a dat 91% acord pe un fisier, dar pe
  // altul a citit "Di60" ca 76 — diametru gresit inseamna rand gresit in
  // matrice, deci pret gresit. Se poate trece pe el, dar dupa ce
  // `npm run compara` da zero diferente cu impact pe mai multe fisiere.
  //
  // Lotul implicit e 25, nu 12, si motivul e bugetul de tokeni pe ZI.
  //
  // Fiecare apel cara ~1.177 tokeni ficsi — system prompt (~735) plus schema
  // (~442) — retrimisi integral. Pe Radoia.xlsx pleaca 153 de linii la model:
  // in loturi de 12 sunt 13 apeluri, deci 15.300 de tokeni doar overhead; in
  // loturi de 25 sunt 7 apeluri si 8.200. La un plafon de 90.000 tokeni pe zi,
  // diferenta e intre doua fisiere pe zi si trei.
  //
  // Un lot mai MIC ajuta la limita pe minut, dar inrautateste pe cea pe zi.
  // Sunt doua limite diferite si se rezolva in directii opuse.
  const lot = optiuni.dimensiuneLot ?? nrDinMediu("IZOREP_LOT", 25);
  // Prima manevra cand dai de rate limit: IZOREP_CONCURENTA=1.
  const concurenta = Math.max(1, optiuni.concurenta ?? nrDinMediu("IZOREP_CONCURENTA", 4));

  const loturi: (typeof linii)[] = [];
  for (let i = 0; i < linii.length; i += lot) loturi.push(linii.slice(i, i + lot));

  async function proceseaza(bucata: typeof linii): Promise<LinieExtrasa[]> {
    const payload = bucata
      .map((l) => `[${l.index}]${l.um ? ` (UM: ${l.um})` : ""} ${l.text.replace(/\s+/g, " ").slice(0, 900)}`)
      .join("\n");

    const raspuns = await cuLimitaDeRata(() => client.chat.completions.create({
      model,
      temperature: 0,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Extrage parametrii pentru fiecare linie. Returneaza cate un obiect per linie, cu acelasi index.\n\n${payload}` },
      ],
      response_format: { type: "json_schema", json_schema: JSON_SCHEMA as never },
    }));

    const continut = raspuns.choices[0]?.message.content;
    if (!continut) throw new Error("model fara continut in raspuns");
    // Doua validari, nu una. Zod verifica forma raspunsului; `aplicaValidarea`
    // verifica sensul lui fata de textul sursa — numere inventate, DN care nu
    // exista, grosimi pe care firma nu le oferteaza. Vezi valideaza.ts.
    const linii = RaspunsModel.parse(JSON.parse(continut)).linii;
    return aplicaValidarea(linii, new Map(bucata.map((l) => [l.index, l])));
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
