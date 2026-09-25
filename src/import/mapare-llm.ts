import { clientSiModel, cuLimitaDeRata, type OptiuniModel } from "./extract-llm.js";
import { blocAntet, JSON_SCHEMA_MAPARE, MapareFoaie, valideazaMapare } from "./mapare.js";
import type { FoaieBruta } from "./parse-workbook.js";

/**
 * L1, partea care intreaba modelul: ce rol are fiecare coloana a unei foi.
 *
 * Un apel per LAYOUT, nu per foaie si nici pe departe per linie. `cerere-de-oferta-spital.xlsx`
 * are sapte foi cu acelasi antet: un apel. Intrarea e blocul de la inceputul
 * foii, cateva randuri, nu fisierul.
 *
 * Modelul propune; `valideazaMapare` decide. O mapare respinsa nu se
 * corecteaza si nu se reincearca la nesfarsit — se cade pe euristica de azi si
 * foaia se marcheaza, exact ca o linie care nu se poate tarifa.
 */
const SYSTEM_PROMPT = `Primesti primele randuri ale unei foi de calcul dintr-o lista de cantitati pentru lucrari de izolatii termice. Fiecare rand e prefixat cu indexul lui, [0], [1], [2]...

Spui trei lucruri:

rand_antet - indexul randului care contine CAPETELE DE COLOANA (etichete ca "Nr. crt.", "Denumire articol", "UM", "Cantitate"). null daca foaia nu are asa ceva si datele incep direct.

rand_start - indexul primului rand de DATE. De obicei rand_antet + 1, dar pot fi randuri goale, de titlu sau de subtitlu intre ele.

roluri - cate un rol pentru fiecare coloana, in ordinea coloanelor, incepand cu prima. Roluri valabile:
- "nr" - numarul curent al pozitiei (Nr., Nr. crt., Numar curent, No., Item)
- "denumire" - descrierea articolului. E coloana cea mai lunga ca text.
- "denumire_alt" - a DOUA coloana de descriere, cand acelasi articol e descris
  de doua ori in limbi diferite (engleza si romana, germana si romana). Nu e
  observatie: contine specificatia, uneori singura in care apare materialul.
- "um" - unitatea de masura (ml, m, mp, buc, kg)
- "cantitate" - cantitatea care se ofertreaza
- "cantitate_unitara" - cantitatea PE UNITATE, cand exista si un numar de unitati
- "nr_unitati" - numarul de unitati (apartamente, camere) cu care se inmulteste
- "pret_unitar" - pretul pe unitate
- "pret_total" - pretul total pe linie
- "dimensiune" - o dimensiune separata de denumire (diametru, dimensiune gol)
- "observatii" - note, referinte de document, producator recomandat
- "ignora" - coloana goala sau fara legatura

Atentie: multe fisiere au "Cantitate / unitate", "Nr. unitati" si "Cantitate TOTAL" ca trei coloane diferite. Acolo "cantitate" e coloana TOTAL.

Un antet poate fi in romana, engleza sau germana. Daca nu esti sigur ca un rand e antet, pune null si alege rand_start dupa unde incep datele.

motiv - o propozitie scurta, in romana.`;

export interface RezultatMapare {
  mapare: MapareFoaie;
  /** Ce n-a trecut de validarea determinista. Gol = maparea se poate folosi. */
  avertismente: ReturnType<typeof valideazaMapare>;
}

export async function mapeazaFoaie(
  foaie: FoaieBruta,
  optiuni: OptiuniModel = {},
): Promise<RezultatMapare> {
  const { client, model } = clientSiModel(optiuni);

  const raspuns = await cuLimitaDeRata(() => client.chat.completions.create({
    model,
    temperature: 0,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Foaia "${foaie.nume}", ${foaie.coloane} coloane.\n\n${blocAntet(foaie)}`,
      },
    ],
    response_format: { type: "json_schema", json_schema: JSON_SCHEMA_MAPARE as never },
  }));

  const continut = raspuns.choices[0]?.message.content;
  if (!continut) throw new Error("model fara continut in raspunsul de mapare");
  const mapare = MapareFoaie.parse(JSON.parse(continut));
  return { mapare, avertismente: valideazaMapare(foaie, mapare) };
}
