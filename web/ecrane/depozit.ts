/**
 * Materiale · Depozit (21 octombrie 2026).
 *
 * O singură întrebare: ce avem și unde? Alegi locul (depozitul central,
 * atelierul, un șantier), vezi ce e acolo, iar „Mută material” trece ce scrii
 * în dreptul fiecărui material în alt loc. Ce vine de la furnizor intră din
 * Comenzi, la „A venit marfa”.
 *
 * Ce se face rar stă sub „Mai multe”, fiecare pe pagina lui (`#/depozit/<ce>`),
 * neschimbat față de vechiul „Necesar și depozit”: am numărat (inventarul),
 * trecut de mână (stocul de pornire și restul mișcărilor), istoricul (jurnalul
 * și drumul materialului), atelierul, locurile, ambalajele.
 *
 * Stocul e suma mișcărilor (`src/stoc/registru.ts`): nimic nu se scrie peste o
 * cifră, iar o greșeală se anulează cu o mișcare inversă, vizibilă în istoric.
 */
import { cate, esc, eur, stare, tabel, type Ecran } from "./tip.js";
import { citestePlanuri, citesteDepozit, idNou, inregistreazaInventar, modDate, scrieDepozit, treceStocDePornire } from "../date.js";
import { descarca } from "../descarca.js";
import { evidentaSantier, registruEvidentaSantier } from "../evidenta-santier.js";
import { MATERIALE, MATERIAL } from "../import/text.js";
import { cantitate, cifra, fileMateriale, numeArticol, unitate } from "../stoc-vizual.js";
import {
  CENTRAL, articoleCunoscute, depozite, deschis, locurile, materialeDeBaza, numereMateriale, santiere,
} from "../materiale.js";
import {
  CERE, articolDin, esteAnulata, faraExemple, miscariDeExemplu, solduri, storno, valideazaMiscare,
  type Ambalaj, type Articol, type Miscare, type TipMiscare,
} from "../../src/stoc/registru.js";
import type { Categorie } from "../../src/stoc/necesar.js";
import { ATELIER, drumul, inAtelier, intreFirme } from "../../src/stoc/locuri.js";
import {
  LOCURI_PORNIRE, MOTIVE_INVENTAR, MOTIV_PORNIRE, estePornire, rezumatInventar, type LinieNumarata,
} from "../../src/stoc/inventar.js";

/** Forma aleasa in formular; cu ø ramane tub, fara alegere ramane cea implicita. */
const formaAleasa = (v: string, rand: number | null): Categorie | undefined =>
  rand === null && (v === "saltea" || v === "placa") ? v : undefined;

/** Ambalajele uzuale (S13): tuburile în cutii, vata în saci sau pachete, tabla la kg. */
const UNITATI_AMBALAJ = ["cutie", "sac", "pachet", "rolă", "coală", "kg"];

/**
 * Ce se poate alege în „Trecut de mână”. Ajustarea nu: o face „Am numărat”,
 * cu motiv (S45). Stocul de pornire e o intrare marcată (Faza 8).
 */
