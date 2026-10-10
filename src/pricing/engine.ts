import { toOuterDiameter, peSeriaDeOtel, type TipDiametru } from "./dn-table.js";
import {
  DESTINATII, diametre, diametreDin, grosimiLaDin, listaDe, listaPe,
  type BandaMultiplicator, type Destinatie, type ListaPreturi,
  LISTA_UNICA,
} from "./lists.js";
import {
  PozitieNetarifata,
  type CerereTarifare, type Forma, type MotivVerificare, type RezultatTarifare,
  type SistemMatrice, type Strat, type StratMatrice, type StratTarifat,
} from "./types.js";

/** Rotunjire comerciala la 2 zecimale. Se aplica PE FIECARE STRAT, nu la final. */
export const bani = (x: number): number => Math.round((x + Number.EPSILON) * 100) / 100;

/**
 * Toleranta la capatul listei. Randurile listei sunt seria de teava rotunjita
 * la milimetru intreg, deci eroarea maxima introdusa de rotunjire e 0,5 mm —
 * peste atat nu mai e o chestiune de rotunjire, e pur si simplu alt diametru
 * care nu e in lista. DN200 (od 219,1) cade la 0,1 mm peste ultimul rand al
 * elastomerului (219): fara toleranta asta, o pozitie perfect tarifabila
 * arunca "diametru peste maximul listei". DN250 (od 273, la 54 mm peste
 * acelasi 219) trebuie sa ramana refuzat — 54 nu e eroare de rotunjire.
 */
export const TOLERANTA_CAPAT_LISTA = 0.5;

/**
 * Cel mai apropiat rand din lista. La egalitate se alege randul MAI MARE.
 *
 * Regula de departajare nu e arbitrara: la un diametru geometric exact la
 * mijloc intre doua randuri, jacheta trebuie sa incapa peste izolatie, deci
 * randul superior e singurul fizic posibil. Vezi tests/pricing.test.ts,
 * cazul DN80 compus, unde ø195 caz la egalitate intre 190 si 200.
 */
export function randCelMaiApropiat(valoare: number, randuri: number[]): number {
  if (randuri.length === 0) throw new PozitieNetarifata("lista_goala", "lista de preturi e goala", { valoare });
  const max = randuri[randuri.length - 1]!;
  if (valoare > max) {
    if (valoare - max <= TOLERANTA_CAPAT_LISTA) return max;
    // Peste ultimul rand nu se extrapoleaza. Ofertele reale contin pozitii la
    // ø250 si ø315 pentru elastomer, unde lista se opreste la ø219: acolo
    // pretul a fost stabilit manual, in afara listei. Motorul le semnaleaza.
    throw new PozitieNetarifata("peste_maximul_listei", "diametru peste maximul listei de preturi", { valoare, max });
  }
  let best = randuri[0]!;
  let bestD = Math.abs(best - valoare);
  for (const r of randuri.slice(1)) {
    const d = Math.abs(r - valoare);
    if (d < bestD || (d === bestD && r > best)) { best = r; bestD = d; }
  }
  return best;
}

/**
 * Randul pentru stratul care sta DIRECT pe teava.
 *
 * Regula difera dupa cum diametrul a fost dat ca DN sau ca diametru exterior,
 * si e dedusa empiric din oferta 118 (61 pozitii tarifate):
 *
 *  - tip "DN": randurile listei SUNT seria standard de teava de otel
 *    (21,3 -> 22 · 42,4 -> 42 · 88,9 -> 89 · 168,3 -> 169), deci se cauta
 *    randul cel mai apropiat.
 *  - tip "interior" pe seria de otel (peSeriaDeOtel): clientii scriu des
 *    seria de otel rotunjita cu notatia "interior" (Di21, Di49, Di169...,
 *    vezi Oferta 284) — e regula de SERIE, nu de notatie, deci se aplica
 *    acelasi "cel mai apropiat rand" ca la DN.
 *  - tip "exterior" (plastic, PEHD, tubulatura), sau "interior" care NU e pe
 *    seria de otel: se rotunjeste IN SUS. Mufa de izolatie trebuie sa incapa
 *    peste teava, deci un rand sub diametrul real nu e o optiune fizica.
 *    Reproduce 12 din 13 pozitii de plastic din oferta 118; abaterea ramasa
 *    (ø90 tarifat pe randul 89) e documentata in tests/pricing.test.ts, iar
 *    pozitiile care cad in situatia ei se marcheaza — vezi
 *    `randInferiorNeconfirmat`.
 */
export function randPentruTeava(valoare: number, randuri: number[], tip: TipDiametru): number {
  if (tip === "DN" || (tip === "interior" && peSeriaDeOtel(valoare))) {
    return randCelMaiApropiat(valoare, randuri);
  }
  const max = randuri[randuri.length - 1]!;
  if (valoare > max) {
    if (valoare - max <= TOLERANTA_CAPAT_LISTA) return max;
    throw new PozitieNetarifata("peste_maximul_listei", "diametru peste maximul listei de preturi", { valoare, max });
  }
  return randuri.find((r) => r >= valoare) ?? max;
}

/**
 * Cat de aproape trebuie sa fie randul de DEDESUBT ca rotunjirea in sus a
 * primului strat sa nu mai fie sigura.
 *
 * Masurat pe ofertele semnate: ø90 (la 1 mm peste randul 89) si ø160 (la 1 mm
 * peste 159) sunt singurele diametre de plastic/tubulatura tarifate cand pe
 * randul de sus, cand pe cel de jos — ø160 chiar in aceeasi oferta, 14,37 ca
 * teava PEHD si 14,16 ca SPIRO. La 2 mm (PPR 20 peste randul 18) nu exista
 * nicio oferta care sa fi coborat. Intrebarea 3 catre firma.
 */
export const PRAG_ROTUNJIRE_NECONFIRMATA = 1;

