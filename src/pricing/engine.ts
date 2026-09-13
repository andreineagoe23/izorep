import { toOuterDiameter, peSeriaDeOtel, type TipDiametru } from "./dn-table.js";
import {
  diametre, diametreDin, grosimiLaDin, listaDe,
  type BandaMultiplicator, type Destinatie, type ListaPreturi,
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

function grosimeEfectiva(
  sistem: SistemMatrice, rand: number, ceruta: number | undefined, l: ListaPreturi,
): number | null {
  if (sistem === "pvc") return null;               // PVC nu are coloana de grosime
  if (ceruta !== undefined) return ceruta;
  const disp = grosimiLaDin(l, rand);
  // Tabla de jachetare are o singura grosime ofertata per diametru: e implicita.
  if (disp.length === 1) return disp[0]!;
  throw new PozitieNetarifata("grosime_ambigua", "grosime nespecificata si ambigua", { sistem, rand, disponibile: disp });
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
  if (grosimeCeruta === undefined) return;
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
    if (folosita !== dest) {
      // Asta CERE ochi: pretul vine din alt segment decat cel ales.
      motive.add("segment_diferit");
      noteDeVerificat.push(
        `${strat.sistem}: pret din lista ${ADJECTIV_DEST[folosita].toUpperCase()} — nu exista lista ` +
        `${ADJECTIV_DEST[dest]} pentru materialul asta. Restul straturilor raman pe segmentul ${dest}.`,
      );
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
    if (i === 0) {
      const jos = randInferiorNeconfirmat(geometric, rand, randuri, diametru.tip);
      if (jos !== null) {
        const n = `${strat.sistem}: diametrul ${geometric} e la ${bani(geometric - jos)} mm peste randul ${jos}; ` +
          `s-a luat randul ${rand} (in sus). Ofertele semnate au tarifat o90 si o160 si pe randul de ` +
          `dedesubt — rotunjire neconfirmata, intrebarea 3.`;
        note.push(n);
        noteDeVerificat.push(n);
        motive.add("rotunjire_neconfirmata");
      }
    }
    const grosime = grosimeEfectiva(strat.sistem, rand, strat.grosime_mm, listaStrat);

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
      const p = forma === "mp"
        ? listaStrat.per_mp[String(grosime)]
        : cauta(strat.sistem, rand, grosime, listaStrat);
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

/** Helper pentru pozitii simple, cu un singur strat. */
export function tarifeazaSimplu(
  sistem: SistemMatrice, dn: number, grosime_mm: number | undefined, forma: Forma, cantitate = 1,
): RezultatTarifare {
  const strat: Strat = grosime_mm === undefined ? { sistem } : { sistem, grosime_mm };
  return tarifeaza({ diametru: { valoare: dn, tip: "DN" }, straturi: [strat], forma, cantitate });
}
