/**
 * Unde stau datele: pe server (Faza 3, 9 octombrie 2026) sau, pe linkul demo de
 * pe GitHub Pages, in browser, ca pana acum.
 *
 * Ecranele citesc sincron (`citestePlanuri()`, `citesteDepozit()`) si scriu
 * starea intreaga (`scriePlanuri(planuri)`), ca pe vremea lui `localStorage`.
 * Pe server, modulul tine o copie in memorie, luata la fiecare schimbare de
 * ecran (`reimprospateaza`), iar o scriere se compara cu copia si pleaca la
 * server doar ce s-a schimbat: o miscare noua, o situatie, un necesar. Asa
 * ecranele nu s-au rescris, iar ce face un coleg pe alt calculator se vede la
 * urmatoarea schimbare de ecran.
 *
 * Scrierile pleaca intr-o coada, una dupa alta (santierul inaintea situatiei
 * lui). Una refuzata de server (de exemplu, planul unui santier cu situatii)
 * se spune pe ecran (`laEroare`), iar copia se reia de pe server.
 *
 * Modul se alege la pornire: `/api/eu` raspunde → server; nu exista → browser.
 * `VITE_DATE=server` la build il impune: o aplicatie de productie cu serverul
 * picat nu trebuie sa scrie pe tacute in browser.
 */
import type { Eu, DateComune, CererePeFir, Mutare, RezultatMutare, OfertaSalvata } from "../src/server/contract.js";
import type { PlanSantier, Situatie } from "../src/lucrari/situatii.js";
import type { Miscare } from "../src/stoc/registru.js";
import * as dep from "./depozit-local.js";
import * as luc from "./lucrari-local.js";
import * as of from "./oferte-local.js";
import * as ist from "./istoric.js";
import type { CerereOferta } from "./oferta.js";

export type Mod = "browser" | "server";

let mod: Mod = "browser";
let eu: Eu | null = null;
let copie: DateComune = { planuri: [], depozit: { miscari: [], necesare: [] }, oferte: {} };
/** Cererile al caror fisier e deja pe server: la salvare pleaca doar lucrul omului. */
const cuFisier = new Set<string>();
let coada: Promise<void> = Promise.resolve();
let ascultaEroare: (mesaj: string) => void = (m) => console.error(m);

export const modDate = (): Mod => mod;
export const euCurent = (): Eu | null => eu;
export const laEroare = (f: (mesaj: string) => void): void => { ascultaEroare = f; };

/* ------------------------------------------------------------- reteaua */

export class EroareServer extends Error {
  constructor(public status: number, mesaj: string) { super(mesaj); }
}

async function api<T>(cale: string, metoda = "GET", corp?: unknown): Promise<T> {
  const r = await fetch(cale, {
    method: metoda,
    credentials: "same-origin",
    headers: { "content-type": "application/json", "x-izorep": "1" },
    ...(corp !== undefined ? { body: JSON.stringify(corp) } : {}),
  });
  const text = await r.text();
  let json: unknown = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* nu e JSON: nu e serverul nostru */ }
  if (!r.ok) {
    const mesaj = (json as { eroare?: string } | null)?.eroare ?? `Serverul a răspuns ${r.status}.`;
    throw new EroareServer(r.status, mesaj);
  }
  return json as T;
}

/** O scriere, dupa cele de dinainte. Refuzata → mesaj pe ecran si copia de pe server. */
function trimite(f: () => Promise<unknown>): void {
  coada = coada.then(f).then(() => undefined, async (e: unknown) => {
    ascultaEroare(`Nu s-a salvat pe server: ${e instanceof Error ? e.message : String(e)}`);
    try { copie = await api<DateComune>("/api/date"); } catch { /* ramane copia locala */ }
  });
}

/* ------------------------------------------------------------- pornirea */

/**
 * `browser`: nu exista server (linkul demo). `server`: omul a intrat.
 * `intrare`: exista server, dar omul trebuie sa intre cu link pe email.
 */
export async function porneste(): Promise<"browser" | "server" | "intrare"> {
  const impus = (import.meta as { env?: Record<string, string | undefined> }).env?.["VITE_DATE"];
  if (impus === "browser") return (mod = "browser");
  try {
    eu = await api<Eu>("/api/eu");
    mod = "server";
    await reimprospateaza();
    return "server";
  } catch (e) {
    if (e instanceof EroareServer && e.status === 401) { mod = "server"; return "intrare"; }
    if (impus === "server") throw new Error("Serverul nu răspunde. Încearcă din nou peste câteva minute.");
    return (mod = "browser");
  }
}

/** Copia de pe server, dupa ce au plecat scrierile in curs. Pe browser, nimic. */
export async function reimprospateaza(): Promise<void> {
  if (mod !== "server") return;
  await coada;
  copie = await api<DateComune>("/api/date");
}

