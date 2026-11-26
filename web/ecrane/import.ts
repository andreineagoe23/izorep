import {
  citesteText, proceseazaRegistru, recitesteNecitite, reevalueaza, type Extractor, type LinieProcesata, type OptiuniNucleu, type Rezultat,
} from "../../src/import/nucleu.js";
import { campuriRand, scrieCelula, reconstruieste, type CampuriRand } from "../../src/import/editare.js";
import { invataDinCorectie } from "../../src/import/memorie.js";
import { citesteColoanele, mapariFolosite, mapariImport } from "../import/mapari-firma.js";
import { controlColoane } from "../import/coloane-ecran.js";
import { faPozitie, lasateAfara } from "../../src/import/lasate-afara.js";
import { listaAfara } from "../import/afara-vizual.js";
import { ecranDublura, lucrareaFisierului } from "../import/fisier-dublu.js";
import type { LinieExtrasa } from "../../src/import/schema.js";
// Doar tipul: ExcelJS (~940 kB) ramane incarcat lenes, prin `import()`.
import type { FoaieBruta } from "../../src/import/parse-workbook.js";
import type { Destinatie } from "../../src/pricing/lists.js";
import { grosimePropusa } from "../../src/pricing/grosimi-uzuale.js";
import { stocSabloane } from "../stoc-sabloane.js";
import { ceriSpatiu } from "../meniu-stare.js";
import { anuleaza, confirma, potrivit, vazute } from "../validare.js";
import { cardIntrebari, excelIntrebari, intrebariClient, type DateEmail } from "../import/intrebari.js";
import { cate, esc, eur } from "./tip.js";
import { FIRME, firmaDupa, logoFirmei, tineFirma, ultimaFirma } from "../date/firme.js";
import {
  adaosFocIndustrial, clientPropus, cuAjustare, cuDenumiri, cuProcente, dataAzi, imparte, totalCuAdaos, valoareOferta,
  type AntetOferta, type CerereOferta,
} from "../oferta.js";

import { descarca, numeOferta } from "../descarca.js";
import { necesarDinLinii } from "../../src/stoc/necesar.js";
import {
  REGULI_FIRMEI, santierDin as santierDinCerereOferta, type ReguliNecesar, type RezultatSantier,
} from "../santier-din.js";
import {
  incarca, puneCurent, salveaza, salveazaOferta, citesteOferte, urmatorulNumar,
} from "../date.js";
import type { EditareCelula, SesiuneImport } from "../istoric.js";
import {
  actiuniLista, alertaNecitite, antetVerificare, detaliuValoare, ecranOferta, ecranProgres, ecranStart, editorPozitie, fileSursa,
  filtreMotiv, numaraMotive, patchDinFormular, randStrat, toast,
  type FiltruStare, type Pas,
} from "../import/vizual.js";
import {
  antetDinFisier, baraVerificare, exportPeEcran, filtruImplicit, type AntetScris, type SchimbariPozitie,
} from "../import/oferta-vizual.js";
import { CASETA_COLOANEI, JACHETE, patchDinCamp, verificarePeEcran } from "../import/verificare-vizual.js";
import { documentOferta, textClient, type PozitieOferta } from "../document-oferta.js";
import { legaCelule, numarInCelula, numarScris, pastreazaCursorul } from "../celula.js";
import { rutaModel } from "../imagine.js";
import { FARA_POZITII, fisierNecitit, motiveLinie, stareLinie, type CodMotiv } from "../import/text.js";
import { preia, type Predare } from "../predare.js";
import { MARCA_PRET_DUBLU } from "../../src/santier/spre-cerere.js";
import { randuriIzolate, tevileFoii, type TeviFoaie } from "../../src/import/izolatie-foaie.js";
import {
  ALEGERE_INITIALA, alegereDin, campuriVizibile, ecranIzolatieFoaie, izolatieDin, type AlegereFoaie,
} from "../import/izolatie-vizual.js";
import { bani } from "../../src/pricing/engine.js";

/**
 * Ecranul de import, in trei pasi: fisierul, verificarea pozitiilor, oferta.
 *
 * Il folosesc oameni de la birou si de pe santier, nu programatori. De-aia:
 * un singur drum vizibil (pasii de sus), fiecare pozitie ca un card cu starea
 * ei in cuvinte simple si cu actiunea care o rezolva langa ea, si o singura
 * actiune principala lipita jos. Textul explicativ lipseste dinadins: ce
 * trebuie facut se vede din asezare, nu dintr-un paragraf.
 *
 * Ecranul tine starea si asculta evenimentele — delegat, pe radacina, o
 * singura data. Marcajul vine din `web/import/vizual.ts` (pur, testat), tot ce
 * e L0-L4 din `nucleu.js`. `tests/structura.test.ts` e bariera care spune ca
 * ecranul nu reimplementeaza extragerea.
 */

/**
 * Ruta stratului cu model e pe server (`src/server/model.ts`), dupa intrare.
 * Pe linkul de pe Pages lipseste, iar ecranul cade curat pe stratul
 * determinist — si cheia API nu poate ajunge in pagina.
 */
const RUTA_MODEL = rutaModel("extrage");
interface StareModel { disponibil: boolean; model: string; prag: number; lot?: number; concurenta?: number }
/** Loturi mici, in paralel: fiecare lot intors misca bara de progres. */
const LOT_IMPLICIT = 25;
const CONCURENTA_IMPLICITA = 4;

async function interogheazaModel(): Promise<StareModel | null> {
  try {
    const r = await fetch(RUTA_MODEL);
    // Fara ruta, serverul static raspunde cu index.html si cod 200: se verifica tipul.
    if (!r.ok || !r.headers.get("content-type")?.includes("application/json")) return null;
    const s = (await r.json()) as StareModel;
    return s.disponibil ? s : null;
  } catch {
    return null;
  }
}

interface Sesiune {
  foi: FoaieBruta[];
  rez: Rezultat;
  meta: SesiuneImport;
  editari: EditareCelula[];
  /** Alerta de loturi cazute la model, HTML deja escapat. */
  avertisment: string;
}

const pozitii = (n: number): string => (n === 1 ? "o poziție" : cate(n, "poziții"));

/**
 * Logo-ul firmei din `web/public`, ca base64 pentru Excel. Adresa e relativă
 * la pagină, deci merge și sub `/izorep/`, și pe server. Lipsă: oferta pleacă
 * fără logo, nu cade.
 */
async function logoBase64(fisier: string): Promise<string | null> {
  try {
    const r = await fetch(fisier);
    if (!r.ok) return null;
    const octeti = new Uint8Array(await r.arrayBuffer());
    let s = "";
    for (let i = 0; i < octeti.length; i += 0x8000) s += String.fromCharCode(...octeti.subarray(i, i + 0x8000));
    return btoa(s);
  } catch {
    return null;
  }
}

/** Antetul propus pentru un import nou: beneficiarul din fișier, altfel din numele lui. */
function antetImplicit(numeFisier: string, dinFisier: Partial<AntetScris> = {}): AntetScris {
  return {
    firma: FIRME[0].id, numar: "", data: dataAzi(), localitate: "PALTINIS", discount: 0, adaosFoc: false,
    client: dinFisier.client ?? (numeFisier ? clientPropus(numeFisier) : ""),
    obiectiv: dinFisier.obiectiv ?? "", persoana: dinFisier.persoana ?? "",
  };
}

/**
 * Antetul unei sesiuni fara antet salvat: din oferta descarcata deja pe ea
 * (sesiunile de dinainte de 14 octombrie 2026), altfel din fisier.
 */
function antetDinOferta(meta: SesiuneImport, foi: readonly FoaieBruta[]): AntetScris {
  const baza = antetImplicit(meta.nume, antetDinFisier(foi));
  const o = citesteOferte()[meta.id];
  if (!o) return baza;
  const firma = FIRME.find((f) => o.numar.startsWith(f.serieOferta));
  return {
    ...baza, ...(firma ? { firma: firma.id, numar: o.numar.slice(firma.serieOferta.length) } : {}),
    ...(o.data ? { data: o.data } : {}), ...(o.client ? { client: o.client } : {}), ...(o.obiectiv ? { obiectiv: o.obiectiv } : {}),
  };
}

interface CerereDeschisa {
  meta: SesiuneImport; rez: Rezultat; antet: AntetScris; ajustare: number; destinatie: Destinatie; denumiri: Map<number, string>;
  /** Discountul sau adaosul pe rând (Etapa 4); lipsă = niciunul. */
  procente?: ReadonlyMap<number, number>;
}

/**
 * Cererea ofertei din antetul ținut în sesiune: aceleași câmpuri pe care le
 * citea „Creează șantierul” din formularul pasului „Oferta” (antetul se
 * scrie în sesiune la fiecare tastă, deci e același).
 */
function cerereDinAntet(c: CerereDeschisa): CerereOferta {
  const a = c.antet;
  const firma = FIRME.find((f) => f.id === a.firma) ?? FIRME[0]!;
  const antet: AntetOferta = {
    serie: firma.serieOferta, numar: a.numar.trim(), data: a.data.trim(), persoana: a.persoana.trim(),
    client: a.client.trim(), obiectiv: a.obiectiv.trim(), firma: firma.denumire, localitate: a.localitate.trim(),
    adaosFoc: a.adaosFoc !== false,
  };
  if (a.discount > 0) {
    antet.discountProcent = a.discount;
    antet.discountConditie = "PENTRU PLATA FACTURII FISCALE IN TERMEN DE 5-7 ZILE CALENDARISTICE DE LA DATA EMITERII";
  }
  if (c.ajustare) antet.ajustareProcent = c.ajustare;
  return {
    linii: cuProcente(cuDenumiri(c.rez.linii, c.denumiri), c.procente ?? new Map()), antet,
    provenienta: {
      generatLa: new Date().toISOString(), destinatie: c.destinatie, model: c.meta.model,
      sesiune: c.meta.id, fisierSursa: c.meta.nume,
    },
  };
}

/**
 * Șantierul din cererea deschisă (`web/santier-din.ts`): „Clientul a acceptat”
 * și „Refă lista”. Antetul e cel ținut în sesiune.
 */
function santierDin(c: CerereDeschisa, reguli: ReguliNecesar): RezultatSantier {
  return santierDinCerereOferta({
    sesiune: c.meta.id, fisier: c.meta.nume, oferta: cerereDinAntet(c), brute: c.rez.brute,
    ...(c.antet.refuzat ? { refuzat: c.antet.refuzat } : {}),
  }, reguli);
}

/** Opțiunile nucleului pentru o cerere salvată, ca la redeschiderea ei în import. */
async function optiuniCererii(s: SesiuneImport): Promise<OptiuniNucleu> {
  const info = await interogheazaModel();
  return {
    stoc: await stocSabloane(), mapari: (await mapariImport(s.mapari)).mapari, prag: info?.prag ?? 0.85, destinatie: s.destinatie ?? "rezidential",
    grosimiPropuse: new Map(s.grosimiPropuse ?? []), descrieriSchimbate: new Set(s.descrieriSchimbate ?? []),
    preturiManuale: new Map(s.preturiManuale ?? []), necitite: new Set(s.necitite ?? []),
  };
}

/** Cererea salvată, redeschisă fără ecran (fără model): pentru șantier, când fila Cerere nu e deschisă. */
async function deschideCererea(id: string): Promise<CerereDeschisa | null> {
  const s = await incarca(id);
  if (!s) return null;
  const { redeschideImport } = await import("../../src/import/redeschide.js");
  const rez = await redeschideImport(s, await optiuniCererii(s));
  return {
    meta: s, rez, antet: s.antet ? { ...s.antet } : antetDinOferta(s, rez.foi), ajustare: s.ajustare ?? 0,
    destinatie: s.destinatie ?? "rezidential", denumiri: new Map(s.denumiri ?? []), procente: new Map(s.procente ?? []),
  };
}

/** Șantierul dintr-o cerere salvată, cu regulile date (implicit ale firmei). */
export async function santierDinCerere(id: string, reguli: ReguliNecesar = REGULI_FIRMEI): Promise<RezultatSantier> {
  const c = await deschideCererea(id);
  return c ? santierDin(c, reguli) : { eroare: "Cererea nu s-a putut deschide. Reîncarcă pagina." };
}

/**
 * „Schimbă regulile de calcul” de pe fila Materiale: cererea se deschide o
 * dată, apoi lista se socotește la fiecare schimbare de regulă, fără să se
 * scrie nimic, iar „Refă lista” reface șantierul cu regulile alese.
 */
export async function deschideReguli(id: string): Promise<{
  necesar(r: ReguliNecesar): ReturnType<typeof necesarDinLinii>;
  aplica(r: ReguliNecesar): RezultatSantier;
} | null> {
  const c = await deschideCererea(id);
  if (!c) return null;
  return {
    necesar: (r) => necesarDinLinii(imparte(cuAjustare(cuProcente(c.rez.linii, c.procente ?? new Map()), c.ajustare)).oferta, {
      ...r, discountProcent: c.antet.discount > 0 ? c.antet.discount : 0,
    }),
    aplica: (r) => santierDin(c, r),
  };
}

