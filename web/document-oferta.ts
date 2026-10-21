import type { LinieProcesata } from "../src/import/nucleu.js";
import type { Sistem } from "../src/pricing/types.js";
import { bani } from "../src/pricing/engine.js";
import { listaDe, type BandaMultiplicator, type Destinatie, type ListaPreturi } from "../src/pricing/lists.js";
import {
  adaosFocIndustrial, codRand, cuAjustare, denumireScrisa, imparte, segmente, totalOferta, valoareLinie,
  type AntetOferta, type CerereOferta,
} from "./oferta.js";
import { motiveLinie, stareLinie, type CodMotiv, type Stare } from "./import/text.js";

/**
 * Oferta ca date: același document pentru orice cerere.
 *
 * Clienții trimit cererea în ce formă vor (12 fișiere, 12 forme), dar ofertele
 * semnate ale firmei au un singur cadru: titlu, număr, beneficiar, un tabel cu
 * cod, denumire, UM, cantitate, preț unitar și valoare, totalul, nota și
 * semnătura (284, 118, 118.1). Modulul ăsta traduce liniile oricărui import în
 * cadrul ăla. Din el se fac ecranul, Excelul, planul de șantier și necesarul,
 * ca ordinea, numerotarea și capitolele să le hotărască un singur loc.
 *
 * Pur, fără DOM, ca motorul: se testează în Node pe ofertele semnate
 * (`tests/document-oferta.test.ts`).
 */

export interface PozitieOferta {
  /** Numărul din ofertă. Doar pozițiile „Gata” au număr: celelalte nu pleacă la client. */
  nr: number | null;
  /** Codul clientului de pe rând („IZOLATII”, „01.82.02.01A”), altfel gol. */
  cod: string | null;
  /** Textul clientului, fără cod, pe un rând. */
  textClient: string;
  /**
   * Textul din ofertă, în negru: al clientului, fără bucata cu materialele
   * când specificația noastră o înlocuiește (`faraMateriale`). Fără
   * specificație, același cu `textClient`.
   */
  textOferta: string;
  /**
   * Ce ofertăm, cu vorbele firmei: „vata minerala gr. 50 mm si protectie cu
   * tabla de aluminiu”. Doar când textul clientului nu spune tot ce am tarifat;
   * Oferta 284 a scris-o cu roșu pe exact cele 24 de casete fără grosime.
   */
  specificatie: string | null;
  um: string;
  cantitate: number;
  /** Prețul unitar, cu ajustarea tehnicului. Gol fără preț. */
  pretUnitar: number | null;
  /** Preț × cantitate, exact (`valoareLinie`). Gol fără preț. */
  valoare: number | null;
  stare: Stare;
  motive: CodMotiv[];
  /** De unde vine rândul: „rândul 114 din foaia Izolatii”. */
  sursa: { foaie: string; rand: number };
  /** `extras.index` al liniei: editorul de poziție lucrează pe ea. */
  linie: number;
  /** Închiderile la foc: dimensiunea golului și suprafața, ca în oferta 118.1. */
  gol: { dimensiune: string; suprafata: number } | null;
  manual: boolean;
}

export interface CapitolOferta {
  /** Foaia sau secțiunea clientului. Gol când oferta are un singur capitol fără nume. */
  titlu: string | null;
  pozitii: PozitieOferta[];
  /** Suma valorilor exacte ale pozițiilor „Gata”, rotunjită o dată. */
  subtotal: number;
}

export interface DocumentOferta {
  antet: AntetOferta;
  destinatie: string;
  capitole: CapitolOferta[];
  /** Coloana „Cod” apare doar când clientul are coduri (284, NISAL); Matari n-are. */
  coloanaCod: boolean;
  /** Coloanele „Dimensiune gol” și „Suprafață” apar doar la închiderile la foc (118.1). */
  coloaneGol: boolean;
  /** Totalul pozițiilor „Gata”, fără adaos. */
  totalPozitii: number;
  /** Totalul închiderilor la foc „Gata”: baza adaosului de pe industrial. */
  bazaFoc: number;
  /** +20 % pe închiderile la foc, pe oferta industrială. */
  adaosFoc: number;
  /** TOTAL LUCRARI IZOLATII TERMICE (fara TVA): pozițiile plus adaosul. */
  total: number;
  discount: number;
  /** Ce plătește clientul; egal cu `total` fără discount. */
  totalGeneral: number;
  numarate: Record<Stare, number>;
  /** Nota de sub total, rând cu rând, ca în ofertele semnate. */
  note: string[];
  /** Tabelele de elemente speciale de sub notă (118, 284). */
  speciale: TabelSpeciale[];
}