type TipFormular = Exclude<TipMiscare, "ajustare"> | "pornire";
const TIPURI: [TipFormular, string][] = [
  ["pornire", "Era deja în depozit (stoc de pornire)"],
  ["intrare", "Intrare de la furnizor, fără comandă"],
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

/** Paginile de sub „Mai multe”: adresa, titlul și ce se face acolo, într-o propoziție. */
const MAI_MULTE: [string, string, string][] = [
  ["numarat", "Am numărat", "Scrii ce ai găsit într-un loc; aplicația trece diferențele, cu motivul."],
  ["de-mana", "Trecut de mână", "Materialul de dinainte de aplicație (o dată, la început), o intrare fără comandă, un consum sau un retur."],
  ["istoric", "Istoricul", "Tot ce s-a mișcat, cu „Anulează”, și drumul unui material până pe șantier."],
  ["atelier", "Pus deoparte în atelier", "Tabla trecută în atelier pentru un șantier, până pleacă."],
  ["locuri", "Cine răspunde de fiecare loc", "Numele omului pe depozit, atelier și șantier; evidența unui șantier în Excel."],
  ["ambalaje", "Ambalaje", "Cât are o rolă sau o cutie, ca să se comande la ambalaj întreg."],
];

/** Pagina din adresă: `#/depozit/istoric` → „istoric”; fără, lista. */
const paginaDinAdresa = (): string => location.hash.replace(/^#\/?/, "").split("/")[1] ?? "";

export const ecran: Ecran = {
  id: "depozit",
  titlu: "Materiale",

  render(root) {
    let st = citesteDepozit();
    let pastrat = true;
    let eroare = "";
    const pagina = paginaDinAdresa();
    /** Locul ales sus; „Mută material” deschis, cu locul în care pleacă. */
    let loc = CENTRAL;
    let muta = false;
    let spre = "";
    let eroareMuta = "";
    let mesajMuta = "";
    // Cu depozitul gol, primul lucru e stocul de pornire (Faza 8).
    let tipAles: TipFormular = st.miscari.length === 0 ? "pornire" : "intrare";
    /** „Am numărat”: locul numărat și ce s-a întâmplat la ultima trecere. */
    let invLoc = CENTRAL;
    let eroareInventar = "";
    let mesajInventar = "";
    let DEPOZITE = depozite();
    let LOCURI = locurile();
    /** „Istoricul”: materialul și șantierul alese pentru drum. */
    let drumMaterial = "";
    let drumSantier = "";
    let eroareAtelier = "";
    const numeDepozit = (id?: string): string => DEPOZITE.find((d) => d.id === id)?.nume ?? "—";

    const salveaza = (): void => { pastrat = scrieDepozit(st); };

    function deseneaza(): void {
      DEPOZITE = depozite();
      LOCURI = locurile();
      const sold = solduri(st.miscari);
      const corp = pagina === "" ? principala(sold)
        : pagina === "mai-multe" ? maiMulte()
        : `<p style="margin:0"><a href="#/depozit/mai-multe">‹ Înapoi la Mai multe</a></p>${
          pagina === "numarat" ? sectiuneInventar(sold)
          : pagina === "de-mana" ? formularMiscare()
          : pagina === "istoric" ? `${jurnal() || `<section class="imp-card"><p class="hint" style="margin:0">Nimic mișcat încă.</p></section>`}${sectiuneDrum()}`
          : pagina === "atelier" ? sectiuneAtelier()
          : pagina === "locuri" ? sectiuneLocuri(sold)
          : pagina === "ambalaje" ? sectiuneAmbalaje() || `<section class="imp-card"><p class="hint" style="margin:0">Niciun material încă.</p></section>`
          : `<section class="imp-card"><p class="hint" style="margin:0">Pagina asta nu există.</p></section>`}`;
      root.innerHTML = `<div class="imp">
        ${fileMateriale("depozit", numereMateriale(st))}
        ${corp}
      </div>`;
      if (pagina === "de-mana") arataDepozitele();
    }

    /** Lista de sub „Mai multe”: o propoziție și „Deschide” pe fiecare. */
    function maiMulte(): string {
      return `<p style="margin:0"><a href="#/depozit">‹ Înapoi la Depozit</a></p>
        <section class="imp-card mat-mai-multe"><h2>Mai multe</h2>
          ${MAI_MULTE.map(([id, titlu, ce]) => `<div class="mat-rand-mai">
            <div><strong>${esc(titlu)}</strong><p class="hint">${esc(ce)}</p></div>
            <a class="secundar" href="#/depozit/${id}">Deschide</a>
          </div>`).join("")}
        </section>`;
    }

    /**
     * Ce e într-un loc. În atelier, tabla pusă deoparte pentru un șantier, cu
     * „Trimite pe șantier”. Cu „Mută material”, o coloană în plus: cât pleacă.
     */
    function principala(sold: ReturnType<typeof solduri>): string {
      const eDeschis = deschis();
      const cuMaterial = (id: string): number => new Set(sold.filter((x) => x.depozit === id && x.cantitate !== 0).map((x) => x.articol.cheie)).size;
      const alese = LOCURI.filter((l) => l.id === CENTRAL || (eDeschis(l.id) && cuMaterial(l.id) > 0) || l.id === loc);
      if (!alese.some((l) => l.id === loc)) loc = CENTRAL;
      const aici = sold.filter((x) => x.depozit === loc && x.cantitate !== 0)
        .sort((a, b) => numeArticol(a.articol).localeCompare(numeArticol(b.articol), "ro"));
      const pastile = `<div class="filtre" role="group" aria-label="Locul">${alese.map((l) =>
        `<button type="button" class="filtru" data-loc="${esc(l.id)}" aria-pressed="${l.id === loc}">${esc(l.nume)} · ${cifra(cuMaterial(l.id))}</button>`).join("")}</div>`;
      const poateMuta = aici.some((x) => x.cantitate > 0) && eDeschis(loc);
      const unde = LOCURI.filter((l) => l.id !== loc && eDeschis(l.id));
      if (muta && !unde.some((l) => l.id === spre)) spre = unde[0]?.id ?? "";
      const firme = muta && spre ? intreFirme({ tip: "transfer", din: loc, spre }, LOCURI) : null;

      let continut: string;
      if (loc === ATELIER && !muta) continut = tabelAtelier();
      else if (aici.length === 0) {
        continut = `<p class="hint" style="margin:0">În ${esc(numeDepozit(loc))} nu e nimic acum.${loc === CENTRAL
          ? ` Dacă e material de dinainte de aplicație, trece-l la <a href="#/depozit/de-mana">Mai multe › Trecut de mână</a>.` : ""}</p>`;
      } else {
        const randuri = aici.map((x) => `<tr>
          <td>${esc(numeArticol(x.articol))}</td>
          <td class="n">${x.negativ ? `${stare("sub zero", "atentie")} ` : ""}${cantitate(x.cantitate, x.articol.um)}</td>
          ${muta ? `<td class="n">${x.cantitate > 0 ? `<span class="cel-cu-um"><input name="q-${esc(x.articol.cheie)}" type="number" inputmode="decimal" step="any" min="0"
            max="${x.cantitate}" aria-label="Cât muți: ${esc(numeArticol(x.articol))}" /><span class="hint">${unitate(x.articol.um)}</span></span>` : ""}</td>` : ""}
        </tr>`);
        continut = tabel(["Material", "Cât e", ...(muta ? ["Cât muți"] : [])], randuri, ["", "n", ...(muta ? ["n"] : [])]);
      }
      return `<section class="imp-card">
        <form data-form="muta">
          <div class="mat-antet">
            ${pastile}
            ${poateMuta && !muta ? `<div class="mat-actiuni"><button type="button" class="primar" data-act="muta">Mută material</button></div>` : ""}
          </div>
          ${muta ? `<div class="imp-campuri">
            <label>Unde muți, din ${esc(numeDepozit(loc))}<select name="spre" data-act="spre">${unde.map((l) =>
              `<option value="${esc(l.id)}"${l.id === spre ? " selected" : ""}>${esc(l.nume)}</option>`).join("")}</select></label>
          </div>
          ${firme ? `<p class="imp-oferta-lipsa">Între firme: din stocul ${esc(firme.din)} în stocul ${esc(firme.spre)}. Așa apare și în istoric.</p>` : ""}
          <p class="hint" style="margin:8px 0 0">Scrie cât pleacă în dreptul fiecărui material; ce lași gol rămâne pe loc.</p>` : ""}
          ${continut}
          ${eroareMuta ? `<p class="alerta" role="alert">${esc(eroareMuta)}</p>` : ""}
          ${mesajMuta ? `<p class="hint" role="status">${stare("Mutat", "ok")} ${esc(mesajMuta)}</p>` : ""}
          ${muta ? `<div class="imp-formular-butoane">
            <button type="submit" class="primar">Mută</button>
            <button type="button" class="secundar" data-act="renunta-muta">Renunță</button>
          </div>` : ""}
        </form>
      </section>
      ${banner()}
      <p style="margin:0"><a href="#/depozit/mai-multe">› Mai multe: am numărat, trecut de mână, istoricul, atelierul, cine răspunde, ambalaje</a></p>`;
    }

    /** Ce e în atelier, pe șantier: „Trimite pe șantier” pleacă tot ce e pus deoparte pentru el. */
    function tabelAtelier(): string {
      const a = inAtelier(st.miscari);
      if (a.length === 0) return `<p class="hint" style="margin:0">În atelier nu e nimic acum.</p>`;
      return tabel(["Pentru", "Material", "Cât e", "Ce se face", ""], a.map((x) => `<tr>
        <td>${x.pentru ? esc(numeDepozit(x.pentru)) : stare("liberă", "neutru")}</td>
        <td>${esc(numeArticol(x.articol))}</td>
        <td class="n">${cantitate(x.cantitate, x.articol.um)}</td>
        <td>${x.cereri.length ? esc(x.cereri.join(" · ")) : "—"}</td>
        <td class="fix">${x.pentru
          ? `<button type="button" class="secundar" data-act="atelier-trimite" data-cheie="${esc(x.articol.cheie)}"
              data-pentru="${esc(x.pentru)}" data-q="${x.cantitate}">Trimite pe șantier</button>` : ""}</td>
      </tr>`), ["", "", "n", "", ""]);
    }

    /** Pe linkul demo: datele stau doar în browser, iar stocul de exemplu se pune și se scoate. */
    function banner(): string {
      if (modDate() === "server") return "";
      const cuExemple = st.miscari.some((m) => m.exemplu);
      return `<section class="imp-card">
        <p class="hint" style="margin:0">Deocamdată datele de aici se păstrează doar pe acest calculator, în acest browser.${
          pastrat ? "" : " <strong>Browserul nu permite salvarea: datele se pierd la reîncărcare.</strong>"}</p>
        ${cuExemple ? `<p style="margin:12px 0 0">${stare("Date de exemplu", "atentie")} Intrările marcate „exemplu” nu sunt stocuri reale.</p>
          <div class="imp-formular-butoane"><button type="button" class="secundar" data-act="scoate-exemple">Scoate datele de exemplu</button></div>`
        : `<div class="imp-formular-butoane"><button type="button" class="secundar" data-act="exemple">Încarcă date de exemplu</button></div>`}
      </section>`;
    }

    /** „Mută material”: un transfer pe fiecare material cu cantitate scrisă. */
    function mutaMaterial(f: HTMLFormElement): void {
      const sold = solduri(st.miscari);
      const destinatie = (new FormData(f).get("spre") as string | null) ?? "";
      const acum = new Date().toISOString();
      const noi: Miscare[] = [];
      for (const inp of f.querySelectorAll<HTMLInputElement>('input[name^="q-"]')) {
        if (inp.value.trim() === "") continue;
        const q = Number(inp.value.replace(",", "."));
        const x = sold.find((y) => y.depozit === loc && y.articol.cheie === inp.name.slice(2));
        if (!x) continue;
        if (!(q > 0) || q > x.cantitate + 1e-9) {
          eroareMuta = `${numeArticol(x.articol)}: se poate muta între 0 și ${cantitate(x.cantitate, x.articol.um)}.`;
          deseneaza();
          return;
        }
        noi.push({ id: idNou(), data: acum, tip: "transfer", articol: x.articol, cantitate: q, din: loc, spre: destinatie,
          nota: `mutat din ${numeDepozit(loc)}` });
      }
      if (!destinatie || noi.length === 0) { eroareMuta = "Scrie cât muți la cel puțin un material."; deseneaza(); return; }
      st = { ...st, miscari: [...st.miscari, ...noi] };
      salveaza();
      eroareMuta = "";
      mesajMuta = `${noi.length === 1 ? "Un material" : cate(noi.length, "materiale")} în ${numeDepozit(destinatie)}.`;
      muta = false;
      deseneaza();
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
      return `<section class="imp-card"><h2>Am numărat</h2>
        <p class="hint" style="margin:0 0 12px">Numără ce e într-un loc și scrie cifrele aici. Unde ce ai numărat diferă de ce arată
          aplicația, se trece o ajustare cu motivul ales. Ce nu numeri rămâne cum e: nu trebuie numărat tot deodată.</p>
        <form data-form="inventar">
          <div class="imp-campuri">
            <label>Locul numărat<select name="loc" data-act="inventar-loc">${LOCURI.filter((l) => deschis()(l.id)).map((l) =>
              `<option value="${esc(l.id)}"${l.id === invLoc ? " selected" : ""}>${esc(l.nume)}</option>`).join("")}</select></label>
          </div>
          ${aici.length
            ? tabel(["Material", "Ce arată aplicația", "Ce ai numărat", "Diferența"], randuri, ["", "n", "n", "n"], true)
            : `<p class="hint" style="margin:12px 0 0">În ${esc(nume)} aplicația nu arată niciun material. ${altele.length ? " Dacă ai găsit ceva acolo, scrie mai jos." : ' Trece întâi ce era deja în depozit, la <a href="#/depozit/de-mana">Trecut de mână</a>.'}</p>`}
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
      return `<section class="imp-card"><h2>Pus deoparte în atelier</h2>
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
      return `<section class="imp-card"><h2>Cine răspunde de fiecare loc</h2>
        <p class="hint" style="margin:0 0 12px">Unde stă materialul și cine răspunde de el. Stocul e separat pe firme; un transfer
          între depozitele a două firme apare în istoric ca „între firme”. „Descarcă evidența” dă Excelul materialului de pe un
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
        <h2>Trecut de mână</h2>
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
      return `<section class="imp-card"><h2>Istoricul</h2>
        <p class="hint" style="margin:0 0 12px">Nimic din istoric nu se șterge. „Anulează” adaugă un rând care o anulează pe cea greșită, ca să se vadă ce s-a întâmplat. Consumul scris de o situație de lucrări se anulează ștergând situația, pe pagina șantierului.</p>
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
      aviz.textContent = firme ? `Transfer între firme: din stocul ${firme.din} în stocul ${firme.spre}. Așa apare și în istoric.` : "";
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

    root.addEventListener("click", (e) => {
      const t = e.target as HTMLElement;
      const bLoc = t.closest<HTMLButtonElement>("[data-loc]");
      if (bLoc) { loc = bLoc.dataset["loc"]!; muta = false; eroareMuta = ""; mesajMuta = ""; deseneaza(); return; }
      const b = t.closest<HTMLButtonElement>("button[data-act]");
      if (!b) return;
      if (b.dataset["act"] === "muta") { muta = true; mesajMuta = ""; deseneaza(); return; }
      if (b.dataset["act"] === "renunta-muta") { muta = false; eroareMuta = ""; deseneaza(); return; }
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
        case "atelier-trimite": {
          const a = inAtelier(st.miscari).find((x) => x.articol.cheie === b.dataset["cheie"] && x.pentru === b.dataset["pentru"]);
          if (!a || !a.pentru) return;
          st = { ...st, miscari: [...st.miscari, {
            id: idNou(), data: new Date().toISOString(), tip: "transfer", articol: a.articol, cantitate: a.cantitate,
            din: ATELIER, spre: a.pentru, lucrareId: a.pentru, nota: a.cereri.length ? `din atelier: ${a.cereri.join(" · ")}` : "din atelier",
          }] };
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
      if (t.dataset["act"] === "spre") { spre = t.value; deseneaza(); return; }
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
      if (f.dataset["form"] === "muta") { mutaMaterial(f); return; }
      if (f.id === "miscare") inregistreaza(f);
      const date = new FormData(f);
      const val = (n: string): string => ((date.get(n) as string | null) ?? "").trim();
      const numar = (n: string): number | null => (val(n) === "" ? null : Number(val(n).replace(",", ".")));
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
            : `${z.ajustate === 1 ? "o ajustare" : cate(z.ajustate, "ajustări")} în istoric.`,
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
