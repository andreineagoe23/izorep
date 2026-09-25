import { TOLI_DN, esteConversiaDN } from "../pricing/dn-table.js";
import type { LinieExtrasa } from "./schema.js";

/**
 * Stratul determinist de extragere. Prinde ~55% din liniile reale masurate pe
 * cele 7 fisiere de client din attachments/.
 *
 * Nu exista din motive de cost — la ~350 de linii pe proiect si 20 de proiecte
 * pe luna, trecerea tuturor liniilor prin model ar costa cativa euro. Exista
 * pentru ca ce se poate rezolva determinist trebuie sa aiba teste care pica
 * atunci cand cineva strica regula.
 */
const SISTEM: [LinieExtrasa["sistem"], RegExp][] = [
  ["elastomer", /elastomer|armaflex|cauciuc\s+sinte|a?uciuc\s+sinte|k[aä]lteiso|k-?flex|kaiflex|kautschuk/i],
  // "mineral wool" lipsea, desi `cerere-de-oferta-book15.xlsx` e integral in engleza: acolo
  // pozitiile se recunosteau doar din coloana romana de descriere.
  ["vata_minerala", /vat[aă]\s+mineral|mineral\s+wool|rock\s?wool|mineralwolle|rockwool|isolshell|fiberglass|saltele\s+de\s+vat/i],
  // Tabla de INOX, alta lista de preturi decat tabla de aluminiu/zincata.
  // Verificata DUPA elastomer/vata: in cerere-de-oferta-transavia-inox.xlsx textul e mereu
  // "Izolatii cu vata minerala si protectie cu tabla de inox 304 ...", iar
  // sistemul PRINCIPAL trebuie sa ramana vata_minerala, nu inoxul din stratul
  // de protectie. Cand linia e DOAR jachetare de inox (fara semnal de
  // izolatie), vata_minerala nu matcheaza si asta ia locul ei.
  ["tabla_inox", /\binox\b|o[țt]el\s+inoxidabil|stainless|edelstahl/i],
  // Tabla de aluminiu/zincata, ca JACHETA. Verificata dupa inox, ca "tabla de
  // inox" sa nu cada aici. A lipsit mult timp dinadins, fiindca pe fisierele
  // reale prinde si randuri in care tabla e materialul TUBULATURII; fara ea
  // insa, o pozitie "vata + jacheta de tabla" iesea tarifata doar cu vata,
  // mai ieftin si tacut. Capcana de material e tratata separat, in
  // `sistemeDinText` — vezi `TABLA_E_TUBULATURA`.
  // „de" poate veni lipit: cererea TRANSAVIA are „tabla dealuminiu" pe un rand
  // (r71), care iesea fara jacheta, deci fara pret.
  ["tabla", /tabl[aă]\s+(?:de\s*)?(?:aluminiu|zincat)|jachet|jacket|\bblech\b/i],
  ["pvc", /\bpvc\b/i],
  // Cere notiunea de GOL, nu doar mentiunea focului. "Protectie la foc EI 60
  // pentru tubulaturile din tabla zincata" din cerere-de-oferta-spital.xlsx e protectia
  // tubulaturii, alta lucrare, si nu are lista de preturi. Cu "rezistent la
  // foc" sau "EI 60" ca semnal, 28 de randuri de acolo intrau ca inchideri de
  // gol, iar dimensiunea tubulaturii rectangulare ("1000/500") era citita
  // drept dimensiune de gol. "Treceri prin pereti" e al doilea semnal, dar
  // numai langa foc — vezi `TRECERI_PRIN_PERETI`.
  ["goluri_foc", /inchideri?\s+goluri|goluri\s+la\s+foc|\bwrap\b|promastop/i],
];

/**
 * "Treceri prin pereti" e inchidere la foc DOAR langa foc.
 *
 * Antetele din oferta 118.1 scriu "Teceri prin pereti rezistenti la foc EI30"
 * ("Teceri" nu e greseala mea: asa scrie acolo). Caietele de instalatii scriu
 * insa aceleasi cuvinte la TEAVA: "Teava din otel zincata ... inclusiv
 * fitinguri, treceri prin pereti si plansee cu teava de protectie". Masurat pe
 * `cerere-de-oferta-spital.xlsx`: 58 de randuri de alta meserie intrau asa ca inchideri de gol
 * fara dimensiuni, deci ca munca de validat pentru omul de la tehnic.
 */
const TRECERI_PRIN_PERETI = /\b(?:t|tr)eceri\s+prin\s+pereti/i;
const CONTEXT_FOC = /\bfoc\b|\bEI\s*\d{2,3}\b/i;

