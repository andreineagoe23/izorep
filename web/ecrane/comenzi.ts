/**
 * Comenzi la furnizori (Faza 4).
 *
 * Drumul unei comenzi, cum il face biroul:
 *
 *   ciorna (din „Fa comenzile”, in Depozit si stoc, din Masuratori, sau de mana),
 *     cu pretul asteptat din lista furnizorului sau din ultima factura
 *     → „Trimite comanda”: textul de email si Excelul, gata de trimis
 *     → receptia, pe aviz sau pe factura: marfa intra in stoc. Avizul se poate
 *       citi din poza sau din PDF (modelul citeste, omul verifica si trimite),
 *       iar fisierul ramane atasat la comanda
 *     → „Trece factura” pe un aviz fara pret, cand vine factura
 *     → rar, returul la furnizor (S32)
 *
 * Comanda trimisa nu se mai schimba (ce s-a cerut furnizorului ramane scris);
 * se poate doar anula. Ce lipseste se cere cu o comanda suplimentara, cu motiv
 * (S28). Logica e in `src/stoc/comenzi.ts`; datele, prin operatiile din
 * `web/date.ts`.
 */
import { esc, indicator, stare, tabel, type Ecran } from "./tip.js";
import {
  anuleazaComanda, ataseazaDocument, citesteDepozit, citestePlanuri, idNou, linkDocument, modDate, puneComanda, receptioneaza,
  returneaza, stergeComanda, treceFactura, trimiteComanda,
} from "../date.js";
import { cantitate, cifra, numeArticol, unitate } from "../stoc-vizual.js";
import { depozite } from "./stoc.js";
import { descarca } from "../descarca.js";
import { caDataUrl, micsoreaza, modelPornit, rutaModel } from "../imagine.js";
import { registruComanda, registruEvidenta, randuriEvidenta } from "../comanda-excel.js";
import { FURNIZORI } from "../../src/stoc/furnizori.js";
import {
  CENTRAL, intrariPeAviz, primitPeLinii, ramasDePrimit, returnatPeLinii, stareComanda, textEmail,
  valoareAsteptata, type Comanda, type LinieComanda, type PretAsteptat, type PretPeUnitate, type StareComanda,
} from "../../src/stoc/comenzi.js";
import { CitireAviz, receptieDinCitire, type ReceptieCitita } from "../../src/stoc/aviz.js";
import { pretPropus, preturiArticol } from "../../src/stoc/preturi-furnizori.js";
import { denumireComanda, kgPeMp } from "../../src/stoc/produse.js";
import { articolDin, type Articol, type Miscare } from "../../src/stoc/registru.js";

const STARE: Record<StareComanda, [string, "ok" | "atentie" | "neutru"]> = {
  ciorna: ["ciornă", "neutru"],
  trimisa: ["trimisă, nesosită", "atentie"],
  partial: ["primită parțial", "atentie"],
  primita: ["primită", "ok"],
  anulata: ["anulată", "neutru"],
};

const azi = (): string => new Date().toISOString().slice(0, 10);
const nr = (v: FormDataEntryValue | null): number | null => {
  const t = String(v ?? "").trim().replace(",", ".");
  return t === "" ? null : Number(t);
};
const lei = (n: number): string => `${cifra(n)} lei`;
const bani = (p: PretPeUnitate): string => (p.moneda === "EUR" ? `${cifra(p.valoare)} €` : lei(p.valoare));

/** Pe ce obiectiv e comanda: numele șantierului din ofertă, sau stocul general. */
function obiectiv(c: Comanda): string {
  if (!c.santier) return "";
  return citestePlanuri().find((p) => p.id === c.santier)?.denumire ?? "";
}

/** Unitatea de pe document: kg la tablă, altfel a articolului. */
const umDocument = (a: Articol): string => (kgPeMp(a) !== null ? "kg" : unitate(a.um));

/** Fără preț la furnizorul ales: cine l-a vândut mai ieftin, ca omul să poată schimba furnizorul. */
function altFurnizor(a: Articol, furnizor: string): string {
  const alt = preturiArticol(a).find((p) => p.furnizor !== furnizor);
  return alt ? `${furnizor} n-are preț; ${alt.furnizor}: ${bani(alt)}, ${alt.sursa}` : "fără preț cunoscut";
}

/** Avizul sau factura citite, cu fișierul lor, pe o comandă (și pe avizul căruia i se trece factura). */
interface Citit {
  stare: "citeste" | "gata" | "eroare" | "fara-model";
  fisier: { nume: string; dataUrl: string };
  r?: ReceptieCitita;
  eroare?: string;
}