/** Refuzul clientului, scris în cererea salvată (fila Cerere nu e deschisă). */
export async function refuzCerere(id: string, zi: string | null): Promise<string | null> {
  const s = await incarca(id);
  if (!s) return "Cererea nu s-a putut deschide. Reîncarcă pagina.";
  const antet: AntetScris = s.antet ? { ...s.antet } : antetImplicit(s.nume);
  if (zi) antet.refuzat = zi; else delete antet.refuzat;
  await salveaza({ ...s, antet });
  return null;
}

/** Partea importului pe care o arată fila lucrării: fișierul, verificarea sau oferta. */
export type ParteImport = "fisier" | "verificare" | "oferta";
const PAS: Record<ParteImport, Pas> = { fisier: 1, verificare: 2, oferta: 3 };
const PARTE: Record<Pas, ParteImport> = { 1: "fisier", 2: "verificare", 3: "oferta" };

export interface OptiuniImport {
  /** Cererea de deschis; lipsă = o cerere nouă, de la pasul fișierului. */
  cerere?: string;
  parte: ParteImport;
  /** Un fișier (sau pozele) a dat o cerere nouă, deja salvată: pagina devine a lucrării ei. */
  laCerereNoua?: (id: string) => void;
  /** Importul a trecut singur pe altă parte („Mergi la ofertă”, „Înapoi la verificare”). */
  laParte?: (p: ParteImport) => void;
  /** După fiecare salvare: ce trebuie paginii ca să spună ce urmează. */
  laSchimbare?: (r: RezumatImport) => void;
  /** Oferta a fost salvată și descărcată. */
  laOferta?: () => void;
  /** Lucrarea are deja o ofertă salvată: „Descarcă oferta” nu mai e pasul de acum. */
  areOferta?: () => boolean;
  /** Lucrarea are șantier („pornit”) sau e închisă: cererea se arată de văzut, fără „cer să te uiți”. */
  santier?: () => "pornit" | "inchis" | null;
  /** Firma cu care pornește o cerere nouă (fila deschisă în Lucrări); altfel ultima aleasă. */
  firma?: string;
}

export interface RezumatImport { deVerificat: number; intrebari: number; antet: AntetScris }

export interface ControlImport {
  /** Fila lucrării s-a schimbat: altă parte, fără să se piardă ce e scris. */
  arata(p: ParteImport): void;
  /** Salvarea amânată, acum: înainte de pornirea șantierului. */
  salveazaAcum(): Promise<void>;
  /** Ziua refuzului (ISO), sau null când clientul a acceptat până la urmă. */
  refuz(zi: string | null): Promise<void>;
  /** Șantierul din cererea deschisă, ca „Creează șantierul” de dinainte. */
  santier(reguli?: ReguliNecesar): RezultatSantier;
}

/**
 * Montează importul în `gazda`, pentru o lucrare (planul UX, Faza 2, 14
 * noiembrie 2026): fila Cerere arată fișierul și verificarea, fila Ofertă
 * datele ofertei. Filele și adresa sunt ale paginii lucrării; pașii 1 · 2 · 3
 * de sus nu se mai desenează. Restul (editarea la tastă, anularea, salvarea,
 * conflictul cu un coleg, modelul) e ca înainte.
 */