export async function cereLink(email: string): Promise<void> {
  await api("/api/intrare", "POST", { email });
}

export async function confirmaLink(token: string): Promise<void> {
  eu = await api<Eu>("/api/intrare/confirma", "POST", { token });
  mod = "server";
  await reimprospateaza();
}

export async function iesi(): Promise<void> {
  await coada;
  await api("/api/iesire", "POST");
  eu = null;
}

/* ------------------------------------------------- santierele (Lucrari) */

const clona = <T>(v: T): T => structuredClone(v);
const fara = (p: PlanSantier): Omit<PlanSantier, "situatii"> => {
  const { situatii: _s, ...rest } = p;
  return rest;
};
const acelasi = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

export const citestePlanuri = (): PlanSantier[] => (mod === "server" ? clona(copie.planuri) : luc.citestePlanuri());

export function scriePlanuri(planuri: PlanSantier[]): boolean {
  if (mod !== "server") return luc.scriePlanuri(planuri);
  const vechi = new Map(copie.planuri.map((p) => [p.id, p]));
  for (const p of planuri) {
    const v = vechi.get(p.id);
    if (!v || !acelasi(fara(v), fara(p))) trimite(() => api(`/api/santiere/${enc(p.id)}`, "PUT", { ...p, situatii: [] }));
    const aveau = new Set((v?.situatii ?? []).map((s) => s.id));
    const au = new Set(p.situatii.map((s) => s.id));
    // Intai cele sterse (de la ultima), apoi cele noi (in ordine).
    for (const s of [...(v?.situatii ?? [])].reverse().filter((s) => !au.has(s.id))) {
      trimite(() => api(`/api/santiere/${enc(p.id)}/situatii/${s.nr}`, "DELETE"));
    }
    for (const s of p.situatii.filter((s: Situatie) => !aveau.has(s.id))) {
      trimite(() => api(`/api/santiere/${enc(p.id)}/situatii`, "POST", s));
    }
  }
  const raman = new Set(planuri.map((p) => p.id));
  for (const p of copie.planuri.filter((x) => !raman.has(x.id))) trimite(() => api(`/api/santiere/${enc(p.id)}`, "DELETE"));
  copie = { ...copie, planuri: clona(planuri) };
  return true;
}

export const deschideLaIntrare = luc.deschideLaIntrare;
export const iaDeDeschis = luc.iaDeDeschis;

/* ------------------------------------------------------------- depozitul */

export const citesteDepozit = (): dep.StareDepozit => (mod === "server" ? clona(copie.depozit) : dep.citesteDepozit());

export function scrieDepozit(s: dep.StareDepozit): boolean {
  if (mod !== "server") return dep.scrieDepozit(s);
  const v = copie.depozit;
  const aveau = new Set(v.miscari.map((m) => m.id));
  // Datele de exemplu nu ajung pe server (ecranul nu le ofera acolo).
  for (const m of s.miscari.filter((x: Miscare) => !aveau.has(x.id) && !x.exemplu)) {
    trimite(() => api("/api/miscari", "POST", m));
  }
  const necVechi = new Map(v.necesare.map((n) => [n.id, n]));
  for (const n of s.necesare) {
    if (!acelasi(necVechi.get(n.id), n)) trimite(() => api(`/api/necesare/${enc(n.id)}`, "PUT", n));
  }
  const raman = new Set(s.necesare.map((n) => n.id));
  for (const n of v.necesare.filter((x) => !raman.has(x.id))) trimite(() => api(`/api/necesare/${enc(n.id)}`, "DELETE"));
  const ambVechi = v.ambalaje ?? {};
  const ambNoi = s.ambalaje ?? {};
  for (const cheie of new Set([...Object.keys(ambVechi), ...Object.keys(ambNoi)])) {
    if (!acelasi(ambVechi[cheie], ambNoi[cheie])) {
      trimite(() => api("/api/ambalaje", "PUT", { cheie, ambalaj: ambNoi[cheie] ?? null }));
    }
  }
  copie = { ...copie, depozit: clona({ ...s, miscari: s.miscari.filter((m) => !m.exemplu) }) };
  return true;
}

export const idNou = dep.idNou;

/* ------------------------------------------------------------- ofertele */

export const citesteOferte = (): Record<string, of.OfertaEmisa> => (mod === "server" ? clona(copie.oferte) : of.citesteOferte());

/**
 * „Descarca oferta”: pe server, o versiune noua a ofertei, cu liniile ei,
 * INAINTE de descarcare — ce pleaca la client e exact ce s-a salvat. Pe
 * browser, doar sumarul, ca pana acum.
 */