/**
 * Randul de dedesubt, cand primul strat a fost rotunjit IN SUS peste un rand
 * aflat la cel mult `PRAG_ROTUNJIRE_NECONFIRMATA` mm sub diametru; altfel
 * `null`.
 *
 * Nu schimba randul ales si nu schimba pretul: regula in sus ramane cea care
 * reproduce 12 din 13 pozitii de plastic. Spune doar ca aici exista a doua
 * varianta, folosita si ea de firma, ca pozitia sa treaca pe la om in loc sa
 * plece tacut cu una dintre ele.
 */
export function randInferiorNeconfirmat(
  valoare: number, rand: number, randuri: number[], tip: TipDiametru,
): number | null {
  if (tip === "DN" || (tip === "interior" && peSeriaDeOtel(valoare))) return null;
  if (rand <= valoare) return null;
  const jos = randuri.filter((r) => r < valoare).at(-1);
  return jos !== undefined && valoare - jos <= PRAG_ROTUNJIRE_NECONFIRMATA ? jos : null;
}

/**
 * Randul pentru JACHETA — stratul de tabla (tabla sau tabla_inox) care
 * imbraca izolatia.
 *
 * Rotunjire IN SUS, cu aceeasi toleranta de capat de lista ca restul
 * functiilor de rand. Motivul NU e cel de la `randPentruTeava` (notatia
 * diametrului): aici e fizica jachetei — mufa ei trebuie sa incapa PESTE
 * izolatie, deci un rand sub diametrul geometric nu e o optiune, indiferent
 * cum a fost scris diametrul initial.
 *
 * Se recunoaste dupa MATERIAL, nu dupa pozitie in lista de straturi. Jacheta
 * de tabla se croieste pe santier la masura imediat superioara; mansoanele de
 * izolatie (elastomer, vata) vin in diametre de alezaj FIXE si se alege cel
 * mai apropiat, indiferent daca stau la mijlocul sau la capatul pozitiei. Un
 * predicat legat de pozitie ("e ultimul strat") s-ar rupe la prima pozitie cu
 * alta ordine de straturi; legat de material, nu se rupe niciodata.
 *
 * Dovedit pe Oferta 284 (Transavia, 30 de linii vata+tabla): primul strat pe
 * randul cel mai apropiat SI jacheta rotunjita in sus da 18/20 potriviri
 * exacte (dintre cele 20 de pozitii pe care motorul le tarifeaza), fata de
 * 12/20 pentru rotunjirea in sus aplicata azi si pe primul strat. Straturile
 * de alt material din mijlocul unei pozitii cu 3+ straturi (ex. vata intre
 * elastomer si tabla la DN80 compus) raman pe `randCelMaiApropiat`, chiar
 * daca nu sunt ultimul strat — verificat in tests/pricing.test.ts si in
 * tests/reguli-rand.test.ts.
 */
export function randPentruJacheta(valoare: number, randuri: number[]): number {
  const max = randuri[randuri.length - 1]!;
  if (valoare > max) {
    if (valoare - max <= TOLERANTA_CAPAT_LISTA) return max;
    throw new PozitieNetarifata("peste_maximul_listei", "diametru peste maximul listei de preturi", { valoare, max });
  }
  return randuri.find((r) => r >= valoare) ?? max;
}

/**
 * Grosimea jachetei cand clientul n-o scrie, iar lista are mai multe pe rand.
 *
 * Inox 0,4 mm: raspunsul firmei la intalnirea din 5 octombrie 2026 („se merge
 * pe 0,4"); deblocheaza toate cele 72 de pozitii din Transavia inox. Aluminiu
 * 0,8 mm: raspunsul „7. la 0,8" de pe aceeasi foaie, si singura grosime de
 * aluminiu cu pret pe mp in lista rezidentiala (39 din 63 de randuri au doar
 * 0,8). Clientii nu scriu niciodata grosimea jachetei.
 */
export const GROSIME_JACHETA_IMPLICITA: Partial<Record<SistemMatrice, number>> = {
  tabla: 0.8,
  tabla_inox: 0.4,
};

/**
 * Grosimea uzuala a jachetei, sau cea mai apropiata de ea dintre `disp` (la
 * egalitate, cea mai groasa). `null` pentru izolatii: acolo grosimea e a
 * clientului sau a tabelului de grosimi uzuale, nu a jachetei.
 */
function grosimeJacheta(
  sistem: SistemMatrice, disp: number[],
): { grosime: number; exacta: boolean } | null {
  const uzuala = GROSIME_JACHETA_IMPLICITA[sistem];
  if (uzuala === undefined || disp.length === 0) return null;
  if (disp.includes(uzuala)) return { grosime: uzuala, exacta: true };
  const aproape = [...disp].sort((a, b) => Math.abs(a - uzuala) - Math.abs(b - uzuala) || b - a)[0]!;
  return { grosime: aproape, exacta: false };
}

/**
 * Grosimea de jacheta CERUTA care nu e in lista: cea mai mica din lista care o
 * acopera, altfel cea mai groasa. Spitalul cere „tabla zincata cu grosimea de
 * min 0,5 mm": aluminiul are 0,6 / 0,8 / 1,0, deci 0,6.
 */
function jachetaCareAcopera(ceruta: number, disp: number[]): number {
  const sortate = [...disp].sort((a, b) => a - b);
  return sortate.find((g) => g >= ceruta) ?? sortate.at(-1)!;
}

const esteJachetaCuGrosime = (sistem: SistemMatrice): boolean => GROSIME_JACHETA_IMPLICITA[sistem] !== undefined;

