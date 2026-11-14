/**
 * Șantierul unei lucrări: filele Materiale, Situații și Închidere (și planul,
 * din „⋯”) de pe pagina lucrării. Până pe 14 noiembrie 2026 erau pagina unui
 * șantier din „Șantiere”; conținutul a rămas, s-a schimbat locul: antetul,
 * filele și adresa sunt ale paginii lucrării (`lucrari.ts`).
 *
 * Logica e în `src/lucrari/situatii.ts`, `src/lucrari/inchidere.ts` și
 * `src/stoc/`; datele prin `web/date.ts`.
 */
import { esc, eur, stare, tabel } from "./tip.js";
import {
  citesteDepozit, citestePlanuri, idNou, inchideSantier, salveazaSituatie, scrieDepozit, stergeUltimaSituatie,
} from "../date.js";
import { consumPlan } from "../consum-vizual.js";
import { dinMarci } from "../../src/stoc/consum.js";
import { ramasPeNecesar } from "../materiale.js";
import { cardNecesar, cifra } from "../stoc-vizual.js";
import { descarca } from "../descarca.js";
import { numeSituatie, registruSituatie } from "../situatie.js";
import { preiaSituatie } from "../predare.js";
import { pastreazaCursorul } from "../celula.js";
import type { Potrivire } from "../../src/lucrari/potrivire.js";
import { cifreInchidere, materialSantier, valideazaInchidere } from "../../src/lucrari/inchidere.js";
import { cardInchis, cardMaterial, formularInchidere, randuriInchidere, restulPeSantier } from "../inchidere-vizual.js";
import {
  randuriSituatie, situatieNoua, totalSituatie, valideazaSituatie,
  type PlanSantier, type Situatie,
} from "../../src/lucrari/situatii.js";
import { PIERDERI_IMPLICITE, PRAG_TUB_MM, type Pierderi } from "../../src/stoc/necesar.js";
import type { ReguliNecesar } from "../santier-din.js";

export type FilaSantier = "situatii" | "materiale" | "inchidere" | "plan";

export interface OptiuniSantier {
  plan: string;
  fila: FilaSantier;
  /** Cererea din care s-a făcut șantierul: fără ea nu se pot schimba regulile listei. */
  cerere?: string | undefined;
  /** Ceva s-a scris (o situație, închiderea, lista): pagina își reface antetul și „Urmează”. */
  laSchimbare: () => void;
}

export interface ControlSantier {
  arata(f: FilaSantier): void;
  /** „Situație nouă” din rândul „Urmează”. */
  situatieNoua(): void;
}

const zi = (iso: string): string => new Date(iso).toLocaleDateString("ro-RO");
const cant = (n: number, um: string): string => `${cifra(n)}${um ? ` ${esc(um)}` : ""}`;