export async function salveazaOferta(
  importId: string, firma: string, continut: CerereOferta, rezumat: of.OfertaEmisa,
): Promise<void> {
  if (mod !== "server") { of.noteazaOferta(importId, rezumat); return; }
  await coada;
  const r = await api<OfertaSalvata>(`/api/cereri/${enc(importId)}/oferte`, "POST", { firma, continut });
  copie = { ...copie, oferte: { ...copie.oferte, [importId]: { ...rezumat, valoare: r.valoare } } };
}

/** Pe server, oferta salvata ramane: cererea ei nu se mai sterge. */
export const uitaOferta = (importId: string): void => { if (mod !== "server") of.uitaOferta(importId); };

/* ------------------------------------------- cererile (istoricul importurilor) */

export type { IntrareIstoric, SesiuneImport } from "./istoric.js";
export const idCurent = ist.idCurent;
export const puneCurent = ist.puneCurent;

const enc = encodeURIComponent;

function base64(buf: ArrayBuffer): string {
  const b = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
}

function dinBase64(s: string): ArrayBuffer {
  const bin = atob(s);
  const b = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
  return b.buffer;
}

const peFir = (s: ist.SesiuneImport, cuFis: boolean): CererePeFir => {
  const { fisier, ...rest } = s;
  return cuFis ? { ...rest, fisier: base64(fisier) } : rest;
};

export async function salveaza(s: ist.SesiuneImport): Promise<void> {
  if (mod !== "server") return ist.salveaza(s);
  ist.puneCurent(s.id);
  const trimiteFisier = !cuFisier.has(s.id);
  const corp = peFir(s, trimiteFisier);
  trimite(async () => {
    await api(`/api/cereri/${enc(s.id)}`, "PUT", corp);
    cuFisier.add(s.id);
  });
  await coada;
}

export async function listeaza(): Promise<ist.IntrareIstoric[]> {
  if (mod !== "server") return ist.listeaza();
  await coada;
  try {
    const toate = await api<ist.IntrareIstoric[]>("/api/cereri");
    for (const c of toate) cuFisier.add(c.id);
    return toate;
  } catch (e) {
    ascultaEroare(`Cererile nu s-au putut citi de pe server: ${e instanceof Error ? e.message : String(e)}`);
    return [];
  }
}

export async function incarca(id: string): Promise<ist.SesiuneImport | null> {
  if (mod !== "server") return ist.incarca(id);
  await coada;
  try {
    const c = await api<CererePeFir>(`/api/cereri/${enc(id)}`);
    cuFisier.add(id);
    return { ...c, fisier: dinBase64(c.fisier ?? "") } as ist.SesiuneImport;
  } catch {
    return null;
  }
}

export async function sterge(id: string): Promise<void> {
  if (mod !== "server") return ist.sterge(id);
  await coada;
  try {
    await api(`/api/cereri/${enc(id)}`, "DELETE");
    cuFisier.delete(id);
    if (ist.idCurent() === id) ist.puneCurent(null);
  } catch (e) {
    ascultaEroare(e instanceof Error ? e.message : String(e));
  }
}

/* ------------------------------------------------------- masuratorile */

/** Paginile din carnet, cu poza, cand pleaca spre oferta sau situatie. Pe browser nu se pastreaza. */
export function salveazaMasuratori(scop: "oferta" | "situatie", santierId: string | undefined, pagini: { poza?: string; randuri: unknown }[]): void {
  if (mod !== "server") return;
  for (const p of pagini) {
    trimite(() => api("/api/masuratori", "POST", { scop, ...(santierId ? { santierId } : {}), ...p }));
  }
}

/* ------------------------------------------------- mutarea din browser */

/** Ce a ramas in browserul asta din vremea cand datele stateau aici. */
export async function dateInBrowser(): Promise<Mutare> {
  const meta = await ist.listeaza();
  const cereri: CererePeFir[] = [];
  for (const m of meta) {
    const s = await ist.incarca(m.id);
    if (s) cereri.push(peFir(s, true));
  }
  return { cereri, oferte: of.citesteOferte(), planuri: luc.citestePlanuri(), depozit: dep.citesteDepozit() };
}

export const areDateDeMutat = (d: Mutare): boolean =>
  d.cereri.length > 0 || d.planuri.length > 0 || d.depozit.miscari.some((m) => !m.exemplu) || d.depozit.necesare.length > 0;

/** Muta tot, o data. Browserul nu se goleste: ramane copia, nefolosita. */
export async function mutaDinBrowser(): Promise<RezultatMutare> {
  const d = await dateInBrowser();
  await coada;
  const r = await api<RezultatMutare>("/api/mutare", "POST", d);
  try { localStorage.setItem(CHEIE_MUTAT, new Date().toISOString()); } catch { /* butonul reapare; mutarea nu dubleaza */ }
  await reimprospateaza();
  return r;
}

const CHEIE_MUTAT = "izorep-mutat-pe-server";
export const amMutat = (): boolean => {
  try { return localStorage.getItem(CHEIE_MUTAT) !== null; } catch { return false; }
};