function grosimeEfectiva(
  sistem: SistemMatrice, rand: number, ceruta: number | undefined, l: ListaPreturi,
): { grosime: number | null; jacheta?: { grosime: number; exacta: boolean }; acoperita?: number } {
  if (sistem === "pvc") return { grosime: null };  // PVC nu are coloana de grosime
  if (ceruta !== undefined) {
    const disp = grosimiLaDin(l, rand);
    if (esteJachetaCuGrosime(sistem) && disp.length > 0 && !disp.includes(ceruta)) {
      return { grosime: jachetaCareAcopera(ceruta, disp), acoperita: ceruta };
    }
    return { grosime: ceruta };
  }
  const disp = grosimiLaDin(l, rand);
  // Tabla de jachetare are o singura grosime ofertata per diametru: e implicita.
  if (disp.length === 1) return { grosime: disp[0]! };
  const jacheta = grosimeJacheta(sistem, disp);
  if (jacheta) return { grosime: jacheta.grosime, jacheta };
  throw new PozitieNetarifata("grosime_ambigua", "grosime nespecificata si ambigua", { sistem, rand, disponibile: disp });
}

/** Nota pentru grosimea de jacheta aleasa de noi, nu scrisa de client. */
function notaJacheta(sistem: string, j: { grosime: number; exacta: boolean }): string {
  const uzuala = GROSIME_JACHETA_IMPLICITA[sistem as SistemMatrice];
  return j.exacta
    ? `${sistem}: grosime ${j.grosime} mm, grosimea uzuala a firmei (clientul n-a scris-o)`
    : `${sistem}: grosimea uzuala ${uzuala} mm nu e in lista pe randul asta; s-a luat ${j.grosime} mm, cea mai apropiata`;
}

/**
 * Pretul pe mp al unui strat, cu cele doua plase pe care le cer cererile reale:
 *
 * 1. Grosimea are pret pe mp doar in lista celuilalt segment. Tabla de 0,6 mm
 *    are pret pe mp doar in lista industriala (45,00 €), iar 0,8 mm e IDENTIC in
 *    ambele (59,5125), deci preturile pe mp ale tablei nu depind de segment.
 *    Spitalul cere tabla zincata de 0,6 mm pe ~7.300 mp de tubulatura.
 * 2. Grosimea trece de ultima coloana (elastomer 40 mm, spitalul; lista se
 *    opreste la 32): extrapolare liniara din ultimele doua grosimi. Marcata.
 */
function pretPeMp(
  sistem: SistemMatrice, grosime: number, l: ListaPreturi, dest: Destinatie,
): { pret: number; nota?: string; motiv?: MotivVerificare } | undefined {
  const p = l.per_mp[String(grosime)];
  if (p !== undefined) return { pret: p };
  for (const d of DESTINATII) {
    if (d === dest) continue;
    const alta = listaPe(sistem, d)?.per_mp[String(grosime)];
    if (alta !== undefined) {
      return {
        // La tabla preturile pe mp nu depind de segment (0,8 e identic); la
        // izolatii industrialul e ×1,20–1,25, deci acolo ramane de verificat.
        pret: alta, motiv: sistem === "tabla" ? "mp_din_celalalt_segment" : "segment_diferit",
        nota: `${sistem} ${grosime} mm: pret pe mp din lista ${ADJECTIV_DEST[d].toUpperCase()}; lista ${ADJECTIV_DEST[dest]} ` +
          `n-are grosimea asta pe mp`,
      };
    }
  }
  if (esteJachetaCuGrosime(sistem)) {
    const toate = new Map<number, number>();
    for (const d of DESTINATII) {
      for (const [k, v] of Object.entries(listaPe(sistem, d)?.per_mp ?? {})) {
        if (d === dest || !toate.has(Number(k))) toate.set(Number(k), v);
      }
    }
    if (toate.size > 0) {
      const g = jachetaCareAcopera(grosime, [...toate.keys()]);
      return {
        pret: toate.get(g)!, motiv: "grosime_apropiata",
        nota: `${sistem} ${grosime} mm nu are pret pe mp; s-a luat ${g} mm, cea mai subtire care o acopera`,
      };
    }
  }
  const grosimi = Object.keys(l.per_mp).map(Number).sort((a, b) => a - b);
  const [g1, g2] = grosimi.slice(-2);
  if (g1 !== undefined && g2 !== undefined && grosime > g2) {
    const p1 = l.per_mp[String(g1)]!;
    const p2 = l.per_mp[String(g2)]!;
    const pret = p2 + (p2 - p1) / (g2 - g1) * (grosime - g2);
    return {
      pret, motiv: "grosime_extrapolata",
      nota: `${sistem} ${grosime} mm trece de ultima grosime din lista (${g2} mm): pret pe mp extrapolat din ` +
        `${g1} si ${g2} mm, ${bani(pret)} €`,
    };
  }
  return undefined;
}

/**
 * Celula lipsa din lista INDUSTRIALA, cand rezidentialul o are: pretul
 * rezidential × raportul median dintre cele doua liste, pe aceeasi grosime.
 *
 * Industrialul nu e un coeficient fix peste rezidential, dar pe o coloana de
 * grosime raportul e stabil: vata e ×1,25 pe 90 din 97 de celule comune,
 * elastomerul ×1,25 la 9/13/19 mm si ×1,20 la 25/32 mm.
 */
function celulaDinRezidential(
  sistem: SistemMatrice, rand: number, grosime: number, dest: Destinatie,
): { pret: number; raport: number } | null {
  if (dest === "rezidential") return null;
  const rez = listaPe(sistem, "rezidential");
  const ceruta = listaPe(sistem, dest);
  const p = rez?.cells[`${rand}|${grosime}`];
  if (!rez || !ceruta || p === undefined) return null;
  const rapoarte = Object.keys(ceruta.cells)
    .filter((k) => k.endsWith(`|${grosime}`) && rez.cells[k])
    .map((k) => ceruta.cells[k]! / rez.cells[k]!)
    .sort((a, b) => a - b);
  if (rapoarte.length === 0) return null;
  const raport = rapoarte[Math.floor(rapoarte.length / 2)]!;
  return { pret: p * raport, raport };
}