/** Nota de pe toate ofertele semnate (284, 118, 118.1), cuvânt cu cuvânt. */
export const NOTA = [
  "Preturile sunt exprimate in Euro si nu contin TVA . Plata se face in Lei la cursul BNR din ziua facturarii.",
  "Plata lucrarilor se face pe baza cantitatilor real executate si aprobate in situatii de lucrari.",
];

/** Notele 1 și 2 din oferta 118.1, doar când oferta are închideri la foc. */
export const NOTA_FOC = [
  "In pretul inchiderilor golurilor la foc nu sunt incluse colierele si banda wrap.",
  "Daca inchiderile golurilor la foc necesita banda wrap, pretul acestora va fi constituit din pretul "
    + "inchiderii golului la foc + pretul benzii wrap.",
];

/* ------------------------------------------------- elementele speciale */

/** Un tabel de sub notă: „Pretul elementelor speciale pentru … este urmatorul:”. */
export interface TabelSpeciale {
  titlu: string;
  capete: string[];
  /** Pe bandă: diametrul, apoi „X”, „X*1,5” sau gol, ca în ofertele semnate. */
  randuri: string[][];
}

/**
 * Coloanele tabelelor, cu textul și ordinea din Oferta 118 și 284. „Pret /
 * manseta” apare doar cu elastomer: 118 (elastomer și vată) o are, 284 (doar
 * vată) nu, deși lista vatei are coeficientul.
 */
const COLOANE_IZOLATII: [keyof BandaMultiplicator, string][] = [
  ["ml", "Pret / ml"],
  ["manseta", "Pret / manseta"],
  ["cot_teu_reductie", "Pret / cot, teu, reductie"],
  ["robinet_vana_flansa_contor", "Pret / robinet, vana, contor, flansa, compensator"],
  ["pompa_filtru_distribuitor", "Pret / pompa, filtru Y, distribuitor/colector, schimbator de caldura, vas amestec, vana 2-3 cai"],
];
const COLOANE_JACHETE: [keyof BandaMultiplicator, string][] = [
  ["ml", "Pret / ml"],
  ["cot_teu_reductie", "Pret / cot, teu, reductie"],
  ["flansa_robinet_contor_distribuitor", "Pret / flansa, compensator, robinet, vana, contor, distribuitor, schimbator de caldura, vas amestec"],
  ["pompa_filtru_vana23", "Pret / pompa, filtru Y, vana 2-3 cai"],
];

/** „18 - 60”, iar ultima bandă „> 324”; tabla începe banda de sus la 401, oferta scrie „> 400”. */
function banda([jos, sus]: [number, number]): string {
  if (sus < 9999) return `${jos} - ${sus}`;
  return `> ${jos % 10 === 1 ? jos - 1 : jos}`;
}

const factor = (f: number | null | undefined): string =>
  f === null || f === undefined ? "" : f === 1 ? "X" : `X*${numar(f)}`;

function tabelSpeciale(titlu: string, l: ListaPreturi, coloane: [keyof BandaMultiplicator, string][]): TabelSpeciale {
  return {
    titlu,
    capete: ["Diametru Ø", ...coloane.map(([, t]) => t)],
    randuri: l.multiplicatori.map((b) => [banda(b.band), ...coloane.map(([k]) => factor(b[k] as number | null | undefined))]),
  };
}

/**
 * Tabelele de sub notă, ca în Ofertele 118 și 284: cât costă coturile,
 * robineții, pompele, ca multiplu X al prețului pe metru. Coeficienții sunt
 * cei din listele de prețuri (aceiași cu care tarifează motorul), deci tabelul
 * spune clientului exact regula după care s-au calculat piesele. Câte un tabel
 * pentru izolații și unul pentru protecție, doar cu materialele din ofertă.
 */
