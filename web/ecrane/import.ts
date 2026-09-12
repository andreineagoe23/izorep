import { proceseazaRegistru, reevalueaza, type Extractor, type LinieProcesata, type Rezultat } from "../../src/import/nucleu.js";
import { scrieCelula, reconstruieste } from "../../src/import/editare.js";
import { invataDinCorectie } from "../../src/import/memorie.js";
import { mapariStatice } from "../../src/import/mapari-statice.js";
import { amprentaFoaie } from "../../src/import/mapare.js";
import { stocLocal } from "../stoc-local.js";
import { SISTEME, type LinieExtrasa } from "../../src/import/schema.js";
import {
  anuleaza, blocaje, confirma, ETICHETE_BLOCAJ, nrBlocate, potrivit,
  type CodBlocaj, type Filtru, type Instantaneu, type Lentila,
} from "../validare.js";
// Doar tipurile: `import type` se sterge la compilare, deci ExcelJS (~940 kB)
// ramane incarcat lenes, prin `import()`-ul din `proceseaza`.
import type { CelulaBruta, FoaieBruta, RandBrut } from "../../src/import/parse-workbook.js";
import type { Destinatie } from "../../src/pricing/lists.js";
import { grosimePropusa } from "../../src/pricing/grosimi-uzuale.js";
import { card, data, esc, eur, indicator, nota, progres, stare, tabel, type Ecran } from "./tip.js";
import { FIRME } from "../date/seed.js";
// ExcelJS sta dincolo de un `await import(...)` in `oferta.ts`, ca la citire:
// aici se importa doar functia, deci cele ~940 kB nu intra in bundle-ul cu
// care se deschide ecranul.
import {
  clientPropus, dataAzi, imparte, registruOferta, totalOferta, type AntetOferta,
} from "../oferta.js";
import { descarca, numeOferta } from "../descarca.js";
import {
  idCurent, incarca, listeaza, puneCurent, salveaza, sterge,
  type EditareCelula, type SesiuneImport,
} from "../istoric.js";

/**
 * Ruta stratului cu model exista doar pe serverul de dezvoltare
 * (`scripts/vite-plugin-model.ts`). In build lipseste, iar ecranul cade curat
 * pe stratul determinist — asta e si motivul pentru care cheia API nu poate
 * ajunge in pagina: nu trece niciodata prin ea.
 *
 * Tot ce e L0-L4 (parsare, sectiuni, continuare, regex, memorie, dedup pe
 * sablon, guardrails, tarifare) trece prin `proceseazaRegistru`/`reevalueaza`
 * din `nucleu.js` — NU prin `pipeline.js`, care traga dupa el clientul OpenAI
 * (`extract-llm.ts`) intr-un bundle de browser. Ecranul ramane cu interfata:
 * grila 1:1 cu Excel-ul, istoricul de importuri, drag&drop, transportul catre
 * server. `tests/structura.test.ts` e bariera care spune ca ecranul nu mai
 * reimplementeaza L2a-L4 pe cont propriu — exact drift-ul care a produs cele
 * trei bug-uri masurate (guardrails care nu rulau aici, `modelFaraRaspuns`
 * numarat doar in CLI, plafonul de linii trimise la model taiat per apel).
 */
const RUTA_MODEL = location.pathname.replace(/[^/]*$/, "") + "api/extrage";

interface StareModel { disponibil: boolean; model: string; prag: number; lot?: number; concurenta?: number }

/**
 * Loturi mici, trimise in paralel din pagina.
 *
 * Un lot de 25 de linii ia ~19s la gpt-4o, deci 84 de linii secvential inseamna
 * ~80s de ecran gol. Impartite in loturi de 12 si trimise cate 4 deodata, ies in
 * ~20s — si, mai important, fiecare lot care se intoarce misca bara de progres.
 *
 * Valori implicite. Serverul de dezvoltare le poate suprascrie prin
 * IZOREP_LOT / IZOREP_CONCURENTA, iar ecranul le ia din raspunsul rutei —
 * prima manevra cand contul OpenAI da 429 e concurenta 1.
 */
const LOT_IMPLICIT = 25;
const CONCURENTA_IMPLICITA = 4;

async function interogheazaModel(): Promise<StareModel | null> {
  try {
    const r = await fetch(RUTA_MODEL);
    // Fara ruta, serverul static raspunde cu index.html si cod 200: verificam
    // tipul, nu doar codul, altfel "disponibil" ar depinde de o eroare de parsare.
    if (!r.ok || !r.headers.get("content-type")?.includes("application/json")) return null;
    const s = (await r.json()) as StareModel;
    return s.disponibil ? s : null;
  } catch {
    return null; // pe Pages ruta nu exista: nu e o eroare, e alt mediu
  }
}

/** Motivul + codurile de avertisment, pentru title-ul marcajului "de validat". */
function titluMarcaj(l: LinieProcesata): string {
  const coduri = l.avertismente?.map((a) => `${a.cod}: ${a.mesaj}`) ?? [];
  return [l.extras.motiv, ...coduri].join(" — ");
}

/**
 * Eticheta din coloana "de validat", pentru un rand de pozitie.
 *
 * `sursa: "om"` acopera si corectia unei singure celule, si confirmarea in
 * masa — amandoua inseamna acelasi lucru, "un om a vazut linia asta si e de
 * incredere", deci primesc aceeasi eticheta. Doua stari vizuale diferite
 * pentru "corectat manual" si "confirmat in masa" ar cere omul sa retina o
 * distinctie pe care nimeni n-a cerut-o.
 */
function marcajValidare(l: LinieProcesata): string {
  if (l.sursa === "om") return stare("confirmat", "ok");
  if (l.necesitaValidare) return stare("de validat", "atentie");
  return "";
}

/**
 * Grosimea propusa pentru o linie careia clientul nu i-a scris una.
 *
 * Se propune DOAR cand lipseste cu adevarat: o grosime scrisa de client sau
 * corectata de om nu se atinge niciodata. Vezi `grosimi-uzuale.ts` pentru de
 * unde vine regula si de ce e doar o propunere.
 */
function propunereGrosime(l: LinieProcesata): number | null {
  if (l.extras.grosime_mm !== null) return null;
  // `goluri_foc` nu e sistem de matrice: pretul lui vine din suprafata
  // golului, deci n-are grosime de propus.
  if (l.extras.sistem === null || l.extras.sistem === "goluri_foc") return null;
  if (l.extras.diametru_valoare === null || !l.extras.diametru_tip) return null;
  return grosimePropusa(l.extras.sistem, l.extras.diametru_valoare, l.extras.diametru_tip);
}

/**
 * Cele doua coloane de pret ale unui rand: unitar si total.
 *
 * Calculate, nu citite din fisier — clientul trimite cantitati, noi punem
 * preturile. Cand pozitia n-a putut fi tarifata, coloanele nu raman goale: ar
 * arata la fel ca un rand care nu e pozitie de izolatie. Arata o liniuta cu
 * cauza in `title`, ca omul sa stie DE CE lipseste pretul, nu doar CA lipseste.
 */
function celulePret(l: LinieProcesata): string {
  if (!l.pret) {
    const motiv = l.eroare ?? "poziție netarifată";
    return `<td class="extras n gol" data-pret title="${esc(motiv)}">—</td>`
      + `<td class="extras n gol" data-pret title="${esc(motiv)}">—</td>`;
  }
  const note = "note" in l.pret && l.pret.note?.length ? l.pret.note.join(" · ") : "";
  const titlu = note ? ` title="${esc(note)}"` : "";
  return `<td class="extras n" data-pret${titlu}>${eur(l.pret.pret_unitar)}${note ? " *" : ""}</td>`
    + `<td class="extras n" data-pret${titlu}>${eur(l.pret.total)}</td>`;
}

