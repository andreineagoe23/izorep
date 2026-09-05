import { esteAntetSectiune, type LinieCuSectiune } from "./sectiuni.js";
import { extrageDeterminist } from "./extract-regex.js";

/**
 * Randuri de continuare: mostenesc descrierea pozitiei de deasupra.
 *
 * `Book15.xlsx` (412 randuri) scoate azi doar 5 pozitii, pentru ca fisierul
 * foloseste in masa randuri de tip "E3.1.1.2 | Same - Ø125 mm | Same - Ø125 mm":
 * cantitate si UM sunt pe rand, dar textul lui nu spune NIMIC despre sistem —
 * fraza "Same" trimite cititorul la randul de deasupra, care are descrierea
 * completa ("Circular spiro duct system... insulated with 30mm mineral wool
 * ... Diameter: Ø100 mm"). Fara legatura asta, specificatia se pierde si
 * linia iese neclasificata. Rezolva acelasi tip de problema pe care
 * `sectiuni.ts` o rezolva pentru antetele de sectiune, in acelasi stil:
 * determinist, pe semnal fizic/lexical ingust, nu semantic.
 *
 * Masurat pe cele 10 fisiere de client, cu stratul determinist (parseFoi +
 * adaugaSectiuni + aplicaContinuare + extrageDeterminist, acelasi filtru de
 * completitudine pe care il aplica pipeline-ul cu --fara-model — o linie
 * incompleta nu ajunge in raport nici cu, nici fara aceasta regula):
 *
 * | Fisier                          | Pozitii inainte -> dupa | Tarifate inainte -> dupa |
 * |----------------------------------|------------------------|--------------------------|
 * | Book15.xlsx                      | 5 -> 24                 | 1 -> 6                   |
 * | celelalte 9 fisiere               | neschimbat              | neschimbat               |
 *
 * Singurul fisier care foloseste marcajul e Book15: 90 de randuri "Same" din
 * 412. Din ele ies doar 19 pozitii noi (nu 90): restul sunt fie alta meserie
 * (clapete, grile, difuzoare — excluse de ALTE_MESERII din
 * extract-regex.ts, la fel ca inainte), fie tubulatura RECTANGULARA ("Same -
 * 600x300 mm"), pe care extrageDeterminist nu are cum s-o citeasca — n-are
 * regex de dimensiune X pe Y, doar Ø/DN/Di — deci raman incomplete si nu
 * intra in raport, exact ca azi. Pe celelalte 9 fisiere numarul de pozitii si
 * de pozitii tarifate ramane IDENTIC inainte/dupa — regula nu prinde nimic in
 * plus si nu creeaza regresii (randuri de total sau note care ar incepe sa
 * mosteneasca).
 *
 * Forme de marcaj GASITE EFECTIV in cele 10 fisiere (verificat cu un scanner
 * peste tot textul brut al randurilor): doar "Same" — de 90 de ori in
 * Book15.xlsx, in variantele "Same - X", "Same: X", "Same," si "Same" urmat
 * de spatiu direct. Niciuna din celelalte forme cerute de specificatie
 * (idem, ditto, as above, ca mai sus, -||-, ,,-,,) nu apare in datele reale;
 * raman codificate mai jos pentru robustete pe fisiere viitoare, dar
 * NEMASURATE — daca vreodata apar, testul de continuare.test.ts le acopera
 * cu date construite, nu cu fisiere reale.
 *
 * Am gasit si "idem" in Radoia.xlsx, dar NU ca marcaj de continuare: apare la
 * SFARSITUL liniei ("Dn 20 (3/4'') | CIRCUIT RACIRE / idem"), unde randul are
 * deja descrierea completa (elastomer, Dn, grosime) — "idem" se refera la
 * circuitul de racire, nu la lipsa descrierii. Ancorarea la INCEPUTUL unei
 * celule (vezi mai jos) exclude corect cazul asta.
 *
 * Am gasit si "Acelasi" (traducerea romana a lui "Same") in doua randuri din
 * Book15 (E3.1.1.45, E3.1.1.47: "Same: D630 mm | Același - D630 mm.") si in
 * alte doua unde randul NU e o continuare, ci are descriere proprie completa
 * si doar rezuma in coloana romana ("Același difuzor - 600 x 600 mm, 24
 * fante" langa un text englezesc complet, cu toate specificatiile). Din
 * cauza asta "același" NU e in lista de marcaje: ar prinde si randuri cu
 * descriere proprie reala, exact ce cere sa NU se intample regula 4 din
 * cerinta ("un rand cu sistem deja in text nu se atinge"). "Same:" din
 * coloana engleza a acelorasi randuri declanseaza deja continuarea corect.
 */