export function elementeSpeciale(linii: readonly LinieProcesata[], destinatie: Destinatie): TabelSpeciale[] {
  const sisteme = new Set<Sistem>();
  for (const l of linii) {
    if (l.extras.sistem === null) continue;
    if (l.pret && "straturi" in l.pret) for (const s of l.pret.straturi) sisteme.add(s.sistem);
    else {
      sisteme.add(l.extras.sistem);
      for (const s of l.extras.straturi_extra) sisteme.add(s.sistem);
    }
  }
  const out: TabelSpeciale[] = [];
  const izolatii = (["elastomer", "vata_minerala"] as const).filter((s) => sisteme.has(s));
  if (izolatii.length > 0) {
    const coloane = sisteme.has("elastomer") ? COLOANE_IZOLATII : COLOANE_IZOLATII.filter(([k]) => k !== "manseta");
    out.push(tabelSpeciale(`Pretul elementelor speciale pentru izolatiile cu ${izolatii.map((s) => NUME[s]).join(" si ")} este urmatorul:`,
      listaDe(izolatii[0]!, destinatie).lista, coloane));
  }
  const jachete = (["tabla", "tabla_inox", "pvc"] as const).filter((s) => sisteme.has(s));
  if (jachete.length > 0) {
    out.push(tabelSpeciale(`Pretul elementelor speciale pentru protectiile cu ${jachete.map((s) => NUME[s]).join(" si ")} este urmatorul:`,
      listaDe(jachete[0]!, destinatie).lista, COLOANE_JACHETE));
  }
  return out;
}

/* ------------------------------------------------------------ capitolele */

/**
 * Secțiunea citită e de fapt antetul documentului, nu un capitol. Pe NISAL,
 * cele 50 de poziții de pe „Termice+Sanitare” stau sub rândul îmbinat
 * „Obiectiv : XXXLutz+Momax Balotesti”; pe 284, sub titlul „OFERTA LUCRARI
 * IZOLATII TERMICE”. Ca titlu de capitol ar fi zgomot.
 */
const ANTET_DOCUMENT = /^(oferta|cerere)\b|^(obiectiv|beneficiar|client|proiect|santier|șantier|lucrare|adresa|data|nr\.?|in atentia|în atenția)\b\s*:?/i;

const sectiunea = (l: LinieProcesata): string | null => {
  const s = (l.bruta as { sectiune?: string }).sectiune?.replace(/\s+/g, " ").trim();
  return s && !ANTET_DOCUMENT.test(s) ? s : null;
};

/* ---------------------------------------------------------------- codul */

/** Un cod de articol: scurt, fără spații, cu cifre și puncte sau litere („E3.1.1.2”, „01.82.02.01A”). */
const COD = /^(?=.*[.\-_/A-Za-z])[A-Za-z0-9][A-Za-z0-9.\-_/]{1,19}$/;

/**
 * Codul clientului. Întâi cel scris în text (`codRand`: „IZOLATII” în
 * TRANSAVIA), apoi prima celulă a rândului, când e un cod și nu un număr
 * curent: pe foile cu coloane recunoscute, codul NISAL („01.82.02.01A”) stă în
 * coloana lui, nu în text. Numerele curente (1, 2, 3 la Matari) nu sunt coduri:
 * oferta are numerotarea ei.
 */
function codClient(l: LinieProcesata): string | null {
  const dinText = codRand(l);
  if (dinText) return dinText;
  const prima = l.bruta.celule.find((c) => c !== null && String(c).trim() !== "");
  if (typeof prima !== "string") return null;
  const t = prima.trim();
  return COD.test(t) && !/^\d+$/.test(t) && t.length > 1 ? t : null;
}

/** Marcajul unui rând de continuare, ca în `src/import/continuare.ts`. */
const CONTINUARE = /^(?:same|idem|ditto|as\s+above|ca\s+mai\s+sus)\b\s*[-–:,]?\s*/i;

/**
 * Textul clientului, fără cod; segmentele repetate (Book15: „Same - Ø125 mm” de
 * două ori) o singură dată.
 *
 * Rândul de continuare moștenește descrierea poziției de deasupra (importul o
 * lipește după el). În ofertă se scrie ca o poziție întreagă: descrierea, apoi
 * ce are rândul în plus — „Circular spiro duct … — Ø125 mm”, nu „Same - Ø125 mm
 * | Circular spiro duct …”, care pe hârtie nu spune ce e (Book15, SRU „idem DN20”).
 */
