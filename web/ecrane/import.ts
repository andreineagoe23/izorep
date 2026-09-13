import { proceseazaRegistru, reevalueaza, type Extractor, type LinieProcesata, type Rezultat } from "../../src/import/nucleu.js";
import { scrieCelula, reconstruieste } from "../../src/import/editare.js";
import { invataDinCorectie } from "../../src/import/memorie.js";
import { mapariStatice } from "../../src/import/mapari-statice.js";
import type { LinieExtrasa } from "../../src/import/schema.js";
// Doar tipul: ExcelJS (~940 kB) ramane incarcat lenes, prin `import()`.
import type { FoaieBruta } from "../../src/import/parse-workbook.js";
import type { Destinatie } from "../../src/pricing/lists.js";
import { grosimePropusa } from "../../src/pricing/grosimi-uzuale.js";
import { stocLocal } from "../stoc-local.js";
import { anuleaza, confirma, potrivit } from "../validare.js";
import { cate, esc, type Ecran } from "./tip.js";
import { FIRME } from "../date/seed.js";
import { clientPropus, dataAzi, imparte, registruOferta, totalOferta, type AntetOferta } from "../oferta.js";
import { descarca, numeOferta } from "../descarca.js";
import {
  idCurent, incarca, listeaza, puneCurent, salveaza, sterge,
  type EditareCelula, type IntrareIstoric, type SesiuneImport,
} from "../istoric.js";
import {
  actiuniLista, antetVerificare, cardPozitie, comutaExcel, ecranOferta, ecranProgres, ecranStart,
  filtreMotiv, filtreStare, numaraMotive, pasi, toast, type FiltruStare, type Pas,
} from "../import/vizual.js";
import { celuleExtrase, grilaFoaie } from "../import/grila.js";
import { motiveLinie, stareLinie, type CodMotiv } from "../import/text.js";

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
    let pas: Pas = 1;
    let sesiune: Sesiune | null = null;
    let istoric: IntrareIstoric[] = [];
    let filtru: FiltruStare = "toate";
    let motiv: CodMotiv | null = null;
    let foaie: string | null = null;
    let editIdx: number | null = null;
    /** Foaia ca in Excel e vederea implicita; lista de carduri e la un clic. */
    let excel = true;
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

    const optiuni = () => ({ stoc, mapari, prag, destinatie, grosimiPropuse });

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
          extrase: [...s.rez.rezolvate].map(([index, r]) => ({ index, extras: r.extras, sursa: r.sursa })),
          editari: s.editari,
          destinatie,
          grosimiPropuse: [...grosimiPropuse],
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
      elPasi.innerHTML = pasi(pas, { 1: true, 2: areSesiune, 3: areSesiune });
      if (pas === 1 || !sesiune) {
        pagina.innerHTML = ecranStart({ destinatie, istoric, stergeDe, eroare: eroareStart });
        legaDrop();
      } else if (pas === 2) {
        pagina.innerHTML = paginaVerificare(sesiune);
      } else {
        const { oferta, deValidat, netarifate } = imparte(sesiune.rez.linii);
        pagina.innerHTML = ecranOferta({
          gata: oferta.length, valoare: totalOferta(oferta),
          deVerificat: deValidat.length, faraPret: netarifate.length,
          destinatie, client: clientPropus(sesiune.meta.nume), data: dataAzi(), firme: FIRME, eroare: "",
        });
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

      const gol = `<p class="imp-gol">Nicio poziție aici.</p>`;
      let corp: string;
      if (excel) {
        // Fara filtru se vede tot fisierul, cu titluri si note, ca in Excel.
        const vizibileIdx = filtru === "toate" && motiv === null ? null : new Set(lista.map((l) => l.extras.index));
        const harta = new Map(s.rez.linii.map((l) => [l.extras.index, l]));
        corp = s.foi.filter((f) => !foaie || f.nume === foaie)
          .map((f) => grilaFoaie(f, harta, { vizibile: vizibileIdx, editIdx, propunere, cuNumeFoaie: cuFoaie }))
          .join("") || gol;
      } else {
        corp = lista.length
          ? lista.map((l) => cardPozitie(l, { propunere: propunere(l), editeaza: editIdx === l.extras.index, cuFoaie })).join("")
          : gol;
      }

      return `${alerte(s)}
        <section class="imp-card">${antetVerificare({
          nume: s.meta.nume, cand: s.meta.cand, destinatie, foi: s.foi.map((f) => f.nume), foaie,
        })}</section>
        <div class="imp-bara-lista">${filtreStare(numere, filtru)}${comutaExcel(excel)}</div>
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
      pas = 2; filtru = "toate"; motiv = null; foaie = null; editIdx = null; excel = true;
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
     */
    function corecteaza(idx: number, patch: Partial<LinieExtrasa>, invata = true): void {
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
        if (vechi) s.rez.rezolvate.set(idx, vechi); else s.rez.rezolvate.delete(idx);
        if (propusa !== undefined) grosimiPropuse.set(idx, propusa);
        retarifeaza();
      });
      if (invata && noua && noua.extras.sistem !== null) deInvatat = { text: noua.bruta.text, extras: noua.extras };
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
      const rez = await proceseazaRegistru(foi, optiuni());
      for (const x of s.extrase) rez.rezolvate.set(x.index, { extras: x.extras, sursa: x.sursa });
      reevalueaza(rez, optiuni());
      puneCurent(id);
      deschideSesiune({ foi, rez, meta: s, editari: [...s.editari], avertisment: "" });
      if (!restaurat) arataMesaj(`Ai deschis ${s.nume}.`);
    }

    async function proceseaza(fisier: File): Promise<void> {
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
        const rez = await proceseazaRegistru(foi, { ...optiuni(), ...(extractor ? { extrage: extractor } : {}) });
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
        eroareStart = `<strong>Fișierul nu a putut fi citit.</strong> ${esc(e instanceof Error ? e.message : String(e))}`
          + " Dacă e un .xls vechi, salvează-l din Excel ca .xlsx.";
        deseneaza();
      }
    }

    async function genereazaOferta(form: HTMLFormElement): Promise<void> {
      const s = sesiune;
      if (!s) return;
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
      const buton = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
      const eticheta = buton.textContent;
      buton.disabled = true;
      buton.textContent = "Se pregătește…";
      form.querySelector(".alerta")?.remove();
      try {
        const buf = await registruOferta({
          linii: s.rez.linii, antet,
          provenienta: {
            generatLa: new Date().toISOString(), destinatie, model: s.meta.model,
            sesiune: s.meta.id, fisierSursa: s.meta.nume,
          },
        });
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
        case "excel": excel = !excel; editIdx = null; deseneaza(); return;
        case "modifica":
          editIdx = editIdx === idx ? null : idx;
          deseneaza();
          if (editIdx !== null) pagina.querySelector<HTMLElement>(`.imp-editor[data-idx="${idx}"] select`)?.focus();
          else focuseaza(idx);
          return;
        case "renunta": { const i = editIdx; editIdx = null; deseneaza(); focuseaza(i); return; }
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
      if (t.dataset["act"] === "foaie") { foaie = t.value || null; motiv = null; editIdx = null; deseneaza(); return; }
      if (t.name === "sistem" && t.closest(".imp-editor")) {
        const form = t.closest<HTMLFormElement>(".imp-editor")!;
        const gol = t.value === "goluri_foc";
        form.querySelector<HTMLElement>(".imp-editor-teava")!.hidden = gol || t.value === "";
        form.querySelector<HTMLElement>(".imp-editor-gol")!.hidden = !gol;
      }
    });

    gazda.addEventListener("submit", (e) => {
      const form = e.target as HTMLFormElement;
      e.preventDefault();
      if (form.id === "antet-oferta") { void genereazaOferta(form); return; }
      if (!form.classList.contains("imp-editor")) return;
      const idx = Number(form.dataset["idx"]);
      const date = new FormData(form);
      const nr = (n: string): number | null => {
        const v = String(date.get(n) ?? "").trim().replace(",", ".");
        return v === "" || Number.isNaN(Number(v)) ? null : Number(v);
      };
      const sistem = (String(date.get("sistem") ?? "") || null) as LinieExtrasa["sistem"];
      const patch: Partial<LinieExtrasa> = sistem === "goluri_foc"
        ? { sistem, gol_latime_mm: nr("gol_latime"), gol_inaltime_mm: nr("gol_inaltime") }
        : {
            sistem,
            diametru_valoare: nr("diametru"),
            diametru_tip: nr("diametru") === null ? null : String(date.get("diametru_tip")) as LinieExtrasa["diametru_tip"],
            grosime_mm: nr("grosime"),
          };
      corecteaza(idx, patch);
      deseneaza();
      focuseaza(idx);
    });

    // Vederea ca in Excel: corectura unei celule reextrage si retarifeaza
    // randul. Grila NU se redeseneaza la fiecare tasta — s-ar pierde cursorul —
    // doar bara de jos, care spune cat e gata.
    gazda.addEventListener("input", (e) => {
      const camp = e.target as HTMLElement;
      const s = sesiune;
      if (!s || !camp.matches(".camp[data-cel]")) return;
      const numeFoaie = camp.dataset["foaie"] ?? "";
      const rand = s.foi.find((f) => f.nume === numeFoaie)?.randuri.find((r) => r.rand === Number(camp.dataset["rand"]));
      if (!rand) return;
      const cel = Number(camp.dataset["cel"]);
      const vechi = rand.celule[cel];
      const text = camp.textContent ?? "";
      const nou = vechi && typeof vechi.v === "number" && text.trim() !== "" && !Number.isNaN(Number(text)) ? Number(text) : text;
      scrieCelula(rand, cel, nou);
      reconstruieste(rand);
      const editare: EditareCelula = { foaie: numeFoaie, rand: rand.rand, cel, v: nou };
      const i = s.editari.findIndex((x) => x.foaie === editare.foaie && x.rand === editare.rand && x.cel === cel);
      if (i >= 0) s.editari[i] = editare; else s.editari.push(editare);
      retarifeaza();
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
