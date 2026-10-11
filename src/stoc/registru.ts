/**
 * Registrul de stoc: miscari, nu solduri.
 *
 * Stocul unui depozit nu e un camp care se scrie, e SUMA miscarilor lui. Un
 * sold editabil se poate pune pe orice cifra fara urma; un registru de miscari
 * spune oricand de unde vine fiecare metru. Aceeasi regula ca la documente
 * (regula 3 din `arhitectura.md`): o miscare nu se editeaza si nu se sterge,
 * se anuleaza cu o miscare inversa (storno), vizibila in jurnal.
 *
 * Un sold negativ nu se blocheaza — pe santier se consuma uneori inainte sa se
 * inregistreze intrarea — dar se marcheaza, ca sa nu treaca neobservat.
 *
 * Pur, fara I/O: ruleaza la fel in browser si in teste. Pastrarea e a
 * apelantului (`web/depozit-local.ts` in prototip, baza de date mai tarziu).
 */
import { ambalajImplicit } from "./ambalaje.js";
import { cheieFaraForma, cheieMaterial, formaImplicita, type Categorie, type MaterialNecesar } from "./necesar.js";

export type TipMiscare = "intrare" | "transfer" | "consum" | "retur" | "ajustare";
export type UM = "ml" | "m2";

export interface Articol {
  /** `cheieMaterial`, plus `|marca` cand articolul are marca. */
  cheie: string;
  sistem: string;
  grosime_mm: number | null;
  /** Randul din lista (ø). Null = material pe suprafata. */
  rand: number | null;
  /**
   * Tub, saltea, placa sau tabla (`Categorie`). Lipseste la articolele scrise
   * inainte de 11 octombrie 2026: atunci e cea implicita (`formaImplicita`).
   */
  forma?: Categorie;
  um: UM;
  /**
   * Producatorul (Armaflex, K-Flex, Rockwool …). Firma (S11): marca deosebeste
   * doua materiale la comanda, o cere si clientul, iar pe acelasi santier se pot
   * amesteca marci. Oferta n-o spune, deci necesarul e fara marca; stocul o tine
   * pe intrare, iar „De comandat" aduna toate marcile aceluiasi material.
   */
  marca?: string;
}

/** Forma articolului, si la cele scrise fara ea. */
export const formaArticol = (a: Pick<Articol, "sistem" | "rand" | "forma">): Categorie =>
  a.forma ?? formaImplicita(a.sistem, a.rand);

/** Materialul fara marca: pe ea se potriveste stocul cu necesarul. */
export const cheieBaza = (a: Pick<Articol, "sistem" | "grosime_mm" | "rand" | "forma">): string =>
  cheieMaterial(a.sistem, formaArticol(a), a.grosime_mm, a.rand);

/** Cum se cumpara un articol: ambalajul si cat contine, in unitatea articolului (S13). */
export interface Ambalaj {
  /** „cutie", „sac", „pachet", „rola", „coala", „kg" … */
  unitate: string;
  /** Cat contine un ambalaj, in ml sau m² (unitatea articolului). */
  continut: number;
}

export interface Miscare {
  id: string;
  /** ISO, data inregistrarii. */
  data: string;
  tip: TipMiscare;
  articol: Articol;
  /** Pozitiva; la ajustare, cu semn (plus sau minus la inventar). */
  cantitate: number;
  /** Depozitul din care iese materialul (transfer, consum, retur). */
  din?: string;
  /**
   * Depozitul in care intra (intrare, transfer, retur, ajustare). Lipseste la
   * returul la furnizor (`laFurnizor`): marfa iese din firma.
   */
  spre?: string;
  lucrareId?: string;
  nota?: string;
  /** Pusa de „Incarca date de exemplu": nu e o miscare reala. */
  exemplu?: true;
  /** Storno: id-ul miscarii pe care o anuleaza. Efectul e cel al ei, cu semn schimbat. */
  anuleaza?: string;
  /** Pretul de achizitie pe unitate (ml sau m²), la intrare, de pe factura furnizorului. */
  pret?: PretAchizitie;
  /** Intrarea dintr-o comanda (receptia, Faza 4): comanda si linia ei. */
  comanda?: { id: string; linie: string };
  /** Avizul sau factura cu care a venit marfa (S31). */
  document?: { tip: "aviz" | "factura"; serie?: string; numar: string; data: string };
  furnizor?: string;
}

export interface PretAchizitie {
  /** EUR pe unitate: lei / cursul de pe document (asa e evidenta firmei). */
  valoare: number;
  /** Lei pe unitate, cand factura e in lei. */
  lei?: number;
  /** Cursul cu care s-a trecut in euro (lei pentru 1 €), de pe document. */
  curs?: number;
}

/**
 * Pretul mediu de achizitie al unui articol, in euro: media intrarilor cu pret,
 * ponderata cu cantitatea. Intrarile anulate nu intra. Null = niciun pret.
 */