export function textClient(l: LinieProcesata): string {
  const scrisa = denumireScrisa(l);
  if (scrisa) return scrisa;
  const s = segmente(l);
  const fara = [...new Set(codRand(l) ? s.slice(1) : s)];
  const [primul, ...rest] = fara;
  if (primul && rest.length > 0 && CONTINUARE.test(primul)) {
    const propriu = primul.replace(CONTINUARE, "").trim();
    return rest.filter((x) => !CONTINUARE.test(x)).join(" | ") + (propriu ? ` — ${propriu}` : "");
  }
  return fara.join(" | ");
}

/* --------------------------------------------------------- specificația */

const NUME: Record<Exclude<Sistem, "goluri_foc">, string> = {
  vata_minerala: "vata minerala",
  elastomer: "elastomer",
  tabla: "tabla de aluminiu",
  tabla_inox: "tabla de inox",
  pvc: "manta PVC",
};

/** Cuvintele după care se recunoaște materialul în textul clientului. */
const NUMIT: Record<Exclude<Sistem, "goluri_foc">, RegExp> = {
  vata_minerala: /vat[aă]|mineral|wool|rockwool|cochil/i,
  elastomer: /elastomer|cauciuc|kautschuk|armaflex|k-?flex|rubber/i,
  tabla: /tabl|alumin|blech|sheet|jacket/i,
  tabla_inox: /inox|stainless|edelstahl/i,
  pvc: /pvc/i,
};

const JACHETE = new Set<Sistem>(["tabla", "tabla_inox", "pvc"]);

const numar = (g: number): string => String(g).replace(".", ",");

/** Grosimea apare deja în text: „g50”, „gr. 50 mm”, „S=50mm”, „50 mm”; „Ø50mm” e diametrul, nu grosimea. */
function scrieGrosimea(text: string, g: number): boolean {
  const n = String(g).replace(".", "[.,]");
  return new RegExp(`(?:\\bg|gr\\.?|grosime(?:a)?(?:\\s+de)?|S\\s*=|d\\s*=)\\s*${n}\\b|(?<![øØ]\\s?)\\b${n}\\s*mm\\b`, "i").test(text);
}

/**
 * Specificația noastră, scrisă ca firma pe casetele Ofertei 284:
 * „vata minerala gr. 50 mm si protectie cu tabla de aluminiu”.
 *
 * Apare doar când textul clientului nu spune tot ce am tarifat: o grosime de
 * izolație pe care n-a scris-o (casetele TRANSAVIA, luată de la conductă), sau
 * alta decât cea scrisă (NISAL: „S=20mm” ofertat 19 mm, scris de firmă în
 * descriere), ori un material pe care nu-l numește. Rândurile complete
 * („… tabla de aluminiu Di114, g50 - COT”) rămân cum le-a scris clientul.
 *
 * Grosimea tablei de aluminiu nu se scrie (284 n-o scrie); la inox da, fiindcă
 * lista are trei grosimi la fiecare diametru și alegerea schimbă prețul.
 */