function cauta(sistem: SistemMatrice, rand: number, grosime: number | null, l: ListaPreturi): number {
  const cheie = `${rand}|${grosime === null ? "-" : grosime}`;
  const p = l.cells[cheie];
  if (p === undefined) {
    // Principiu: golul din matrice inseamna "nu se oferteaza", nu "pret zero".
    throw new PozitieNetarifata("grosime_inexistenta", "combinatia diametru/grosime nu exista in lista", {
      sistem, rand, grosime, cheie,
    });
  }
  return p;
}

/**
 * Pretul unei celule care LIPSESTE din lista, dedus din randul urmator care are
 * grosimea, prin proportia dintre cele doua randuri la grosimea de dedesubt:
 *
 *   p(rand, g) = p(sus, g) × p(rand, g0) / p(sus, g0)
 *
 * Din Oferta 284 (TRANSAVIA, semnata): vata 40 mm pe randul 22 nu exista in
 * lista (nici in fisierul original al firmei), dar oferta o tarifeaza — 25,68 €
 * pe ml si 47,41 € caseta DN15. Ambele pozitii dau aceeasi valoare de vata,
 * 7,90 €, si exact asta iese aici: 7,9522 × 6,8157 / 6,8569 = 7,904. Sunt 13
 * pozitii, dar O SINGURA valoare, deci regula nu e confirmata: pretul iese cu
 * nota de verificat, iar golul ramane „nu se oferteaza" pana il confirma omul.
 *
 * Doar din randul IMEDIAT de deasupra, si doar cand ambele randuri au o
 * grosime mai mica in comun. Altfel `null`, iar pozitia ramane netarifata.
 */
function celulaDedusa(
  rand: number, grosime: number, l: ListaPreturi,
): { pret: number; sus: number; g0: number } | null {
  // Doar randul IMEDIAT urmator: 22 → 28 e dovedit; peste mai multe randuri ar
  // fi extrapolare, iar golul chiar poate insemna „nu se executa".
  const sus = diametreDin(l).find((r) => r > rand);
  if (sus === undefined || l.cells[`${sus}|${grosime}`] === undefined) return null;
  const g0 = [...l.grosimi_mm].filter((g) => g < grosime).reverse()
    .find((g) => l.cells[`${rand}|${g}`] !== undefined && l.cells[`${sus}|${g}`] !== undefined);
  if (g0 === undefined) return null;
  const pret = l.cells[`${sus}|${grosime}`]! * l.cells[`${rand}|${g0}`]! / l.cells[`${sus}|${g0}`]!;
  return { pret, sus, g0 };
}

/**
 * Verifica ca grosimea CERUTA a unui strat e una dintre grosimile pe care
 * sistemul chiar le ofertaza (`lista(sistem).grosimi_mm`) — indiferent daca
 * stratul ajunge sau nu INCLUS in pret.
 *
 * Distinctia care conteaza: un strat exclus din pret (fara coeficient de
 * forma pe banda lui, ex. vata cot/teu pe 18-60) nu are nevoie de celula
 * `rand|grosime` in matrice — aia e informatie de TARIFARE, si tocmai am
 * decis sa nu-l tarifam. Dar grosimea lui intra in geometria straturilor de
 * deasupra (`geometric = rand + 2 x grosime`), deci trebuie sa fie o grosime
 * REALA, pe care sistemul o ofertaza — aia e informatie FIZICA, independenta
 * de cum se tarifeaza pozitia.
 *
 * Exemplu real: Di60 g48 cot (Izolatii Transavia, linia 27) — 48 mm NU e o
 * grosime pe care vata minerala se ofertaza (lista: 20,30,40,50,60,80,100).
 * Vata e exclusa din pret pe banda 18-60, dar fara verificarea asta, lipsa ei
 * din cautarea de pret lasa g48 sa treaca netulburat, iar geometria straturilor
 * de deasupra (deci pretul jachetei) s-ar calcula pe o grosime care nu exista.
 * Contrastul care arata ca verificarea trebuie sa fie tocmai asta, nu "orice
 * grosime ceruta": Di21 g40 cot (Oferta 284) are 40 mm valid pentru vata
 * (e in grosimi_mm), dar celula "22|40" nu exista in matrice — acolo vata
 * exclusa se tarifeaza normal, doar cu tabla, la 17,78 EUR.
 *
 * Se aplica DOAR cand grosimea a fost ceruta explicit SI sistemul chiar are
 * o lista de grosimi nevida — la fel ca verificarea `grosime_in_afara_listei`
 * din src/import/valideaza.ts, ca sa nu se contrazica cu ea. PVC n-are
 * coloana de grosime (`grosimi_mm` gol) si tabla, cand grosimea nu e
 * specificata, n-are ce sa verifice — grosimea ei se deduce din randul deja
 * gasit (`grosimeEfectiva`), nu vine de la client.
 */
function verificaGrosimeOfertata(
  sistem: SistemMatrice, grosimeCeruta: number | undefined, l: ListaPreturi,
): void {
  if (grosimeCeruta === undefined || esteJachetaCuGrosime(sistem)) return;
  const disponibile = l.grosimi_mm;
  if (disponibile.length > 0 && !disponibile.includes(grosimeCeruta)) {
    throw new PozitieNetarifata("grosime_inexistenta", "combinatia diametru/grosime nu exista in lista", {
      sistem, grosime: grosimeCeruta, disponibile,
    });
  }
}

const CAMP_MULTIPLICATOR: Record<Forma, (keyof BandaMultiplicator)[]> = {
  ml: ["ml"], mp: ["ml"],
  manseta: ["manseta"],
  cot: ["cot_teu_reductie"], teu: ["cot_teu_reductie"], reductie: ["cot_teu_reductie"],
  robinet: ["robinet_vana_flansa_contor", "flansa_robinet_contor_distribuitor"],
  vana: ["robinet_vana_flansa_contor", "flansa_robinet_contor_distribuitor"],
  flansa: ["robinet_vana_flansa_contor", "flansa_robinet_contor_distribuitor"],
  contor: ["robinet_vana_flansa_contor", "flansa_robinet_contor_distribuitor"],
  compensator: ["robinet_vana_flansa_contor", "flansa_robinet_contor_distribuitor"],
  pompa: ["pompa_filtru_distribuitor", "pompa_filtru_vana23"],
  filtru: ["pompa_filtru_distribuitor", "pompa_filtru_vana23"],
  distribuitor: ["pompa_filtru_distribuitor", "flansa_robinet_contor_distribuitor"],
  schimbator: ["pompa_filtru_distribuitor", "pompa_filtru_vana23"],
};

