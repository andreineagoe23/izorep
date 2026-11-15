/**
 * Marcajul Fazei 7 pe ecranul Lucrări: materialul șantierului (S9), inventarul
 * de la închidere și cifrele șantierului închis. Funcții pure, ca
 * `web/santier-vizual.ts`: fără DOM, testate în Node, orice text din date trece
 * prin `esc()`. Logica e în `src/lucrari/inchidere.ts`.
 */
import { esc, eur, stare, tabel } from "./ecrane/tip.js";
import { cantitate, cifra, felMaterial, numeArticol, propozitieMateriale, stareMaterial } from "./stoc-vizual.js";
import {
  PIERDERI, stocSantier, type CifreInchidere, type Destinatie, type MaterialSantier, type Pierdere, type RandMaterial,
  type RestNumarat,
} from "../src/lucrari/inchidere.js";
import type { PlanSantier } from "../src/lucrari/situatii.js";
import { articolDin, esteAnulata, type Articol, type Miscare } from "../src/stoc/registru.js";
import { stareComanda, type Comanda, type DeComandatSantier } from "../src/stoc/comenzi.js";
import { cheieBaza } from "../src/stoc/registru.js";
import { PRAG_PIERDERE, type ConsumMaterial, type ConsumSantier } from "../src/stoc/consum.js";
import type { MaterialNecesar } from "../src/stoc/necesar.js";
import { formularConsumMana, randPierdere } from "./consum-vizual.js";
import { ATELIER, CENTRAL, inAtelier } from "../src/stoc/locuri.js";

const zi = (iso: string): string => new Date(iso).toLocaleDateString("ro-RO");
const cant = (n: number, a: Articol): string => (n === 0 ? "—" : cantitate(n, a.um));

/** „12.345,67 € — 41,2 % din 29.950,00 € în ofertă”, pe trei rânduri, ca suma situației. */
function suma(eticheta: string, c: { cost: number; inOferta: number; procent: number | null; faraPret: number }): string {
  const fata = c.procent === null ? "fără valoare în ofertă pentru materialele lui"
    : `${cifra(c.procent)} % din ${eur(c.inOferta)} în ofertă`;
  const fara = c.faraPret > 0
    ? ` · ${c.faraPret === 1 ? "un material n-are preț și nu intră" : `${c.faraPret} materiale n-au preț și nu intră`} în cost` : "";
  return `<p class="imp-oferta-suma"><span>${esc(eticheta)}</span><strong>${eur(c.cost)}</strong><span>${fata}${fara}</span></p>`;
}

/** Un rând de pe fila Materiale a lucrării. */
export interface RandLucrare {
  articol: Articol;
  /** Materialul de pe listă; lipsește la ce a venit pe șantier fără să fie pe listă. */
  material?: MaterialNecesar;
  /** Trebuie, adus, comandat, rămas de comandat (ca în Materiale › De cumpărat). */
  d?: DeComandatSantier;
  /** Ce s-a întâmplat cu el pe șantier: comandat, venit, pus, rămas, pierdere (text, neescapat). */
  intamplat: string[];
  /** Pierderea trece de prag. */
  pestePrag: boolean;
}

export interface MaterialeLucrare {
  /** Lista șantierului (necesarul), în ordinea ei. */
  materiale: readonly MaterialNecesar[];
  /** `ramasPeNecesar` pe lista de mai sus. */
  ramas: readonly DeComandatSantier[];
  santier: MaterialSantier;
  consum?: ConsumSantier | undefined;
}

const PRAG_PROCENT = PRAG_PIERDERE * 100;

/** Ce s-a întâmplat cu un material pe șantier; gol când nimic (atunci nici nu se scrie). */
function intamplat(r: RandMaterial | undefined, c: ConsumMaterial | undefined): { parti: string[]; pestePrag: boolean } {
  const parti: string[] = [];
  if (r) {
    const um = r.articol.um;
    if (r.comandat) parti.push(`comandat ${cantitate(r.comandat, um)}`);
    if (r.venit) parti.push(`venit ${cantitate(r.venit, um)}`);
    if (r.pus) parti.push(`pus ${cantitate(r.pus, um)}`);
    if (r.ramas > 0) parti.push(`rămas ${cantitate(r.ramas, um)}`);
    if (r.ramas < 0) parti.push(`sold negativ −${cantitate(-r.ramas, um)}`);
  }
  let pestePrag = false;
  if (c && c.pierdereProcent !== null && Math.abs(c.pierdere) >= 0.005) {
    const semn = c.pierdere > 0 ? "+" : "−";
    parti.push(`pierdere ${semn}${cantitate(Math.abs(c.pierdere), c.um)} (${cifra(c.pierdereProcent)} %)`);
    pestePrag = c.pierdereProcent > PRAG_PROCENT;
  }
  return { parti, pestePrag };
}

