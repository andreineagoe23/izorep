/**
 * Faza 4: comanda la furnizor si receptia ei.
 *
 * Problema firmei (S1): ramane marfa pe santier cand se comanda totul dintr-o
 * data. De aici trei reguli:
 *
 * 1. **Ramas de comandat** = necesarul santierului − ce s-a adus deja pe el −
 *    ce e comandat si n-a sosit. Stocul din central si de pe alte santiere NU
 *    se scade: apare alaturi, ca propunere de transfer, iar omul decide (S10,
 *    S24). Inainte se scadea centralul din fiecare santier, deci doua santiere
 *    deschise numarau aceiasi 100 m² de doua ori.
 * 2. **Receptia e o intrare in stoc**, pe liniile comenzii: fiecare intrare
 *    poarta comanda, linia si documentul (avizul sau factura). Nu exista un al
 *    doilea registru: ce s-a primit se socoteste din miscari, iar o receptie
 *    gresita se anuleaza cu storno, ca orice miscare.
 * 3. **Pretul in euro = lei / cursul de pe document.** Asa e scrisa evidenta
 *    firmei: pe 3.191 din 3.191 de randuri din 2025–2026, PRET EURO = PRET RON
 *    / CURS, la cursul facturii (factura ISOLINE CS 202627295: 39,7719 lei /
 *    5,31 = 7,49 €). Planul pornise de la „BNR + 2 %”, din ce s-a spus la
 *    telefon; evidenta arata ca marja e deja in cursul facturii.
 *
 * Pur, fara I/O: ruleaza la fel in browser, pe server si in teste.
 */
import { CERE, formaArticol, cheieBaza, esteAnulata, laFurnizor, type Articol, type Miscare } from "./registru.js";
import { cantitateNecesara, articolDin, laAmbalaj, type Ambalaj } from "./registru.js";
import { ambalajImplicit } from "./ambalaje.js";
import { cheieFaraForma, type MaterialNecesar } from "./necesar.js";
import { denumireComanda, kgPeMp } from "./produse.js";

/** Depozitul central al firmei (id-ul din seed si din ecrane). */
export const CENTRAL = "central";

export interface PretPeUnitate {
  valoare: number;
  moneda: "EUR" | "RON";
}

/** Pretul asteptat pe ciorna: cu sursa lui, ca omul sa stie de unde e. */
export interface PretAsteptat extends PretPeUnitate {
  /** „lista K-Flex ST, 24.06.2026”, „factura … din …”. Lipsa = scris de om. */
  sursa?: string;
  /** Cursul de pe factura din care vine pretul in lei. */
  curs?: number;
}

export interface LinieComanda {
  id: string;
  articol: Articol;
  /** In unitatea articolului: ml la tub, m² la saltea, placa si tabla. */
  cantitate: number;
  /**
   * Pretul asteptat, fara TVA, pe unitatea de pe document (kg la tabla): din
   * lista furnizorului, din ultima factura, sau scris de om (`pretPropus`).
   */
  pret?: PretAsteptat;
}

export interface Comanda {
  id: string;
  /** ISO. */
  creat: string;
  furnizor: string;
  /** Firma pe care vine factura („Factura pe RADOIA ISOLIRUNG SRL"). */
  firma: string;
  /** Santierul (id-ul planului) pentru care se comanda. Lipsa = stocul general. */
  santier?: string;
  /** Unde vine marfa: depozitul santierului sau `central` (S6). */
  spre: string;
  linii: LinieComanda[];
  /** Comanda peste necesar, cu motivul ei (S28: lipsa, pierdere, lucrare in plus). */
  suplimentara?: string;
  nota?: string;
  /** ISO. Trimisa, comanda nu se mai schimba; se poate doar anula. */
  trimisa?: string;
  /** ISO. */
  anulata?: string;
}

export type StareComanda = "ciorna" | "trimisa" | "partial" | "primita" | "anulata";

/** Documentul cu care a venit marfa. */
export interface DocumentIntrare {
  tip: "aviz" | "factura";
  serie?: string;
  numar: string;
  /** ISO, data de pe document. */
  data: string;
}

/** Poza sau PDF-ul unui aviz sau al unei facturi, atasat la receptie (S31). Fisierul sta pe server. */
export interface DocumentAtasat {
  id: string;
  comanda: string;
  tip: "aviz" | "factura";
  numar: string;
  /** Numele fisierului, cum l-a ales omul. */
  nume: string;
}

