/**
 * Consumul de material pe un santier (Faza 6).
 *
 * Firma (S7): ce a plecat spre santier NU se considera consumat; consumul se
 * socoteste din ce s-a executat (situatia de lucrari), se poate nota de mana si
 * se vede la final, din ce a ramas. Ritmul e al situatiilor (S41: „in functie
 * de factura emisa: in principiu lunar”).
 *
 * **Consumul calculat** al unui material, pana la o situatie, e necesarul lui
 * inmultit cu partea executata din pozitiile pe care se pune:
 *
 *     parte = Σ executat cumulat × material pe unitate / Σ cantitate ofertata × material pe unitate
 *
 * Materialul pe unitatea fiecarei pozitii e `pePozitie` din necesar. Asa, o
 * situatie cu tot executat consuma exact necesarul (cu pierderea la croit din
 * el, S15 / S16), la ban, oricate situatii ar fi fost: necesarul e rotunjit pe
 * material, iar `pePozitie` la 4 zecimale, deci inmultite pozitie cu pozitie ar
 * fi fugit cu cativa centi. Pierderea la croit e consum, nu pierdere: resturile
 * de tabla merg la reciclat (S43), iar necesarul le cuprinde deja.
 *
 * La salvarea unei situatii se scrie diferenta dintre consumul calculat pana la
 * ea si ce au scris deja situatiile de dinainte (`consumDinSituatie`), deci
 * suma se corecteaza singura. Miscarea poarta situatia (`situatieId`): cand
 * ultima situatie se sterge, consumul ei se anuleaza cu storno
 * (`anuleazaConsumSituatie`), nimic nu se sterge.
 *
 * **Consumul real** e ce a plecat spre santier, minus ce s-a intors, minus ce a
 * ramas (planul, Faza 6). Ce a ramas e soldul santierului, deci consumul real
 * cuprinde si consumul notat de mana (S7 b) si ajustarile la inventar.
 * **Pierderea** e consumul real peste cel calculat; peste 10 % pe total (S42,
 * „10 % per total general”), santierul cere atentie. Totalul e pe valoare:
 * metri si metri patrati nu se aduna.
 *
 * Pur, fara I/O: ruleaza la fel in browser, pe server si in teste.
 */
import type { PlanSantier, Situatie } from "../lucrari/situatii.js";
import type { MaterialNecesar } from "./necesar.js";
import {
  articolDin, cantitateNecesara, cheieBaza, esteAnulata, pretMediu, solduri, type Articol, type Miscare, type UM,
} from "./registru.js";

/** Pierderea normala pe santier, pe total (S42). Peste ea, santierul apare la „Necesita atentia ta”. */
export const PRAG_PIERDERE = 0.1;

const doi = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/** Planul, cat ii trebuie consumului: pozitiile si situatiile. */
export type PlanConsum = Pick<PlanSantier, "id" | "pozitii" | "situatii">;

/**
 * Id-ul miscarii de consum a unei situatii, pe depozit si articol: acelasi in
 * browser si pe server, deci retrimisa sau mutata din browser nu se dubleaza.
 */
export const idConsum = (depozit: string, situatieId: string, cheie: string): string =>
  `consum-${depozit}-${situatieId}-${cheie}`;
/** Id-ul storno-ului unei miscari de consum, cand situatia ei se sterge. */
export const idAnulareConsum = (miscareId: string): string => `anulare-${miscareId}`;

/** Executat cumulat pe fiecare pozitie, pana la situatia `nr` inclusiv. */
function cumulatPana(plan: PlanConsum, nr: number): Map<number, number> {
  const c = new Map<number, number>();
  for (const s of plan.situatii) {
    if (s.nr > nr) continue;
    for (const [poz, v] of Object.entries(s.cantitati)) c.set(Number(poz), (c.get(Number(poz)) ?? 0) + v);
  }
  return c;
}

