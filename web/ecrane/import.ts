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
import { FIRME, logoFirmei } from "../date/firme.js";
import {
  adaosFocIndustrial, clientPropus, cuAjustare, cuDenumiri, dataAzi, imparte, planDinOferta, totalCuAdaos, valoareOferta,
  type AntetOferta, type CerereOferta,
} from "../oferta.js";

import { descarca, numeOferta } from "../descarca.js";
import { PIERDERI_IMPLICITE, PRAG_TUB_MM, necesarDinLinii, type Pierderi } from "../../src/stoc/necesar.js";
import { cardNecesar } from "../stoc-vizual.js";
import { pastreazaEditari } from "../../src/stoc/editari-necesar.js";
import {
  citesteDepozit, citestePlanuri, idCurent, idNou, incarca, listeaza, puneCurent,
  salveaza, salveazaOferta, scrieDepozit, scriePlanuri, citesteOferte, ceSeVaSterge, stergeDeTot,
  urmatorulNumar,
} from "../date.js";
import type { EditareCelula, IntrareIstoric, SesiuneImport } from "../istoric.js";
import {
  actiuniLista, antetVerificare, detaliuValoare, ecranOferta, ecranProgres, ecranStart, editorPozitie,
  filtreMotiv, numaraMotive, pasi, patchDinFormular, randStrat, toast,
  type FiltruStare, type Pas,
} from "../import/vizual.js";
import {
  antetDinFisier, baraVerificare, exportPeEcran, type AntetScris, type SchimbariPozitie, type Vedere,
} from "../import/oferta-vizual.js";
import { JACHETE, patchDinCamp, verificarePeEcran } from "../import/verificare-vizual.js";
import { documentOferta, textClient, type PozitieOferta } from "../document-oferta.js";
import { legaCelule, numarInCelula, numarScris, pastreazaCursorul } from "../celula.js";
import { rutaModel } from "../imagine.js";
import { legaPanouStergere, panouStergere } from "../confirmare.js";
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
    firma: FIRME[0].id, numar: "", data: dataAzi(), localitate: "PALTINIS", discount: 0,
    client: dinFisier.client ?? (numeFisier ? clientPropus(numeFisier) : ""),
    obiectiv: dinFisier.obiectiv ?? "", persoana: dinFisier.persoana ?? "",
  };
}