/* ------------------------------------------------------------ furnizorul */

/**
 * Furnizorul propus pe fiecare fel de material: cel de la care firma cumpara
 * de obicei, numarat in evidenta 2025–2026 (randuri):
 *
 *   cochilii de vata        ISOLINE 239, Banda Tech 10
 *   tub si placa elastomer  Banda Tech 805 / 364, Ravago 8 / 18
 *   saltele de vata         Banda Tech 373, Ravago 30
 *   placi de vata la foc    Banda Tech 174, Ravago 18
 *   tabla de aluminiu       Banda Tech 47, Steelmet 25, Color Metal 24
 *   tabla de inox           Direct Line Inox 6
 *
 * E doar propunerea de pe ciorna: omul il schimba.
 */
export function furnizorPropus(a: Pick<Articol, "sistem" | "rand" | "forma">): string {
  if (a.sistem === "tabla_inox") return "Direct Line Inox";
  if (a.sistem === "vata_minerala" && formaArticol(a) === "tub") return "Isoline";
  return "Banda Tech";
}

/* ---------------------------------------------------- ce s-a primit, starea */

const rotunjit = (n: number): number => Math.round(n * 1000) / 1000;

/** Cat s-a primit pe fiecare linie: intrarile cu comanda si linia ei, neanulate. */
export function primitPeLinii(c: Comanda, miscari: readonly Miscare[]): Map<string, number> {
  const out = new Map<string, number>(c.linii.map((l) => [l.id, 0]));
  for (const m of miscari) {
    if (m.tip !== "intrare" || m.anuleaza || m.comanda?.id !== c.id || esteAnulata(m, miscari)) continue;
    out.set(m.comanda.linie, rotunjit((out.get(m.comanda.linie) ?? 0) + m.cantitate));
  }
  return out;
}

export function stareComanda(c: Comanda, miscari: readonly Miscare[]): StareComanda {
  if (c.anulata) return "anulata";
  if (!c.trimisa) return "ciorna";
  const primit = primitPeLinii(c, miscari);
  const toate = c.linii.every((l) => (primit.get(l.id) ?? 0) >= l.cantitate - 1e-9);
  if (toate) return "primita";
  return [...primit.values()].some((q) => q > 0) ? "partial" : "trimisa";
}

/** Cat a ramas de primit pe fiecare linie (niciodata negativ). */
export function ramasDePrimit(c: Comanda, miscari: readonly Miscare[]): Map<string, number> {
  const primit = primitPeLinii(c, miscari);
  return new Map(c.linii.map((l) => [l.id, Math.max(0, rotunjit(l.cantitate - (primit.get(l.id) ?? 0)))]));
}

/* ------------------------------------------------------ ramas de comandat */

/**
 * Ce a ajuns pe un depozit, oricat s-ar fi consumat de atunci: intrarile si
 * transferurile spre el, minus transferurile si retururile care au plecat.
 * Consumul nu scade: materialul consumat a fost adus si nu se mai comanda.
 */
export function adus(miscari: readonly Miscare[], depozit: string, cheie: string): number {
  let q = 0;
  for (const m of miscari) {
    if (m.anuleaza || esteAnulata(m, miscari) || cheieBaza(m.articol) !== cheie) continue;
    if ((m.tip === "intrare" || m.tip === "transfer") && m.spre === depozit) q += m.cantitate;
    if ((m.tip === "transfer" || m.tip === "retur") && m.din === depozit) q -= m.cantitate;
  }
  return rotunjit(q);
}

/** Soldul unui articol (fara marca) pe un depozit, ca `solduri`: consumul scade. */
export function soldPe(miscari: readonly Miscare[], depozit: string, cheie: string): number {
  let q = 0;
  for (const m of miscari) {
    if (m.anuleaza || esteAnulata(m, miscari) || cheieBaza(m.articol) !== cheie) continue;
    if (CERE[m.tip].din && m.din === depozit) q -= m.cantitate;
    if (CERE[m.tip].spre && m.spre === depozit) q += m.cantitate;
  }
  return rotunjit(q);
}

