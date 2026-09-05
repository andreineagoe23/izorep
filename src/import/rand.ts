/**
 * Randul, ca date: tipurile grilei si construirea unei linii de pozitie.
 *
 * Separat de `parse-workbook.ts` pentru un singur motiv, masurat: acela
 * importa `exceljs` la nivel de modul (~940 kB), iar un import de VALOARE din
 * el trage biblioteca in bundle oricat de mic ar fi ce se foloseste efectiv.
 * `editare.ts` are nevoie de `construiesteLinie` ca sa refaca o linie dupa o
 * corectie de celula, iar ecranul de import il importa pe el — deci, cu
 * functia lasata dincolo, chunk-ul ecranului ajungea la 1.035 kB si ExcelJS se
 * incarca la DESCHIDEREA ecranului, nu la primul fisier tras in el.
 *
 * Aici nu intra nimic care atinge ExcelJS. `parse-workbook.ts` re-exporta tot
 * ce e mai jos, deci apelantii vechi nu se schimba.
 */

export interface LinieBruta {
  index: number;
  foaie: string;
  rand: number;
  /** Textul concatenat al celulelor de tip text din rand. */
  text: string;
  um?: string;
  cantitate?: number;
  celule: (string | number | null)[];
}

/**
 * O celula din grila afisata 1:1. `span` e latimea imbinarii, ca ecranul sa
 * redea titlul intins peste sase coloane ca pe un singur titlu, nu ca pe
 * aceeasi valoare repetata de sase ori.
 *
 * ATENTIE: imbinarile se desfac DOAR aici. `LinieBruta.celule` pastreaza
 * valoarea repetata, pentru ca `esteAntetSectiune` recunoaste antetul de
 * sectiune exact dupa repetitia aia — desfacut acolo, extragerea inchiderilor
 * goluri la foc pierde sectiunea si, cu ea, 53 de pozitii.
 */
export interface CelulaBruta {
  v: string | number | null;
  span: number;
}

export interface RandBrut {
  /** Numarul randului din Excel, cel din gutter-ul aplicatiei. */
  rand: number;
  celule: CelulaBruta[];
  /** Pozitia extrasa din randul asta, cand randul e o pozitie. */
  linie?: LinieBruta;
}

/** O foaie din registru, asa cum se vede in Excel. */
export interface FoaieBruta {
  /** Numele foii, exact cum e scris in registru. */
  nume: string;
  /** Randul de antet, daca s-a gasit unul. Lipseste la foile fara antet. */
  antet?: RandBrut;
  /** Toate randurile care contin ceva, in ordinea din fisier, antetul inclus. */
  randuri: RandBrut[];
  /** Latimea grilei: randul cel mai lat da numarul de coloane. */
  coloane: number;
}

const UM = /^(ml|m|m²|m2|mp|buc|buc\.|pcs|stk|lm|kg|to)$/i;

/**
 * Cantitatea de pe rand.
 *
 * Euristica provizorie: cantitatea sta lipita de unitatea de masura — dupa ea
 * in listele de cantitati (Nr | Denumire | UM | Cantitate), inainte in oferte
 * (Nr | Denumire | Cant | UM | Pret). Primul numar de pe rand e aproape
 * intotdeauna numarul curent al pozitiei, nu cantitatea.
 *
 * Asta e o ghicitoare si trebuie sa ramana asa doar pana exista maparea de
 * coloane per client (L1). Odata mapata coloana, euristica nu se mai foloseste.
 */
function cantitate(celule: (string | number | null)[], iUm: number): number | undefined {
  const nr = (i: number) => (typeof celule[i] === "number" && (celule[i] as number) > 0 ? (celule[i] as number) : undefined);
  if (iUm >= 0) {
    for (let i = iUm + 1; i < celule.length; i++) { const v = nr(i); if (v !== undefined) return v; }
    for (let i = iUm - 1; i >= 0; i--) { const v = nr(i); if (v !== undefined) return v; }
    return undefined;
  }
  const numere = celule.filter((c): c is number => typeof c === "number" && c > 0);
  return numere.length > 1 ? numere[1] : numere[0];
}

/**
 * Construieste `LinieBruta` dintr-un rand brut, sau `null` daca randul nu e
 * o pozitie (fara text substantial, sau text sub pragul de 12 caractere).
 *
 * Scoasa din `extrageFoi` ca sa poata fi rechemata izolat, dupa o corectie de
 * celula facuta in ecranul de import: `editare.ts` reconstruieste o singura
 * linie din `LinieBruta.celule` deja corectat, pastrand `id` neschimbat — nu
 * se reia parsarea intregului registru si nu se aloca un index nou.
 */
export function construiesteLinie(
  brute: (string | number | null)[],
  id: { index: number; foaie: string; rand: number },
): LinieBruta | null {
  const texte = brute.filter((c): c is string => typeof c === "string" && c.trim().length > 3);
  if (texte.length === 0) return null;
  const text = texte.join(" | ").trim();
  if (text.length < 12) return null;

  const iUm = brute.findIndex((c) => typeof c === "string" && UM.test(c.trim()));
  const um = iUm >= 0 ? String(brute[iUm]).trim() : undefined;
  const q = cantitate(brute, iUm);

  return {
    index: id.index, foaie: id.foaie, rand: id.rand, text, celule: brute,
    ...(um ? { um } : {}),
    ...(q === undefined ? {} : { cantitate: q }),
  };
}

/**
 * Liniile de pozitie, in ordinea din registru. Sunt aceleasi obiecte care stau
 * si in grila: indexul se atribuie o singura data, la parcurgerea foilor, deci
 * randul din tabel si linia trimisa la model nu pot ajunge sa se refere la
 * randuri diferite.
 */
export const liniile = (foi: FoaieBruta[]): LinieBruta[] =>
  foi.flatMap((f) => f.randuri.flatMap((r) => (r.linie ? [r.linie] : [])));
