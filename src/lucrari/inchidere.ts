/**
 * Faza 7: inchiderea santierului si ce vede directorul pe el.
 *
 * Firma (docs/intrebari-firma.md):
 *
 * - S45: inventarul se face „la un sfarsit de santier, seful de lucrare”, iar
 *   diferentele „merg pe alte santiere”;
 * - S4, S8: ce ramane se intoarce in depozit, pleaca direct pe alt santier, se
 *   intoarce la furnizor ca retur, sau e furat / pierdut; „nu exista
 *   posibilitatea de a da materialele ramase la client”;
 * - S43: deseul „se duce la reciclat”;
 * - S9: pe santier vor sa vada „toate”: comandat, venit, pus, ramas, costul
 *   materialului fata de oferta si ce lipseste ca sa se termine lucrarea.
 *
 * Inchiderea porneste de la ce a numarat seful de lucrare. Diferenta fata de
 * registru devine o ajustare cu motivul „inventar la închidere”, iar fiecare
 * rest numarat primeste o destinatie, care devine o miscare obisnuita:
 *
 *   depozit (central, atelier, alt santier) → transfer
 *   furnizorul                              → retur fara depozit de sosire
 *   pierdut / furat / reciclat              → ajustare cu minus, cu motivul
 *
 * Santierul se inchide doar cu stocul la zero (`stocZero`).
 *
 * **Costul materialului** (regula din `docs/plan-implementare.md`, „Deciziile
 * luate fara firma”, S44): pretul intrarilor facute pentru santier; pentru ce
 * vine din depozit sau de pe alt santier, pretul mediu. Pe santier, fiecare
 * articol are deci un cost pe unitate: media ce a venit, fiecare bucata cu
 * pretul ei. Ce pleaca inapoi (in depozit, pe alt santier, la furnizor) iese
 * cu acelasi cost pe unitate, deci costul santierului e ce a ramas pe el —
 * pus pe teava, pierdut, furat, reciclat — inmultit cu costul pe unitate.
 * Consumul si ajustarile nu schimba costul: doar impart materialul ramas intre
 * „pus” si „pierdut”. La inchidere, cu stocul zero, numarul e final.
 *
 * Pur, fara I/O: ruleaza la fel in browser, pe server si in teste.
 */
import { bani } from "../pricing/engine.js";
import {
  CERE, articolDin, cantitateNecesara, cheieBaza, laFurnizor, pretMediu, solduri, type Articol, type Miscare, type Sold,
} from "../stoc/registru.js";
import type { MaterialNecesar } from "../stoc/necesar.js";
import { ajustariInventar } from "../stoc/inventar.js";
import { comandatNesosit, type Comanda } from "../stoc/comenzi.js";
import { randuriSituatie, type PlanSantier } from "./situatii.js";

/** Motivul ajustarii pentru diferenta dintre registru si ce s-a numarat. */
export const MOTIV_INVENTAR = "inventar la închidere";

/** Restul care nu mai ajunge in alt loc (S4, S43). */
export type Pierdere = "pierdut" | "furat" | "reciclat";
export const PIERDERI: readonly Pierdere[] = ["pierdut", "furat", "reciclat"];

export type Destinatie =
  | { fel: "depozit"; depozit: string }
  | { fel: "furnizor"; furnizor: string }
  | { fel: Pierdere };

export interface RestNumarat {
  /** `articol.cheie`, cu marca: asa e tinut stocul. */
  cheie: string;
  /**
   * Cat arata registrul cand s-a numarat. Daca intre timp s-a mai scris ceva pe
   * santier, numaratoarea nu mai e pe acelasi stoc si inchiderea se refuza.
   */
  scriptic: number;
  /** Cat a gasit seful de lucrare. */
  numarat: number;
  /** Unde pleaca ce s-a numarat; suma lor = numarat. */
  destinatii: { unde: Destinatie; cantitate: number }[];
}

export interface Inchidere {
  /** Id-ul santierului, care e si id-ul depozitului lui. */
  santier: string;
  inventar: RestNumarat[];
}