export function montezaSantier(root: HTMLElement, opt: OptiuniSantier): ControlSantier {
  let planuri = citestePlanuri();
  let fila: FilaSantier = opt.fila;
  let inLucru: Situatie | null = null;
  let eroare = "";
  let mesaj = "";
  /** Ce a facut ultima salvare (consumul scris): informatie, nu eroare. */
  let info = "";
  /** Inchiderea (Faza 7): ce a scris omul, eroarea, a doua apasare, cardul deschis. */
  let inchidere = { scris: {} as Record<string, { numarat?: string; unde?: string }>, eroare: "", confirma: false, deschis: false };
  /** Situatia in lucru a venit din poze: ce s-a pus, ce e de ales, ce nu e in oferta. */
  let dinPoze: Potrivire | null = null;
  /** „Schimbă regulile de calcul”: cererea deschisă o dată și regulile scrise. */
  let reguli: {
    cerere: Awaited<ReturnType<typeof import("./import.js")["deschideReguli"]>>; r: ReguliNecesar; eroare: string;
  } | null = null;
  let seDeschidReguli = false;

  const plan = (): PlanSantier | undefined => planuri.find((p) => p.id === opt.plan);

  const venita = preiaSituatie();
  const tinta = venita && venita.plan === opt.plan ? plan() : undefined;
  if (venita && tinta?.inchis) {
    mesaj = "Șantierul e închis: nu mai primește situații de lucrări.";
  } else if (venita && tinta) {
    fila = "situatii";
    inLucru = {
      ...situatieNoua(tinta, idNou(), new Date().toISOString()),
      cantitati: { ...venita.potrivire.cantitati },
      nota: `Din măsurători (${venita.pagini === 1 ? "o pagină" : `${venita.pagini} pagini`} din carnet)`,
    };
    dinPoze = venita.potrivire;
  }

  /** Câte materiale mai sunt de comandat (ca în Materiale: necesar − adus − comandat). */
  function deComandat(p: PlanSantier): { deCumparat: number; areComenzi: boolean } {
    const dep = citesteDepozit();
    const necesar = dep.necesare.find((n) => n.santier === p.id);
    const ramas = necesar ? ramasPeNecesar(dep, necesar) : [];
    const areComenzi = (dep.comenzi ?? []).some((c) => c.spre === p.id || c.santier === p.id);
    return { deCumparat: ramas.filter((d) => d.ramas > 0).length, areComenzi };
  }

  function deseneaza(): void {
    const p = plan();
    if (!p) { root.innerHTML = `<p class="alerta" role="alert">Șantierul nu mai există.</p>`; return; }
    const sus = `${mesaj ? `<p class="alerta" role="alert">${esc(mesaj)}</p>` : ""}${
      info ? `<p class="hint" role="status" style="margin:0">${esc(info)}</p>` : ""}`;
    root.innerHTML = sus + {
      situatii: () => panouSituatii(p),
      materiale: () => panouMateriale(p),
      inchidere: () => panouInchidere(p),
      plan: () => panouPlan(p),
    }[fila]();
  }

  function panouSituatii(p: PlanSantier): string {
    const butoane = p.inchis || inLucru ? "" : `<div class="mat-actiuni">
      <button type="button" class="secundar" data-act="situatie-noua">Situație nouă</button>
      <a class="secundar " href="#/masuratori/${encodeURIComponent(p.id)}/situatie">Situație din poze</a>
    </div>`;
    return `${butoane}
      ${inLucru && dinPoze ? cardDinPoze(p, inLucru, dinPoze) : ""}
      ${inLucru ? formularSituatie(p, inLucru) : ""}
      ${istoric(p)}`;
  }

  function panouMateriale(p: PlanSantier): string {
    const dep = citesteDepozit();
    const materiale = dep.necesare.filter((n) => n.santier === p.id).flatMap((n) => n.materiale);
    const scoase = dep.necesare.filter((n) => n.santier === p.id).flatMap((n) => n.scoase ?? []);
    if (p.inchis) return cardInchis(cifreInchidere(p, materiale, dep.miscari, scoase));
    const { deCumparat, areComenzi } = deComandat(p);
    // Regulile se schimbă cât lista n-a plecat încă în lume: fără comenzi și fără situații.
    const poateReguli = !!opt.cerere && !areComenzi && p.situatii.length === 0;
    const butoane = `<div class="mat-actiuni">
      ${poateReguli && !reguli ? `<button type="button" class="secundar" data-act="reguli"${seDeschidReguli ? " disabled" : ""}>${
        seDeschidReguli ? "Se deschide…" : "Schimbă regulile de calcul"}</button>` : ""}
      <a class="secundar " href="#/masuratori/${encodeURIComponent(p.id)}/comanda">Comandă din poze</a>
    </div>`;
    const card = reguli?.cerere ? `${cardNecesar(reguli.cerere.necesar(reguli.r))}${
      reguli.eroare ? `<p class="alerta" role="alert">${esc(reguli.eroare)}</p>` : ""}` : "";
    return `${butoane}${card}${cardMaterial(materialSantier(p, materiale, dep.miscari, dep.comenzi ?? [], scoase), consumPlan(p, dep), deCumparat > 0)}`;
  }

  function panouInchidere(p: PlanSantier): string {
    const dep = citesteDepozit();
    if (p.inchis) {
      const materiale = dep.necesare.filter((n) => n.santier === p.id).flatMap((n) => n.materiale);
      const scoase = dep.necesare.filter((n) => n.santier === p.id).flatMap((n) => n.scoase ?? []);
      return cardInchis(cifreInchidere(p, materiale, dep.miscari, scoase));
    }
    return formularInchidere({ ...restulPeSantier(p, planuri, dep), ...inchidere });
  }

  function panouPlan(p: PlanSantier): string {
    const ultima = p.situatii.at(-1);
    const cumulat = ultima ? randuriSituatie(p, ultima) : null;
    const randuriPlan = p.pozitii.map((poz, i) => {
      const c = cumulat?.[i];
      return `<tr>
        <td>${poz.nr}. ${esc(poz.denumire)}</td>
        <td class="n">${cant(poz.cantitate, poz.um)}</td>
        <td class="n">${eur(poz.pretUnitar)}</td>
        <td class="n">${c ? cant(c.cumulat, poz.um) : "—"}${c?.pesteOferta ? ` ${stare("peste ofertă", "atentie")}` : ""}</td>
      </tr>`;
    });
    const executatPlan = cumulat ? p.pozitii.filter((_, i) => (cumulat[i]?.cumulat ?? 0) > 0).length : 0;
    return `<section class="imp-card"><h2>Planul de șantier · ${p.pozitii.length === 1 ? "o poziție" : `${p.pozitii.length} poziții`}${
      cumulat ? ` · ${executatPlan} începute` : ""}</h2>
      <p class="hint" style="margin:0 0 12px">Pozițiile ofertei, cu prețurile trimise clientului. Nu se schimbă
        dacă se schimbă listele de prețuri.</p>
      ${tabel(["Poziția", "Cant. ofertă", "Preț unitar", "Executat"], randuriPlan, ["", "n", "n", "n"])}
    </section>`;
  }

  function istoric(p: PlanSantier): string {
    const randuri = p.situatii.map((s, i) => {
      const t = totalSituatie(p, s);
      const ultima = i === p.situatii.length - 1;
      return `<tr>
        <td><b>Situația ${s.nr}</b> · ${esc(zi(s.data))}${s.nota ? `<br><span class="hint">${esc(s.nota)}</span>` : ""}</td>
        <td class="n">${eur(t.curent.total)}</td>
        <td class="n">${eur(t.cumulat.total)}</td>
        <td class="fix"><button type="button" class="secundar" data-act="descarca" data-id="${esc(s.id)}">Descarcă</button>${
          ultima && !p.inchis ? ` <button type="button" class="legatura pericol" data-act="scoate-situatie">Șterge</button>` : ""}</td>
      </tr>`;
    });
    return `<section class="imp-card"><h2>Situații de lucrări</h2>
      ${p.situatii.length === 0
        ? `<p class="hint" style="margin:0 0 12px">Nicio situație încă. O situație spune cât s-a executat într-o
          perioadă; valoarea e cantitatea × prețul din ofertă.</p>`
        : tabel(["Situația", "În perioadă", "Cumulat", ""], randuri, ["", "n", "n", ""])}
    </section>`;
  }

  function cardDinPoze(p: PlanSantier, s: Situatie, d: Potrivire): string {
    const pozitiiPuse = new Set(d.puse.map((x) => x.pozitie)).size;
    // Pozitiile cu acelasi material se deosebesc prin zona, iar cand cererea
    // n-are zone, prin cat a mai ramas de executat din ele.
    const rest = new Map(randuriSituatie(p, s).map((x) => [x.poz.nr, x.rest]));
    const deAles = d.deAles.map((x, i) => `<tr>
      <td>${esc(x.rand.text)}<br><span class="hint">${esc(x.rand.zona)}</span></td>
      <td class="n">${cifra(x.rand.cantitate)}</td>
      <td>${x.pozitii.map((nr) => {
        const poz = p.pozitii.find((y) => y.nr === nr);
        return `<button type="button" class="secundar" data-act="pune-la" data-i="${i}" data-nr="${nr}">Poziția ${nr} · ${
          poz?.zona ? esc(poz.zona) : `rămas ${cant(Math.max(0, rest.get(nr) ?? 0), poz?.um ?? "")}`}</button>`;
      }).join(" ")}</td>
    </tr>`);
    const nepotrivite = d.nepotrivite.map((x) => `<tr>
      <td>${esc(x.text)}</td><td>${esc(x.zona)}</td><td class="n">${cifra(x.cantitate)}</td>
    </tr>`);
    return `<section class="imp-card"><h2>Din măsurători</h2>
      ${d.planVechi
        ? `<p class="alerta" role="alert" style="margin:0 0 12px">Șantierul a fost făcut înainte ca aplicația să poată potrivi
          măsurătorile cu oferta. Refă-l din fila Materiale („Schimbă regulile de calcul”, „Refă lista”) cât nu are
          situații, sau scrie cantitățile de mână.</p>`
        : d.puse.length === 0
          ? `<p class="hint" style="margin:0 0 12px">Niciun rând din carnet nu s-a putut pune singur pe o poziție. Alege mai
            jos, sau scrie cantitățile de mână.</p>`
          : `<p class="hint" style="margin:0 0 12px">${d.puse.length === 1 ? "Un rând" : `${d.puse.length} rânduri`} din carnet
            ${d.puse.length === 1 ? "a fost pus" : "au fost puse"} pe ${pozitiiPuse === 1 ? "o poziție" : `${pozitiiPuse} poziții`}
            (marcate „din poze” mai jos). Verifică și salvează.</p>`}
      ${deAles.length ? `<h3>De ales: același material e pe mai multe poziții</h3>
        ${tabel(["Rândul din carnet", "Cantitate", "Pune la"], deAles, ["", "n", ""])}` : ""}
      ${nepotrivite.length ? `<h3>Nu sunt în oferta șantierului</h3>
        <p class="hint" style="margin:0 0 12px">Lucrări în plus, sau scrise altfel decât în ofertă. Nu intră în situație;
          dacă sunt o poziție din ofertă, scrie cantitatea de mână la ea.</p>
        ${tabel(["Rândul din carnet", "Zona", "Cantitate"], nepotrivite, ["", "", "n"])}` : ""}
    </section>`;
  }

  function formularSituatie(p: PlanSantier, s: Situatie): string {
    const r = randuriSituatie(p, s);
    const dinCarnet = new Set(dinPoze?.puse.map((x) => x.pozitie) ?? []);
    const t = totalSituatie(p, s);
    const randuri = r.map((x) => `<tr>
      <td>${x.poz.nr}. ${esc(x.poz.denumire)}</td>
      <td class="n">${cant(x.anterior, x.poz.um)} din ${cant(x.poz.cantitate, x.poz.um)}</td>
      <td class="n"><input name="cant-${x.poz.nr}" type="number" inputmode="decimal" min="0" step="any"
        value="${x.curent || ""}" aria-label="Executat acum, poziția ${x.poz.nr}" style="width:100%;max-width:9rem" />${
        x.pesteOferta ? `<br>${stare("peste ofertă", "atentie")}` : ""}${
        dinCarnet.has(x.poz.nr) && x.curent > 0 ? `<br>${stare("din poze")}` : ""}</td>
    </tr>`);
    return `<form class="imp-card" id="situatie">
      <h2>Situația nr. ${s.nr}</h2>
      <p class="hint" style="margin:0 0 12px">Scrie cât s-a executat în perioada asta (din pozele și notițele de pe
        șantier). Ce s-a executat înainte e din situațiile precedente. „Tot restul” completează
        pozițiile goale cu ce a mai rămas din ofertă.</p>
      <div class="imp-campuri">
        <label>Data situației<input name="data" type="date" value="${s.data.slice(0, 10)}" required /></label>
        <label>Notă (perioada, zona)<input name="nota" value="${esc(s.nota ?? "")}" autocomplete="off" /></label>
      </div>
      ${tabel(["Poziția", "Executat înainte", "Executat acum"], randuri, ["", "n", "n"])}
      <p class="imp-oferta-suma"><span>Valoarea situației</span><strong id="total-situatie">${eur(t.curent.total)}</strong>
        <span>cumulat ${eur(t.cumulat.total)}</span></p>
      ${eroare ? `<p class="alerta" role="alert">${esc(eroare)}</p>` : ""}
      <div class="imp-formular-butoane">
        <button type="submit" class="primar">Salvează</button>
        <button type="button" class="secundar" data-act="tot-restul">Tot restul</button>
        <button type="button" class="secundar" data-act="renunta">Renunță</button>
      </div>
    </form>`;
  }

  /** Citește cantitățile din formular în situația în lucru. */
  function citesteFormular(f: HTMLFormElement): void {
    if (!inLucru) return;
    const date = new FormData(f);
    const cantitati: Record<number, number> = {};
    for (const [k, v] of date) {
      const m = /^cant-(\d+)$/.exec(k);
      const val = String(v).trim().replace(",", ".");
      if (m && val !== "") cantitati[Number(m[1])] = Number(val);
    }
    const d = String(date.get("data") ?? "");
    const notaSit = String(date.get("nota") ?? "").trim();
    const { nota: _, ...rest } = inLucru;
    inLucru = {
      ...rest, cantitati,
      data: d ? new Date(`${d}T12:00:00`).toISOString() : inLucru.data,
      ...(notaSit ? { nota: notaSit } : {}),
    };
  }

  /** Regulile listei, cum le arată cardul: pornesc de la cele cu care s-a făcut lista de acum. */
  function reguliDinNecesar(p: PlanSantier): ReguliNecesar {
    const n = citesteDepozit().necesare.find((x) => x.santier === p.id);
    return {
      pierderi: { ...PIERDERI_IMPLICITE, ...n?.pierderi },
      pragTub: n?.pragTub ?? PRAG_TUB_MM, tuburiPeste: [...(n?.tuburiPeste ?? [])],
    };
  }

  async function deschideRegulile(p: PlanSantier): Promise<void> {
    if (!opt.cerere) return;
    seDeschidReguli = true;
    deseneaza();
    const { deschideReguli } = await import("./import.js");
    const cerere = await deschideReguli(opt.cerere);
    seDeschidReguli = false;
    if (!cerere) { mesaj = "Cererea lucrării nu s-a putut deschide. Reîncarcă pagina."; deseneaza(); return; }
    reguli = { cerere, r: reguliDinNecesar(p), eroare: "" };
    deseneaza();
    root.querySelector<HTMLElement>("#prag-tub")?.focus();
  }

  /** O regulă scrisă în card: lista se socotește din nou, fără să se scrie nimic până la „Refă lista”. */
  function scrieRegula(t: HTMLInputElement | HTMLSelectElement): boolean {
    if (!reguli) return false;
    const r = reguli.r;
    if (t.id === "prag-tub") { reguli.r = { ...r, pragTub: Number(t.value) }; return true; }
    if (t.dataset["act"] === "tub-peste") {
      const d = Number(t.value);
      const bifat = (t as HTMLInputElement).checked;
      reguli.r = { ...r, tuburiPeste: bifat ? [...new Set([...r.tuburiPeste, d])] : r.tuburiPeste.filter((x) => x !== d) };
      return true;
    }
    if (t.dataset["act"] !== "pierdere") return false;
    const v = Number(t.value.replace(",", "."));
    const cat = t.dataset["cat"] as keyof Pierderi;
    if (t.value.trim() === "" || !Number.isFinite(v) || v < 0 || v > 100 || r.pierderi[cat] === v / 100) return false;
    reguli.r = { ...r, pierderi: { ...r.pierderi, [cat]: v / 100 } };
    return true;
  }

  /** Doar cardul regulilor, ca să nu se piardă cursorul din câmpul în care se scrie. */
  function redeseneazaReguli(): void {
    const el = root.querySelector("#necesar");
    if (el && reguli?.cerere) el.outerHTML = cardNecesar(reguli.cerere.necesar(reguli.r));
  }

  root.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-act]");
    if (!b) return;
    const p = plan();
    mesaj = "";
    info = "";
    switch (b.dataset["act"]) {
      case "situatie-noua": if (p && !p.inchis) { inLucru = situatieNoua(p, idNou(), new Date().toISOString()); eroare = ""; } break;
      case "renunta": inLucru = null; dinPoze = null; eroare = ""; break;
      case "pune-la": {
        const i = Number(b.dataset["i"]);
        const nr = Number(b.dataset["nr"]);
        const ales = dinPoze?.deAles[i];
        if (!p || !inLucru || !dinPoze || !ales) return;
        const f = root.querySelector<HTMLFormElement>("#situatie");
        if (f) citesteFormular(f);
        const cantitati = { ...inLucru.cantitati };
        cantitati[nr] = Math.round(((cantitati[nr] ?? 0) + ales.rand.cantitate) * 1000) / 1000;
        inLucru = { ...inLucru, cantitati };
        dinPoze = {
          ...dinPoze,
          puse: [...dinPoze.puse, { rand: ales.rand, pozitie: nr }],
          deAles: dinPoze.deAles.filter((_, k) => k !== i),
        };
        break;
      }
      case "tot-restul": {
        if (!p || !inLucru) return;
        citesteFormular(b.form!);
        const cantitati = { ...inLucru.cantitati };
        for (const x of randuriSituatie(p, { ...inLucru, cantitati: {} })) {
          if (x.rest > 0 && !(cantitati[x.poz.nr]! > 0)) cantitati[x.poz.nr] = x.rest;
        }
        inLucru = { ...inLucru, cantitati };
        break;
      }
      case "scoate-situatie":
        if (!p) return;
        // Consumul situatiei se anuleaza odata cu ea (Faza 6).
        mesaj = stergeUltimaSituatie(p.id) ?? "";
        planuri = citestePlanuri();
        opt.laSchimbare();
        break;
      case "descarca": {
        const s = p?.situatii.find((x) => x.id === b.dataset["id"]);
        if (!p || !s) return;
        void registruSituatie(p, s).then((buf) => descarca(buf, numeSituatie(p, s)));
        return;
      }
      case "reguli": if (p) void deschideRegulile(p); return;
      case "reguli-renunta": reguli = null; break;
      case "refa-lista": {
        if (!reguli?.cerere) return;
        const r = reguli.cerere.aplica(reguli.r);
        if ("eroare" in r) { reguli.eroare = r.eroare; break; }
        reguli = null;
        planuri = citestePlanuri();
        info = "Lista de materiale a fost refăcută cu regulile noi.";
        opt.laSchimbare();
        break;
      }
      default: return;
    }
    deseneaza();
  });

  root.addEventListener("change", (e) => {
    const t = e.target as HTMLInputElement | HTMLSelectElement;
    if (!t.isConnected || !t.closest("#necesar")) return;
    if (t.dataset["act"] === "pierdere") return; // la tastă, mai jos
    if (scrieRegula(t)) redeseneazaReguli();
  });

  // Totalul situației se actualizează la fiecare tastă, fără să redeseneze
  // formularul (s-ar pierde cursorul). Pierderile din regulile listei la fel.
  root.addEventListener("input", (e) => {
    const camp = e.target as HTMLInputElement;
    if (camp.dataset["act"] === "pierdere" && camp.closest("#necesar")) {
      if (scrieRegula(camp)) pastreazaCursorul(root, redeseneazaReguli);
      return;
    }
    // Schimbat ceva in inventar dupa prima apasare: confirmarea se cere din nou.
    const fi = (e.target as HTMLElement).closest<HTMLFormElement>("#form-inchidere");
    if (fi && inchidere.confirma) {
      inchidere = { ...inchidere, confirma: false };
      fi.querySelector("button[type=submit]")!.textContent = "Închide șantierul";
      fi.querySelector("button[type=submit] + .hint")?.remove();
    }
    const f = (e.target as HTMLElement).closest<HTMLFormElement>("#situatie");
    const p = plan();
    if (!f || !p || !inLucru) return;
    citesteFormular(f);
    const t = totalSituatie(p, inLucru);
    f.querySelector("#total-situatie")!.textContent = eur(t.curent.total);
    f.querySelector("#total-situatie + span")!.textContent = `cumulat ${eur(t.cumulat.total)}`;
  });

  root.addEventListener("submit", (e) => {
    e.preventDefault();
    const f = e.target as HTMLFormElement;
    const p = plan();
    if (f.id === "consum-mana" && p) { consumDeMana(p, f); return; }
    if (f.id === "form-inchidere" && p && !p.inchis) {
      // Inventarul de la sfarsit (Faza 7): prima apasare verifica, a doua inchide.
      const dep = citesteDepozit();
      const { stoc } = restulPeSantier(p, planuri, dep);
      const scris: typeof inchidere.scris = {};
      for (const el of f.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-cheie]")) {
        const k = el.dataset["cheie"]!;
        scris[k] = { ...scris[k], [el.name === "numarat" ? "numarat" : "unde"]: el.value };
      }
      const inventar = randuriInchidere(stoc, scris);
      const nume = (cheie: string): string => stoc.find((r) => r.cheie === cheie)?.nume ?? cheie;
      const gresit = valideazaInchidere({ santier: p.id, inventar }, dep.miscari, nume);
      if (gresit) inchidere = { scris, eroare: gresit, confirma: false, deschis: true };
      else if (!inchidere.confirma) inchidere = { scris, eroare: "", confirma: true, deschis: true };
      else {
        const refuz = inchideSantier(p.id, inventar, nume);
        inchidere = refuz ? { scris, eroare: refuz, confirma: false, deschis: true } : { scris: {}, eroare: "", confirma: false, deschis: false };
        if (!refuz) { planuri = citestePlanuri(); opt.laSchimbare(); }
      }
      deseneaza();
      return;
    }
    if (f.id !== "situatie" || !p || !inLucru) return;
    citesteFormular(f);
    const problema = valideazaSituatie(p, inLucru);
    if (problema) { eroare = problema; deseneaza(); return; }
    // Situatia scrie si consumul de material (Faza 6).
    const r = salveazaSituatie(p.id, inLucru);
    if ("eroare" in r) { eroare = r.eroare; deseneaza(); return; }
    planuri = citestePlanuri();
    info = r.consum ? `Situația a scris consumul pe ${r.consum === 1 ? "un material" : `${r.consum} materiale`}.` : "";
    inLucru = null;
    dinPoze = null;
    eroare = "";
    deseneaza();
    opt.laSchimbare();
  });

  /** Consumul notat de mână (S7 b), din stocul șantierului, pe mărcile de acolo. */
  function consumDeMana(p: PlanSantier, f: HTMLFormElement): void {
    const date = new FormData(f);
    const cantitate = Number(String(date.get("cantitate") ?? "").replace(",", "."));
    const dep = citesteDepozit();
    const m = consumPlan(p, dep).materiale.find((x) => x.cheie === date.get("cheie"));
    if (!m || !(cantitate > 0)) return;
    const nota = String(date.get("nota") ?? "").trim();
    const data = new Date().toISOString();
    const noi = dinMarci(m.articol, cantitate, dep.miscari, p.id).map((x) => ({
      id: idNou(), data, tip: "consum" as const, articol: x.articol, cantitate: x.cantitate, din: p.id, lucrareId: p.id,
      nota: nota ? `notat de mână · ${nota}` : "notat de mână",
    }));
    if (!scrieDepozit({ ...dep, miscari: [...dep.miscari, ...noi] })) mesaj = "Browserul nu permite salvarea: modificarea se pierde la reîncărcare.";
    deseneaza();
    opt.laSchimbare();
  }

  deseneaza();
  return {
    arata: (f) => { fila = f; mesaj = ""; info = ""; deseneaza(); },
    situatieNoua: () => {
      const p = plan();
      fila = "situatii";
      if (p && !p.inchis && !inLucru) { inLucru = situatieNoua(p, idNou(), new Date().toISOString()); eroare = ""; }
      deseneaza();
      root.querySelector<HTMLInputElement>("#situatie input[name^='cant-']")?.focus();
    },
  };
}