/**
 * Multiplicatorul pentru elemente speciale, sau `null` cand nu exista unul
 * definit — fie diametrul nu cade in nicio banda, fie banda n-are coeficient
 * pentru forma asta (ex: vata cot/teu pe banda 18-60, campul e `null` in
 * lista de preturi).
 *
 * NU arunca: e folosita de `tarifeaza` ca sa decida, STRAT CU STRAT, daca un
 * strat intra in pret sau contribuie doar cu geometria lui. `multiplicator`
 * de mai jos e varianta care arunca, pastrata pentru codul care chiar are
 * nevoie de o valoare sau de o eroare.
 */
export function multiplicatorOptional(
  sistem: SistemMatrice, rand: number, forma: Forma, dest: Destinatie = "rezidential",
): number | null {
  if (forma === "ml" || forma === "mp") return 1;
  const banda = listaDe(sistem, dest).lista.multiplicatori.find(
    (b) => rand >= b.band[0] && rand <= b.band[1],
  );
  if (!banda) return null;
  for (const camp of CAMP_MULTIPLICATOR[forma]) {
    const v = banda[camp];
    if (typeof v === "number") return v;
  }
  return null;
}

/**
 * Multiplicatorul pentru elemente speciale. Fitingurile nu au pret propriu:
 * se tarifeaza ca multiplu al pretului pe metru liniar de la acel diametru.
 *
 * Tabelul e VALOARE IMPLICITA, nu regula rigida — ofertele reale contin
 * abateri negociate. Apelantul poate suprascrie, dar abaterea trebuie
 * marcata vizibil pe linie.
 */
export function multiplicator(
  sistem: SistemMatrice, rand: number, forma: Forma, dest: Destinatie = "rezidential",
): number {
  const m = multiplicatorOptional(sistem, rand, forma, dest);
  if (m !== null) return m;
  const banda = listaDe(sistem, dest).lista.multiplicatori.find(
    (b) => rand >= b.band[0] && rand <= b.band[1],
  );
  if (!banda) {
    throw new PozitieNetarifata("banda_inexistenta", "diametrul nu cade in nicio banda de multiplicatori", { sistem, rand, forma });
  }
  throw new PozitieNetarifata("fara_coeficient_de_forma", "forma nu are multiplicator definit pe aceasta banda", {
    sistem, rand, forma, banda: banda.band,
  });
}

/**
 * Ingusteaza straturile la sistemele tarifate din matrice.
 *
 * Inchiderile de goluri la foc au pret ADITIV — gol dupa suprafata, plus
 * banda WRAP, plus colier — nu matrice ø × grosime, deci nu au ce cauta in
 * `tarifeaza`. Se tarifeaza cu `tarifeazaGolFoc` din ./goluri-foc.ts, care
 * cere alti parametri: dimensiunile golului, nu diametru si grosime.
 *
 * Verificarea e explicita ca sa dea pozitia marcata cu motiv, nu un
 * TypeError opac pe o lista cu alta structura.
 */
function straturiMatrice(straturi: Strat[]): StratMatrice[] {
  const out: StratMatrice[] = [];
  for (const s of straturi) {
    const sistem = s.sistem;
    if (sistem === "goluri_foc") {
      throw new PozitieNetarifata(
        "gol_foc_in_matrice",
        "inchiderile de goluri la foc au pret aditiv; se tarifeaza cu tarifeazaGolFoc, pe dimensiunile golului",
        { sistem },
      );
    }
    out.push(s.grosime_mm === undefined ? { sistem } : { sistem, grosime_mm: s.grosime_mm });
  }
  return out;
}

/**
 * Tarifeaza o pozitie, inclusiv compusa din mai multe straturi.
 *
 * Regula, reprodusa din ofertele reale (vezi teste):
 *   1. DN -> diametru exterior real
 *   2. primul strat se cauta pe randul cel mai apropiat de diametrul real
 *      (sau, pe seria de otel scrisa cu notatie "interior", tot cel mai
 *      apropiat — vezi peSeriaDeOtel)
 *   3. diametrul geometric porneste de la RANDUL primului strat si creste
 *      cu 2 x grosime la fiecare strat
 *   4. straturile de dupa primul se cauta pe randul cel mai apropiat de
 *      geometric; JACHETA — stratul al carui SISTEM e tabla sau tabla_inox,
 *      recunoscuta dupa material, nu dupa pozitie — se rotunjeste IN SUS
 *      (randPentruJacheta)
 *   5. multiplicatorul de forma e PE STRAT, nu global: un strat al carui
 *      sistem n-are coeficient pentru forma asta pe banda lui (vata cot/teu
 *      pe 18-60, de exemplu) contribuie cu geometria lui la stratul urmator,
 *      dar NU intra in pret — nu se mai cauta nici in matricea de preturi.
 *      Daca toate straturile sunt excluse, pozitia nu se poate tarifa.
 *      Vezi Oferta 284 (9/9 potriviri exacte), intrebarea 9. Grosimea lui,
 *      insa, tot trebuie sa fie una dintre grosimile pe care sistemul o
 *      ofertaza — vezi `verificaGrosimeOfertata` — pentru ca decide geometria
 *      straturilor de deasupra chiar cand stratul nu intra in pret.
 *   6. rotunjire la 2 zecimale PE FIECARE STRAT (pret brut, apoi contributia
 *      cu multiplicator propriu), apoi se aduna
 */