export async function montezaImport(gazda: HTMLElement, opt: OptiuniImport): Promise<ControlImport> {
  const info = await interogheazaModel();
  /** Coloanele foilor: din repo, ale firmei, ale cererii (`mapari-firma.ts`). */
  let mi = await mapariImport();
  const prag = info?.prag ?? 0.85;
  const stoc = await stocSabloane();

  /* --------------------------------------------------------------- stare */
  let destinatie: Destinatie = "rezidential";
  /** Întrebările pentru client, deschise pe fila Cerere (Etapa 6). */
  let intrebariDeschise = false;
  /** Firma aleasă la cererea nouă (Etapa 2): intră în antetul cererii când se deschide prima dată. */
  let firmaStart: string = firmaDupa(opt.firma)?.id ?? ultimaFirma();
  /** Grosimile uzuale cerute in masa. Vezi `OptiuniNucleu.grosimiPropuse`. */
  let grosimiPropuse = new Map<number, number>();
  /** Descrierile schimbate dupa verificare. Vezi `OptiuniNucleu.descrieriSchimbate`. */
  let descrieriSchimbate = new Set<number>();
  /** Preturile puse de mana. Vezi `OptiuniNucleu.preturiManuale`. */
  let preturiManuale = new Map<number, number>();
  /** Rândurile plecate la model și neîntoarse (Faza 6, punctul 7). Vezi `OptiuniNucleu.necitite`. */
  let necitite = new Set<number>();
  /**
   * Mesajul plafonului zilnic, de la ultima citire: cât e atins, „Încearcă din
   * nou” nu se arată (ar da același 429 la nesfârșit), ci mesajul lui, cu ora.
   * Nu se ține în cerere: redeschisă mâine, butonul revine.
   */
  let plafonCitire = "";
  /** „Încearcă din nou” e în lucru: butonul nu pleacă de două ori. */
  let reincercareInLucru = false;
  /** Denumirile scrise de om în tabelul ofertei. Vezi `SesiuneImport.denumiri`. */
  let denumiri = new Map<number, string>();
  /** Discountul sau adaosul pe rând, `index → %` (Etapa 4). Vezi `LinieCuDenumire.procentRand`. */
  let procente = new Map<number, number>();
  let pas: Pas = PAS[opt.parte];
  /**
   * Ce aduce omul la pasul 1 (Andrei, 22 octombrie 2026): Excelul clientului
   * sau pozele din carnet (măsurat de noi, înainte de ofertă). `#/lucrari/noua/poze`
   * ține fila la reîncărcare.
   */
  let sursa: "excel" | "poze" = /^#\/lucrari\/noua\/poze/.test(location.hash) ? "poze" : "excel";
  let sesiune: Sesiune | null = null;
  let filtru: FiltruStare = "toate";
  /**
   * Fila aleasă de om rămâne aleasă. Până atunci se deschide pe ce cere ochi
   * (`filtruImplicit`), iar când acolo nu mai rămâne nimic, trece singură mai
   * departe. Nu la fiecare tastă: un rând care devine „De verificat” cât scrii
   * nu mută pagina pe altă filă.
   */
  let filtruAles = false;
  /** Fila „Lăsate afară” deschisă (Faza 6): rândurile cu cantitate care nu sunt poziții. */
  let vedereAfara = false;
  /**
   * Rândurile „Gata” deschise cu casetele (15 noiembrie 2026). Un rând deschis
   * rămâne așa cât lucrezi pe el (cursorul în el) sau cât l-ai schimbat în
   * sesiunea asta (`atinse`); celelalte se închid la următoarea redesenare.
   */
  const deschise = new Set<number>();
  const atinse = new Set<number>();
  let motiv: CodMotiv | null = null;
  let editIdx: number | null = null;
  /** Datele de pe antetul ofertei, scrise la pasul „Oferta”; se tin in sesiune. */
  let antet: AntetScris = antetImplicit("");
  /** Ajustarea tehnicului pe toate prețurile, din pasul „Oferta" (procente). */
  let ajustare = 0;
  let detaliiDeschise = false;
  /** „schimbă” de lângă tipul ofertei, la verificare: cele două tipuri, până se alege unul. */
  let tipDeschis = false;
  let eroareStart = "";
  /** Ultima actiune care se poate anula din mesajul de jos. */
  let deAnulat: (() => void) | null = null;
  /**
   * Tiparul de invatat din ultima corectura, pastrat cat timp se mai poate
   * anula. Invatat pe loc, anularea nu mai avea efect: la recalcul, memoria
   * rezolva randul inapoi exact cum il corectase omul.
   */
  let deInvatat: { text: string; extras: LinieExtrasa } | null = null;
  const invataAmanat = (): void => {
    if (deInvatat) invataDinCorectie(deInvatat, stoc);
    deInvatat = null;
  };
  /**
   * Fisierul fara nicio pozitie, dar cu liste de tevi (CET Constanta): omul
   * alege izolatia pe fiecare foaie, iar lista de izolatii trece prin import.
   */
  let deIzolat: { fisier: File; tevi: TeviFoaie[]; alegeri: AlegereFoaie[]; eroare?: string } | null = null;
  /** Fișierul încărcat e deja la o lucrare (Faza 6, punctul 8): omul alege ce face. */
  let dublura: { fisier: File; id: string; titlu: string } | null = null;
  let ceasMesaj: ReturnType<typeof setTimeout> | undefined;
  let ceasSalvare: ReturnType<typeof setTimeout> | undefined;

  const optiuni = () => ({ stoc, mapari: mi.mapari, prag, destinatie, grosimiPropuse, descrieriSchimbate, preturiManuale, necitite });

  const coloane = controlColoane({
    foi: () => sesiune?.foi ?? [],
    cuPozitii: () => new Set((sesiune?.rez.linii ?? []).filter((l) => l.extras.sistem !== null).map((l) => l.bruta.foaie)),
    mapari: () => mi.mapari,
    fisier: () => sesiune?.meta.nume ?? "",
    aplicat: (mesaj, anulare) => {
      retarifeaza();
      deseneaza();
      arataMesaj(mesaj, () => { anulare(); retarifeaza(); });
    },
    deseneaza: () => deseneaza(),
    mesaj: (text) => arataMesaj(text),
  });

  gazda.innerHTML = `<div class="imp">
    <div id="imp-pagina" class="imp-pagina"></div>
    <div id="imp-mesaj"></div>
  </div>`;
  const pagina = gazda.querySelector<HTMLElement>("#imp-pagina")!;
  const elMesaj = gazda.querySelector<HTMLElement>("#imp-mesaj")!;

  /* ------------------------------------------------------------- ajutoare */
  const propunere = (l: LinieProcesata): number | null => {
    const e = l.extras;
    if (e.grosime_mm !== null || e.sistem === null || e.sistem === "goluri_foc") return null;
    if (e.diametru_valoare === null || !e.diametru_tip) return null;
    return grosimePropusa(e.sistem, e.diametru_valoare, e.diametru_tip);
  };

  /** Celulele din foaie ale unei pozitii, pentru editorul ei. */
  const campuriLinie = (s: Sesiune, l: LinieProcesata): CampuriRand | undefined => {
    const f = s.foi.find((x) => x.nume === l.bruta.foaie);
    const r = f?.randuri.find((x) => x.rand === l.bruta.rand);
    return f && r ? campuriRand(r, f.antet) : undefined;
  };

  /**
   * Celula descrierii, pe foaie: cea care tine cel mai lung text pe cele mai
   * multe pozitii. Hotarata o data pe foaie si tinuta minte, nu pe rand: golita
   * ca s-o rescrie omul, descrierea n-ar mai fi cel mai lung text, iar caseta
   * ar sari pe codul „IZOLATII”.
   */
  const coloanaDescrierii = new WeakMap<FoaieBruta, number>();
  function celulaDescriere(s: Sesiune, l: LinieProcesata): { cel: number; text: string } | undefined {
    const f = s.foi.find((x) => x.nume === l.bruta.foaie);
    if (!f) return undefined;
    if (!coloanaDescrierii.has(f)) {
      const voturi = new Map<number, number>();
      for (const r of f.randuri) {
        if (!r.linie) continue;
        let cel = -1;
        r.celule.forEach((c, i) => { if (typeof c.v === "string" && c.v.length > (cel < 0 ? 0 : String(r.celule[cel]!.v).length)) cel = i; });
        if (cel >= 0) voturi.set(cel, (voturi.get(cel) ?? 0) + 1);
      }
      const [cel] = [...voturi].sort((a, b) => b[1] - a[1])[0] ?? [-1];
      coloanaDescrierii.set(f, cel);
    }
    const cel = coloanaDescrierii.get(f)!;
    const r = f.randuri.find((x) => x.rand === l.bruta.rand);
    const v = cel >= 0 ? r?.celule[cel] : undefined;
    return v && (typeof v.v === "string" || v.v === null) ? { cel, text: String(v.v ?? "") } : undefined;
  }

  /** Pozitiile, sub filtrul de stare, apoi sub motiv. */
  function vizibile(s: Sesiune): {
    pozitiile: LinieProcesata[]; peStare: LinieProcesata[]; lista: LinieProcesata[];
  } {
    const izo = s.rez.linii.filter((l) => l.extras.sistem !== null);
    const pozitiile = izo;
    const peStare = filtru === "toate" ? pozitiile : pozitiile.filter((l) => potrivit(l, filtru));
    const m = motiv;
    const lista = m ? peStare.filter((l) => motiveLinie(l).includes(m)) : peStare;
    return { pozitiile, peStare, lista };
  }

  function arataMesaj(text: string, anulare: (() => void) | null = null): void {
    clearTimeout(ceasMesaj);
    invataAmanat();
    deAnulat = anulare;
    elMesaj.innerHTML = toast(text, anulare !== null);
    ceasMesaj = setTimeout(() => { elMesaj.innerHTML = ""; deAnulat = null; invataAmanat(); }, 7000);
  }

  /** Scrie sesiunea in istoric, amanat: la editarea unei celule vine un eveniment per tasta. */
  function salveazaSesiune(): void {
    if (!sesiune) return;
    clearTimeout(ceasSalvare);
    ceasSalvare = setTimeout(() => void salveazaAcum(), 400);
  }

  /**
   * Fara amanare: inainte de salvarea ofertei, care cere cererea ei pe server.
   * Un om grabit (sau un test) descarca oferta in mai putin de 400 ms de la
   * ultima corectura, iar oferta ar pleca inaintea cererii.
   */
  async function salveazaAcum(): Promise<void> {
    const s = sesiune;
    if (!s) return;
    clearTimeout(ceasSalvare);
    const deVerificat = deVerificatAcum(s);
    const intrebari = intrebariClient(s.rez.linii).length;
    await salveaza({
      ...s.meta,
      deVerificat, intrebari,
      pozitii: s.rez.statistici.liniiIzolatie,
      tarifate: s.rez.statistici.tarifate,
      valoare: s.rez.statistici.valoareTotala,
      extrase: [...s.rez.rezolvate].map(([index, r]) => ({
        index, extras: r.extras, sursa: r.sursa, ...(r.text !== undefined ? { text: r.text } : {}),
      })),
      editari: s.editari,
      destinatie,
      grosimiPropuse: [...grosimiPropuse],
      descrieriSchimbate: [...descrieriSchimbate],
      necitite: [...necitite],
      preturiManuale: [...preturiManuale],
      denumiri: [...denumiri],
      procente: [...procente],
      antet, ajustare,
      mapari: mapariFolosite(s.foi, mi.mapari),
    });
    opt.laSchimbare?.({ deVerificat, intrebari, antet });
  }

  /** Pozițiile care cer ochi: de verificat și fără preț, ca filele verificării. */
  function deVerificatAcum(s: Sesiune): number {
    const n = numereStare(s);
    return n.de_validat + n.netarifate;
  }

  function retarifeaza(): void {
    if (!sesiune) return;
    reevalueaza(sesiune.rez, optiuni());
    salveazaSesiune();
  }

  /* ------------------------------------------------------------ desenare */
  /** Câte redesenări au fost: celula ofertei redesenează după un clic doar dacă el n-a făcut-o. */
  let desenari = 0;
  /** Rândul din „Ca în ofertă” la care s-a scris pe loc: nu dispare din filtru cât scrii. */
  let randInLucru: number | null = null;
  function deseneaza(): void {
    desenari++;
    const areSesiune = sesiune !== null;
    // Cu fisierul deschis, foaia clientului are nevoie de toata latimea:
    // bara laterala se pliaza (temporar, fara sa schimbe preferinta omului).
    ceriSpatiu(gazda, areSesiune && pas !== 1);
    if (pas === 1 && dublura) {
      pagina.innerHTML = ecranDublura(dublura.fisier.name, dublura.titlu);
      pagina.querySelector<HTMLElement>('[data-act="dublura-deschide"]')?.focus();
    } else if (pas === 1 && deIzolat) {
      const d = deIzolat;
      pagina.innerHTML = ecranIzolatieFoaie({
        fisier: d.fisier.name, alegeri: d.alegeri, ...(d.eroare ? { eroare: d.eroare } : {}),
        foi: d.tevi.map((t) => ({
          nume: t.foaie, ignorate: t.ignorate,
          tevi: t.tevi.filter((x) => x.element === "ml").length,
          piese: t.tevi.filter((x) => x.element === "cot" || x.element === "teu" || x.element === "reductie").length,
          armaturi: t.tevi.filter((x) => x.element === "robinet" || x.element === "flansa").length,
        })),
      });
    } else if ((pas === 1 || !sesiune) && sursa === "poze") {
      pagina.innerHTML = `${fileSursa("poze")}<div id="imp-poze"></div>`;
      const loc = pagina.querySelector<HTMLElement>("#imp-poze")!;
      // Pozele trec prin aceeași verificare: „Trimite la ofertă” dă un registru, luat aici ca un fișier.
      void import("./santier.js").then(({ montezaPoze }) => {
        if (!loc.isConnected) return;
        void montezaPoze(loc, "oferta", {
          laOferta: () => {
            const p = preia();
            alegeSursa("excel");
            if (p) { destinatie = p.destinatie; void proceseaza(p.fisier, p); }
          },
        });
      });
    } else if (pas === 1 || !sesiune) {
      pagina.innerHTML = fileSursa("excel") + ecranStart({ destinatie, eroare: eroareStart, firma: { firme: FIRME, activ: firmaStart } });
      legaDrop();
    } else if (pas === 2) {
      pagina.innerHTML = paginaVerificare(sesiune);
    } else {
      const { oferta, deValidat, netarifate } = imparte(cuAjustare(cuProcente(sesiune.rez.linii, procente), ajustare));
      // „Materiale de comandat” și „Creează șantierul” au plecat de aici: șantierul pornește
      // la „Clientul a acceptat”, cu regulile firmei, iar regulile se schimbă pe fila Materiale.
      pagina.innerHTML = ecranOferta({
        gata: oferta.length, valoare: documentul(sesiune).totalGeneral,
        adaosFoc: adaosFocIndustrial(oferta, destinatie, antet.adaosFoc !== false), ajustare,
        areFoc: destinatie === "industrial" && oferta.some((l) => l.extras.sistem === "goluri_foc"),
        deVerificat: deValidat.length, faraPret: netarifate.length,
        destinatie, antet, firme: FIRME, eroare: "", descarcata: opt.areOferta?.() ?? false,
        inFisierulClientului: /\.xlsx$/i.test(sesiune.meta.nume),
      }) + `<section class="imp-card imp-cum-iese"><h2>Cum iese oferta</h2>
        <p class="hint">Exact ce descarci acum, doar pozițiile gata. Ce schimbi mai sus se vede aici.</p>
        <div id="cum-iese">${exportPeEcran(documentul(sesiune))}</div></section>`;
    }
  }

  /** „Cum iese oferta”, sub datele ofertei: refăcut la tastă, fără să atingă formularul de deasupra. */
  function actualizeazaCumIese(s: Sesiune): void {
    const el = pagina.querySelector("#cum-iese");
    if (el) el.innerHTML = exportPeEcran(documentul(s));
  }

  function alerte(s: Sesiune): string {
    const st = s.rez.statistici;
    return [
      s.avertisment,
      alertaNecitite(necitite.size, { plafon: plafonCitire, cuModel: info !== null, inLucru: reincercareInLucru }),
      st.randuriManopera > 0 && st.tarifate === 0
        ? `<p class="alerta"><strong>Ofertă de manoperă.</strong> Nu avem listă de prețuri pentru manoperă; prețurile din aplicație includ materialul.</p>`
        : "",
    ].join("");
  }

  function detalii(s: Sesiune): string {
    const st = s.rez.statistici;
    const r = (n: number | string, text: string): string => `<li><strong>${esc(String(n))}</strong> ${esc(text)}</li>`;
    return `<details class="imp-detalii"${detaliiDeschise ? " open" : ""}>
      <summary>Detalii despre citire</summary>
      <ul>
        ${r(`${st.foiMapate}/${st.foi}`, "foi cu coloanele recunoscute")}
        ${r(st.total, "rânduri cu text")}
        ${st.faraMasura ? r(st.faraMasura, "titluri și note, care nu sunt poziții") : ""}
        ${r(st.prinRegex, "poziții citite din reguli")}
        ${st.prinModel + st.prinSablon ? r(st.prinModel + st.prinSablon, "poziții citite automat din text") : ""}
        ${st.prinMemorie ? r(st.prinMemorie, "din corecturile făcute la importurile trecute") : ""}
        ${st.prinOm ? r(st.prinOm, "verificate de tine") : ""}
      </ul>
    </details>`;
  }

  /** Suma de sus a pasului „Oferta”, la fiecare tastă: ce plătește clientul, ca în document. */
  function arataValoarea(s: Sesiune): void {
    const { oferta } = imparte(cuAjustare(cuProcente(s.rez.linii, procente), ajustare));
    const v = pagina.querySelector("#valoare-oferta");
    const det = pagina.querySelector("#detaliu-valoare");
    if (v) v.textContent = eur(documentul(s).totalGeneral);
    if (det) det.innerHTML = detaliuValoare(adaosFocIndustrial(oferta, destinatie, antet.adaosFoc !== false), ajustare, antet.discount);
  }

  /** Documentul ofertei din sesiune, cu antetul si ajustarea de acum: acelasi din care se scrie Excelul. */
  function documentul(s: Sesiune, pastreaza: number | null = null): ReturnType<typeof documentOferta> {
    const firma = FIRME.find((f) => f.id === antet.firma) ?? FIRME[0];
    return documentOferta({
      linii: cuProcente(cuDenumiri(s.rez.linii, denumiri), procente),
      antet: {
        serie: firma.serieOferta, numar: antet.numar, data: antet.data, persoana: antet.persoana, client: antet.client,
        obiectiv: antet.obiectiv, firma: firma.denumire, localitate: antet.localitate,
        ...(antet.discount > 0 ? { discountProcent: antet.discount } : {}), ...(ajustare ? { ajustareProcent: ajustare } : {}),
        adaosFoc: antet.adaosFoc !== false,
      },
      provenienta: { generatLa: "", destinatie, model: s.meta.model, sesiune: s.meta.id, fisierSursa: s.meta.nume },
    }, pastreaza);
  }

  function numereStare(s: Sesiune): Record<FiltruStare, number> {
    const { pozitiile } = vizibile(s);
    return {
      toate: pozitiile.length,
      gata: pozitiile.filter((l) => potrivit(l, "gata")).length,
      de_validat: pozitiile.filter((l) => potrivit(l, "de_validat")).length,
      netarifate: pozitiile.filter((l) => potrivit(l, "netarifate")).length,
    };
  }

  /** Pentru textul întrebărilor: despre ce cerere e vorba și cine întreabă. */
  function dateEmail(s: Sesiune): DateEmail {
    const firma = FIRME.find((f) => f.id === antet.firma);
    return {
      despre: antet.obiectiv.trim() || antet.client.trim() || s.meta.nume.replace(/\.xlsx$/i, ""),
      ...(firma ? { firma: firma.denumire } : {}),
      maiMulteFoi: new Set(s.rez.linii.map((l) => l.bruta.foaie)).size > 1,
    };
  }

  function paginaVerificare(s: Sesiune): string {
    const numere = numereStare(s);
    const santier = opt.santier?.() ?? null;
    if (santier && !filtruAles) { filtru = "toate"; motiv = null; }
    if (!filtruAles && numere[filtru] === 0) { filtru = filtruImplicit(numere); motiv = null; }
    // Toate foile, pe capitolele clientului.
    const { peStare, lista } = vizibile(s);
    const motive = filtru === "de_validat" || filtru === "netarifate" ? numaraMotive(peStare) : [];
    const cuFoaie = s.foi.length > 1;
    const filtrat = filtru === "toate" && motiv === null ? null : new Set(lista.map((l) => l.extras.index));
    if (filtrat && randInLucru !== null) filtrat.add(randInLucru);
    const harta = new Map(s.rez.linii.map((l) => [l.extras.index, l]));
    if (randInLucru !== null) atinse.add(randInLucru);
    const activ = (document.activeElement as HTMLElement | null)?.closest<HTMLElement>("tr[data-idx]")?.dataset["idx"];
    for (const i of [...deschise]) if (!atinse.has(i) && String(i) !== activ) deschise.delete(i);

    const afara = lasateAfara(s.rez, necitite);
    const corp = vedereAfara ? listaAfara(afara, cuFoaie) : verificarePeEcran(documentul(s, randInLucru), {
      linii: harta, vizibile: filtrat, editIdx, propunere, cuFoaie, schimbari: schimbariPozitie(s), deschise: new Set([...deschise, ...atinse]),
      doarText: !!santier,
      descriere: (l) => celulaDescriere(s, l),
      um: (l) => { const c = campuriLinie(s, l)?.um; return c ? { cel: c.cel, v: String(c.v) } : undefined; },
    });

    return `${alerte(s)}
      <section class="imp-card">${antetVerificare({ nume: s.meta.nume, cand: s.meta.cand, destinatie, schimbaTip: tipDeschis })}${coloane.html()}</section>
      ${santier ? "" : cardIntrebari(intrebariClient(s.rez.linii), intrebariDeschise, dateEmail(s))}
      ${baraVerificare(numere, filtru, { n: afara.length, activ: vedereAfara }, santier)}
      ${vedereAfara ? "" : filtreMotiv(motive, motiv)}
      ${vedereAfara || santier ? "" : actiuniLista({
        deConfirmat: filtru === "de_validat" ? lista.length : 0,
        grosimi: lista.filter((l) => potrivit(l, "netarifate") && propunere(l) !== null).length,
      })}
      <div class="imp-lista">${corp}</div>
      ${detalii(s)}`;
  }

  /** Focus dupa redesenare: pe cardul atins, sau pe urmatorul cand acela a plecat din lista. */
  function focuseaza(idx: number | null, act = "modifica"): void {
    if (idx === null) return;
    const tinta = pagina.querySelector<HTMLElement>(`:is(.imp-poz, tr)[data-idx="${idx}"] [data-act="${act}"]`)
      ?? pagina.querySelector<HTMLElement>(`:is(.imp-poz, tr)[data-idx="${idx}"] button`);
    tinta?.focus();
  }

  /** Indexul cardului de dupa `idx` in lista vizibila, pentru focus. */
  function urmatorul(idx: number): number | null {
    if (!sesiune) return null;
    const { lista } = vizibile(sesiune);
    const i = lista.findIndex((l) => l.extras.index === idx);
    return lista[i + 1]?.extras.index ?? lista[i - 1]?.extras.index ?? null;
  }

  /* ------------------------------------------------------------- actiuni */
  function deschideSesiune(s: Sesiune, laPas: Pas = 2): void {
    sesiune = s;
    pas = laPas; filtru = filtruImplicit(numereStare(s)); filtruAles = false; motiv = null; editIdx = null; randInLucru = null;
    deschise.clear(); atinse.clear();
    vedereAfara = false;
    tipDeschis = false;
    // Latimea se masoara DUPA plierea barei, altfel ar decide pe locul pe
    // care il ocupa inca meniul. Sub prag, foaia 1:1 n-ar incapea fara
    // derulare laterala decat cu coloane de cateva litere: se deschide ca
    // lista, iar „Arată ca în Excel" ramane la un clic.
    ceriSpatiu(gazda, true);
    antet = s.meta.antet ? { ...s.meta.antet } : antetDinOferta(s.meta, s.foi);
    // Cererea nouă (fără antet și fără ofertă) ia firma aleasă înainte de fișier.
    if (!s.meta.antet && !citesteOferte()[s.meta.id]) antet = { ...antet, firma: firmaStart };
    ajustare = s.meta.ajustare ?? 0;
    eroareStart = "";
    salveazaSesiune();
    deseneaza();
    scrollTo({ top: 0 });
    // Deschisă direct pe fila Ofertă (adresa, reîncărcarea), nu trece prin `treciPe`.
    if (pas === 3) void propuneNumar();
  }

  function confirmaIndecsi(indecsi: number[]): void {
    const s = sesiune;
    if (!s || indecsi.length === 0) return;
    // Ce vedea omul (grosimea completată, golul de la aceeași țeavă), nu extragerea brută: altfel „Fără preț”.
    const inst = confirma(indecsi, s.rez.rezolvate, vazute(s.rez));
    retarifeaza();
    const n = inst.intrari.length;
    arataMesaj(n === 1 ? "Poziție confirmată." : `${cate(n, "poziții")} confirmate.`, () => {
      anuleaza(inst, s.rez.rezolvate);
      retarifeaza();
    });
  }

  /**
   * Corectura omului pe o pozitie: devine a lui. Tiparul se invata doar din
   * corecturile din editor — grosimea uzuala pusa cu un clic n-a scris-o
   * clientul, deci n-are ce cauta in memoria care citeste fisierele viitoare.
   * `laAnulare` pune inapoi ce a mai schimbat apelantul odata cu corectura
   * (celulele scrise din editor).
   */
  function corecteaza(idx: number, patch: Partial<LinieExtrasa>, invata = true, laAnulare?: () => void): void {
    const s = sesiune;
    const l = s?.rez.linii.find((x) => x.extras.index === idx);
    if (!s || !l) return;
    const vechi = s.rez.rezolvate.get(idx);
    const propusa = grosimiPropuse.get(idx);
    // O grosime propusa se vede in `l.extras`, dar n-a scris-o nimeni: fara
    // grosime noua in corectura, ramane goala, nu devine a omului.
    const dinPropunere = propusa !== undefined && vechi?.extras.grosime_mm === null;
    grosimiPropuse.delete(idx);
    const extras: LinieExtrasa = {
      ...l.extras, ...(dinPropunere && !("grosime_mm" in patch) ? { grosime_mm: null } : {}), ...patch,
    };
    s.rez.rezolvate.set(idx, { extras, sursa: "om" });
    retarifeaza();
    const noua = s.rez.linii.find((x) => x.extras.index === idx);
    editIdx = null;
    arataMesaj(extras.sistem === null ? "Rândul a fost scos din listă." : "Salvat.", () => {
      laAnulare?.();
      if (vechi) s.rez.rezolvate.set(idx, vechi); else s.rez.rezolvate.delete(idx);
      if (propusa !== undefined) grosimiPropuse.set(idx, propusa);
      retarifeaza();
    });
    if (invata && noua && noua.extras.sistem !== null) deInvatat = { text: noua.bruta.text, extras: noua.extras };
  }

  /**
   * „Salvează" din editorul de pozitie. Celulele schimbate — descriere, UM,
   * cantitate — se scriu in fisier ca orice corectura din foaie. Apoi:
   *  - campurile atinse de om (sau recitite cu „Citește din descriere") devin
   *    corectura lui, pe textul nou;
   *  - neatinse, cu descrierea schimbata: linia se reciteste din textul nou, ca
   *    la editarea din foaie, iar daca fusese verificata trece la „De verificat".
   * „Anulează" pune inapoi si celulele, nu doar extragerea.
   */
  function salveazaEditor(form: HTMLFormElement, idx: number): void {
    const s = sesiune;
    const l = s?.rez.linii.find((x) => x.extras.index === idx);
    const f = s?.foi.find((x) => x.nume === l?.bruta.foaie);
    const rand = f?.randuri.find((x) => x.rand === l?.bruta.rand);
    if (!s || !l || !rand) return;

    const celuleVechi = rand.celule.map((c) => c.v);
    const editariVechi = [...s.editari];
    let descriereNoua = false;
    for (const camp of form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("[data-cel]")) {
      const cel = Number(camp.dataset["cel"]);
      const c = rand.celule[cel];
      if (!c) continue;
      const scris = camp.value.trim().replace(",", ".");
      const nou = camp.name === "cantitate"
        ? (scris === "" || Number.isNaN(Number(scris)) ? c.v : Number(scris))
        : camp.value;
      if (nou === c.v) continue;
      if (camp.name === "text") descriereNoua = true;
      scrieCelula(rand, cel, nou);
      const editare: EditareCelula = { foaie: l.bruta.foaie, rand: rand.rand, cel, v: nou };
      const i = s.editari.findIndex((x) => x.foaie === editare.foaie && x.rand === editare.rand && x.cel === cel);
      if (i >= 0) s.editari[i] = editare; else s.editari.push(editare);
    }
    reconstruieste(rand);
    // Pretul pus de mana nu e o corectura a extragerii: se tine separat.
    const pmVechi = preturiManuale.get(idx);
    const pmScris = (form.querySelector<HTMLInputElement>('[name="pret_manual"]')?.value ?? "").trim().replace(",", ".");
    const pmNou = pmScris === "" || !(Number(pmScris) > 0) ? undefined : Number(pmScris);
    const pretSchimbat = pmNou !== pmVechi;
    if (pmNou === undefined) preturiManuale.delete(idx); else preturiManuale.set(idx, pmNou);
    const inapoi = (): void => {
      celuleVechi.forEach((v, cel) => { if (rand.celule[cel]?.v !== v) scrieCelula(rand, cel, v); });
      reconstruieste(rand);
      s.editari.splice(0, s.editari.length, ...editariVechi);
      if (pmVechi === undefined) preturiManuale.delete(idx); else preturiManuale.set(idx, pmVechi);
    };

    if (form.dataset["atins"] !== "da" && !descriereNoua && pretSchimbat) {
      retarifeaza();
      editIdx = null;
      arataMesaj(pmNou === undefined
        ? "Prețul pus de mână a fost scos: poziția ia prețul din listă."
        : "Prețul pus de mână a fost salvat.", () => { inapoi(); retarifeaza(); });
      return;
    }
    if (form.dataset["atins"] === "da" || !descriereNoua) {
      corecteaza(idx, patchDinFormular(new FormData(form)), true, inapoi);
      return;
    }
    const vechi = s.rez.rezolvate.get(idx);
    const marcataInainte = descrieriSchimbate.has(idx);
    retarifeaza();
    editIdx = null;
    const dupa = s.rez.linii.find((x) => x.extras.index === idx);
    arataMesaj(dupa?.necesitaValidare
      ? "Descrierea a fost salvată: poziția e recitită și trece la „De verificat”."
      : "Descrierea a fost salvată și poziția recitită.", () => {
      inapoi();
      if (vechi) s.rez.rezolvate.set(idx, vechi);
      if (!marcataInainte) descrieriSchimbate.delete(idx);
      retarifeaza();
    });
  }

  /**
   * „Citește din descriere": campurile editorului, recitite determinist din
   * textul din formular, inainte de salvare — ca omul sa vada ce iese si sa
   * completeze ce lipseste, de exemplu grosimea tablei de inox.
   */
  function reciteste(form: HTMLFormElement, idx: number): void {
    const s = sesiune;
    const l = s?.rez.linii.find((x) => x.extras.index === idx);
    const campuri = s && l ? campuriLinie(s, l) : undefined;
    if (!l || !campuri) return;
    const valori = new Map([...form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('[name="text"][data-cel]')]
      .map((t) => [Number(t.dataset["cel"]), t.value] as const));
    let text = l.bruta.text;
    for (const c of campuri.texte) {
      const vechi = String(c.v).trim();
      const nou = (valori.get(c.cel) ?? String(c.v)).trim();
      if (nou === vechi) continue;
      text = vechi && text.includes(vechi) ? text.replace(vechi, nou) : `${text} | ${nou}`;
    }
    const um = form.querySelector<HTMLInputElement>('[name="um"]')?.value.trim() || l.bruta.um;
    const cantitate = Number(form.querySelector<HTMLInputElement>('[name="cantitate"]')?.value.replace(",", "."));
    const extras = citesteText(idx, text, um, (l.bruta as { sectiune?: string }).sectiune,
      Number.isFinite(cantitate) && cantitate > 0 ? cantitate : l.bruta.cantitate);

    const gazdaForm = document.createElement("div");
    gazdaForm.innerHTML = editorPozitie({ ...l, extras }, {
      campuri: { ...campuri, texte: campuri.texte.map((c) => ({ ...c, v: valori.get(c.cel) ?? c.v })) },
    });
    const nou = gazdaForm.firstElementChild as HTMLFormElement;
    for (const nume of ["um", "cantitate"]) {
      const vechiCamp = form.querySelector<HTMLInputElement>(`[name="${nume}"]`);
      const nouCamp = nou.querySelector<HTMLInputElement>(`[name="${nume}"]`);
      if (vechiCamp && nouCamp) nouCamp.value = vechiCamp.value;
    }
    nou.dataset["atins"] = "da";
    form.replaceWith(nou);
    nou.querySelector<HTMLElement>('[data-act="reciteste"]')?.focus();
    arataMesaj(extras.sistem === null
      ? "Din descriere nu reiese o poziție de izolație."
      : "Câmpurile au fost recitite din descriere. Verifică-le și salvează.");
  }

  async function redeschide(id: string, restaurat: boolean): Promise<void> {
    const s = await incarca(id);
    if (!s) {
      puneCurent(null);
      eroareStart = "<strong>Cererea nu s-a putut deschide.</strong> Reîncarcă pagina; dacă tot nu merge, poate a șters-o un coleg.";
      deseneaza();
      return;
    }
    pagina.innerHTML = ecranProgres(`Se deschide ${s.nume}…`, null);
    const { redeschideImport } = await import("../../src/import/redeschide.js");
    destinatie = s.destinatie ?? "rezidential";
    grosimiPropuse = new Map(s.grosimiPropuse ?? []);
    descrieriSchimbate = new Set(s.descrieriSchimbate ?? []);
    necitite = new Set(s.necitite ?? []);
    plafonCitire = "";
    preturiManuale = new Map(s.preturiManuale ?? []);
    denumiri = new Map(s.denumiri ?? []);
    procente = new Map(s.procente ?? []);
    mi = await mapariImport(s.mapari);
    const rez = await redeschideImport(s, optiuni());
    puneCurent(id);
    deschideSesiune({ foi: rez.foi, rez, meta: s, editari: [...s.editari], avertisment: "" }, pas === 3 ? 3 : 2);
    if (!restaurat) arataMesaj(`Ai deschis ${s.nume}.`);
  }

  /**
   * Extractorul ecranului: rândurile pleacă la server în loturi mici, câte
   * patru deodată, iar bara de progres e una pentru toate apelurile (două
   * citiri, a doua trecere). Un lot căzut nu oprește nimic: rândurile lui nu se
   * întorc, nucleul le ține `necitite`. Plafonul zilnic (429) se ține în
   * `stare.plafon`, cu mesajul serverului.
   */
  function extractorPeLoturi(m: StareModel, titlu: string): { extractor: Extractor; stare: { plafon: string } } {
    const stare = { plafon: "" };
    let totLoturi = 0;
    let gata = 0;
    const extractor: Extractor = async (deTrimis, ctx) => {
      const lot = m.lot ?? LOT_IMPLICIT;
      const loturi: (typeof deTrimis)[] = [];
      for (let i = 0; i < deTrimis.length; i += lot) loturi.push(deTrimis.slice(i, i + lot));
      totLoturi += loturi.length;
      const primite: LinieExtrasa[] = [];
      let urmator = 0;
      const arata = (): void => {
        pagina.innerHTML = ecranProgres(ctx.citire ? `${titlu}, de două ori, ca să fie sigure…` : `${titlu}…`,
          totLoturi ? (gata / totLoturi) * 100 : 100);
      };
      arata();
      const lucrator = async (): Promise<void> => {
        for (let i = urmator++; i < loturi.length; i = urmator++) {
          try {
            const r = await fetch(RUTA_MODEL, {
              method: "POST", headers: { "Content-Type": "application/json", "X-Izorep": "1" },
              body: JSON.stringify({ linii: loturi[i] }), signal: AbortSignal.timeout(120_000),
            });
            const corp = (await r.json()) as { linii?: LinieExtrasa[]; eroare?: string };
            if (r.status === 429 && corp.eroare) stare.plafon = corp.eroare;
            if (!r.ok) throw new Error(corp.eroare ?? `HTTP ${r.status}`);
            primite.push(...(corp.linii ?? []));
          } catch {
            // Un lot căzut nu invalidează importul: rândurile lui rămân necitite.
          } finally {
            gata++;
            arata();
          }
        }
      };
      const n = Math.min(m.concurenta ?? CONCURENTA_IMPLICITA, Math.max(loturi.length, 1));
      await Promise.all(Array.from({ length: n }, lucrator));
      return primite;
    };
    return { extractor, stare };
  }

  /**
   * „Încearcă din nou” (Faza 6, punctul 7): doar rândurile necitite pleacă la
   * model; ce a scris omul între timp rămâne. Modelul se întreabă din nou
   * (poate a pornit între timp); fără el, butonul spune că nu se poate acum.
   */
  async function reincearca(): Promise<void> {
    const s = sesiune;
    if (!s || reincercareInLucru || necitite.size === 0) return;
    const m = info ?? await interogheazaModel();
    if (!m) {
      arataMesaj("Rândurile nu se pot citi automat acum. Încearcă mai târziu sau completează-le de mână.");
      return;
    }
    reincercareInLucru = true;
    const inainte = necitite.size;
    const citire = extractorPeLoturi(m, "Se citesc din nou rândurile");
    try {
      await recitesteNecitite(s.rez, { ...optiuni(), extrage: citire.extractor });
    } finally {
      reincercareInLucru = false;
    }
    plafonCitire = citire.stare.plafon;
    salveazaSesiune();
    deseneaza();
    const citite = inainte - necitite.size;
    arataMesaj(necitite.size === 0
      ? (citite === 1 ? "Rândul a fost citit." : `Toate cele ${citite} rânduri au fost citite.`)
      : `${citite === 0 ? "Niciun rând n-a fost citit" : `${citite} din ${inainte} rânduri au fost citite`}; ${necitite.size === 1 ? "unul a rămas" : `${necitite.size} au rămas`}.`);
  }

  async function proceseaza(fisier: File, predare?: Predare, caNou = false): Promise<void> {
    deIzolat = null;
    dublura = null;
    // Același fișier, a doua oară: întâi întrebarea. Nu și pentru pozele din carnet (registru nou de fiecare dată).
    if (!caNou && !predare) {
      pagina.innerHTML = ecranProgres(`Se citește ${fisier.name}…`, null);
      const l = await lucrareaFisierului(await fisier.arrayBuffer(), sesiune?.meta.id ?? opt.cerere);
      if (l) {
        pas = 1;
        dublura = { fisier, ...l };
        deseneaza();
        return;
      }
    }
    pas = 2;
    let nou: SesiuneImport | null = null;
    pagina.innerHTML = ecranProgres(`Se citește ${fisier.name}…`, null);
    try {
      const { parseFoiBuffer } = await import("../../src/import/parse-workbook.js");
      const buf = await fisier.arrayBuffer();
      const foi = await parseFoiBuffer(buf.slice(0));

      let plafon = "";
      // Coloanele unui antet necunoscut, citite cu modelul înaintea pozițiilor (Faza 6, punctul 1).
      mi = await mapariImport();
      if (info) {
        pagina.innerHTML = ecranProgres("Se citesc coloanele…", null);
        plafon = await citesteColoanele(foi, fisier.name, mi);
      }
      const citire = info ? extractorPeLoturi(info, "Se recunosc pozițiile") : undefined;
      const extractor = citire?.extractor;

      // Propunerile tin de indecsii fisierului de dinainte.
      grosimiPropuse = new Map();
      descrieriSchimbate = new Set();
      necitite = new Set();
      plafonCitire = citire?.stare.plafon ?? "";
      preturiManuale = new Map();
      denumiri = new Map();
      procente = new Map();
      const rez = await proceseazaRegistru(foi, { ...optiuni(), ...(extractor ? { extrage: extractor } : {}) });
      // Lista de tevi a instalatorului, fara izolatie pe rand: izolatia se alege pe foaie.
      const tevi = rez.linii.some((l) => l.extras.sistem !== null) ? [] : foi.map(tevileFoii).filter((t) => t.tevi.length >= 3);
      if (tevi.length > 0) {
        pas = 1;
        deIzolat = { fisier, tevi, alegeri: tevi.map(() => ({ ...ALEGERE_INITIALA })) };
        deseneaza();
        return;
      }
      if (rez.linii.length === 0) {
        pas = 1;
        eroareStart = `<strong>${esc(fisier.name)} nu are poziții.</strong> ${esc(FARA_POZITII)}`;
        deseneaza();
        return;
      }
      // Din notitele de santier: „(pret dublu)" scris pe foaie si confirmat de
      // om acolo. Pretul iese de doua ori cel din lista, ca pret pus de mana,
      // deci pozitia arata si ce dadea lista.
      if (predare?.pretDublu) {
        for (const l of rez.linii) {
          if (l.pret && l.bruta.text.includes(MARCA_PRET_DUBLU)) {
            preturiManuale.set(l.extras.index, Math.round(l.pret.pret_unitar * 2 * 100) / 100);
          }
        }
        if (preturiManuale.size > 0) reevalueaza(rez, optiuni());
      }
      plafonCitire = citire?.stare.plafon ?? "";
      // Lotul căzut nu mai cere fișierul din nou: rândurile lui sunt `necitite`, cu „Încearcă din nou”.
      deschideSesiune({
        foi, rez, editari: [],
        avertisment: plafon && !plafonCitire
          ? `<p class="alerta"><strong>O parte din rânduri n-au fost citite cu model.</strong> ${esc(plafon)}</p>`
          : "",
        meta: {
          id: `${Date.now()}-${fisier.name}`, nume: fisier.name, marime: fisier.size,
          cand: new Date().toISOString(), model: info?.model ?? null, fisier: buf,
          pozitii: 0, tarifate: 0, valoare: 0, extrase: [], editari: [],
        },
      });
      nou = sesiune?.meta ?? null;
    } catch (e) {
      pas = 1;
      // Detaliul tehnic ramane in consola, pentru noi; omul primeste ce sa faca.
      console.error(e);
      eroareStart = `<strong>Fișierul nu a putut fi citit.</strong> ${esc(fisierNecitit(fisier.name))}`;
      deseneaza();
    }
    // Cererea nouă e salvată întâi: pagina lucrării ei o caută apoi în listă.
    if (nou) {
      await salveazaAcum();
      opt.laCerereNoua?.(nou.id);
    }
  }

  /**
   * Din alegerile de pe foi, lista de izolatii: aceleasi randuri ca din
   * carnet (`spreCerere`), intr-un registru nou, citit apoi ca orice fisier.
   */
  async function faListaDeIzolatii(form: HTMLFormElement): Promise<void> {
    const d = deIzolat;
    if (!d) return;
    const date = new FormData(form);
    d.alegeri = d.tevi.map((_, i) => alegereDin(date, i));
    const randuri = d.tevi.flatMap((t, i) => {
      const a = izolatieDin(d.alegeri[i]!);
      return a ? randuriIzolate(t, a).randuri : [];
    });
    if (randuri.length === 0) {
      d.eroare = "Alege izolația pe cel puțin o foaie.";
      deseneaza();
      return;
    }
    const [{ spreCerere }, { registruCerere }] = await Promise.all([
      import("../../src/santier/spre-cerere.js"), import("../../src/santier/registru.js"),
    ]);
    const titlu = d.fisier.name.replace(/\.xlsx$/i, "");
    const buf = await registruCerere(spreCerere(randuri), `${titlu} - izolatia pe foaie`);
    deIzolat = null;
    await proceseaza(new File([buf], `${titlu} - izolatie pe foaie.xlsx`, {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }));
  }

  function cerereDinFormular(s: Sesiune, form: HTMLFormElement): CerereOferta {
    const date = new FormData(form);
    const val = (n: string): string => ((date.get(n) as string | null) ?? "").trim();
    const firma = FIRME.find((f) => f.id === val("firma")) ?? FIRME[0]!;
    const antet: AntetOferta = {
      serie: firma.serieOferta, numar: val("numar"), data: val("data"), persoana: val("persoana"),
      client: val("client"), obiectiv: val("obiectiv"), firma: firma.denumire, localitate: val("localitate"),
      // Fără bifă pe pagină (rezidențial, sau fără închideri la foc) adaosul n-are pe ce se aplica.
      adaosFoc: form.querySelector('[name="adaosFoc"]') ? date.get("adaosFoc") === "da" : false,
    };
    const procent = Number(val("discount").replace(",", "."));
    if (Number.isFinite(procent) && procent > 0) {
      antet.discountProcent = procent;
      antet.discountConditie = "PENTRU PLATA FACTURII FISCALE IN TERMEN DE 5-7 ZILE CALENDARISTICE DE LA DATA EMITERII";
    }
    if (ajustare) antet.ajustareProcent = ajustare;
    return {
      linii: cuProcente(cuDenumiri(s.rez.linii, denumiri), procente), antet,
      provenienta: {
        generatLa: new Date().toISOString(), destinatie, model: s.meta.model,
        sesiune: s.meta.id, fisierSursa: s.meta.nume,
      },
    };
  }

  /**
   * Fișierul clientului cu prețurile ofertei (Etapa 5): aceleași linii și sume
   * ca oferta noastră, scrise după ultima coloană a fiecărei foi.
   */
  async function inFisierulClientului(s: Sesiune, cerere: CerereOferta): Promise<ArrayBuffer> {
    const { ofertaInFisierulClientului } = await import("../oferta-client.js");
    const ultimulRand = new Map<string, number>();
    for (const l of s.rez.linii) {
      if (l.extras.sistem !== null) ultimulRand.set(l.bruta.foaie, Math.max(ultimulRand.get(l.bruta.foaie) ?? 0, l.bruta.rand));
    }
    const r = await ofertaInFisierulClientului(s.meta.fisier, {
      oferta: imparte(cuAjustare(cerere.linii, cerere.antet.ajustareProcent ?? 0)).oferta,
      destinatie: cerere.provenienta.destinatie,
      ...(cerere.antet.discountProcent ? { discountProcent: cerere.antet.discountProcent } : {}),
      adaosFoc: cerere.antet.adaosFoc !== false,
      randAntet: new Map(s.foi.flatMap((f) => (f.antet ? [[f.nume, f.antet.rand] as const] : []))),
      ultimulRand,
    });
    return r.fisier;
  }

  async function genereazaOferta(form: HTMLFormElement, inClient = false): Promise<void> {
    const s = sesiune;
    if (!s) return;
    const cerere = cerereDinFormular(s, form);
    const { antet } = cerere;
    const buton = form.querySelector<HTMLButtonElement>(inClient ? '[data-act="descarca-client"]' : 'button[type="submit"]')!;
    const eticheta = buton.textContent;
    buton.disabled = true;
    buton.textContent = "Se pregătește…";
    form.querySelector(".alerta")?.remove();
    try {
      let buf: ArrayBuffer;
      if (inClient) {
        buf = await inFisierulClientului(s, cerere);
      } else {
        const { registruOferta } = await import("../registru-oferta.js");
        const logo = logoFirmei(antet.firma);
        const base64 = logo ? await logoBase64(logo.fisier) : null;
        buf = await registruOferta(cerere, logo && base64 ? { logo: { ...logo, base64 } } : {});
      }
      // Salvata INAINTE de descarcare: ce pleaca la client e exact ce s-a
      // salvat. Pe server e o versiune noua; in browser, doar sumarul.
      const { valoare, pozitii } = valoareOferta(cerere);
      const firma = String(new FormData(form).get("firma") ?? FIRME[0].id);
      await salveazaAcum();
      await salveazaOferta(s.meta.id, firma, cerere, {
        numar: antet.numar ? `${antet.serie}${antet.numar}` : "", data: antet.data, client: antet.client,
        obiectiv: antet.obiectiv, valoare, pozitii, cand: new Date().toISOString(),
      });
      const nume = numeOferta(antet.serie, antet.numar, antet.data);
      descarca(buf, inClient ? nume.replace(/\.xlsx$/, " - in fisierul clientului.xlsx") : nume);
      arataMesaj(inClient ? "Oferta a fost salvată și descărcată în fișierul clientului." : "Oferta a fost salvată și descărcată.");
      // Albastrul trece pe răspunsul clientului, din „Urmează”; fără redesenare, ca formularul să rămână cum e.
      form.querySelector<HTMLButtonElement>('button[type="submit"]')!.className = "secundar";
      opt.laOferta?.();
    } catch (err) {
      form.querySelector(".imp-formular-butoane")!.insertAdjacentHTML("beforebegin",
        `<p class="alerta" role="alert">Oferta nu s-a putut salva și descărca: ${esc(err instanceof Error ? err.message : String(err))}</p>`);
    } finally {
      buton.disabled = false;
      buton.textContent = eticheta;
    }
  }

  /** Ultimul număr pus de server, ca la schimbarea firmei să se ia numărul ei, nu să rămână al celeilalte. */
  let numarPropus = "";
  /**
   * Numărul ofertei îl dă serverul (21 octombrie 2026): cu caseta goală (sau
   * cu numărul propus pentru altă firmă), următorul număr liber al firmei.
   * Rămâne modificabil; unul deja folosit de altă cerere e refuzat la salvare.
   */
  async function propuneNumar(): Promise<void> {
    if (!sesiune || (antet.numar && antet.numar !== numarPropus)) return;
    const n = await urmatorulNumar(antet.firma);
    if (!n || pas !== 3 || (antet.numar && antet.numar !== numarPropus)) return;
    numarPropus = n;
    antet = { ...antet, numar: n };
    salveazaSesiune();
    const camp = pagina.querySelector<HTMLInputElement>('#antet-oferta [name="numar"]');
    if (camp) camp.value = n;
  }

  /** Șantierul din cererea deschisă, cu ce e scris acum în ea. */
  function santierAcum(reguli: ReguliNecesar = REGULI_FIRMEI): RezultatSantier {
    const s = sesiune;
    if (!s) return { eroare: "Cererea nu e deschisă." };
    return santierDin({ meta: s.meta, rez: s.rez, antet, ajustare, destinatie, denumiri, procente }, reguli);
  }

  /* ------------------------------------------ oferta scrisă pe loc */
  // Tabelul „Ca în ofertă” se scrie ca un Excel (Andrei, 15 octombrie 2026).
  // Cantitatea e celula din fișierul clientului, ca o corectură în foaie;
  // prețul e prețul pus de mână; denumirea e doar a ofertei, nu schimbă ce
  // s-a citit din rând. Toate trei se salvează în sesiune.

  /** Ce a schimbat omul pe fiecare poziție a ofertei, cu ce era înainte. */
  function schimbariPozitie(s: Sesiune): (p: PozitieOferta) => SchimbariPozitie {
    const harta = new Map(s.rez.linii.map((l) => [l.extras.index, l]));
    return (p) => {
      const l = harta.get(p.linie);
      const r: SchimbariPozitie = {};
      if (!l) return r;
      if (denumiri.has(p.linie)) r.den = `Din fișierul clientului: ${textClient(l)}`;
      const e = editareCantitate(s, l);
      if (e) {
        r.cant = typeof e.inainte === "number" ? `În fișierul clientului: ${numarInCelula(e.inainte)}`
          : "Schimbată față de fișierul clientului";
      }
      if (preturiManuale.has(p.linie)) {
        const nota = (l.pret as { note?: string[] } | null)?.note?.find((n) => n.startsWith("pret unitar pus de om"));
        const liste = nota?.split("; ")[1]?.match(/iesea ([\d.]+)/)?.[1];
        r.pret = liste ? `Din listă: ${eur(Number(liste))}` : "Fără preț în listă";
      }
      return r;
    };
  }

  function celulaCantitate(s: Sesiune, l: LinieProcesata): { rand: FoaieBruta["randuri"][number]; cel: number } | null {
    const rand = s.foi.find((x) => x.nume === l.bruta.foaie)?.randuri.find((x) => x.rand === l.bruta.rand);
    const cel = campuriLinie(s, l)?.cantitate?.cel;
    return rand && cel !== undefined ? { rand, cel } : null;
  }

  function editareCantitate(s: Sesiune, l: LinieProcesata): EditareCelula | undefined {
    const c = celulaCantitate(s, l);
    return c ? s.editari.find((x) => x.foaie === l.bruta.foaie && x.rand === l.bruta.rand && x.cel === c.cel) : undefined;
  }

  /** Cantitatea scrisă în ofertă: celula ei din fișier, ca o corectură în foaie. */
  function scrieCantitatea(idx: number, valoare: number, peLoc = false): boolean {
    const s = sesiune;
    const l = s?.rez.linii.find((x) => x.extras.index === idx);
    if (!s || !l) return false;
    const c = celulaCantitate(s, l);
    if (!c) {
      if (!peLoc) arataMesaj("Cantitatea acestei poziții nu e într-o celulă a fișierului: o schimbi din „Modifică”.");
      return false;
    }
    const vechi = c.rand.celule[c.cel]?.v ?? null;
    if (vechi === valoare) return false;
    const editariVechi = [...s.editari];
    const anterioara = editareCantitate(s, l);
    const inainte = anterioara ? anterioara.inainte ?? null : vechi;
    scrieCelula(c.rand, c.cel, valoare);
    reconstruieste(c.rand);
    const fara = s.editari.filter((x) => x !== anterioara);
    // Înapoi la cifra din fișier: nu mai e o corectură.
    s.editari.splice(0, s.editari.length, ...fara,
      ...(inainte === valoare ? [] : [{ foaie: l.bruta.foaie, rand: l.bruta.rand, cel: c.cel, v: valoare, inainte }]));
    retarifeaza();
    // Cât scrie, cifra și totalul se schimbă sub ochii lui: mesajul ar veni la fiecare tastă.
    if (peLoc) return true;
    arataMesaj("Cantitatea a fost schimbată.", () => {
      scrieCelula(c.rand, c.cel, vechi);
      reconstruieste(c.rand);
      s.editari.splice(0, s.editari.length, ...editariVechi);
      retarifeaza();
    });
    return true;
  }

  /**
   * Prețul scris în ofertă e prețul pus de mână. Pe ecran prețul are deja
   * ajustarea tehnicului, deci se scrie fără ea: altfel 100 € scris ar ieși
   * 110 € cu +10 %. Gol = prețul din listă.
   */
  function scriePretul(idx: number, valoare: number | null, peLoc = false): boolean {
    const vechi = preturiManuale.get(idx);
    // Prețul scris e cel final din ofertă: ajustarea nu-l mai atinge (`cuAjustare`).
    const nou = valoare === null || !(valoare > 0) ? undefined : valoare;
    if (nou === vechi) return false;
    if (nou === undefined) preturiManuale.delete(idx); else preturiManuale.set(idx, nou);
    retarifeaza();
    if (peLoc) return true;
    arataMesaj(nou === undefined ? "Poziția ia din nou prețul din listă." : "Prețul a fost scris.", () => {
      if (vechi === undefined) preturiManuale.delete(idx); else preturiManuale.set(idx, vechi);
      retarifeaza();
    });
    return true;
  }

  /**
   * Discount sau adaos pe rând (Etapa 4): −5 = cu 5 % mai ieftin, 10 = cu 10 %
   * mai scump, față de prețul din listă. Înlocuiește ajustarea pe toată oferta
   * pentru rândul ăsta; gol sau 0 îl scoate.
   */
  function scrieProcentul(idx: number, valoare: number | null, peLoc = false): boolean {
    const vechi = procente.get(idx);
    const nou = valoare === null || valoare === 0 || !(valoare > -100 && valoare <= 500) ? undefined : valoare;
    if (valoare !== null && valoare !== 0 && nou === undefined) {
      if (!peLoc) arataMesaj("Procentul se scrie ca număr între −99 și 500, de exemplu −5 sau 10.");
      return false;
    }
    if (nou === vechi) return false;
    if (nou === undefined) procente.delete(idx); else procente.set(idx, nou);
    salveazaSesiune();
    if (peLoc) return true;
    arataMesaj(nou === undefined ? "Rândul ia din nou prețul din listă." : "Procentul a fost pus pe rând.", () => {
      if (vechi === undefined) procente.delete(idx); else procente.set(idx, vechi);
      salveazaSesiune();
      deseneaza();
    });
    return true;
  }

  /** Denumirea scrisă în ofertă. Textul clientului, scris la loc sau șters, o scoate. */
  function scrieDenumirea(el: HTMLElement): void {
    const s = sesiune;
    const idx = Number(el.dataset["idx"]);
    const l = s?.rez.linii.find((x) => x.extras.index === idx);
    if (!s || !l) return;
    const original = textClient(l);
    const scris = (el.textContent ?? "").replace(/\s+/g, " ").trim();
    const vechi = denumiri.get(idx);
    const nou = scris === "" || scris === original ? undefined : scris;
    if (nou === vechi) return;
    if (nou === undefined) denumiri.delete(idx); else denumiri.set(idx, nou);
    salveazaSesiune();
    // Fără redesenare: clicul care a scos cursorul din celulă trebuie să-și atingă ținta.
    el.textContent = nou ?? original;
    el.classList.toggle("schimbat", nou !== undefined);
    if (nou === undefined) el.removeAttribute("title"); else el.title = `Din fișierul clientului: ${original}`;
    arataMesaj(nou === undefined ? "Poziția are din nou textul clientului." : "Denumirea a fost schimbată.", () => {
      if (vechi === undefined) denumiri.delete(idx); else denumiri.set(idx, vechi);
      salveazaSesiune();
      deseneaza();
    });
  }

  /* ---------------------------------------------------------- evenimente */
  function alegeSursa(s: "excel" | "poze"): void {
    sursa = s;
    // Doar pe „Cerere nouă” fila sursei e în adresă; pe o lucrare, adresa e a lucrării.
    if (/^#\/lucrari\/noua/.test(location.hash)) history.replaceState(null, "", s === "poze" ? "#/lucrari/noua/poze" : "#/lucrari/noua");
  }

  function legaDrop(): void {
    const drop = pagina.querySelector<HTMLElement>("#drop");
    if (!drop) return;
    drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("peste"); });
    drop.addEventListener("dragleave", () => drop.classList.remove("peste"));
    drop.addEventListener("drop", (e) => {
      e.preventDefault();
      drop.classList.remove("peste");
      const f = e.dataTransfer?.files[0];
      if (f) void proceseaza(f);
    });
  }

  function deschideRandul(tr: HTMLElement, camp: string): void {
    const idx = Number(tr.dataset["idx"]);
    deschise.add(idx);
    deseneaza();
    const rand = pagina.querySelector<HTMLElement>(`tr.ver-poz[data-idx="${idx}"]`);
    const tinta = rand?.querySelector<HTMLElement>(CASETA_COLOANEI[camp] ?? CASETA_COLOANEI["desc"]!)
      ?? rand?.querySelector<HTMLElement>("input, select, [contenteditable]");
    tinta?.focus();
  }

  gazda.addEventListener("keydown", (e) => {
    const tr = (e.target as HTMLElement).closest?.<HTMLElement>("tr.ver-citit");
    if (tr && tr === e.target && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      deschideRandul(tr, "desc");
      return;
    }
    if (e.key !== "Escape") return;
    const m = (e.target as HTMLElement).closest<HTMLElement>(".meniu-rand:not([hidden])");
    if (!m) return;
    m.hidden = true;
    const b = m.parentElement?.querySelector<HTMLElement>(".cel-meniu");
    b?.setAttribute("aria-expanded", "false");
    b?.focus();
  });

  gazda.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    // Meniul „⋯” al rândului: se deschide sub buton; orice alt clic îl închide.
    for (const m of gazda.querySelectorAll<HTMLElement>(".meniu-rand:not([hidden])")) {
      if (m.parentElement?.contains(t)) continue;
      m.hidden = true;
      m.parentElement?.querySelector(".cel-meniu")?.setAttribute("aria-expanded", "false");
    }

    // Un rând „Gata” scris ca text: clicul (nu pe „⋯”) îl deschide, cu cursorul pe coloana atinsă.
    const citit = t.closest<HTMLElement>("tr.ver-citit");
    if (citit && !t.closest("button, a, input, select, .meniu-rand")) {
      deschideRandul(citit, t.closest<HTMLElement>("td[data-camp]")?.dataset["camp"] ?? "desc");
      return;
    }

    const bPas = t.closest<HTMLButtonElement>("[data-pas]");
    if (bPas) {
      treciPe(Number(bPas.dataset["pas"]) as Pas);
      opt.laParte?.(PARTE[pas]);
      return;
    }

    // Tipul deschis cu „schimbă”, ales din nou același: nu vine `change`, deci se închide de aici.
    const seg = t.closest<HTMLInputElement>('.imp-antet input[name="segment"]');
    if (seg && tipDeschis && seg.value === destinatie) {
      tipDeschis = false;
      deseneaza();
      pagina.querySelector<HTMLElement>('[data-act="schimba-tip"]')?.focus();
      return;
    }

    const bFiltru = t.closest<HTMLButtonElement>("[data-filtru]");
    if (bFiltru) {
      vedereAfara = bFiltru.dataset["filtru"] === "afara";
      if (vedereAfara) { editIdx = null; randInLucru = null; deseneaza(); pagina.querySelector<HTMLElement>('[data-filtru="afara"]')?.focus(); return; }
      filtru = bFiltru.dataset["filtru"] as FiltruStare; filtruAles = true; motiv = null; editIdx = null; randInLucru = null;
      deseneaza();
      pagina.querySelector<HTMLElement>(`[data-filtru="${filtru}"]`)?.focus();
      return;
    }

    const bMotiv = t.closest<HTMLButtonElement>("[data-motiv]");
    if (bMotiv) { const m = bMotiv.dataset["motiv"] as CodMotiv; motiv = motiv === m ? null : m; randInLucru = null; deseneaza(); return; }

    const b = t.closest<HTMLButtonElement>("button[data-act]");
    const act = b?.dataset["act"];
    if (!b || !act) return;
    if (coloane.click(b)) return;
    const idx = b.dataset["idx"] !== undefined ? Number(b.dataset["idx"]) : null;

    switch (act) {
      case "schimba-fisier": pas = 1; editIdx = null; deseneaza(); scrollTo({ top: 0 }); return;
      case "sursa": {
        alegeSursa(b.dataset["sursa"] === "poze" ? "poze" : "excel");
        deseneaza();
        pagina.querySelector<HTMLElement>(`[data-sursa="${sursa}"]`)?.focus();
        return;
      }
      case "renunta-izolatie": deIzolat = null; deseneaza(); scrollTo({ top: 0 }); return;
      case "dublura-deschide": if (dublura) location.hash = `#/lucrari/${encodeURIComponent(dublura.id)}/cerere`; return;
      case "dublura-nou": { const d = dublura; if (d) void proceseaza(d.fisier, undefined, true); return; }
      case "dublura-renunta": dublura = null; deseneaza(); scrollTo({ top: 0 }); return;
      case "schimba-tip":
        tipDeschis = true;
        deseneaza();
        pagina.querySelector<HTMLInputElement>('.imp-antet [name="segment"]:checked')?.focus();
        return;
      case "la-verificare": treciPe(2); opt.laParte?.("verificare"); return;
      case "intrebari":
        intrebariDeschise = !intrebariDeschise;
        deseneaza();
        pagina.querySelector<HTMLElement>('[data-act="intrebari"]')?.focus();
        return;
      case "intrebari-copiaza": {
        const t = pagina.querySelector<HTMLTextAreaElement>(".intrebari-text");
        if (!t) return;
        void navigator.clipboard.writeText(t.value).then(() => { b.textContent = "Copiat"; }, () => { t.select(); });
        return;
      }
      case "intrebari-excel": {
        if (!sesiune) return;
        const s = sesiune;
        void excelIntrebari(intrebariClient(s.rez.linii), dateEmail(s)).then((buf) =>
          descarca(buf, `Intrebari - ${dateEmail(s).despre}.xlsx`.replace(/[/\\?%*:|"<>]/g, "-")));
        return;
      }
      case "descarca-client": {
        const form = b.closest<HTMLFormElement>("#antet-oferta");
        if (form?.reportValidity()) void genereazaOferta(form, true);
        return;
      }
      case "meniu-rand": {
        const m = b.nextElementSibling as HTMLElement | null;
        if (!m) return;
        m.hidden = !m.hidden;
        b.setAttribute("aria-expanded", String(!m.hidden));
        if (!m.hidden) m.querySelector<HTMLButtonElement>("button:not([disabled])")?.focus();
        return;
      }
      case "scoate-pozitie": {
        if (idx === null) return;
        const urm = urmatorul(idx);
        corecteaza(idx, { sistem: null }, false);
        deseneaza();
        if (urm !== null) pagina.querySelector<HTMLElement>(`[data-act="meniu-rand"][data-idx="${urm}"]`)?.focus();
        return;
      }
      case "sterge-strat":
      case "scoate-primul": {
        const l = idx === null ? undefined : sesiune?.rez.linii.find((x) => x.extras.index === idx);
        if (!l || idx === null) return;
        randInLucru = idx;
        corecteaza(idx, patchDinCamp(l.extras, act === "scoate-primul" ? "scoate-primul" : `strat${b.dataset["k"]}`, ""));
        deseneaza();
        pagina.querySelector<HTMLElement>(`[data-act="meniu-rand"][data-idx="${idx}"]`)?.focus();
        return;
      }
      case "strat-nou": {
        const l = idx === null ? undefined : sesiune?.rez.linii.find((x) => x.extras.index === idx);
        if (!l || idx === null) return;
        // Stratul nou ia indicele de după celelalte izolații, înaintea protecției.
        const k = l.extras.straturi_extra.filter((x) => !JACHETE.has(x.sistem)).length;
        randInLucru = idx;
        corecteaza(idx, patchDinCamp(l.extras, "adauga-strat", ""));
        deseneaza();
        pagina.querySelector<HTMLElement>(`.cel-ed[data-ed="stratg${k}"][data-idx="${idx}"]`)?.focus();
        return;
      }
      case "modifica":
        editIdx = editIdx === idx ? null : idx;
        deseneaza();
        if (editIdx !== null) pagina.querySelector<HTMLElement>(`.imp-editor[data-idx="${idx}"] select`)?.focus();
        else focuseaza(idx);
        return;
      case "renunta": { const i = editIdx; editIdx = null; deseneaza(); focuseaza(i); return; }
      case "adauga-strat": {
        const form = b.closest<HTMLFormElement>(".imp-editor");
        if (!form) return;
        form.dataset["atins"] = "da";
        form.querySelector(".imp-straturi-lista")?.insertAdjacentHTML("beforeend",
          randStrat(Number(form.dataset["idx"]), { sistem: "tabla", grosime_mm: null }));
        form.querySelector<HTMLElement>(".imp-strat:last-child select")?.focus();
        return;
      }
      case "scoate-strat": {
        const form = b.closest<HTMLFormElement>(".imp-editor");
        b.closest(".imp-strat")?.remove();
        if (form) {
          form.dataset["atins"] = "da";
          form.querySelector<HTMLElement>('[data-act="adauga-strat"]')?.focus();
        }
        return;
      }
      case "reciteste": {
        const form = b.closest<HTMLFormElement>(".imp-editor");
        if (form && idx !== null) reciteste(form, idx);
        return;
      }
      case "confirma": {
        if (idx === null) return;
        const urm = urmatorul(idx);
        confirmaIndecsi([idx]);
        deseneaza();
        focuseaza(pagina.querySelector(`:is(.imp-poz, tr)[data-idx="${idx}"]`) ? idx : urm, "confirma");
        return;
      }
      case "e-izolatie": {
        // Din „Lăsate afară”: rândul devine poziție, de verificat; fila trece unde a ajuns.
        const s = sesiune;
        const a = s && idx !== null ? lasateAfara(s.rez, necitite).find((x) => x.index === idx) : undefined;
        if (!s || !a || idx === null) return;
        const vechi = s.rez.rezolvate.get(idx);
        s.rez.rezolvate.set(idx, faPozitie(s.rez, a));
        retarifeaza();
        const l = s.rez.linii.find((x) => x.extras.index === idx);
        vedereAfara = false;
        filtru = l && potrivit(l, "de_validat") ? "de_validat" : "netarifate";
        filtruAles = true; motiv = null; randInLucru = idx;
        arataMesaj("Rândul e acum poziție: alege materialul și grosimea, apoi apasă „E bine”.", () => {
          if (vechi) s.rez.rezolvate.set(idx, vechi); else s.rez.rezolvate.delete(idx);
          retarifeaza();
        });
        deseneaza();
        pagina.querySelector<HTMLElement>(`tr[data-idx="${idx}"] select`)?.focus();
        return;
      }
      case "reincearca": void reincearca(); return;
      case "schimb": {
        // „Schimb” de sub propoziție: cursorul în caseta presupunerii, pe rândul ei.
        const sel = CASETA_COLOANEI[b.dataset["camp"] ?? ""];
        const rand = b.closest("tr");
        const tinta = sel && rand ? rand.querySelector<HTMLElement>(sel) : null;
        tinta?.focus();
        if (tinta instanceof HTMLInputElement) tinta.select();
        return;
      }
      case "confirma-tot":
        if (sesiune) confirmaIndecsi(vizibile(sesiune).lista.filter((l) => potrivit(l, "de_validat")).map((l) => l.extras.index));
        deseneaza();
        return;
      case "pune-grosime": {
        if (idx === null) return;
        const urm = urmatorul(idx);
        corecteaza(idx, { grosime_mm: Number(b.dataset["g"]) }, false);
        deseneaza();
        focuseaza(pagina.querySelector(`:is(.imp-poz, tr)[data-idx="${idx}"]`) ? idx : urm);
        return;
      }
      case "grosimi": {
        if (!sesiune) return;
        const puse = vizibile(sesiune).lista
          .map((l) => [l.extras.index, propunere(l)] as const)
          .filter((x): x is readonly [number, number] => x[1] !== null && !grosimiPropuse.has(x[0]));
        for (const [i, g] of puse) grosimiPropuse.set(i, g);
        retarifeaza();
        arataMesaj(`Grosimea uzuală a fost pusă la ${pozitii(puse.length)}. Le găsești la „De verificat”.`, () => {
          for (const [i] of puse) grosimiPropuse.delete(i);
          retarifeaza();
        });
        deseneaza();
        return;
      }
      case "anuleaza":
        clearTimeout(ceasMesaj);
        elMesaj.innerHTML = "";
        deInvatat = null;
        deAnulat?.();
        deAnulat = null;
        if (pas !== 1) deseneaza();
        return;
    }
  });

  // Izolatia pe foaie: se arata doar campurile care conteaza pentru alegere.
  gazda.addEventListener("change", (e) => {
    const form = (e.target as HTMLElement).closest<HTMLFormElement>("#izolatie-foaie");
    if (!form || !deIzolat) return;
    const date = new FormData(form);
    deIzolat.tevi.forEach((_, i) => {
      for (const [camp, vizibil] of Object.entries(campuriVizibile(alegereDin(date, i)))) {
        const el = form.querySelector<HTMLElement>(`[data-camp="${camp}-${i}"]`);
        if (el) el.hidden = !vizibil;
      }
    });
  });

  gazda.addEventListener("change", (e) => {
    const t = e.target as HTMLInputElement | HTMLSelectElement;
    // Un câmp scos din pagină de o redesenare își trimite `change`-ul după: nu mai e al omului.
    if (!t.isConnected) return;
    if (t.id === "fisier") {
      const f = (t as HTMLInputElement).files?.[0];
      if (f) void proceseaza(f);
      return;
    }
    if (t.name === "firma-start") {
      firmaStart = t.value;
      tineFirma(t.value);
      return;
    }
    if (t.name === "segment") {
      destinatie = t.value as Destinatie;
      retarifeaza();
      const laVerificare = tipDeschis;
      tipDeschis = false;
      if (pas !== 1) deseneaza();
      if (laVerificare) pagina.querySelector<HTMLElement>('[data-act="schimba-tip"]')?.focus();
      return;
    }
    if (t.dataset["um"] && sesiune) {
      scrieUm(Number(t.dataset["idx"]), t.value);
      pastreazaCursorul(gazda, deseneaza);
      return;
    }
    if (t.dataset["vc"] && sesiune) {
      // O alegere din rândul de verificare (izolația, protecția, notația, piesa): corectura omului, ca din editor.
      const idx = Number(t.dataset["idx"]);
      const l = sesiune.rez.linii.find((x) => x.extras.index === idx);
      if (!l) return;
      randInLucru = idx;
      corecteaza(idx, patchDinCamp(l.extras, t.dataset["vc"], t.value));
      pastreazaCursorul(gazda, deseneaza);
      return;
    }
    if (t.closest("#antet-oferta") && sesiune && t.tagName === "SELECT") {
      antet = { ...antet, firma: t.value };
      tineFirma(t.value);
      salveazaSesiune();
      actualizeazaCumIese(sesiune);
      void propuneNumar();
      return;
    }
    if (t.dataset["act"] === "filtru") { filtru = t.value as FiltruStare; filtruAles = true; motiv = null; editIdx = null; randInLucru = null; deseneaza(); return; }
    const form = t.closest<HTMLFormElement>(".imp-editor");
    if (!form) return;
    // Un camp extras atins face din salvare corectura omului. Descrierea,
    // UM-ul si cantitatea nu: alea se recitesc (vezi `salveazaEditor`).
    if (!["text", "um", "cantitate", "pret_manual"].includes(t.name)) form.dataset["atins"] = "da";
    if (t.name === "sistem") {
      const gol = t.value === "goluri_foc";
      form.querySelector<HTMLElement>(".imp-editor-teava")!.hidden = gol || t.value === "";
      form.querySelector<HTMLElement>(".imp-editor-gol")!.hidden = !gol;
      form.querySelector('[name="grosime"]')?.setAttribute("list", `ed-g-${form.dataset["idx"]}-${t.value}`);
    }
    if (t.name === "strat_sistem") {
      t.parentElement?.querySelector('[name="strat_grosime"]')?.setAttribute("list", `ed-g-${form.dataset["idx"]}-${t.value}`);
    }
  });

  gazda.addEventListener("submit", (e) => {
    const form = e.target as HTMLFormElement;
    e.preventDefault();
    if (form.id === "antet-oferta") { void genereazaOferta(form); return; }
    if (form.id === "izolatie-foaie") { void faListaDeIzolatii(form); return; }
    if (!form.classList.contains("imp-editor")) return;
    const idx = Number(form.dataset["idx"]);
    salveazaEditor(form, idx);
    deseneaza();
    focuseaza(idx);
  });

  // Vederea ca in Excel: corectura unei celule reextrage si retarifeaza
  // randul. Grila NU se redeseneaza la fiecare tasta — s-ar pierde cursorul —
  // doar bara de jos, care spune cat e gata.
  gazda.addEventListener("input", (e) => {
    const camp = e.target as HTMLElement;
    if ((camp as HTMLInputElement).name === "ajustare" && sesiune && pas === 3) {
      // Doar suma de sus: o redesenare a pasului ar sterge datele ofertei deja scrise.
      const v = Number((camp as HTMLInputElement).value.replace(",", "."));
      ajustare = Number.isFinite(v) && v > -100 ? v : 0;
      arataValoarea(sesiune);
      actualizeazaCumIese(sesiune);
      salveazaSesiune();
      return;
    }
    const formAntet = camp.closest<HTMLFormElement>("#antet-oferta");
    if (formAntet && sesiune) {
      // Antetul ofertei se tine in sesiune: la reincarcare si la „Creează
      // șantierul” sunt aceleasi date pe care le-a scris omul.
      const d = new FormData(formAntet);
      const v = (n: string): string => String(d.get(n) ?? "");
      const disc = Number(v("discount").replace(",", "."));
      antet = {
        firma: v("firma") || antet.firma, numar: v("numar").trim(), data: v("data").trim(), client: v("client"),
        obiectiv: v("obiectiv"), persoana: v("persoana"), localitate: v("localitate"),
        discount: Number.isFinite(disc) && disc >= 0 && disc < 100 ? disc : 0,
        // Refuzul nu e în formular: rămâne cum era.
        ...(antet.refuzat ? { refuzat: antet.refuzat } : {}),
        // Bifa apare doar pe industrial, cu închideri la foc; fără ea, rămâne cum era.
        ...(formAntet.querySelector('[name="adaosFoc"]') ? { adaosFoc: d.get("adaosFoc") === "da" }
          : antet.adaosFoc !== undefined ? { adaosFoc: antet.adaosFoc } : {}),
      };
      if (["discount", "adaosFoc"].includes((camp as HTMLInputElement).name)) arataValoarea(sesiune);
      actualizeazaCumIese(sesiune);
      salveazaSesiune();
    }
    const editor = camp.closest<HTMLFormElement>(".imp-editor");
    if (editor) {
      if (!["text", "um", "cantitate", "pret_manual"].includes((camp as HTMLInputElement).name)) editor.dataset["atins"] = "da";
      return;
    }
  });

  /** Descrierea la care scrie omul acum și cum era rândul înainte de prima tastă, pentru „Anulează”. */
  let descriereInLucru: string | null = null;

  /**
   * Descrierea scrisă în tabelul de verificare e celula din fișierul
   * clientului, ca în Excel (Andrei, 21 octombrie 2026: „dacă schimb DN100 în
   * DN50 ar trebui să se schimbe ce afectează”). La fiecare tastă rândul se
   * recitește și se retarifează: diametrul, rândul din listă, prețul. O poziție
   * verificată de om se recitește și ea, din textul nou. „Anulează” (la prima
   * tastă) pune la loc celula și ce era pe poziție.
   */
  function scrieDescrierea(el: HTMLElement, peLoc: boolean): boolean {
    const s = sesiune;
    const numeFoaie = el.dataset["foaie"] ?? "";
    const rand = s?.foi.find((f) => f.nume === numeFoaie)?.randuri.find((r) => r.rand === Number(el.dataset["rand"]));
    const idx = rand?.linie?.index;
    if (!s || !rand || idx === undefined) return false;
    const cel = Number(el.dataset["cel"]);
    const text = el.textContent ?? "";
    const vVechi = rand.celule[cel]?.v ?? null;
    if (text === String(vVechi ?? "")) return false;
    // Cum era rândul înainte de tasta asta, ca s-o putem retrage.
    const rezInainte = s.rez.rezolvate.get(idx);
    const marcata = descrieriSchimbate.has(idx);
    const puneInapoi = (v: string | number | null, rez: typeof rezInainte, marcat: boolean): void => {
      scrieCelula(rand, cel, v);
      reconstruieste(rand);
      if (rez) s.rez.rezolvate.set(idx, rez); else s.rez.rezolvate.delete(idx);
      if (marcat) descrieriSchimbate.add(idx); else descrieriSchimbate.delete(idx);
      retarifeaza();
    };
    scrieCelula(rand, cel, text);
    reconstruieste(rand);
    retarifeaza();
    // Pe drum, un text pe jumătate („Case”) poate să nu mai fie o poziție: rândul
    // ar dispărea de sub cursor. Rămâne cum era până textul e iar o poziție; la
    // ieșire din casetă, descrierea de dinainte se pune la loc.
    if (!s.rez.linii.some((l) => l.extras.index === idx)) {
      puneInapoi(vVechi, rezInainte, marcata);
      if (peLoc) return false;
      arataMesaj("Descrierea nu mai e o poziție de izolație: a rămas cea de dinainte.");
      return true;
    }
    const cheie = `${numeFoaie}|${rand.rand}|${cel}`;
    if (descriereInLucru !== cheie) {
      descriereInLucru = cheie;
      const editareVeche = s.editari.find((x) => x.foaie === numeFoaie && x.rand === rand.rand && x.cel === cel);
      arataMesaj("Descrierea s-a schimbat: rândul e recitit.", () => {
        const j = s.editari.findIndex((x) => x.foaie === numeFoaie && x.rand === rand.rand && x.cel === cel);
        if (editareVeche) s.editari[j] = editareVeche; else if (j >= 0) s.editari.splice(j, 1);
        descriereInLucru = null;
        puneInapoi(vVechi, rezInainte, marcata);
      });
    }
    const editare: EditareCelula = { foaie: numeFoaie, rand: rand.rand, cel, v: text };
    const i = s.editari.findIndex((x) => x.foaie === editare.foaie && x.rand === editare.rand && x.cel === cel);
    if (i >= 0) s.editari[i] = editare; else s.editari.push(editare);
    randInLucru = idx;
    return true;
  }

  /**
   * UM-ul ales în rândul de verificare e celula UM din fișierul clientului, ca
   * descrierea: rândul se recitește (forma, „buc.” pe izolație dreaptă) și se
   * retarifează. „Anulează” pune la loc celula.
   */
  function scrieUm(idx: number, v: string): void {
    const s = sesiune;
    const l = s?.rez.linii.find((x) => x.extras.index === idx);
    const f = s?.foi.find((x) => x.nume === l?.bruta.foaie);
    const rand = f?.randuri.find((r) => r.rand === l?.bruta.rand);
    const cel = s && l ? campuriLinie(s, l)?.um?.cel : undefined;
    if (!s || !f || !rand || cel === undefined) return;
    const vVechi = rand.celule[cel]?.v ?? null;
    const gasita = (): number => s.editari.findIndex((x) => x.foaie === f.nume && x.rand === rand.rand && x.cel === cel);
    const editareVeche = s.editari[gasita()];
    const scrie = (val: string | number | null): void => { scrieCelula(rand, cel, val); reconstruieste(rand); retarifeaza(); };
    scrie(v);
    const editare: EditareCelula = { foaie: f.nume, rand: rand.rand, cel, v };
    const j = gasita();
    if (j >= 0) s.editari[j] = editare; else s.editari.push(editare);
    randInLucru = idx;
    arataMesaj("Unitatea de măsură s-a schimbat: rândul e recitit.", () => {
      const k = gasita();
      if (editareVeche) s.editari[k] = editareVeche; else if (k >= 0) s.editari.splice(k, 1);
      scrie(vVechi);
    });
  }

  /** Casetele de număr din rândul de verificare, după `data-ed`, și câmpul lor din `patchDinCamp`. */
  const CAMPURI_RAND: Record<string, string> = { gros: "grosime", diam: "diam", gol_l: "gol_l", gol_h: "gol_h" };
  /** Câmpul la care scrie omul acum și cum era poziția înainte de prima tastă, pentru „Anulează”. */
  let campInLucru: { cheie: string; vechi: ReturnType<Sesiune["rez"]["rezolvate"]["get"]> } | null = null;

  /**
   * Grosimea, diametrul sau golul scrise în rândul de verificare: poziția se
   * retarifează la fiecare tastă (Andrei, 18 octombrie 2026) și devine a
   * omului, ca o corectură din editor. „Salvat.” cu „Anulează” apare la
   * prima tastă și pune poziția cum era înainte de câmp.
   */
  function scrieCampul(idx: number, camp: string, text: string, peLoc: boolean): boolean {
    const s = sesiune;
    const l = s?.rez.linii.find((x) => x.extras.index === idx);
    if (!s || !l) return false;
    const cheie = `${idx}|${camp}`;
    if (campInLucru?.cheie !== cheie) {
      const vechi = s.rez.rezolvate.get(idx);
      campInLucru = { cheie, vechi };
      arataMesaj("Salvat.", () => {
        if (vechi) s.rez.rezolvate.set(idx, vechi); else s.rez.rezolvate.delete(idx);
        campInLucru = null;
        retarifeaza();
      });
    }
    s.rez.rezolvate.set(idx, { extras: { ...l.extras, ...patchDinCamp(l.extras, camp, text) }, sursa: "om" });
    if (peLoc) randInLucru = idx;
    retarifeaza();
    return true;
  }

  // Tabelul ofertei, ca în Excel (`legaCelule`). Denumirea se scrie pe loc;
  // cantitatea și prețul schimbă numerotarea și totalul, deci redesenează.
  legaCelule(gazda, {
    scrie: (el, peLoc) => {
      if (!sesiune) return false;
      const idx = Number(el.dataset["idx"]);
      if (el.dataset["ed"] === "den") { if (!peLoc) scrieDenumirea(el); return false; }
      if (el.dataset["ed"] === "desc") return scrieDescrierea(el, peLoc);
      const ed = el.dataset["ed"] ?? "";
      const camp = CAMPURI_RAND[ed] ?? (/^stratg\d+$/.test(ed) ? ed : undefined);
      if (camp) return scrieCampul(idx, camp, (el as HTMLInputElement).value, peLoc);
      const valoare = numarScris((el as HTMLInputElement).value);
      // Rândul la care scrie omul rămâne pe ecran și când iese din filtrul ales.
      if (peLoc) randInLucru = idx;
      if (el.dataset["ed"] === "cant") {
        // 0 e voie (firma, 23 noiembrie 2026: „uneori se trec și cu cantitate
        // 0”): poziția rămâne în ofertă, cu prețul ei și valoarea 0.
        if (valoare === null || !(valoare >= 0)) {
          if (!peLoc) arataMesaj("Cantitatea se scrie ca număr, de exemplu 0, 12 sau 12,5.");
          return false;
        }
        return scrieCantitatea(idx, valoare, peLoc);
      }
      if (el.dataset["ed"] === "procent") return scrieProcentul(idx, valoare, peLoc);
      return el.dataset["ed"] === "pret" && scriePretul(idx, valoare, peLoc);
    },
    deseneaza,
    desenari: () => desenari,
  });

  gazda.addEventListener("input", (e) => {
    const el = e.target as HTMLElement;
    if (el.matches?.('.cel-ed[data-ed="desc"]') && scrieDescrierea(el, true)) pastreazaCursorul(gazda, deseneaza);
  });

  gazda.addEventListener("toggle", (e) => {
    const t = e.target as HTMLElement;
    if (t.matches(".imp-detalii")) detaliiDeschise = (t as HTMLDetailsElement).open;
  }, true);

  /** Pasul de acum se schimbă: din fila lucrării sau dintr-un buton al importului. */
  function treciPe(p: Pas): void {
    pas = p;
    editIdx = null;
    deseneaza();
    scrollTo({ top: 0 });
    if (pas === 3) {
      pagina.querySelector<HTMLInputElement>('[name="numar"]')?.focus({ preventScroll: true });
      void propuneNumar();
    }
  }

  const control: ControlImport = {
    arata: (p) => {
      // Fila Cerere cu „Schimbă fișierul” deschis rămâne la fișier; altfel, verificarea.
      const tinta = PAS[p];
      if (tinta === pas || (tinta === 2 && pas === 1)) { deseneaza(); return; }
      if (!sesiune && tinta !== 1) { deseneaza(); return; }
      treciPe(tinta);
    },
    salveazaAcum,
    refuz: async (zi) => {
      if (zi) antet = { ...antet, refuzat: zi };
      else { const { refuzat: _r, ...rest } = antet; antet = rest; }
      await salveazaAcum();
    },
    santier: (reguli) => santierAcum(reguli),
  };

  /* -------------------------------------------------------- la deschidere */
  if (opt.cerere) {
    try {
      await redeschide(opt.cerere, true);
    } catch (e) {
      console.error(e);
      eroareStart = "<strong>Cererea nu s-a putut deschide.</strong> Reîncarcă pagina.";
      pas = 1;
      deseneaza();
    }
    return control;
  }
  // Registrul venit din notitele de santier trece prin import ca un fisier
  // de client: aceeasi verificare, acelasi pas „Oferta".
  const predat = preia();
  if (predat) {
    destinatie = predat.destinatie;
    void proceseaza(predat.fisier, predat);
    return control;
  }
  deseneaza();
  return control;
}