/** Comandat si nesosit spre un depozit: ciornele si comenzile trimise, minus ce a venit. */
export function comandatNesosit(
  comenzi: readonly Comanda[], miscari: readonly Miscare[], depozit: string, cheie: string,
): number {
  let q = 0;
  for (const c of comenzi) {
    // Ciorna n-a plecat la furnizor: nu e pe drum (vezi `inCiorna`).
    if (c.anulata || !c.trimisa || c.spre !== depozit) continue;
    const ramas = ramasDePrimit(c, miscari);
    for (const l of c.linii) if (cheieBaza(l.articol) === cheie) q += ramas.get(l.id) ?? 0;
  }
  return rotunjit(q);
}

/**
 * Cat e pe ciornele netrimise spre un depozit. Nu e comandat (n-a plecat la
 * furnizor), dar nici de comandat din nou: altfel „Fă comenzile” ar face a
 * doua ciorna pe acelasi material. Pana pe 14 octombrie 2026 ciornele intrau
 * in `comandatNesosit`, iar santierul arata „Lipsește: nimic” pe un material
 * care nici nu fusese comandat.
 */
export function inCiorna(comenzi: readonly Comanda[], depozit: string, cheie: string): number {
  let q = 0;
  for (const c of comenzi) {
    if (c.anulata || c.trimisa || c.spre !== depozit) continue;
    for (const l of c.linii) if (cheieBaza(l.articol) === cheie) q += l.cantitate;
  }
  return rotunjit(q);
}

export interface DeComandatSantier {
  material: MaterialNecesar;
  articol: Articol;
  necesar: number;
  /** Adus deja pe santier (intrari si transferuri, minus retururi); la etapa, cat e acum acolo. */
  adus: number;
  /** Comandat spre santier (comenzi trimise) si nesosit inca. */
  comandat: number;
  /** Pe ciornele netrimise spre santier. */
  inCiorna: number;
  /** Ce mai trebuie comandat: necesar − adus − comandat − în ciornă. */
  ramas: number;
  /** Rotunjit la ambalaj intreg, cand articolul are ambalaj. */
  ambalaje?: ReturnType<typeof laAmbalaj> & { dinEvidenta?: true };
  /** Unde mai e material, ca propunere de transfer: depozit → cantitate libera. */
  disponibil: { depozit: string; cantitate: number }[];
}

/**
 * Ramas de comandat pe un santier. `materialeAlteSantiere` spune cat le mai
 * trebuie celorlalte santiere: doar ce depaseste nevoia lor e propus pentru
 * transfer. Centralul e liber in intregime (e stoc general).
 *
 * `fata` spune ce se scade din necesar:
 *
 * - `adus` (implicit): necesarul e al intregii oferte, deci se scade tot ce a
 *   ajuns vreodata pe santier, consumat sau nu;
 * - `sold`: necesarul e doar al etapei masurate pe teren (S2: „comanda se da
 *   dupa masuratori”), deci se scade doar ce e acum pe santier. Ce s-a pus
 *   deja pe teva in etapele dinainte nu mai e acolo.
 */
export function deComandatSantier(
  materiale: readonly MaterialNecesar[], miscari: readonly Miscare[], comenzi: readonly Comanda[],
  depozit: string, ambalaje: Readonly<Record<string, Ambalaj>> = {},
  alteSantiere: readonly { depozit: string; materiale: readonly MaterialNecesar[] }[] = [],
  fata: "adus" | "sold" = "adus",
): DeComandatSantier[] {
  return materiale.filter((m) => !m.alClientului).map((m) => {
    const articol = articolDin(m);
    const cheie = articol.cheie;
    const necesar = cantitateNecesara(m, articol);
    const a = fata === "sold" ? Math.max(0, soldPe(miscari, depozit, cheie)) : adus(miscari, depozit, cheie);
    const comandat = comandatNesosit(comenzi, miscari, depozit, cheie);
    const ciorna = inCiorna(comenzi, depozit, cheie);
    const ramas = Math.max(0, rotunjit(necesar - a - comandat - ciorna));
    const disponibil: { depozit: string; cantitate: number }[] = [];
    const central = soldPe(miscari, CENTRAL, cheie);
    if (central > 0) disponibil.push({ depozit: CENTRAL, cantitate: central });
    // Pe alt santier e liber doar ce s-a adus peste nevoia lui, cat mai e acolo.
    for (const s of alteSantiere) {
      if (s.depozit === depozit) continue;
      const nevoie = s.materiale.filter((x) => articolDin(x).cheie === cheie).reduce((t, x) => t + cantitateNecesara(x), 0);
      const liber = rotunjit(Math.min(soldPe(miscari, s.depozit, cheie), adus(miscari, s.depozit, cheie) - nevoie));
      if (liber > 0) disponibil.push({ depozit: s.depozit, cantitate: liber });
    }
    const scris = ambalaje[cheie] ?? ambalaje[cheieFaraForma(m.sistem, m.grosime_mm, m.rand)];
    const amb = scris ?? ambalajImplicit(m);
    return {
      material: m, articol, necesar, adus: a, comandat, inCiorna: ciorna, ramas, disponibil,
      ...(amb && ramas > 0 ? { ambalaje: { ...laAmbalaj(ramas, amb), ...(scris ? {} : { dinEvidenta: true as const }) } } : {}),
    };
  });
}