/**
 * Cat din material s-a executat pana la situatia `nr` (1 = tot; peste 1 =
 * executat peste oferta). Null: materialul nu e pe nicio pozitie a planului
 * (adaugat de mana pe necesar), deci nu se calculeaza din situatii.
 */
export function parteExecutata(plan: PlanConsum, m: Pick<MaterialNecesar, "pePozitie">, nr: number): number | null {
  const cumulat = cumulatPana(plan, nr);
  let executat = 0;
  let total = 0;
  for (const p of m.pePozitie) {
    const poz = plan.pozitii.find((x) => x.nr === p.pozitie);
    if (!poz) continue;
    total += p.peUnitate * poz.cantitate;
    executat += p.peUnitate * (cumulat.get(p.pozitie) ?? 0);
  }
  return total > 0 ? executat / total : null;
}

/** Se calculeaza din situatii: are pozitii in plan si nu e al clientului (S38: nu intra in stocul nostru). */
const dinSituatii = (m: MaterialNecesar): boolean => !m.alClientului && !m.manual && m.pePozitie.length > 0;

/**
 * Consumul calculat pe fiecare material (`cheie` fara marca), pana la
 * situatia `nr` inclusiv (implicit, ultima), in unitatea articolului.
 */
export function consumCalculat(
  plan: PlanConsum, materiale: readonly MaterialNecesar[], nr = plan.situatii.at(-1)?.nr ?? 0,
): Map<string, number> {
  const out = new Map<string, number>();
  for (const m of materiale) {
    if (!dinSituatii(m)) continue;
    const parte = parteExecutata(plan, m, nr);
    if (parte === null) continue;
    out.set(m.cheie, doi((out.get(m.cheie) ?? 0) + cantitateNecesara(m) * parte));
  }
  return out;
}

/** Semnul unei miscari: storno-ul intoarce efectul originalului. */
const semn = (m: Miscare): number => (m.anuleaza ? -1 : 1);

/** Consumul scris deja din situatii pe un depozit, pe material, net de storno-uri. */
function scrisDinSituatii(miscari: readonly Miscare[], depozit: string): Map<string, number> {
  const out = new Map<string, number>();
  for (const m of miscari) {
    if (m.tip !== "consum" || !m.situatieId || m.din !== depozit) continue;
    const k = cheieBaza(m.articol);
    out.set(k, (out.get(k) ?? 0) + semn(m) * m.cantitate);
  }
  return out;
}

/**
 * Miscarile de consum de scris la salvarea situatiei `s` (deja in `plan`):
 * consumul calculat pana la ea, minus ce au scris situatiile de dinainte, pe
 * fiecare material. Iese din depozitul santierului (implicit, id-ul planului).
 *
 * Marca (S11) e pe stoc, nu pe necesar: consumul se ia din marcile aflate pe
 * santier, pe rand, cat are fiecare; ce nu acopera stocul se pune pe ultima
 * marca, sau pe materialul fara marca, si iese sold negativ, marcat, nu blocat
 * (registrul: pe santier se consuma uneori inainte de a se trece intrarea).
 *
 * O diferenta negativa (necesarul micsorat dupa situatii) nu scrie nimic:
 * consumul nu se scrie cu minus; corectura se face la inventar.
 */
export function consumDinSituatie(
  plan: PlanConsum, materiale: readonly MaterialNecesar[], miscari: readonly Miscare[], s: Situatie,
  depozit: string = plan.id,
): Miscare[] {
  const tinta = consumCalculat(plan, materiale, s.nr);
  const scris = scrisDinSituatii(miscari, depozit);
  const out: Miscare[] = [];
  const vazute = new Set<string>();
  for (const m of materiale) {
    if (vazute.has(m.cheie) || !tinta.has(m.cheie)) continue;
    vazute.add(m.cheie);
    const rest = doi(tinta.get(m.cheie)! - (scris.get(m.cheie) ?? 0));
    if (rest <= 0) continue;
    for (const x of dinMarci(articolDin(m), rest, miscari, depozit)) {
      out.push({
        id: idConsum(depozit, s.id, x.articol.cheie), data: s.data, tip: "consum", articol: x.articol, cantitate: x.cantitate,
        din: depozit, lucrareId: plan.id, situatieId: s.id, nota: `situația nr. ${s.nr}`,
      });
    }
  }
  return out;
}