const rot = (n: number): number => Math.round(n * 1000) / 1000;
const egal = (a: number, b: number): boolean => Math.abs(a - b) < 0.005;

/** Id-urile miscarilor anulate, o singura data (nu `esteAnulata` pe fiecare). */
function anulate(miscari: readonly Miscare[]): Set<string> {
  return new Set(miscari.filter((m) => m.anuleaza).map((m) => m.anuleaza!));
}

/** Miscarile care conteaza: nici storno, nici anulate. */
const valabile = (miscari: readonly Miscare[]): Miscare[] => {
  const a = anulate(miscari);
  return miscari.filter((m) => !m.anuleaza && !a.has(m.id));
};

/** Stocul santierului, pe articol (cu marca), ca in registru. */
export const stocSantier = (miscari: readonly Miscare[], santier: string): Sold[] =>
  solduri(miscari).filter((s) => s.depozit === santier);

/** Conditia de inchidere: niciun articol cu sold pe santier, nici pozitiv, nici negativ. */
export const stocZero = (miscari: readonly Miscare[], santier: string): boolean =>
  stocSantier(miscari, santier).length === 0;

/**
 * Avizele de pe santier fara factura: marfa a venit fara pret. Inchis,
 * santierul nu mai primeste miscari, deci factura n-ar mai avea unde intra.
 */
export function avizeFaraFactura(miscari: readonly Miscare[], santier: string): string[] {
  const out = new Set<string>();
  for (const m of valabile(miscari)) {
    if (m.tip === "intrare" && m.spre === santier && m.document?.tip === "aviz" && !m.pret) {
      out.add([m.document.serie, m.document.numar].filter(Boolean).join(" "));
    }
  }
  return [...out];
}

/** De ce nu se poate inchide; null = se poate. `nume` scrie materialul pentru om. */
export function valideazaInchidere(
  inc: Inchidere, miscari: readonly Miscare[], nume: (cheie: string) => string = (c) => c,
): string | null {
  const stoc = stocSantier(miscari, inc.santier);
  const avize = avizeFaraFactura(miscari, inc.santier);
  if (avize.length) {
    return `Avizul ${avize.join(", ")} așteaptă factura: trece factura înainte de închidere, ca prețul să intre în costul șantierului.`;
  }
  for (const s of stoc) {
    if (!inc.inventar.some((r) => r.cheie === s.articol.cheie)) return `Numără ${nume(s.articol.cheie)}.`;
  }
  for (const r of inc.inventar) {
    if (!miscari.some((m) => m.articol.cheie === r.cheie)) return "Un material numărat nu a trecut niciodată prin depozit: trece-l întâi ca intrare.";
    const acum = stoc.find((s) => s.articol.cheie === r.cheie)?.cantitate ?? 0;
    if (!egal(acum, r.scriptic)) {
      return "Pe șantier s-a mai scris ceva de când s-a numărat: numără din nou.";
    }
    if (!Number.isFinite(r.numarat) || r.numarat < 0) return `Cantitatea numărată la ${nume(r.cheie)} trebuie să fie zero sau mai mare.`;
    if (r.destinatii.some((d) => !Number.isFinite(d.cantitate) || d.cantitate <= 0)) {
      return `La ${nume(r.cheie)}, fiecare destinație are o cantitate mai mare decât zero.`;
    }
    const pleaca = r.destinatii.reduce((t, d) => t + d.cantitate, 0);
    if (!egal(pleaca, r.numarat)) return `Alege unde pleacă ${nume(r.cheie)}.`;
    for (const { unde } of r.destinatii) {
      if (unde.fel === "depozit" && (!unde.depozit || unde.depozit === inc.santier)) {
        return `Alege alt loc pentru ${nume(r.cheie)}: nu poate rămâne pe șantierul care se închide.`;
      }
      if (unde.fel === "furnizor" && !unde.furnizor.trim()) return `Scrie furnizorul la care se întoarce ${nume(r.cheie)}.`;
    }
  }
  return null;
}

/**
 * Miscarile inchiderii, in ordinea cheilor: ajustarea la inventar, apoi
 * destinatiile. Browserul si serverul le fac la fel, cu aceleasi id-uri
 * (`id` le da pe rand), ca inchiderea trimisa de doua ori sa nu se dubleze.
 */