/* -------------------------------------------------------------- ciornele */

/**
 * Ciornele din ce a ramas de comandat: o comanda pe furnizor, cu cantitatea
 * rotunjita la ambalaj. Pretul vine din `pret` (de obicei `pretPropus`: lista
 * furnizorului sau ultima factura); fara el, linia ramane fara pret.
 */
export function ciorneDinRamas(
  randuri: readonly Pick<DeComandatSantier, "articol" | "ramas" | "ambalaje">[], baza: Pick<Comanda, "firma" | "santier" | "spre"> & { nota?: string },
  id: () => string, creat: string, pret?: (a: Articol, furnizor: string) => PretAsteptat | null,
): Comanda[] {
  const peFurnizor = new Map<string, LinieComanda[]>();
  for (const r of randuri) {
    if (r.ramas <= 0) continue;
    const f = furnizorPropus(r.articol);
    const linii = peFurnizor.get(f) ?? [];
    const p = pret?.(r.articol, f);
    linii.push({ id: id(), articol: r.articol, cantitate: r.ambalaje?.cantitate ?? r.ramas, ...(p ? { pret: p } : {}) });
    peFurnizor.set(f, linii);
  }
  return [...peFurnizor].map(([furnizor, linii]) => ({ id: id(), creat, furnizor, ...baza, linii }));
}

/** Cantitatea liniei pe document: kg la tabla (asa se cumpara), altfel ml sau m². */
export const cantitatePeDocument = (l: Pick<LinieComanda, "articol" | "cantitate">): number => {
  const kg = kgPeMp(l.articol);
  return kg !== null ? Math.ceil(l.cantitate * kg) : l.cantitate;
};

/** Valoarea asteptata a comenzii, pe moneda (fara TVA): liniile fara pret nu intra. */
export function valoareAsteptata(c: Pick<Comanda, "linii">): { EUR: number; RON: number; faraPret: number } {
  const v = { EUR: 0, RON: 0, faraPret: 0 };
  for (const l of c.linii) {
    if (!l.pret) { v.faraPret++; continue; }
    v[l.pret.moneda] += l.pret.valoare * cantitatePeDocument(l);
  }
  return { EUR: Math.round(v.EUR * 100) / 100, RON: Math.round(v.RON * 100) / 100, faraPret: v.faraPret };
}

/* ------------------------------------------------------------ comunicarea */

const cifra = (n: number): string => n.toLocaleString("ro-RO", { maximumFractionDigits: 2 });

/** Cantitatea cum se scrie pe comanda: metri, m², iar tabla si in kg (S13: se cumpara la kg). */
export function cantitateComanda(l: Pick<LinieComanda, "articol" | "cantitate">): string {
  if (l.articol.um === "ml") return `${cifra(l.cantitate)} m`;
  const kg = kgPeMp(l.articol);
  return kg !== null ? `${cifra(Math.ceil(l.cantitate * kg))} kg (${cifra(l.cantitate)} m²)` : `${cifra(l.cantitate)} m²`;
}

/**
 * Textul de pus in email, ca in comanda reala TRANSAVIA (13 iulie 2026):
 * „Dorim sa comandam pentru obiectivul TRANSAVIA ALBA-IULIA urmatoarele :
 * * Cochilii caserate Ø140 x 50 mm = 350 m ; Factura pe RADOIA ISOLIRUNG SRL."
 */
export function textEmail(c: Comanda, obiectiv: string): string {
  const pentru = obiectiv ? ` pentru obiectivul ${obiectiv}` : " pentru stocul nostru";
  const linii = c.linii.map((l) => `* ${denumireComanda(l.articol)} = ${cantitateComanda(l)} ;`);
  return [
    "Buna ziua,",
    "",
    `Dorim sa comandam${pentru} urmatoarele :`,
    ...linii,
    "",
    `Factura pe ${c.firma}.`,
    ...(c.nota ? ["", c.nota] : []),
    "",
    "Multumim !",
  ].join("\n");
}