/**
 * Rândurile filei Materiale a lucrării (15 noiembrie 2026, planul UX, Faza 4):
 * ce trebuie să vadă omul (`vazute`) și ce are tot (`strinse`), care stă într-un
 * singur rând până îl desface. Materialul venit fără să fie pe listă e la
 * coada celor văzute. Pur: îl folosește cardul și îl țin testele.
 */
export function randuriLucrare(x: MaterialeLucrare): { vazute: RandLucrare[]; strinse: RandLucrare[] } {
  const pe = new Map(x.ramas.map((d) => [d.material, d]));
  const peCheie = new Map(x.santier.randuri.map((r) => [cheieBaza(r.articol), r]));
  const consum = new Map((x.consum?.materiale ?? []).map((c) => [c.cheie, c]));
  const folosite = new Set<string>();
  const vazute: RandLucrare[] = [];
  const strinse: RandLucrare[] = [];
  for (const m of x.materiale) {
    const d = pe.get(m);
    const articol = d?.articol ?? articolDin(m);
    const cheie = cheieBaza(articol);
    // Același material de două ori pe listă: ce s-a întâmplat se spune o singură dată.
    const prima = !folosite.has(cheie);
    folosite.add(cheie);
    const i = prima ? intamplat(peCheie.get(cheie), consum.get(cheie)) : { parti: [], pestePrag: false };
    const rand: RandLucrare = { articol, material: m, ...(d ? { d } : {}), intamplat: i.parti, pestePrag: i.pestePrag };
    (felMaterial(m, d) === "gata" && !i.pestePrag ? strinse : vazute).push(rand);
  }
  for (const r of x.santier.randuri) {
    const cheie = cheieBaza(r.articol);
    if (folosite.has(cheie)) continue;
    folosite.add(cheie);
    const i = intamplat(r, consum.get(cheie));
    vazute.push({ articol: r.articol, intamplat: i.parti, pestePrag: i.pestePrag });
  }
  // Un singur rând strâns n-ar economisi nimic: se arată.
  return strinse.length < 2 ? { vazute: [...vazute, ...strinse], strinse: [] } : { vazute, strinse };
}

function randLucrare(r: RandLucrare): string {
  const um = r.articol.um;
  const trebuie = r.d ? r.d.necesar : r.material ? (um === "ml" ? r.material.ml : r.material.m2) : 0;
  const stareRand = r.material ? stareMaterial(r.material, r.d) : stare("Nu e pe listă", "neutru");
  return `<tr>
    <td>${esc(numeArticol(r.articol))}${r.material?.manual ? `<br><span class="hint">adăugat de mână: ${esc(r.material.manual)}</span>` : ""}${
      r.intamplat.length ? `<br><span class="hint">${esc(r.intamplat.join(" · "))}</span>` : ""}${
      r.pestePrag ? ` ${stare(`pierdere peste ${PRAG_PROCENT} %`, "atentie")}` : ""}</td>
    <td class="n">${trebuie > 0 ? cantitate(trebuie, um) : "—"}</td>
    <td class="n">${r.d && r.d.adus > 0 ? cantitate(r.d.adus, um) : "—"}</td>
    <td>${stareRand}</td>
  </tr>`;
}

/**
 * Fila Materiale a lucrării: același tabel ca Materiale › De cumpărat
 * (Material · Trebuie · Adus pe șantier · Stare), cu „Comandă ce lipsește”.
 * Ce are tot stă într-un rând („Încă 6 materiale, toate pe șantier”), care se
 * desface (`desfacut`). Comandat, venit, pus, rămas și pierderea se scriu sub
 * numele materialului, doar unde s-a întâmplat ceva: până pe 15 noiembrie 2026
 * erau opt coloane, pe TRANSAVIA cele mai multe pline de „—”. Jos, costul
 * față de ofertă, pierderea pe tot șantierul și consumul de mână.
 *
 * `comanda`: butonul „Comandă ce lipsește” (albastru doar când e pasul
 * lucrării; altfel alb), sau nimic când nu lipsește nimic.
 */