/** Segmentul, scris ca sa poata fi citit intr-o nota, nu ca identificator. */
export const ADJECTIV_DEST: Record<Destinatie, string> = {
  rezidential: "rezidentiala",
  industrial: "industriala",
  rafinarie: "de rafinarie",
};

export function tarifeaza(cerere: CerereTarifare): RezultatTarifare {
  try {
    return tarifeazaDinMatrice(cerere);
  } catch (e) {
    if (e instanceof PozitieNetarifata && e.cod === "peste_maximul_listei" && cerere.forma !== "mp") {
      const r = tarifeazaPesteLista(cerere);
      if (r) return r;
    }
    throw e;
  }
}

/** π al firmei, din regula ei scrisa pentru diametrele peste lista („3,14"). */
const PI_FIRMA = 3.14;

/**
 * Diametrul trece de ultimul rand al listei: regula FIRMEI, pe suprafata.
 *
 *   mp/ml = (φ + 2 × grosime) / 1000 × 3,14      pret = mp/ml × pretul pe mp al grosimii
 *
 * Scrisa de firma (`.claude/tevi.md`, „Peste ultimul rand din lista"), cu
 * exemplul elastomer φ324 / 9 mm. Pe Oferta 27.04.2026 reproduce exact DN250 cu
 * elastomer 19 mm (23,13 €), dar SPIRO ø250 si ø315 cu 9 mm ies 16,23 si 20,17,
 * fata de 16,36 si 20,30 semnat — firma nu-si aplica formula identic peste tot.
 * De-aia pretul iese, dar pozitia merge la om (`peste_lista`).
 *
 * Straturile se aduna din interior spre exterior: fiecare isi calculeaza aria
 * pe diametrul de sub el. Forma aplica multiplicatorul benzii in care cade
 * diametrul (listele au benzi pana la 9999). `null` cand un strat n-are pret pe
 * mp la grosimea lui: atunci ramane eroarea initiala.
 */
function tarifeazaPesteLista(cerere: CerereTarifare): RezultatTarifare | null {
  const dest: Destinatie = cerere.destinatie ?? "rezidential";
  let geometric = toOuterDiameter(cerere.diametru.valoare, cerere.diametru.tip);
  const tarifate: StratTarifat[] = [];
  for (const strat of straturiMatrice(cerere.straturi)) {
    const { lista: l } = listaDe(strat.sistem, dest);
    const chei = Object.keys(l.per_mp);
    const jacheta = strat.grosime_mm === undefined && chei.length > 1
      ? grosimeJacheta(strat.sistem, chei.map(Number)) : null;
    const grosime = strat.grosime_mm ?? jacheta?.grosime ?? (chei.length === 1 ? Number(chei[0]) : undefined);
    const pMp = grosime === undefined ? undefined : pretPeMp(strat.sistem, grosime, l, dest)?.pret;
    if (grosime === undefined || pMp === undefined) return null;
    const mult = multiplicatorOptional(strat.sistem, Math.round(geometric), cerere.forma, dest);
    if (mult === null) return null;
    const pret = bani((geometric + 2 * grosime) / 1000 * PI_FIRMA * pMp);
    tarifate.push({
      sistem: strat.sistem, grosime_mm: grosime, diametru_geometric: geometric, rand_lista: 0,
      pret_unitar: pret, multiplicator: mult, inclus: true,
    });
    geometric += 2 * grosime;
  }
  if (tarifate.length === 0) return null;
  const unitar = bani(tarifate.reduce((s, t) => s + bani(t.pret_unitar * t.multiplicator), 0));
  const n = `diametrul trece de ultimul rand al listei: pret din formula firmei pe mp, ` +
    `(φ + 2 × grosime) / 1000 × 3,14 × pret/mp. De verificat: pe Oferta 27.04.2026 formula da exact ` +
    `DN250 / 19 mm, dar SPIRO ø250 si ø315 au fost semnate cu 0,13 € mai sus.`;
  return {
    straturi: tarifate, pret_unitar: unitar, multiplicator: tarifate[0]!.multiplicator,
    cantitate: cerere.cantitate, total: bani(unitar * cerere.cantitate), moneda: "EUR",
    note: [n], noteDeVerificat: [n], motiveDeVerificat: ["peste_lista"],
  };
}

