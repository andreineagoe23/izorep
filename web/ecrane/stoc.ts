/**
 * Depozit și stoc — prototipul.
 *
 * Unde e materialul și cât mai trebuie pentru fiecare lucrare. Stocul e suma
 * mișcărilor (`src/stoc/registru.ts`): nimic nu se scrie peste o cifră, iar o
 * greșeală se anulează cu o mișcare inversă, vizibilă în jurnal.
 *
 * Necesarul vine din import: pasul „Oferta" calculează materialele strat cu
 * strat și le trimite aici. Datele stau pe server (`web/date.ts`) sau, pe
 * linkul demo, în browser (`web/depozit-local.ts`).
 */
import { esc, eur, indicator, stare, tabel, type Ecran } from "./tip.js";
import { SANTIERE } from "../date/seed.js";
import { citestePlanuri, citesteDepozit, idNou, modDate, scrieDepozit } from "../date.js";
import { MATERIALE, MATERIAL } from "../import/text.js";
import { cantitate, cifra, numeArticol, unitate } from "../stoc-vizual.js";
import type { NecesarLucrare, StareDepozit } from "../depozit-local.js";
import {
  CERE, articolDin, deComandat, esteAnulata, faraExemple, miscariDeExemplu, pretMediu,
  solduri, storno, valideazaMiscare, type Ambalaj, type Articol, type Miscare, type TipMiscare,
} from "../../src/stoc/registru.js";
import { materialManual } from "../../src/stoc/necesar.js";

/** Ambalajele uzuale (S13): tuburile în cutii, vata în saci sau pachete, tabla la kg. */
const UNITATI_AMBALAJ = ["cutie", "sac", "pachet", "rolă", "coală", "kg"];

export const CENTRAL = "central";

/** Șantierele: cele făcute din oferte, apoi cele din datele firmei. */
export const santiere = (): { id: string; denumire: string }[] => [
  ...citestePlanuri().map((p) => ({ id: p.id, denumire: p.denumire })),
  ...SANTIERE,
];

export const depozite = (): { id: string; nume: string }[] => [
  { id: CENTRAL, nume: "Depozit central" },
  ...santiere().map((s) => ({ id: s.id, nume: `Șantier ${s.denumire}` })),
];

const TIPURI: [TipMiscare, string][] = [
  ["intrare", "Intrare de la furnizor"],
  ["transfer", "Transfer între depozite"],
  ["consum", "Consum pe lucrare"],
  ["retur", "Retur de pe șantier"],
  ["ajustare", "Ajustare la inventar"],
];
const TIP: Record<TipMiscare, string> = Object.fromEntries(TIPURI) as Record<TipMiscare, string>;

/** Depozitele în care se caută materialul pentru un necesar: centralul și șantierul lui. */
export const depoziteNecesar = (n: NecesarLucrare): string[] => [CENTRAL, ...(n.santier ? [n.santier] : [])];

/** Câte materiale mai sunt de comandat, pe fiecare necesar. Folosit și de tabloul de bord. */
export function deComandatPeNecesar(s: StareDepozit): { necesar: NecesarLucrare; articole: number }[] {
  const sold = solduri(s.miscari);
  return s.necesare.map((n) => ({
    necesar: n,
    articole: deComandat(n.materiale, sold, depoziteNecesar(n), s.ambalaje).filter((d) => d.deComandat > 0).length,
  }));
}

const titluNecesar = (n: NecesarLucrare): string => n.obiectiv || n.fisier;

/** Materialele fără marcă: pe ele se pun ambalajele. */
function materialeDeBaza(s: StareDepozit): Articol[] {
  const toate = new Map<string, Articol>();
  for (const a of articoleCunoscute(s)) { const b = articolDin(a); toate.set(b.cheie, b); }
  return [...toate.values()];
}

/** Toate articolele cunoscute: din necesaruri și din mișcări, fără dubluri. */
function articoleCunoscute(s: StareDepozit): Articol[] {
  const toate = new Map<string, Articol>();
  for (const n of s.necesare) for (const m of n.materiale) { const a = articolDin(m); toate.set(a.cheie, a); }
  for (const m of s.miscari) toate.set(m.articol.cheie, m.articol);
  return [...toate.values()].sort((a, b) => numeArticol(a).localeCompare(numeArticol(b), "ro"));
}