export function cardMaterial(x: MaterialeLucrare, opt: { comanda?: "primar" | "secundar"; desfacut?: boolean } = {}): string {
  const m = x.santier;
  if (m.randuri.length === 0 && x.materiale.length === 0) {
    return `<section class="imp-card"><h2>Materialul șantierului</h2>
      <p class="hint" style="margin:0">Șantierul nu are încă listă de materiale și nici material adus.</p></section>`;
  }
  const { vazute, strinse } = randuriLucrare(x);
  const desfacut = opt.desfacut || strinse.length === 0;
  const randuri = [...vazute, ...(desfacut ? strinse : [])].map(randLucrare);
  if (strinse.length > 0) {
    randuri.push(`<tr><td colspan="4"><button type="button" class="secundar" data-act="arata-gata" aria-expanded="${desfacut}">${
      desfacut ? "Strânge materialele care au tot"
        : vazute.length === 0 ? `Toate cele ${cifra(strinse.length)} materiale sunt pe șantier`
          : `Încă ${cifra(strinse.length)} materiale, toate pe șantier`}</button></td></tr>`);
  }
  const c = x.consum;
  // Nimic venit încă (șantier nou): „0,00 €, 0 %” nu spunea nimic (15 noiembrie 2026).
  const nimicVenit = m.cost.cost === 0 && m.cost.faraPret === 0;
  return `<section class="imp-card mat-necesar">
    <div class="mat-antet">
      <div><h2>Materialul șantierului</h2>${x.materiale.length ? `<p>${propozitieMateriale(x.materiale, x.ramas)}</p>` : ""}</div>
      ${opt.comanda ? `<div class="mat-actiuni"><button type="button" class="${opt.comanda}" data-act="comanda-lipsa">Comandă ce lipsește</button></div>` : ""}
    </div>
    ${tabel(["Material", "Trebuie", "Adus pe șantier", "Stare"], randuri, ["", "n", "n", ""])}
    ${nimicVenit ? `<p class="hint">Costul materialului se vede aici după ce vine primul material pe șantier.</p>` : `${suma("Costul materialului, până acum", m.cost)}
    <p class="hint">Costul e ce a rămas pe șantier (pus, pierdut sau încă acolo), la prețul cu care a venit: prețul facturii
      pentru ce s-a cumpărat pentru șantier, prețul mediu pentru ce a venit din depozit sau de pe alt șantier. „În ofertă” e
      cât plătește clientul pe aceste materiale, cu manopera.</p>`}
    ${c ? randPierdere(c) : ""}
    ${c ? formularConsumMana(c) : ""}
  </section>`;
}

/* ---------------------------------------------------- inventarul de închidere */

export interface RestPeSantier {
  cheie: string;
  articol: Articol;
  /** Numele materialului, pentru om (`numeArticol`). */
  nume: string;
  /** Cât arată registrul. */
  scriptic: number;
  /** Furnizorii care l-au adus pe șantier: spre ei se poate întoarce. */
  furnizori: string[];
}

/** Locul implicit pentru rest: înapoi în central (S8: „se întoarce în depozit”). */
const IMPLICIT = `depozit:${CENTRAL}`;

/**
 * Ce e de numărat pe șantier, unde poate pleca și ce trebuie știut înainte:
 * tabla pusă deoparte în atelier pentru el, comenzile care n-au venit toate.
 */