export function specificatie(l: LinieProcesata, doarCeLipseste = false): string | null {
  const e = l.extras;
  if (e.sistem === null || e.sistem === "goluri_foc") return null;
  if (l.pret && "manual" in l.pret && l.pret.manual) return null;
  // Denumirea scrisă de om e întreagă: n-o mai completăm noi.
  if (denumireScrisa(l)) return null;
  // Protecția la foc a tubulaturii are prețul ei pe m² (48 €), nu straturi de
  // izolație: stratul din rezultat e doar purtătorul prețului.
  if (l.pret?.motiveDeVerificat?.includes("protectie_foc")) return null;
  const straturi: { sistem: Sistem; grosime: number | null }[] = l.pret && "straturi" in l.pret
    ? l.pret.straturi.map((s) => ({ sistem: s.sistem, grosime: s.grosime_mm }))
    : [{ sistem: e.sistem, grosime: e.grosime_mm }, ...e.straturi_extra.map((s) => ({ sistem: s.sistem, grosime: s.grosime_mm }))];
  const text = l.bruta.text;
  const lipseste = (s: { sistem: Sistem; grosime: number | null }): boolean => s.sistem !== "goluri_foc" && (
    !NUMIT[s.sistem].test(text)
    || ((!JACHETE.has(s.sistem) || s.sistem === "tabla_inox") && s.grosime !== null && !scrieGrosimea(text, s.grosime)));
  if (!straturi.some(lipseste)) return null;

  // Lângă textul întreg al clientului se scrie doar ce lipsește din el (vezi `documentOferta`).
  const alese = doarCeLipseste ? straturi.filter(lipseste) : straturi;
  const izolatii = alese.filter((s) => !JACHETE.has(s.sistem) && s.sistem !== "goluri_foc");
  const jachete = alese.filter((s) => JACHETE.has(s.sistem));
  const parti = izolatii.map((s) =>
    `${NUME[s.sistem as keyof typeof NUME]}${s.grosime !== null ? ` gr. ${numar(s.grosime)} mm` : ""}`);
  const protectie = jachete.map((s) =>
    `${NUME[s.sistem as keyof typeof NUME]}${s.sistem === "tabla_inox" && s.grosime !== null ? ` gr. ${numar(s.grosime)} mm` : ""}`);
  // Doar jacheta lipsește (grosimea tablei de inox): fără „protectie cu”, textul o spune deja.
  if (parti.length === 0) return protectie.length ? `${doarCeLipseste ? "" : "protectie cu "}${protectie.join(" si ")}` : null;
  return parti.join(" + ") + (protectie.length ? ` si protectie cu ${protectie.join(" si ")}` : "");
}

/**
 * Textul clientului fără coada cu materialele, pe care o înlocuiește
 * specificația. Oferta 284, pe cele 24 de casete: clientul a scris „Caseta
 * izolatie armaturi cu flanse DN100 din tabla aluminiu si vata minerala”, iar
 * firma a lăsat „Caseta izolatie armaturi cu flanse DN100” și a scris cu roșu
 * „vata minerala gr. 50 mm si protectie cu tabla de aluminiu”. Lipită după
 * textul întreg, specificația repeta materialele („… si vata minerala vata
 * minerala gr. 50 mm …”).
 *
 * Se taie doar o coadă care începe cu „din” sau „cu” și are numai materiale
 * și cuvinte de legătură, ca acolo. „… tabla de aluminiu Di21, g40 - COT”
 * (cu cifre) sau „… / Armacell, Kaiflex, K-flex” (fără „din”) rămân întregi.
 */
export const MARCA_INOX = /\b(304|316L?|321)\b/i;

export function faraMateriale(text: string): string {
  const material = new RegExp(Object.values(NUMIT).map((r) => r.source).join("|"), "i");
  // Legăturile și marca inoxului („tabla inox 304”), care trece în specificație (`MARCA_INOX`).
  const legatura = /^(din|cu|si|și|de|in|în|with|and|aus|mit|304|316L?|321)$/i;
  // Prima prepoziție după care vin numai materiale: „armaturi cu flanse” nu e.
  // „DN150din tabla …” (TRANSAVIA inox) are prepoziția lipită de cifre.
  for (const m of text.matchAll(/(?:\s+|(?<=\d))(?:din|cu|with|aus|mit)\s+/gi)) {
    const coada = text.slice(m.index).trim().split(/[\s,]+/).filter(Boolean);
    if (coada.every((c) => legatura.test(c) || material.test(c)) && coada.some((c) => material.test(c))) {
      return text.slice(0, m.index).trim() || text;
    }
  }
  return text;
}

/* ------------------------------------------------------------- documentul */

function golul(l: LinieProcesata): PozitieOferta["gol"] {
  const { gol_latime_mm: w, gol_inaltime_mm: h } = l.extras;
  if (l.extras.sistem !== "goluri_foc" || w === null || h === null) return null;
  return { dimensiune: `${numar(w)}/${numar(h)}`, suprafata: Math.round(w * h / 10000) / 100 };
}

/**
 * Documentul ofertei din liniile importului.
 *
 * - Pozițiile rămân în ordinea clientului; capitolele sunt foile și secțiunile
 *   lui, ca rânduri consecutive (118.1: EI30 … EI180; NISAL: cele două foi).
 *   O singură foaie fără secțiuni = un capitol fără titlu (284).
 * - Toate pozițiile de izolație intră în document, la locul lor; doar cele
 *   „Gata” au număr și intră în total, exact ca foaia `Ofertă` (`imparte`).
 *   Numerotarea e cea a planului de șantier (`planDinOferta`).
 * - Totalul e cel din `valoareOferta`: ajustarea, adaosul de foc pe industrial,
 *   discountul.
 */