function tarifeazaDinMatrice(cerere: CerereTarifare): RezultatTarifare {
  const { diametru, straturi, forma, cantitate } = cerere;
  const dest: Destinatie = cerere.destinatie ?? "rezidential";
  if (straturi.length === 0) throw new PozitieNetarifata("pozitie_fara_straturi", "pozitie fara straturi", { cerere });

  const matrice = straturiMatrice(straturi);
  const od = toOuterDiameter(diametru.valoare, diametru.tip);
  const tarifate: StratTarifat[] = [];
  const note: string[] = [];
  const noteDeVerificat: string[] = [];
  const motive = new Set<MotivVerificare>();
  let geometric = od;

  for (const [i, strat] of matrice.entries()) {
    // Segmentul e PE STRAT, nu pe pozitie: o pozitie industriala cu jacheta de
    // PVC ia PVC-ul din rezidential, singurul care exista. `listaDe` spune si
    // ce a folosit, iar diferenta fata de ce s-a cerut ajunge in `note` —
    // altfel pretul ar veni din alt segment fara ca nimeni sa vada.
    const { lista: listaStrat, folosita } = listaDe(strat.sistem, dest);
    if (folosita !== dest && !LISTA_UNICA.has(strat.sistem)) {
      // Asta CERE ochi: pretul vine din alt segment decat cel ales. Nu si la
      // inox, unde firma are o singura lista (`LISTA_UNICA`): doar nota de jos.
      motive.add("segment_diferit");
      noteDeVerificat.push(
        `${strat.sistem}: pret din lista ${ADJECTIV_DEST[folosita].toUpperCase()} — nu exista lista ` +
        `${ADJECTIV_DEST[dest]} pentru materialul asta. Restul straturilor raman pe segmentul ${dest}.`,
      );
    }
    if (folosita !== dest) {
      note.push(
        `${strat.sistem}: pret din lista ${ADJECTIV_DEST[folosita].toUpperCase()} — nu exista lista ` +
        `${ADJECTIV_DEST[dest]} pentru materialul asta. Restul straturilor raman pe segmentul ${dest}.`,
      );
    }
    const randuri = diametreDin(listaStrat);
    // Primul strat sta pe teava si respecta regula de potrivire a tevii.
    // Straturile de dupa primul sunt fie jacheta de tabla (tabla, tabla_inox)
    // — rotunjire in sus, mufa ei trebuie sa incapa peste izolatie — fie alt
    // material (elastomer, vata), care ramane pe cel mai apropiat rand chiar
    // daca sta ultimul intr-o pozitie fara jacheta. Recunoasterea e dupa
    // MATERIAL, nu dupa pozitie — vezi randPentruJacheta.
    const esteJacheta = strat.sistem === "tabla" || strat.sistem === "tabla_inox";
    const rand = i === 0
      ? randPentruTeava(geometric, randuri, diametru.tip)
      : esteJacheta
        ? randPentruJacheta(geometric, randuri)
        : randCelMaiApropiat(geometric, randuri);
    // Rotunjirea in sus la 1 mm peste un rand (o90, o160) e regula firmei
    // (intalnirea din 5 octombrie 2026: „randul de sus"), deci nu se mai
    // marcheaza. Ofertele semnate care au coborat raman „abateri cunoscute".
    const { grosime, jacheta, acoperita } = grosimeEfectiva(strat.sistem, rand, strat.grosime_mm, listaStrat);
    if (acoperita !== undefined) {
      const n = `${strat.sistem} ${acoperita} mm nu e in lista pe randul ${rand}; s-a luat ${grosime} mm, cea mai ` +
        "subtire care o acopera";
      note.push(n);
      noteDeVerificat.push(n);
      motive.add("grosime_apropiata");
    }
    if (jacheta) {
      const n = notaJacheta(strat.sistem, jacheta);
      note.push(n);
      if (!jacheta.exacta) { noteDeVerificat.push(n); motive.add("grosime_jacheta_apropiata"); }
    }

    // Grosimea CERUTA a stratului decide geometria straturilor de deasupra
    // indiferent daca stratul ajunge inclus in pret — vezi
    // `verificaGrosimeOfertata`. Ruleaza pentru toate straturile: pentru cele
    // incluse e redundanta cu `cauta` (o celula existenta are mereu o grosime
    // valida), dar pentru cele EXCLUSE e singura verificare care mai ramane,
    // fiindca ele nu se mai cauta in matrice.
    verificaGrosimeOfertata(strat.sistem, strat.grosime_mm, listaStrat);

    // Multiplicatorul e PE STRAT: un strat fara coeficient pentru forma asta
    // pe banda lui nu intra in pret. Cand e exclus, nici nu se mai cauta in
    // matrice — la Di21 g40 celula "22|40" a vatei nu exista, dar cu vata
    // exclusa din pret, lipsa ei nu mai conteaza.
    const multStrat = multiplicatorOptional(strat.sistem, rand, forma, dest);
    const inclus = multStrat !== null;

    let pretBrut = 0;
    if (inclus) {
      let p: number | undefined;
      if (forma === "mp") {
        const m = grosime === null ? undefined : pretPeMp(strat.sistem, grosime, listaStrat, dest);
        p = m?.pret;
        if (m?.nota) { note.push(m.nota); noteDeVerificat.push(m.nota); motive.add(m.motiv!); }
      } else if (grosime !== null && strat.grosime_mm !== undefined
          && listaStrat.cells[`${rand}|${grosime}`] === undefined) {
        const d = celulaDedusa(rand, grosime, listaStrat);
        const r = d === null ? celulaDinRezidential(strat.sistem, rand, grosime, dest) : null;
        if (r !== null) {
          p = r.pret;
          const n = `${strat.sistem}: combinatia ø${rand} × ${grosime} mm lipseste din lista ${ADJECTIV_DEST[dest]}; ` +
            `pret rezidential × ${r.raport.toFixed(3)} (raportul celor doua liste pe ${grosime} mm): ${bani(r.pret)} €`;
          note.push(n);
          noteDeVerificat.push(n);
          motive.add("celula_din_rezidential");
        } else if (d === null) {
          p = cauta(strat.sistem, rand, grosime, listaStrat); // arunca `grosime_inexistenta`
        } else {
          p = d.pret;
          const n = `${strat.sistem}: combinatia ø${rand} × ${grosime} mm lipseste din lista; pret dedus ` +
            `proportional din randul ${d.sus} (prin ${d.g0} mm): ${bani(d.pret)} €, ca in Oferta 284. De confirmat ` +
            `(intrebarea 18).`;
          note.push(n);
          noteDeVerificat.push(n);
          motive.add("celula_dedusa");
        }
      } else {
        p = cauta(strat.sistem, rand, grosime, listaStrat);
      }
      if (p === undefined) {
        throw new PozitieNetarifata("fara_pret_pe_mp", "nu exista pret pe mp pentru grosimea ceruta", { sistem: strat.sistem, grosime });
      }
      pretBrut = p;
    } else {
      const banda = listaStrat.multiplicatori.find(
        (b) => rand >= b.band[0] && rand <= b.band[1],
      );
      const bandaTxt = banda ? `${banda.band[0]}-${banda.band[1]}` : "necunoscuta";
      note.push(
        `${strat.sistem} nu are coeficient de ${forma} pe banda ${bandaTxt}: pozitia e tarifata doar cu ` +
        `straturile de deasupra. Regula dedusa din Oferta 284 (9/9 potriviri exacte), confirmata de firma ` +
        `pe 11 septembrie 2026.`,
      );
    }

    tarifate.push({
      sistem: strat.sistem,
      grosime_mm: grosime,
      diametru_geometric: geometric,
      rand_lista: rand,
      pret_unitar: inclus ? bani(pretBrut) : 0,
      multiplicator: multStrat ?? 0,
      inclus,
    });

    // Primul strat porneste de la randul din lista, nu de la diametrul real.
    // Straturile urmatoare acumuleaza geometric peste acea baza.
    const baza = i === 0 ? rand : geometric;
    geometric = baza + 2 * (grosime ?? 0);
  }

  const incluse = tarifate.filter((t) => t.inclus);
  if (incluse.length === 0) {
    // Nu se intoarce 0: un pret de zero ar arata ca o pozitie gratuita, nu ca
    // una netarifabila. Vezi cazul cot/teu de vata FARA jacheta pe banda 18-60.
    throw new PozitieNetarifata(
      "fara_coeficient_de_forma",
      "niciun strat nu are coeficient definit pentru forma ceruta pe banda lui; pozitia nu se poate tarifa",
      { forma },
    );
  }

  const unitar = bani(incluse.reduce((s, t) => s + bani(t.pret_unitar * t.multiplicator), 0));

  return {
    straturi: tarifate,
    pret_unitar: unitar,
    // Multiplicatorul primului strat INCLUS, nu neaparat straturi[0].
    multiplicator: incluse[0]!.multiplicator,
    cantitate,
    total: bani(unitar * cantitate),
    moneda: "EUR",
    ...(note.length ? { note } : {}),
    ...(noteDeVerificat.length ? { noteDeVerificat } : {}),
    ...(motive.size ? { motiveDeVerificat: [...motive] } : {}),
  };
}