/* --------------------------------------------------------------- receptia */

export interface LinieReceptie {
  linie: string;
  /** Pe document: kg la tabla, altfel in unitatea articolului. */
  cantitate: number;
  /** Pretul unitar de pe factura, in unitatea documentului (lei/kg la tabla). */
  pret?: PretPeUnitate;
  marca?: string;
}

export interface Receptie {
  comanda: Comanda;
  document: DocumentIntrare;
  /** Lei pentru 1 €; obligatoriu cand vreun pret e in lei. De pe document. */
  curs?: number;
  /** Transportul, pe document, impartit pe linii dupa valoare. */
  transport?: PretPeUnitate;
  /** Alt depozit decat cel al comenzii (marfa ajunsa direct pe alt santier, S6). */
  spre?: string;
  linii: LinieReceptie[];
}

/** De ce nu se poate inregistra receptia; null = se poate. */
export function valideazaReceptie(r: Receptie): string | null {
  if (r.comanda.anulata) return "Comanda e anulată.";
  if (!r.comanda.trimisa) return "Comanda nu a fost trimisă: trimite-o întâi.";
  if (!r.document.numar.trim()) return "Scrie numărul avizului sau al facturii.";
  const linii = r.linii.filter((l) => l.cantitate > 0);
  if (linii.length === 0) return "Nicio cantitate primită.";
  if (r.linii.some((l) => !Number.isFinite(l.cantitate) || l.cantitate < 0)) return "Cantitățile trebuie să fie pozitive.";
  const cuLei = linii.some((l) => l.pret?.moneda === "RON") || r.transport?.moneda === "RON";
  if (cuLei && !(r.curs && r.curs > 0)) return "Prețul e în lei: scrie cursul de pe factură.";
  for (const l of linii) if (!r.comanda.linii.some((x) => x.id === l.linie)) return "O linie nu e pe comandă.";
  return null;
}

const inEuro = (p: PretPeUnitate, curs?: number): number => (p.moneda === "EUR" ? p.valoare : p.valoare / curs!);

/**
 * Intrarile in stoc dintr-o receptie: una pe linie primita. Tabla vine la kg
 * si intra in m² (kg / densitate × grosime). Transportul se imparte pe linii
 * dupa valoare si intra in pretul unitar (S26: rand separat pe document).
 */
export function intrariDinReceptie(r: Receptie, id: () => string, data: string): Miscare[] {
  const linii = r.linii.filter((l) => l.cantitate > 0).map((l) => {
    const lc = r.comanda.linii.find((x) => x.id === l.linie)!;
    const kg = kgPeMp(lc.articol);
    const laKg = kg !== null;
    const cantitate = laKg ? rotunjit(l.cantitate / kg) : l.cantitate;
    // Pretul pe unitatea documentului; in stoc, pe unitatea articolului.
    const valoareEur = l.pret ? inEuro(l.pret, r.curs) * l.cantitate : null;
    const valoareLei = l.pret ? (l.pret.moneda === "RON" ? l.pret.valoare : l.pret.valoare * (r.curs ?? 0)) * l.cantitate : null;
    return { l, lc, cantitate, valoareEur, valoareLei };
  });
  const totalEur = linii.reduce((t, x) => t + (x.valoareEur ?? 0), 0);
  const transportEur = r.transport ? inEuro(r.transport, r.curs) : 0;
  const nrDoc = [r.document.serie, r.document.numar].filter(Boolean).join(" ");
  return linii.map(({ l, lc, cantitate, valoareEur, valoareLei }) => {
    const parteTransport = totalEur > 0 && valoareEur !== null ? transportEur * (valoareEur / totalEur) : 0;
    const marca = l.marca?.trim() || lc.articol.marca;
    const articol = marca ? articolDin(lc.articol, marca) : lc.articol;
    const m: Miscare = {
      id: id(), data, tip: "intrare", articol, cantitate, spre: r.spre ?? r.comanda.spre,
      comanda: { id: r.comanda.id, linie: lc.id },
      document: r.document, furnizor: r.comanda.furnizor,
      nota: `${r.document.tip === "aviz" ? "aviz" : "factura"} ${nrDoc}`,
      ...(r.comanda.santier ? { lucrareId: r.comanda.santier } : {}),
    };
    if (valoareEur !== null) {
      m.pret = {
        valoare: Math.round(((valoareEur + parteTransport) / cantitate) * 10000) / 10000,
        ...(valoareLei !== null && r.curs ? { lei: Math.round((valoareLei / cantitate) * 10000) / 10000, curs: r.curs } : {}),
      };
    }
    return m;
  });
}

