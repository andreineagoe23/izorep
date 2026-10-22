/**
 * Lucrări: șantierele făcute din oferte și situațiile lor de lucrări.
 *
 * Fluxul firmei (29 septembrie 2026): oferta pleacă la client, apoi din ea se
 * face șantierul (pasul „Oferta” din import, „Creează șantierul”). Aici se
 * vede planul — pozițiile ofertei, înghețate — cât s-a executat, materialele
 * de comandat și istoricul situațiilor. Logica e în `src/lucrari/situatii.ts`;
 * datele stau în browser (`web/lucrari-local.ts`), ca la depozit.
 */
import { data as dataRo, esc, eur, indicator, nota, progres, stare, tabel, type Ecran } from "./tip.js";
import type { Lucrare, StareLucrare } from "../date/seed.js";
import { exemple, type Exemple } from "../date/exemple.js";
import { vedeCosturi } from "../nav.js";
import {
  citesteDepozit, citestePlanuri, iaDeDeschis, idNou, inchideSantier, modDate, salveazaSituatie, scrieDepozit, scriePlanuri,
  ceSeVaSterge, stergeDeTot, stergeUltimaSituatie,
} from "../date.js";
import { legaPanouStergere, panouStergere } from "../confirmare.js";
import { consumPlan } from "../consum-vizual.js";
import { dinMarci } from "../../src/stoc/consum.js";
import { ramasPeNecesar } from "../materiale.js";
import { deComandat, solduri } from "../../src/stoc/registru.js";
import { cifra } from "../stoc-vizual.js";
import { descarca } from "../descarca.js";
import { numeSituatie, registruSituatie } from "../situatie.js";
import { preiaSituatie } from "../predare.js";
import type { Potrivire } from "../../src/lucrari/potrivire.js";
import { cifreInchidere, materialSantier, valideazaInchidere } from "../../src/lucrari/inchidere.js";
import { cardInchis, cardMaterial, formularInchidere, randuriInchidere, restulPeSantier } from "../inchidere-vizual.js";
import {
  progresPlan, randuriSituatie, situatieNoua, totalSituatie, valideazaSituatie, valoareOferta,
  type PlanSantier, type Situatie,
} from "../../src/lucrari/situatii.js";

/** Eticheta afisata si tonul indicatorului `stare()`, per stare de lucrare. */
const ETICHETA_STARE: Record<StareLucrare, { text: string; ton: "ok" | "atentie" | "neutru" }> = {
  ofertata: { text: "Ofertată", ton: "neutru" },
  in_executie: { text: "În execuție", ton: "neutru" },
  de_inchis: { text: "De închis", ton: "atentie" },
  inchisa: { text: "Închisă", ton: "ok" },
};

function randTabel(ex: Exemple, l: Lucrare): string {
  const c = ex.client(l.clientId);
  const s = ex.santier(l.santierId);
  const et = ETICHETA_STARE[l.stare];

  const coloaneBani = vedeCosturi()
    ? `<td class="n">${l.contractat !== null ? eur(l.contractat) : "—"}</td><td class="n">${eur(l.facturat)}</td>`
    : "";

  return `<tr>
    <td><b>${esc(l.id)}</b><br><span class="hint">${esc(l.denumire)}</span></td>
    <td>${esc(c?.denumire ?? "—")}<br><span class="hint">${esc(s?.denumire ?? "—")}</span></td>
    <td>${l.inceput ? dataRo(l.inceput) : "—"}</td>
    <td>${progres(l.progres)}</td>
    ${coloaneBani}
    <td>${stare(et.text, et.ton)}</td>
  </tr>`;
}

/** Lucrările din datele firmei (exemplu, citite din fișierele lor): doar pe linkul demo. */
function lucrariExemplu(): string {
  const ex = exemple();
  if (!ex) return notaInchidere;
  const capete = [
    "Lucrare", "Client / Șantier", "Început", "Progres", ...(vedeCosturi() ? ["Contractat", "Facturat"] : []), "Stare",
  ];
  const clase = ["", "", "", "", ...(vedeCosturi() ? ["n", "n"] : []), ""];
  return `<section class="imp-card"><h2>Lucrările din datele firmei</h2>
    <p class="hint" style="margin:0 0 12px">Exemplu, citit din ofertele semnate: nu au plan de șantier în aplicație.</p>
    ${tabel(capete, ex.LUCRARI.map((l) => randTabel(ex, l)), clase)}
  </section>
  ${notaInchidere}`;
}