export function miscariInchidere(inc: Inchidere, miscari: readonly Miscare[], id: () => string, data: string): Miscare[] {
  const articole = new Map(miscari.map((m) => [m.articol.cheie, m.articol]));
  const out: Miscare[] = [];
  const nota = "rest de la închiderea șantierului";
  for (const r of [...inc.inventar].sort((a, b) => a.cheie.localeCompare(b.cheie))) {
    const articol = articole.get(r.cheie);
    if (!articol) continue;
    // Diferenta fata de registru, ca la orice inventar (Faza 8); `valideazaInchidere` a verificat deja ca registrul e cel numarat.
    const [aj] = ajustariInventar(miscari, {
      depozit: inc.santier, motiv: MOTIV_INVENTAR, nota: "la închiderea șantierului", numarat: [{ articol, cantitate: r.numarat }],
    }, () => "", data);
    if (aj) out.push({ ...aj, id: id(), lucrareId: inc.santier });
    for (const { unde, cantitate } of r.destinatii) {
      // Fara `lucrareId` pe transfer: in atelier el inseamna „pus deoparte pentru santier”.
      const baza = { id: id(), data, articol, cantitate };
      if (unde.fel === "depozit") {
        out.push({ ...baza, tip: "transfer", din: inc.santier, spre: unde.depozit, nota });
      } else if (unde.fel === "furnizor") {
        // Cu pretul de pe santier, ca in evidenta cumpararilor returul sa iasa cu valoare, cu minus.
        const pret = costPeUnitate(miscari, inc.santier, cheieBaza(articol));
        out.push({
          ...baza, tip: "retur", din: inc.santier, lucrareId: inc.santier, furnizor: unde.furnizor.trim(), nota: `retur la ${unde.furnizor.trim()}: ${nota}`,
          ...(pret !== null ? { pret: { valoare: Math.round(pret * 10000) / 10000 } } : {}),
        });
      } else {
        out.push({ ...baza, tip: "ajustare", cantitate: -cantitate, spre: inc.santier, lucrareId: inc.santier, motiv: unde.fel, nota: `${nota}: ${unde.fel}` });
      }
    }
  }
  return out;
}

/* -------------------------------------------------------------- costul */

/**
 * Pretul pe unitate cu care intra pe santier ce nu vine cu pretul lui (un
 * transfer, un aviz fara factura): media intrarilor facute pentru santier
 * (direct pe el, sau in central / atelier cu santierul pe ele), altfel pretul
 * mediu al firmei pe material.
 */
function pretPentruSantier(miscari: readonly Miscare[], santier: string, cheie: string): number | null {
  let q = 0;
  let v = 0;
  for (const m of valabile(miscari)) {
    if (m.tip !== "intrare" || !m.pret || cheieBaza(m.articol) !== cheie) continue;
    if (m.spre !== santier && m.lucrareId !== santier) continue;
    q += m.cantitate;
    v += m.pret.valoare * m.cantitate;
  }
  return q > 0 ? v / q : pretMediu(miscari, cheie);
}

/** Ce s-a intamplat cu un material (fara marca) pe depozitul santierului. */
export interface Flux {
  cheie: string;
  articol: Articol;
  /** Intrat pe santier: intrari, transferuri, retururi spre el. */
  venit: number;
  /** Plecat in alt loc: depozit → cantitate; la furnizor sub `furnizor:<nume>`. */
  plecat: Record<string, number>;
  /** Consumul (pus pe teava). */
  pus: number;
  /** Ajustarile cu motiv de pierdere, cu semn pozitiv. */
  pierdut: Record<Pierdere, number>;
  /** Restul ajustarilor (inventar), cu semn. */
  inventar: number;
  /** Cat e acum pe santier. */
  ramas: number;
  /** Costul pe unitate pe santier (EUR); null = nimic din ce a venit nu are pret. */
  costUnitar: number | null;
}

const goalPierdut = (): Record<Pierdere, number> => ({ pierdut: 0, furat: 0, reciclat: 0 });
export const totalPlecat = (f: Flux): number => rot(Object.values(f.plecat).reduce((t, x) => t + x, 0));