/* ---------------------------------------------------------------- factura */

export interface Factura {
  document: DocumentIntrare & { tip: "factura" };
  curs?: number;
  transport?: PretPeUnitate;
  /** Pretul unitar pe linia comenzii, in unitatea documentului (lei/kg la tabla). */
  preturi: Record<string, PretPeUnitate>;
}

/** Intrarile unui aviz, neanulate: ce inlocuieste factura. */
export function intrariPeAviz(c: Comanda, miscari: readonly Miscare[], numar: string): Miscare[] {
  return miscari.filter((m) => m.tip === "intrare" && !m.anuleaza && !esteAnulata(m, miscari)
    && m.comanda?.id === c.id && m.document?.tip === "aviz" && m.document.numar === numar);
}

/**
 * Cand a ajuns materialul unei intrari. Intrarea scrisa de factura care
 * inlocuieste un aviz (`inlocuiesteCuFactura`) n-aduce material nou: marfa a
 * venit cu avizul, iar factura pune doar pretul. Ea poarta in nota avizul
 * („(aviz 20261262)”), deci data sosirii e a intrarii avizului de pe aceeasi
 * linie a comenzii. Altfel, data miscarii.
 */
export function dataSosirii(m: Miscare, miscari: readonly Miscare[]): string {
  const aviz = /\(aviz ([^)]+)\)$/.exec(m.nota ?? "")?.[1];
  if (m.tip !== "intrare" || !aviz || !m.comanda || m.document?.tip !== "factura") return m.data;
  const vechi = miscari.find((x) => x.id !== m.id && x.tip === "intrare" && !x.anuleaza
    && x.comanda?.id === m.comanda!.id && x.comanda.linie === m.comanda!.linie
    && x.document?.tip === "aviz" && x.document.numar === aviz);
  return vechi?.data ?? m.data;
}

/**
 * Factura venita dupa marfa (ISOLINE: avizul CS 20261262 pe 17 iulie, „urmeaza
 * factura", factura CS 202627295 pe 20 iulie). Intrarile avizului se anuleaza
 * cu storno si se scriu din nou, cu aceleasi cantitati, pe factura si cu
 * pretul ei: stocul nu se misca, iar jurnalul arata tot drumul. Evidenta
 * firmei e tinuta tot pe factura, cu avizul alaturi.
 */
export function inlocuiesteCuFactura(
  c: Comanda, miscari: readonly Miscare[], aviz: string, f: Factura, id: () => string, data: string,
): Miscare[] {
  // In ordinea id-urilor: browserul si serverul fac acelasi calcul cu aceleasi id-uri noi.
  const vechi = intrariPeAviz(c, miscari, aviz).sort((a, b) => a.id.localeCompare(b.id));
  const stornouri = vechi.map((m): Miscare => ({
    ...m, id: id(), data, anuleaza: m.id, nota: `înlocuită de factura ${[f.document.serie, f.document.numar].filter(Boolean).join(" ")}`,
  }));
  const linii: LinieReceptie[] = vechi.map((m) => {
    const lc = c.linii.find((x) => x.id === m.comanda!.linie)!;
    const kg = kgPeMp(lc.articol);
    const pret = f.preturi[lc.id];
    return {
      linie: lc.id, cantitate: kg !== null ? rotunjit(m.cantitate * kg) : m.cantitate,
      ...(pret ? { pret } : {}), ...(m.articol.marca ? { marca: m.articol.marca } : {}),
    };
  });
  const spre = vechi[0]?.spre;
  const noi = intrariDinReceptie({
    comanda: c, document: f.document, linii,
    ...(f.curs ? { curs: f.curs } : {}), ...(f.transport ? { transport: f.transport } : {}), ...(spre ? { spre } : {}),
  }, id, data).map((m) => ({ ...m, nota: `${m.nota} (aviz ${aviz})` }));
  return [...stornouri, ...noi];
}

/* ---------------------------------------------------- returul la furnizor */