export const ecran: Ecran = {
  id: "import",
  titlu: "Cerere nouă",

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
    /** Denumirile scrise de om în tabelul ofertei. Vezi `SesiuneImport.denumiri`. */
    let denumiri = new Map<number, string>();
    let pas: Pas = 1;
    let sesiune: Sesiune | null = null;
    let istoric: IntrareIstoric[] = [];
    let filtru: FiltruStare = "toate";
    let motiv: CodMotiv | null = null;
    let editIdx: number | null = null;
    /**
     * Ce se vede la verificare: oferta (implicit, aceeasi pentru orice fisier,
     * exact ce se descarca) sau fisierul clientului, ca referinta.
     */
    let vedere: Vedere = "verificare";
    /** Datele de pe antetul ofertei, scrise la pasul „Oferta”; se tin in sesiune. */
    let antet: AntetScris = antetImplicit("");
    /** Adaosul pentru coturi si fitinguri din cardul „Materiale necesare". */
    let pierderi: Pierderi = { ...PIERDERI_IMPLICITE };
    let pragTub = PRAG_TUB_MM;
    /** Diametrele peste prag comandate tot ca tub (cochilii, ca la TRANSAVIA). */
    let tuburiPeste: number[] = [];
    /** Ajustarea tehnicului pe toate prețurile, din pasul „Oferta" (procente). */
    let ajustare = 0;
    let detaliiDeschise = false;
    let stergeDe: string | null = null;
    let eroareStergere = "";
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

    /**
     * Antetul unei sesiuni fara antet salvat: din oferta descarcata deja pe ea
     * (sesiunile de dinainte de 14 octombrie 2026), altfel din fisier.
     */
    function antetDinOferta(s: Sesiune): AntetScris {
      const baza = antetImplicit(s.meta.nume, antetDinFisier(s.foi));
      const o = citesteOferte()[s.meta.id];
      if (!o) return baza;
      const firma = FIRME.find((f) => o.numar.startsWith(f.serieOferta));
      return {
        ...baza, ...(firma ? { firma: firma.id, numar: o.numar.slice(firma.serieOferta.length) } : {}),
        ...(o.data ? { data: o.data } : {}), ...(o.client ? { client: o.client } : {}), ...(o.obiectiv ? { obiectiv: o.obiectiv } : {}),
      };
    }

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
      await salveaza({
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
        denumiri: [...denumiri],
        antet, ajustare,
      });
      istoric = await listeaza();
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
      elPasi.innerHTML = pasi(pas, { 1: true, 2: areSesiune, 3: areSesiune });
      if (pas === 1 && deIzolat) {
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
      } else if (pas === 1 || !sesiune) {
        const deSters = stergeDe ? istoric.find((i) => i.id === stergeDe) : undefined;
        pagina.innerHTML = ecranStart({
          destinatie, istoric, stergeDe, eroare: eroareStart, oferte: citesteOferte(),
          ...(deSters ? { confirmare: panouStergere({
            ce: `cererea „${deSters.nume}”`, linii: ceSeVaSterge({ cerere: { id: deSters.id, nume: deSters.nume } }),
            date: { id: deSters.id }, ...(eroareStergere ? { eroare: eroareStergere } : {}),
          }) } : {}),
        });
        legaDrop();
      } else if (pas === 2) {
        pagina.innerHTML = paginaVerificare(sesiune);
      } else {
        const { oferta, deValidat, netarifate } = imparte(cuAjustare(sesiune.rez.linii, ajustare));
        pagina.innerHTML = ecranOferta({
          gata: oferta.length, valoare: documentul(sesiune).totalGeneral,
          adaosFoc: adaosFocIndustrial(oferta, destinatie), ajustare,
          deVerificat: deValidat.length, faraPret: netarifate.length,
          destinatie, antet, firme: FIRME, eroare: "",
        }) + cardNecesar(necesarOferta(sesiune));
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

    /** Suma de sus a pasului „Oferta”, la fiecare tastă: ce plătește clientul, ca în document. */
    function arataValoarea(s: Sesiune): void {
      const { oferta } = imparte(cuAjustare(s.rez.linii, ajustare));
      const v = pagina.querySelector("#valoare-oferta");
      const det = pagina.querySelector("#detaliu-valoare");
      if (v) v.textContent = eur(documentul(s).totalGeneral);
      if (det) det.innerHTML = detaliuValoare(adaosFocIndustrial(oferta, destinatie), ajustare, antet.discount);
    }

    /** Documentul ofertei din sesiune, cu antetul si ajustarea de acum: acelasi din care se scrie Excelul. */
    function documentul(s: Sesiune, pastreaza: number | null = null): ReturnType<typeof documentOferta> {
      const firma = FIRME.find((f) => f.id === antet.firma) ?? FIRME[0];
      return documentOferta({
        linii: cuDenumiri(s.rez.linii, denumiri),
        antet: {
          serie: firma.serieOferta, numar: antet.numar, data: antet.data, persoana: antet.persoana, client: antet.client,
          obiectiv: antet.obiectiv, firma: firma.denumire, localitate: antet.localitate,
          ...(antet.discount > 0 ? { discountProcent: antet.discount } : {}), ...(ajustare ? { ajustareProcent: ajustare } : {}),
        },
        provenienta: { generatLa: "", destinatie, model: s.meta.model, sesiune: s.meta.id, fisierSursa: s.meta.nume },
      }, pastreaza);
    }

    function paginaVerificare(s: Sesiune): string {
      // Toate foile, pe capitolele clientului.
      const { pozitiile, peStare, lista } = vizibile(s);
      const numere: Record<FiltruStare, number> = {
        toate: pozitiile.length,
        gata: pozitiile.filter((l) => potrivit(l, "gata")).length,
        de_validat: pozitiile.filter((l) => potrivit(l, "de_validat")).length,
        netarifate: pozitiile.filter((l) => potrivit(l, "netarifate")).length,
      };
      const motive = filtru === "de_validat" || filtru === "netarifate" ? numaraMotive(peStare) : [];
      const cuFoaie = s.foi.length > 1;
      const filtrat = filtru === "toate" && motiv === null ? null : new Set(lista.map((l) => l.extras.index));
      if (filtrat && randInLucru !== null) filtrat.add(randInLucru);
      const harta = new Map(s.rez.linii.map((l) => [l.extras.index, l]));

      let corp: string;
      if (vedere === "export") corp = exportPeEcran(documentul(s));
      else {
        corp = verificarePeEcran(documentul(s, randInLucru), {
          linii: harta, vizibile: filtrat, editIdx, propunere, cuFoaie, schimbari: schimbariPozitie(s),
          descriere: (l) => celulaDescriere(s, l),
          um: (l) => { const c = campuriLinie(s, l)?.um; return c ? { cel: c.cel, v: String(c.v) } : undefined; },
        });
      }

      return `${alerte(s)}
        <section class="imp-card">${antetVerificare({ nume: s.meta.nume, cand: s.meta.cand, destinatie })}</section>
        ${baraVerificare(numere, filtru, vedere)}
        ${vedere === "verificare" ? filtreMotiv(motive, motiv) : ""}
        ${vedere === "verificare" ? actiuniLista({
          deConfirmat: filtru === "de_validat" ? lista.length : 0,
          grosimi: lista.filter((l) => potrivit(l, "netarifate") && propunere(l) !== null).length,
        }) : ""}
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
      pas = 2; filtru = "toate"; motiv = null; editIdx = null; randInLucru = null;
      // Latimea se masoara DUPA plierea barei, altfel ar decide pe locul pe
      // care il ocupa inca meniul. Sub prag, foaia 1:1 n-ar incapea fara
      // derulare laterala decat cu coloane de cateva litere: se deschide ca
      // lista, iar „Arată ca în Excel" ramane la un clic.
      ceriSpatiu(gazda, true);
      // Întâi ce a înțeles aplicația, de verificat; Excelul e al doilea tab
      // (Andrei, 21 octombrie 2026).
      vedere = "verificare";
      antet = s.meta.antet ? { ...s.meta.antet } : antetDinOferta(s);
      ajustare = s.meta.ajustare ?? 0;
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
      const { redeschideImport } = await import("../../src/import/redeschide.js");
      destinatie = s.destinatie ?? "rezidential";
      grosimiPropuse = new Map(s.grosimiPropuse ?? []);
      descrieriSchimbate = new Set(s.descrieriSchimbate ?? []);
      preturiManuale = new Map(s.preturiManuale ?? []);
      denumiri = new Map(s.denumiri ?? []);
      const rez = await redeschideImport(s, optiuni());
      puneCurent(id);
      deschideSesiune({ foi: rez.foi, rez, meta: s, editari: [...s.editari], avertisment: "" });
      if (!restaurat) arataMesaj(`Ai deschis ${s.nume}.`);
    }

    async function proceseaza(fisier: File, predare?: Predare): Promise<void> {
      deIzolat = null;
      pas = 2;
      elPasi.innerHTML = pasi(2, { 1: true, 2: false, 3: false });
      pagina.innerHTML = ecranProgres(`Se citește ${fisier.name}…`, null);
      try {
        const { parseFoiBuffer } = await import("../../src/import/parse-workbook.js");
        const buf = await fisier.arrayBuffer();
        const foi = await parseFoiBuffer(buf.slice(0));

        let esuate = 0;
        let plafon = "";
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
                  method: "POST", headers: { "Content-Type": "application/json", "X-Izorep": "1" },
                  body: JSON.stringify({ linii: loturi[i] }), signal: AbortSignal.timeout(120_000),
                });
                const corp = (await r.json()) as { linii?: LinieExtrasa[]; eroare?: string };
                if (r.status === 429 && corp.eroare) plafon = corp.eroare;
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
        denumiri = new Map();
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
        deschideSesiune({
          foi, rez, editari: [],
          avertisment: plafon
            ? `<p class="alerta"><strong>O parte din rânduri n-au fost citite cu model.</strong> ${esc(plafon)}</p>`
            : esuate > 0
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

    /** Antetul ofertei din formularul pasului 3; același pentru ofertă și pentru șantier. */
    /**
     * Materialele pentru exact pozitiile din oferta, cu preturile ei: aceleasi
     * linii din care `planDinOferta` face santierul.
     */
    /**
     * Doar cardul necesarului. Inlocuit cat un camp din el are focus, campul
     * isi pierde focusul, iar `change`-ul lui vine inca o data, pe un card deja
     * scos din pagina: garda opreste a doua redesenare.
     */
    let redeseneazaNecesarAcum = false;
    function redeseneazaNecesar(s: Sesiune): void {
      if (redeseneazaNecesarAcum) return;
      redeseneazaNecesarAcum = true;
      try {
        const el = pagina.querySelector("#necesar");
        if (el?.isConnected) el.outerHTML = cardNecesar(necesarOferta(s));
      } finally {
        redeseneazaNecesarAcum = false;
      }
    }

    function necesarOferta(s: Sesiune, discountProcent = 0): ReturnType<typeof necesarDinLinii> {
      return necesarDinLinii(imparte(cuAjustare(s.rez.linii, ajustare)).oferta, { pierderi, pragTub, tuburiPeste, discountProcent });
    }

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
        linii: cuDenumiri(s.rez.linii, denumiri), antet,
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
        const { registruOferta } = await import("../registru-oferta.js");
        const logo = logoFirmei(antet.firma);
        const base64 = logo ? await logoBase64(logo.fisier) : null;
        const buf = await registruOferta(cerere, logo && base64 ? { logo: { ...logo, base64 } } : {});
        // Salvata INAINTE de descarcare: ce pleaca la client e exact ce s-a
        // salvat. Pe server e o versiune noua; in browser, doar sumarul.
        const { valoare, pozitii } = valoareOferta(cerere);
        const firma = String(new FormData(form).get("firma") ?? FIRME[0].id);
        await salveazaAcum();
        await salveazaOferta(s.meta.id, firma, cerere, {
          numar: antet.numar ? `${antet.serie}${antet.numar}` : "", data: antet.data, client: antet.client,
          obiectiv: antet.obiectiv, valoare, pozitii, cand: new Date().toISOString(),
        });
        descarca(buf, numeOferta(antet.serie, antet.numar, antet.data));
        arataMesaj("Oferta a fost salvată și descărcată. O găsești și la „Oferte și cereri”.");
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
      // Șantierul acestei cereri, după id: același fișier importat din nou e
      // altă cerere, cu șantierul ei (16 octombrie 2026). Numele fișierului
      // leagă doar planurile vechi, fără `cerere`.
      const vechi = planuri.find((p) => p.cerere === s.meta.id || (p.cerere === undefined && p.fisier === s.meta.nume));
      if (vechi && vechi.situatii.length > 0) {
        arataMesaj(`Șantierul „${vechi.denumire}” e deja făcut din această cerere și are situații de lucrări, deci pozițiile lui nu se mai schimbă. Îl găsești în Șantiere.`);
        return;
      }
      const cerere = cerereDinFormular(s, form);
      // Fără obiectiv, șantierul lua numele fișierului („Transavia Abur”) și se
      // confunda cu altul din aceeași cerere (16 octombrie 2026).
      if (!cerere.antet.obiectiv) {
        arataMesaj("Scrie întâi obiectivul la „Datele ofertei”: așa se va numi șantierul.");
        form.querySelector<HTMLInputElement>('[name="obiectiv"]')?.focus();
        return;
      }
      const plan = planDinOferta(cerere, vechi?.id ?? `S-${idNou()}`, new Map(s.rez.brute.map((b) => [b.index, b.sectiune ?? ""])));
      if (!scriePlanuri([plan, ...planuri.filter((p) => p !== vechi)])) {
        arataMesaj("Browserul nu permite salvarea: șantierul nu a putut fi creat.");
        return;
      }
      const n = necesarOferta(s, cerere.antet.discountProcent ?? 0);
      const st = citesteDepozit();
      const vechiNecesar = vechi ? st.necesare.find((x) => x.santier === vechi.id || (x.santier === undefined && x.fisier === s.meta.nume)) : undefined;
      // Refăcut, lista păstrează ce a schimbat omul pe ea (cantități, ✕, „Îl dă clientul”, materialul de mână).
      const pastrat = pastreazaEditari(vechiNecesar, n.materiale);
      const nou = {
        id: vechiNecesar?.id ?? idNou(), creat: new Date().toISOString(), fisier: s.meta.nume,
        obiectiv: plan.denumire, pierderi: n.pierderi, pragTub: n.pragTub, tuburiPeste: n.tuburiPeste, ...pastrat,
        faraNecesar: n.faraNecesar.length, santier: plan.id,
        ...(vechiNecesar?.versiune !== undefined ? { versiune: vechiNecesar.versiune } : {}),
      };
      scrieDepozit({ ...st, necesare: [nou, ...st.necesare.filter((x) => x !== vechiNecesar)] });
      location.hash = `#/lucrari/${encodeURIComponent(plan.id)}`;
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

    gazda.addEventListener("keydown", (e) => {
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

      const bPas = t.closest<HTMLButtonElement>("[data-pas]");
      if (bPas) {
        pas = Number(bPas.dataset["pas"]) as Pas;
        stergeDe = null; editIdx = null;
        deseneaza();
        scrollTo({ top: 0 });
        if (pas === 3) {
          pagina.querySelector<HTMLInputElement>('[name="numar"]')?.focus({ preventScroll: true });
          void propuneNumar();
        }
        return;
      }

      const bFiltru = t.closest<HTMLButtonElement>("[data-filtru]");
      if (bFiltru) { filtru = bFiltru.dataset["filtru"] as FiltruStare; motiv = null; editIdx = null; randInLucru = null; deseneaza(); return; }

      const bMotiv = t.closest<HTMLButtonElement>("[data-motiv]");
      if (bMotiv) { const m = bMotiv.dataset["motiv"] as CodMotiv; motiv = motiv === m ? null : m; randInLucru = null; deseneaza(); return; }

      const b = t.closest<HTMLButtonElement>("button[data-act]");
      const act = b?.dataset["act"];
      if (!b || !act) return;
      const idx = b.dataset["idx"] !== undefined ? Number(b.dataset["idx"]) : null;

      switch (act) {
        case "deschide": void redeschide(b.dataset["id"]!, false); return;
        case "sterge": {
          // Primul pas: panoul cu ce se șterge. Ștergerea e abia după bifă și „Șterge definitiv”.
          const id = b.dataset["id"]!;
          stergeDe = stergeDe === id ? null : id;
          eroareStergere = "";
          deseneaza();
          pagina.querySelector<HTMLElement>(stergeDe
            ? '.sterge-panou [data-act="sterge-bifa"]' : `[data-act="sterge"][data-id="${CSS.escape(id)}"]`)?.focus();
          return;
        }
        case "sterge-renunta": {
          const id = b.dataset["id"]!;
          stergeDe = null;
          deseneaza();
          pagina.querySelector<HTMLElement>(`[data-act="sterge"][data-id="${CSS.escape(id)}"]`)?.focus();
          return;
        }
        case "sterge-definitiv": {
          const id = b.dataset["id"]!;
          const m = istoric.find((i) => i.id === id);
          if (!m) return;
          b.disabled = true;
          b.textContent = "Se șterge…";
          void stergeDeTot({ cerere: { id, nume: m.nume } }).then(async (refuz) => {
            if (refuz) eroareStergere = `Nu s-a șters: ${refuz}`;
            else {
              stergeDe = null;
              if (sesiune?.meta.id === id) sesiune = null;
              arataMesaj(`Am șters cererea „${m.nume}” și tot ce era legat de ea.`);
            }
            istoric = await listeaza();
            deseneaza();
          });
          return;
        }
        case "schimba-fisier": pas = 1; editIdx = null; deseneaza(); scrollTo({ top: 0 }); return;
        case "renunta-izolatie": deIzolat = null; deseneaza(); scrollTo({ top: 0 }); return;
        case "la-verificare": pas = 2; deseneaza(); scrollTo({ top: 0 }); return;
        case "creeaza-santier": creeazaSantier(); return;
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
        case "adauga-strat": {
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

    /** Pierderea scrisă într-un câmp al necesarului. `false`: aceeași ca înainte, sau nu e număr. */
    function scriePierderea(t: HTMLInputElement | HTMLSelectElement): boolean {
      const v = Number(t.value.replace(",", "."));
      const cat = t.dataset["cat"] as keyof Pierderi;
      if (t.value.trim() === "" || !Number.isFinite(v) || v < 0 || v > 100 || pierderi[cat] === v / 100) return false;
      pierderi = { ...pierderi, [cat]: v / 100 };
      return true;
    }

    gazda.addEventListener("change", (e) => {
      const t = e.target as HTMLInputElement | HTMLSelectElement;
      // Un câmp scos din pagină de o redesenare își trimite `change`-ul după: nu mai e al omului.
      if (!t.isConnected) return;
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
      if ((t.id === "prag-tub" || t.dataset["act"] === "pierdere" || t.dataset["act"] === "tub-peste") && sesiune) {
        // Doar cardul: o redesenare a pasului ar sterge datele ofertei deja scrise.
        if (t.id === "prag-tub") pragTub = Number(t.value);
        else if (t.dataset["act"] === "tub-peste") {
          const d = Number(t.value);
          const bifat = (t as HTMLInputElement).checked;
          tuburiPeste = bifat ? [...new Set([...tuburiPeste, d])] : tuburiPeste.filter((x) => x !== d);
        } else if (!scriePierderea(t)) return;
        redeseneazaNecesar(sesiune);
        return;
      }
      if (t.name === "vedere") { vedere = t.value as Vedere; editIdx = null; randInLucru = null; deseneaza(); return; }
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
        salveazaSesiune();
        void propuneNumar();
        return;
      }
      if (t.dataset["act"] === "filtru") { filtru = t.value as FiltruStare; motiv = null; editIdx = null; randInLucru = null; deseneaza(); return; }
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
      if (camp.dataset["act"] === "pierdere" && sesiune) {
        const s = sesiune;
        if (scriePierderea(camp as HTMLInputElement)) pastreazaCursorul(gazda, () => redeseneazaNecesar(s));
        return;
      }
      if ((camp as HTMLInputElement).name === "ajustare" && sesiune && pas === 3) {
        // Doar suma de sus: o redesenare a pasului ar sterge datele ofertei deja scrise.
        const v = Number((camp as HTMLInputElement).value.replace(",", "."));
        ajustare = Number.isFinite(v) && v > -100 ? v : 0;
        arataValoarea(sesiune);
        redeseneazaNecesar(sesiune);
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
        };
        if ((camp as HTMLInputElement).name === "discount") arataValoarea(sesiune);
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
          // 0 nu e o cantitate: la recitirea rândului ar ieși „fără cantitate”,
          // iar oferta punea 1, fără niciun semn (16 octombrie 2026).
          if (valoare === null || !(valoare > 0)) {
            if (!peLoc) {
              arataMesaj(valoare === 0
                ? "Cantitatea trebuie să fie mai mare decât 0. Ca să scoți poziția din ofertă, apasă ✕ pe rândul ei."
                : "Cantitatea se scrie ca număr mai mare decât 0, de exemplu 12 sau 12,5.");
            }
            return false;
          }
          return scrieCantitatea(idx, valoare, peLoc);
        }
        return el.dataset["ed"] === "pret" && scriePretul(idx, valoare, peLoc);
      },
      deseneaza,
      desenari: () => desenari,
    });

    gazda.addEventListener("input", (e) => {
      const el = e.target as HTMLElement;
      if (el.matches?.('.cel-ed[data-ed="desc"]') && scrieDescrierea(el, true)) pastreazaCursorul(gazda, deseneaza);
    });

    legaPanouStergere(gazda);

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