/**
 * Tabla care e MATERIALUL tubulaturii, nu jacheta pusa de noi peste izolatie.
 *
 * Masurat pe cele 10 fisiere de client, doua tipare:
 *   - `cerere-de-oferta-book15.xlsx`, 9 randuri: "tubulatura circulara tip SPIRO ... izolat cu
 *     vata minerala de 30 mm ... realizat din tabla zincata la cald". Citit ca
 *     vata + jacheta de aluminiu, pretul urca de la 16,17 la 30,77-56,08 €/ml,
 *     fara nicio marca;
 *   - `cerere-de-oferta-spital.xlsx`, 3 randuri: "Protectie la foc EI 60 pentru tubulaturile din
 *     tabla zincata - torcret" — protectie la foc a tubulaturii, alta lucrare.
 *
 * Singur, "din tabla" nu ajunge ca semnal: "Caseta izolatie armaturi cu flanse
 * DN100 din tabla aluminiu" e chiar jacheta. De-aia cere verbul de fabricatie
 * sau tubulatura ca subiect, iar `TABLA_E_JACHETA` bate oricum.
 */
const TABLA_E_TUBULATURA =
  /(?:realizat|executat|confec[țt]ionat)\w*\s+din\s+tabl|made\s+of\s+(?:[\w-]+\s+){0,3}sheet|tubulatur\w*\s+din\s+tabl/i;
/**
 * Semnalele de jacheta care raman jacheta chiar langa tabla tubulaturii:
 * "protectie mecanica a izolatiilor ... din tabla zincata", "protejata la
 * exterior cu tabla zincata", "caseta ... din tabla aluminiu", "jacketing".
 */
const TABLA_E_JACHETA =
  /jachet|jacket|cladding|caset[aăe]|protec[țt]i\w*\s+(?:cu\s+tabl|mecanic)|protejat\w*\s+(?:la\s+exterior\s+)?cu\s+tabl/i;

/**
 * Inoxul e TEAVA, nu jacheta: „izolatie ... pe teava din inox DN15". Fara
 * regula asta, `tabla_inox` intra ca strat peste izolatie si pozitia ramanea
 * fara pret (grosimea jachetei de inox e intrebarea 15) — pentru o jacheta pe
 * care clientul n-a cerut-o. Ramane jacheta cand randul o spune si pe ea.
 */
const INOX_E_TEAVA =
  /\b(?:teav[aă]|țeav[aă]|tevi|țevi|conduct\w*)\s+(?:din\s+|de\s+)?inox|stainless\s+steel\s+(?:pipe|tube)|edelstahlrohr/i;
const INOX_E_JACHETA =
  /tabl[aă]\s+(?:de\s*)?inox|inox\s+sheet|stainless\s+steel\s+(?:sheet|cladding|jacket)|edelstahl(?:blech|mantel)|jachet|jacket|cladding|caset[aăe]/i;

/** True daca randul vorbeste de teava de inox (materialul tevii, nu jacheta). */
export function esteTeavaDeInox(text: string): boolean {
  return INOX_E_TEAVA.test(text);
}

/** Alte meserii din caietul de sarcini: se resping explicit, nu se ghicesc. */
const ALTE_MESERII =
  /gril[aă]|difuzor|clapet[aă]|demont|dismant|relocare|relocation|ventilator|cazan|boiler|chiller|\bAHU\b|centrala de tratare|vas de expansiune|grundu|priming|swirl|anemostat|plenum|recuperator|air\s+conditioning\s+unit/i;

/**
 * Livrarea tubulaturii in sine, nu izolarea ei.
 *
 * Caietele de sarcini descriu tubulatura prin MATERIALUL din care e facuta —
 * "Made of hot-dip galvanized sheet", "tabla zincata la cald" — iar asta
 * prinde regula de `tabla`, desi rândul e o pozitie de alta meserie: clientul
 * cumpara tubulatura, nu jachetarea ei. Masurat pe `cerere-de-oferta-book15.xlsx`: 21 de
 * randuri intrau asa, cu grosimea citita din "Ø100 mm" si forma din "275 g/m2".
 *
 * Semnalele sunt de LIVRARE (sistem de tubulatura, piese speciale, standarde
 * si certificari de tubulatura), nu de material — tabla apare si intr-o
 * jachetare adevarata, deci ea singura n-ar putea decide.
 */
const LIVRARE_TUBULATURA =
  /duct\s+system|sistem\s+de\s+tubulatur|piese\s+speciale|special\s+parts|\bEUROVENT\b|\bEPDM\b|SR-?EN\s*1506/i;

/**
 * Ce face dintr-un rand o pozitie de IZOLATIE, nu o livrare.
 *
 * Pazeste regula de mai sus sa nu taie pozitii reale: "Sistem complet de
 * protectie mecanica a izolatiilor ... din tabla zincata" e jachetare, chiar
 * daca spune "sistem", iar "Supply and installation of aluminum sheet
 * jacketing" e tot a noastra.
 */
const SEMN_IZOLATIE = /izola[țt]|izolatii|insulat|d[aä]mmung|jachet|jacket|armaflex|elastomer|vat[aă]\s+mineral|mineral\s+wool/i;

