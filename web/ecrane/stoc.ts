/**
 * Materiale · De cumpărat (21 octombrie 2026).
 *
 * O singură întrebare: ce lipsește pe fiecare șantier deschis? Pe fiecare
 * necesar, o propoziție („14 materiale: 13 lipsesc, 1 e comandat și vine”),
 * un tabel pe patru coloane (material, trebuie, adus, stare) și un singur
 * buton albastru, „Comandă ce lipsește”. Înainte, „Necesar și depozit” ținea
 * pe un ecran necesarul, stocul, mișcările, inventarul, atelierul, drumul,
 * locurile, ambalajele și jurnalul: 16.000 px, 172 de butoane (Andrei: „nu
 * înțeleg nimic”). Stocul și restul sunt la fila „Depozit” (`depozit.ts`).
 *
 * Ce se schimbă rar stă sub „Schimbă lista”: cantitatea scrisă ca în Excel,
 * „Îl dă clientul”, ✕, materialul de mână, șantierul legat. Banii (costul de
 * achiziție, „În ofertă”) sunt pe pagina șantierului, nu aici.
 *
 * „Comandă ce lipsește” ia întâi ce există în alte locuri (`propuneriDinDepozit`),
 * apoi face ciornele pe furnizorul obișnuit, cu ce a rămas.
 */
import { esc, tabel, type Ecran } from "./tip.js";
import { citesteDepozit, idNou, puneComanda, scrieDepozit } from "../date.js";
import { MATERIALE, MATERIAL } from "../import/text.js";
import { cantitate, cifra, fileMateriale, numeArticol, propozitieMateriale, stareMaterial, unitate } from "../stoc-vizual.js";
import { depozite, deschis, numereMateriale, ramasPeNecesar, santiere, titluNecesar } from "../materiale.js";
import type { NecesarLucrare } from "../depozit-local.js";
import { articolDin, cantitateNecesara } from "../../src/stoc/registru.js";
import { materialManual, ordineNecesar, type Categorie, type MaterialNecesar } from "../../src/stoc/necesar.js";
import { celulaNumar, legaCelule, numarScris } from "../celula.js";
import { cuCantitatea } from "../../src/stoc/editari-necesar.js";
import { alegereNoua, aplicaComanda, ecranComanda, schimbaAlegerea, type AlegereComanda } from "../comanda-lipsa.js";

/** Forma aleasa in formular; cu ø ramane tub, fara alegere ramane cea implicita. */
const formaAleasa = (v: string, rand: number | null): Categorie | undefined =>
  rand === null && (v === "saltea" || v === "placa") ? v : undefined;