const notaInchidere = `${nota(
    `Când se termină o lucrare, șantierul se închide din pagina lui: șeful de lucrare numără ce a rămas, iar fiecare ` +
      `material pleacă înapoi în depozit, pe alt șantier, la furnizor, sau se scrie ca pierdut, furat ori reciclat. ` +
      `Materialul de pe fiecare șantier se vede și în <a href="#/materiale">Materiale</a>.`,
)}`;

const zi = (iso: string): string => new Date(iso).toLocaleDateString("ro-RO");
const cant = (n: number, um: string): string => `${cifra(n)}${um ? ` ${esc(um)}` : ""}`;

export const ecran: Ecran = {
  id: "lucrari",
  titlu: "Șantiere",
  subtitlu:
    "Șantierele făcute din oferte: planul, materialele de comandat și situațiile de lucrări, cu istoricul lor.",
  render(root) {
    let planuri = citestePlanuri();
    // Pagina unui șantier are adresa ei (`#/lucrari/<id>`, 21 octombrie 2026):
    // „Înapoi” din browser, reîncărcarea și un link trimis unui coleg duc tot aici.
    const dinAdresa = decodeURIComponent(location.hash.replace(/^#\/?/, "").split("/")[1] ?? "") || null;
    let deschis: string | null = iaDeDeschis() ?? (dinAdresa && planuri.some((p) => p.id === dinAdresa) ? dinAdresa : null);
    let inLucru: Situatie | null = null;
    let eroare = "";
    let stergeDe: string | null = null;
    let mesaj = "";
    /** Ce a facut ultima salvare (consumul scris): informatie, nu eroare. */
    let info = "";
    /** Ce s-a șters de tot, spus pe lista șantierelor. */
    let sters = "";
    /** Inchiderea (Faza 7): ce a scris omul, eroarea, a doua apasare, cardul deschis. */
    let inchidere = { scris: {} as Record<string, { numarat?: string; unde?: string }>, eroare: "", confirma: false, deschis: false };
    /** Situatia in lucru a venit din „Măsurători”: ce s-a pus, ce e de ales, ce nu e in oferta. */
    let dinPoze: Potrivire | null = null;

    // Deschis din altă parte (o situație venită din poze): adresa arată șantierul, fără navigare nouă.
    const potrivesteAdresa = (): void => {
      if (deschis && dinAdresa !== deschis) history.replaceState(null, "", `#/lucrari/${encodeURIComponent(deschis)}`);
    };
    const venita = preiaSituatie();
    const tinta = venita && planuri.find((p) => p.id === venita.plan);
    if (venita && tinta?.inchis) {
      deschis = tinta.id;
      mesaj = "Șantierul e închis: nu mai primește situații de lucrări.";
    } else if (venita && tinta) {
      deschis = tinta.id;
      inLucru = {
        ...situatieNoua(tinta, idNou(), new Date().toISOString()),
        cantitati: { ...venita.potrivire.cantitati },
        nota: `Din măsurători (${venita.pagini === 1 ? "o pagină" : `${venita.pagini} pagini`} din carnet)`,
      };
      dinPoze = venita.potrivire;
    }

    const salveaza = (): void => {
      if (!scriePlanuri(planuri)) mesaj = "Browserul nu permite salvarea: modificarea se pierde la reîncărcare.";
    };
    const plan = (): PlanSantier | undefined => planuri.find((p) => p.id === deschis);

    function deseneaza(): void {
      const p = plan();
      root.innerHTML = `<div class="imp">${p ? detaliu(p) : lista()}</div>`;
    }

    function lista(): string {
      const randuri = planuri.map((p) => {
        const v = valoareOferta(p);
        return `<tr>
          <td><b>${esc(p.denumire)}</b>${p.inchis ? ` ${stare("închis", "ok")}` : ""}<br><span class="hint">${esc(p.client || "—")}</span></td>
          <td>${esc(p.oferta || "—")}${p.oferta?.includes(zi(p.creat)) ? "" : `<br><span class="hint">șantier din ${esc(zi(p.creat))}</span>`}</td>
          <td class="n">${eur(v.total)}</td>
          <td>${progres(progresPlan(p))}</td>
          <td class="n">${p.situatii.length}</td>
          <td class="fix"><button type="button" class="secundar" data-act="deschide" data-id="${esc(p.id)}">Deschide</button></td>
        </tr>`;
      });
      return `<section class="imp-card"><h2>Șantiere din oferte</h2>${sters ? `<p class="hint" role="status">${esc(sters)}</p>` : ""}
        ${planuri.length === 0
          ? `<p class="hint" style="margin:0">Niciun șantier încă. În <a href="#/import">Cerere nouă</a>, la pasul
            „Oferta”, după ce descarci oferta, „Creează șantierul” face planul de șantier din ea și trimite materialele
            la depozit.</p>`
          : `${modDate() === "server" ? "" : `<p class="hint" style="margin:0 0 12px">Prototip: șantierele stau doar în acest browser.</p>`}
            ${tabel(["Șantier", "Oferta", "Valoare ofertă", "Executat", "Situații", ""], randuri, ["", "", "n", "", "n", ""])}`}
      </section>${lucrariExemplu()}`;
    }

    function detaliu(p: PlanSantier): string {
      const v = valoareOferta(p);
      const ultima = p.situatii.at(-1);
      const executat = ultima ? totalSituatie(p, ultima).cumulat : null;
      const dep = citesteDepozit();
      const necesar = dep.necesare.find((n) => n.santier === p.id);
      // Ca in Depozit (Faza 4): necesar − adus − comandat. Nu stocul de acum: din Faza 6
      // consumul din situatii scade stocul, iar materialul pus nu se mai comanda.
      const ramas = necesar ? ramasPeNecesar(dep, necesar) : [];
      const deCumparat = ramas.filter((d) => d.ramas > 0).length;
      const peCiorne = ramas.filter((d) => d.ramas === 0 && d.inCiorna > 0).length;
      const cumulat = ultima ? randuriSituatie(p, ultima) : null;
      const materiale = dep.necesare.filter((n) => n.santier === p.id).flatMap((n) => n.materiale);
      const scoase = dep.necesare.filter((n) => n.santier === p.id).flatMap((n) => n.scoase ?? []);
      // Faza 7: ce vede directorul (S9) sau, inchis, cifrele lui; inventarul de inchidere, dupa situatii.
      const material = p.inchis
        ? cardInchis(cifreInchidere(p, materiale, dep.miscari, scoase))
        : cardMaterial(materialSantier(p, materiale, dep.miscari, dep.comenzi ?? [], scoase), consumPlan(p, dep));
      const inchide = p.inchis ? "" : formularInchidere({ ...restulPeSantier(p, planuri, dep), ...inchidere });

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
      return `
        <p style="margin:0"><button type="button" class="legatura" data-act="inapoi">← Toate lucrările</button></p>
        <header class="pagina-antet">
          <div>
            <h2>${esc(p.denumire)}${p.inchis ? ` ${stare("închis", "ok")}` : ""}</h2>
            <p class="hint">${esc(p.client || "—")} · oferta ${esc(p.oferta || p.fisier)} · ${esc(p.firma)}${
              p.ajustareProcent ? ` · prețuri ajustate cu ${cifra(p.ajustareProcent)} %` : ""}${
              p.discountProcent ? ` · discount ${cifra(p.discountProcent)} %` : ""}${
              p.adaosFocProcent ? ` · +${p.adaosFocProcent} % pe închiderile la foc` : ""}</p>
          </div>
          ${inLucru || p.inchis ? "" : `<button type="button" class="primar" data-act="situatie-noua">Situație nouă</button>`}
        </header>
        ${mesaj ? `<p class="alerta" role="alert">${esc(mesaj)}</p>` : ""}
        ${info ? `<p class="hint" role="status" style="margin:0">${esc(info)}</p>` : ""}
        <div class="stats">
          ${indicator(eur(v.total), "Valoare ofertă", p.oferta || p.fisier)}
          ${indicator(eur(executat?.total ?? 0), "Executat, cumulat", `${progresPlan(p)} % din ofertă`)}
          ${indicator(String(p.situatii.length), "Situații de lucrări")}
          ${p.inchis ? "" : indicator(String(deCumparat), "Materiale de comandat", !necesar ? "fără necesar"
            : peCiorne ? `și ${peCiorne} pe ciorne netrimise` : "rămase din necesarul ofertei")}
        </div>
        ${inLucru && dinPoze ? cardDinPoze(p, inLucru, dinPoze) : ""}
        ${inLucru ? formularSituatie(p, inLucru) : ""}
        ${istoric(p)}
        ${material}
        <details class="imp-card">
          <summary>Planul de șantier · ${p.pozitii.length === 1 ? "o poziție" : `${p.pozitii.length} poziții`}${
            cumulat ? ` · ${executatPlan} începute` : ""}</summary>
          <p class="hint" style="margin:0 0 12px">Pozițiile ofertei, cu prețurile trimise clientului. Nu se schimbă
            dacă se schimbă listele de prețuri. Materialele lor sunt în <a href="#/materiale">Materiale</a>.</p>
          ${tabel(["Poziția", "Cant. ofertă", "Preț unitar", "Executat"], randuriPlan, ["", "n", "n", "n"])}
        </details>
        ${inchide}
        <details class="imp-card"${stergeDe === p.id ? " open" : ""}>
          <summary>Șterge șantierul</summary>
          ${stergeDe === p.id ? panouStergere({ ce: `șantierul „${p.denumire}”`, linii: ceSeVaSterge({ santier: p.id }), date: { id: p.id },
            ...(mesaj ? { eroare: mesaj } : {}) })
          : `<p class="hint" style="margin:0 0 12px">Șterge de tot șantierul și tot ce ține de el: situațiile, necesarul,
            comenzile și mișcările de stoc. Cererea și oferta rămân. Înainte să ștergi, vezi lista cu tot ce pleacă.</p>
          <div class="imp-formular-butoane"><button type="button" class="secundar" data-act="sterge" data-id="${esc(p.id)}">Șterge șantierul…</button></div>`}
        </details>`;
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
            măsurătorile cu oferta. Refă-l din ofertă (Cerere nouă → pasul „Oferta” → „Creează șantierul”) cât nu are
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

    legaPanouStergere(root);
    root.addEventListener("click", (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-act]");
      if (!b) return;
      const p = plan();
      mesaj = "";
      info = "";
      switch (b.dataset["act"]) {
        case "deschide": location.hash = `#/lucrari/${encodeURIComponent(b.dataset["id"] ?? "")}`; return;
        case "inapoi": location.hash = "#/lucrari"; return;
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
          break;
        case "descarca": {
          const s = p?.situatii.find((x) => x.id === b.dataset["id"]);
          if (!p || !s) return;
          void registruSituatie(p, s).then((buf) => descarca(buf, numeSituatie(p, s)));
          return;
        }
        case "sterge": {
          // Primul pas: panoul cu ce se șterge. Ștergerea e abia după bifă și „Șterge definitiv”.
          stergeDe = b.dataset["id"] ?? null;
          deseneaza();
          root.querySelector<HTMLElement>('.sterge-panou [data-act="sterge-bifa"]')?.focus();
          return;
        }
        case "sterge-renunta": stergeDe = null; break;
        case "sterge-definitiv": {
          const id = b.dataset["id"]!;
          const denumire = planuri.find((x) => x.id === id)?.denumire ?? id;
          b.disabled = true;
          b.textContent = "Se șterge…";
          void stergeDeTot({ santier: id }).then((refuz) => {
            if (refuz) mesaj = `Nu s-a șters: ${refuz}`;
            else {
              planuri = citestePlanuri();
              deschis = null;
              // Adresa fără șantierul șters, fără o navigare nouă (mesajul de mai jos rămâne).
              history.replaceState(null, "", "#/lucrari");
              stergeDe = null;
              sters = `Am șters șantierul „${denumire}” și tot ce ținea de el.`;
            }
            deseneaza();
          });
          return;
        }
        default: return;
      }
      deseneaza();
    });

    // Totalul situației se actualizează la fiecare tastă, fără să redeseneze
    // formularul (s-ar pierde cursorul).
    root.addEventListener("input", (e) => {
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
          if (!refuz) planuri = citestePlanuri();
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
    });

    /** Consumul notat de mână (S7 b), din stocul șantierului, pe mărcile de acolo. */
    function consumDeMana(p: PlanSantier, f: HTMLFormElement): void {
      const date = new FormData(f);
      const cant = Number(String(date.get("cantitate") ?? "").replace(",", "."));
      const dep = citesteDepozit();
      const m = consumPlan(p, dep).materiale.find((x) => x.cheie === date.get("cheie"));
      if (!m || !(cant > 0)) return;
      const nota = String(date.get("nota") ?? "").trim();
      const data = new Date().toISOString();
      const noi = dinMarci(m.articol, cant, dep.miscari, p.id).map((x) => ({
        id: idNou(), data, tip: "consum" as const, articol: x.articol, cantitate: x.cantitate, din: p.id, lucrareId: p.id,
        nota: nota ? `notat de mână · ${nota}` : "notat de mână",
      }));
      if (!scrieDepozit({ ...dep, miscari: [...dep.miscari, ...noi] })) mesaj = "Browserul nu permite salvarea: modificarea se pierde la reîncărcare.";
      deseneaza();
    }

    potrivesteAdresa();
    deseneaza();
  },
};