/**
 * Pe ce marci iese o cantitate dintr-un material de pe santier: pe rand, cat
 * are fiecare (in ordinea cheii); restul pe ultima, sau pe materialul fara
 * marca cand santierul nu-l are deloc. Folosit si de consumul notat de mana.
 */
export function dinMarci(
  baza: Articol, cantitate: number, miscari: readonly Miscare[], depozit: string,
): { articol: Articol; cantitate: number }[] {
  const cheie = cheieBaza(baza);
  const pe = solduri(miscari)
    .filter((x) => x.depozit === depozit && x.cantitate > 0 && cheieBaza(x.articol) === cheie)
    .sort((a, b) => a.articol.cheie.localeCompare(b.articol.cheie));
  const surse = pe.length ? pe.map((x) => ({ articol: x.articol, are: x.cantitate })) : [{ articol: baza, are: 0 }];
  const out: { articol: Articol; cantitate: number }[] = [];
  let rest = doi(cantitate);
  surse.forEach((sursa, i) => {
    const ia = i === surse.length - 1 ? rest : doi(Math.min(sursa.are, rest));
    rest = doi(rest - ia);
    if (ia > 0) out.push({ articol: sursa.articol, cantitate: ia });
  });
  return out;
}

/** Storno pe consumul scris de o situatie, cand ea se sterge. Ce e deja anulat nu se anuleaza a doua oara. */
export function anuleazaConsumSituatie(
  s: Pick<Situatie, "id" | "nr">, miscari: readonly Miscare[], data: string,
): Miscare[] {
  return miscari
    .filter((m) => m.tip === "consum" && m.situatieId === s.id && !m.anuleaza && !esteAnulata(m, miscari))
    .map((m) => ({
      ...m, id: idAnulareConsum(m.id), data, anuleaza: m.id,
      nota: `anulează consumul situației nr. ${s.nr}, ștearsă`,
    }));
}

/* --------------------------------------------------------- consumul real */

/** Un material pe santier: de unde a venit, unde a plecat, cat s-a consumat. */
export interface ConsumMaterial {
  /** Materialul fara marca (`cheieBaza`). */
  cheie: string;
  /** Articolul fara marca, pentru nume si unitate. */
  articol: Articol;
  um: UM;
  /** Din necesarul santierului; 0 pentru materialele care au venit fara necesar. */
  necesar: number;
  /** Plecat spre santier: intrari direct pe santier, transferuri si retururi primite. */
  trimis: number;
  /** Plecat de pe santier altfel decat consumat: inapoi in depozit, pe alt santier, la furnizor. */
  returnat: number;
  /** Ce a ramas pe santier: soldul lui. */
  ramas: number;
  /** Din situatiile de lucrari, pana la ultima. */
  consumCalculat: number;
  /** Consumul scris: din situatii si notat de mana (S7 b). */
  consumScris: { situatii: number; mana: number };
  /** Trimis − returnat − ramas. Cuprinde consumul notat de mana si ajustarile la inventar. */
  consumReal: number;
  /** Consumul real peste cel calculat (cu minus: s-a consumat mai putin). */
  pierdere: number;
  /** Pierderea fata de consumul calculat, in procente. Null: nimic calculat inca. */
  pierdereProcent: number | null;
  /** Euro pe unitate cu care materialul intra in totalul pierderii: pretul de achizitie, altfel cel din oferta. */
  pret: number | null;
}

export interface ConsumSantier {
  depozit: string;
  materiale: ConsumMaterial[];
  /** Situatiile din care s-a calculat consumul. */
  situatii: number;
  /** Pierderea pe total, pe valoare, in procente. Null: nimic calculat cu pret. */
  pierdereProcent: number | null;
  /** Pierderea pe total trece de `PRAG_PIERDERE`. */
  pestePrag: boolean;
}