export function pretMediu(miscari: readonly Miscare[], cheie: string): number | null {
  let cant = 0;
  let valoare = 0;
  for (const m of miscari) {
    // Fara marca in cheie: media pe toate marcile materialului.
    const potrivit = m.articol.cheie === cheie || cheieBaza(m.articol) === cheie;
    if (m.tip !== "intrare" || m.anuleaza || !m.pret || !potrivit || esteAnulata(m, miscari)) continue;
    cant += m.cantitate;
    valoare += m.pret.valoare * m.cantitate;
  }
  return cant > 0 ? valoare / cant : null;
}

export interface Sold {
  depozit: string;
  articol: Articol;
  cantitate: number;
  negativ: boolean;
}

/** Tubul se masoara in metri; saltelele, placile si tabla pe suprafata. */
export function articolDin(
  m: Pick<MaterialNecesar, "sistem" | "grosime_mm" | "rand"> & { categorie?: Categorie; forma?: Categorie },
  marca?: string,
): Articol {
  const forma = m.categorie ?? m.forma ?? formaImplicita(m.sistem, m.rand);
  const brand = marca?.trim();
  return {
    cheie: cheieMaterial(m.sistem, forma, m.grosime_mm, m.rand) + (brand ? `|${brand}` : ""),
    sistem: m.sistem, grosime_mm: m.grosime_mm, rand: m.rand, forma,
    um: forma === "tub" ? "ml" : "m2",
    ...(brand ? { marca: brand } : {}),
  };
}

/** Cantitatea din necesar, in unitatea articolului. */
export const cantitateNecesara = (m: MaterialNecesar, a: Articol = articolDin(m)): number =>
  a.um === "ml" ? m.ml : m.m2;

/**
 * Returul la furnizor (S32, rar): marfa pleaca din depozit inapoi la cel care
 * a vandut-o, deci n-are depozit de sosire. E tot un `retur`, ca baza sa nu
 * aiba un tip nou; il deosebeste furnizorul scris pe el.
 */
export const laFurnizor = (m: Pick<Miscare, "tip" | "spre" | "furnizor">): boolean =>
  m.tip === "retur" && !m.spre && Boolean(m.furnizor);

/** De ce nu e valida o miscare; null = valida. */
export function valideazaMiscare(m: Omit<Miscare, "id" | "data">): string | null {
  if (!Number.isFinite(m.cantitate) || m.cantitate === 0) return "Cantitatea trebuie să fie un număr diferit de zero.";
  if (m.tip !== "ajustare" && m.cantitate < 0) return "Cantitatea trebuie să fie pozitivă.";
  if (m.pret && (!Number.isFinite(m.pret.valoare) || m.pret.valoare < 0)) return "Prețul trebuie să fie un număr pozitiv.";
  const cere = CERE[m.tip];
  if (cere.din && !m.din) return "Alege depozitul din care iese materialul.";
  if (cere.spre && !m.spre && !laFurnizor(m)) return "Alege depozitul în care intră materialul.";
  if (m.din && m.spre && m.din === m.spre) return "Depozitul de plecare și cel de sosire sunt același.";
  return null;
}

/** Ce depozite cere fiecare tip de miscare: formularul arata doar campurile astea. */
export const CERE: Record<TipMiscare, { din: boolean; spre: boolean }> = {
  intrare: { din: false, spre: true },
  transfer: { din: true, spre: true },
  consum: { din: true, spre: false },
  retur: { din: true, spre: true },
  ajustare: { din: false, spre: true },
};

/** Ce face o miscare in fiecare depozit. */
function efecte(m: Miscare, dupaId: ReadonlyMap<string, Miscare>): { depozit: string; delta: number }[] {
  if (m.anuleaza) {
    const original = dupaId.get(m.anuleaza);
    return original ? efecte(original, dupaId).map((e) => ({ ...e, delta: -e.delta })) : [];
  }
  const out: { depozit: string; delta: number }[] = [];
  if (m.din && CERE[m.tip].din) out.push({ depozit: m.din, delta: -m.cantitate });
  if (m.spre && CERE[m.tip].spre) out.push({ depozit: m.spre, delta: m.cantitate });
  return out;
}

/** Stocul, pe depozit si articol: suma miscarilor. Soldurile zero nu apar. */
export function solduri(miscari: readonly Miscare[]): Sold[] {
  const dupaId = new Map(miscari.map((m) => [m.id, m]));
  const acc = new Map<string, Sold>();
  for (const m of miscari) {
    for (const e of efecte(m, dupaId)) {
      const k = `${e.depozit}#${m.articol.cheie}`;
      const s = acc.get(k) ?? { depozit: e.depozit, articol: m.articol, cantitate: 0, negativ: false };
      s.cantitate += e.delta;
      acc.set(k, s);
    }
  }
  return [...acc.values()]
    .map((s) => ({ ...s, cantitate: Math.round(s.cantitate * 100) / 100 }))
    .map((s) => ({ ...s, negativ: s.cantitate < 0 }))
    .filter((s) => s.cantitate !== 0);
}