export function restulPeSantier(
  p: PlanSantier, planuri: readonly PlanSantier[], d: { miscari: readonly Miscare[]; comenzi?: readonly Comanda[] },
): Pick<FormularInchidere, "stoc" | "locuri" | "atentie"> {
  const stoc = stocSantier(d.miscari, p.id).map((s): RestPeSantier => ({
    cheie: s.articol.cheie, articol: s.articol, nume: numeArticol(s.articol), scriptic: s.cantitate,
    furnizori: [...new Set(d.miscari.filter((m) => m.tip === "intrare" && m.spre === p.id && m.furnizor
      && m.articol.cheie === s.articol.cheie && !m.anuleaza && !esteAnulata(m, d.miscari)).map((m) => m.furnizor!))],
  }));
  const locuri = [
    { id: CENTRAL, nume: "Depozitul central" },
    { id: ATELIER, nume: "Atelier București" },
    ...planuri.filter((x) => x.id !== p.id && !x.inchis).map((x) => ({ id: x.id, nume: `Șantier ${x.denumire}` })),
  ];
  const atentie: string[] = [];
  const deoparte = inAtelier(d.miscari).filter((x) => x.pentru === p.id);
  if (deoparte.length) {
    atentie.push(`În atelier e pus deoparte pentru șantier: ${deoparte.map((x) => `${numeArticol(x.articol)}, ${cantitate(x.cantitate, x.articol.um)}`).join("; ")}. `
      + "După închidere nu mai poate pleca pe șantier: trimite-l acum, sau lasă-l în atelier pentru altă lucrare.");
  }
  for (const c of d.comenzi ?? []) {
    if (c.anulata || !c.trimisa || (c.spre !== p.id && c.santier !== p.id)) continue;
    const st = stareComanda(c, d.miscari);
    if (st === "trimisa" || st === "partial") {
      atentie.push(`Comanda la ${c.furnizor} din ${zi(c.trimisa)} n-a venit toată. Anuleaz-o în Comenzi, sau la recepție alege alt loc decât șantierul.`);
    }
  }
  // Pus mai mult decât a venit pe șantier: la închidere diferența intră la
  // inventar, dar fără preț, iar costul ieșea „0,00 €, 0 %” fără nicio
  // explicație (16 octombrie 2026).
  const cuMinus = stoc.filter((r) => r.scriptic < 0);
  if (cuMinus.length) {
    atentie.push(`${cuMinus.length === 1 ? "Un material e" : `${cuMinus.length} materiale sunt`} în registru cu minus: `
      + "s-a pus pe șantier mai mult decât a venit. Fără recepția sau transferul lipsă, materialul acela nu are preț și nu intră în cost. "
      + "Trece întâi intrările lipsă, apoi închide.");
  }
  return { stoc, locuri, atentie };
}

const numar = (v: string | undefined): number => Number(String(v ?? "").trim().replace(",", "."));

/** Ce a scris omul în formular → inventarul de închidere (o destinație pe material). */
export function randuriInchidere(stoc: readonly RestPeSantier[], scris: FormularInchidere["scris"]): RestNumarat[] {
  return stoc.map((r) => {
    const s = scris[r.cheie] ?? {};
    const numarat = s.numarat === undefined || s.numarat.trim() === "" ? Math.max(0, r.scriptic) : numar(s.numarat);
    const unde = destinatieDin(s.unde ?? IMPLICIT);
    return {
      cheie: r.cheie, scriptic: r.scriptic, numarat,
      destinatii: numarat > 0 && unde ? [{ unde, cantitate: numarat }] : [],
    };
  });
}

export interface FormularInchidere {
  stoc: RestPeSantier[];
  /** Unde poate pleca materialul: centralul, atelierul, celelalte șantiere deschise. */
  locuri: { id: string; nume: string }[];
  /** Ce a scris omul până acum, pe cheie (după o eroare, ca să nu se piardă). */
  scris: Record<string, { numarat?: string; unde?: string }>;
  eroare: string;
  /** Prima apăsare a cerut confirmarea. */
  confirma: boolean;
  deschis: boolean;
  /** Ce nu oprește închiderea, dar trebuie știut (tabla pusă deoparte în atelier, comenzi pe drum). */
  atentie: string[];
}

const NUME_PIERDERE: Record<Pierdere, string> = { pierdut: "Pierdut", furat: "Furat", reciclat: "Reciclat (deșeu)" };

/** Valoarea din select ↔ destinația: `depozit:<id>`, `furnizor:<nume>`, `pierdut` … */
export const valoareDestinatie = (d: Destinatie): string =>
  d.fel === "depozit" ? `depozit:${d.depozit}` : d.fel === "furnizor" ? `furnizor:${d.furnizor}` : d.fel;

export function destinatieDin(v: string): Destinatie | null {
  if (v.startsWith("depozit:") && v.length > 8) return { fel: "depozit", depozit: v.slice(8) };
  if (v.startsWith("furnizor:") && v.length > 9) return { fel: "furnizor", furnizor: v.slice(9) };
  return (PIERDERI as readonly string[]).includes(v) ? { fel: v as Pierdere } : null;
}