/**
 * Eticheta butonului de confirmare in masa, dupa filtrul activ.
 *
 * Ambiguitatea e periculoasa aici: un buton "Confirma tot" ar putea sa
 * confirme si pozitii pe care omul nu le-a vazut. Eticheta spune exact pe ce
 * actioneaza — numarul SI filtrul curent, nu doar numarul.
 */
const ETICHETA_CONFIRMARE: Record<Filtru, (n: number) => string> = {
  toate: (n) => `Confirmă toate cele ${n} poziții din foaia asta`,
  de_validat: (n) => `Confirmă cele ${n} poziții marcate din foaia asta`,
  netarifate: (n) => `Confirmă cele ${n} poziții netarifate din foaia asta`,
};

/**
 * Eticheta butonului sub lentila curenta, oricare ar fi ea.
 *
 * Sub o lentila de cauza, eticheta spune CAUZA, nu doar numarul: „Confirmă
 * cele 8 poziții cu «DN inexistent în seria de oțel» din foaia asta". Acelasi
 * motiv ca la cele trei de dinainte — un buton care spune doar cate, nu si
 * care, poate confirma pozitii pe care omul nu le-a vazut.
 */
const etichetaConfirmare = (l: Lentila, n: number): string =>
  typeof l === "object"
    ? `Confirmă cele ${n} poziții cu „${ETICHETE_BLOCAJ[l.cod].eticheta}” din foaia asta`
    : ETICHETA_CONFIRMARE[l](n);

/**
 * Segmentele intre care se poate alege la import.
 *
 * Rafinaria lipseste dinadins: nu exista nicio lista pentru ea, deci un buton
 * ar promite un pret pe care nimeni nu-l poate calcula. Reapare cand vin
 * listele. Vezi `.claude/liste-preturi.md`.
 */
const SEGMENTE: Destinatie[] = ["rezidential", "industrial"];
const ETICHETA_SEGMENT: Record<Destinatie, string> = {
  rezidential: "Rezidențială",
  industrial: "Industrială",
  rafinarie: "Rafinărie",
};

/**
 * Valoarea unei celule, ca text.
 *
 * Doua abateri de la valoarea bruta, amandoua ca sa arate ce vede omul cand
 * deschide fisierul, nu ce tine ExcelJS in memorie:
 *
 * - numerele se rotunjesc la 12 cifre semnificative, pentru ca 8084,33 e
 *   tinut ca 8084.330000000001, iar cifra aia nu exista in fisier;
 * - datele calendaristice se scriu ca in Excel. L0 le normalizeaza la ISO
 *   ("2026-09-04T00:00:00.000Z"), forma buna pentru extragere si proasta
 *   pentru citit.
 *
 * Nu e formatare in sens larg — despartitor de mii sau simbol de moneda ar
 * fi, si alea ar schimba ce scrie in celula.
 */
const ISO = /^(\d{4})-(\d{2})-(\d{2})T[\d:.]+Z$/;
const textCelula = (v: string | number | null): string => {
  if (v === null) return "";
  if (typeof v === "number") return String(Number(v.toPrecision(12)));
  const d = ISO.exec(v);
  return d ? `${d[3]}.${d[2]}.${d[1]}` : v;
};

/** A, B, … Z, AA — antetul de rezerva, pentru foile fara rand de antet. */
function litera(i: number): string {
  let s = "";
  for (let n = i; n >= 0; n = Math.floor(n / 26) - 1) s = String.fromCharCode(65 + (n % 26)) + s;
  return s;
}

const latime = (celule: CelulaBruta[]): number => celule.reduce((s, c) => s + c.span, 0);
/** Celulele goale cu care se completeaza un rand mai scurt decat foaia. */
const umplutura = (n: number, eticheta = "td"): string =>
  n > 0 ? `<${eticheta}></${eticheta}>`.repeat(n) : "";

