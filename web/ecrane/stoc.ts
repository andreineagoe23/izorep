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
import { cate, esc, eur, indicator, stare, tabel, type Ecran } from "./tip.js";
import { exemple } from "../date/exemple.js";
import {
  citestePlanuri, citesteDepozit, idNou, inregistreazaInventar, modDate, puneComanda, scrieDepozit, treceStocDePornire,
} from "../date.js";
import { descarca } from "../descarca.js";
import { evidentaSantier, registruEvidentaSantier } from "../evidenta-santier.js";
import { MATERIALE, MATERIAL } from "../import/text.js";
import { cantitate, cifra, numeArticol, unitate } from "../stoc-vizual.js";
import type { NecesarLucrare, StareDepozit } from "../depozit-local.js";
import {
  CERE, articolDin, cantitateNecesara, esteAnulata, faraExemple, miscariDeExemplu, pretMediu,
  solduri, storno, valideazaMiscare, type Ambalaj, type Articol, type Miscare, type TipMiscare,
} from "../../src/stoc/registru.js";
import { materialManual, ordineNecesar, type Categorie, type MaterialNecesar } from "../../src/stoc/necesar.js";
import { celulaNumar, legaCelule, numarScris } from "../celula.js";
import { ciorneDinRamas, deComandatSantier, type DeComandatSantier } from "../../src/stoc/comenzi.js";
import { pretPropus } from "../../src/stoc/preturi-furnizori.js";
import { ATELIER, drumul, inAtelier, intreFirme, locuri, type Loc } from "../../src/stoc/locuri.js";
import {
  LOCURI_PORNIRE, MOTIVE_INVENTAR, MOTIV_PORNIRE, estePornire, rezumatInventar, type LinieNumarata,
} from "../../src/stoc/inventar.js";

/** Forma aleasa in formular; cu ø ramane tub, fara alegere ramane cea implicita. */
const formaAleasa = (v: string, rand: number | null): Categorie | undefined =>
  rand === null && (v === "saltea" || v === "placa") ? v : undefined;

/** Ambalajele uzuale (S13): tuburile în cutii, vata în saci sau pachete, tabla la kg. */
const UNITATI_AMBALAJ = ["cutie", "sac", "pachet", "rolă", "coală", "kg"];

export const CENTRAL = "central";

/**
 * Șantierele: cele făcute din oferte (cu firma lor); pe linkul demo, și cele din
 * datele firmei. Pe server doar cele din oferte: pornim doar cu șantierele noi
 * (S48, Faza 8), iar cele din datele firmei sunt lucrări de dinainte de aplicație.
 */
export const santiere = (): { id: string; denumire: string; firma?: string }[] => [
  ...citestePlanuri().map((p) => ({ id: p.id, denumire: p.denumire, firma: p.firma })),
  ...(exemple()?.SANTIERE ?? []),
];

/** Locurile cu material (Faza 5): centralul, atelierul, șantierele; cu firma și responsabilul. */
export const locurile = (): Loc[] => locuri(santiere(), citesteDepozit().responsabili ?? {});

export const depozite = (): { id: string; nume: string }[] => locurile().map((l) => ({ id: l.id, nume: l.nume }));

/**
 * Locul se mai poate alege: nu e un șantier închis (Faza 7). Listele care doar
 * arată (jurnalul, „Locurile”, drumul) rămân întregi; formularele nu oferă
 * șantierul închis, ca pe linkul demo, unde nu e trigger-ul din bază, să nu
 * se poată scrie nimic pe el.
 */
export const deschis = (): ((id: string) => boolean) => {
  const inchise = new Set(citestePlanuri().filter((p) => p.inchis).map((p) => p.id));
  return (id) => !inchise.has(id);
};

/**
 * Ce se poate alege în „Mișcare nouă”. Ajustarea nu: o face cardul „Inventar”,
 * cu motiv (S45). Stocul de pornire e o intrare marcată (Faza 8).
 */
