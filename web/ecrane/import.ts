import {
  citesteText, proceseazaRegistru, reevalueaza, type Extractor, type LinieProcesata, type Rezultat,
} from "../../src/import/nucleu.js";
import { campuriRand, scrieCelula, reconstruieste, type CampuriRand } from "../../src/import/editare.js";
import { invataDinCorectie } from "../../src/import/memorie.js";
import { mapariStatice } from "../../src/import/mapari-statice.js";
import type { LinieExtrasa } from "../../src/import/schema.js";
// Doar tipul: ExcelJS (~940 kB) ramane incarcat lenes, prin `import()`.
import type { FoaieBruta } from "../../src/import/parse-workbook.js";
import type { Destinatie } from "../../src/pricing/lists.js";
import { grosimePropusa } from "../../src/pricing/grosimi-uzuale.js";
import { stocLocal } from "../stoc-local.js";
import { ceriSpatiu } from "../meniu-stare.js";
import { anuleaza, confirma, potrivit } from "../validare.js";
import { cate, esc, eur, type Ecran } from "./tip.js";
import { FIRME } from "../date/seed.js";
import {
  adaosFocIndustrial, clientPropus, cuAjustare, dataAzi, imparte, planDinOferta, registruOferta, totalCuAdaos,
  type AntetOferta, type CerereOferta,
} from "../oferta.js";
import { citestePlanuri, deschideLaIntrare, scriePlanuri } from "../lucrari-local.js";
import { descarca, numeOferta } from "../descarca.js";
import { ADAOS_IMPLICIT, necesarDinLinii } from "../../src/stoc/necesar.js";
import { cardNecesar } from "../stoc-vizual.js";
import { citesteDepozit, idNou, scrieDepozit } from "../depozit-local.js";
import {
  idCurent, incarca, listeaza, puneCurent, salveaza, sterge,
  type EditareCelula, type IntrareIstoric, type SesiuneImport,
} from "../istoric.js";
import {
  actiuniLista, antetVerificare, cardPozitie, comutaExcel, detaliuValoare, ecranOferta, ecranProgres, ecranStart, editorPozitie,
  baraFoi, filtreMotiv, filtreStare, numaraMotive, pasi, patchDinFormular, randStrat, toast,
  type FiltruStare, type Pas, type TabFoaie,
} from "../import/vizual.js";
import { celuleExtrase, grilaFoaie } from "../import/grila.js";
import { FARA_POZITII, fisierNecitit, motiveLinie, stareLinie, type CodMotiv } from "../import/text.js";
import { preia, type Predare } from "../predare.js";
import { MARCA_PRET_DUBLU } from "../../src/santier/spre-cerere.js";

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
 * Ruta stratului cu model exista doar pe serverul de dezvoltare
 * (`scripts/vite-plugin-model.ts`). In build lipseste, iar ecranul cade curat
 * pe stratul determinist — si cheia API nu poate ajunge in pagina.
 */
const RUTA_MODEL = location.pathname.replace(/[^/]*$/, "") + "api/extrage";
interface StareModel { disponibil: boolean; model: string; prag: number; lot?: number; concurenta?: number }
/** Loturi mici, in paralel: fiecare lot intors misca bara de progres. */
const LOT_IMPLICIT = 25;
/**
 * Sub latimea asta (a ecranului de import, cu bara pliata) foaia se deschide ca
 * lista. E pragul la care si cardurile trec pe un rand; sub el, un registru ca
 * Book15 (12 coloane) ar ramane cu coloane de doua-trei litere.
 */
const LATIME_MINIMA_EXCEL = 1000;
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