/**
 * Ancorat la INCEPUTUL UNEI CELULE, nu la inceputul absolut al lui `text`.
 * `LinieBruta.text` e mai multe celule text alaturate cu " | "
 * (parse-workbook.ts, `texte.join(" | ")`), iar in Book15 fiecare rand
 * incepe cu coloana de cod: "E3.1.1.2 | Same - Ø125 mm | Same - Ø125 mm".
 * O ancorare stricta la text[0] n-ar prinde NICIODATA marcajul, fiindca
 * el sta dupa codul pozitiei, nu la caracterul 0. Se despart celulele dupa
 * acelasi separator si se verifica fiecare segment.
 */
const RE_MARCAJ =
  /^(?:same|idem|ditto|as\s+above|ca\s+mai\s+sus)\b|^-\s*\|\|\s*-|^,,\s*-{1,2}\s*,,/i;

/** true daca randul e o continuare a pozitiei de deasupra. */
export function esteContinuare(text: string): boolean {
  return text.split(" | ").some((celula) => RE_MARCAJ.test(celula.trim()));
}

/** true daca randul are cantitate sau UM — semnalul fizic ca e o pozitie, nu o nota/total. */
const ePozitie = (l: LinieCuSectiune): boolean =>
  l.um !== undefined || l.cantitate !== undefined;

/**
 * true daca textul PROPRIU al randului (fara nimic mostenit) contine deja un
 * semnal de sistem. Refoloseste `extrageDeterminist` din extract-regex.ts —
 * e "vecinul" curat, fara dependenta circulara (extract-regex.ts nu importa
 * nimic de aici) — in loc sa duplic lista SISTEM intr-un regex separat, care
 * ar putea sa lunece fata de original. Sectiunea NU se trimite la verificarea
 * asta: intrebarea e strict despre TEXTUL PROPRIU, nu despre ce ar reusi sa
 * deduca sectiune.ts separat — cele doua mecanisme de mostenire trebuie sa
 * ramana independente.
 */
const areSemnalPropriu = (l: LinieCuSectiune): boolean =>
  extrageDeterminist(l.index, l.text, l.um, undefined, l.cantitate).linie.sistem !== null;

/**
 * Leaga randurile de continuare de descrierea pozitiei de deasupra.
 * Ruleaza DUPA `adaugaSectiuni` si INAINTE de extragere.
 *
 * Textul rezultat e TEXTUL PROPRIU + " | " + descrierea mostenita — nu
 * ordinea descrisa initial in cerinta (mostenit + propriu). Motivul e
 * masurat, nu stilistic: `extrageDeterminist` ia diametrul cu `.match()`
 * FARA flag `g`, deci intoarce primul Ø/DN/Di din text. Descrierea mostenita
 * de la Book15 rand 13 contine chiar ea un diametru propriu ("Diameter:
 * Ø100 mm") — daca ar sta prima, orice continuare ("Same - Ø125 mm") ar iesi
 * cu diametrul PARINTELUI (100), nu cu al ei (125), adica exact regresia pe
 * care cerinta o interzice explicit la cazul 1. Cu textul propriu primul,
 * Ø125 e gasit inaintea lui Ø100 si grosimea (care se ia dupa ULTIMA valoare
 * plauzibila din text, `toate.at(-1)` in extract-regex.ts) tot vine din
 * descrierea mostenita, pentru ca acum sta la coada — exact ce trebuie,
 * fiindca randul de continuare oricum nu are grosime proprie.
 */
export function aplicaContinuare(linii: LinieCuSectiune[]): LinieCuSectiune[] {
  const out: LinieCuSectiune[] = [];
  let foaie: string | undefined;
  let sectiune: string | undefined;
  let descriereParinte: string | undefined;

  for (const l of linii) {
    if (l.foaie !== foaie) { foaie = l.foaie; sectiune = undefined; descriereParinte = undefined; }
    if (l.sectiune !== sectiune) { sectiune = l.sectiune; descriereParinte = undefined; }

    // Antetul de sectiune nu e pozitie: taie mostenirea (ca la schimbarea de
    // sectiune), dar ramane in lista neschimbat, la fel ca in sectiuni.ts.
    // Verificarea pe `.sectiune` de mai sus NU ajunge singura: antetul insusi
    // are `.sectiune` nedefinit (adaugaSectiuni il impinge neschimbat), la
    // fel ca randurile de dinaintea oricarei sectiuni — deci daca nu era
    // activa nicio sectiune inainte, tranzitia nu s-ar vedea din valoarea
    // campului. Semnalul fizic al antetului insusi e cel corect.
    if (esteAntetSectiune(l)) { descriereParinte = undefined; out.push(l); continue; }

    if (
      ePozitie(l)
      && descriereParinte !== undefined
      && esteContinuare(l.text)
      && !areSemnalPropriu(l)
    ) {
      out.push({ ...l, text: `${l.text} | ${descriereParinte}` });
      continue; // nu devine parinte: o continuare nu poate fi mostenita mai departe
    }

    out.push(l);
    if (ePozitie(l) && !esteContinuare(l.text)) descriereParinte = l.text;
  }
  return out;
}