/**
 * Returul la furnizor (S32: „se intampla rar"): marfa primita pe o comanda
 * pleaca inapoi, de obicei pentru ca e defecta sau gresita. E o miscare
 * `retur` fara depozit de sosire (`laFurnizor`), legata de linia comenzii.
 *
 * Primitul pe linie nu scade: ce a venit a venit, iar comanda nu se redeschide
 * singura. Scade insa ce s-a adus pe santier (`adus`), deci daca materialul
 * trebuie inlocuit, reapare in „Ramas de comandat" si se cere cu o comanda
 * suplimentara.
 */
export interface Retur {
  comanda: Comanda;
  linie: string;
  /** Pe document: kg la tabla, altfel in unitatea articolului (ca la receptie). */
  cantitate: number;
  /** Depozitul din care pleaca marfa. */
  din: string;
  motiv: string;
  /** Avizul de retur, cand exista. */
  document?: DocumentIntrare;
}

/** Cat s-a returnat pe fiecare linie, in unitatea articolului. */
export function returnatPeLinii(c: Comanda, miscari: readonly Miscare[]): Map<string, number> {
  const out = new Map<string, number>(c.linii.map((l) => [l.id, 0]));
  for (const m of miscari) {
    if (!laFurnizor(m) || m.anuleaza || m.comanda?.id !== c.id || esteAnulata(m, miscari)) continue;
    out.set(m.comanda.linie, rotunjit((out.get(m.comanda.linie) ?? 0) + m.cantitate));
  }
  return out;
}

/** De ce nu se poate inregistra returul; null = se poate. */
export function valideazaRetur(r: Retur, miscari: readonly Miscare[]): string | null {
  const lc = r.comanda.linii.find((l) => l.id === r.linie);
  if (!lc) return "Linia nu e pe comandă.";
  if (!(r.cantitate > 0) || !Number.isFinite(r.cantitate)) return "Scrie cât se returnează.";
  if (!r.motiv.trim()) return "Scrie de ce se returnează (defect, greșit, în plus).";
  if (!r.din) return "Alege depozitul din care pleacă marfa.";
  const kg = kgPeMp(lc.articol);
  const q = kg !== null ? rotunjit(r.cantitate / kg) : r.cantitate;
  const poate = rotunjit((primitPeLinii(r.comanda, miscari).get(lc.id) ?? 0) - (returnatPeLinii(r.comanda, miscari).get(lc.id) ?? 0));
  if (q > poate + 1e-9) return "Se returnează mai mult decât a venit pe linia asta.";
  return null;
}

/**
 * Miscarea de retur. Poarta pretul mediu al intrarilor de pe linie, ca in
 * evidenta cumpararilor sa iasa cu valoare, cu minus.
 */
export function returLaFurnizor(r: Retur, miscari: readonly Miscare[], id: () => string, data: string): Miscare {
  const lc = r.comanda.linii.find((l) => l.id === r.linie)!;
  const kg = kgPeMp(lc.articol);
  const cantitate = kg !== null ? rotunjit(r.cantitate / kg) : r.cantitate;
  let q = 0;
  let eur = 0;
  let lei = 0;
  let curs: number | undefined;
  for (const m of miscari) {
    if (m.tip !== "intrare" || m.anuleaza || m.comanda?.id !== r.comanda.id || m.comanda.linie !== lc.id || esteAnulata(m, miscari)) continue;
    if (!m.pret) continue;
    q += m.cantitate;
    eur += m.pret.valoare * m.cantitate;
    if (m.pret.lei !== undefined) lei += m.pret.lei * m.cantitate;
    curs = m.pret.curs ?? curs;
  }
  const nrDoc = r.document ? [r.document.serie, r.document.numar].filter(Boolean).join(" ") : "";
  return {
    id: id(), data, tip: "retur", articol: lc.articol, cantitate, din: r.din,
    comanda: { id: r.comanda.id, linie: lc.id }, furnizor: r.comanda.furnizor,
    nota: `retur la ${r.comanda.furnizor}: ${r.motiv.trim()}${nrDoc ? ` (aviz ${nrDoc})` : ""}`,
    ...(r.document ? { document: r.document } : {}),
    ...(r.comanda.santier ? { lucrareId: r.comanda.santier } : {}),
    ...(q > 0 ? {
      pret: {
        valoare: Math.round((eur / q) * 10000) / 10000,
        ...(lei > 0 && curs ? { lei: Math.round((lei / q) * 10000) / 10000, curs } : {}),
      },
    } : {}),
  };
}