/** Miscarea inversa. Nu se aplica de doua ori si nu se anuleaza un storno. */
export function storno(m: Miscare, miscari: readonly Miscare[], id: string, data: string): Miscare | null {
  if (m.anuleaza || esteAnulata(m, miscari)) return null;
  const [an, luna, zi] = m.data.slice(0, 10).split("-");
  return { ...m, id, data, anuleaza: m.id, nota: `anulează mișcarea din ${zi}.${luna}.${an}` };
}

export const esteAnulata = (m: Miscare, miscari: readonly Miscare[]): boolean =>
  miscari.some((x) => x.anuleaza === m.id);

/** Scoate datele de exemplu si stornourile lor; miscarile omului raman neatinse. */
export function faraExemple(miscari: readonly Miscare[]): Miscare[] {
  const exemple = new Set(miscari.filter((m) => m.exemplu).map((m) => m.id));
  return miscari.filter((m) => !m.exemplu && !(m.anuleaza && exemple.has(m.anuleaza)));
}

export interface DeComandat {
  articol: Articol;
  necesar: number;
  inStoc: number;
  deComandat: number;
  /** Cand articolul are ambalaj: cate ambalaje intregi se comanda. */
  ambalaje?: { cate: number; ambalaj: Ambalaj; cantitate: number; rest: number; dinEvidenta?: true };
  /** Materialul il da clientul: nu se comanda. */
  alClientului?: true;
}

/**
 * Comanda rotunjita in sus la ambalaj intreg (S14: „rotunjim la ambalaj
 * intreg; diferenta ajunge in depozit"). `rest` e ce ramane in depozit.
 */
export function laAmbalaj(cantitate: number, a: Ambalaj): { cate: number; ambalaj: Ambalaj; cantitate: number; rest: number } {
  const cate = a.continut > 0 ? Math.ceil(Math.round((cantitate / a.continut) * 1e6) / 1e6) : 0;
  const total = Math.round(cate * a.continut * 100) / 100;
  return { cate, ambalaj: a, cantitate: total, rest: Math.round((total - cantitate) * 100) / 100 };
}

/**
 * Necesarul unei lucrari fata de stocul din depozitele date (de obicei cel
 * central plus santierul lucrarii). Soldul negativ nu se socoteste ca stoc.
 * Stocul se ia pe material, oricare ar fi marca (`cheieBaza`); ambalajul e pe
 * material, tot fara marca.
 */
export function deComandat(
  materiale: readonly MaterialNecesar[], sold: readonly Sold[], depozite: readonly string[],
  ambalaje: Readonly<Record<string, Ambalaj>> = {},
): DeComandat[] {
  return materiale.map((m) => {
    const articol = articolDin(m);
    const necesar = cantitateNecesara(m, articol);
    if (m.alClientului) return { articol, necesar, inStoc: 0, deComandat: 0, alClientului: true };
    const inStoc = sold
      .filter((s) => cheieBaza(s.articol) === articol.cheie && depozite.includes(s.depozit) && s.cantitate > 0)
      .reduce((t, s) => t + s.cantitate, 0);
    const rest = Math.max(0, Math.round((necesar - inStoc) * 100) / 100);
    const scris = ambalaje[articol.cheie] ?? ambalaje[cheieFaraForma(m.sistem, m.grosime_mm, m.rand)];
    const a = scris ?? ambalajImplicit(m);
    return {
      articol, necesar, inStoc: Math.round(inStoc * 100) / 100, deComandat: rest,
      ...(a && rest > 0 ? { ambalaje: { ...laAmbalaj(rest, a), ...(scris ? {} : { dinEvidenta: true as const }) } } : {}),
    };
  });
}

/**
 * Datele de exemplu ale prototipului: intrari in depozitul dat, marcate
 * `exemplu`, ca ecranul sa arate cum scade „de comandat". Cand exista un
 * necesar trimis din import, primele lui materiale se acopera pe rand complet
 * (unul din trei) si pe jumatate — deci ecranul arata si „acoperit", si „de
 * comandat"; altfel, trei articole uzuale. Nu sunt stocuri
 * reale si nu se amesteca cu ele: `faraExemple` le scoate pe toate.
 */
export function miscariDeExemplu(
  materiale: readonly MaterialNecesar[], depozit: string, id: () => string, data: string,
): Miscare[] {
  const surse = materiale.length > 0
    ? materiale.slice(0, 8).map((m, i) => ({
      articol: articolDin(m), cantitate: Math.ceil(cantitateNecesara(m) * (i % 3 === 0 ? 1 : 0.5)),
    }))
    : [
      { articol: articolDin({ sistem: "vata_minerala", grosime_mm: 50, rand: 114 }), cantitate: 120 },
      { articol: articolDin({ sistem: "elastomer", grosime_mm: 13, rand: 22 }), cantitate: 200 },
      { articol: articolDin({ sistem: "tabla", grosime_mm: 0.8, rand: null }), cantitate: 60 },
    ];
  return surse.filter((x) => x.cantitate > 0).map((x) => ({
    id: id(), data, tip: "intrare" as const, articol: x.articol, cantitate: x.cantitate,
    spre: depozit, nota: "exemplu", exemplu: true as const,
  }));
}