export function documentOferta(c: CerereOferta, pastreaza: number | null = null): DocumentOferta {
  // `pastreaza`: rândul la care scrie omul rămâne în document și când textul,
  // pe drum, nu mai e izolație (descrierea ștearsă ca s-o rescrie): altfel ar
  // dispărea de sub cursor. Fără preț, nu intră în ofertă.
  const linii = cuAjustare(c.linii, c.antet.ajustareProcent ?? 0)
    .filter((l) => l.extras.sistem !== null || l.extras.index === pastreaza);
  const foi = new Set(linii.map((l) => l.bruta.foaie));

  const capitole: CapitolOferta[] = [];
  let cheie: string | null = null;
  let nr = 0;
  for (const l of linii) {
    const sect = sectiunea(l);
    const k = `${l.bruta.foaie}\u0000${sect ?? ""}`;
    if (k !== cheie) {
      cheie = k;
      capitole.push({ titlu: sect ?? (foi.size > 1 ? l.bruta.foaie : null), pozitii: [], subtotal: 0 });
    }
    const stare = stareLinie(l);
    const pret = l.pret;
    // Ca pe casetele din 284: specificația întreagă ia locul materialelor din
    // textul clientului; când nu le poate lua locul, se scrie doar ce lipsește.
    const text = textClient(l);
    const taiat = specificatie(l) ? faraMateriale(text) : text;
    // Marca inoxului tăiată din text se spune în specificație: „tabla de inox 304 gr. 0,4 mm”.
    const marca = taiat === text ? undefined : MARCA_INOX.exec(text.slice(taiat.length))?.[1];
    const spec = specificatie(l, taiat === text);
    capitole[capitole.length - 1]!.pozitii.push({
      nr: stare === "gata" ? ++nr : null,
      cod: codClient(l),
      textClient: text,
      textOferta: taiat,
      specificatie: marca && spec ? spec.replace(NUME.tabla_inox, `${NUME.tabla_inox} ${marca}`) : spec,
      um: l.bruta.um ?? "",
      cantitate: l.bruta.cantitate ?? 1,
      pretUnitar: pret ? bani(pret.pret_unitar) : null,
      valoare: pret ? valoareLinie(l) : null,
      stare,
      motive: motiveLinie(l),
      sursa: { foaie: l.bruta.foaie, rand: l.bruta.rand },
      linie: l.extras.index,
      gol: golul(l),
      manual: Boolean(pret && "manual" in pret && pret.manual),
    });
  }

  const gataDin = (ls: LinieProcesata[]) => imparte(ls).oferta;
  const peIndex = new Map(linii.map((l) => [l.extras.index, l]));
  for (const cap of capitole) {
    cap.subtotal = totalOferta(gataDin(cap.pozitii.map((p) => peIndex.get(p.linie)!)));
  }

  const oferta = gataDin(linii);
  const totalPozitii = totalOferta(oferta);
  const adaosFoc = adaosFocIndustrial(oferta, c.provenienta.destinatie);
  const total = bani(totalPozitii + adaosFoc);
  const discount = bani(total * (c.antet.discountProcent ?? 0) / 100);
  const toate = capitole.flatMap((cap) => cap.pozitii);
  const numarate: Record<Stare, number> = { gata: 0, de_validat: 0, netarifate: 0 };
  for (const p of toate) numarate[p.stare]++;
  const foc = toate.some((p) => p.gol !== null || peIndex.get(p.linie)!.extras.sistem === "goluri_foc");

  return {
    antet: c.antet,
    destinatie: c.provenienta.destinatie,
    capitole,
    coloanaCod: toate.some((p) => p.cod !== null),
    coloaneGol: foc,
    totalPozitii,
    bazaFoc: totalOferta(oferta.filter((l) => l.extras.sistem === "goluri_foc")),
    adaosFoc,
    total,
    discount,
    totalGeneral: bani(total - discount),
    numarate,
    note: foc ? [...NOTA, ...NOTA_FOC] : NOTA,
    speciale: elementeSpeciale(linii, c.provenienta.destinatie as Destinatie),
  };
}