export const ecran: Ecran = {
  id: "comenzi",
  titlu: "Comenzi la furnizori",
  subtitlu: "Ce s-a comandat, ce a venit și ce mai e de primit. Comanda trimisă nu se mai schimbă; marfa intră în stoc la recepție.",

  render(root) {
    let st = citesteDepozit();
    let filtru: "deschise" | "toate" = "deschise";
    let eroare: { id: string; text: string } | null = null;
    let anulare: string | null = null;
    let cuModel = false;
    /** Cheia: id-ul comenzii, sau `id|aviz` pentru factura unui aviz. */
    const citite = new Map<string, Citit>();
    const DEPOZITE = depozite();
    const numeDepozit = (id?: string): string => DEPOZITE.find((d) => d.id === id)?.nume ?? "—";
    const peServer = modDate() === "server";

    const reciteste = (): void => { st = citesteDepozit(); };

    function deseneaza(): void {
      const comenzi = st.comenzi ?? [];
      const stari = new Map(comenzi.map((c) => [c.id, stareComanda(c, st.miscari)]));
      const nr$ = (s: StareComanda): number => [...stari.values()].filter((x) => x === s).length;
      // Deschisa: are ceva de primit, sau un aviz care inca n-are factura.
      const deschise = comenzi.filter((c) => stari.get(c.id) !== "anulata"
        && (stari.get(c.id) !== "primita" || avizeFaraFactura(c).length > 0));
      const vizibile = filtru === "toate" ? comenzi : deschise;

      root.innerHTML = `<div class="imp">
        <div class="stats">
          ${indicator(cifra(nr$("ciorna")), "Ciorne", "de verificat și trimis")}
          ${indicator(cifra(nr$("trimisa") + nr$("partial")), "Trimise, de primit", nr$("partial") ? `${nr$("partial")} primite parțial` : "")}
          ${indicator(cifra(nr$("primita")), "Primite")}
        </div>
        <div class="filtre" role="group" aria-label="Ce comenzi arăt">
          <button class="filtru" data-filtru="deschise" aria-pressed="${filtru === "deschise"}">Deschise · ${deschise.length}</button>
          <button class="filtru" data-filtru="toate" aria-pressed="${filtru === "toate"}">Toate · ${comenzi.length}</button>
        </div>
        ${vizibile.length === 0 ? `<section class="imp-card"><p class="hint" style="margin:0">${comenzi.length === 0
          ? `Nicio comandă încă. În <a href="#/stoc">Depozit și stoc</a>, pe necesarul unui șantier, „Fă comenzile” face ciornele din ce a rămas de comandat; în <a href="#/masuratori">Măsurători</a>, „Pentru comandă” le face din ce s-a măsurat pe teren. Pentru stocul general sau o lipsă, folosește „Comandă nouă”, mai jos.`
          : "Nicio comandă deschisă: tot ce s-a comandat a venit sau a fost anulat."}</p></section>` : ""}
        ${vizibile.map((c) => cardComanda(c, stari.get(c.id)!)).join("")}
        ${comandaNoua()}
        ${evidenta()}
      </div>`;
    }

    /** „1.234,50 € + 5.678 lei, fără TVA”, cu liniile fără preț numărate. */
    function valoare(c: Comanda): string {
      const v = valoareAsteptata(c);
      const parti = [v.EUR > 0 ? `${cifra(v.EUR)} €` : "", v.RON > 0 ? lei(v.RON) : ""].filter(Boolean);
      if (parti.length === 0) return v.faraPret > 0 ? "fără prețuri încă" : "";
      return `${parti.join(" + ")} fără TVA${v.faraPret > 0 ? ` · ${v.faraPret} ${v.faraPret === 1 ? "linie" : "linii"} fără preț` : ""}`;
    }

    function cardComanda(c: Comanda, s: StareComanda): string {
      const primit = primitPeLinii(c, st.miscari);
      const rest = ramasDePrimit(c, st.miscari);
      const returnat = returnatPeLinii(c, st.miscari);
      const cuRetur = [...returnat.values()].some((q) => q > 0);
      const avize = s === "anulata" || s === "ciorna" ? [] : avizeFaraFactura(c);
      const [eticheta, ton] = s === "primita" && avize.length > 0 ? ["primită, fără factură", "atentie" as const] : STARE[s];
      const ob = obiectiv(c);
      const kg = (l: LinieComanda): string => {
        const k = kgPeMp(l.articol);
        return k !== null ? `<br><span class="hint">≈ ${cifra(Math.ceil(l.cantitate * k))} kg</span>` : "";
      };
      const v = valoare(c);
      const err = eroare?.id === c.id ? `<p class="alerta" role="alert">${esc(eroare.text)}</p>` : "";
      const documente = (st.documente ?? []).filter((d) => d.comanda === c.id);
      const antet = `<h2>${esc(c.furnizor)} · ${esc(ob || "stocul general")} ${stare(eticheta, ton)}</h2>
        <p class="hint" style="margin:0 0 12px">${c.trimisa ? `trimisă pe ${new Date(c.trimisa).toLocaleDateString("ro-RO")}` : `ciornă din ${new Date(c.creat).toLocaleDateString("ro-RO")}`}
          · marfa vine în ${esc(numeDepozit(c.spre))} · factura pe ${esc(c.firma)}${c.suplimentara ? ` · suplimentară: ${esc(c.suplimentara)}` : ""}${
          c.anulata ? ` · anulată pe ${new Date(c.anulata).toLocaleDateString("ro-RO")}` : ""}${
          v && s !== "ciorna" ? ` · valoare așteptată ${esc(v)}` : ""}</p>`;

      if (s === "ciorna") {
        const randuri = c.linii.map((l) => `<tr>
          <td>${esc(denumireComanda(l.articol))}<br><span class="hint">${esc(numeArticol(l.articol))}</span></td>
          <td class="n"><input name="q-${esc(l.id)}" type="number" inputmode="decimal" step="any" min="0" value="${l.cantitate}" aria-label="Cantitate, ${unitate(l.articol.um)}" />
            ${unitate(l.articol.um)}${kg(l)}</td>
          <td class="n"><input name="pr-${esc(l.id)}" type="number" inputmode="decimal" step="any" min="0" value="${l.pret?.valoare ?? ""}" aria-label="Preț fără TVA, pe ${umDocument(l.articol)}" />
            <select name="mo-${esc(l.id)}" aria-label="Moneda prețului"><option value="RON"${l.pret?.moneda !== "EUR" ? " selected" : ""}>lei</option><option value="EUR"${l.pret?.moneda === "EUR" ? " selected" : ""}>€</option></select>
            <br><span class="hint">pe ${umDocument(l.articol)}${l.pret?.sursa ? ` · ${esc(l.pret.sursa)}` : l.pret ? " · scris de mână" : ` · ${esc(altFurnizor(l.articol, c.furnizor))}`}</span></td>
          <td class="fix">${c.linii.length > 1
            ? `<button type="button" class="secundar" data-act="scoate-linie" data-id="${esc(c.id)}" data-linie="${esc(l.id)}">Scoate</button>` : ""}</td>
        </tr>`);
        const furnizori = [...new Set([c.furnizor, ...FURNIZORI.map(([f]) => f)])];
        return `<form class="imp-card" data-form="ciorna" data-id="${esc(c.id)}">
          ${antet}
          ${tabel(["Material", "Cantitate", "Preț fără TVA", ""], randuri, ["", "n", "n", ""])}
          ${v ? `<p class="hint">Valoare așteptată: ${esc(v)}. Prețul vine din lista furnizorului sau din ultima lui factură; îl poți schimba.</p>` : ""}
          <div class="imp-campuri">
            <label>Furnizor<select name="furnizor" data-act="furnizor">${furnizori.map((f) =>
              `<option${f === c.furnizor ? " selected" : ""}>${esc(f)}</option>`).join("")}</select></label>
            <label>Notă pe comandă (termen, livrare, persoana de contact)<input name="nota" autocomplete="off" value="${esc(c.nota ?? "")}" /></label>
          </div>
          ${err}
          <div class="imp-formular-butoane">
            <button type="submit" class="primar" data-act="trimite">Trimite comanda</button>
            <button type="submit" class="secundar" data-act="salveaza">Salvează ciorna</button>
            <button type="button" class="secundar" data-act="sterge" data-id="${esc(c.id)}">Șterge ciorna</button>
          </div>
          <p class="hint">„Trimite comanda” o îngheață și îți dă textul de email și Excelul. După aceea nu se mai schimbă:
            ce lipsește se cere cu o comandă suplimentară.</p>
        </form>`;
      }

      const randuri = c.linii.map((l) => `<tr>
        <td>${esc(denumireComanda(l.articol))}<br><span class="hint">${esc(numeArticol(l.articol))}</span></td>
        <td class="n">${cantitate(l.cantitate, l.articol.um)}${kg(l)}</td>
        <td class="n">${cantitate(primit.get(l.id) ?? 0, l.articol.um)}</td>
        <td class="n">${cantitate(rest.get(l.id) ?? 0, l.articol.um)}</td>
        ${cuRetur ? `<td class="n">${cantitate(returnat.get(l.id) ?? 0, l.articol.um)}</td>` : ""}
      </tr>`);
      const tabelLinii = tabel(["Material", "Comandat", "Primit", "Rămas de primit", ...(cuRetur ? ["Returnat"] : [])], randuri,
        ["", "n", "n", "n", ...(cuRetur ? ["n"] : [])]);

      if (s === "anulata") return `<section class="imp-card">${antet}${tabelLinii}</section>`;

      const email = textEmail(c, ob);
      const poateReturna = c.linii.some((l) => (primit.get(l.id) ?? 0) - (returnat.get(l.id) ?? 0) > 0);
      return `<section class="imp-card">
        ${antet}
        ${tabelLinii}
        ${documente.length > 0 ? `<p class="hint">Atașate: ${documente.map((d) =>
          `<a href="${esc(linkDocument(d.id))}" target="_blank" rel="noopener">${d.tip === "aviz" ? "avizul" : "factura"} ${esc(d.numar)}</a>`).join(" · ")}</p>` : ""}
        <details${s === "trimisa" ? " open" : ""}>
          <summary>Textul de email și Excelul comenzii</summary>
          <textarea readonly rows="${Math.min(14, email.split("\n").length + 1)}" style="width:100%;margin-top:12px">${esc(email)}</textarea>
          <div class="imp-formular-butoane">
            <button type="button" class="secundar" data-act="copiaza" data-id="${esc(c.id)}">Copiază textul</button>
            <button type="button" class="secundar" data-act="excel" data-id="${esc(c.id)}">Descarcă Excel</button>
          </div>
        </details>
        ${s !== "primita" ? formularReceptie(c, rest) : ""}
        ${avize.map((a) => formularFactura(c, a)).join("")}
        ${poateReturna ? formularRetur(c, primit, returnat) : ""}
        ${err}
        ${s !== "primita" ? `<div class="imp-formular-butoane">${anulare === c.id
          ? `<button type="button" class="secundar" data-act="anuleaza" data-id="${esc(c.id)}">Sigur anulezi comanda?</button>`
          : `<button type="button" class="secundar" data-act="anuleaza" data-id="${esc(c.id)}">Anulează comanda</button>`}</div>` : ""}
      </section>`;
    }

    /** Cantitatea de pe document: tabla la kg (ca pe aviz), restul în unitatea articolului. */
    const peDocument = (a: Articol, q: number): { valoare: number; um: string } => {
      const kg = kgPeMp(a);
      return kg !== null ? { valoare: Math.ceil(q * kg * 100) / 100, um: "kg" } : { valoare: q, um: unitate(a.um) };
    };

    /**
     * Zona de fișier: citește documentul cu modelul și îl atașează. Fără model
     * (sau pe linkul demo), doar îl atașează, ori spune că nu se păstrează.
     */
    function zonaDocument(cheie: string, ce: "aviz sau factură" | "factura"): string {
      const c = citite.get(cheie);
      if (!cuModel && !peServer) return "";
      const titlu = cuModel ? `Citește ${ce === "factura" ? "factura" : "avizul"} din poză sau PDF` : `Atașează ${ce === "factura" ? "factura" : "avizul"} (poză sau PDF)`;
      const sub = cuModel
        ? "completează formularul de mai jos; verifici și înregistrezi tu. Fișierul rămâne atașat la comandă."
        : "fișierul rămâne atașat la comandă; formularul îl completezi tu.";
      let mesaj = "";
      if (c?.stare === "citeste") mesaj = `<p class="hint" role="status">Citesc ${esc(c.fisier.nume)}…</p>`;
      if (c?.stare === "eroare") mesaj = `<p class="alerta" role="alert">${esc(c.eroare ?? "Documentul nu s-a putut citi.")} Completează de mână; fișierul se atașează oricum.</p>`;
      if (c?.stare === "fara-model") mesaj = `<p class="hint">${esc(c.fisier.nume)} se atașează la înregistrare.</p>`;
      if (c?.stare === "gata" && c.r) {
        const nepot = [...c.r.nepotrivite, ...c.r.umGresit];
        mesaj = `<p class="hint" role="status">Am completat din ${esc(c.fisier.nume)}: verifică cifrele cu documentul înainte să înregistrezi.</p>${
          nepot.length > 0 ? `<p class="alerta" role="alert">Nu sunt pe comandă (sau au altă unitate): ${nepot.map((r) =>
            `${esc(r.denumire)} · ${cifra(r.cantitate)} ${esc(r.um ?? "")}`).join("; ")}. Dacă au venit, fă o comandă suplimentară și recepționează-le pe ea.</p>` : ""}`;
      }
      return `<label class="imp-drop" style="min-height:0;padding:16px">
          <span class="imp-drop-buton">${titlu}</span>
          <span class="imp-drop-sub">${sub}</span>
          <input type="file" accept="image/*,application/pdf" data-citeste="${esc(cheie)}" />
        </label>${mesaj}`;
    }

    function formularReceptie(c: Comanda, rest: Map<string, number>): string {
      const r = citite.get(c.id)?.r;
      const doc = r?.document;
      const linii = c.linii.map((l) => {
        const d = peDocument(l.articol, rest.get(l.id) ?? 0);
        const dinCitire = r?.linii[l.id];
        const primitAcum = r ? dinCitire?.cantitate ?? 0 : d.valoare;
        const pretCitit = dinCitire?.pret?.valoare;
        return `<tr>
          <td>${esc(denumireComanda(l.articol))}</td>
          <td class="n"><input name="r-${esc(l.id)}" type="number" inputmode="decimal" step="any" min="0" value="${primitAcum}" aria-label="Primit, ${d.um}" />
            <span class="hint">${d.um}</span></td>
          <td class="n"><input name="p-${esc(l.id)}" type="number" inputmode="decimal" step="any" min="0" value="${pretCitit ?? ""}"
            placeholder="${l.pret ? esc(`așteptat ${cifra(l.pret.valoare)}`) : ""}" aria-label="Preț unitar, pe ${d.um}" />
            <span class="hint">pe ${d.um}${l.pret ? ` · așteptat ${esc(bani(l.pret))}` : ""}</span></td>
        </tr>`;
      });
      const sel = (v: string, ales: string | undefined): string => (v === ales ? " selected" : "");
      return `<details class="imp-card"${citite.has(c.id) ? " open" : ""}>
        <summary>Recepție: a venit marfa (aviz sau factură)</summary>
        ${zonaDocument(c.id, "aviz sau factură")}
        <form data-form="receptie" data-id="${esc(c.id)}">
          <div class="imp-campuri">
            <label>Documentul<select name="tip"><option value="aviz"${sel("aviz", doc?.tip)}>Aviz (fără preț, „urmează factura”)</option><option value="factura"${sel("factura", doc?.tip)}>Factură</option></select></label>
            <label>Seria (opțional)<input name="serie" autocomplete="off" value="${esc(doc?.serie ?? "")}" /></label>
            <label>Numărul<input name="numar" autocomplete="off" required value="${esc(doc?.numar ?? "")}" /></label>
            <label>Data de pe document<input name="data" type="date" value="${esc(doc?.data ?? azi())}" required /></label>
            <label>Moneda prețurilor<select name="moneda"><option value="RON"${sel("RON", r?.moneda ?? "RON")}>lei</option><option value="EUR"${sel("EUR", r?.moneda)}>euro</option></select></label>
            <label>Cursul de pe factură (lei pentru 1 €)<input name="curs" type="number" inputmode="decimal" step="any" min="0" value="${r?.curs ?? ""}" /></label>
            <label>Transport pe document (opțional, în moneda de mai sus)<input name="transport" type="number" inputmode="decimal" step="any" min="0" value="${r?.transport ?? ""}" /></label>
            <label>Unde a ajuns marfa<select name="spre">${DEPOZITE.map((d) =>
              `<option value="${esc(d.id)}"${d.id === c.spre ? " selected" : ""}>${esc(d.nume)}</option>`).join("")}</select></label>
          </div>
          ${tabel(["Material", "Primit acum", "Preț unitar (gol pe aviz)"], linii, ["", "n", "n"])}
          <p class="hint">Pe aviz, prețul rămâne gol: îl aduce factura („Trece factura”, apare după recepție). Prețul în lei se trece în euro
            cu cursul de pe factură, ca în evidența voastră.</p>
          <div class="imp-formular-butoane"><button type="submit" class="primar">Înregistrează recepția</button></div>
        </form>
      </details>`;
    }

    /** Avizele recepționate pe comandă care încă n-au factură. */
    function avizeFaraFactura(c: Comanda): string[] {
      const numere = new Set<string>();
      for (const m of st.miscari) if (m.comanda?.id === c.id && m.document?.tip === "aviz") numere.add(m.document.numar);
      return [...numere].filter((a) => intrariPeAviz(c, st.miscari, a).length > 0);
    }

    function formularFactura(c: Comanda, aviz: string): string {
      const cheie = `${c.id}|${aviz}`;
      const r = citite.get(cheie)?.r;
      const intrari = intrariPeAviz(c, st.miscari, aviz);
      const linii = intrari.map((m: Miscare) => {
        const l = c.linii.find((x) => x.id === m.comanda!.linie)!;
        const d = peDocument(l.articol, m.cantitate);
        const pret = r?.linii[l.id]?.pret?.valoare;
        return `<tr><td>${esc(denumireComanda(l.articol))}</td><td class="n">${cifra(d.valoare)} ${d.um}</td>
          <td class="n"><input name="f-${esc(l.id)}" type="number" inputmode="decimal" step="any" min="0" required value="${pret ?? ""}"
            placeholder="${l.pret ? esc(`așteptat ${cifra(l.pret.valoare)}`) : ""}" aria-label="Preț unitar pe ${d.um}" />
            <span class="hint">pe ${d.um}${l.pret ? ` · așteptat ${esc(bani(l.pret))}` : ""}</span></td></tr>`;
      });
      const doc = r?.document;
      return `<details class="imp-card" open>
        <summary>Avizul ${esc(aviz)} n-are încă factură: trece factura</summary>
        ${zonaDocument(cheie, "factura")}
        <form data-form="factura" data-id="${esc(c.id)}" data-aviz="${esc(aviz)}">
          <div class="imp-campuri">
            <label>Seria (opțional)<input name="serie" autocomplete="off" value="${esc(doc?.serie ?? "")}" /></label>
            <label>Numărul facturii<input name="numar" autocomplete="off" required value="${esc(doc?.numar ?? "")}" /></label>
            <label>Data facturii<input name="data" type="date" value="${esc(doc?.data ?? azi())}" required /></label>
            <label>Moneda prețurilor<select name="moneda"><option value="RON">lei</option><option value="EUR"${r?.moneda === "EUR" ? " selected" : ""}>euro</option></select></label>
            <label>Cursul de pe factură (lei pentru 1 €)<input name="curs" type="number" inputmode="decimal" step="any" min="0" value="${r?.curs ?? ""}" /></label>
            <label>Transport pe factură (opțional)<input name="transport" type="number" inputmode="decimal" step="any" min="0" value="${r?.transport ?? ""}" /></label>
          </div>
          ${tabel(["Material", "Pe aviz", "Preț unitar fără TVA"], linii, ["", "n", "n"])}
          <p class="hint">Cantitățile rămân cele de pe aviz. În jurnal, intrarea de pe aviz apare anulată și înlocuită de cea de pe factură, cu preț.</p>
          <div class="imp-formular-butoane"><button type="submit" class="primar">Trece factura</button></div>
        </form>
      </details>`;
    }

    function formularRetur(c: Comanda, primit: Map<string, number>, returnat: Map<string, number>): string {
      const linii = c.linii.filter((l) => (primit.get(l.id) ?? 0) - (returnat.get(l.id) ?? 0) > 0);
      return `<details class="imp-card">
        <summary>Retur la furnizor (marfă defectă sau greșită)</summary>
        <form class="imp-campuri" data-form="retur" data-id="${esc(c.id)}">
          <label>Ce se returnează<select name="linie">${linii.map((l) => {
            const poate = peDocument(l.articol, (primit.get(l.id) ?? 0) - (returnat.get(l.id) ?? 0));
            return `<option value="${esc(l.id)}">${esc(denumireComanda(l.articol))} · venit ${cifra(poate.valoare)} ${poate.um}</option>`;
          }).join("")}</select></label>
          <label>Cât (kg la tablă, altfel ml sau m²)<input name="cantitate" type="number" inputmode="decimal" step="any" min="0" required /></label>
          <label>Din ce depozit pleacă<select name="din">${DEPOZITE.map((d) =>
            `<option value="${esc(d.id)}"${d.id === c.spre ? " selected" : ""}>${esc(d.nume)}</option>`).join("")}</select></label>
          <label>De ce<input name="motiv" autocomplete="off" required placeholder="defect, alt diametru, în plus" /></label>
          <label>Avizul de retur (opțional)<input name="aviz" autocomplete="off" /></label>
          <p class="hint">Marfa iese din stoc. Primitul pe comandă rămâne cât a venit; dacă materialul trebuie înlocuit, apare din nou la
            „Rămas de comandat” pe șantier și se cere cu o comandă suplimentară.</p>
          <div class="imp-formular-butoane"><button type="submit" class="secundar">Înregistrează returul</button></div>
        </form>
      </details>`;
    }

    function comandaNoua(): string {
      const articole = new Map<string, Articol>();
      for (const n of st.necesare) for (const m of n.materiale) { const a = articolDin(m); articole.set(a.cheie, a); }
      for (const m of st.miscari) { const a = articolDin(m.articol); articole.set(a.cheie, a); }
      const lista = [...articole.values()].sort((a, b) => numeArticol(a).localeCompare(numeArticol(b), "ro"));
      if (lista.length === 0) return "";
      const err = eroare?.id === "nou" ? `<p class="alerta" role="alert">${esc(eroare.text)}</p>` : "";
      return `<details class="imp-card"${err ? " open" : ""}>
        <summary>Comandă nouă: stoc general sau ce lipsește pe un șantier</summary>
        <form class="imp-campuri" data-form="nou">
          <label>Furnizor<select name="furnizor">${FURNIZORI.map(([f]) => `<option>${esc(f)}</option>`).join("")}</select></label>
          <label>Unde vine marfa<select name="spre">${DEPOZITE.map((d) => `<option value="${esc(d.id)}">${esc(d.nume)}</option>`).join("")}</select></label>
          <label>Material<select name="articol">${lista.map((a) => `<option value="${esc(a.cheie)}">${esc(numeArticol(a))}</option>`).join("")}</select></label>
          <label>Cantitate (ml la tub, m² altfel)<input name="cantitate" type="number" inputmode="decimal" step="any" min="0" required /></label>
          <label>De ce, peste necesar (pe un șantier: lipsă, pierdere, lucrare în plus)<input name="motiv" autocomplete="off" /></label>
          ${err}
          <div class="imp-formular-butoane"><button type="submit" class="secundar">Fă ciorna</button></div>
        </form>
      </details>`;
    }

    function evidenta(): string {
      const intrari = st.miscari.filter((m) => m.tip === "intrare" && m.document && !m.anuleaza).length;
      if (intrari === 0) return "";
      return `<section class="imp-card"><h2>Evidența cumpărărilor</h2>
        <p class="hint" style="margin:0 0 12px">Intrările de la furnizori, cu coloanele Excelului vostru de evidență (furnizor, proiect,
          document, preț în lei și euro, curs). Returul la furnizor iese cu minus. Se pot lipi în el cât timp îl mai țineți.</p>
        <div class="imp-formular-butoane"><button type="button" class="secundar" data-act="evidenta">Descarcă evidența</button></div>
      </section>`;
    }

    /* --------------------------------------------------------- evenimente */

    const comanda = (id?: string): Comanda | undefined => (st.comenzi ?? []).find((c) => c.id === id);

    /**
     * Ciorna, cu cantitățile, prețurile și câmpurile din formular. Prețul
     * neatins își păstrează sursa; schimbat, e al omului. Cu alt furnizor,
     * prețurile propuse se iau de la el; cele scrise de mână rămân.
     */
    function ciornaDin(f: HTMLFormElement, c: Comanda): Comanda {
      const d = new FormData(f);
      const furnizor = String(d.get("furnizor") ?? c.furnizor);
      const linii: LinieComanda[] = c.linii.map((l): LinieComanda => {
        const { pret: vechi, ...fara } = l;
        const valoare = nr(d.get(`pr-${l.id}`));
        const moneda = d.get(`mo-${l.id}`) === "EUR" ? "EUR" : "RON";
        let pret: PretAsteptat | undefined;
        if (valoare !== null && valoare > 0) {
          pret = vechi && vechi.valoare === valoare && vechi.moneda === moneda ? vechi : { valoare, moneda };
        }
        if (furnizor !== c.furnizor && (!pret || pret.sursa)) pret = pretPropus(l.articol, furnizor, st.miscari) ?? undefined;
        return { ...fara, cantitate: nr(d.get(`q-${l.id}`)) ?? l.cantitate, ...(pret ? { pret } : {}) };
      }).filter((l) => l.cantitate > 0);
      const nota = String(d.get("nota") ?? "").trim();
      const { nota: _n, ...rest } = c;
      return { ...rest, furnizor, linii, ...(nota ? { nota } : {}) };
    }

    const pret = (valoare: number | null, moneda: string): PretPeUnitate | undefined =>
      valoare === null ? undefined : { valoare, moneda: moneda === "EUR" ? "EUR" : "RON" };

    /** Fișierul ales: citit cu modelul (când există) și ținut pentru atașare. */
    async function laFisier(input: HTMLInputElement): Promise<void> {
      const f = input.files?.[0];
      const cheie = input.dataset["citeste"]!;
      const c = comanda(cheie.split("|")[0]);
      if (!f || !c) return;
      if (!f.type.startsWith("image/") && f.type !== "application/pdf") {
        eroare = { id: c.id, text: "Aici merg doar poze și PDF-uri." };
        deseneaza();
        return;
      }
      if (f.size > 12 * 1024 * 1024 && f.type === "application/pdf") {
        eroare = { id: c.id, text: "PDF-ul e prea mare (peste 12 MB)." };
        deseneaza();
        return;
      }
      const dataUrl = f.type === "application/pdf" ? await caDataUrl(f) : await micsoreaza(f);
      const fisier = { nume: f.name, dataUrl };
      if (!cuModel) { citite.set(cheie, { stare: "fara-model", fisier }); deseneaza(); return; }
      citite.set(cheie, { stare: "citeste", fisier });
      deseneaza();
      try {
        const r = await fetch(rutaModel("aviz"), {
          method: "POST", headers: { "Content-Type": "application/json", "X-Izorep": "1" },
          body: JSON.stringify({ fisier: dataUrl, nume: f.name }), signal: AbortSignal.timeout(300_000),
        });
        const corp = (await r.json()) as unknown;
        if (!r.ok) throw new Error((corp as { eroare?: string }).eroare ?? `HTTP ${r.status}`);
        // Ce vine de la server trece prin aceeasi schema inca o data.
        const citire = CitireAviz.parse(corp);
        citite.set(cheie, { stare: "gata", fisier, r: receptieDinCitire(c, citire) });
      } catch (e) {
        console.error(e);
        citite.set(cheie, { stare: "eroare", fisier, eroare: "Documentul nu s-a putut citi." });
      }
      deseneaza();
    }

    /** După înregistrare, fișierul citit se atașează la comandă, cu numărul documentului. */
    function ataseaza(cheie: string, comandaId: string, tip: "aviz" | "factura", numar: string): void {
      const c = citite.get(cheie);
      if (c) ataseazaDocument({ id: idNou(), comanda: comandaId, tip, numar, nume: c.fisier.nume, fisier: c.fisier.dataUrl });
      citite.delete(cheie);
    }

    root.addEventListener("change", (e) => {
      const t = e.target as HTMLElement;
      if (t instanceof HTMLInputElement && t.type === "file" && t.dataset["citeste"]) { void laFisier(t); return; }
      // Alt furnizor pe ciornă: prețurile propuse se iau de la el.
      if (t instanceof HTMLSelectElement && t.dataset["act"] === "furnizor") {
        const form = t.closest<HTMLFormElement>("form[data-form=ciorna]");
        const c = comanda(form?.dataset["id"]);
        if (!form || !c) return;
        const gresit = puneComanda(ciornaDin(form, c));
        eroare = gresit ? { id: c.id, text: gresit } : null;
        reciteste();
        deseneaza();
      }
    });

    root.addEventListener("click", async (e) => {
      const t = e.target as HTMLElement;
      const f = t.closest<HTMLButtonElement>("[data-filtru]");
      if (f) { filtru = f.dataset["filtru"] as typeof filtru; deseneaza(); return; }
      const b = t.closest<HTMLButtonElement>("button[data-act]");
      if (!b || b.type === "submit") return;
      const c = comanda(b.dataset["id"]);
      switch (b.dataset["act"]) {
        case "scoate-linie": {
          if (!c) return;
          const r = puneComanda({ ...c, linii: c.linii.filter((l) => l.id !== b.dataset["linie"]) });
          eroare = r ? { id: c.id, text: r } : null;
          break;
        }
        case "sterge": if (c) stergeComanda(c.id); break;
        case "anuleaza":
          if (!c) return;
          if (anulare !== c.id) { anulare = c.id; deseneaza(); return; }
          anuleazaComanda(c.id);
          anulare = null;
          break;
        case "copiaza":
          if (!c) return;
          try { await navigator.clipboard.writeText(textEmail(c, obiectiv(c))); b.textContent = "Copiat"; } catch { /* textul e selectabil oricum */ }
          return;
        case "excel":
          if (!c) return;
          descarca(await registruComanda(c, obiectiv(c)), `Comanda ${c.furnizor} ${(c.trimisa ?? c.creat).slice(0, 10)}.xlsx`);
          return;
        case "evidenta": {
          const proiect = (dep?: string): string => (dep === CENTRAL ? "DEPOZIT"
            : citestePlanuri().find((p) => p.id === dep)?.denumire ?? numeDepozit(dep));
          descarca(await registruEvidenta(randuriEvidenta(st.miscari, proiect)), `Evidenta cumparari ${azi()}.xlsx`);
          return;
        }
        default: return;
      }
      reciteste();
      deseneaza();
    });

    root.addEventListener("submit", (e) => {
      e.preventDefault();
      const form = e.target as HTMLFormElement;
      const d = new FormData(form);
      const val = (n: string): string => String(d.get(n) ?? "").trim();
      const c = comanda(form.dataset["id"]);
      const actiune = ((e as SubmitEvent).submitter as HTMLButtonElement | null)?.dataset["act"];
      let gresit: string | null = null;

      if (form.dataset["form"] === "ciorna" && c) {
        const noua = ciornaDin(form, c);
        if (noua.linii.length === 0) gresit = "Comanda nu are nicio cantitate.";
        else {
          gresit = puneComanda(noua);
          if (!gresit && actiune === "trimite") trimiteComanda(c.id);
        }
      }
      if (form.dataset["form"] === "receptie" && c) {
        const moneda = val("moneda");
        const transport = nr(d.get("transport"));
        const tip = val("tip") === "factura" ? "factura" : "aviz";
        gresit = receptioneaza(c.id, {
          document: { tip, ...(val("serie") ? { serie: val("serie") } : {}), numar: val("numar"), data: val("data") },
          ...(nr(d.get("curs")) ? { curs: nr(d.get("curs"))! } : {}),
          ...(transport ? { transport: pret(transport, moneda)! } : {}),
          ...(val("spre") && val("spre") !== c.spre ? { spre: val("spre") } : {}),
          linii: c.linii.map((l) => {
            const p = pret(nr(d.get(`p-${l.id}`)), moneda);
            return { linie: l.id, cantitate: nr(d.get(`r-${l.id}`)) ?? 0, ...(p ? { pret: p } : {}) };
          }),
        });
        if (!gresit) ataseaza(c.id, c.id, tip, [val("serie"), val("numar")].filter(Boolean).join(" "));
      }
      if (form.dataset["form"] === "factura" && c) {
        const moneda = val("moneda");
        const transport = nr(d.get("transport"));
        const preturi: Record<string, PretPeUnitate> = {};
        for (const l of c.linii) { const p = pret(nr(d.get(`f-${l.id}`)), moneda); if (p) preturi[l.id] = p; }
        const aviz = form.dataset["aviz"]!;
        gresit = treceFactura(c.id, aviz, {
          document: { tip: "factura", ...(val("serie") ? { serie: val("serie") } : {}), numar: val("numar"), data: val("data") },
          ...(nr(d.get("curs")) ? { curs: nr(d.get("curs"))! } : {}),
          ...(transport ? { transport: pret(transport, moneda)! } : {}),
          preturi,
        });
        if (!gresit) ataseaza(`${c.id}|${aviz}`, c.id, "factura", [val("serie"), val("numar")].filter(Boolean).join(" "));
      }
      if (form.dataset["form"] === "retur" && c) {
        gresit = returneaza(c.id, {
          linie: val("linie"), cantitate: nr(d.get("cantitate")) ?? 0, din: val("din"), motiv: val("motiv"),
          ...(val("aviz") ? { document: { tip: "aviz" as const, numar: val("aviz"), data: azi() } } : {}),
        });
      }
      if (form.dataset["form"] === "nou") {
        const articol = [...(st.necesare.flatMap((n) => n.materiale.map((m) => articolDin(m)))), ...st.miscari.map((m) => articolDin(m.articol))]
          .find((a) => a.cheie === val("articol"));
        const q = nr(d.get("cantitate"));
        const spre = val("spre");
        const santier = citestePlanuri().find((p) => p.id === spre);
        if (!articol || !(q && q > 0)) gresit = "Alege materialul și cantitatea.";
        else if (santier && !val("motiv")) gresit = "Pe un șantier, comanda peste necesar are nevoie de motiv (lipsă, pierdere, lucrare în plus).";
        else {
          const p = pretPropus(articol, val("furnizor"), st.miscari);
          gresit = puneComanda({
            id: idNou(), creat: new Date().toISOString(), furnizor: val("furnizor"), firma: santier?.firma ?? "RADOIA ISOLIRUNG SRL",
            spre, ...(santier ? { santier: santier.id } : {}), ...(val("motiv") ? { suplimentara: val("motiv") } : {}),
            linii: [{ id: idNou(), articol, cantitate: q, ...(p ? { pret: p } : {}) }],
          });
        }
        eroare = gresit ? { id: "nou", text: gresit } : null;
        reciteste();
        deseneaza();
        return;
      }
      eroare = gresit && c ? { id: c.id, text: gresit } : null;
      reciteste();
      deseneaza();
    });

    deseneaza();
    void modelPornit("aviz").then((da) => { if (da !== cuModel) { cuModel = da; deseneaza(); } });
  },
};