/** Inventarul de la sfârșit (S45) și unde pleacă fiecare rest (S4, S8, S43). */
export function formularInchidere(f: FormularInchidere): string {
  const optiuni = (r: RestPeSantier, ales: string): string => {
    const o = (v: string, t: string): string => `<option value="${esc(v)}"${v === ales ? " selected" : ""}>${esc(t)}</option>`;
    return [
      `<optgroup label="Înapoi sau mutat">${f.locuri.map((l) => o(`depozit:${l.id}`, l.nume)).join("")}</optgroup>`,
      r.furnizori.length ? `<optgroup label="Retur">${r.furnizori.map((x) => o(`furnizor:${x}`, `Înapoi la ${x}`)).join("")}</optgroup>` : "",
      `<optgroup label="Nu mai e">${PIERDERI.map((p) => o(p, NUME_PIERDERE[p])).join("")}</optgroup>`,
    ].join("");
  };
  const randuri = f.stoc.map((r) => {
    const s = f.scris[r.cheie] ?? {};
    const numarat = s.numarat ?? String(Math.max(0, r.scriptic));
    return `<tr>
      <td>${esc(numeArticol(r.articol))}${r.scriptic < 0 ? `<br>${stare("în registru cu minus", "atentie")}` : ""}</td>
      <td class="n">${cantitate(r.scriptic, r.articol.um)}</td>
      <td class="n"><input name="numarat" data-cheie="${esc(r.cheie)}" type="number" inputmode="decimal" min="0" step="any"
        value="${esc(numarat)}" aria-label="Numărat, ${esc(numeArticol(r.articol))}" style="width:100%;max-width:9rem" /></td>
      <td><select name="unde" data-cheie="${esc(r.cheie)}" style="width:100%;min-width:0" aria-label="Unde pleacă, ${esc(numeArticol(r.articol))}">${
        optiuni(r, s.unde ?? IMPLICIT)}</select></td>
    </tr>`;
  });
  return `<section class="imp-card" id="inchidere">
    <h2>Închide șantierul</h2>
    <form id="form-inchidere">
      <p class="hint">La sfârșitul lucrării, șeful de lucrare numără ce a rămas pe șantier. Scrie aici cât a găsit și unde pleacă
        fiecare material: înapoi în depozit, pe alt șantier, înapoi la furnizor, sau dacă s-a pierdut, s-a furat ori merge la
        reciclat. Diferența față de registru se scrie singură, ca diferență la inventar. Șantierul se închide doar când pe el
        nu mai rămâne nimic; după aceea nu mai primește situații sau material.</p>
      ${f.atentie.map((t) => `<p class="hint">${stare("De știut", "atentie")} ${esc(t)}</p>`).join("")}
      ${f.stoc.length
        ? tabel(["Material", "În registru", "Numărat", "Unde pleacă"], randuri, ["", "n", "n", ""])
        : `<p class="hint">Pe șantier nu mai e nimic de numărat.</p>`}
      ${f.eroare ? `<p class="alerta" role="alert">${esc(f.eroare)}</p>` : ""}
      <div class="imp-formular-butoane">
        <button type="submit" class="primar">${f.confirma ? "Sigur închizi șantierul?" : "Închide șantierul"}</button>
        ${f.confirma ? `<span class="hint">Apasă încă o dată. Închis, șantierul nu se mai deschide.</span>` : ""}
      </div>
    </form>
  </section>`;
}

/* ------------------------------------------------ cifrele șantierului închis */

/** Ce a rămas din fiecare material și cât a costat, plus numărul șantierului: costul față de ofertă. */
export function cardInchis(c: CifreInchidere): string {
  const pierdut = (r: CifreInchidere["randuri"][number]): number => r.pierdut.pierdut + r.pierdut.furat + r.pierdut.reciclat;
  const randuri = c.randuri.map((r) => `<tr>
    <td>${esc(numeArticol(r.articol))}</td>
    <td class="n">${cant(r.venit, r.articol)}</td>
    <td class="n">${cant(r.pus, r.articol)}</td>
    <td class="n">${cant(r.inapoi, r.articol)}</td>
    <td class="n">${cant(r.laFurnizor, r.articol)}</td>
    <td class="n">${cant(pierdut(r) + Math.max(0, -r.inventar), r.articol)}</td>
    <td class="n">${r.cost === null ? "—" : eur(r.cost)}</td>
  </tr>`);
  return `<section class="imp-card"><h2>Șantier închis pe ${esc(zi(c.inchis))}</h2>
    ${suma("Materialul a costat", c.cost)}
    ${c.pierderi > 0 ? `<p class="hint">Din cost, ${eur(c.pierderi)} e material pierdut, furat, dus la reciclat sau lipsă la inventar.</p>` : ""}
    ${randuri.length ? tabel(["Material", "Venit", "Pus", "Înapoi sau mutat", "La furnizor", "Pierdut sau lipsă", "Cost"], randuri,
      ["", "n", "n", "n", "n", "n", "n"]) : ""}
  </section>`;
}
