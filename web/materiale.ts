/**
 * Ce împart filele ecranului „Materiale” (De cumpărat, Comenzi, Depozit) și
 * ecranele care trimit spre ele (tabloul, șantierul): locurile, șantierele
 * deschise, ce mai e de comandat pe fiecare necesar.
 */
import { exemple } from "./date/exemple.js";
import { citestePlanuri, citesteDepozit } from "./date.js";
import type { NecesarLucrare, StareDepozit } from "./depozit-local.js";
import { numeArticol } from "./stoc-vizual.js";
import { articolDin, type Articol } from "../src/stoc/registru.js";
import { deComandatSantier, intrariPeAviz, stareComanda, type Comanda, type DeComandatSantier } from "../src/stoc/comenzi.js";
import { locuri, type Loc } from "../src/stoc/locuri.js";

export const CENTRAL = "central";

/**
 * Șantierele: cele făcute din oferte (cu firma lor); pe linkul demo, și cele din
 * datele firmei. Pe server doar cele din oferte: pornim doar cu șantierele noi
 * (S48, Faza 8), iar cele din datele firmei sunt lucrări de dinainte de aplicație.
 */
export const santiere = (): { id: string; denumire: string; firma?: string }[] => [
  ...citestePlanuri().map((p) => ({ id: p.id, denumire: p.denumire, firma: p.firma })),
  ...(exemple()?.SANTIERE ?? []),
];

/** Locurile cu material (Faza 5): centralul, atelierul, șantierele; cu firma și responsabilul. */
export const locurile = (): Loc[] => locuri(santiere(), citesteDepozit().responsabili ?? {});

export const depozite = (): { id: string; nume: string }[] => locurile().map((l) => ({ id: l.id, nume: l.nume }));

/**
 * Locul se mai poate alege: nu e un șantier închis (Faza 7). Listele care doar
 * arată (istoricul, locurile, drumul) rămân întregi; formularele nu oferă
 * șantierul închis, ca pe linkul demo, unde nu e trigger-ul din bază, să nu
 * se poată scrie nimic pe el.
 */
export const deschis = (): ((id: string) => boolean) => {
  const inchise = new Set(citestePlanuri().filter((p) => p.inchis).map((p) => p.id));
  return (id) => !inchise.has(id);
};

/** Depozitul în care vine materialul unui necesar: al șantierului; nelegat, centralul. */
export const depozitNecesar = (n: NecesarLucrare): string => n.santier ?? CENTRAL;

export const titluNecesar = (n: NecesarLucrare): string => n.obiectiv || n.fisier;

/**
 * Rămas de comandat pe fiecare material al unui necesar (Faza 4): necesar −
 * adus pe șantier − comandat nesosit. Centralul și celelalte șantiere apar ca
 * propunere de transfer, nu se scad.
 */
export function ramasPeNecesar(s: StareDepozit, n: NecesarLucrare): DeComandatSantier[] {
  const alte = s.necesare.filter((x) => x.id !== n.id && x.santier).map((x) => ({ depozit: x.santier!, materiale: x.materiale }));
  return deComandatSantier(n.materiale, s.miscari, s.comenzi ?? [], depozitNecesar(n), s.ambalaje, alte);
}

/**
 * Câte materiale mai sunt de comandat, pe fiecare necesar. Folosit și de
 * tabloul de bord. Pe un șantier închis, nimic: tabloul cerea „7 materiale de
 * comandat” pentru un șantier terminat (16 octombrie 2026).
 */
export function deComandatPeNecesar(s: StareDepozit): { necesar: NecesarLucrare; articole: number }[] {
  const eDeschis = deschis();
  return s.necesare.map((n) => ({
    necesar: n,
    articole: n.santier && !eDeschis(n.santier) ? 0 : ramasPeNecesar(s, n).filter((d) => d.ramas > 0).length,
  }));
}

/** Avizele recepționate pe comandă care încă n-au factură. */
export function avizeFaraFactura(c: Comanda, s: StareDepozit): string[] {
  const numere = new Set<string>();
  for (const m of s.miscari) if (m.comanda?.id === c.id && m.document?.tip === "aviz") numere.add(m.document.numar);
  return [...numere].filter((a) => intrariPeAviz(c, s.miscari, a).length > 0);
}

/**
 * Comenzile la care omul mai are ceva de făcut: ciorna de trimis, marfa de
 * primit, factura de trecut pe un aviz. Restul (primite, anulate) stau strânse.
 */
export function comandaDeLucru(c: Comanda, s: StareDepozit): boolean {
  const st = stareComanda(c, s.miscari);
  return st === "ciorna" || st === "trimisa" || st === "partial" || (st === "primita" && avizeFaraFactura(c, s).length > 0);
}

/** Cifrele de pe file: materialele care lipsesc pe șantierele deschise și comenzile de lucru. */
export function numereMateriale(s: StareDepozit): { deCumparat: number; comenzi: number } {
  return {
    deCumparat: deComandatPeNecesar(s).reduce((t, x) => t + x.articole, 0),
    comenzi: (s.comenzi ?? []).filter((c) => comandaDeLucru(c, s)).length,
  };
}

/** Toate articolele cunoscute: din necesaruri și din mișcări, fără dubluri. */
export function articoleCunoscute(s: StareDepozit): Articol[] {
  const toate = new Map<string, Articol>();
  for (const n of s.necesare) for (const m of n.materiale) { const a = articolDin(m); toate.set(a.cheie, a); }
  for (const m of s.miscari) toate.set(m.articol.cheie, m.articol);
  return [...toate.values()].sort((a, b) => numeArticol(a).localeCompare(numeArticol(b), "ro"));
}

/** Materialele fără marcă: pe ele se pun ambalajele. */
export function materialeDeBaza(s: StareDepozit): Articol[] {
  const toate = new Map<string, Articol>();
  for (const a of articoleCunoscute(s)) { const b = articolDin(a); toate.set(b.cheie, b); }
  return [...toate.values()];
}