/** Fluxurile tuturor materialelor care au trecut pe santier, pe `cheieBaza`. */
export function fluxuri(miscari: readonly Miscare[], santier: string): Map<string, Flux> {
  const acc = new Map<string, Flux & { valoare: number; cuPret: number }>();
  const preturi = new Map<string, number | null>();
  const pret = (cheie: string): number | null => {
    if (!preturi.has(cheie)) preturi.set(cheie, pretPentruSantier(miscari, santier, cheie));
    return preturi.get(cheie)!;
  };
  for (const m of valabile(miscari)) {
    if (m.din !== santier && m.spre !== santier) continue;
    const cheie = cheieBaza(m.articol);
    const f = acc.get(cheie) ?? {
      cheie, articol: articolDin(m.articol), venit: 0, plecat: {}, pus: 0, pierdut: goalPierdut(), inventar: 0, ramas: 0,
      costUnitar: null, valoare: 0, cuPret: 0,
    };
    acc.set(cheie, f);
    if (m.tip === "ajustare") {
      if (m.spre !== santier) continue;
      const p = PIERDERI.find((x) => x === m.motiv);
      if (p && m.cantitate < 0) f.pierdut[p] = rot(f.pierdut[p] - m.cantitate);
      else f.inventar = rot(f.inventar + m.cantitate);
      f.ramas = rot(f.ramas + m.cantitate);
      continue;
    }
    if (CERE[m.tip].spre && m.spre === santier) {
      f.venit = rot(f.venit + m.cantitate);
      f.ramas = rot(f.ramas + m.cantitate);
      const p = m.tip === "intrare" && m.pret ? m.pret.valoare : pret(cheie);
      if (p !== null) { f.valoare += p * m.cantitate; f.cuPret += m.cantitate; }
    }
    if (CERE[m.tip].din && m.din === santier) {
      f.ramas = rot(f.ramas - m.cantitate);
      if (m.tip === "consum") f.pus = rot(f.pus + m.cantitate);
      else {
        const unde = laFurnizor(m) ? `furnizor:${m.furnizor}` : (m.spre ?? "");
        f.plecat[unde] = rot((f.plecat[unde] ?? 0) + m.cantitate);
      }
    }
  }
  return new Map([...acc].map(([k, { valoare, cuPret, ...f }]) => [k, { ...f, costUnitar: cuPret > 0 ? valoare / cuPret : null }]));
}

/** Costul pe unitate al unui material pe santier (EUR), sau null fara niciun pret. */
export const costPeUnitate = (miscari: readonly Miscare[], santier: string, cheie: string): number | null =>
  fluxuri(miscari, santier).get(cheie)?.costUnitar ?? null;

/** Ce a costat materialul ramas pe santier (pus, pierdut, inca acolo): venit − plecat, la costul pe unitate. */
export const costFlux = (f: Flux): number | null => (f.costUnitar === null ? null : (f.venit - totalPlecat(f)) * f.costUnitar);

/* -------------------------------------------- ce vede directorul (S9) */

export interface RandMaterial {
  cheie: string;
  articol: Articol;
  /** Din necesarul ofertei (0 la materialul venit fara necesar). */
  necesar: number;
  /** Pe comenzile trimise pentru santier (neanulate). */
  comandat: number;
  venit: number;
  pus: number;
  ramas: number;
  /** Ce mai trebuie pentru lucrarea ramasa, peste ce e pe santier si ce e pe drum. */
  lipsa: number;
  /** Costul materialului ramas pe santier pana acum; null = fara pret. */
  cost: number | null;
  /** Valoarea lui in oferta (cat plateste clientul, material si manopera). */
  inOferta: number;
  alClientului?: true;
}

export interface CostFataDeOferta {
  /** Costul materialului (EUR), dupa regula de mai sus, pe materialele cu pret. */
  cost: number;
  /** Cate materiale cu cantitate pe santier n-au niciun pret: costul lor lipseste din `cost`. */
  faraPret: number;
  /** „În ofertă”: suma `valoareOferta` din necesar, cum o arata Depozit si stoc. */
  inOferta: number;
  /** Cost / în ofertă, in procente, cu o zecimala; null fara valoare in oferta. */
  procent: number | null;
}