export const ecran: Ecran = {
  id: "import",
  titlu: "Import Excel",

  async render(gazda) {
    const info = await interogheazaModel();
    const mapari = mapariStatice();
    const prag = info?.prag ?? 0.85;
    const stoc = stocLocal();

    /* --------------------------------------------------------------- stare */
    let destinatie: Destinatie = "rezidential";
    /** Grosimile uzuale cerute in masa. Vezi `OptiuniNucleu.grosimiPropuse`. */
    let grosimiPropuse = new Map<number, number>();
    /** Descrierile schimbate dupa verificare. Vezi `OptiuniNucleu.descrieriSchimbate`. */
    let descrieriSchimbate = new Set<number>();
    /** Preturile puse de mana. Vezi `OptiuniNucleu.preturiManuale`. */
    let preturiManuale = new Map<number, number>();
    let pas: Pas = 1;
    let sesiune: Sesiune | null = null;
    let istoric: IntrareIstoric[] = [];
    let filtru: FiltruStare = "toate";
    let motiv: CodMotiv | null = null;
    let foaie: string | null = null;
    let editIdx: number | null = null;
    /** Foaia ca in Excel e vederea implicita pe ecran lat; lista de carduri e la un clic. */
    let excel = true;
    /** Adaosul pentru coturi si fitinguri din cardul „Materiale necesare". */
    let adaosNecesar = ADAOS_IMPLICIT;
    /** Ajustarea tehnicului pe toate prețurile, din pasul „Oferta" (procente). */
    let ajustare = 0;
    let detaliiDeschise = false;
    let stergeDe: string | null = null;
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
    let ceasMesaj: ReturnType<typeof setTimeout> | undefined;
    let ceasSalvare: ReturnType<typeof setTimeout> | undefined;

    const optiuni = () => ({ stoc, mapari, prag, destinatie, grosimiPropuse, descrieriSchimbate, preturiManuale });

    gazda.innerHTML = `<div class="imp">
      <nav id="imp-pasi" aria-label="Pașii importului"></nav>
      <div id="imp-pagina" class="imp-pagina"></div>
      <div id="imp-mesaj"></div>
    </div>`;
    const elPasi = gazda.querySelector<HTMLElement>("#imp-pasi")!;
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

    /** Pozitiile de pe foaia aleasa, apoi sub filtrul de stare, apoi sub motiv. */
    function vizibile(s: Sesiune): { peFoaie: LinieProcesata[]; peStare: LinieProcesata[]; lista: LinieProcesata[] } {
      const izo = s.rez.linii.filter((l) => l.extras.sistem !== null);
      const peFoaie = foaie ? izo.filter((l) => l.bruta.foaie === foaie) : izo;
      const peStare = filtru === "toate" ? peFoaie : peFoaie.filter((l) => potrivit(l, filtru));
      const m = motiv;
      const lista = m ? peStare.filter((l) => motiveLinie(l).includes(m)) : peStare;
      return { peFoaie, peStare, lista };
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
      const s = sesiune;
      if (!s) return;
      clearTimeout(ceasSalvare);
      ceasSalvare = setTimeout(() => {
        void salveaza({
          ...s.meta,
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
          preturiManuale: [...preturiManuale],
        }).then(async () => { istoric = await listeaza(); });
      }, 400);
    }

    function retarifeaza(): void {
      if (!sesiune) return;
      reevalueaza(sesiune.rez, optiuni());
      salveazaSesiune();
    }

    /* ------------------------------------------------------------ desenare */
    function deseneaza(): void {
      const areSesiune = sesiune !== null;
      // Cu fisierul deschis, foaia clientului are nevoie de toata latimea:
      // bara laterala se pliaza (temporar, fara sa schimbe preferinta omului).
      ceriSpatiu(gazda, areSesiune && pas !== 1);
      elPasi.innerHTML = pasi(pas, { 1: true, 2: areSesiune, 3: areSesiune });
      if (pas === 1 || !sesiune) {
        pagina.innerHTML = ecranStart({ destinatie, istoric, stergeDe, eroare: eroareStart });
        legaDrop();
      } else if (pas === 2) {
        pagina.innerHTML = paginaVerificare(sesiune);
      } else {
        const { oferta, deValidat, netarifate } = imparte(cuAjustare(sesiune.rez.linii, ajustare));
        pagina.innerHTML = ecranOferta({
          gata: oferta.length, valoare: totalCuAdaos(oferta, destinatie),
          adaosFoc: adaosFocIndustrial(oferta, destinatie), ajustare,
          deVerificat: deValidat.length, faraPret: netarifate.length,
          destinatie, client: clientPropus(sesiune.meta.nume), data: dataAzi(), firme: FIRME, eroare: "",
        }) + cardNecesar(necesarDinLinii(sesiune.rez.linii, adaosNecesar));
      }
    }

    function alerte(s: Sesiune): string {
      const st = s.rez.statistici;
      return [
        s.avertisment,
        st.modelFaraRaspuns > 0
          ? `<p class="alerta"><strong>${pozitii(st.modelFaraRaspuns)} n-au putut fi citite.</strong> Încarcă fișierul din nou ca să reîncerci.</p>`
          : "",
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

    /** Foile registrului, cu cate pozitii cer atentie pe fiecare. */
    function taburi(s: Sesiune): TabFoaie[] {
      return s.foi.map((f) => ({
        nume: f.nume,
        deRezolvat: s.rez.linii.filter((l) => l.bruta.foaie === f.nume && l.extras.sistem !== null
          && (potrivit(l, "de_validat") || potrivit(l, "netarifate"))).length,
      }));
    }

    /** Foaia deschisa la inceput: prima cu pozitii, ca in Excel. `null` = registru cu o foaie. */
    function foaieInitiala(s: Sesiune): string | null {
      if (s.foi.length < 2) return null;
      const cuPozitii = s.foi.find((f) => s.rez.linii.some((l) => l.bruta.foaie === f.nume && l.extras.sistem !== null));
      return (cuPozitii ?? s.foi[0]!).nume;
    }

    function paginaVerificare(s: Sesiune): string {
      const { peFoaie, peStare, lista } = vizibile(s);
      const numere: Record<FiltruStare, number> = {
        toate: peFoaie.length,
        gata: peFoaie.filter((l) => potrivit(l, "gata")).length,
        de_validat: peFoaie.filter((l) => potrivit(l, "de_validat")).length,
        netarifate: peFoaie.filter((l) => potrivit(l, "netarifate")).length,
      };
      const motive = filtru === "de_validat" || filtru === "netarifate" ? numaraMotive(peStare) : [];
      const cuFoaie = s.foi.length > 1;
      // Cu taburi, foaia activa se vede deja in bara: numele ei pe fiecare card
      // sau deasupra tabelului ar repeta acelasi lucru.
      const numeFoaie = cuFoaie && foaie === null;

      const gol = `<p class="imp-gol">Nicio poziție aici.</p>`;
      let corp: string;
      if (excel) {
        // Fara filtru se vede tot fisierul, cu titluri si note, ca in Excel.
        const vizibileIdx = filtru === "toate" && motiv === null ? null : new Set(lista.map((l) => l.extras.index));
        const harta = new Map(s.rez.linii.map((l) => [l.extras.index, l]));
        corp = s.foi.filter((f) => !foaie || f.nume === foaie)
          .map((f) => grilaFoaie(f, harta, { vizibile: vizibileIdx, editIdx, propunere, cuNumeFoaie: numeFoaie }))
          .join("") || gol;
      } else {
        corp = lista.length
          ? lista.map((l) => {
              const editeaza = editIdx === l.extras.index;
              const campuri = editeaza ? campuriLinie(s, l) : undefined;
              return cardPozitie(l, { propunere: propunere(l), editeaza, cuFoaie: numeFoaie, ...(campuri ? { campuri } : {}) });
            }).join("")
          : gol;
      }

      return `${alerte(s)}
        <section class="imp-card">${antetVerificare({ nume: s.meta.nume, cand: s.meta.cand, destinatie })}</section>
        ${cuFoaie
          ? baraFoi(taburi(s), foaie, numere, filtru, excel)
          : `<div class="imp-bara-lista">${filtreStare(numere, filtru)}${comutaExcel(excel)}</div>`}
        ${filtreMotiv(motive, motiv)}
        ${actiuniLista({
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
    function deschideSesiune(s: Sesiune): void {
      sesiune = s;
      pas = 2; filtru = "toate"; motiv = null; foaie = foaieInitiala(s); editIdx = null;
      // Latimea se masoara DUPA plierea barei, altfel ar decide pe locul pe
      // care il ocupa inca meniul. Sub prag, foaia 1:1 n-ar incapea fara
      // derulare laterala decat cu coloane de cateva litere: se deschide ca
      // lista, iar „Arată ca în Excel" ramane la un clic.
      ceriSpatiu(gazda, true);
      excel = gazda.clientWidth >= LATIME_MINIMA_EXCEL;
      eroareStart = "";
      salveazaSesiune();
      deseneaza();
      scrollTo({ top: 0 });
    }

    function confirmaIndecsi(indecsi: number[]): void {
      const s = sesiune;
      if (!s || indecsi.length === 0) return;
      const inst = confirma(indecsi, s.rez.rezolvate);
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
      if (!s) { puneCurent(null); istoric = await listeaza(); deseneaza(); return; }
      pagina.innerHTML = ecranProgres(`Se deschide ${s.nume}…`, null);
      const { parseFoiBuffer } = await import("../../src/import/parse-workbook.js");
      const foi = await parseFoiBuffer(s.fisier);
      // Corecturile de celula se aplica INAINTE de extragere; extragerile salvate
      // (inclusiv ale modelului) se pun peste, fara sa se recheme modelul.
      for (const e of s.editari) {
        const rand = foi.find((f) => f.nume === e.foaie)?.randuri.find((r) => r.rand === e.rand);
        if (rand) { scrieCelula(rand, e.cel, e.v); reconstruieste(rand); }
      }
      destinatie = s.destinatie ?? "rezidential";
      grosimiPropuse = new Map(s.grosimiPropuse ?? []);
      descrieriSchimbate = new Set(s.descrieriSchimbate ?? []);
      preturiManuale = new Map(s.preturiManuale ?? []);
      const rez = await proceseazaRegistru(foi, optiuni());
      for (const x of s.extrase) {
        rez.rezolvate.set(x.index, { extras: x.extras, sursa: x.sursa, ...(x.text !== undefined ? { text: x.text } : {}) });
      }
      reevalueaza(rez, optiuni());
      puneCurent(id);
      deschideSesiune({ foi, rez, meta: s, editari: [...s.editari], avertisment: "" });
      if (!restaurat) arataMesaj(`Ai deschis ${s.nume}.`);
    }

    async function proceseaza(fisier: File, predare?: Predare): Promise<void> {
      pas = 2;
      elPasi.innerHTML = pasi(2, { 1: true, 2: false, 3: false });
      pagina.innerHTML = ecranProgres(`Se citește ${fisier.name}…`, null);
      try {
        const { parseFoiBuffer } = await import("../../src/import/parse-workbook.js");
        const buf = await fisier.arrayBuffer();
        const foi = await parseFoiBuffer(buf.slice(0));

        let esuate = 0;
        const extractor: Extractor | undefined = info ? async (deTrimis) => {
          const lot = info.lot ?? LOT_IMPLICIT;
          const loturi: (typeof deTrimis)[] = [];
          for (let i = 0; i < deTrimis.length; i += lot) loturi.push(deTrimis.slice(i, i + lot));
          const primite: LinieExtrasa[] = [];
          let gata = 0;
          let urmator = 0;
          const arata = (): void => {
            pagina.innerHTML = ecranProgres("Se recunosc pozițiile…", loturi.length ? (gata / loturi.length) * 100 : 100);
          };
          arata();
          const lucrator = async (): Promise<void> => {
            for (let i = urmator++; i < loturi.length; i = urmator++) {
              try {
                const r = await fetch(RUTA_MODEL, {
                  method: "POST", headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ linii: loturi[i] }), signal: AbortSignal.timeout(120_000),
                });
                const corp = (await r.json()) as { linii?: LinieExtrasa[]; eroare?: string };
                if (!r.ok) throw new Error(corp.eroare ?? `HTTP ${r.status}`);
                primite.push(...(corp.linii ?? []));
              } catch {
                esuate++; // un lot cazut nu invalideaza importul
              } finally {
                gata++;
                arata();
              }
            }
          };
          const n = Math.min(info.concurenta ?? CONCURENTA_IMPLICITA, Math.max(loturi.length, 1));
          await Promise.all(Array.from({ length: n }, lucrator));
          return primite;
        } : undefined;

        // Propunerile tin de indecsii fisierului de dinainte.
        grosimiPropuse = new Map();
        descrieriSchimbate = new Set();
        preturiManuale = new Map();
        const rez = await proceseazaRegistru(foi, { ...optiuni(), ...(extractor ? { extrage: extractor } : {}) });
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
        deschideSesiune({
          foi, rez, editari: [],
          avertisment: esuate > 0
            ? `<p class="alerta"><strong>O parte din rânduri n-au putut fi citite.</strong> Încarcă fișierul din nou ca să reîncerci.</p>`
            : "",
          meta: {
            id: `${Date.now()}-${fisier.name}`, nume: fisier.name, marime: fisier.size,
            cand: new Date().toISOString(), model: info?.model ?? null, fisier: buf,
            pozitii: 0, tarifate: 0, valoare: 0, extrase: [], editari: [],
          },
        });
      } catch (e) {
        pas = 1;
        // Detaliul tehnic ramane in consola, pentru noi; omul primeste ce sa faca.
        console.error(e);
        eroareStart = `<strong>Fișierul nu a putut fi citit.</strong> ${esc(fisierNecitit(fisier.name))}`;
        deseneaza();
      }
    }

    /** Antetul ofertei din formularul pasului 3; același pentru ofertă și pentru șantier. */
    function cerereDinFormular(s: Sesiune, form: HTMLFormElement): CerereOferta {
      const date = new FormData(form);
      const val = (n: string): string => ((date.get(n) as string | null) ?? "").trim();
      const firma = FIRME.find((f) => f.id === val("firma")) ?? FIRME[0]!;
      const antet: AntetOferta = {
        serie: firma.serieOferta, numar: val("numar"), data: val("data"), persoana: val("persoana"),
        client: val("client"), obiectiv: val("obiectiv"), firma: firma.denumire, localitate: val("localitate"),
      };
      const procent = Number(val("discount").replace(",", "."));
      if (Number.isFinite(procent) && procent > 0) {
        antet.discountProcent = procent;
        antet.discountConditie = "PENTRU PLATA FACTURII FISCALE IN TERMEN DE 5-7 ZILE CALENDARISTICE DE LA DATA EMITERII";
      }
      if (ajustare) antet.ajustareProcent = ajustare;
      return {
        linii: s.rez.linii, antet,
        provenienta: {
          generatLa: new Date().toISOString(), destinatie, model: s.meta.model,
          sesiune: s.meta.id, fisierSursa: s.meta.nume,
        },
      };
    }

    async function genereazaOferta(form: HTMLFormElement): Promise<void> {
      const s = sesiune;
      if (!s) return;
      const cerere = cerereDinFormular(s, form);
      const { antet } = cerere;
      const buton = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
      const eticheta = buton.textContent;
      buton.disabled = true;
      buton.textContent = "Se pregătește…";
      form.querySelector(".alerta")?.remove();
      try {
        const buf = await registruOferta(cerere);
        descarca(buf, numeOferta(antet.serie, antet.numar, antet.data));
        arataMesaj("Oferta a fost descărcată.");
      } catch (err) {
        form.querySelector(".imp-formular-butoane")!.insertAdjacentHTML("beforebegin",
          `<p class="alerta" role="alert">Oferta nu s-a putut genera: ${esc(String(err))}</p>`);
      } finally {
        buton.disabled = false;
        buton.textContent = eticheta;
      }
    }

    /**
     * Șantierul din ofertă: planul (pozițiile ofertei, înghețate) plus
     * necesarul lui, trimis la depozit pe șantierul nou. Unul pe fișier: refăcut
     * după o corectură, îl înlocuiește pe cel vechi — dar nu și după ce are
     * situații de lucrări, fiindcă istoricul lor e pe pozițiile vechi.
     */
    function creeazaSantier(): void {
      const s = sesiune;
      const form = pagina.querySelector<HTMLFormElement>("#antet-oferta");
      if (!s || !form) return;
      const planuri = citestePlanuri();
      const vechi = planuri.find((p) => p.fisier === s.meta.nume);
      if (vechi && vechi.situatii.length > 0) {
        arataMesaj(`Șantierul „${vechi.denumire}” are deja situații de lucrări: nu se mai poate înlocui din ofertă.`);
        return;
      }
      const plan = planDinOferta(cerereDinFormular(s, form), vechi?.id ?? `S-${idNou()}`);
      if (!scriePlanuri([plan, ...planuri.filter((p) => p !== vechi)])) {
        arataMesaj("Browserul nu permite salvarea: șantierul nu a putut fi creat.");
        return;
      }
      const n = necesarDinLinii(s.rez.linii, adaosNecesar);
      const st = citesteDepozit();
      const vechiNecesar = st.necesare.find((x) => x.fisier === s.meta.nume);
      const nou = {
        id: vechiNecesar?.id ?? idNou(), creat: new Date().toISOString(), fisier: s.meta.nume,
        obiectiv: plan.denumire, adaos: n.adaos, materiale: n.materiale,
        faraNecesar: n.faraNecesar.length, santier: plan.id,
      };
      scrieDepozit({ ...st, necesare: [nou, ...st.necesare.filter((x) => x !== vechiNecesar)] });
      deschideLaIntrare(plan.id);
      location.hash = "#/lucrari";
    }

    /* ---------------------------------------------------------- evenimente */
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

    gazda.addEventListener("click", (e) => {
      const t = e.target as HTMLElement;

      const bPas = t.closest<HTMLButtonElement>("[data-pas]");
      if (bPas) {
        pas = Number(bPas.dataset["pas"]) as Pas;
        stergeDe = null; editIdx = null;
        deseneaza();
        scrollTo({ top: 0 });
        if (pas === 3) pagina.querySelector<HTMLInputElement>('[name="numar"]')?.focus({ preventScroll: true });
        return;
      }

      const bFiltru = t.closest<HTMLButtonElement>("[data-filtru]");
      if (bFiltru) { filtru = bFiltru.dataset["filtru"] as FiltruStare; motiv = null; editIdx = null; deseneaza(); return; }
      const bTab = t.closest<HTMLButtonElement>('[data-act="foaie-tab"]');
      if (bTab) { foaie = bTab.dataset["foaie"] ?? null; motiv = null; editIdx = null; deseneaza(); return; }

      const bMotiv = t.closest<HTMLButtonElement>("[data-motiv]");
      if (bMotiv) { const m = bMotiv.dataset["motiv"] as CodMotiv; motiv = motiv === m ? null : m; deseneaza(); return; }

      const b = t.closest<HTMLButtonElement>("button[data-act]");
      const act = b?.dataset["act"];
      if (!b || !act) return;
      const idx = b.dataset["idx"] !== undefined ? Number(b.dataset["idx"]) : null;

      switch (act) {
        case "deschide": void redeschide(b.dataset["id"]!, false); return;
        case "sterge": {
          const id = b.dataset["id"]!;
          if (stergeDe !== id) {
            stergeDe = id;
            deseneaza();
            pagina.querySelector<HTMLElement>(`[data-act="sterge"][data-id="${CSS.escape(id)}"]`)?.focus();
            return;
          }
          stergeDe = null;
          void sterge(id).then(async () => {
            if (sesiune?.meta.id === id) sesiune = null;
            istoric = await listeaza();
            deseneaza();
          });
          return;
        }
        case "schimba-fisier": pas = 1; editIdx = null; deseneaza(); scrollTo({ top: 0 }); return;
        case "la-verificare": pas = 2; deseneaza(); scrollTo({ top: 0 }); return;
        case "creeaza-santier": creeazaSantier(); return;
        case "excel": excel = !excel; editIdx = null; deseneaza(); return;
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
        case "tot-textul": {
          const deschis = b.previousElementSibling?.classList.toggle("deschis") ?? false;
          b.textContent = deschis ? "Mai puțin" : "Tot textul";
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

    gazda.addEventListener("change", (e) => {
      const t = e.target as HTMLInputElement | HTMLSelectElement;
      if (t.id === "fisier") {
        const f = (t as HTMLInputElement).files?.[0];
        if (f) void proceseaza(f);
        return;
      }
      if (t.name === "segment") {
        destinatie = t.value as Destinatie;
        retarifeaza();
        if (pas !== 1) deseneaza();
        return;
      }
      if (t.id === "adaos-necesar" && sesiune) {
        // Doar cardul: o redesenare a pasului ar sterge datele ofertei deja scrise.
        adaosNecesar = Number(t.value);
        pagina.querySelector("#necesar")!.outerHTML = cardNecesar(necesarDinLinii(sesiune.rez.linii, adaosNecesar));
        return;
      }
      if (t.dataset["act"] === "filtru") { filtru = t.value as FiltruStare; motiv = null; editIdx = null; deseneaza(); return; }
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
        const { oferta } = imparte(cuAjustare(sesiune.rez.linii, ajustare));
        pagina.querySelector("#valoare-oferta")!.textContent = eur(totalCuAdaos(oferta, destinatie));
        pagina.querySelector("#detaliu-valoare")!.innerHTML = detaliuValoare(adaosFocIndustrial(oferta, destinatie), ajustare);
        return;
      }
      const editor = camp.closest<HTMLFormElement>(".imp-editor");
      if (editor) {
        if (!["text", "um", "cantitate", "pret_manual"].includes((camp as HTMLInputElement).name)) editor.dataset["atins"] = "da";
        return;
      }
      const s = sesiune;
      if (!s || !camp.matches(".camp[data-cel]")) return;
      const numeFoaie = camp.dataset["foaie"] ?? "";
      const rand = s.foi.find((f) => f.nume === numeFoaie)?.randuri.find((r) => r.rand === Number(camp.dataset["rand"]));
      if (!rand) return;
      const cel = Number(camp.dataset["cel"]);
      const vechi = rand.celule[cel];
      const vVechi = vechi?.v ?? null;
      // Pozitia verificata de om inainte de tasta asta. Daca tasta ii schimba
      // descrierea, nucleul o reciteste si o trimite la „De verificat"; mesajul
      // spune asta si da drumul inapoi, cu tot cu textul de dinainte.
      const idxRand = rand.linie?.index;
      const inainte = idxRand === undefined ? undefined : s.rez.rezolvate.get(idxRand);
      const editareVeche = s.editari.find((x) => x.foaie === numeFoaie && x.rand === rand.rand && x.cel === cel);
      const text = camp.textContent ?? "";
      const nou = vechi && typeof vechi.v === "number" && text.trim() !== "" && !Number.isNaN(Number(text)) ? Number(text) : text;
      scrieCelula(rand, cel, nou);
      reconstruieste(rand);
      const editare: EditareCelula = { foaie: numeFoaie, rand: rand.rand, cel, v: nou };
      const i = s.editari.findIndex((x) => x.foaie === editare.foaie && x.rand === editare.rand && x.cel === cel);
      if (i >= 0) s.editari[i] = editare; else s.editari.push(editare);
      retarifeaza();
      if (idxRand !== undefined && inainte?.sursa === "om" && s.rez.rezolvate.get(idxRand)?.sursa !== "om") {
        arataMesaj("Descrierea s-a schimbat: poziția e recitită și trece la „De verificat”.", () => {
          scrieCelula(rand, cel, vVechi);
          reconstruieste(rand);
          const j = s.editari.findIndex((x) => x.foaie === numeFoaie && x.rand === rand.rand && x.cel === cel);
          if (editareVeche) s.editari[j] = editareVeche; else if (j >= 0) s.editari.splice(j, 1);
          s.rez.rezolvate.set(idxRand, inainte);
          descrieriSchimbate.delete(idxRand);
          retarifeaza();
        });
      }
      // Randul atins isi reface coloanele noastre pe loc, fara redesenarea
      // tabelului: cursorul ramane in celula in care scrie omul.
      const tr = camp.closest<HTMLTableRowElement>("tr");
      const l = s.rez.linii.find((x) => x.bruta.foaie === numeFoaie && x.bruta.rand === rand.rand);
      if (tr && l && l.extras.sistem !== null) {
        tr.querySelectorAll("td.extras").forEach((td) => td.remove());
        tr.insertAdjacentHTML("beforeend", celuleExtrase(l, { propunere, editIdx }));
        tr.dataset["stare"] = stareLinie(l);
        tr.dataset["idx"] = String(l.extras.index);
      }
    });

    gazda.addEventListener("toggle", (e) => {
      const t = e.target as HTMLElement;
      if (t.matches(".imp-detalii")) detaliiDeschise = (t as HTMLDetailsElement).open;
    }, true);

    /* -------------------------------------------------------- la deschidere */
    // Reincarcarea paginii nu arunca munca: importul la care se lucra se
    // redeschide singur, fara sa cheme modelul.
    istoric = await listeaza();
    // Registrul venit din notitele de santier trece prin import ca un fisier
    // de client: aceeasi verificare, acelasi pas „Oferta".
    const predat = preia();
    if (predat) {
      destinatie = predat.destinatie;
      await proceseaza(predat.fisier, predat);
      return;
    }
    const curent = idCurent();
    if (curent) {
      try {
        await redeschide(curent, true);
        return;
      } catch {
        puneCurent(null);
      }
    }
    deseneaza();
  },
};
