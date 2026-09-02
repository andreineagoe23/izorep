import { tarifeaza } from "../../src/pricing/engine.js";
import { tarifeazaGolFoc } from "../../src/pricing/goluri-foc.js";
import { extrageDeterminist } from "../../src/import/extract-regex.js";
import type { LinieExtrasa } from "../../src/import/schema.js";
import { esc, eur, indicator, nota, progres, stare, tabel, type Ecran } from "./tip.js";

/**
 * Ruta stratului cu model exista doar pe serverul de dezvoltare
 * (`scripts/vite-plugin-model.ts`). In build lipseste, iar ecranul cade curat
 * pe stratul determinist — asta e si motivul pentru care cheia API nu poate
 * ajunge in pagina: nu trece niciodata prin ea.
 */
const RUTA_MODEL = location.pathname.replace(/[^/]*$/, "") + "api/extrage";

interface StareModel { disponibil: boolean; model: string; prag: number; lot?: number; concurenta?: number }

/**
 * Loturi mici, trimise in paralel din pagina.
 *
 * Un lot de 25 de linii ia ~19s la gpt-4o, deci 84 de linii secvential inseamna
 * ~80s de ecran gol. Impartite in loturi de 12 si trimise cate 4 deodata, ies in
 * ~20s — si, mai important, fiecare lot care se intoarce misca bara de progres.
 */
/**
 * Valori implicite. Serverul de dezvoltare le poate suprascrie prin
 * IZOREP_LOT / IZOREP_CONCURENTA, iar ecranul le ia din raspunsul rutei —
 * prima manevra cand contul OpenAI da 429 e concurenta 1.
 */
const LOT_IMPLICIT = 12;
const CONCURENTA_IMPLICITA = 4;
/** Plafon per import, acelasi cu cel din plugin. */
const MAX_LINII = 400;

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

type Sursa = "regex" | "model";

interface LinieRaport {
  text: string;
  cantitate: number | null;
  extras: LinieExtrasa;
  sursa: Sursa;
  pret: number | null;
  total: number | null;
  eroare: string | null;
}

/** Tarifare determinista, inclusiv pozitiile compuse extrase de model. */
function tarifeazaLinie(extras: LinieExtrasa, cantitate: number): Pick<LinieRaport, "pret" | "total" | "eroare"> {
  // Inchiderile goluri la foc au pret aditiv, calculat pe suprafata golului:
  // diametrul si grosimea nu spun nimic acolo.
  if (extras.sistem === "goluri_foc") {
    if (extras.gol_latime_mm === null || extras.gol_inaltime_mm === null) {
      return {
        pret: null, total: null,
        eroare: "închidere de gol la foc fără dimensiunea golului; prețul vine din suprafața lui",
      };
    }
    try {
      const r = tarifeazaGolFoc({
        gol: { latime_mm: extras.gol_latime_mm, inaltime_mm: extras.gol_inaltime_mm },
        cantitate,
      });
      return { pret: r.pret_unitar, total: r.total, eroare: null };
    } catch (e) {
      return { pret: null, total: null, eroare: e instanceof Error ? e.message : String(e) };
    }
  }
  if (!extras.sistem || extras.diametru_valoare === null || !extras.diametru_tip) {
    return { pret: null, total: null, eroare: null };
  }
  try {
    const r = tarifeaza({
      diametru: { valoare: extras.diametru_valoare, tip: extras.diametru_tip },
      straturi: [
        { sistem: extras.sistem, ...(extras.grosime_mm !== null ? { grosime_mm: extras.grosime_mm } : {}) },
        ...extras.straturi_extra.map((s) => ({
          sistem: s.sistem, ...(s.grosime_mm !== null ? { grosime_mm: s.grosime_mm } : {}),
        })),
      ],
      forma: extras.forma ?? "ml",
      cantitate,
    });
    return { pret: r.pret_unitar, total: r.total, eroare: null };
  } catch (e) {
    return { pret: null, total: null, eroare: e instanceof Error ? e.message : String(e) };
  }
}