/**
 * Pozitie pe SUPRAFATA, fara diametru: tubulatura rectangulara (A × B), in m².
 *
 * Listele au pentru asta coloana `per_mp`, pe grosime. Oferta 27.04.2026,
 * „Luftleitg. eckig ... Matte Blech 50", 460 m²: 79,73 €/m² = vata 50 mm pe mp
 * (20,22) + tabla pe mp (59,51), exact. Fara diametru nu exista rand si nici
 * multiplicator de forma — de-aia e alta functie, nu o ramura din `tarifeaza`.
 * Tabla are o singura grosime pe mp, deci implicita, ca la ml.
 */
export function tarifeazaPeMp(cerere: Omit<CerereTarifare, "diametru" | "forma">): RezultatTarifare {
  const dest: Destinatie = cerere.destinatie ?? "rezidential";
  const matrice = straturiMatrice(cerere.straturi);
  if (matrice.length === 0) throw new PozitieNetarifata("pozitie_fara_straturi", "pozitie fara straturi", { cerere });
  const tarifate: StratTarifat[] = [];
  const note: string[] = ["tarifat pe suprafata (pret pe mp al fiecarui strat): pozitia n-are diametru"];
  const noteDeVerificat: string[] = [];
  const motive = new Set<MotivVerificare>();
  for (const strat of matrice) {
    const { lista: l, folosita } = listaDe(strat.sistem, dest);
    if (folosita !== dest) {
      const n = `${strat.sistem}: pret din lista ${ADJECTIV_DEST[folosita].toUpperCase()} — nu exista lista ` +
        `${ADJECTIV_DEST[dest]} pentru materialul asta.`;
      note.push(n);
      if (!LISTA_UNICA.has(strat.sistem)) { motive.add("segment_diferit"); noteDeVerificat.push(n); }
    }
    const chei = Object.keys(l.per_mp);
    const jacheta = strat.grosime_mm === undefined && chei.length > 1
      ? grosimeJacheta(strat.sistem, chei.map(Number)) : null;
    const grosime = strat.grosime_mm ?? jacheta?.grosime ?? (chei.length === 1 ? Number(chei[0]) : undefined);
    if (grosime === undefined) {
      throw new PozitieNetarifata("grosime_ambigua", "grosime nespecificata si ambigua", { sistem: strat.sistem, disponibile: chei });
    }
    if (jacheta) {
      const n = notaJacheta(strat.sistem, jacheta);
      note.push(n);
      if (!jacheta.exacta) { noteDeVerificat.push(n); motive.add("grosime_jacheta_apropiata"); }
    }
    const m = pretPeMp(strat.sistem, grosime, l, dest);
    if (m === undefined) {
      throw new PozitieNetarifata("fara_pret_pe_mp", "nu exista pret pe mp pentru grosimea ceruta", { sistem: strat.sistem, grosime });
    }
    if (m.nota) { note.push(m.nota); noteDeVerificat.push(m.nota); motive.add(m.motiv!); }
    const p = m.pret;
    tarifate.push({
      sistem: strat.sistem, grosime_mm: grosime, diametru_geometric: 0, rand_lista: 0,
      pret_unitar: bani(p), multiplicator: 1, inclus: true,
    });
  }
  const unitar = bani(tarifate.reduce((s, t) => s + t.pret_unitar, 0));
  for (const n of noteDeVerificat) if (!note.includes(n)) note.push(n);
  return {
    straturi: tarifate, pret_unitar: unitar, multiplicator: 1,
    cantitate: cerere.cantitate, total: bani(unitar * cerere.cantitate), moneda: "EUR",
    note,
    ...(noteDeVerificat.length ? { noteDeVerificat } : {}),
    ...(motive.size ? { motiveDeVerificat: [...motive] } : {}),
  };
}

/** Helper pentru pozitii simple, cu un singur strat. */
export function tarifeazaSimplu(
  sistem: SistemMatrice, dn: number, grosime_mm: number | undefined, forma: Forma, cantitate = 1,
): RezultatTarifare {
  const strat: Strat = grosime_mm === undefined ? { sistem } : { sistem, grosime_mm };
  return tarifeaza({ diametru: { valoare: dn, tip: "DN" }, straturi: [strat], forma, cantitate });
}