export interface MaterialSantier {
  randuri: RandMaterial[];
  cost: CostFataDeOferta;
}

/** Cat din fiecare pozitie a mai ramas de executat, dupa ultima situatie. */
function restPePozitii(plan: PlanSantier): Map<number, number> {
  const ultima = plan.situatii.at(-1);
  if (!ultima) return new Map(plan.pozitii.map((p) => [p.nr, p.cantitate]));
  return new Map(randuriSituatie(plan, ultima).map((r) => [r.poz.nr, Math.max(0, r.rest)]));
}

/** Materialul pentru lucrarea ramasa, cu pierderea la croit; fara situatii, tot necesarul. */
function pentruRest(m: MaterialNecesar, plan: PlanSantier, rest: Map<number, number>, pus: number): number {
  const necesar = cantitateNecesara(m);
  if (plan.inchis) return 0;
  if (plan.situatii.length === 0) return necesar;
  if (!m.pePozitie?.length) return Math.max(0, necesar - pus);
  return m.pePozitie.reduce((t, p) => t + p.peUnitate * (rest.get(p.pozitie) ?? 0), 0) * (1 + (m.pierdere ?? 0));
}

/**
 * Sub cat nu e lipsa: 0,5 % din necesar, cel putin 0,05 (ml sau m²). Tabla se
 * comanda in kg si se primeste inapoi in m², iar necesarul pe pozitii e rotunjit
 * la patru zecimale: pe TRANSAVIA, tabla 0,6 comandata toata (271,78 m²) ramanea
 * cu 0,02 m² „lipsa”, iar tabloul aprindea alerta (16 octombrie 2026).
 */
export const tolerantaLipsa = (necesar: number): number => Math.max(0.05, necesar * 0.005);

const procentDin = (cost: number, inOferta: number): number | null =>
  inOferta > 0 ? Math.round((cost / inOferta) * 1000) / 10 : null;

/**
 * Ecranul santierului (S9): pe fiecare material, comandat, venit, pus, ramas
 * si ce lipseste; jos, costul materialului fata de oferta.
 */
export function materialSantier(
  plan: PlanSantier, necesar: readonly MaterialNecesar[], miscari: readonly Miscare[], comenzi: readonly Comanda[] = [],
): MaterialSantier {
  const flux = fluxuri(miscari, plan.id);
  const rest = restPePozitii(plan);
  const comandat = new Map<string, number>();
  for (const c of comenzi) {
    if (c.anulata || !c.trimisa || (c.spre !== plan.id && c.santier !== plan.id)) continue;
    for (const l of c.linii) comandat.set(cheieBaza(l.articol), rot((comandat.get(cheieBaza(l.articol)) ?? 0) + l.cantitate));
  }
  const randuri: RandMaterial[] = [];
  const vazute = new Set<string>();
  const peCheie = new Map<string, MaterialNecesar[]>();
  for (const m of necesar) {
    const k = articolDin(m).cheie;
    peCheie.set(k, [...(peCheie.get(k) ?? []), m]);
  }
  const rand = (cheie: string, articol: Articol, materiale: readonly MaterialNecesar[]): RandMaterial => {
    const f = flux.get(cheie);
    const pus = f?.pus ?? 0;
    const ramas = f?.ramas ?? 0;
    const deLucru = materiale.reduce((t, m) => t + pentruRest(m, plan, rest, pus), 0);
    const peDrum = plan.inchis ? 0 : comandatNesosit(comenzi, miscari, plan.id, cheie);
    const cost = f ? costFlux(f) : 0;
    const necesarTot = rot(materiale.reduce((t, m) => t + cantitateNecesara(m), 0));
    const lipsa = deLucru - Math.max(0, ramas) - peDrum;
    return {
      cheie, articol,
      necesar: necesarTot,
      comandat: comandat.get(cheie) ?? 0,
      venit: f?.venit ?? 0, pus, ramas,
      lipsa: lipsa <= tolerantaLipsa(necesarTot) ? 0 : Math.round(lipsa * 100) / 100,
      cost: cost === null ? null : bani(cost),
      inOferta: materiale.filter((m) => !m.alClientului).reduce((t, m) => t + (m.valoareOferta ?? 0), 0),
      ...(materiale.length > 0 && materiale.every((m) => m.alClientului) ? { alClientului: true as const } : {}),
    };
  };
  for (const [k, materiale] of peCheie) {
    vazute.add(k);
    randuri.push(rand(k, articolDin(materiale[0]!), materiale));
  }
  for (const [k, f] of flux) if (!vazute.has(k)) randuri.push(rand(k, f.articol, []));
  return { randuri, cost: costDin(randuri) };
}

