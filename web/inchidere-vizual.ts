/**
 * Marcajul Fazei 7 pe ecranul Lucrări: materialul șantierului (S9), inventarul
 * de la închidere și cifrele șantierului închis. Funcții pure, ca
 * `web/santier-vizual.ts`: fără DOM, testate în Node, orice text din date trece
 * prin `esc()`. Logica e în `src/lucrari/inchidere.ts`.
 */
import { esc, eur, stare, tabel } from "./ecrane/tip.js";
import { cantitate, cifra, numeArticol } from "./stoc-vizual.js";
import {
  PIERDERI, stocSantier, type CifreInchidere, type Destinatie, type MaterialSantier, type Pierdere, type RestNumarat,
} from "../src/lucrari/inchidere.js";
import type { PlanSantier } from "../src/lucrari/situatii.js";
import { esteAnulata, type Articol, type Miscare } from "../src/stoc/registru.js";
import { stareComanda, type Comanda } from "../src/stoc/comenzi.js";
import { cheieBaza } from "../src/stoc/registru.js";
import type { ConsumSantier } from "../src/stoc/consum.js";
import { celulaPierdere, formularConsumMana, randPierdere } from "./consum-vizual.js";
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

/**
 * S9: pe fiecare material, comandat, venit, pus, rămas și ce lipsește; jos,
 * costul față de ofertă. Cu consumul Fazei 6 (`c`), și pierderea față de
 * situații, pe material și pe tot șantierul, plus consumul notat de mână: un
 * singur card pentru materialul șantierului, nu două cu aceleași coloane.
 */
export function cardMaterial(m: MaterialSantier, c?: ConsumSantier): string {
  if (m.randuri.length === 0) {
    return `<section class="imp-card"><h2>Materialul șantierului</h2>
      <p class="hint" style="margin:0">Șantierul nu are încă necesar de materiale și nici material adus.</p></section>`;
  }
  const pierdere = (cheie: string): string => {
    const x = c?.materiale.find((y) => y.cheie === cheie);
    return x ? celulaPierdere(x) : "—";
  };
  const randuri = m.randuri.map((r) => `<tr>
    <td>${esc(numeArticol(r.articol))}${r.alClientului ? `<br>${stare("îl dă clientul")}` : ""}</td>
    <td class="n">${cant(r.necesar, r.articol)}</td>
    <td class="n">${cant(r.comandat, r.articol)}</td>
    <td class="n">${cant(r.venit, r.articol)}</td>
    <td class="n">${cant(r.pus, r.articol)}</td>
    <td class="n">${r.ramas < 0 ? `${stare("sold negativ", "atentie")} −${cant(-r.ramas, r.articol)}` : cant(r.ramas, r.articol)}</td>
    <td class="n">${r.lipsa > 0 ? `<strong>${cantitate(r.lipsa, r.articol.um)}</strong>` : stare("nimic", "ok")}</td>
    ${c ? `<td class="n">${pierdere(cheieBaza(r.articol))}</td>` : ""}
  </tr>`);
  // Definitiile coloanelor stau pliate: patru randuri de text gri deasupra
  // tabelului le citea omul o data, apoi ii ascundeau tabelul de fiecare data.
  return `<section class="imp-card"><h2>Materialul șantierului</h2>
    <details class="ajutor">
      <summary>Ce înseamnă coloanele</summary>
      <p class="hint">Comandat: pe comenzile trimise. Venit: ce a ajuns pe șantier. Pus: ce s-a pus pe
      țeavă. Rămas: ce e acum pe șantier. Lipsește: cât mai trebuie pentru ce n-a fost încă executat (după situații), peste ce e
      pe șantier și ce e comandat și n-a venit.${c ? ` Pierdere: cât s-a dus peste ce arată situațiile (venit, minus ce s-a
      întors și ce a rămas, față de consumul scris la situații, care are deja pierderea la croit).` : ""}</p>
    </details>
    ${c ? randPierdere(c) : ""}
    ${c
      ? tabel(["Material", "Necesar", "Comandat", "Venit", "Pus", "Rămas", "Lipsește", "Pierdere"], randuri, ["", "n", "n", "n", "n", "n", "n", "n"])
      : tabel(["Material", "Necesar", "Comandat", "Venit", "Pus", "Rămas", "Lipsește"], randuri, ["", "n", "n", "n", "n", "n", "n"])}
    ${suma("Costul materialului, până acum", m.cost)}
    <p class="hint">Costul e ce a rămas pe șantier (pus, pierdut sau încă acolo), la prețul cu care a venit: prețul facturii
      pentru ce s-a cumpărat pentru șantier, prețul mediu pentru ce a venit din depozit sau de pe alt șantier. „În ofertă” e
      cât plătește clientul pe aceste materiale, cu manopera.</p>
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
  return `<details class="imp-card" id="inchidere"${f.deschis ? " open" : ""}>
    <summary>Închide șantierul</summary>
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
  </details>`;
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