/**
 * Numarul se termina la prima non-cifra, nu la granita de cuvant: "flanse
 * DN150din tabla inox 304" (`cerere-de-oferta-transavia-inox.xlsx`, randul 70)
 * n-are granita intre 150 si "din", deci pozitia iesea fara diametru. La fel
 * `RE_OD` pe "Dimensiuni: Ø20mm" (`oferta-118-nisal.xlsx`, randurile 44–47).
 */
const RE_DN = /\b(?:DN|Dn|dn)\s*\.?\s*(\d{1,3})(?!\d)/;
/** Tubulatura spiro: acolo "DN" inseamna diametru exterior. */
const RE_SPIRO = /\bspiro\b|wickelfalzrohr/i;
const RE_DI = /\bDi\s*(\d{1,3})\b/;
const RE_OD = /[øØ]\s*(\d{1,3})(?!\d)/;

/**
 * Toate diametrele scrise cu Ø pe rand, in mm. Fara toli (`Ø1/2"`, `Ø1 1/4"`)
 * si fara fractii (`Ø 130/130` e dimensiunea golului, nu un diametru).
 */
export function diametreScrise(text: string): number[] {
  const out: number[] = [];
  for (const m of text.matchAll(/[øØΦФ]\s*(\d{1,3}(?:[.,]\d{1,2})?)(?!\d)/g)) {
    const dupa = text.slice(m.index! + m[0].length).trimStart();
    if (/^(?:\/|\d\s*\/\s*\d|"|”|“|''|′|″)/.test(dupa)) continue;
    out.push(Number(m[1]!.replace(",", ".")));
  }
  return out;
}
/** Diametrele scrise pe rand CU notatia lor, separat pe DN si pe diametru. */
export interface DiametreNotate { dn: number[]; exterior: number[] }

/**
 * Toate numerele de pe rand care sunt scrise CA DIAMETRU: dupa DN, Di, Ø,
 * dupa tipul tevii de plastic, in toli, sau ca „114,3 x 4,5" (exterior ×
 * perete). Validatorul le foloseste ca sa deosebeasca diametrul de un alt
 * numar de pe acelasi rand — „inox 304 Di89", „EN 14304 ... Dn 100".
 */
export function diametreNotate(text: string): DiametreNotate {
  const dn: number[] = [];
  const exterior: number[] = [...diametreScrise(text)];
  for (const m of text.matchAll(new RegExp(RE_DN.source, "g"))) dn.push(Number(m[1]));
  for (const m of text.matchAll(new RegExp(RE_TOLI.source, "g"))) {
    const v = TOLI_DN[m[1]!.replace(/\s+/g, " ")];
    if (v !== undefined) dn.push(v);
  }
  for (const m of text.matchAll(/\bDi\s*(\d{1,3}(?:[.,]\d{1,2})?)(?!\d)/g)) exterior.push(Number(m[1]!.replace(",", ".")));
  for (const m of text.matchAll(new RegExp(RE_PLASTIC.source, "g"))) exterior.push(Number(m[1]));
  for (const m of text.matchAll(/(?<![\d.,])(\d{2,3}[.,]\d)\s*x\s*\d/g)) exterior.push(Number(m[1]!.replace(",", ".")));
  return { dn, exterior };
}

/**
 * Teava de plastic: `PPR 20`, `PEHD 110`, `PEHD D40x3.0`.
 *
 * Forma cu grosimea peretelui lipita (`D40x3.0`) nu se citea: dupa `40` vine
 * `x`, deci nu e granita de cuvant. Masurat pe `oferta-118-nisal.xlsx`: 11
 * pozitii de elastomer pe PEHD ieseau "fara diametru", desi sunt exact
 * cazurile de plastic din `tests/pricing.test.ts`.
 */
const RE_PLASTIC = /\b(?:PPR|PP|PEHD|PEX)\s*[D]?\s*(\d{1,3})(?:\b|(?=x\d))/;
/**
 * Diametru in toli, legat de notatia lui: `Ø1/2"`, `Ø1 1/4"`, `Dn 2 1/2"`.
 *
 * Fara el, `RE_OD` citea `Ø1/2"` ca diametru exterior 1 si `RE_DN` citea
 * `Dn 1 1/4"` ca DN1. Masurat pe `oferta-118-nisal.xlsx`: sase pozitii de
 * elastomer, de la 1/2" la 2", ieseau toate pe primul rand al listei
 * (5,70 €/ml), fata de 5,79 ... 8,88 in oferta semnata.
 *
 * Ghilimeaua si prefixul (ø sau DN) sunt obligatorii: fara ghilimea, "1/2"
 * dintr-un "130/130" ar deveni DN15; fara prefix, un `2"` oarecare dintr-o
 * descriere de robinet ar deveni DN50. `Dn 25 (1'')` ramane DN25 — tolii din
 * paranteza sunt notatie secundara.
 */
const RE_TOLI = /(?:\b(?:DN|Dn|dn)\s*\.?\s*|[øØФ]\s*)(\d{1,2}\s+\d\/\d|\d\/\d|\d{1,2})\s*(?:"|”|“|''|′′|″)/;
const RE_GROSIME = /(?:g\s*[=.]?\s*|gr\.?\s*|S\s*=\s*|grosime[a]?\s+de\s+|[-–]\s*)(\d{1,3})\s*mm/i;
const RE_GROSIME_COMPACT = /\bg\s?(\d{2,3})\b/;

/**
 * True daca randul scrie o grosime de izolatie („g48", „gr. 50 mm",
 * „grosimea de 30 mm"), chiar una pe care extragerea a respins-o fiindcă nu
 * e in lista. Deosebeste „n-a scris grosimea" de „a scris una pe care n-o
 * avem" — la a doua, nimic nu are voie sa completeze in locul clientului.
 */
export function scrieGrosime(text: string): boolean {
  return RE_GROSIME.test(text) || RE_GROSIME_COMPACT.test(text);
}
const RE_MM = /(\d{1,3})\s*mm\b/g;
/**
 * Dimensiunea golului la inchiderile goluri la foc: "130/130", "1400/600".
 * Cere minimum doua cifre de fiecare parte, ca sa nu inghita tolii ("1/2").
 */
const RE_GOL = /\b(\d{2,4})\s*\/\s*(\d{2,4})\b/;
/** Ce sta inaintea unui numar si il face diametru, nu grosime. */
const ESTE_DIAMETRU = /[øØ]\s*$|diametr\w*\s*:?\s*$|diameter\s*:?\s*$/i;

const GROSIMI_PLAUZIBILE = new Set([9, 13, 19, 25, 32, 20, 30, 40, 50, 60, 80, 100]);

const FORMA: [LinieExtrasa["forma"], RegExp][] = [
  ["cot", /\bCOT\b|\bcot\b|coturi/], ["teu", /\bTEU\b|\bteu\b/],
  ["manseta", /manset/i], ["reductie", /reductie/i], ["flansa", /flans/i],
  ["contor", /contor/i], ["filtru", /filtru\s*Y|filtru/i], ["pompa", /pomp[aă]/i],
  ["robinet", /robinet|van[aă]/i],
  // `mp` NU se citeste dupa un slash: "275 g/m2" e densitatea zincului din
  // caietul de sarcini, nu unitatea pozitiei. Masurat pe `cerere-de-oferta-book15.xlsx`, de
  // acolo veneau forme `mp` pe randuri cu UM `lm`.
  // „m²" nu are granita de cuvant dupa „²" (nu e litera), deci `\bm²\b` nu
  // prindea niciodata, iar UM-ul „m²" cadea pe `\bm\b` de mai jos: tubulatura
  // de pe Oferta 27.04.2026 (460 m²) iesea „ml".
  ["mp", /(?<!\/)\bmp\b|(?<!\/)\bm²|(?<!\/)\bm2\b/i],
  // `lm` = metru liniar, scris asa in `cerere-de-oferta-book15.xlsx`. Lipsea, desi parserul il
  // accepta deja ca unitate de masura, deci randul cadea pe textul liniei.
  ["ml", /\bML\b|\bml\b|\blm\b|\bm\b/i],
];

/** „20 to 50mm", „20-50 mm", „20 – 50 mm", „20 pana la 50 mm", „20/50mm" nu. */
const RE_INTERVAL_MM = /\b(\d{1,3})\s*(?:mm\s*)?(?:to|-|–|—|pana\s+la|până\s+la)\s*(\d{1,3})\s*mm/gi;

function inInterval(text: string, g: number): boolean {
  for (const m of text.matchAll(RE_INTERVAL_MM)) {
    const a = Number(m[1]), b = Number(m[2]);
    if (a < b && (g === a || g === b)) return true;
  }
  return false;
}

/**
 * Forma de ELEMENT (cot, teu, flansa...) scrisa in text, ignorand UM-ul.
 *
 * La extragere UM-ul bate textul, si de obicei are dreptate. Dar Oferta 284
 * scrie „Di169, g50 - COT" cu UM `ml`: forma din UM da pretul pe metru
 * (51,44 €), oferta semnata a tarifat cotul (102,88 €). Cand textul numeste un
 * element si UM-ul spune altceva, nu stim care greseste — deci nu se alege
 * tacut. `nucleu.ts` tarifeaza ambele si marcheaza pozitia daca difera.
 */
export function formaElementDinText(text: string): LinieExtrasa["forma"] {
  const f = FORMA.find(([forma, re]) => forma !== "ml" && forma !== "mp" && re.test(text));
  return f?.[0] ?? null;
}

/**
 * Forma scrisa EXPLICIT ca eticheta a pozitiei: „Di169, g50 - COT".
 *
 * Aici textul bate UM-ul. Oferta 284 (TRANSAVIA, semnata) are doua randuri
 * „Di169, g50 - COT" cu UM `ml` si le-a tarifat ca cot, 102,88 €, nu pe metru,
 * 51,44 € — 2 din 2. Forma e ceruta dupa liniuta, ca o mentiune de trecere
 * („inclusiv coturi", „de la pompa diesel") sa nu schimbe forma pozitiei;
 * acolo ramane UM-ul si, daca pretul difera, `forma_contrazisa` din nucleu.
 */
const FORMA_EXPLICITA: [LinieExtrasa["forma"], RegExp][] = [
  ["cot", /\s[-–]\s*cot\b/i], ["teu", /\s[-–]\s*teu\b/i], ["reductie", /\s[-–]\s*reductie\b/i],
  ["manseta", /\s[-–]\s*manseta\b/i], ["flansa", /\s[-–]\s*flansa\b/i],
];

export function formaExplicitaDinText(text: string): LinieExtrasa["forma"] {
  return FORMA_EXPLICITA.find(([, re]) => re.test(text))?.[0] ?? null;
}

export interface RezultatRegex {
  linie: LinieExtrasa;
  /** true daca sistem + diametru + grosime au fost toate determinate. */
  complet: boolean;
}

/**
 * Un rand fara unitate de masura SI fara cantitate nu e o pozitie.
 *
 * Ofertele se termina cu note, semnaturi si titluri, iar textul lor contine
 * exact cuvintele dupa care se recunoaste sistemul:
 *
 *   "Preturile se refera la inchideri goluri la foc EI60 si EI90 …"
 *   "In pretul inchiderilor golurilor la foc nu sunt incluse colierele si banda wrap"
 *   "1. Izolatii conducte PPR cu Armaflex gr. 9 mm - manopera :"
 *
 * Toate trei ies `goluri_foc` sau `elastomer` si intra in raport ca pozitii
 * netarifate, pe langa ca pleaca la model degeaba. Masurat pe cele 9 fisiere de
 * client: regula scoate 35 de randuri si NICIUNUL nu era tarifat.
 *
 * Semnalul e fizic, nu semantic — nu se uita la ce scrie in rand, ci la faptul
 * ca o pozitie ofertabila are intotdeauna o cantitate sau o unitate. Cuvintele
 * dintr-o nota sunt aceleasi cu ale unei pozitii; masura nu e.
 *
 * Randurile astea NU dispar din fisier: raman in grila si raman antete de
 * sectiune. Se opresc doar din a fi pozitii — si se numara, `faraMasura` din
 * raport, ca sa se vada daca vreodata cade ceva real in ele.
 */
const faraMasura = (um?: string, cantitate?: number): boolean =>
  um === undefined && cantitate === undefined;

/** Ordinea montarii: izolatia sta pe teava, jacheta peste ea. */
const ORDINE_STRATURI: Exclude<LinieExtrasa["sistem"], null>[] =
  ["elastomer", "vata_minerala", "pvc", "tabla", "tabla_inox"];

/**
 * TOATE sistemele numite intr-un text, in ordinea montarii.
 *
 * Un rand poate cumpara mai multe materiale deodata — "Izolatii cu vata
 * minerala si protectie cu tabla de inox" sunt doua straturi, fiecare cu
 * pretul lui. Pana acum se lua doar primul care se potrivea, deci al doilea
 * material nu se tarifa niciodata.
 *
 * `goluri_foc` e EXCLUSIV: pretul lui e aditiv (gol + banda + colier), nu un
 * strat peste o teava, deci nu se combina cu nimic. Cand apare, e singur.
 */
/**
 * Grosimea scrisa LANGA numele unui material.
 *
 * "Elastomer 13mm + MW 40mm" cumpara doua straturi cu grosimi diferite, dar
 * euristica generala ia ultima masura de pe rand si o da primului sistem —
 * deci elastomerul primea 40 mm, grosime pe care nici nu o ofertam (are
 * 9/13/19/25/32), iar pozitia iesea netarifata. Aici fiecare material isi ia
 * numarul care il urmeaza, in aceeasi propozitie.
 *
 * Fereastra e scurta (40 de caractere) si NUMAI dupa nume: intr-o descriere
 * lunga, orice numar ar putea fi al oricui daca se cauta destul de departe.
 * Cand nu se gaseste nimic aproape, se intoarce `null` si decide euristica
 * generala — regula asta adauga precizie, nu inlocuieste nimic.
 */
const FEREASTRA_GROSIME = 40;

/**
 * Grosimea scrisa imediat INAINTEA numelui: "13mm+40mm vata minerala".
 *
 * Asa scrie randul real din `oferta-118-nisal.xlsx` (DN80 si DN100,
 * elastomer + vata + tabla, 44,35 si 57,82 €/ml semnat): vata n-are niciun
 * numar DUPA nume, deci iesea fara grosime, iar pozitia "grosime ambigua".
 * Fereastra e mica, iar numarul trebuie sa fie o grosime a ACELUI sistem —
 * elastomerul (9/13/19/25/32) si vata (20/30/40/50/60/80/100) nu au nicio
 * grosime comuna, deci "Elastomer 13mm vata minerala" nu da vatei 13.
 */
const FEREASTRA_INAINTE = 12;
const GROSIMI_SISTEM: Partial<Record<Exclude<LinieExtrasa["sistem"], null>, ReadonlySet<number>>> = {
  elastomer: new Set([9, 13, 19, 25, 32]),
  vata_minerala: new Set([20, 30, 40, 50, 60, 80, 100]),
};

/**
 * Grosimea JACHETEI, scrisa langa tabla: "protectie cu tabla de inox 0,5 mm".
 *
 * Zecimala si doar din lista materialului ei (aluminiu 0,6 / 0,8 / 1,0 · inox
 * 0,4 / 0,5 / 0,6). Pana acum nu se citea deloc: inoxul iesea mereu "grosime
 * ambigua" chiar cand clientul o scria, fiindca lista lui are toate trei
 * grosimile la fiecare rand (intrebarea 15). Un intreg de langa tabla
 * ("tabla ... 50 mm") e grosimea izolatiei, nu a jachetei, deci aici nu conteaza.
 */
const GROSIMI_JACHETA: Partial<Record<Exclude<LinieExtrasa["sistem"], null>, ReadonlySet<number>>> = {
  tabla: new Set([0.6, 0.8, 1]),
  tabla_inox: new Set([0.4, 0.5, 0.6]),
};
/**
 * Spatiul dupa virgula e tolerat: „tabla zincata de 0. 6 mm"
 * (`cerere-de-oferta-spital.xlsx`, randul 137) nu se citea, iar pozitia lua
 * singura grosime pe mp a listei (0,8), „Gata" — randul 136, identic dar cu
 * „0.6", era corect refuzat.
 */
const RE_MM_ZECIMAL = /(?<![\d.,])(\d(?:[.,] ?\d{1,2})?)\s*mm\b/g;

function grosimeLangaSistem(
  text: string, sistem: Exclude<LinieExtrasa["sistem"], null>,
): number | null {
  const re = SISTEM.find(([s]) => s === sistem)?.[1];
  if (!re) return null;
  const m = new RegExp(re.source, re.flags.includes("g") ? re.flags : `${re.flags}g`);
  const gasite = [...text.matchAll(m)];
  const jacheta = GROSIMI_JACHETA[sistem];
  if (jacheta) {
    const zecimal = (s: string): number => Number(s.replace(",", ".").replace(" ", ""));
    for (const gasit of gasite) {
      const capat = gasit.index! + gasit[0].length;
      const fereastra = text.slice(capat, capat + FEREASTRA_GROSIME);
      for (const nr of fereastra.matchAll(RE_MM_ZECIMAL)) {
        // "a thickness of 0.6 – 0.8 mm" (`cerere-de-oferta-book15.xlsx`) e un
        // interval, nu o grosime: alegerea ramane a omului.
        if (/\d\s*[–-]\s*$/.test(fereastra.slice(0, nr.index))) continue;
        if (jacheta.has(zecimal(nr[1]!))) return zecimal(nr[1]!);
      }
      const inainte = /(?<![\d.,])(\d(?:[.,] ?\d{1,2})?)\s*mm\s*$/i
        .exec(text.slice(Math.max(0, gasit.index! - FEREASTRA_INAINTE), gasit.index!));
      if (inainte && jacheta.has(zecimal(inainte[1]!))) return zecimal(inainte[1]!);
    }
    return null;
  }
  for (const gasit of gasite) {
    const dupa = text.slice(gasit.index! + gasit[0].length, gasit.index! + gasit[0].length + FEREASTRA_GROSIME);
    for (const nr of dupa.matchAll(/(\d{1,3})\s*mm\b/g)) {
      const v = Number(nr[1]);
      if (GROSIMI_PLAUZIBILE.has(v)) return v;
    }
  }
  // A doua trecere, doar daca prima n-a gasit nimic: ce e scris dupa nume
  // ramane regula, ce e scris inainte e ultima sansa.
  const proprii = GROSIMI_SISTEM[sistem];
  if (!proprii) return null;
  for (const gasit of gasite) {
    const inainte = text.slice(Math.max(0, gasit.index! - FEREASTRA_INAINTE), gasit.index!);
    const nr = /(\d{1,3})\s*mm\s*$/i.exec(inainte);
    if (nr && proprii.has(Number(nr[1]))) return Number(nr[1]);
  }
  return null;
}

function sistemeDinText(text: string): Exclude<LinieExtrasa["sistem"], null>[] {
  const potrivite = SISTEM.filter(([, re]) => re.test(text)).map(([s]) => s!);
  if (TRECERI_PRIN_PERETI.test(text) && CONTEXT_FOC.test(text)) potrivite.push("goluri_foc");
  if (potrivite.includes("goluri_foc")) return ["goluri_foc"];
  const faraTabla = TABLA_E_TUBULATURA.test(text) && !TABLA_E_JACHETA.test(text)
    ? potrivite.filter((s) => s !== "tabla")
    : potrivite;
  const straturi = INOX_E_TEAVA.test(text) && !INOX_E_JACHETA.test(text)
    ? faraTabla.filter((s) => s !== "tabla_inox")
    : faraTabla;
  return ORDINE_STRATURI.filter((s) => straturi.includes(s));
}

export function extrageDeterminist(
  index: number, text: string, um?: string, sectiune?: string, cantitate?: number,
): RezultatRegex {
  const gol: LinieExtrasa = {
    index, sistem: null, diametru_valoare: null, diametru_tip: null,
    grosime_mm: null, forma: null, gol_latime_mm: null, gol_inaltime_mm: null,
    straturi_extra: [], incredere: 0, motiv: "",
  };

  if (ALTE_MESERII.test(text)) {
    return { linie: { ...gol, incredere: 0.95, motiv: "alta meserie, nu se oferteaza" }, complet: true };
  }

  // Livrare de tubulatura, fara niciun cuvant de izolatie pe rand: materialul
  // descrie tubulatura, nu ce punem noi peste ea.
  if (LIVRARE_TUBULATURA.test(text) && !SEMN_IZOLATIE.test(text)) {
    return {
      linie: { ...gol, incredere: 0.95, motiv: "livrare de tubulatura, nu izolatie" },
      complet: true,
    };
  }

  if (faraMasura(um, cantitate)) {
    return {
      linie: { ...gol, incredere: 0.9, motiv: "rand fara unitate de masura si fara cantitate: nota, titlu sau total" },
      complet: true,
    };
  }

  // Sistemele se cauta intai in linie. Daca linia tace, se intreaba sectiunea:
  // "Teava OL/OLZN DN15" nu spune nimic, dar antetul de deasupra —
  // "Treceri prin pereti rezistenti la foc EI30" — spune tot. Sectiunea NU
  // se foloseste la diametru, grosime sau gol: alea trebuie sa fie pe rand,
  // altfel o pozitie ar mosteni valorile alteia.
  const gasite = sistemeDinText(text);
  const toate = gasite.length > 0
    ? gasite
    : (sectiune ? sistemeDinText(sectiune) : []);
  const sistem = toate[0] ?? null;
  // Ce mai e numit pe rand, peste primul strat. O descriere ca "Izolatii cu
  // vata minerala si protectie cu tabla de inox 304 Di21, g40" cumpara DOUA
  // materiale, si pana acum al doilea nu era vazut deloc: pozitia iesea
  // tarifata doar cu vata, mai ieftin decat e in realitate.
  //
  // Grosimea ramane `null`: textul are o singura grosime ("g40") si aia e a
  // izolatiei, nu a jachetei. Pentru tabla de aluminiu motorul o deduce
  // singur (lista e rara — o grosime per diametru); pentru inox nu poate,
  // fiindca lista e densa, si pozitia se marcheaza. Asta e comportamentul
  // dorit: vezi "care e grosimea implicita de tabla de inox?" din stare.md.
  const straturi_extra = toate.slice(1).map((s) => ({
    sistem: s!,
    grosime_mm: grosimeLangaSistem(text, s!),
  }));

  let diametru_valoare: number | null = null;
  let diametru_tip: LinieExtrasa["diametru_tip"] = null;
  let m: RegExpMatchArray | null;
  if ((m = text.match(RE_PLASTIC))) {
    // Plastic: dimensiunea nominala ESTE diametrul exterior.
    diametru_valoare = Number(m[1]); diametru_tip = "exterior";
  } else if ((m = text.match(RE_TOLI)) && TOLI_DN[m[1]!.replace(/\s+/g, " ")] !== undefined) {
    // Tolii sunt DN scris altfel: 1/2" = DN15, deci pe seria de otel.
    diametru_valoare = TOLI_DN[m[1]!.replace(/\s+/g, " ")]!; diametru_tip = "DN";
  } else if ((m = text.match(RE_DN))) {
    // La tubulatura SPIRO, "DN 160" e diametrul EXTERIOR, nu un DN de teava de
    // otel — confirmat de firma pe 11 septembrie 2026 ("la spiro este doar
    // diametru exterior"). Pana atunci linia iesea cu `DiametruNecunoscut` si
    // mergea la om: citita ca DN, pozitia dadea 14,37 EUR/ml (randul 169), dar
    // oferta semnata are 14,16 (randul 159).
    diametru_valoare = Number(m[1]);
    diametru_tip = RE_SPIRO.test(text) ? "exterior" : "DN";
  } else if ((m = text.match(RE_OD))) {
    diametru_valoare = Number(m[1]); diametru_tip = "exterior";
  } else if ((m = text.match(RE_DI))) {
    diametru_valoare = Number(m[1]); diametru_tip = "interior";
  }

  // Un DN (sau toli) langa un Ø care NU e conversia lui din tabel: Ø-ul e teava
  // reala, citita ca diametru exterior. Dovada, pe oferta semnata, la
  // `esteConversiaDN`. Cand macar un Ø de pe rand e chiar DN-ul ("Dn 80 (88,9 x 4)"),
  // ramane DN-ul.
  let notaDiametru = "";
  if (diametru_tip === "DN" && diametru_valoare !== null) {
    const dn = diametru_valoare;
    const scrise = diametreScrise(text);
    if (scrise.length > 0 && !scrise.some((v) => esteConversiaDN(dn, v))) {
      diametru_valoare = scrise[0]!;
      diametru_tip = "exterior";
      notaDiametru = `; scrie DN${dn}, dar Ø${String(scrise[0]).replace(".", ",")} nu e DN${dn} `
        + "in tabelul de conversie, deci se ia Ø";
    }
  }

  let grosime_mm: number | null = null;
  // Cand randul cumpara mai multe materiale, primul isi ia grosimea scrisa
  // langa NUMELE lui, nu ultima de pe rand: la "Elastomer 13mm + MW 40mm",
  // elastomerul are 13, nu 40. Pe un rand cu un singur material nu se schimba
  // nimic — acolo euristica generala e si mai buna, fiindca prinde si
  // formularile in care grosimea sta inaintea materialului. Tabla e exceptia:
  // grosimea ei e zecimala si se cauta doar langa ea (`GROSIMI_JACHETA`).
  const esteJacheta = sistem !== null && GROSIMI_JACHETA[sistem] !== undefined;
  if (sistem !== null && (toate.length > 1 || esteJacheta)) {
    grosime_mm = grosimeLangaSistem(text, sistem);
  }
  const g = grosime_mm !== null || esteJacheta ? null : (text.match(RE_GROSIME) ?? text.match(RE_GROSIME_COMPACT));
  if (grosime_mm !== null || esteJacheta) {
    // deja gasita langa numele materialului, sau tabla fara grosime scrisa
  } else if (g && GROSIMI_PLAUZIBILE.has(Number(g[1]))) {
    grosime_mm = Number(g[1]);
  } else {
    // Ultima masura in mm de pe rand, dar NU una care e vizibil un diametru:
    // "Diameter: Ø100 mm" da 100, care e o grosime plauzibila de vata si se
    // strecura ca atare. Un diametru marcat cu ø sau cu "diametru/diameter"
    // inaintea lui nu poate fi grosimea aceleiasi pozitii.
    const toate = [...text.matchAll(RE_MM)]
      .filter((m) => !ESTE_DIAMETRU.test(text.slice(Math.max(0, m.index! - 16), m.index!)))
      .map((x) => Number(x[1]))
      .filter((n) => GROSIMI_PLAUZIBILE.has(n));
    grosime_mm = toate.at(-1) ?? null;
  }
  // O grosime care e capatul unui INTERVAL nu e grosimea pozitiei: Book15,
  // „insulated with 20 to 50mm mineral wool", 4.148 m², iesea „Gata" pe 50 mm
  // (83.872 €). Intervalul e decizia omului, ca la „0.6 – 0.8 mm" de tabla.
  if (grosime_mm !== null && inInterval(text, grosime_mm)) grosime_mm = null;

  const dinUm = um ? FORMA.find(([, re]) => re.test(um))?.[0] : undefined;
  const forma = formaExplicitaDinText(text) ?? dinUm ?? FORMA.find(([, re]) => re.test(text))?.[0] ?? null;

  // Dimensiunea golului se citeste DOAR daca linia e deja identificata ca
  // inchidere la foc. "130/130" e un tipar prea comun ca sa fie semnal de
  // sistem in sine — ar prinde fractii, rapoarte si dimensiuni de tubulatura.
  let gol_latime_mm: number | null = null;
  let gol_inaltime_mm: number | null = null;
  if (sistem === "goluri_foc") {
    const d = text.match(RE_GOL);
    if (d) { gol_latime_mm = Number(d[1]); gol_inaltime_mm = Number(d[2]); }
  }

  // Inchiderile la foc se tarifeaza pe SUPRAFATA golului: diametrul si
  // grosimea nu le fac complete, dimensiunile golului da.
  // Pe m² nu trebuie diametru: pretul vine din `per_mp`, pe grosime
  // (tubulatura rectangulara, Oferta 27.04.2026: 79,73 exact).
  const complet = sistem === "goluri_foc"
    ? gol_latime_mm !== null && gol_inaltime_mm !== null
    : sistem !== null && grosime_mm !== null && (diametru_valoare !== null || forma === "mp");

  return {
    linie: {
      ...gol, sistem, diametru_valoare, diametru_tip, grosime_mm, forma,
      gol_latime_mm, gol_inaltime_mm, straturi_extra,
      incredere: complet ? 0.99 : 0.3,
      motiv: complet
        ? `extras determinist din text${straturi_extra.length ? ` (${toate.join(" + ")})` : ""}${notaDiametru}`
        : "extragere determinista incompleta",
    },
    complet,
  };
}