export const ecran: Ecran = {
  id: "import",
  titlu: "Import Excel",
  subtitlu: "Trage o listă de cantități aici. Fișierul nu pleacă de pe calculatorul tău.",

  async render(root) {
    const info = await interogheazaModel();
    // Maparile de coloane (L1) vin din bundle-ul static — acelasi mecanism ca
    // `src/pricing/lists.ts` — nu de pe disc: `cache-mapari.ts` foloseste
    // `node:fs`, care n-ar exista in browser.
    const mapari = mapariStatice();
    const prag = info?.prag ?? 0.85;

    // Ce ruleaza, atat. Explicatiile de business (unde sta cheia API, de ce
    // ecranul cade pe stratul determinist pe Pages, cum se citeste grila) stau
    // in `.claude/ui.md` si `.claude/import.md` — sunt utile o data, nu la
    // fiecare fisier. Ecranul ramane cu date, contoare si controale.
    const explicatie = info
      ? `<p class="hint">Reguli + <code>${esc(info.model)}</code> pe liniile rămase, apoi tarifare.</p>`
      : `<p class="hint">Doar stratul determinist. Modelul pornește local, cu <code>npm run dev</code>.</p>`;

    /**
     * Segmentul pe care se tarifeaza importul curent. Schimbarea lui nu
     * recheama modelul si nu reciteste fisierul — doar retarifeaza ce e deja
     * extras, prin `reevalueaza`.
     */
    let destinatie: Destinatie = "rezidential";
    /**
     * Retarifarea raportului curent, pusa de `afiseaza`. Butonul de segment nu
     * poate ajunge singur la `rez`: acela traieste in inchiderea raportului.
     * Lipseste cat timp nu e niciun import pe ecran.
     */
    let retarifeaza: (() => void) | null = null;

    root.innerHTML = `
      <p>${info
        ? stare(`Extragere cu ${esc(info.model)}`, "ok")
        : stare("Stratul cu model: indisponibil aici", "neutru")}</p>
      <div class="filtre" role="group" aria-label="Segmentul ofertei">
        <span class="hint">Tipul ofertei:</span>
        ${SEGMENTE.map((d) => `<button class="filtru" data-segment="${d}" aria-pressed="${d === destinatie}">
          ${esc(ETICHETA_SEGMENT[d])}</button>`).join("")}
      </div>
      <label id="drop" class="drop" for="fisier">
        <strong>Trage un fișier .xlsx aici</strong>
        <span>sau click pentru a alege</span>
        <input id="fisier" type="file" accept=".xlsx" />
        ${explicatie}
      </label>
      <div id="istoric"></div>
      <div id="raport"></div>`;

    const $ = <T extends HTMLElement>(s: string) => root.querySelector(s) as T;
    const drop = $("#drop");
    const input = $<HTMLInputElement>("#fisier");

    // Deschiderea selectorului vine din <label for>, nu din JS: asa functioneaza
    // si de la tastatura, iar inputul ramane focusabil (ascuns vizual, nu `hidden`).
    input.onchange = () => { if (input.files?.[0]) void proceseaza(input.files[0]); };
    drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("peste"); });
    drop.addEventListener("dragleave", () => drop.classList.remove("peste"));
    drop.addEventListener("drop", (e) => {
      e.preventDefault(); drop.classList.remove("peste");
      const f = e.dataTransfer?.files[0];
      if (f) void proceseaza(f);
    });

    for (const b of root.querySelectorAll<HTMLButtonElement>("[data-segment]")) {
      b.onclick = () => {
        const ales = b.dataset["segment"] as Destinatie;
        if (ales === destinatie) return;
        destinatie = ales;
        for (const alt of root.querySelectorAll<HTMLButtonElement>("[data-segment]")) {
          alt.setAttribute("aria-pressed", String(alt === b));
        }
        // Nu se reciteste fisierul si nu se recheama modelul: ce s-a extras
        // ramane extras, se schimba doar lista din care se iau preturile.
        retarifeaza?.();
      };
    }

    const stoc = stocLocal();
    /** Optiunile date nucleului: aceleasi la fiecare apel, dintr-un singur loc. */
    const optiuniNucleu = () => ({ stoc, mapari, prag, destinatie });

    /**
     * Lista importurilor de pana acum.
     *
     * Nu tine documente — alea vor sta in baza. Tine ce a lucrat omul: fisierul,
     * ce s-a extras si ce a corectat. De-aia redeschiderea unui import vechi nu
     * cheama modelul din nou: nu costa tokeni si nu poate da alt rezultat decat
     * cel pe care l-a validat el.
     */
    async function deseneazaIstoric(): Promise<void> {
      const intrari = await listeaza();
      const gazda = $("#istoric");
      if (intrari.length === 0) { gazda.innerHTML = ""; return; }

      const curent = idCurent();
      const randuri = intrari.map((i) => `
        <tr${i.id === curent ? ' class="curent"' : ""}>
          <td><button class="ca-link" data-redeschide="${esc(i.id)}">${esc(i.nume)}</button>
            ${i.id === curent ? ` ${stare("deschis", "ok")}` : ""}</td>
          <td class="hint">${esc(data(i.cand))}</td>
          <td class="n">${i.pozitii}</td>
          <td class="n">${i.tarifate}</td>
          <td class="n">${eur(i.valoare)}</td>
          <td class="hint">${i.model ? esc(i.model) : "doar reguli"}</td>
          <td><button class="ca-link" data-sterge="${esc(i.id)}" aria-label="Șterge importul ${esc(i.nume)}">șterge</button></td>
        </tr>`);

      gazda.innerHTML = `<h2 class="sectiune">Importuri recente</h2>
        ${tabel(
          ["Fișier", "Când", "Poziții", "Tarifate", "Valoare", "Extras cu", ""],
          randuri, ["", "", "n", "n", "n", "", ""],
        )}
`;

      for (const b of gazda.querySelectorAll<HTMLButtonElement>("[data-redeschide]")) {
        b.onclick = () => void redeschide(b.dataset["redeschide"]!);
      }
      for (const b of gazda.querySelectorAll<HTMLButtonElement>("[data-sterge]")) {
        b.onclick = async () => {
          await sterge(b.dataset["sterge"]!);
          if (idCurent() === null) $("#raport").innerHTML = "";
          await deseneazaIstoric();
        };
      }
    }

    async function redeschide(id: string): Promise<void> {
      const s = await incarca(id);
      if (!s) { await deseneazaIstoric(); return; }
      puneCurent(id);
      await afiseazaSesiune(s, true);
      await deseneazaIstoric();
    }

    /**
     * Reface ecranul dintr-o sesiune salvata.
     *
     * Grila NU se salveaza: aceeasi parsare pe aceiasi bytes da aceleasi
     * randuri, deci se reface din bytes. Editarile de celula se aplica prin
     * `scrieCelula`+`reconstruieste` INAINTE de `proceseazaRegistru` — altfel
     * o sesiune redeschisa ar ignora corectiile, la fel cum le ignora azi.
     * Redeschiderea NU cheama modelul (fara `extrage` in optiuni): extragerile
     * salvate (inclusiv cele de la model sau de la om) se pun direct in
     * `rezolvate`, apoi `reevalueaza` reface `linii`/`statistici` peste ele.
     */
    async function afiseazaSesiune(s: SesiuneImport, restaurat: boolean): Promise<void> {
      const { parseFoiBuffer } = await import("../../src/import/parse-workbook.js");
      const foi = await parseFoiBuffer(s.fisier);

      for (const e of s.editari) {
        const rand = foi.find((f) => f.nume === e.foaie)?.randuri.find((r) => r.rand === e.rand);
        if (!rand) continue;
        scrieCelula(rand, e.cel, e.v);
        reconstruieste(rand);
      }

      const rez = await proceseazaRegistru(foi, optiuniNucleu());
      for (const x of s.extrase) rez.rezolvate.set(x.index, { extras: x.extras, sursa: x.sursa });
      reevalueaza(rez, optiuniNucleu());

      afiseaza({ foi, rez, avertisment: "", meta: s, editari: [...s.editari], restaurat });
    }

    /**
     * La deschiderea ecranului: istoricul, plus importul la care se lucra.
     *
     * Reincarcarea paginii nu are voie sa arunce munca. Importul curent ramane
     * pana cand omul incarca alt fisier sau il sterge din istoric.
     */
    async function laDeschidere(): Promise<void> {
      await deseneazaIstoric();
      const id = idCurent();
      if (!id) return;
      const s = await incarca(id);
      if (!s) { puneCurent(null); await deseneazaIstoric(); return; }
      try {
        await afiseazaSesiune(s, true);
      } catch {
        // Sesiune ilizibila (alt format, fisier trunchiat): se uita, nu se
        // blocheaza ecranul pe ea.
        puneCurent(null);
      }
      await deseneazaIstoric();
    }
    void laDeschidere();

    async function proceseaza(fisier: File): Promise<void> {
      const out = $("#raport");
      out.innerHTML = `<p class="nota">Se citește ${esc(fisier.name)}…</p>`;
      try {
        // ExcelJS e ~940 kB: se încarcă la prima folosire, nu la deschiderea paginii.
        const { parseFoiBuffer } = await import("../../src/import/parse-workbook.js");
        // Registrul se citește ca grilă — foaie cu foaie, cu rândurile intacte.
        // Bytes-ii se păstrează: din ei se reface grila la reîncărcarea paginii.
        const buf = await fisier.arrayBuffer();
        const foi = await parseFoiBuffer(buf.slice(0));

        // Cate linii era deja rezolvate determinist+din memorie, fixat inainte
        // de apelul la model — altfel eticheta ar minti pe masura ce se
        // intorc loturile. Vine din `laProgres`, nu recalculat separat, ca sa
        // nu existe doua drumuri care ar putea da alt numar.
        let determinist = 0;
        let esuateTotal = 0;
        let ultimaEroare = "";

        // Transportul catre server: loturi paralele, cu progres si toleranta
        // la loturi cazute. Asta e implementarea `Extractor` a ecranului —
        // tot ce e L2a-L4 determinist ramane in `nucleu.js`. `ctx.faza` da
        // eticheta din bara de progres ("sabloane" vs "linii ramase").
        const extractor: Extractor | undefined = info ? async (deTrimis, ctx) => {
          const lot = info.lot ?? LOT_IMPLICIT;
          const concurenta = info.concurenta ?? CONCURENTA_IMPLICITA;
          const eticheta = ctx.faza === "reprezentanti" ? `${deTrimis.length} șabloane` : "linii rămase";

          const loturi: (typeof deTrimis)[] = [];
          for (let i = 0; i < deTrimis.length; i += lot) loturi.push(deTrimis.slice(i, i + lot));
          const primite: LinieExtrasa[] = [];
          let gata = 0;
          let esuate = 0;

          const arataProgres = (): void => {
            const p = loturi.length ? Math.round((gata / loturi.length) * 100) : 100;
            out.innerHTML = `<p class="nota">Extragere deterministă gata (${determinist} linii).
              <strong>Extragere cu ${esc(info.model)}</strong> — ${eticheta}, ${deTrimis.length} linii,
              lotul ${Math.min(gata + 1, Math.max(loturi.length, 1))} din ${loturi.length}.</p>${progres(p)}`;
          };
          arataProgres();

          let urmator = 0;
          const lucrator = async (): Promise<void> => {
            for (let i = urmator++; i < loturi.length; i = urmator++) {
              try {
                const r = await fetch(RUTA_MODEL, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ linii: loturi[i] }),
                  // Un lot blocat nu are voie sa tina importul agatat la nesfarsit.
                  signal: AbortSignal.timeout(120_000),
                });
                const corp = (await r.json()) as { linii?: LinieExtrasa[]; eroare?: string };
                if (!r.ok) throw new Error(corp.eroare ?? `HTTP ${r.status}`);
                primite.push(...(corp.linii ?? []));
              } catch (e) {
                // Un lot cazut nu invalideaza importul: restul liniilor raman.
                esuate++;
                ultimaEroare = e instanceof Error ? e.message : String(e);
              } finally {
                gata++;
                arataProgres();
              }
            }
          };
          await Promise.all(Array.from({ length: Math.min(concurenta, Math.max(loturi.length, 1)) }, lucrator));
          esuateTotal += esuate;
          return primite;
        } : undefined;

        const rez = await proceseazaRegistru(foi, {
          ...optiuniNucleu(),
          laProgres: (p) => { if (p.faza === "memorie") determinist = p.gata; },
          ...(extractor ? { extrage: extractor } : {}),
        });

        const avertisment = esuateTotal > 0
          ? `<div class="alerta"><strong>${esuateTotal} loturi au eșuat</strong>
              ${esc(ultimaEroare)}<br>
              Raportul de mai jos conține restul liniilor. Reîncarcă fișierul ca să reîncerci.</div>`
          : "";

        afiseaza({
          foi, rez, avertisment,
          meta: {
            id: `${Date.now()}-${fisier.name}`,
            nume: fisier.name, marime: fisier.size, cand: new Date().toISOString(),
            model: info?.model ?? null, fisier: buf,
            pozitii: 0, tarifate: 0, valoare: 0, extrase: [], editari: [],
          },
          editari: [], restaurat: false,
        });
      } catch (e) {
        out.innerHTML = `<div class="alerta"><strong>Nu am putut citi fișierul</strong>
          ${esc(e instanceof Error ? e.message : String(e))}<br>
          Formatul .xls vechi nu e suportat în browser — salvează-l ca .xlsx.</div>`;
      }
    }

    interface ContextRaport {
      foi: FoaieBruta[];
      rez: Rezultat;
      avertisment: string;
      meta: SesiuneImport;
      editari: EditareCelula[];
      restaurat: boolean;
    }

    function afiseaza(ctx: ContextRaport): void {
      const out = $("#raport");
      const { foi, rez } = ctx;

      // Pe fila fiecarei foi: un semn cand foaia n-are mapare de coloane —
      // cantitatile ei raman pe euristica veche, nu pe coloana mapata.
      const foaieMapata = (f: FoaieBruta): boolean => mapari.has(amprentaFoaie(f));

      let izo = rez.linii.filter((l) => l.extras.sistem !== null);
      // Harta pe indexul din fisierul sursa: o editare cauta linia aici, nu
      // tine minte un index de rand care s-ar deplasa la orice sortare.
      let mapa = new Map(izo.map((l) => [l.extras.index, l]));

      /**
       * Lentila peste grila. NU e o preferinta persistenta: se reseteaza la
       * fiecare fisier nou, fiindca "de validat" inseamna altceva de la un
       * fisier la altul, iar un filtru mostenit ar ascunde randuri fara ca
       * omul sa fi cerut asta.
       */
      let filtru: Lentila = "toate";
      /**
       * Un singur nivel de anulare pentru confirmarea in masa.
       *
       * O actiune in masa fara drum inapoi e o capcana: omul confirma foaia
       * gresita si pe urma nu mai poate deosebi liniile alea de restul — toate
       * arata la fel, `sursa: "om"`. Un nivel ajunge; dispare la urmatoarea
       * confirmare sau la schimbarea fisierului.
       */
      let ultimaConfirmare: Instantaneu | null = null;
      /** Unde a ramas navigarea prin randurile marcate ale foii active. */
      let pozitiaSarita = -1;

      /** Pozitiile de izolatie ale unei foi, in ordinea din registru. */
      const liniiFoaie = (f: FoaieBruta): LinieProcesata[] =>
        izo.filter((l) => l.bruta.foaie === f.nume);
      /** Ce ramane vizibil pe foaia data, sub filtrul curent. */
      const subFiltru = (f: FoaieBruta): LinieProcesata[] =>
        liniiFoaie(f).filter((l) => potrivit(l, filtru));
      const deValidatPe = (f: FoaieBruta): number =>
        liniiFoaie(f).filter((l) => l.necesitaValidare).length;

      /** Randul de indicatoare — se reface dupa o editare, fara sa reconstruiasca tot tabelul. */
      function randStats(): string {
        const s = rez.statistici;
        const proc = s.liniiIzolatie ? `${((s.tarifate / s.liniiIzolatie) * 100).toFixed(0)}%` : "–";
        return `
          ${foi.length > 1 ? indicator(String(foi.length), "foi în registru") : ""}
          ${indicator(`${s.foiMapate}/${s.foi}`, "foi mapate", "coloane mapate: cantitatea nu se mai ghicește")}
          ${indicator(String(s.total), "rânduri cu text")}
          ${indicator(String(s.liniiIzolatie), "poziții de izolație")}
          ${indicator(String(s.tarifate), "tarifate", proc)}
          ${info ? indicator(String(s.prinModel), "rezolvate cu modelul") : ""}
          ${info && s.prinSablon
            ? indicator(String(s.prinSablon), "deduse din șablon", "linii geamăne, fără apel la model")
            : ""}
          ${s.prinMemorie
            ? indicator(String(s.prinMemorie), "din corecții anterioare", "șabloane învățate la importurile trecute")
            : ""}
          ${s.prinOm ? indicator(String(s.prinOm), "corectate de om") : ""}
          ${indicator(String(s.deValidat), "de validat de om", `încredere sub ${prag} sau fără preț`)}
          ${s.modelFaraRaspuns > 0
            ? indicator(String(s.modelFaraRaspuns), "fără răspuns de la model", "trimise, dar modelul n-a întors nimic")
            : ""}
          ${s.faraMasura ? indicator(String(s.faraMasura), "note și titluri", "fără UM și fără cantitate: nu sunt poziții") : ""}`;
      }

      /**
       * „Ce blochează N poziții" — cauzele, nu simptomele.
       *
       * Indicatoarele de mai sus spun CATE pozitii n-au pret. Niciodata de ce.
       * Masurat pe cele 10 fisiere reale, cele 130 de pozitii netarifate au
       * cinci cauze, iar 64 din 130 sunt acelasi raspuns neprimit de la firma
       * (intrebarea 9) — deci omul care vede „130 netarifate" crede ca are 130
       * de probleme, cand are cinci, dintre care una jumatate. Blocul asta e
       * diferenta dintre o lista si un diagnostic.
       *
       * Se calculeaza pe TOT registrul, nu pe foaia activa: cauza nu tine de
       * foaie, iar `Radoia.xlsx` are 7. Lentila de la „arată" filtreaza apoi
       * foaia deschisa, ca oricare alta.
       */
      function randBlocaje(): string {
        const lista = blocaje(izo);
        if (lista.length === 0) return "";
        const total = nrBlocate(izo);

        const randuri = lista.map((b) => {
          const intrebare = b.intrebare
            ? `<span class="hint">→ întrebarea ${b.intrebare} către firmă</span>`
            : "";
          return `<tr>
            <td class="n">${b.n}</td>
            <td>${esc(b.eticheta)} ${intrebare}</td>
            <td><button class="secundar" data-lentila="cod:${esc(b.cod)}">arată</button></td>
          </tr>`;
        });

        return `<details class="card" open>
          <summary><strong>Ce blochează ${total} ${total === 1 ? "poziție" : "poziții"}</strong></summary>
          ${tabel(["", "Cauza", ""], randuri, ["n", "", "fix"])}
        </details>`;
      }

      /**
       * Tabelul unei foi, 1:1 cu Excel-ul.
       *
       * Capetele NU sunt predefinite: sunt exact celulele randului de antet
       * din foaia asta, cu imbinarile lor. Foaia fara antet (Transavia isi
       * incepe datele de la primul rand) primeste literele de coloana, ca in
       * Excel. Dupa coloanele fisierului vin cele patru coloane ale
       * extragerii — singurele adaugate de noi.
       */
      function tabelFoaie(f: FoaieBruta): string {
        if (f.randuri.length === 0) return nota(`Foaia „${esc(f.nume)}” e goală.`);

        const capete = f.antet
          ? f.antet.celule.map((c) =>
              `<th scope="col"${c.span > 1 ? ` colspan="${c.span}"` : ""}>${esc(textCelula(c.v))}</th>`).join("")
            + umplutura(f.coloane - latime(f.antet.celule), "th")
          : Array.from({ length: f.coloane }, (_, i) => `<th scope="col" class="litera">${litera(i)}</th>`).join("");

        // Tabelul incepe DUPA randul de antet. Ce sta deasupra lui e antetul
        // foii — nume de proiect, beneficiar, garantie, termen de oferta — si
        // nu are coloanele tabelului: sub capetele reale ajungea „Nume proiect"
        // in dreptul lui „Denumire articol" si „SPITAL REGINA MARIA" in dreptul
        // lui „UM". Randurile alea raman vizibile, dar deasupra tabelului, ca
        // text. Foaia fara antet nu are ce taia: acolo datele incep de la
        // primul rand.
        const inceput = f.antet ? f.antet.rand : 0;
        const preambul = f.randuri
          .filter((r) => r.rand < inceput)
          .map((r) => r.celule.map((c) => textCelula(c.v)).filter((t) => t.trim() !== "").join(" · "))
          .filter((t) => t !== "");

        const antetFoaie = preambul.length === 0 ? "" : `<div class="preambul">${
          preambul.map((t) => `<span>${esc(t)}</span>`).join("")}</div>`;

        // Sub un filtru se vad DOAR randurile care se potrivesc. Numarul din
        // gutter ramane numarul real de rand din Excel, deci ancora 1:1 cu
        // fisierul nu se pierde: randurile lipsa se vad ca salturi in
        // numerotare, nu ca alta ordine.
        const vizibile = f.randuri
          .filter((r) => r.rand > inceput)
          .filter((r) => {
            if (filtru === "toate") return true;
            const l = r.linie ? mapa.get(r.linie.index) : undefined;
            return l ? potrivit(l, filtru) : false;
          });

        if (vizibile.length === 0) {
          return antetFoaie + nota(`Nicio poziție pe foaia „${esc(f.nume)}” sub filtrul curent.`);
        }

        const corp = vizibile.map((r) => randGrila(f, r)).join("");

        return `${antetFoaie}<div class="tabelwrap" tabindex="0"><table>
          <thead><tr>
            <th scope="col" class="gutter">${f.antet ? `r${f.antet.rand}` : "#"}</th>
            ${capete}
            ${["Sistem", "ø", "gros.", "P.U.", "Total", ""].map((c, i) =>
              `<th scope="col" class="extras${i > 0 && i < 5 ? " n" : ""}">${esc(c)}</th>`).join("")}
          </tr></thead>
          <tbody>${corp}</tbody>
        </table></div>`;
      }

      /**
       * Un rand din grila. Celulele fisierului sunt editabile ca text —
       * omul de la tehnic corecteaza acolo unde vede greseala, in coloana
       * clientului. Dupa ele stau coloanele extrase, completate doar pe
       * randurile care sunt pozitii de izolatie; pe un titlu sau pe un rand
       * de total raman goale, ca sa se vada dintr-o privire ce a inteles
       * sistemul si ce a sarit.
       */
      function randGrila(f: FoaieBruta, r: RandBrut): string {
        const l = r.linie ? mapa.get(r.linie.index) : undefined;
        const celule = r.celule.map((c, i) =>
          `<td${c.span > 1 ? ` colspan="${c.span}"` : ""}><div class="camp" contenteditable="true"
            spellcheck="false" data-rand="${r.rand}" data-cel="${i}">${esc(textCelula(c.v))}</div></td>`).join("");

        const extrase = l
          ? `<td class="extras"><select data-camp="sistem">${SISTEME.map((s) =>
               `<option value="${s}"${s === l.extras.sistem ? " selected" : ""}>${s.replace("_", " ")}</option>`).join("")}</select></td>
             <td class="extras n"><input type="number" step="any" data-camp="diametru" value="${l.extras.diametru_valoare ?? ""}" /></td>
             <td class="extras n"><input type="number" step="any" data-camp="grosime"
               value="${l.extras.grosime_mm ?? ""}"${(() => {
                 const g = propunereGrosime(l);
                 return g === null ? "" : ` placeholder="${g}" title="Propus ${g} mm după diametru, din practica firmei. Nu e aplicat: scrie-l sau folosește butonul din bară."`;
               })()} /></td>
             ${celulePret(l)}
             <td class="extras fix"><span data-marca title="${esc(titluMarcaj(l))}">${marcajValidare(l)}</span></td>`
          : `<td class="extras"></td><td class="extras"></td><td class="extras"></td>
             <td class="extras"></td><td class="extras"></td><td class="extras"></td>`;

        return `<tr${l ? ` data-idx="${l.extras.index}"` : ""}>
          <td class="gutter">${r.rand}</td>
          ${celule}${umplutura(f.coloane - latime(r.celule))}
          ${extrase}</tr>`;
      }

      out.innerHTML = `
        ${ctx.avertisment}
        ${ctx.restaurat
          ? nota(`Import redeschis: <strong>${esc(ctx.meta.nume)}</strong>, ${esc(data(ctx.meta.cand))}.`)
          : ""}
        <div id="stats" class="stats">${randStats()}</div>
        <div id="blocaje">${randBlocaje()}</div>
        ${rez.statistici.trunchiat > 0
          ? nota(`Plafonul per import e de 400 de linii trimise la model; ${rez.statistici.trunchiat} au rămas netrimise.`)
          : ""}
        ${rez.statistici.randuriManopera > 0 && rez.statistici.tarifate === 0
          ? `<p class="alerta"><strong>Ofertă de manoperă.</strong> Nu avem listă de prețuri de manoperă
             (tarif plat 2,20–3,00 €/ml). Listele motorului sunt material + manoperă: ar da de 2,5–3,8×
             prețul corect.</p>`
          : ""}
        <div id="foi"></div>
        <div id="validare"></div>
        <div id="oferta"></div>
        <div id="grila"></div>`;

      const statsEl = $("#stats");
      const blocajeEl = $("#blocaje");
      const gazda = $("#grila");
      const bara = $("#validare");
      const panouOferta = $("#oferta");
      const file = $("#foi");
      let activa = 0;

      /**
       * Scrie sesiunea in istoric.
       *
       * Amanata cu 400 ms: la editarea unei celule evenimentul `input` vine
       * la fiecare tasta, iar o scriere in IndexedDB per tasta ar incetini
       * tocmai lucrul pe care il salveaza. Recalculul de pret (`reevalueaza`)
       * NU e amanat — costa milisecunde, nu merita sa astepte 400 ms ca omul
       * sa vada efectul corectiei.
       */
      let ceas: ReturnType<typeof setTimeout> | undefined;
      const salveazaSesiune = (): void => {
        clearTimeout(ceas);
        ceas = setTimeout(() => {
          void salveaza({
            ...ctx.meta,
            pozitii: rez.statistici.liniiIzolatie,
            tarifate: rez.statistici.tarifate,
            valoare: rez.statistici.valoareTotala,
            extrase: [...rez.rezolvate].map(([index, r]) => ({ index, extras: r.extras, sursa: r.sursa })),
            editari: ctx.editari,
          }).then(deseneazaIstoric);
        }, 400);
      };

      /**
       * Filele foilor din registru.
       *
       * Se refac dupa fiecare confirmare, fiindca poarta contorul de pozitii
       * marcate al fiecarei foi — omul trebuie sa vada pe CARE foaie mai e
       * treaba fara sa le deschida pe rand (`Radoia.xlsx` are 7).
       */
      function randFile(): string {
        if (foi.length === 1) {
          const f = foi[0];
          return `<p class="hint">Foaia „${esc(f?.nume ?? "")}”${f && !foaieMapata(f) ? ` ${stare("fără mapare", "neutru")}` : ""}</p>`;
        }
        return `<div class="filtre" role="group" aria-label="Foile din registru">${foi.map((f, i) =>
          `<button class="filtru" data-foaie="${i}" aria-pressed="${i === activa}">${esc(f.nume)}
            <span class="hint">${f.randuri.length}</span>${foaieMapata(f) ? "" : ` ${stare("fără mapare", "neutru")}`}
            ${deValidatPe(f) ? stare(`${deValidatPe(f)} de validat`, "atentie") : ""}</button>`).join("")}</div>`;
      }

      /**
       * Bara de validare: lentilele, navigarea si actiunea in masa.
       *
       * Se reface la fiecare `sincronizeaza`, fiindca numerele din ea vin din
       * starea recalculata. De-aia butoanele NU-si primesc handler direct: bara
       * asculta delegat, o singura data (vezi mai jos), altfel fiecare
       * reconstructie ar trebui sa relege totul si un `addEventListener` uitat
       * s-ar dubla tacut.
       */
      function randValidare(): string {
        const f = foi[activa];
        if (!f) return "";
        const vizibile = subFiltru(f);
        const marcate = deValidatPe(f);
        const netarifate = liniiFoaie(f).filter((l) => potrivit(l, "netarifate")).length;

        const lentila = (v: Filtru, eticheta: string): string =>
          `<button class="filtru" data-lentila="${v}" aria-pressed="${filtru === v}">${eticheta}</button>`;

        // Sub o lentila de cauza, cele trei butoane obisnuite raman nepresate
        // si apare al patrulea, care spune pe ce cauza suntem si cum se iese.
        // Fara el, omul care a dat click pe „arată" dintr-un blocaj n-ar avea
        // in bara niciun semn ca grila e filtrata pe altceva decat cele trei.
        const lentilaCod = typeof filtru === "object"
          ? `<button class="filtru" data-lentila="toate" aria-pressed="true">${
              esc(ETICHETE_BLOCAJ[filtru.cod].eticheta)} (${vizibile.length}) ✕</button>`
          : "";

        return `
          <div class="filtre" role="group" aria-label="Ce se vede din foaie">
            ${lentila("toate", "Toate")}
            ${lentila("de_validat", `De validat (${marcate})`)}
            ${lentila("netarifate", `Netarifate (${netarifate})`)}
            ${lentilaCod}
            <button class="secundar" data-actiune="urmatoarea"${marcate ? "" : " disabled"}>Următoarea de validat</button>
            <button class="secundar" data-actiune="confirma"${vizibile.length ? "" : " hidden"}>${esc(etichetaConfirmare(filtru, vizibile.length))}</button>
            ${(() => {
              const n = liniiFoaie(f).filter((l) => propunereGrosime(l) !== null).length;
              return n === 0 ? "" : `<button class="secundar" data-actiune="grosimi"
                title="Grosimea pe care o alege tehnicul după diametru: 40 mm până la ø60, 50 până la ø169, 60 peste. Dedusă din oferta 284, neconfirmată de firmă.">Completează ${n} grosimi lipsă</button>`;
            })()}
            <button class="secundar" data-actiune="oferta">Generează oferta</button>
            ${ultimaConfirmare
              ? `<button class="secundar" data-actiune="anuleaza">Anulează confirmarea celor ${ultimaConfirmare.intrari.length}</button>`
              : ""}
          </div>
          <p class="hint" role="status">${filtru === "toate" ? "" : "Rândurile păstrează numerele din Excel."}</p>`;
      }

      /**
       * Formularul de antet al ofertei.
       *
       * Se deschide din bara de validare si sta inchis pana atunci: sase campuri
       * permanent pe ecran ar concura cu grila, care e lucrul principal.
       *
       * Fiecare camp are o propunere, iar propunerile sunt EDITABILE, nu
       * deduceri: numele clientului iese din numele fisierului, data e azi,
       * seria vine din firma aleasa (`serieOferta` din `FIRME` — camp care
       * exista de la primul seed si nu era folosit nicaieri). Obiectivul si
       * persoana de contact nu se pot propune din nimic ce avem, deci raman
       * goale; nu inventam un beneficiar.
       */
      function randFormularOferta(): string {
        const { oferta, deValidat, netarifate } = imparte(rez.linii);
        const total = totalOferta(oferta);

        const camp = (nume: string, eticheta: string, valoare: string, tip = "text"): string =>
          `<label>${esc(eticheta)}
            <input type="${tip}" name="${nume}" value="${esc(valoare)}" ${
              nume === "obiectiv" || nume === "persoana" ? "" : "required"} /></label>`;

        return card("Generează oferta", `
          ${nota(
            `<strong>${oferta.length} ${oferta.length === 1 ? "poziție" : "poziții"}</strong>, ` +
            `<strong>${eur(total)}</strong>` +
            (deValidat.length + netarifate.length > 0
              ? ` · în afara ofertei: ${deValidat.length} de validat, ${netarifate.length} netarifate`
              : ""))}
          <form id="antet-oferta">
            <label>Firma emitentă
              <select name="firma">${FIRME.map((f) =>
                `<option value="${f.id}">${esc(f.denumire)} (${esc(f.serieOferta)})</option>`).join("")}</select></label>
            ${camp("numar", "Număr ofertă", "")}
            ${camp("data", "Data", dataAzi())}
            ${camp("client", "Beneficiar", clientPropus(ctx.meta.nume))}
            ${camp("obiectiv", "Obiectiv", "")}
            ${camp("persoana", "În atenția d-lui/d-nei", "")}
            ${camp("localitate", "Localitatea de pe ofertă", "PALTINIS")}
            ${camp("discount", "Discount %  (0 = fără)", "0", "number")}
            <button class="secundar" type="submit">Descarcă registrul .xlsx</button>
            <button class="secundar" type="button" data-actiune="inchide-oferta">Renunță</button>
          </form>`);
      }

      const deseneaza = (i: number): void => {
        activa = i;
        pozitiaSarita = -1;
        file.innerHTML = randFile();
        gazda.innerHTML = tabelFoaie(foi[i]!);
        bara.innerHTML = randValidare();
      };
      deseneaza(0);

      // Blocul de cauze isi are propriul ascultator delegat: el sta in afara
      // barei de validare (`#validare`) si se reface separat, la `sincronizeaza`.
      blocajeEl.addEventListener("click", (e) => {
        const b = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-lentila]");
        if (!b) return;
        filtru = { cod: b.dataset["lentila"]!.slice(4) as CodBlocaj };
        deseneaza(activa);
        bara.scrollIntoView({ block: "nearest" });
      });

      // Delegat, nu cate un `onclick` per buton: filele se refac la fiecare
      // confirmare (contorul lor se schimba), iar handlerele legate direct ar
      // disparea cu ele.
      file.addEventListener("click", (e) => {
        const b = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-foaie]");
        if (b) deseneaza(Number(b.dataset["foaie"]));
      });

      /**
       * Reface `izo`/`mapa` dupa un `reevalueaza`, si actualizeaza pe ecran
       * indicatoarele plus coloanele extrase ale foii active — FARA sa
       * reconstruiasca tabelul, ca omul sa nu-si piarda locul din editare
       * (celula contenteditable in care tasteaza nu se atinge).
       *
       * Randurile care devin/inceteaza sa fie pozitii de izolatie in urma unei
       * corectii (rar: descrierea a fost golita sau completata din nimic) nu-si
       * schimba coloanele extrase pana la urmatorul redesenat de foaie — grila
       * completa se reface la schimbarea de fila sau la un import nou.
       */
      function sincronizeaza(): void {
        izo = rez.linii.filter((l) => l.extras.sistem !== null);
        mapa = new Map(izo.map((l) => [l.extras.index, l]));
        statsEl.innerHTML = randStats();
        blocajeEl.innerHTML = randBlocaje();
        file.innerHTML = randFile();
        bara.innerHTML = randValidare();

        for (const tr of gazda.querySelectorAll<HTMLTableRowElement>("tr[data-idx]")) {
          const idx = Number(tr.dataset["idx"]);
          const l = mapa.get(idx);
          if (!l) continue;
          const selSistem = tr.querySelector<HTMLSelectElement>('[data-camp="sistem"]');
          const inpDiametru = tr.querySelector<HTMLInputElement>('[data-camp="diametru"]');
          const inpGrosime = tr.querySelector<HTMLInputElement>('[data-camp="grosime"]');
          const marca = tr.querySelector<HTMLElement>("[data-marca]");
          if (selSistem) selSistem.value = l.extras.sistem ?? "";
          if (inpDiametru) inpDiametru.value = l.extras.diametru_valoare === null ? "" : String(l.extras.diametru_valoare);
          if (inpGrosime) inpGrosime.value = l.extras.grosime_mm === null ? "" : String(l.extras.grosime_mm);
          if (marca) {
            marca.setAttribute("title", titluMarcaj(l));
            marca.innerHTML = marcajValidare(l);
          }
          // Si coloanele de pret: o corectie in descriere sau in o schimba
          // pretul, iar un pret vechi langa o dimensiune noua arata ca un
          // calcul, nu ca o ramasita — deci e mai rau decat o celula goala.
          const vechiPret = [...tr.querySelectorAll<HTMLElement>("[data-pret]")];
          if (vechiPret.length > 0) {
            const proaspete = document.createElement("tr");
            proaspete.innerHTML = celulePret(l);
            vechiPret.forEach((td, k) => {
              const nou = proaspete.children[k];
              if (nou) td.replaceWith(nou);
            });
          }
        }
      }

      // Schimbarea segmentului retarifeaza tot raportul si redeseneaza grila:
      // preturile din coloanele noi si toate contoarele se schimba deodata.
      retarifeaza = () => {
        reevalueaza(rez, optiuniNucleu());
        sincronizeaza();
        deseneaza(activa);
        salveazaSesiune();
      };

      /**
       * Navigarea prin randurile marcate ale foii active, ciclic.
       *
       * Pe `Radoia.xlsx` sunt 105 pozitii pe 7 foi: gasirea marcajelor prin
       * derulare manuala e exact munca pe care ecranul trebuie s-o scuteasca.
       * Focusul se pune pe primul control din coloanele extrase, ca poztia sa
       * poata fi corectata direct de la tastatura, fara mouse.
       */
      function saiLaUrmatoarea(): void {
        const marcate = [...gazda.querySelectorAll<HTMLTableRowElement>("tr[data-idx]")]
          .filter((tr) => mapa.get(Number(tr.dataset["idx"]))?.necesitaValidare);
        const mesaj = bara.querySelector<HTMLElement>('[role="status"]');
        if (marcate.length === 0) {
          if (mesaj) mesaj.textContent = "Nicio poziție de validat pe foaia asta.";
          return;
        }
        pozitiaSarita = (pozitiaSarita + 1) % marcate.length;
        const tr = marcate[pozitiaSarita]!;
        tr.scrollIntoView({ block: "center" });
        tr.querySelector<HTMLSelectElement>('[data-camp="sistem"]')?.focus();
        if (mesaj) mesaj.textContent = `Poziția ${pozitiaSarita + 1} din ${marcate.length} marcate pe foaia asta.`;
      }

      // Lentilele si actiunile in masa. Delegat pe bara, fiindca ea se reface
      // dupa fiecare schimbare de stare.
      bara.addEventListener("click", (e) => {
        const tinta = e.target as HTMLElement;
        const lentila = tinta.closest<HTMLButtonElement>("[data-lentila]");
        if (lentila) {
          const v = lentila.dataset["lentila"]!;
          // Lentilele pe cauza sunt scrise „cod:<cod>" in `data-lentila`, ca
          // sa incapa in acelasi handler delegat ca celelalte trei. Prefixul
          // separa cele doua feluri fara sa mai fie nevoie de un al doilea
          // atribut care s-ar putea desincroniza de primul.
          filtru = v.startsWith("cod:")
            ? { cod: v.slice(4) as CodBlocaj }
            : (v as Filtru);
          deseneaza(activa);
          return;
        }

        const actiune = tinta.closest<HTMLButtonElement>("[data-actiune]")?.dataset["actiune"];
        if (actiune === "urmatoarea") { saiLaUrmatoarea(); return; }

        if (actiune === "oferta") {
          // Se redeseneaza la fiecare deschidere, nu o data: sumarul din capul
          // formularului („pleaca N pozitii, X €") trebuie sa fie cel de ACUM,
          // dupa toate corectiile si confirmarile facute intre timp. Un sumar
          // vechi ar fi mai rau decat niciunul.
          panouOferta.innerHTML = randFormularOferta();
          panouOferta.querySelector<HTMLInputElement>('[name="numar"]')?.focus();
          panouOferta.scrollIntoView({ block: "nearest" });
          return;
        }

        if (actiune === "grosimi") {
          // Propunerea devine valoare DOAR aici, la un clic explicit — de-aia
          // linia primeste `sursa: "om"`: decizia e a lui, noi doar i-am pus
          // cifra in fata. Se aplica pe foaia activa, ca tot ce e in bara.
          const f = foi[activa];
          if (!f) return;
          let aplicate = 0;
          for (const l of liniiFoaie(f)) {
            const g = propunereGrosime(l);
            if (g === null) continue;
            rez.rezolvate.set(l.extras.index, {
              extras: { ...l.extras, grosime_mm: g },
              sursa: "om",
            });
            aplicate++;
          }
          if (aplicate === 0) return;
          reevalueaza(rez, optiuniNucleu());
          sincronizeaza();
          deseneaza(activa);
          salveazaSesiune();
          return;
        }

        if (actiune === "confirma") {
          // Confirma EXACT ce e vizibil sub filtrul curent, pe foaia activa —
          // ce scrie pe buton. Un "confirma tot" ar bifa si pozitii pe care
          // omul nu le-a avut niciodata pe ecran.
          const f = foi[activa];
          if (!f) return;
          ultimaConfirmare = confirma(subFiltru(f).map((l) => l.extras.index), rez.rezolvate);
          reevalueaza(rez, optiuniNucleu());
          sincronizeaza();
          // Redesenare completa: sub filtrul "de validat" liniile tocmai
          // confirmate nu mai au ce cauta in grila.
          deseneaza(activa);
          salveazaSesiune();
          return;
        }

        if (actiune === "anuleaza" && ultimaConfirmare) {
          anuleaza(ultimaConfirmare, rez.rezolvate);
          ultimaConfirmare = null;
          reevalueaza(rez, optiuniNucleu());
          sincronizeaza();
          deseneaza(activa);
          salveazaSesiune();
        }
      });

      /**
       * Generarea propriu-zisa.
       *
       * Delegata pe container, ca peste tot in ecranul asta: formularul se
       * reface la fiecare deschidere, deci un handler legat direct de `<form>`
       * ar disparea cu el, iar unul relegat de fiecare data s-ar dubla tacut.
       *
       * `registruOferta` e pur si nu stie de DOM; `descarca` e singurul loc din
       * aplicatie cu `Blob` si `<a download>`. Aici ramane doar culegerea
       * campurilor si legatura dintre ele.
       */
      panouOferta.addEventListener("click", (e) => {
        const b = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-actiune]");
        if (b?.dataset["actiune"] === "inchide-oferta") panouOferta.innerHTML = "";
      });

      panouOferta.addEventListener("submit", (e) => {
        e.preventDefault();
        const form = e.target as HTMLFormElement;
        const val = (nume: string): string =>
          (new FormData(form).get(nume) as string | null ?? "").trim();

        const firma = FIRME.find((f) => f.id === val("firma")) ?? FIRME[0]!;
        const antet: AntetOferta = {
          serie: firma.serieOferta,
          numar: val("numar"),
          data: val("data"),
          persoana: val("persoana"),
          client: val("client"),
          obiectiv: val("obiectiv"),
          firma: firma.denumire,
          localitate: val("localitate"),
        };
        // Discountul e optional: 0 sau gol inseamna registru cu un singur rand
        // de total, ca inainte. Conditia e cea din ofertele reale ale firmei.
        const procent = Number(val("discount"));
        if (Number.isFinite(procent) && procent > 0) {
          antet.discountProcent = procent;
          antet.discountConditie =
            "PENTRU PLATA FACTURII FISCALE IN TERMEN DE 5-7 ZILE CALENDARISTICE DE LA DATA EMITERII";
        }

        const buton = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
        const etichetaVeche = buton.textContent;
        buton.disabled = true;
        buton.textContent = "Se generează…";

        void registruOferta({
          linii: rez.linii,
          antet,
          provenienta: {
            generatLa: new Date().toISOString(),
            // Motorul ruleaza pe listele rezidentiale — `src/pricing/lists.ts`
            // le importa static. Cand va sti sa aleaga destinatia (intrebarea
            // 12), valoarea vine de acolo, nu de aici.
            destinatie: "rezidential",
            model: ctx.meta.model,
            sesiune: ctx.meta.id,
            fisierSursa: ctx.meta.nume,
          },
        }).then((buf) => {
          descarca(buf, numeOferta(antet.serie, antet.numar, antet.data));
          panouOferta.innerHTML = "";
        }).catch((err: unknown) => {
          // Nu se inchide panoul pe eroare: omul tocmai a completat sase
          // campuri, iar un panou disparut fara fisier nu spune nimic.
          buton.disabled = false;
          buton.textContent = etichetaVeche;
          panouOferta.insertAdjacentHTML("beforeend",
            `<p class="alerta">Registrul nu s-a putut genera: ${esc(String(err))}</p>`);
        });
      });

      // Celulele fisierului: corectia trece prin `scrieCelula`+`reconstruieste`
      // (editare.ts), apoi `reevalueaza` reface extragerea si pretul — azi
      // corectia se vedea pe ecran dar nu schimba pretul, fiindca grila si
      // extragerea erau tinute in doua forme separate care nu comunicau.
      gazda.addEventListener("input", (e) => {
        const camp = e.target as HTMLElement;
        if (!camp.matches("[data-cel]")) return;
        const rand = foi[activa]?.randuri.find((r) => r.rand === Number(camp.dataset.rand));
        if (!rand) return;
        const cel = Number(camp.dataset.cel);
        const celulaVeche = rand.celule[cel];
        const nouText = camp.textContent ?? "";
        // Un numar corectat ramane numar — altfel prima editare a unei
        // cantitati ar transforma-o in text.
        const nou = celulaVeche && typeof celulaVeche.v === "number"
            && nouText.trim() !== "" && !Number.isNaN(Number(nouText))
          ? Number(nouText) : nouText;

        scrieCelula(rand, cel, nou);
        reconstruieste(rand);
        reevalueaza(rez, optiuniNucleu());

        // Se retine si separat de grila: grila se reface din bytes-ii
        // fisierului la reincarcare, deci corectia s-ar pierde cu ea.
        const cheie = { foaie: foi[activa]!.nume, rand: Number(camp.dataset.rand), cel };
        const i = ctx.editari.findIndex((x) => x.foaie === cheie.foaie && x.rand === cheie.rand && x.cel === cheie.cel);
        const editare = { ...cheie, v: nou };
        if (i >= 0) ctx.editari[i] = editare;
        else ctx.editari.push(editare);

        sincronizeaza();
        salveazaSesiune();
      });

      // Coloanele extrase (sistem/ø/grosime): corectia pune `sursa: "om"` pe
      // linie — nucleul n-o mai re-extrage niciodata, indiferent ce ar gasi
      // determinismul sau memoria pe randul asta mai departe — apoi
      // `reevalueaza` reface pretul si `invataDinCorectie` invata sablonul,
      // ca la urmatorul import linia geamana sa nu mai fie intrebata.
      gazda.addEventListener("change", (e) => {
        const camp = e.target as HTMLInputElement | HTMLSelectElement;
        const nume = camp.dataset.camp;
        if (!nume) return;
        const tr = camp.closest("tr");
        const idx = Number(tr?.dataset["idx"]);
        const l = mapa.get(idx);
        if (!l) return;

        const extras: LinieExtrasa = { ...l.extras };
        if (nume === "sistem") extras.sistem = camp.value as LinieExtrasa["sistem"];
        else if (nume === "diametru") extras.diametru_valoare = camp.value === "" ? null : Number(camp.value);
        else if (nume === "grosime") extras.grosime_mm = camp.value === "" ? null : Number(camp.value);

        rez.rezolvate.set(idx, { extras, sursa: "om" });
        reevalueaza(rez, optiuniNucleu());

        // L4: corectia omului intra in memorie, ca linia asta sa nu mai fie
        // intrebata niciodata. Se invata DOAR de la om — daca ar intra si ce
        // zice modelul, o extragere gresita s-ar propaga tacut peste toate
        // proiectele urmatoare. Conditiile sunt in `invataDinCorectie`, ca sa
        // fie testate; aici ramane apelul.
        const linieNoua = rez.linii.find((x) => x.extras.index === idx);
        if (linieNoua) invataDinCorectie({ text: linieNoua.bruta.text, extras: linieNoua.extras }, stoc);

        sincronizeaza();
        salveazaSesiune();
      });

      // Prima salvare, imediat: daca omul inchide tabul fara sa corecteze
      // nimic, importul trebuie sa fie acolo cand se intoarce.
      salveazaSesiune();
    }
  },
};