type TipFormular = Exclude<TipMiscare, "ajustare"> | "pornire";
const TIPURI: [TipFormular, string][] = [
  ["intrare", "Intrare de la furnizor"],
  ["pornire", "Stoc de pornire: era deja în depozit"],
  ["transfer", "Transfer între depozite"],
  ["consum", "Consum pe lucrare"],
  ["retur", "Retur de pe șantier"],
];
const TIP: Record<TipMiscare, string> = {
  intrare: "Intrare de la furnizor", transfer: "Transfer între depozite", consum: "Consum pe lucrare",
  retur: "Retur de pe șantier", ajustare: "Ajustare la inventar",
};
const cere = (t: TipFormular): { din: boolean; spre: boolean } => CERE[t === "pornire" ? "intrare" : t];
/** Numele fișierului fără caracterele pe care Windows le refuză. */
const numeFisier = (s: string): string => s.replace(/[/\\?%*:|"<>]/g, "-");

/** Depozitul în care vine materialul unui necesar: al șantierului; nelegat, centralul. */
export const depozitNecesar = (n: NecesarLucrare): string => n.santier ?? CENTRAL;

/**
 * Rămas de comandat pe fiecare material al unui necesar (Faza 4): necesar −
 * adus pe șantier − comandat nesosit. Centralul și celelalte șantiere apar ca
 * propunere de transfer, nu se scad.
 */
export function ramasPeNecesar(s: StareDepozit, n: NecesarLucrare): DeComandatSantier[] {
  const alte = s.necesare.filter((x) => x.id !== n.id && x.santier).map((x) => ({ depozit: x.santier!, materiale: x.materiale }));
  return deComandatSantier(n.materiale, s.miscari, s.comenzi ?? [], depozitNecesar(n), s.ambalaje, alte);
}

/**
 * Câte materiale mai sunt de comandat, pe fiecare necesar. Folosit și de
 * tabloul de bord. Pe un șantier închis, nimic: tabloul cerea „7 materiale de
 * comandat” pentru un șantier terminat (16 octombrie 2026).
 */
export function deComandatPeNecesar(s: StareDepozit): { necesar: NecesarLucrare; articole: number }[] {
  const eDeschis = deschis();
  return s.necesare.map((n) => ({
    necesar: n,
    articole: n.santier && !eDeschis(n.santier) ? 0 : ramasPeNecesar(s, n).filter((d) => d.ramas > 0).length,
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

/**
 * Materialul cu altă cantitate, în unitatea articolului (ml la tub, m² altfel).
 * Greutatea tablei se ține proporțională.
 */
function cuCantitatea(m: MaterialNecesar, q: number): MaterialNecesar {
  const acum = cantitateNecesara(m);
  const kg = m.kg !== undefined && acum > 0 ? { kg: Math.round((m.kg * q / acum) * 100) / 100 } : {};
  return articolDin(m).um === "ml" ? { ...m, ml: q, ...kg } : { ...m, m2: q, ...kg };
}

export const ecran: Ecran = {
  id: "stoc",
  titlu: "Necesar și depozit",
  subtitlu: "Unde e materialul și cât mai trebuie cumpărat pentru fiecare lucrare. Fiecare intrare și ieșire rămâne scrisă; nimic nu se șterge.",

  render(root) {
    let st = citesteDepozit();
    let pastrat = true;
    let depozit = "toate";
    let eroare = "";
    // Cu depozitul gol, primul lucru e stocul de pornire (Faza 8).
    let tipAles: TipFormular = st.miscari.length === 0 ? "pornire" : "intrare";
    /** Cardul „Inventar”: locul numărat și ce s-a întâmplat la ultima trecere. */
    let invLoc = CENTRAL;
    let eroareInventar = "";
    let mesajInventar = "";
    let DEPOZITE = depozite();
    let LOCURI = locurile();
    /** „Drumul materialului”: materialul și șantierul alese. */
    let drumMaterial = "";
    let drumSantier = "";
    let eroareAtelier = "";
    const numeDepozit = (id?: string): string => DEPOZITE.find((d) => d.id === id)?.nume ?? "—";

    const salveaza = (): void => { pastrat = scrieDepozit(st); };

    /** De câte ori s-a redesenat: celula necesarului redesenează după un clic doar dacă el n-a făcut-o. */
    let desenari = 0;
    function deseneaza(): void {
      desenari++;
      DEPOZITE = depozite();
      LOCURI = locurile();
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

      // In ordinea in care se folosesc: ce trebuie, ce e, ce se misca; reglajele
      // (ambalajele) si istoricul la sfarsit. Pagina are noua sectiuni, deci sus
      // e un rand „Sari la”, ca omul sa nu le caute derulind.
      const sectiuni: [string, string, string][] = [
        ["sec-necesar", "Necesarul", sectiuneNecesar(sold)],
        ["sec-stoc", "Stocul", sectiuneStoc(sold)],
        ["sec-miscare", "Mișcare nouă", formularMiscare()],
        ["sec-inventar", "Inventar", sectiuneInventar(sold)],
        ["sec-atelier", "Atelierul", sectiuneAtelier()],
        ["sec-drum", "Drumul materialului", sectiuneDrum()],
        ["sec-locuri", "Locurile", sectiuneLocuri(sold)],
        ["sec-ambalaje", "Ambalaje", sectiuneAmbalaje()],
        ["sec-jurnal", "Jurnalul", jurnal()],
      ];
      root.innerHTML = `<div class="imp">
        ${stats}
        <nav class="sari-la" aria-label="Pe pagina asta"><span class="hint">Sari la:</span>${sectiuni.map(([id, et]) =>
          `<button type="button" class="chip" data-sari="${id}">${et}</button>`).join("")}</nav>
        ${banner}
        ${sectiuni.map(([id, , html]) => `<div id="${id}" class="sectiune-pagina">${html}</div>`).join("")}
      </div>`;
      arataDepozitele();
    }

    function sectiuneNecesar(sold: ReturnType<typeof solduri>): string {
      if (st.necesare.length === 0) {
        return `<section class="imp-card"><h2>Necesar pentru lucrări</h2>
          <p class="hint" style="margin:0">Niciun necesar încă. În <a href="#/import">Cerere nouă</a>, după verificare,
          pasul „Oferta” calculează materialele din ofertă și, cu „Creează șantierul”, le trimite aici.</p></section>`;
      }
      return st.necesare.map((n) => {
        const r = ramasPeNecesar(st, n);
        const peMaterial = new Map(r.map((d) => [d.material, d]));
        let cost = 0;
        let faraPret = 0;
        let inOferta = 0;
        let inOfertaCuCost = 0;
        let deCumparat = 0;
        const transferuri: string[] = [];
        const randuri = n.materiale.map((m, i) => {
          const d = peMaterial.get(m);
          const a = d?.articol ?? articolDin(m);
          const necesar = d?.necesar ?? (a.um === "ml" ? m.ml : m.m2);
          const pm = m.alClientului ? null : pretMediu(st.miscari, a.cheie);
          const c = pm === null ? null : pm * necesar;
          if (!m.alClientului) { deCumparat++; if (c === null) faraPret++; else cost += c; }
          const v = m.alClientului ? 0 : m.valoareOferta ?? 0;
          inOferta += v;
          if (c !== null) inOfertaCuCost += v;
          const kgPeUm = m.kg !== undefined && m.m2 > 0 ? m.kg / m.m2 : null;
          const ramas = !d ? stare("al clientului", "neutru")
            : d.ramas === 0 && d.inCiorna > 0 ? stare("în ciornă, de trimis", "atentie")
            : d.ramas === 0 ? stare(d.comandat > 0 ? "comandat" : "acoperit", "ok")
              : d.ambalaje
                ? `<strong>${cifra(d.ambalaje.cate)} × ${esc(d.ambalaje.ambalaj.unitate)}</strong><br><span class="hint">${
                  cantitate(d.ambalaje.cantitate, a.um)}${d.ambalaje.rest > 0 ? `; rămân ${cantitate(d.ambalaje.rest, a.um)} în depozit` : ""}${
                  d.ambalaje.dinEvidenta ? `; ${esc(d.ambalaje.ambalaj.unitate)} de ${cantitate(d.ambalaje.ambalaj.continut, a.um)}, ca în evidența de cumpărări` : ""}</span>`
                : `<strong>${cantitate(d.ramas, a.um)}</strong>${kgPeUm ? `<br><span class="hint">${cifra(d.ramas * kgPeUm)} kg</span>` : ""}`;
          if (d && d.ramas > 0) {
            for (const x of d.disponibil) {
              const q = Math.min(x.cantitate, d.ramas);
              transferuri.push(`<tr><td>${esc(numeArticol(a))}</td><td>${esc(numeDepozit(x.depozit))}</td>
                <td class="n">${cantitate(x.cantitate, a.um)}</td>
                <td class="fix"><button type="button" class="secundar" data-act="transfer" data-id="${esc(n.id)}" data-i="${i}"
                  data-din="${esc(x.depozit)}" data-q="${q}">Mută ${cantitate(q, a.um)} pe șantier</button></td></tr>`);
            }
          }
          const nota = [
            m.manual ? `adăugat de mână: ${esc(m.manual)}` : "",
            m.piese > 0 ? `${cifra(m.piese)} piese incluse${m.piesePresupuse > 0 ? ` (${cifra(m.piesePresupuse)} pe regulă presupusă)` : ""}` : "",
          ].filter(Boolean).join(" · ");
          return `<tr>
          <td>${esc(numeArticol(a))}${nota ? `<br><span class="hint">${nota}</span>` : ""}</td>
          <td class="n"><span class="cel-cu-um">${celulaNumar({
            ed: "nec", valoare: Math.round(necesar * 100) / 100, eticheta: `Necesar, ${numeArticol(a)}, în ${unitate(a.um)}`,
            schimbat: m.calculat !== undefined, ...(m.calculat !== undefined ? { inainte: `Calculat: ${cantitate(m.calculat, a.um)}` } : {}),
            date: { id: n.id, i },
          })}<span class="hint">${unitate(a.um)}</span></span></td>
          <td class="n">${d ? cantitate(d.adus, a.um) : "—"}</td>
          <td class="n">${d && d.comandat > 0 ? cantitate(d.comandat, a.um) : "—"}</td>
          <td class="n">${ramas}</td>
          <td class="n">${c === null ? "—" : `${eur(c)}<br><span class="hint">${eur(pm!)} / ${unitate(a.um)}</span>`}</td>
          <td class="n">${v > 0 ? eur(v) : "—"}</td>
          <td class="fix">${m.manual ? ""
            : `<button type="button" class="legatura" data-act="client" data-id="${esc(n.id)}" data-i="${i}">${m.alClientului ? "Îl cumpărăm noi" : "Îl dă clientul"}</button> `}<button
              type="button" class="cel-scoate" data-act="scoate-rand" data-id="${esc(n.id)}" data-i="${i}"
              aria-label="Scoate ${esc(numeArticol(a))} din necesar" title="Scoate din necesar">✕</button></td>
        </tr>`;
        });
        const deComandat = r.filter((d) => d.ramas > 0).length;
        const optiuni = santiere().filter((s) => s.id === n.santier || deschis()(s.id)).map((s) =>
          `<option value="${esc(s.id)}"${s.id === n.santier ? " selected" : ""}>${esc(s.denumire)}</option>`).join("");
        const p = n.pierderi;
        const calcul = p ? ` · pierderi la croit: tablă ${cifra(p.tabla * 100)} %, saltele ${cifra((p.saltea ?? p.placa) * 100)} %, plăci ${cifra(p.placa * 100)} %, tuburi ${cifra(p.tub * 100)} %` : "";
        return `<section class="imp-card">
          <h2>Necesar: ${esc(titluNecesar(n))}</h2>
          <p class="hint" style="margin:0 0 12px">Din ${esc(n.fisier)}${calcul}${
            n.faraNecesar > 0 ? ` · ${n.faraNecesar} ${n.faraNecesar === 1 ? "poziție" : "poziții"} fără necesar calculat (adaugă-le materialul de mână, mai jos)` : ""}</p>
          <div class="imp-campuri">
            <label>Șantierul lucrării (aici vine materialul comandat)
              <select data-act="santier" data-id="${esc(n.id)}"><option value="">— nelegat —</option>${optiuni}</select>
            </label>
          </div>
          <p class="cel-legenda"><span><span class="mostra" aria-hidden="true"></span>scris de tine (ține mouse-ul pe celulă: vezi cât era calculat)</span>
            <span>Scrii necesarul direct în tabel, ca în Excel. ✕ scoate materialul.</span>${
            n.scoase?.length || n.materiale.some((m) => m.calculat !== undefined)
              ? ` <button type="button" class="secundar" data-act="anuleaza-necesar" data-id="${esc(n.id)}">Anulează modificările</button>` : ""}</p>
          <div class="tabel-necesar">${tabel(["Material", "Necesar", "Adus pe șantier", "Comandat, nesosit", "Rămas de comandat", "Cost achiziție", "În ofertă", ""], randuri,
            ["", "n", "n", "n", "n", "n", "n", ""])}</div>
          ${transferuri.length ? `<h3>Material care există deja</h3>
            <p class="hint" style="margin:0 0 12px">Înainte de comandă: materialul din depozitul central, sau adus pe alt șantier peste
              ce-i trebuie lui. Nu se scade singur din comandă; dacă îl muți, scade.</p>
            ${tabel(["Material", "Unde e", "Liber", ""], transferuri, ["", "", "n", ""])}` : ""}
          <div class="imp-formular-butoane">
            ${deComandat > 0
              ? `<button type="button" class="primar" data-act="fa-comenzi" data-id="${esc(n.id)}">Fă comenzile pentru ${deComandat} ${deComandat === 1 ? "material" : "materiale"}</button>`
              : r.some((d) => d.inCiorna > 0)
                ? `<span class="hint">Restul e pe ciorne care n-au fost trimise. Trimite-le din <a href="#/comenzi">Comenzi</a>.</span>`
                : `<span class="hint">Tot materialul e adus sau comandat. Vezi <a href="#/comenzi">Comenzi</a>.</span>`}
          </div>
          <p class="hint">În ofertă: ${eur(inOferta)} (cât plătește clientul, material și manoperă, cu ajustarea și discountul) · cost material
            ${deCumparat === 0 ? "zero: tot materialul îl dă clientul" : faraPret === deCumparat ? "necunoscut: nicio intrare cu preț" : `${eur(cost)}${faraPret ? `, fără ${faraPret} ${faraPret === 1 ? "material" : "materiale"} încă fără preț` : ""}`}${faraPret < deCumparat ? ` · rămân ${eur(inOfertaCuCost - cost)} pentru manoperă și profit${faraPret ? ", pe materialele cu preț" : ""}` : ""}.
            Costul e prețul mediu al intrărilor cu preț, pe toate mărcile.</p>
          <details class="imp-card">
            <summary>+ Rând nou: material adăugat de mână (goluri la foc, distribuitor, ce nu reiese din liste)</summary>
            <form class="imp-campuri" data-form="manual" data-id="${esc(n.id)}">
              <label>Material<select name="sistem">${MATERIALE.filter((m) => m !== "goluri_foc").map((m) =>
                `<option value="${m}">${esc(MATERIAL[m])}</option>`).join("")}</select></label>
              <label>Grosime (mm)<input name="grosime" type="number" inputmode="decimal" step="any" min="0" /></label>
              <label>Diametrul tubului, ø mm (gol pentru plăci sau tablă, în m²)<input name="rand" type="number" inputmode="numeric" step="1" min="1" /></label>
              <label>Formă<select name="forma"><option value="">după diametru (tub; fără ø: saltea de vată, placă de elastomer, tablă)</option>
                <option value="saltea">saltea de vată, m²</option><option value="placa">placă, m²</option></select></label>
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
          ? `<p class="hint" style="margin:0">Depozitul e gol. Dacă în depozitul central e deja material, trece-l în „Mișcare nouă”
            ca „Stoc de pornire”: nu trebuie numărat tot deodată${modDate() === "server" ? "" : ". Sau încarcă datele de exemplu"}.</p>`
          : `${filtre}${tabel(["Material", "Depozit", "Cantitate"], randuri, ["", "", "n"])}`}
      </section>`;
    }

    /**
     * Inventarul unui loc (S45, Faza 8): ce ai numărat față de ce arată
     * aplicația. Diferențele devin ajustări cu motivul ales; ce nu se numără nu
     * se atinge, deci nu trebuie numărat tot deodată.
     */
    function sectiuneInventar(sold: ReturnType<typeof solduri>): string {
      if (!LOCURI.some((l) => l.id === invLoc) || !deschis()(invLoc)) invLoc = CENTRAL;
      const aici = sold.filter((x) => x.depozit === invLoc)
        .sort((a, b) => numeArticol(a.articol).localeCompare(numeArticol(b.articol), "ro"));
      const altele = articoleCunoscute(st).filter((a) => !aici.some((x) => x.articol.cheie === a.cheie));
      const randuri = aici.map((x) => `<tr>
        <td>${esc(numeArticol(x.articol))}</td>
        <td class="n">${x.negativ ? `${stare("sold negativ", "atentie")} ` : ""}${cantitate(x.cantitate, x.articol.um)}</td>
        <td class="n"><input name="numarat" data-cheie="${esc(x.articol.cheie)}" data-arata="${x.cantitate}" data-um="${x.articol.um}"
          type="number" inputmode="decimal" step="any" min="0" aria-label="Ce ai numărat: ${esc(numeArticol(x.articol))}" /></td>
        <td class="n" data-dif>—</td>
      </tr>`);
      const nume = LOCURI.find((l) => l.id === invLoc)?.nume ?? "";
      return `<section class="imp-card"><h2>Inventar</h2>
        <p class="hint" style="margin:0 0 12px">Numără ce e într-un loc și scrie cifrele aici. Unde ce ai numărat diferă de ce arată
          aplicația, se trece o ajustare cu motivul ales. Ce nu numeri rămâne cum e: nu trebuie numărat tot deodată.</p>
        <form data-form="inventar">
          <div class="imp-campuri">
            <label>Locul numărat<select name="loc" data-act="inventar-loc">${LOCURI.filter((l) => deschis()(l.id)).map((l) =>
              `<option value="${esc(l.id)}"${l.id === invLoc ? " selected" : ""}>${esc(l.nume)}</option>`).join("")}</select></label>
          </div>
          ${aici.length
            ? tabel(["Material", "Ce arată aplicația", "Ce ai numărat", "Diferența"], randuri, ["", "n", "n", "n"], true)
            : `<p class="hint" style="margin:12px 0 0">În ${esc(nume)} aplicația nu arată niciun material. ${altele.length ? " Dacă ai găsit ceva acolo, scrie mai jos." : " Trece întâi stocul de pornire, la „Mișcare nouă”."}</p>`}
          ${aici.length || altele.length ? `<div class="imp-campuri">
            ${altele.length ? `<label>Alt material găsit la numărat (opțional)<select name="alt"><option value="">— niciunul —</option>${altele.map((a) =>
              `<option value="${esc(a.cheie)}">${esc(numeArticol(a))}</option>`).join("")}</select></label>
            <label>Cât ai numărat din el<input name="altCant" type="number" inputmode="decimal" step="any" min="0" /></label>` : ""}
            <label>Motivul diferențelor<select name="motiv"><option value="">— alege —</option>${MOTIVE_INVENTAR.map((m) =>
              `<option>${esc(m)}</option>`).join("")}<option value="__alt">alt motiv…</option></select></label>
            <label data-camp="motiv-alt" hidden>Scrie motivul<input name="motivAlt" autocomplete="off" /></label>
            <label>Cine a numărat (opțional)<input name="cine" autocomplete="off" /></label>
          </div>` : ""}
          ${eroareInventar ? `<p class="alerta" role="alert" style="margin-top:16px">${esc(eroareInventar)}</p>` : ""}
          ${mesajInventar ? `<p class="hint" role="status" style="margin:16px 0 0">${stare("Trecut", "ok")} ${esc(mesajInventar)}</p>` : ""}
          ${aici.length || altele.length ? `<div class="imp-formular-butoane"><button type="submit" class="primar">Trece inventarul</button></div>` : ""}
        </form>
      </section>`;
    }

    /** Excelul evidenței de material pe un șantier, cu coloanele evidenței firmei (Faza 8). */
    async function descarcaEvidenta(id: string): Promise<void> {
      const proiect = citestePlanuri().find((p) => p.id === id)?.denumire ?? numeDepozit(id).replace(/^Șantier /, "");
      const e = evidentaSantier(st.miscari, id, proiect, numeDepozit);
      descarca(await registruEvidentaSantier(e, proiect), numeFisier(`Evidenta material ${proiect} ${new Date().toISOString().slice(0, 10)}.xlsx`));
    }

    /**
     * Atelierul (răspunsul 4 al firmei): ce a cerut șeful de șantier, tabla
     * trecută din central și pusă deoparte pentru el, apoi „Trimite pe șantier”.
     */
    function sectiuneAtelier(): string {
      const a = inAtelier(st.miscari);
      // Întâi tabla care chiar e în central (cea mai multă sus): de acolo pleacă la atelier.
      const sold = solduri(st.miscari);
      const inCentral = (x: Articol): number => sold.find((y) => y.depozit === CENTRAL && y.articol.cheie === x.cheie)?.cantitate ?? 0;
      const tabla = articoleCunoscute(st).filter((x) => x.sistem === "tabla" || x.sistem === "tabla_inox")
        .sort((x, y) => inCentral(y) - inCentral(x));
      const restul = articoleCunoscute(st).filter((x) => !tabla.includes(x));
      const randuri = a.map((x) => `<tr>
        <td>${x.pentru ? esc(numeDepozit(x.pentru)) : stare("liberă", "neutru")}</td>
        <td>${esc(numeArticol(x.articol))}</td>
        <td class="n">${cantitate(x.cantitate, x.articol.um)}</td>
        <td>${x.cereri.length ? esc(x.cereri.join(" · ")) : "—"}</td>
        <td class="fix">${x.pentru
          ? `<button type="button" class="secundar" data-act="atelier-trimite" data-cheie="${esc(x.articol.cheie)}"
              data-pentru="${esc(x.pentru)}" data-q="${x.cantitate}">Trimite pe șantier</button>` : ""}</td>
      </tr>`);
      const optiuniSantier = santiere().filter((s) => deschis()(s.id)).map((s) => `<option value="${esc(s.id)}">${esc(s.denumire)}</option>`).join("");
      return `<section class="imp-card"><h2>Atelierul</h2>
        <p class="hint" style="margin:0 0 12px">Șeful de șantier cere la atelier ce îi trebuie (de ex. 10 ml ø100, 3 coturi și 10 carcase).
          Tabla trece din central în atelier și stă pusă deoparte pentru șantierul lui până pleacă. Rămâne în m² și croită.</p>
        ${a.length ? tabel(["Pentru", "Material", "Cantitate", "Ce se face", ""], randuri, ["", "", "n", "", ""])
          : `<p class="hint" style="margin:0 0 12px">În atelier nu e nimic acum.</p>`}
        <details class="imp-card"${eroareAtelier ? " open" : ""}>
          <summary>Trimite material la atelier</summary>
          <form class="imp-campuri" data-form="atelier">
            <label>Pentru șantierul<select name="pentru" required><option value="">— alege —</option>${optiuniSantier}</select></label>
            <label>Ce a cerut șeful de șantier<input name="cerere" autocomplete="off" required placeholder="10 ml ø100, 3 coturi, 10 carcase" /></label>
            <label>Material<select name="articol">${[...tabla, ...restul].map((x) =>
              `<option value="${esc(x.cheie)}">${esc(numeArticol(x))}</option>`).join("")}
              <option value="__tabla"${tabla.length ? "" : " selected"}>Tablă aluminiu 0,8 mm (m²)</option></select></label>
            <label>Cantitate (m² la tablă, ml la tub)<input name="cantitate" type="number" inputmode="decimal" step="any" min="0" required /></label>
            <label>Din depozitul<select name="din">${LOCURI.filter((l) => l.id !== ATELIER && deschis()(l.id)).map((l) =>
              `<option value="${esc(l.id)}"${l.id === CENTRAL ? " selected" : ""}>${esc(l.nume)}</option>`).join("")}</select></label>
            ${eroareAtelier ? `<p class="alerta" role="alert">${esc(eroareAtelier)}</p>` : ""}
            <div class="imp-formular-butoane"><button type="submit" class="primar">Trece în atelier</button></div>
          </form>
        </details>
      </section>`;
    }

    /** Drumul unui material spre un șantier: furnizor, central, atelier, șantier (gata când-ul Fazei 5). */
    function sectiuneDrum(): string {
      const materiale = materialeDeBaza(st).filter((a) => st.miscari.some((m) => articolDin(m.articol).cheie === a.cheie));
      if (materiale.length === 0) return "";
      const sant = santiere();
      // Implicit: materialul și șantierul ultimei mișcări care ajunge pe un șantier.
      const ultima = [...st.miscari].reverse().find((m) => sant.some((x) => [m.lucrareId, m.spre, m.din].includes(x.id)));
      if (!materiale.some((a) => a.cheie === drumMaterial)) {
        drumMaterial = ultima ? articolDin(ultima.articol).cheie : materiale[0]!.cheie;
      }
      if (!sant.some((x) => x.id === drumSantier)) {
        drumSantier = sant.find((x) => ultima && [ultima.lucrareId, ultima.spre, ultima.din].includes(x.id))?.id ?? sant[0]?.id ?? "";
      }
      const pasi = drumSantier ? drumul(st.miscari, drumMaterial, drumSantier) : [];
      const art = materiale.find((a) => a.cheie === drumMaterial)!;
      const nume = (id: string): string => (DEPOZITE.some((d) => d.id === id) ? numeDepozit(id) : id);
      const randuri = pasi.map((p) => {
        const firme = intreFirme(p.miscare, LOCURI);
        return `<tr>
          <td class="fix">${esc(new Date(p.data).toLocaleDateString("ro-RO"))}</td>
          <td>${esc(nume(p.din))} → ${esc(nume(p.spre))}${firme ? ` ${stare("între firme", "atentie")}` : ""}${
            p.miscare.nota ? `<br><span class="hint">${esc(p.miscare.nota)}</span>` : ""}</td>
          <td class="n">${cantitate(p.cantitate, p.miscare.articol.um)}</td>
        </tr>`;
      });
      return `<section class="imp-card"><h2>Drumul materialului</h2>
        <p class="hint" style="margin:0 0 12px">De unde a venit un material și pe unde a trecut până pe șantier: furnizor, depozit, atelier, șantier.</p>
        <div class="imp-campuri">
          <label>Material<select data-act="drum-material">${materiale.map((a) =>
            `<option value="${esc(a.cheie)}"${a.cheie === drumMaterial ? " selected" : ""}>${esc(numeArticol(a))}</option>`).join("")}</select></label>
          <label>Șantierul<select data-act="drum-santier">${sant.map((s) =>
            `<option value="${esc(s.id)}"${s.id === drumSantier ? " selected" : ""}>${esc(s.denumire)}</option>`).join("")}</select></label>
        </div>
        ${pasi.length ? tabel(["Data", "Drumul", "Cantitate"], randuri, ["", "", "n"])
          : `<p class="hint" style="margin:12px 0 0">${esc(numeArticol(art))} n-a ajuns încă pe acest șantier.</p>`}
      </section>`;
    }

    /** Locurile: firma fiecăruia și cine răspunde de material (S34, S46). */
    function sectiuneLocuri(sold: ReturnType<typeof solduri>): string {
      const randuri = LOCURI.map((l) => `<tr>
        <td>${esc(l.nume)}</td>
        <td>${esc(l.firma)}</td>
        <td><input data-act="responsabil" data-id="${esc(l.id)}" value="${esc(l.responsabil ?? "")}" autocomplete="off"
          placeholder="${l.tip === "santier" ? "șeful de șantier" : "cine răspunde"}" aria-label="Responsabil ${esc(l.nume)}" /></td>
        <td class="n">${cifra(new Set(sold.filter((x) => x.depozit === l.id && x.cantitate > 0).map((x) => x.articol.cheie)).size)}</td>
        <td class="fix">${l.tip === "santier"
          ? `<button type="button" class="secundar" data-act="evidenta-santier" data-id="${esc(l.id)}">Descarcă evidența</button>` : ""}</td>
      </tr>`);
      return `<section class="imp-card"><h2>Locurile</h2>
        <p class="hint" style="margin:0 0 12px">Unde stă materialul și cine răspunde de el. Stocul e separat pe firme; un transfer
          între depozitele a două firme apare în jurnal ca „între firme”. „Descarcă evidența” dă Excelul materialului de pe un
          șantier, cu coloanele evidenței voastre, cât timp o mai țineți și separat.</p>
        ${tabel(["Loc", "Firma", "Responsabil", "Materiale", ""], randuri, ["", "", "", "n", ""])}
      </section>`;
    }

    function formularMiscare(): string {
      const articole = articoleCunoscute(st);
      const alegeDepozit = (nume: string, eticheta: string): string => `<label data-camp="${nume}">${eticheta}
        <select name="${nume}"><option value="">— alege —</option>${LOCURI.filter((d) => deschis()(d.id)).map((d) =>
          `<option value="${esc(d.id)}" data-loc="${d.tip}">${esc(d.nume)}</option>`).join("")}</select></label>`;
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
          <label data-camp="alt">Formă
            <select name="forma"><option value="">după diametru (tub; fără ø: saltea de vată, placă de elastomer, tablă)</option>
                <option value="saltea">saltea de vată, m²</option><option value="placa">placă, m²</option></select></label>
          <label data-camp="pret">Marcă (opțional: Armaflex, K-Flex, Rockwool …)
            <input name="marca" autocomplete="off" /></label>
          <label>Cantitate
            <input name="cantitate" type="number" inputmode="decimal" step="any" min="0" required /></label>
          ${alegeDepozit("din", "Din depozitul")}
          ${alegeDepozit("spre", "În depozitul")}
          <label data-camp="pret">Preț de achiziție pe unitate, în euro (<span data-camp="pret-intrare">de pe factură; gol = fără preț</span><span
            data-camp="pret-pornire">gol = ultimul preț cumpărat, din evidență</span>)
            <input name="pret" type="number" inputmode="decimal" step="any" min="0" /></label>
          <label>Notă (furnizor, factură, cine a luat materialul)
            <input name="nota" autocomplete="off" /></label>
        </div>
        <p class="hint" data-camp="pornire" style="margin:12px 0 0">Material care era deja în depozitul central sau în atelier când ați
          început cu aplicația, sau care se întoarce de pe un șantier început înainte de ea. În aplicație intră doar șantierele noi,
          care pornesc fără material, deci aici nu se aleg. Nu intră în evidența cumpărărilor.</p>
        <p class="imp-oferta-lipsa" data-camp="firme" hidden></p>
        ${eroare ? `<p class="alerta" role="alert" style="margin-top:16px">${esc(eroare)}</p>` : ""}
        <div class="imp-formular-butoane"><button type="submit" class="primar">Înregistrează</button></div>
      </form>`;
    }

    function jurnal(): string {
      if (st.miscari.length === 0) return "";
      const randuri = [...st.miscari].reverse().map((m) => {
        const anulata = esteAnulata(m, st.miscari);
        const traseu = [m.din, m.spre].filter(Boolean).map((d) => esc(numeDepozit(d))).join(" → ");
        const firme = intreFirme(m, LOCURI);
        const eticheta = [
          m.anuleaza ? stare("anulare", "neutru") : anulata ? stare("anulată", "neutru") : "",
          firme ? stare("între firme", "atentie") : "",
        ].join(" ");
        const pentru = m.lucrareId && m.spre === ATELIER ? ` · pentru ${esc(numeDepozit(m.lucrareId))}` : "";
        return `<tr>
          <td class="fix">${esc(new Date(m.data).toLocaleDateString("ro-RO"))}</td>
          <td>${estePornire(m) ? "Stoc de pornire" : esc(TIP[m.tip])} ${eticheta} ${m.exemplu ? stare("exemplu", "atentie") : ""}
            <br><span class="hint">${esc(numeArticol(m.articol))}${pentru}${
              m.motiv && m.motiv !== MOTIV_PORNIRE ? ` · motiv: ${esc(m.motiv)}` : ""}${m.nota && !m.exemplu ? ` · ${esc(m.nota)}` : ""}${
              firme ? ` · ${esc(firme.din)} → ${esc(firme.spre)}` : ""}${
              m.pret ? ` · ${eur(m.pret.valoare)} / ${unitate(m.articol.um)}` : ""}</span></td>
          <td class="n">${m.anuleaza ? "−" : ""}${m.tip === "ajustare" && m.cantitate > 0 ? "+" : ""}${cantitate(m.cantitate, m.articol.um)}<br><span class="hint">${traseu}</span></td>
          <td class="fix">${!m.anuleaza && !anulata && !m.situatieId
            ? `<button type="button" class="secundar" data-act="storno" data-id="${esc(m.id)}">Anulează</button>` : ""}</td>
        </tr>`;
      });
      return `<section class="imp-card"><h2>Jurnalul mișcărilor</h2>
        <p class="hint" style="margin:0 0 12px">Nimic din jurnal nu se șterge. „Anulează” adaugă un rând care o anulează pe cea greșită, ca să se vadă ce s-a întâmplat. Consumul scris de o situație de lucrări se anulează ștergând situația, în Lucrări.</p>
        ${tabel(["Data", "Mișcare", "Cantitate", ""], randuri, ["", "", "n", ""])}
      </section>`;
    }

    /** Formularul arată doar depozitele cerute de tipul ales și câmpurile de material nou. */
    function arataDepozitele(): void {
      const f = root.querySelector<HTMLFormElement>("#miscare");
      if (!f) return;
      const tip = (f.elements.namedItem("tip") as HTMLSelectElement).value as TipFormular;
      const pornire = tip === "pornire";
      f.querySelector<HTMLElement>('[data-camp="din"]')!.hidden = !cere(tip).din;
      f.querySelector<HTMLElement>('[data-camp="spre"]')!.hidden = !cere(tip).spre;
      const alt = (f.elements.namedItem("articol") as HTMLSelectElement).value === "__alt";
      for (const el of f.querySelectorAll<HTMLElement>('[data-camp="alt"]')) el.hidden = !alt;
      for (const el of f.querySelectorAll<HTMLElement>('[data-camp="pret"]')) el.hidden = tip !== "intrare" && !pornire;
      f.querySelector<HTMLElement>('[data-camp="pret-intrare"]')!.hidden = pornire;
      f.querySelector<HTMLElement>('[data-camp="pret-pornire"]')!.hidden = !pornire;
      f.querySelector<HTMLElement>('[data-camp="pornire"]')!.hidden = !pornire;
      // Valorile implicite ale fiecarui tip: intrarea vine in centralul, returul pleaca spre el.
      const spre = f.elements.namedItem("spre") as HTMLSelectElement;
      // Stocul de pornire nu se trece pe santiere (S48: santierele noi pornesc goale).
      for (const o of spre.options) if (o.dataset["loc"] === "santier") o.hidden = o.disabled = pornire;
      if (pornire && !LOCURI_PORNIRE.includes(spre.value)) spre.value = CENTRAL;
      if (!spre.value && (tip === "intrare" || tip === "retur")) spre.value = CENTRAL;
      const din = f.elements.namedItem("din") as HTMLSelectElement;
      if (!din.value && tip === "transfer") din.value = CENTRAL;
      // Între firme (S46: „se mai amestecă”): se spune înainte de înregistrare, nu doar în jurnal.
      const firme = pornire ? null : intreFirme({ tip, din: din.value, spre: spre.value }, LOCURI);
      const aviz = f.querySelector<HTMLElement>('[data-camp="firme"]')!;
      aviz.hidden = !firme || !cere(tip).din || !cere(tip).spre;
      aviz.textContent = firme ? `Transfer între firme: din stocul ${firme.din} în stocul ${firme.spre}. Așa apare și în jurnal.` : "";
    }

    function inregistreaza(f: HTMLFormElement): void {
      const date = new FormData(f);
      const val = (n: string): string => ((date.get(n) as string | null) ?? "").trim();
      const tip = val("tip") as TipFormular;
      let articol = articoleCunoscute(st).find((a) => a.cheie === val("articol"));
      if (val("articol") === "__alt" || !articol) {
        const g = val("grosime") === "" ? null : Number(val("grosime").replace(",", "."));
        const r = val("rand") === "" ? null : Number(val("rand"));
        const forma = formaAleasa(val("forma"), r);
        articol = articolDin({ sistem: val("sistem"), grosime_mm: g, rand: r, ...(forma ? { forma } : {}) });
      }
      // Marca se scrie la intrare: de acolo materialul are producătorul lui.
      if ((tip === "intrare" || tip === "pornire") && val("marca")) articol = articolDin(articol, val("marca"));
      tipAles = tip;
      if (tip === "pornire") {
        const problema = treceStocDePornire({
          depozit: val("spre"), articol, cantitate: Number(val("cantitate").replace(",", ".")),
          ...(val("pret") !== "" ? { pret: Number(val("pret").replace(",", ".")) } : {}),
          ...(val("nota") ? { nota: val("nota") } : {}),
        });
        eroare = problema ?? "";
        if (!problema) st = citesteDepozit();
        deseneaza();
        return;
      }
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
      if (problema) { eroare = problema; deseneaza(); return; }
      eroare = "";
      st = { ...st, miscari: [...st.miscari, { ...noua, id: idNou(), data: new Date().toISOString() }] };
      salveaza();
      deseneaza();
    }

    // Necesarul se scrie în tabel, ca în Excel (15 octombrie 2026).
    legaCelule(root, {
      scrie: (el) => {
        if (el.dataset["ed"] !== "nec") return false;
        const q = numarScris((el as HTMLInputElement).value);
        const i = Number(el.dataset["i"]);
        const n = st.necesare.find((x) => x.id === el.dataset["id"]);
        const m = n?.materiale[i];
        if (!n || !m || q === null || q < 0) return false;
        const acum = cantitateNecesara(m);
        if (Math.abs(q - acum) < 0.005) return false;
        const calculat = m.manual ? undefined : m.calculat ?? acum;
        const nou = cuCantitatea(m, q);
        // Scrisă la loc cifra calculată, rândul nu mai e schimbat.
        const { calculat: _c, ...fara } = nou;
        const material: MaterialNecesar = calculat === undefined || Math.abs(calculat - q) < 0.005 ? fara : { ...fara, calculat };
        st = { ...st, necesare: st.necesare.map((x) => (x === n
          ? { ...n, materiale: n.materiale.map((y, j) => (j === i ? material : y)) } : x)) };
        salveaza();
        return true;
      },
      deseneaza,
      desenari: () => desenari,
    });

    root.addEventListener("click", (e) => {
      const sari = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-sari]");
      if (sari) {
        const tinta = root.querySelector<HTMLElement>(`#${sari.dataset["sari"]}`);
        tinta?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
        tinta?.querySelector<HTMLElement>("h2, summary")?.setAttribute("tabindex", "-1");
        tinta?.querySelector<HTMLElement>("h2, summary")?.focus({ preventScroll: true });
        return;
      }
      const t = e.target as HTMLElement;
      const bDep = t.closest<HTMLButtonElement>("[data-depozit]");
      if (bDep) { depozit = bDep.dataset["depozit"]!; deseneaza(); return; }
      const b = t.closest<HTMLButtonElement>("button[data-act]");
      if (!b) return;
      if (b.dataset["act"] === "evidenta-santier") { void descarcaEvidenta(b.dataset["id"]!); return; }
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
        case "atelier-trimite": {
          const a = inAtelier(st.miscari).find((x) => x.articol.cheie === b.dataset["cheie"] && x.pentru === b.dataset["pentru"]);
          if (!a || !a.pentru) return;
          st = { ...st, miscari: [...st.miscari, {
            id: idNou(), data: new Date().toISOString(), tip: "transfer", articol: a.articol, cantitate: a.cantitate,
            din: ATELIER, spre: a.pentru, lucrareId: a.pentru, nota: a.cereri.length ? `din atelier: ${a.cereri.join(" · ")}` : "din atelier",
          }] };
          break;
        }
        case "transfer": {
          const n = st.necesare.find((x) => x.id === b.dataset["id"]);
          const m = n?.materiale[Number(b.dataset["i"])];
          const q = Number(b.dataset["q"]);
          if (!n || !m || !(q > 0)) return;
          st = { ...st, miscari: [...st.miscari, {
            id: idNou(), data: new Date().toISOString(), tip: "transfer", articol: articolDin(m), cantitate: q,
            din: b.dataset["din"]!, spre: depozitNecesar(n), nota: `pentru ${titluNecesar(n)}`,
          }] };
          break;
        }
        case "fa-comenzi": {
          const n = st.necesare.find((x) => x.id === b.dataset["id"]);
          if (!n) return;
          const firma = citestePlanuri().find((p) => p.id === n.santier)?.firma ?? "RADOIA ISOLIRUNG SRL";
          const ciorne = ciorneDinRamas(ramasPeNecesar(st, n),
            { firma, spre: depozitNecesar(n), ...(n.santier ? { santier: n.santier } : {}) }, idNou, new Date().toISOString(),
            (a, f) => pretPropus(a, f, st.miscari));
          for (const c of ciorne) puneComanda(c);
          location.hash = "#/comenzi";
          return;
        }
        case "scoate-rand": {
          const i = Number(b.dataset["i"]);
          st = { ...st, necesare: st.necesare.map((n) => {
            if (n.id !== b.dataset["id"]) return n;
            const m = n.materiale[i];
            if (!m) return n;
            // Materialul calculat se poate pune la loc cu „Anulează modificările”; cel de mână, nu.
            return { ...n, materiale: n.materiale.filter((_, j) => j !== i), ...(m.manual ? {} : { scoase: [...(n.scoase ?? []), m] }) };
          }) };
          break;
        }
        case "anuleaza-necesar": {
          st = { ...st, necesare: st.necesare.map((n) => {
            if (n.id !== b.dataset["id"]) return n;
            const { scoase, ...rest } = n;
            const materiale = n.materiale.map((m) => {
              if (m.calculat === undefined) return m;
              const { calculat: _c, ...inapoi } = cuCantitatea(m, m.calculat);
              return inapoi;
            });
            // Calculatele la locul lor din necesar; cele adăugate de mână rămân la coadă, în ordinea lor.
            const calculate = [...materiale.filter((m) => !m.manual), ...(scoase ?? [])].sort(ordineNecesar);
            return { ...rest, materiale: [...calculate, ...materiale.filter((m) => m.manual)] };
          }) };
          break;
        }
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
      if (t.dataset["act"] === "inventar-loc") { invLoc = t.value; eroareInventar = ""; mesajInventar = ""; deseneaza(); return; }
      if (t.name === "motiv" && t.form?.dataset["form"] === "inventar") {
        t.form.querySelector<HTMLElement>('[data-camp="motiv-alt"]')!.hidden = t.value !== "__alt";
        return;
      }
      if (t.dataset["act"] === "drum-material") { drumMaterial = t.value; deseneaza(); return; }
      if (t.dataset["act"] === "drum-santier") { drumSantier = t.value; deseneaza(); return; }
      if (t.dataset["act"] === "responsabil") {
        const id = t.dataset["id"]!;
        const { [id]: _v, ...rest } = st.responsabili ?? {};
        st = { ...st, responsabili: t.value.trim() ? { ...rest, [id]: t.value.trim() } : rest };
        salveaza();
        return;
      }
      if (t.name === "tip" || t.name === "articol" || t.name === "din" || t.name === "spre") arataDepozitele();
      if (t.name === "tip") tipAles = t.value as TipFormular;
    });

    // Inventarul: diferența se vede pe loc, fără redesenare (s-ar pierde ce s-a scris).
    root.addEventListener("input", (e) => {
      const t = e.target as HTMLInputElement;
      if (t.name !== "numarat") return;
      const cell = t.closest("tr")?.querySelector<HTMLElement>("[data-dif]");
      if (!cell) return;
      const v = Number(t.value.replace(",", "."));
      if (t.value.trim() === "" || !Number.isFinite(v)) { cell.textContent = "—"; return; }
      const dif = Math.round((v - Number(t.dataset["arata"])) * 100) / 100;
      cell.textContent = dif === 0 ? "la fel" : `${dif > 0 ? "+" : "−"}${cantitate(Math.abs(dif), t.dataset["um"] as Articol["um"])}`;
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
        const forma = formaAleasa(val("forma"), numar("rand"));
        const m = materialManual(val("sistem"), numar("grosime"), numar("rand"), cant, val("motiv"), ...(forma ? [forma] : []));
        st = { ...st, necesare: st.necesare.map((n) => (n.id === f.dataset["id"] ? { ...n, materiale: [...n.materiale, m] } : n)) };
        salveaza();
        deseneaza();
      }
      if (f.dataset["form"] === "atelier") {
        const cant = numar("cantitate");
        const pentru = val("pentru");
        let articol = articoleCunoscute(st).find((a) => a.cheie === val("articol"));
        if (!articol) articol = articolDin({ sistem: "tabla", grosime_mm: 0.8, rand: null });
        const noua: Omit<Miscare, "id" | "data"> = {
          tip: "transfer", articol, cantitate: cant ?? 0, din: val("din"), spre: ATELIER, lucrareId: pentru, nota: val("cerere"),
        };
        const problema = !pentru ? "Alege șantierul pentru care se croiește." : valideazaMiscare(noua);
        if (problema) { eroareAtelier = problema; deseneaza(); return; }
        eroareAtelier = "";
        st = { ...st, miscari: [...st.miscari, { ...noua, id: idNou(), data: new Date().toISOString() }] };
        salveaza();
        deseneaza();
      }
      if (f.dataset["form"] === "inventar") {
        const sold = solduri(st.miscari);
        const numarat: LinieNumarata[] = [];
        for (const inp of f.querySelectorAll<HTMLInputElement>('input[name="numarat"]')) {
          const a = sold.find((x) => x.depozit === invLoc && x.articol.cheie === inp.dataset["cheie"])?.articol;
          if (a && inp.value.trim() !== "") numarat.push({ articol: a, cantitate: Number(inp.value.replace(",", ".")) });
        }
        const alt = articoleCunoscute(st).find((a) => a.cheie === val("alt"));
        if (alt && numar("altCant") !== null) numarat.push({ articol: alt, cantitate: numar("altCant")! });
        const inainte = st.miscari;
        const r = inregistreazaInventar({
          depozit: invLoc, numarat, motiv: val("motiv") === "__alt" ? val("motivAlt") : val("motiv"),
          ...(val("cine") ? { nota: `numărat de ${val("cine")}` } : {}),
        });
        if (typeof r === "string") { eroareInventar = r; mesajInventar = ""; deseneaza(); return; }
        const z = rezumatInventar(inainte, { depozit: invLoc, numarat }, r.ajustari);
        eroareInventar = "";
        mesajInventar = [
          z.ajustate === 0 ? "Ce ai numărat e la fel cu ce arată aplicația: nicio ajustare."
            : `${z.ajustate === 1 ? "o ajustare" : cate(z.ajustate, "ajustări")} în jurnal.`,
          z.laFel > 0 && z.ajustate > 0 ? `${z.laFel === 1 ? "Un material" : cate(z.laFel, "materiale")} la fel ca în aplicație.` : "",
          z.nenumarate > 0 ? (z.nenumarate === 1 ? "Un material nenumărat a rămas cum era." : `${cate(z.nenumarate, "materiale")} nenumărate au rămas cum erau.`) : "",
        ].filter(Boolean).join(" ").replace(/^o /, "O ");
        st = citesteDepozit();
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