export const ecran: Ecran = {
  id: "materiale",
  titlu: "Materiale",

  render(root) {
    let st = citesteDepozit();
    /** Necesarurile deschise pentru schimbare („Schimbă lista”). */
    const editare = new Set<string>();
    let comanda: AlegereComanda | null = null;
    const DEPOZITE = depozite();
    const numeDepozit = (id?: string): string => DEPOZITE.find((d) => d.id === id)?.nume ?? "—";

    const salveaza = (): void => { scrieDepozit(st); };

    /** De câte ori s-a redesenat: celula necesarului redesenează după un clic doar dacă el n-a făcut-o. */
    let desenari = 0;
    function deseneaza(): void {
      desenari++;
      const eDeschis = deschis();
      const deschise = st.necesare.filter((n) => !n.santier || eDeschis(n.santier));
      const inchise = st.necesare.length - deschise.length;
      const n = comanda && deschise.find((x) => x.id === comanda!.id);
      let corp: string;
      if (n) corp = ecranComanda(st, n, comanda!, numeDepozit);
      else if (deschise.length === 0) {
        corp = `<section class="imp-card"><p class="hint" style="margin:0">${st.necesare.length === 0
          ? `Nimic de cumpărat încă. Materialele unei lucrări apar aici după ce clientul acceptă oferta: în <a href="#/lucrari">Lucrări</a>, pe lucrarea lui, „Clientul a acceptat”.`
          : "Nimic de cumpărat: toate șantierele cu necesar sunt închise."}</p></section>`;
      } else corp = deschise.map(cardNecesar).join("");
      root.innerHTML = `<div class="imp">
        ${fileMateriale("materiale", numereMateriale(st))}
        ${corp}
        ${!n && inchise > 0 ? `<p class="hint">Șantierele închise nu mai apar aici. Costul materialului fiecărui șantier e pe pagina lucrării, în <a href="#/lucrari?stadiu=inchise">Lucrări › Închise</a>.</p>` : ""}
      </div>`;
    }

    function cardNecesar(n: NecesarLucrare): string {
      const r = ramasPeNecesar(st, n);
      const pe = new Map(r.map((d) => [d.material, d]));
      const lipsa = r.filter((d) => d.ramas > 0).length;
      const inCiorna = r.some((d) => d.ramas === 0 && d.inCiorna > 0);
      const schimba = editare.has(n.id);
      const randuri = n.materiale.map((m, i) => {
        const d = pe.get(m);
        const a = d?.articol ?? articolDin(m);
        const necesar = d?.necesar ?? (a.um === "ml" ? m.ml : m.m2);
        const nume = `${esc(numeArticol(a))}${m.manual ? `<br><span class="hint">adăugat de mână: ${esc(m.manual)}</span>` : ""}`;
        if (!schimba) {
          return `<tr><td>${nume}</td><td class="n">${cantitate(necesar, a.um)}</td>
            <td class="n">${d && d.adus > 0 ? cantitate(d.adus, a.um) : "—"}</td><td>${stareMaterial(m, d)}</td></tr>`;
        }
        return `<tr>
          <td>${nume}</td>
          <td class="n"><span class="cel-cu-um">${celulaNumar({
            ed: "nec", valoare: Math.round(necesar * 100) / 100, eticheta: `Trebuie, ${numeArticol(a)}, în ${unitate(a.um)}`,
            schimbat: m.calculat !== undefined, ...(m.calculat !== undefined ? { inainte: `Calculat: ${cantitate(m.calculat, a.um)}` } : {}),
            date: { id: n.id, i },
          })}<span class="hint">${unitate(a.um)}</span></span></td>
          <td>${stareMaterial(m, d)}</td>
          <td class="fix">${m.manual ? ""
            : `<button type="button" class="legatura" data-act="client" data-id="${esc(n.id)}" data-i="${i}">${m.alClientului ? "Îl cumpărăm noi" : "Îl dă clientul"}</button> `}<button
              type="button" class="cel-scoate" data-act="scoate-rand" data-id="${esc(n.id)}" data-i="${i}"
              aria-label="Scoate ${esc(numeArticol(a))} din listă" title="Scoate din listă">✕</button></td>
        </tr>`;
      });
      const actiuni = schimba ? "" : `<div class="mat-actiuni">
          <button type="button" class="secundar" data-act="schimba" data-id="${esc(n.id)}">Schimbă lista</button>
          ${lipsa > 0 ? `<button type="button" class="primar" data-act="comanda" data-id="${esc(n.id)}">Comandă ce lipsește</button>`
            : inCiorna ? `<a class="secundar" href="#/comenzi">Trimite comenzile</a>` : ""}
        </div>`;
      return `<section class="imp-card mat-necesar">
        <div class="mat-antet">
          <div><h2>${esc(titluNecesar(n))}</h2><p>${propozitieMateriale(n.materiale, r)}</p></div>
          ${actiuni}
        </div>
        ${schimba ? partiSchimbare(n) : ""}
        ${schimba
          ? tabel(["Material", "Trebuie", "Stare", ""], randuri, ["", "n", "", ""])
          : tabel(["Material", "Trebuie", "Adus pe șantier", "Stare"], randuri, ["", "n", "n", ""])}
        ${schimba ? finalSchimbare(n) : ""}
      </section>`;
    }

    /** Deasupra tabelului, în „Schimbă lista”: șantierul legat și cum s-a calculat lista. */
    function partiSchimbare(n: NecesarLucrare): string {
      const optiuni = santiere().filter((s) => s.id === n.santier || deschis()(s.id)).map((s) =>
        `<option value="${esc(s.id)}"${s.id === n.santier ? " selected" : ""}>${esc(s.denumire)}</option>`).join("");
      const p = n.pierderi;
      return `<p class="hint" style="margin:0 0 12px">Scrii cât trebuie direct în tabel, ca în Excel; celula schimbată e galbenă și arată,
          sub mouse, cât era calculat. Din ${esc(n.fisier)}${p ? `, cu pierderile la croit: tablă ${cifra(p.tabla * 100)} %, saltele ${
          cifra((p.saltea ?? p.placa) * 100)} %, plăci ${cifra(p.placa * 100)} %, tuburi ${cifra(p.tub * 100)} %` : ""}.</p>
        <div class="imp-campuri">
          <label>Materialul comandat vine pe șantierul
            <select data-act="santier" data-id="${esc(n.id)}"><option value="">— niciunul: în depozitul central —</option>${optiuni}</select>
          </label>
        </div>`;
    }

    /** Sub tabel, în „Schimbă lista”: material de mână, anularea, scoaterea listei și „Gata”. */
    function finalSchimbare(n: NecesarLucrare): string {
      const schimbat = (n.scoase?.length ?? 0) > 0 || n.materiale.some((m) => m.calculat !== undefined);
      return `<details class="imp-card">
          <summary>Adaugă un material de mână (goluri la foc, distribuitor, ce nu reiese din liste)</summary>
          <form class="imp-campuri" data-form="manual" data-id="${esc(n.id)}">
            <label>Material<select name="sistem">${MATERIALE.filter((m) => m !== "goluri_foc").map((m) =>
              `<option value="${m}">${esc(MATERIAL[m])}</option>`).join("")}</select></label>
            <label>Grosime (mm)<input name="grosime" type="text" inputmode="decimal" step="any" min="0" /></label>
            <label>Diametrul tubului, ø mm (gol pentru plăci sau tablă, în m²)<input name="rand" type="text" inputmode="numeric" step="1" min="1" /></label>
            <label>Formă<select name="forma"><option value="">după diametru (tub; fără ø: saltea de vată, placă de elastomer, tablă)</option>
              <option value="saltea">saltea de vată, m²</option><option value="placa">placă, m²</option></select></label>
            <label>Cantitate (ml la tub, m² altfel)<input name="cantitate" type="text" inputmode="decimal" step="any" min="0" required /></label>
            <label>Pentru ce<input name="motiv" autocomplete="off" placeholder="de ex. goluri la foc, poziția 12" required /></label>
            <div class="imp-formular-butoane"><button type="submit" class="secundar">Adaugă</button></div>
          </form>
        </details>
        <div class="imp-formular-butoane">
          <button type="button" class="primar" data-act="gata" data-id="${esc(n.id)}">Gata</button>
          ${schimbat ? `<button type="button" class="secundar" data-act="anuleaza-necesar" data-id="${esc(n.id)}">Pune la loc lista calculată</button>` : ""}
          <button type="button" class="legatura" data-act="scoate-necesar" data-id="${esc(n.id)}">Scoate toată lista</button>
        </div>`;
    }

    // Lista se scrie în tabel, ca în Excel (15 octombrie 2026).
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
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-act]");
      if (!b) return;
      const id = b.dataset["id"] ?? "";
      switch (b.dataset["act"]) {
        case "schimba": editare.add(id); deseneaza(); return;
        case "gata": editare.delete(id); deseneaza(); return;
        case "comanda": comanda = alegereNoua(id); deseneaza(); scrollTo({ top: 0 }); return;
        case "inapoi": comanda = null; deseneaza(); return;
        case "confirma": {
          const n = st.necesare.find((x) => x.id === id);
          if (!n || !comanda) return;
          const r = aplicaComanda(st, n, comanda, idNou);
          const ciorne = r.ciorne;
          if (r.mutate > 0) { st = r.st; salveaza(); }
          for (const c of ciorne) puneComanda(c);
          comanda = null;
          if (ciorne.length > 0) { location.hash = "#/comenzi"; return; }
          deseneaza();
          return;
        }
        case "scoate-necesar": st = { ...st, necesare: st.necesare.filter((n) => n.id !== id) }; break;
        case "scoate-rand": {
          const i = Number(b.dataset["i"]);
          st = { ...st, necesare: st.necesare.map((n) => {
            if (n.id !== id) return n;
            const m = n.materiale[i];
            if (!m) return n;
            // Materialul calculat se poate pune la loc cu „Pune la loc lista calculată”; cel de mână, nu.
            return { ...n, materiale: n.materiale.filter((_, j) => j !== i), ...(m.manual ? {} : { scoase: [...(n.scoase ?? []), m] }) };
          }) };
          break;
        }
        case "anuleaza-necesar": {
          st = { ...st, necesare: st.necesare.map((n) => {
            if (n.id !== id) return n;
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
        case "client": {
          const i = Number(b.dataset["i"]);
          st = { ...st, necesare: st.necesare.map((n) => (n.id !== id ? n : { ...n, materiale: n.materiale.map((m, j) => {
            if (j !== i) return m;
            const { alClientului: _c, ...rest } = m;
            return m.alClientului ? rest : { ...rest, alClientului: true as const };
          }) })) };
          break;
        }
        default: return;
      }
      salveaza();
      deseneaza();
    });

    root.addEventListener("change", (e) => {
      const t = e.target as HTMLInputElement | HTMLSelectElement;
      if (comanda && schimbaAlegerea(comanda, t)) { deseneaza(); return; }
      if (t.dataset["act"] === "santier") {
        const id = t.dataset["id"];
        st = { ...st, necesare: st.necesare.map((n) => {
          if (n.id !== id) return n;
          const { santier: _, ...rest } = n;
          return t.value ? { ...rest, santier: t.value } : rest;
        }) };
        salveaza();
        deseneaza();
      }
    });

    root.addEventListener("submit", (e) => {
      e.preventDefault();
      const f = e.target as HTMLFormElement;
      if (f.dataset["form"] !== "manual") return;
      const date = new FormData(f);
      const val = (n: string): string => ((date.get(n) as string | null) ?? "").trim();
      const numar = (n: string): number | null => (val(n) === "" ? null : (numarScris(val(n)) ?? NaN));
      const cant = numar("cantitate");
      if (cant === null || !(cant > 0)) return;
      const forma = formaAleasa(val("forma"), numar("rand"));
      const m = materialManual(val("sistem"), numar("grosime"), numar("rand"), cant, val("motiv"), ...(forma ? [forma] : []));
      st = { ...st, necesare: st.necesare.map((n) => (n.id === f.dataset["id"] ? { ...n, materiale: [...n.materiale, m] } : n)) };
      salveaza();
      deseneaza();
    });

    deseneaza();
  },
};