function costDin(randuri: readonly RandMaterial[]): CostFataDeOferta {
  let cost = 0;
  let faraPret = 0;
  let inOferta = 0;
  for (const r of randuri) {
    inOferta += r.inOferta;
    if (r.cost === null) faraPret++;
    else cost += r.cost;
  }
  return { cost: bani(cost), faraPret, inOferta: bani(inOferta), procent: procentDin(cost, inOferta) };
}

/* ------------------------------------------ cifrele la inchidere (S49) */

export interface RandInchidere {
  cheie: string;
  articol: Articol;
  venit: number;
  pus: number;
  /** Intors in depozit sau mutat pe alt santier. */
  inapoi: number;
  /** Intors la furnizor. */
  laFurnizor: number;
  pierdut: Record<Pierdere, number>;
  /** Diferenta gasita la inventar (cu semn: minus = lipsea). */
  inventar: number;
  costUnitar: number | null;
  cost: number | null;
}

export interface CifreInchidere {
  /** ISO, cand s-a inchis. */
  inchis: string;
  randuri: RandInchidere[];
  /** Costul materialului fata de oferta: numarul santierului inchis. */
  cost: CostFataDeOferta;
  /** Valoarea materialului pierdut, furat, reciclat si lipsa la inventar (EUR). */
  pierderi: number;
}

/** Cifrele unui santier inchis (sau, inainte, ce ar iesi acum). */
export function cifreInchidere(
  plan: PlanSantier, necesar: readonly MaterialNecesar[], miscari: readonly Miscare[],
): CifreInchidere {
  const flux = fluxuri(miscari, plan.id);
  const randuri: RandInchidere[] = [...flux.values()].map((f) => {
    const laFurn = rot(Object.entries(f.plecat).filter(([k]) => k.startsWith("furnizor:")).reduce((t, [, q]) => t + q, 0));
    const c = costFlux(f);
    return {
      cheie: f.cheie, articol: f.articol, venit: f.venit, pus: f.pus, inapoi: rot(totalPlecat(f) - laFurn), laFurnizor: laFurn,
      pierdut: f.pierdut, inventar: f.inventar, costUnitar: f.costUnitar, cost: c === null ? null : bani(c),
    };
  });
  let pierderi = 0;
  for (const r of randuri) {
    if (r.costUnitar === null) continue;
    const q = r.pierdut.pierdut + r.pierdut.furat + r.pierdut.reciclat + Math.max(0, -r.inventar);
    pierderi += q * r.costUnitar;
  }
  // „În ofertă” din necesar, pe toate materialele lui, venite sau nu.
  const inOferta = necesar.filter((m) => !m.alClientului).reduce((t, m) => t + (m.valoareOferta ?? 0), 0);
  let cost = 0;
  let faraPret = 0;
  for (const r of randuri) {
    // Fără preț: venit fără factură, sau pus fără să fi venit (registrul cu minus,
    // pus la loc la inventar): și unul, și altul lipsesc din cost.
    if (r.cost === null) { if (r.venit - r.inapoi - r.laFurnizor > 0 || r.pus > 0) faraPret++; } else cost += r.cost;
  }
  return {
    inchis: plan.inchis ?? "", randuri,
    cost: { cost: bani(cost), faraPret, inOferta: bani(inOferta), procent: procentDin(cost, inOferta) },
    pierderi: bani(pierderi),
  };
}