export const ecran: Ecran = {
  id: "stoc",
  titlu: "Depozit și stoc",
  subtitlu: "Unde e materialul și cât mai trebuie cumpărat pentru fiecare lucrare. Fiecare intrare și ieșire rămâne scrisă; nimic nu se șterge.",

  render(root) {
    let st = citesteDepozit();
    let pastrat = true;
    let depozit = "toate";
    let eroare = "";
    let tipAles: TipMiscare = "intrare";
    let DEPOZITE = depozite();
    const numeDepozit = (id?: string): string => DEPOZITE.find((d) => d.id === id)?.nume ?? "—";

    const salveaza = (): void => { pastrat = scrieDepozit(st); };

    function deseneaza(): void {
      DEPOZITE = depozite();
      const sold = solduri(st.miscari);
      const cuExemple = st.miscari.some((m) => m.exemplu);
      const peNecesar = deComandatPeNecesar(st);
      const articoleInStoc = new Set(sold.filter((x) => x.cantitate > 0).map((x) => x.articol.cheie)).size;

      const stats = `<div class="stats">
        ${indicator(cifra(articoleInStoc), "Materiale în stoc")}
        ${indicator(cifra(new Set(sold.map((x) => x.depozit)).size), "Depozite cu material", `din ${DEPOZITE.length}`)}
        ${indicator(cifra(st.miscari.length), "Mișcări înregistrate")}
        ${indicator(cifra(peNecesar.reduce((t, x) => t + x.articole, 0)), "Materiale de comandat",
          `${st.necesare.length} ${st.necesare.length === 1 ? "necesar" : "necesaruri"} din oferte`)}
      </div>`;

      // Pe server, stocul e al tuturor si e real: fara date de exemplu (miscarile nu se mai sterg).
      const banner = modDate() === "server" ? "" : `<section class="imp-card">
        <p class="hint" style="margin:0">Deocamdată datele de aici se păstrează doar pe acest calculator, în acest browser.${
          pastrat ? "" : " <strong>Browserul nu permite salvarea: datele se pierd la reîncărcare.</strong>"}</p>
        ${cuExemple ? `<p style="margin:12px 0 0">${stare("Date de exemplu", "atentie")} Intrările marcate „exemplu”
          nu sunt stocuri reale.</p>
          <div class="imp-formular-butoane"><button type="button" class="secundar" data-act="scoate-exemple">Scoate datele de exemplu</button></div>`
        : `<div class="imp-formular-butoane"><button type="button" class="secundar" data-act="exemple">Încarcă date de exemplu</button></div>`}
      </section>`;

      root.innerHTML = `<div class="imp">
        ${stats}
        ${banner}
        ${sectiuneNecesar(sold)}
        ${sectiuneAmbalaje()}
        ${sectiuneStoc(sold)}
        ${formularMiscare()}
        ${jurnal()}
      </div>`;
      arataDepozitele();
    }

    function sectiuneNecesar(sold: ReturnType<typeof solduri>): string {
      if (st.necesare.length === 0) {
        return `<section class="imp-card"><h2>Necesar pentru lucrări</h2>
          <p class="hint" style="margin:0">Niciun necesar încă. În <a href="#/import">Import Excel</a>, după verificare,
          pasul „Oferta” calculează materialele din ofertă și, cu „Creează șantierul”, le trimite aici.</p></section>`;
      }
      return st.necesare.map((n) => {
        const r = deComandat(n.materiale, sold, depoziteNecesar(n), st.ambalaje);
        let cost = 0;
        let faraPret = 0;
        let inOferta = 0;
        let inOfertaCuCost = 0;
        let deCumparat = 0;
        const randuri = r.map((d, i) => {
          const m = n.materiale[i]!;
          const pm = d.alClientului ? null : pretMediu(st.miscari, d.articol.cheie);
          const c = pm === null ? null : pm * d.necesar;
          if (!d.alClientului) { deCumparat++; if (c === null) faraPret++; else cost += c; }
          const v = d.alClientului ? 0 : m.valoareOferta ?? 0;
          inOferta += v;
          if (c !== null) inOfertaCuCost += v;
          const kgPeUm = m.kg !== undefined && m.m2 > 0 ? m.kg / m.m2 : null;
          const comanda = d.alClientului ? stare("al clientului", "neutru")
            : d.deComandat === 0 ? stare("acoperit", "ok")
              : d.ambalaje
                ? `<strong>${cifra(d.ambalaje.cate)} × ${esc(d.ambalaje.ambalaj.unitate)}</strong><br><span class="hint">${
                  cantitate(d.ambalaje.cantitate, d.articol.um)}${d.ambalaje.rest > 0 ? `; rămân ${cantitate(d.ambalaje.rest, d.articol.um)} în depozit` : ""}</span>`
                : `<strong>${cantitate(d.deComandat, d.articol.um)}</strong>${kgPeUm ? `<br><span class="hint">${cifra(d.deComandat * kgPeUm)} kg</span>` : ""}`;
          const nota = [
            m.manual ? `adăugat de mână: ${esc(m.manual)}` : "",
            m.piese > 0 ? `${cifra(m.piese)} piese incluse${m.piesePresupuse > 0 ? ` (${cifra(m.piesePresupuse)} pe regulă presupusă)` : ""}` : "",
          ].filter(Boolean).join(" · ");
          return `<tr>
          <td>${esc(numeArticol(d.articol))}${nota ? `<br><span class="hint">${nota}</span>` : ""}</td>
          <td class="n">${cantitate(d.necesar, d.articol.um)}</td>
          <td class="n">${d.alClientului ? "—" : cantitate(d.inStoc, d.articol.um)}</td>
          <td class="n">${comanda}</td>
          <td class="n">${c === null ? "—" : `${eur(c)}<br><span class="hint">${eur(pm!)} / ${unitate(d.articol.um)}</span>`}</td>
          <td class="n">${v > 0 ? eur(v) : "—"}</td>
          <td class="fix">${m.manual
            ? `<button type="button" class="secundar" data-act="scoate-material" data-id="${esc(n.id)}" data-i="${i}">Scoate</button>`
            : `<button type="button" class="secundar" data-act="client" data-id="${esc(n.id)}" data-i="${i}">${d.alClientului ? "Îl cumpărăm noi" : "Îl dă clientul"}</button>`}</td>
        </tr>`;
        });
        const optiuni = santiere().map((s) =>
          `<option value="${esc(s.id)}"${s.id === n.santier ? " selected" : ""}>${esc(s.denumire)}</option>`).join("");
        const p = n.pierderi;
        const calcul = p ? ` · pierderi la croit: tablă ${cifra(p.tabla * 100)} %, plăci ${cifra(p.placa * 100)} %, tuburi ${cifra(p.tub * 100)} %` : "";
        return `<section class="imp-card">
          <h2>Necesar: ${esc(titluNecesar(n))}</h2>
          <p class="hint" style="margin:0 0 12px">Din ${esc(n.fisier)}${calcul}${
            n.faraNecesar > 0 ? ` · ${n.faraNecesar} ${n.faraNecesar === 1 ? "poziție" : "poziții"} fără necesar calculat (adaugă-le materialul de mână, mai jos)` : ""}</p>
          <div class="imp-campuri">
            <label>Șantierul lucrării (stocul lui se socotește alături de depozitul central)
              <select data-act="santier" data-id="${esc(n.id)}"><option value="">— nelegat —</option>${optiuni}</select>
            </label>
          </div>
          ${tabel(["Material", "Necesar", "În stoc", "De comandat", "Cost achiziție", "În ofertă", ""], randuri,
            ["", "n", "n", "n", "n", "n", ""])}
          <p class="hint">În ofertă: ${eur(inOferta)} (cât plătește clientul, material și manoperă, cu ajustarea și discountul) · cost material
            ${deCumparat === 0 ? "zero: tot materialul îl dă clientul" : faraPret === deCumparat ? "necunoscut: nicio intrare cu preț" : `${eur(cost)}${faraPret ? `, fără ${faraPret} ${faraPret === 1 ? "material" : "materiale"} încă fără preț` : ""}`}${faraPret < deCumparat ? ` · rămân ${eur(inOfertaCuCost - cost)} pentru manoperă și profit${faraPret ? ", pe materialele cu preț" : ""}` : ""}.
            Costul e prețul mediu al intrărilor cu preț, pe toate mărcile.</p>
          <details class="imp-card">
            <summary>Adaugă material de mână (goluri la foc, distribuitor, ce nu reiese din liste)</summary>
            <form class="imp-campuri" data-form="manual" data-id="${esc(n.id)}">
              <label>Material<select name="sistem">${MATERIALE.filter((m) => m !== "goluri_foc").map((m) =>
                `<option value="${m}">${esc(MATERIAL[m])}</option>`).join("")}</select></label>
              <label>Grosime (mm)<input name="grosime" type="number" inputmode="decimal" step="any" min="0" /></label>
              <label>Diametrul tubului, ø mm (gol pentru plăci sau tablă, în m²)<input name="rand" type="number" inputmode="numeric" step="1" min="1" /></label>
              <label>Cantitate (ml la tub, m² altfel)<input name="cantitate" type="number" inputmode="decimal" step="any" min="0" required /></label>
              <label>Pentru ce<input name="motiv" autocomplete="off" placeholder="de ex. goluri la foc, poziția 12" required /></label>
              <div class="imp-formular-butoane"><button type="submit" class="secundar">Adaugă</button></div>
            </form>
          </details>
          <div class="imp-formular-butoane"><button type="button" class="secundar" data-act="scoate-necesar" data-id="${esc(n.id)}">Scoate necesarul</button></div>
        </section>`;
      }).join("");
    }

    function sectiuneAmbalaje(): string {
      const definite = Object.entries(st.ambalaje ?? {});
      const articole = materialeDeBaza(st);
      if (articole.length === 0) return "";
      const randuri = definite.map(([cheie, a]) => {
        const art = articole.find((x) => x.cheie === cheie);
        return `<tr><td>${esc(art ? numeArticol(art) : cheie)}</td>
          <td>${esc(a.unitate)}</td><td class="n">${art ? cantitate(a.continut, art.um) : cifra(a.continut)}</td>
          <td class="fix"><button type="button" class="secundar" data-act="scoate-ambalaj" data-cheie="${esc(cheie)}">Scoate</button></td></tr>`;
      });
      return `<section class="imp-card"><h2>Ambalaje</h2>
        <p class="hint" style="margin:0 0 12px">Cum se cumpără fiecare material, din listele furnizorilor. Cu ambalajul trecut,
          „De comandat” se rotunjește în sus la ambalaj întreg, iar diferența rămâne în depozit. Fără el, se comandă exact
          cât iese din calcul.</p>
        ${definite.length ? tabel(["Material", "Ambalaj", "Conține", ""], randuri, ["", "", "n", ""]) : ""}
        <form class="imp-campuri" data-form="ambalaj">
          <label>Material<select name="articol">${articole.map((a) =>
            `<option value="${esc(a.cheie)}">${esc(numeArticol(a))}</option>`).join("")}</select></label>
          <label>Ambalaj<select name="unitate">${UNITATI_AMBALAJ.map((u) => `<option>${u}</option>`).join("")}</select></label>
          <label>Cât conține un ambalaj (ml la tub, m² altfel)<input name="continut" type="number" inputmode="decimal" step="any" min="0" required /></label>
          <div class="imp-formular-butoane"><button type="submit" class="secundar">Salvează ambalajul</button></div>
        </form>
      </section>`;
    }

    function sectiuneStoc(sold: ReturnType<typeof solduri>): string {
      const cuMaterial = DEPOZITE.filter((d) => sold.some((x) => x.depozit === d.id));
      const filtre = `<div class="filtre" role="group" aria-label="Alege depozitul">
        ${[{ id: "toate", nume: "Toate" }, ...cuMaterial].map((d) =>
          `<button class="filtru" data-depozit="${esc(d.id)}" aria-pressed="${d.id === depozit}">${esc(d.nume)}</button>`).join("")}
      </div>`;
      const vizibil = sold
        .filter((x) => depozit === "toate" || x.depozit === depozit)
        .sort((a, b) => numeDepozit(a.depozit).localeCompare(numeDepozit(b.depozit), "ro")
          || numeArticol(a.articol).localeCompare(numeArticol(b.articol), "ro"));
      const randuri = vizibil.map((x) => `<tr>
        <td>${esc(numeArticol(x.articol))}</td>
        <td>${esc(numeDepozit(x.depozit))}</td>
        <td class="n">${x.negativ ? `${stare("sold negativ", "atentie")} ` : ""}${cantitate(x.cantitate, x.articol.um)}</td>
      </tr>`);
      return `<section class="imp-card"><h2>Stocul pe depozite</h2>
        ${sold.length === 0
          ? `<p class="hint" style="margin:0">Depozitul e gol. Înregistrează o intrare mai jos${modDate() === "server" ? "" : ", sau încarcă datele de exemplu"}.</p>`
          : `${filtre}${tabel(["Material", "Depozit", "Cantitate"], randuri, ["", "", "n"])}`}
      </section>`;
    }

    function formularMiscare(): string {
      const articole = articoleCunoscute(st);
      const alegeDepozit = (nume: string, eticheta: string): string => `<label data-camp="${nume}">${eticheta}
        <select name="${nume}"><option value="">— alege —</option>${DEPOZITE.map((d) =>
          `<option value="${esc(d.id)}">${esc(d.nume)}</option>`).join("")}</select></label>`;
      return `<form class="imp-card" id="miscare">
        <h2>Mișcare nouă</h2>
        <div class="imp-campuri">
          <label>Ce se întâmplă cu materialul
            <select name="tip">${TIPURI.map(([v, t]) =>
              `<option value="${v}"${v === tipAles ? " selected" : ""}>${t}</option>`).join("")}</select></label>
          <label>Material
            <select name="articol">${articole.map((a) =>
              `<option value="${esc(a.cheie)}">${esc(numeArticol(a))}${numeArticol(a).endsWith("m²") ? "" : ` (${unitate(a.um)})`}</option>`).join("")}
              <option value="__alt"${articole.length === 0 ? " selected" : ""}>Alt material…</option></select></label>
          <label data-camp="alt">Material nou
            <select name="sistem">${MATERIALE.filter((m) => m !== "goluri_foc").map((m) =>
              `<option value="${m}">${esc(MATERIAL[m])}</option>`).join("")}</select></label>
          <label data-camp="alt">Grosime (mm)
            <input name="grosime" type="number" inputmode="decimal" step="any" min="0" /></label>
          <label data-camp="alt">Diametrul tubului, ø mm (gol pentru plăci sau tablă, în m²)
            <input name="rand" type="number" inputmode="numeric" step="1" min="1" /></label>
          <label data-camp="pret">Marcă (opțional: Armaflex, K-Flex, Rockwool …)
            <input name="marca" autocomplete="off" /></label>
          <label>Cantitate${tipAles === "ajustare" ? " (cu minus, dacă la inventar e mai puțin)" : ""}
            <input name="cantitate" type="number" inputmode="decimal" step="any" required /></label>
          ${alegeDepozit("din", "Din depozitul")}
          ${alegeDepozit("spre", "În depozitul")}
          <label data-camp="pret">Preț de achiziție pe unitate, în euro (de pe factură; gol = fără preț)
            <input name="pret" type="number" inputmode="decimal" step="any" min="0" /></label>
          <label>Notă (furnizor, factură, cine a luat materialul)
            <input name="nota" autocomplete="off" /></label>
        </div>
        ${eroare ? `<p class="alerta" role="alert" style="margin-top:16px">${esc(eroare)}</p>` : ""}
        <div class="imp-formular-butoane"><button type="submit" class="primar">Înregistrează</button></div>
      </form>`;
    }

    function jurnal(): string {
      if (st.miscari.length === 0) return "";
      const randuri = [...st.miscari].reverse().map((m) => {
        const anulata = esteAnulata(m, st.miscari);
        const traseu = [m.din, m.spre].filter(Boolean).map((d) => esc(numeDepozit(d))).join(" → ");
        const eticheta = m.anuleaza ? stare("anulare", "neutru") : anulata ? stare("anulată", "neutru") : "";
        return `<tr>
          <td class="fix">${esc(new Date(m.data).toLocaleDateString("ro-RO"))}</td>
          <td>${esc(TIP[m.tip])} ${eticheta} ${m.exemplu ? stare("exemplu", "atentie") : ""}
            <br><span class="hint">${esc(numeArticol(m.articol))}${m.nota && !m.exemplu ? ` · ${esc(m.nota)}` : ""}${
              m.pret ? ` · ${eur(m.pret.valoare)} / ${unitate(m.articol.um)}` : ""}</span></td>
          <td class="n">${m.anuleaza ? "−" : ""}${cantitate(m.cantitate, m.articol.um)}<br><span class="hint">${traseu}</span></td>
          <td class="fix">${!m.anuleaza && !anulata
            ? `<button type="button" class="secundar" data-act="storno" data-id="${esc(m.id)}">Anulează</button>` : ""}</td>
        </tr>`;
      });
      return `<section class="imp-card"><h2>Jurnalul mișcărilor</h2>
        <p class="hint" style="margin:0 0 12px">Nimic din jurnal nu se șterge. „Anulează” adaugă un rând care o anulează pe cea greșită, ca să se vadă ce s-a întâmplat.</p>
        ${tabel(["Data", "Mișcare", "Cantitate", ""], randuri, ["", "", "n", ""])}
      </section>`;
    }

    /** Formularul arată doar depozitele cerute de tipul ales și câmpurile de material nou. */
    function arataDepozitele(): void {
      const f = root.querySelector<HTMLFormElement>("#miscare");
      if (!f) return;
      const tip = (f.elements.namedItem("tip") as HTMLSelectElement).value as TipMiscare;
      f.querySelector<HTMLElement>('[data-camp="din"]')!.hidden = !CERE[tip].din;
      f.querySelector<HTMLElement>('[data-camp="spre"]')!.hidden = !CERE[tip].spre;
      const alt = (f.elements.namedItem("articol") as HTMLSelectElement).value === "__alt";
      for (const el of f.querySelectorAll<HTMLElement>('[data-camp="alt"]')) el.hidden = !alt;
      for (const el of f.querySelectorAll<HTMLElement>('[data-camp="pret"]')) el.hidden = tip !== "intrare";
      // Valorile implicite ale fiecarui tip: intrarea vine in centralul, returul pleaca spre el.
      const spre = f.elements.namedItem("spre") as HTMLSelectElement;
      if (!spre.value && (tip === "intrare" || tip === "retur" || tip === "ajustare")) spre.value = CENTRAL;
      const din = f.elements.namedItem("din") as HTMLSelectElement;
      if (!din.value && tip === "transfer") din.value = CENTRAL;
    }

    function inregistreaza(f: HTMLFormElement): void {
      const date = new FormData(f);
      const val = (n: string): string => ((date.get(n) as string | null) ?? "").trim();
      const tip = val("tip") as TipMiscare;
      let articol = articoleCunoscute(st).find((a) => a.cheie === val("articol"));
      if (val("articol") === "__alt" || !articol) {
        const g = val("grosime") === "" ? null : Number(val("grosime").replace(",", "."));
        const r = val("rand") === "" ? null : Number(val("rand"));
        articol = articolDin({ sistem: val("sistem"), grosime_mm: g, rand: r });
      }
      // Marca se scrie la intrare: de acolo materialul are producătorul lui.
      if (tip === "intrare" && val("marca")) articol = articolDin(articol, val("marca"));
      const noua: Omit<Miscare, "id" | "data"> = {
        tip, articol, cantitate: Number(val("cantitate").replace(",", ".")),
        ...(CERE[tip].din && val("din") ? { din: val("din") } : {}),
        ...(CERE[tip].spre && val("spre") ? { spre: val("spre") } : {}),
        ...(val("nota") ? { nota: val("nota") } : {}),
        ...(tip === "intrare" && val("pret") !== ""
          ? { pret: { valoare: Number(val("pret").replace(",", ".")) } }
          : {}),
      };
      const problema = valideazaMiscare(noua);
      tipAles = tip;
      if (problema) { eroare = problema; deseneaza(); return; }
      eroare = "";
      st = { ...st, miscari: [...st.miscari, { ...noua, id: idNou(), data: new Date().toISOString() }] };
      salveaza();
      deseneaza();
    }

    root.addEventListener("click", (e) => {
      const t = e.target as HTMLElement;
      const bDep = t.closest<HTMLButtonElement>("[data-depozit]");
      if (bDep) { depozit = bDep.dataset["depozit"]!; deseneaza(); return; }
      const b = t.closest<HTMLButtonElement>("button[data-act]");
      if (!b) return;
      switch (b.dataset["act"]) {
        case "exemple": {
          const materiale = st.necesare[0]?.materiale ?? [];
          st = { ...st, miscari: [...st.miscari, ...miscariDeExemplu(materiale, CENTRAL, idNou, new Date().toISOString())] };
          break;
        }
        case "scoate-exemple": st = { ...st, miscari: faraExemple(st.miscari) }; break;
        case "storno": {
          const m = st.miscari.find((x) => x.id === b.dataset["id"]);
          const inversa = m && storno(m, st.miscari, idNou(), new Date().toISOString());
          if (!inversa) return;
          st = { ...st, miscari: [...st.miscari, inversa] };
          break;
        }
        case "scoate-necesar": st = { ...st, necesare: st.necesare.filter((n) => n.id !== b.dataset["id"]) }; break;
        case "client":
        case "scoate-material": {
          const i = Number(b.dataset["i"]);
          st = { ...st, necesare: st.necesare.map((n) => {
            if (n.id !== b.dataset["id"]) return n;
            if (b.dataset["act"] === "scoate-material") return { ...n, materiale: n.materiale.filter((_, j) => j !== i) };
            return { ...n, materiale: n.materiale.map((m, j) => {
              if (j !== i) return m;
              const { alClientului: _c, ...rest } = m;
              return m.alClientului ? rest : { ...rest, alClientului: true as const };
            }) };
          }) };
          break;
        }
        case "scoate-ambalaj": {
          const { [b.dataset["cheie"]!]: _a, ...rest } = st.ambalaje ?? {};
          st = { ...st, ambalaje: rest };
          break;
        }
        default: return;
      }
      salveaza();
      deseneaza();
    });

    root.addEventListener("change", (e) => {
      const t = e.target as HTMLSelectElement;
      if (t.dataset["act"] === "santier") {
        const id = t.dataset["id"];
        st = { ...st, necesare: st.necesare.map((n) => {
          if (n.id !== id) return n;
          const { santier: _, ...rest } = n;
          return t.value ? { ...rest, santier: t.value } : rest;
        }) };
        salveaza();
        deseneaza();
        return;
      }
      if (t.name === "tip" || t.name === "articol") arataDepozitele();
      if (t.name === "tip") tipAles = t.value as TipMiscare;
    });

    root.addEventListener("submit", (e) => {
      e.preventDefault();
      const f = e.target as HTMLFormElement;
      if (f.id === "miscare") inregistreaza(f);
      const date = new FormData(f);
      const val = (n: string): string => ((date.get(n) as string | null) ?? "").trim();
      const numar = (n: string): number | null => (val(n) === "" ? null : Number(val(n).replace(",", ".")));
      if (f.dataset["form"] === "manual") {
        const cant = numar("cantitate");
        if (cant === null || !(cant > 0)) return;
        const m = materialManual(val("sistem"), numar("grosime"), numar("rand"), cant, val("motiv"));
        st = { ...st, necesare: st.necesare.map((n) => (n.id === f.dataset["id"] ? { ...n, materiale: [...n.materiale, m] } : n)) };
        salveaza();
        deseneaza();
      }
      if (f.dataset["form"] === "ambalaj") {
        const continut = numar("continut");
        if (continut === null || !(continut > 0)) return;
        const a: Ambalaj = { unitate: val("unitate"), continut };
        st = { ...st, ambalaje: { ...(st.ambalaje ?? {}), [val("articol")]: a } };
        salveaza();
        deseneaza();
      }
    });

    deseneaza();
  },
};