export const ecran: Ecran = {
  id: "import",
  titlu: "Import Excel",
  subtitlu: "Trage o listă de cantități aici. Fișierul nu pleacă de pe calculatorul tău.",

  async render(root) {
    const info = await interogheazaModel();

    const explicatie = info
      ? `<p class="hint">Rulează pipeline-ul complet: parsare, extragere prin reguli, completare cu
         modelul <code>${esc(info.model)}</code> pe liniile rămase, apoi tarifare deterministă.
         Cheia API stă în serverul de dezvoltare — nu ajunge în pagină, iar liniile trimise nu conțin prețuri.</p>`
      : `<p class="hint">Rulează stratul determinist: parsare, extragere prin reguli, tarifare.
         Stratul cu model pornește singur când lucrezi local, cu <code>npm run dev</code> și cheia în
         <code>.env</code>. Aici lipsește, pentru că o cheie API într-o pagină statică ar fi publică.</p>`;

    root.innerHTML = `
      <p>${info
        ? stare(`Stratul cu model: activ local`, "ok")
        : stare("Stratul cu model: indisponibil aici", "neutru")}</p>
      <label id="drop" class="drop" for="fisier">
        <strong>Trage un fișier .xlsx aici</strong>
        <span>sau click pentru a alege</span>
        <input id="fisier" type="file" accept=".xlsx" />
        ${explicatie}
      </label>
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

    async function proceseaza(fisier: File): Promise<void> {
      const out = $("#raport");
      out.innerHTML = `<p class="nota">Se citește ${esc(fisier.name)}…</p>`;
      try {
        // ExcelJS e ~940 kB: se încarcă la prima folosire, nu la deschiderea paginii.
        const { parseWorkbookBuffer } = await import("../../src/import/parse-workbook.js");
        const { adaugaSectiuni } = await import("../../src/import/sectiuni.js");
        const brute = adaugaSectiuni(await parseWorkbookBuffer(await fisier.arrayBuffer()));

        // L2a — determinist. Ce iese complet de aici nu ajunge niciodată la model.
        const rezolvate = new Map<number, { extras: LinieExtrasa; sursa: Sursa }>();
        const reziduale: { index: number; text: string; um?: string }[] = [];
        for (const b of brute) {
          const r = extrageDeterminist(b.index, b.text, b.um, b.sectiune);
          if (r.complet) rezolvate.set(b.index, { extras: r.linie, sursa: "regex" });
          else reziduale.push({ index: b.index, text: b.text, ...(b.um ? { um: b.um } : {}) });
        }

        // L2b — model, doar pe reziduu, in loturi paralele cu progres vizibil.
        let avertisment = "";
        const trunchiat = info ? Math.max(0, reziduale.length - MAX_LINII) : 0;
        if (info && reziduale.length > 0) {
          const deTrimis = reziduale.slice(0, MAX_LINII);
          const loturi: (typeof deTrimis)[] = [];
          const lot = info.lot ?? LOT_IMPLICIT;
          const concurenta = info.concurenta ?? CONCURENTA_IMPLICITA;
          for (let i = 0; i < deTrimis.length; i += lot) loturi.push(deTrimis.slice(i, i + lot));

          // Numarul de linii rezolvate determinist se fixeaza acum: `rezolvate`
          // creste pe masura ce se intorc loturile, iar eticheta ar minti.
          const determinist = rezolvate.size;
          let gata = 0;
          let esuate = 0;
          let ultimaEroare = "";
          const arataProgres = (): void => {
            const p = Math.round((gata / loturi.length) * 100);
            out.innerHTML = `<p class="nota">Extragere deterministă gata (${determinist} linii).
              Modelul lucrează pe ${deTrimis.length} linii rămase — lotul ${Math.min(gata + 1, loturi.length)}
              din ${loturi.length}.</p>${progres(p)}`;
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
                for (const e of corp.linii ?? []) rezolvate.set(e.index, { extras: e, sursa: "model" });
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
          await Promise.all(Array.from({ length: Math.min(concurenta, loturi.length) }, lucrator));

          if (esuate > 0) {
            avertisment = `<div class="alerta"><strong>${esuate} din ${loturi.length} loturi au eșuat</strong>
              ${esc(ultimaEroare)}<br>
              Raportul de mai jos conține restul liniilor. Reîncarcă fișierul ca să reîncerci.</div>`;
          }
        }

        // L3 — tarifare determinista, aceeasi si pentru liniile venite de la model.
        const linii: LinieRaport[] = [];
        for (const b of brute) {
          const r = rezolvate.get(b.index);
          if (!r) continue;
          linii.push({
            text: b.text, cantitate: b.cantitate ?? null, extras: r.extras, sursa: r.sursa,
            ...tarifeazaLinie(r.extras, b.cantitate ?? 1),
          });
        }

        const izo = linii.filter((l) => l.extras.sistem !== null);
        const tarifate = izo.filter((l) => l.pret !== null);
        const prinModel = izo.filter((l) => l.sursa === "model");
        const prag = info?.prag ?? 0.85;
        // Aceeasi definitie ca in `pipeline.ts`: sub prag SAU pozitie care nu s-a
        // putut tarifa. Ambele cazuri se opresc la acelasi ecran de validare.
        const deValidat = izo.filter((l) => l.extras.incredere < prag || l.eroare !== null);
        const valoare = tarifate.reduce((s, l) => s + (l.total ?? 0), 0);
        const proc = izo.length ? `${((tarifate.length / izo.length) * 100).toFixed(0)}%` : "–";

        out.innerHTML = `
          ${avertisment}
          <div class="stats">
            ${indicator(String(brute.length), "rânduri cu text")}
            ${indicator(String(izo.length), "poziții de izolație")}
            ${indicator(String(tarifate.length), "tarifate", proc)}
            ${info ? indicator(String(prinModel.length), "rezolvate cu modelul") : ""}
            ${indicator(String(deValidat.length), "de validat de om", `încredere sub ${prag} sau fără preț`)}
            ${indicator(eur(valoare), "valoare tarifată")}
          </div>
          ${trunchiat > 0 ? nota(`Plafonul per import e de 400 de linii trimise la model; ${trunchiat} au rămas netrimise.`) : ""}
          ${izo.some((l) => l.extras.sistem === "goluri_foc")
            ? nota("Fișierul conține <strong>închideri goluri la foc</strong>, tarifate pe altă regulă: prețul " +
                "vine din <strong>suprafața golului</strong> — nu din diametru și grosime — iar banda WRAP și " +
                "colierul se adună peste el. O linie fără dimensiunea golului (<code>130/130</code>) rămâne " +
                "netarifată și marcată, nu ghicită.")
            : ""}
          ${nota(info
            ? "Prețurile se calculează întotdeauna determinist, în browser. Modelul extrage doar parametri — sistem, " +
              "diametru, grosime, formă — și nu vede și nu produce niciun preț. Liniile cu încredere sub prag merg " +
              "obligatoriu prin ecranul de validare, unde corecțiile se memorează pe client."
            : "Doar stratul determinist. Restul se rezolvă cu modelul (local, <code>npm run dev</code>) și prin " +
              "ecranul de validare, unde corecțiile se memorează pe client — al doilea proiect de la același client " +
              "pornește de mult mai sus.")}
          ${tabel(
            ["Descriere", "Sursă", "Sistem", "ø", "gros.", "cant.", "P.U.", "Total"],
            izo.slice(0, 150).map((l) => `<tr>
              <td><span class="desc" title="${esc(l.text)}">${esc(l.text.replace(/\s+/g, " ").slice(0, 70))}</span></td>
              <td class="fix">${l.sursa === "regex" ? "reguli" : "model"}${
                l.extras.incredere < prag || l.eroare !== null ? ` ${stare("de validat", "atentie")}` : ""}</td>
              <td>${esc(l.extras.sistem!.replace("_", " "))}</td>
              <td class="n">${l.extras.diametru_valoare ?? "–"}</td>
              <td class="n">${l.extras.grosime_mm ?? "–"}</td>
              <td class="n">${l.cantitate ?? "–"}</td>
              <td class="n">${l.pret !== null ? eur(l.pret) : `<span class="rosu" title="${esc(l.eroare ?? "extragere incompletă")}">–</span>`}</td>
              <td class="n">${l.total !== null ? eur(l.total) : ""}</td></tr>`),
            ["", "", "", "n", "n", "n", "n", "n"])}
          ${izo.length > 150 ? `<p class="hint">… și încă ${izo.length - 150} poziții.</p>` : ""}`;
      } catch (e) {
        out.innerHTML = `<div class="alerta"><strong>Nu am putut citi fișierul</strong>
          ${esc(e instanceof Error ? e.message : String(e))}<br>
          Formatul .xls vechi nu e suportat în browser — salvează-l ca .xlsx.</div>`;
      }
    }
  },
};