interface Acc {
  articol: Articol;
  trimis: number;
  returnat: number;
  ramas: number;
  situatii: number;
  mana: number;
}

/**
 * Materialul unui santier, pe material (marcile adunate): trimis, returnat,
 * ramas, consumul calculat din situatii, cel real si pierderea. Aceeasi functie
 * o folosesc ecranul Lucrari, tabloul de bord si inchiderea santierului
 * (Faza 7). `depozit` e depozitul santierului (implicit, id-ul planului).
 */
export function consumSantier(
  plan: PlanConsum, materiale: readonly MaterialNecesar[], miscari: readonly Miscare[],
  depozit: string = plan.id,
): ConsumSantier {
  const dupaId = new Map(miscari.map((m) => [m.id, m]));
  const acc = new Map<string, Acc>();
  const al = (a: Articol): Acc => {
    const k = cheieBaza(a);
    const x = acc.get(k) ?? { articol: articolDin(a), trimis: 0, returnat: 0, ramas: 0, situatii: 0, mana: 0 };
    acc.set(k, x);
    return x;
  };
  for (const m of materiale) {
    if (m.alClientului && !miscari.some((x) => cheieBaza(x.articol) === m.cheie)) continue;
    al(articolDin(m));
  }

  for (const m of miscari) {
    // Storno-ul face ce a facut originalul, cu semn schimbat; fara original, nimic (ca `solduri`).
    const o = m.anuleaza ? dupaId.get(m.anuleaza) : m;
    if (!o) continue;
    const k = semn(m) * o.cantitate;
    const intra = o.spre === depozit && o.tip !== "consum";
    const iese = o.din === depozit && o.tip !== "intrare" && o.tip !== "ajustare";
    if (!intra && !iese) continue;
    const x = al(o.articol);
    if (o.tip === "ajustare") x.ramas += k;
    else if (intra) { x.trimis += k; x.ramas += k; }
    if (iese) {
      x.ramas -= k;
      if (o.tip === "consum") { if (o.situatieId) x.situatii += k; else x.mana += k; }
      else x.returnat += k;
    }
  }

  const calculat = consumCalculat(plan, materiale);
  const necesar = new Map<string, MaterialNecesar>();
  for (const m of materiale) if (!necesar.has(m.cheie)) necesar.set(m.cheie, m);

  let valCalc = 0;
  let valPierdere = 0;
  const lista: ConsumMaterial[] = [...acc.entries()].map(([cheie, x]) => {
    const n = necesar.get(cheie);
    const trimis = doi(x.trimis);
    const returnat = doi(x.returnat);
    const ramas = doi(x.ramas);
    const consumCalc = calculat.get(cheie) ?? 0;
    const consumReal = doi(trimis - returnat - ramas);
    const pierdere = doi(consumReal - consumCalc);
    const cant = n ? cantitateNecesara(n) : 0;
    const pret = pretMediu(miscari, cheie) ?? (n && cant > 0 && n.valoareOferta > 0 ? n.valoareOferta / cant : null);
    if (pret !== null && consumCalc > 0) {
      valCalc += consumCalc * pret;
      valPierdere += pierdere * pret;
    }
    return {
      cheie, articol: x.articol, um: x.articol.um, necesar: cant, trimis, returnat, ramas,
      consumCalculat: consumCalc, consumScris: { situatii: doi(x.situatii), mana: doi(x.mana) },
      consumReal, pierdere,
      pierdereProcent: consumCalc > 0 ? Math.round((pierdere / consumCalc) * 1000) / 10 : null,
      pret: pret === null ? null : doi(pret),
    };
  });

  const pierdereProcent = valCalc > 0 ? Math.round((valPierdere / valCalc) * 1000) / 10 : null;
  return {
    depozit, materiale: lista, situatii: plan.situatii.length, pierdereProcent,
    pestePrag: pierdereProcent !== null && pierdereProcent > PRAG_PIERDERE * 100,
  };
}
