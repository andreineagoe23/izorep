import { tarifeaza } from "../../src/pricing/engine.js";
import { tarifeazaGolFoc } from "../../src/pricing/goluri-foc.js";
import { extrageDeterminist } from "../../src/import/extract-regex.js";
import { SISTEME, type LinieExtrasa } from "../../src/import/schema.js";
// Doar tipurile: `import type` se sterge la compilare, deci ExcelJS (~940 kB)
// ramane incarcat lenes, prin `import()`-ul din `proceseaza`.
import type { CelulaBruta, FoaieBruta, RandBrut } from "../../src/import/parse-workbook.js";
import { esc, indicator, nota, progres, stare, type Ecran } from "./tip.js";

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
const LOT_IMPLICIT = 25;
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
        const { parseFoiBuffer, liniile } = await import("../../src/import/parse-workbook.js");
        const { adaugaSectiuni } = await import("../../src/import/sectiuni.js");
        // Registrul se citește ca grilă — foaie cu foaie, cu rândurile intacte.
        // Liniile de poziție sunt ACELEAȘI obiecte care stau și în grilă, deci
        // ce corectează omul într-un rând se vede în linia care merge la
        // extragere, fără nicio potrivire după text.
        const foi = await parseFoiBuffer(await fisier.arrayBuffer());
        const brute = adaugaSectiuni(liniile(foi));

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
        const prag = info?.prag ?? 0.85;
        // Harta pe indexul din fisierul sursa: o editare cauta linia aici, nu
        // tine minte un index de rand care s-ar deplasa la orice sortare.
        const mapa = new Map(izo.map((l) => [l.extras.index, l]));

        /** Reface pretul intern dupa ce omul de la tehnic corecteaza o celula. */
        function recalculeaza(l: LinieRaport): void {
          Object.assign(l, tarifeazaLinie(l.extras, l.cantitate ?? 1));
        }

        /** Randul de indicatoare — se reface dupa o editare, fara sa reconstruiasca tot tabelul. */
        function randStats(): string {
          const tarifate = izo.filter((l) => l.pret !== null);
          const prinModel = izo.filter((l) => l.sursa === "model");
          // Aceeasi definitie ca in `pipeline.ts`: sub prag SAU pozitie care nu
          // s-a putut tarifa. Ambele cazuri se opresc la validarea omului.
          const deValidat = izo.filter((l) => l.extras.incredere < prag || l.eroare !== null);
          const proc = izo.length ? `${((tarifate.length / izo.length) * 100).toFixed(0)}%` : "–";
          return `
            ${foi.length > 1 ? indicator(String(foi.length), "foi în registru") : ""}
            ${indicator(String(brute.length), "rânduri cu text")}
            ${indicator(String(izo.length), "poziții de izolație")}
            ${indicator(String(tarifate.length), "tarifate", proc)}
            ${info ? indicator(String(prinModel.length), "rezolvate cu modelul") : ""}
            ${indicator(String(deValidat.length), "de validat de om", `încredere sub ${prag} sau fără preț`)}`;
        }

        /**
         * Valoarea unei celule, ca text.
         *
         * Doua abateri de la valoarea bruta, amandoua ca sa arate ce vede omul
         * cand deschide fisierul, nu ce tine ExcelJS in memorie:
         *
         * - numerele se rotunjesc la 12 cifre semnificative, pentru ca 8084,33
         *   e tinut ca 8084.330000000001, iar cifra aia nu exista in fisier;
         * - datele calendaristice se scriu ca in Excel. L0 le normalizeaza la
         *   ISO ("2026-09-04T00:00:00.000Z"), forma buna pentru extragere si
         *   proasta pentru citit.
         *
         * Nu e formatare in sens larg — despartitor de mii sau simbol de
         * moneda ar fi, si alea ar schimba ce scrie in celula.
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

          const corp = f.randuri
            .filter((r) => r !== f.antet)
            .map((r) => randGrila(f, r))
            .join("");

          return `<div class="tabelwrap" tabindex="0"><table>
            <thead><tr>
              <th scope="col" class="gutter">${f.antet ? `r${f.antet.rand}` : "#"}</th>
              ${capete}
              ${["Sistem", "ø", "gros.", ""].map((c, i) =>
                `<th scope="col" class="extras${i > 0 && i < 3 ? " n" : ""}">${esc(c)}</th>`).join("")}
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

          const deValidat = l ? l.extras.incredere < prag || l.eroare !== null : false;
          const extrase = l
            ? `<td class="extras"><select data-camp="sistem">${SISTEME.map((s) =>
                 `<option value="${s}"${s === l.extras.sistem ? " selected" : ""}>${s.replace("_", " ")}</option>`).join("")}</select></td>
               <td class="extras n"><input type="number" step="any" data-camp="diametru" value="${l.extras.diametru_valoare ?? ""}" /></td>
               <td class="extras n"><input type="number" step="any" data-camp="grosime" value="${l.extras.grosime_mm ?? ""}" /></td>
               <td class="extras fix"><span data-marca>${deValidat ? stare("de validat", "atentie") : ""}</span></td>`
            : `<td class="extras"></td><td class="extras"></td><td class="extras"></td><td class="extras"></td>`;

          return `<tr${l ? ` data-idx="${l.extras.index}"` : ""}>
            <td class="gutter">${r.rand}</td>
            ${celule}${umplutura(f.coloane - latime(r.celule))}
            ${extrase}</tr>`;
        }

        out.innerHTML = `
          ${avertisment}
          <div id="stats" class="stats">${randStats()}</div>
          ${trunchiat > 0 ? nota(`Plafonul per import e de 400 de linii trimise la model; ${trunchiat} au rămas netrimise.`) : ""}
          ${izo.some((l) => l.extras.sistem === "goluri_foc")
            ? nota("Fișierul conține <strong>închideri goluri la foc</strong>, tarifate pe altă regulă: prețul " +
                "vine din <strong>suprafața golului</strong> — nu din diametru și grosime — iar banda WRAP și " +
                "colierul se adună peste el. O linie fără dimensiunea golului (<code>130/130</code>) rămâne " +
                "netarifată și marcată, nu ghicită.")
            : ""}
          ${nota(
            "Tabelul e <strong>fișierul clientului, așa cum e</strong>: câte o filă per foaie din registru, " +
            "capetele luate din rândul de antet al foii, coloanele în ordinea lor. Ultimele patru coloane sunt " +
            "singurele adăugate de noi — ce a înțeles sistemul din rând. " +
            (info
              ? "Modelul extrage doar parametri și nu vede niciun preț; liniile sub pragul de încredere sunt marcate <strong>de validat</strong>."
              : "Aici rulează doar stratul determinist; restul se rezolvă cu modelul, local, cu <code>npm run dev</code>.") +
            " Orice celulă se corectează pe loc.")}
          ${foi.length > 1
            ? `<div class="filtre" role="group" aria-label="Foile din registru">${foi.map((f, i) =>
                `<button class="filtru" data-foaie="${i}" aria-pressed="${i === 0}">${esc(f.nume)}
                  <span class="hint">${f.randuri.length}</span></button>`).join("")}</div>`
            : `<p class="hint">Foaia „${esc(foi[0]?.nume ?? "")}”</p>`}
          <div id="grila"></div>`;

        const statsEl = $("#stats");
        const gazda = $("#grila");
        let activa = 0;

        const deseneaza = (i: number): void => { activa = i; gazda.innerHTML = tabelFoaie(foi[i]!); };
        deseneaza(0);

        for (const b of root.querySelectorAll<HTMLButtonElement>("button.filtru")) {
          b.onclick = () => {
            for (const alt of root.querySelectorAll<HTMLButtonElement>("button.filtru")) {
              alt.setAttribute("aria-pressed", String(alt === b));
            }
            deseneaza(Number(b.dataset["foaie"]));
          };
        }

        // Celulele fisierului: corectia se scrie in grila, deci ramane si dupa
        // ce omul comuta pe alta foaie si se intoarce. Un numar corectat ramane
        // numar — altfel prima editare a unei cantitati ar transforma-o in text.
        gazda.addEventListener("input", (e) => {
          const camp = e.target as HTMLElement;
          if (!camp.matches("[data-cel]")) return;
          const rand = foi[activa]?.randuri.find((r) => r.rand === Number(camp.dataset.rand));
          const celula = rand?.celule[Number(camp.dataset.cel)];
          if (!celula) return;
          const nou = camp.textContent ?? "";
          celula.v = typeof celula.v === "number" && nou.trim() !== "" && !Number.isNaN(Number(nou))
            ? Number(nou)
            : nou;
        });

        // Coloanele extrase schimba ce se poate tarifa: la fiecare corectie se
        // reface pretul intern si se actualizeaza indicatoarele si eticheta
        // "de validat" a randului — fara sa se redeseneze tabelul, ca omul sa
        // nu-si piarda locul in editare.
        gazda.addEventListener("change", (e) => {
          const camp = e.target as HTMLInputElement | HTMLSelectElement;
          const nume = camp.dataset.camp;
          if (!nume) return;
          const tr = camp.closest("tr");
          const l = mapa.get(Number(tr?.dataset.idx));
          if (!l) return;
          if (nume === "sistem") l.extras.sistem = camp.value as LinieExtrasa["sistem"];
          else if (nume === "diametru") l.extras.diametru_valoare = camp.value === "" ? null : Number(camp.value);
          else if (nume === "grosime") l.extras.grosime_mm = camp.value === "" ? null : Number(camp.value);
          recalculeaza(l);
          const marca = tr?.querySelector("[data-marca]");
          if (marca) marca.innerHTML = l.extras.incredere < prag || l.eroare !== null ? stare("de validat", "atentie") : "";
          statsEl.innerHTML = randStats();
        });
      } catch (e) {
        out.innerHTML = `<div class="alerta"><strong>Nu am putut citi fișierul</strong>
          ${esc(e instanceof Error ? e.message : String(e))}<br>
          Formatul .xls vechi nu e suportat în browser — salvează-l ca .xlsx.</div>`;
      }
    }
  },
};
