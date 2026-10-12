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
 * se spune pe ecran (`laEroare`), iar copia se reia de pe server si ecranul se
 * deseneaza din nou (`laReimprospatare`). Pana atunci scrierile se opresc:
 * ecranul tine inca lista veche, iar ce lipseste din ea fata de copia noua
 * (situatia scrisa de un coleg) ar pleca la server ca stergere.
 *
 * Modul se alege la pornire: `/api/stare` raspunde → server; nu exista → browser.
 * `VITE_DATE=server` la build il impune: o aplicatie de productie cu serverul
 * picat nu trebuie sa scrie pe tacute in browser.
 */
import type { Stare, DateComune, CererePeFir, Mutare, RezultatMutare, OfertaSalvata } from "../src/server/contract.js";
import type { PlanSantier, Situatie } from "../src/lucrari/situatii.js";
import type { Miscare } from "../src/stoc/registru.js";
import {
  inlocuiesteCuFactura, intrariDinReceptie, returLaFurnizor, valideazaReceptie, valideazaRetur,
  type Comanda, type DocumentAtasat, type Factura, type Receptie, type Retur,
} from "../src/stoc/comenzi.js";
import { anuleazaConsumSituatie, consumDinSituatie } from "../src/stoc/consum.js";
import {
  ajustariInventar, intrareDePornire, valideazaInventar, type Inventar, type Pornire,
} from "../src/stoc/inventar.js";
import * as dep from "./depozit-local.js";
import * as luc from "./lucrari-local.js";
import * as of from "./oferte-local.js";
import * as ist from "./istoric.js";
import type { CerereOferta } from "./oferta.js";

export type Mod = "browser" | "server";

let mod: Mod = "browser";
let stare: Stare | null = null;
let copie: DateComune = { planuri: [], depozit: { miscari: [], necesare: [] }, oferte: {} };
/** Cererile al caror fisier e deja pe server: la salvare pleaca doar lucrul omului. */
const cuFisier = new Set<string>();
let coada: Promise<void> = Promise.resolve();
let ascultaEroare: (mesaj: string) => void = (m) => console.error(m);
let ascultaReimprospatare: () => void = () => undefined;
/** Copia s-a luat din nou dupa un refuz, iar ecranul inca n-a citit-o. */
let invechit = false;

export const modDate = (): Mod => mod;
/** Firma servita, cand datele stau pe server. */
export const firmaServita = (): string | null => stare?.firma ?? null;
export const laEroare = (f: (mesaj: string) => void): void => { ascultaEroare = f; };
export const laReimprospatare = (f: () => void): void => { ascultaReimprospatare = f; };

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
    try {
      copie = await api<DateComune>("/api/date");
      invechit = true;
      ascultaReimprospatare();
    } catch { /* ramane copia locala */ }
  });
}

/* ------------------------------------------------------------- pornirea */

/** `browser`: nu exista server (linkul demo). `server`: datele stau pe server. */
export async function porneste(): Promise<Mod> {
  const impus = (import.meta as { env?: Record<string, string | undefined> }).env?.["VITE_DATE"];
  if (impus === "browser") return (mod = "browser");
  try {
    stare = await api<Stare>("/api/stare");
    mod = "server";
    await reimprospateaza();
    return "server";
  } catch {
    if (impus === "server") throw new Error("Serverul nu răspunde. Încearcă din nou peste câteva minute.");
    return (mod = "browser");
  }
}

/** Copia de pe server, dupa ce au plecat scrierile in curs. Pe browser, nimic. */
export async function reimprospateaza(): Promise<void> {
  if (mod !== "server") return;
  await coada;
  copie = await api<DateComune>("/api/date");
  invechit = false;
}

/** Ecranul scrie dintr-o lista luata inainte de un refuz: nu pleaca nimic. */
function refuzaInvechit(): boolean {
  if (invechit) ascultaEroare("Pagina s-a reîncărcat cu datele de pe server: fă din nou ultima modificare.");
  return invechit;
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
  if (refuzaInvechit()) return true;
  const vechi = new Map(copie.planuri.map((p) => [p.id, p]));
  for (const p of planuri) {
    const v = vechi.get(p.id);
    if (!v || !acelasi(fara(v), fara(p))) trimite(() => api(`/api/santiere/${enc(p.id)}`, "PUT", { ...p, situatii: [] }));
    const aveau = new Set((v?.situatii ?? []).map((s) => s.id));
    const au = new Set(p.situatii.map((s) => s.id));
    // Intai cele sterse (de la ultima), apoi cele noi (in ordine).
    for (const s of [...(v?.situatii ?? [])].reverse().filter((s) => !au.has(s.id))) {
      trimite(() => api(`/api/santiere/${enc(p.id)}/situatii/${s.nr}?id=${enc(s.id)}`, "DELETE"));
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

/*
 * Faza 6: situatia salvata scrie si consumul de material (`consumDinSituatie`),
 * iar stearsa il anuleaza cu storno. Operatii proprii, nu diferenta de stare:
 * pe server situatia si consumul intra in aceeasi tranzactie, calculat acolo
 * din baza, cu aceleasi id-uri ca aici (facute din situatie); pe linkul demo,
 * aici, in browser. Intoarce cate miscari de consum s-au scris, sau motivul
 * refuzului.
 */
export function salveazaSituatie(planId: string, s: Situatie): { consum: number } | { eroare: string } {
  if (mod === "server" && refuzaInvechit()) return { consum: 0 };
  const planuri = citestePlanuri();
  const p = planuri.find((x) => x.id === planId);
  if (!p) return { eroare: "Șantierul nu mai există." };
  const plan = { ...p, situatii: [...p.situatii, s] };
  const st = citesteDepozit();
  const necesar = st.necesare.find((n) => n.santier === planId);
  const consum = necesar ? consumDinSituatie(plan, necesar.materiale, st.miscari, s) : [];
  const toate = planuri.map((x) => (x.id === planId ? plan : x));
  if (mod === "server") {
    copie = { ...copie, planuri: clona(toate), depozit: { ...copie.depozit, miscari: [...copie.depozit.miscari, ...consum] } };
    trimite(() => api(`/api/santiere/${enc(planId)}/situatii`, "POST", s));
    return { consum: consum.length };
  }
  if (!luc.scriePlanuri(toate)) return { eroare: "Browserul nu permite salvarea: situația se pierde la reîncărcare." };
  dep.scrieDepozit({ ...dep.citesteDepozit(), miscari: [...st.miscari, ...consum] });
  return { consum: consum.length };
}

/** Scoate ultima situatie a santierului si anuleaza consumul ei. */
export function stergeUltimaSituatie(planId: string): string | null {
  if (mod === "server" && refuzaInvechit()) return null;
  const planuri = citestePlanuri();
  const p = planuri.find((x) => x.id === planId);
  const s = p?.situatii.at(-1);
  if (!p || !s) return null;
  const toate = planuri.map((x) => (x.id === planId ? { ...p, situatii: p.situatii.slice(0, -1) } : x));
  const st = citesteDepozit();
  const anulari = anuleazaConsumSituatie(s, st.miscari, new Date().toISOString());
  if (mod === "server") {
    copie = { ...copie, planuri: clona(toate), depozit: { ...copie.depozit, miscari: [...copie.depozit.miscari, ...anulari] } };
    trimite(() => api(`/api/santiere/${enc(planId)}/situatii/${s.nr}?id=${enc(s.id)}`, "DELETE"));
    return null;
  }
  if (!luc.scriePlanuri(toate)) return "Browserul nu permite salvarea: modificarea se pierde la reîncărcare.";
  dep.scrieDepozit({ ...dep.citesteDepozit(), miscari: [...st.miscari, ...anulari] });
  return null;
}

export const deschideLaIntrare = luc.deschideLaIntrare;
export const iaDeDeschis = luc.iaDeDeschis;

/* ------------------------------------------------------------- depozitul */

export const citesteDepozit = (): dep.StareDepozit => (mod === "server" ? clona(copie.depozit) : dep.citesteDepozit());

export function scrieDepozit(s: dep.StareDepozit): boolean {
  // Comenzile se schimba doar prin operatiile lor (mai jos), nu din lista ecranului.
  if (mod !== "server") return dep.scrieDepozit({ ...s, comenzi: dep.citesteDepozit().comenzi ?? [] });
  if (refuzaInvechit()) return true;
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
  const respVechi = v.responsabili ?? {};
  const respNoi = s.responsabili ?? {};
  for (const id of new Set([...Object.keys(respVechi), ...Object.keys(respNoi)])) {
    if ((respVechi[id] ?? "") !== (respNoi[id] ?? "")) {
      trimite(() => api(`/api/depozite/${enc(id)}`, "PUT", { responsabil: respNoi[id] ?? "" }));
    }
  }
  // Comenzile au operatiile lor (mai jos): o lista veche din ecran nu le rescrie.
  copie = { ...copie, depozit: clona({
    ...s, miscari: s.miscari.filter((m) => !m.exemplu), comenzi: copie.depozit.comenzi ?? [],
    ...(copie.depozit.documente ? { documente: copie.depozit.documente } : {}),
  }) };
  return true;
}

/* ------------------------------------------------------------- comenzile */

/*
 * Faza 4: comenzile au operatii proprii — scrie ciorna, trimite, anuleaza,
 * receptioneaza, trece factura —, nu diferenta de stare de la `scrieDepozit`
 * (de acolo venise bugul cu situatiile, 10 octombrie 2026). Fiecare operatie
 * schimba copia pe loc, ca ecranul sa se redeseneze imediat, si pleaca la
 * server in coada; refuzata, copia se reia de pe server.
 *
 * Intrarile receptiei au id-urile facute aici: serverul le recalculeaza din
 * comanda lui cu aceleasi id-uri, deci o receptie trimisa de doua ori nu se
 * dubleaza, iar copia si baza au aceleasi miscari.
 */

/** Starea depozitului cu o schimbare, oriunde ar sta datele. */
function schimbaDepozit(f: (s: dep.StareDepozit) => dep.StareDepozit): void {
  if (mod === "server") copie = { ...copie, depozit: f(clona(copie.depozit)) };
  else dep.scrieDepozit(f(dep.citesteDepozit()));
}

const comenziDin = (s: dep.StareDepozit): Comanda[] => s.comenzi ?? [];
const cuComanda = (s: dep.StareDepozit, c: Comanda): dep.StareDepozit =>
  ({ ...s, comenzi: [c, ...comenziDin(s).filter((x) => x.id !== c.id)] });
const gasita = (id: string): Comanda | undefined => comenziDin(citesteDepozit()).find((c) => c.id === id);

/** Ciorna noua sau schimbata. Trimisa nu se mai schimba (o spune si serverul). */
export function puneComanda(c: Comanda): string | null {
  const v = gasita(c.id);
  if (v?.trimisa || v?.anulata) return "Comanda a fost trimisă: nu se mai modifică.";
  schimbaDepozit((s) => cuComanda(s, c));
  if (mod === "server") trimite(() => api(`/api/comenzi/${enc(c.id)}`, "PUT", c));
  return null;
}

export function stergeComanda(id: string): string | null {
  if (gasita(id)?.trimisa) return "Comanda a fost trimisă: nu se șterge, se anulează.";
  schimbaDepozit((s) => ({ ...s, comenzi: comenziDin(s).filter((c) => c.id !== id) }));
  if (mod === "server") trimite(() => api(`/api/comenzi/${enc(id)}`, "DELETE"));
  return null;
}

export function trimiteComanda(id: string, cand = new Date().toISOString()): void {
  const c = gasita(id);
  if (!c || c.trimisa || c.anulata) return;
  schimbaDepozit((s) => cuComanda(s, { ...c, trimisa: cand }));
  if (mod === "server") trimite(() => api(`/api/comenzi/${enc(id)}/trimite`, "POST", { cand }));
}

export function anuleazaComanda(id: string, cand = new Date().toISOString()): void {
  const c = gasita(id);
  if (!c || c.anulata) return;
  schimbaDepozit((s) => cuComanda(s, { ...c, anulata: cand }));
  if (mod === "server") trimite(() => api(`/api/comenzi/${enc(id)}/anuleaza`, "POST", { cand }));
}

/** Receptia pe liniile comenzii. Intoarce motivul refuzului, sau null. */
export function receptioneaza(id: string, r: Omit<Receptie, "comanda">): string | null {
  const c = gasita(id);
  if (!c) return "Comanda nu mai există.";
  const gresit = valideazaReceptie({ ...r, comanda: c });
  if (gresit) return gresit;
  const data = new Date().toISOString();
  const intrari = intrariDinReceptie({ ...r, comanda: c }, idNou, data);
  schimbaDepozit((s) => ({ ...s, miscari: [...s.miscari, ...intrari] }));
  if (mod === "server") {
    const ids = intrari.map((m) => m.id);
    trimite(() => api(`/api/comenzi/${enc(id)}/receptii`, "POST", { ...r, ids, data }));
  }
  return null;
}

/** Factura venita dupa aviz: inlocuieste intrarile avizului (storno + intrari cu pret). */
export function treceFactura(id: string, aviz: string, f: Factura): string | null {
  const c = gasita(id);
  if (!c) return "Comanda nu mai există.";
  if (!f.document.numar.trim()) return "Scrie numărul facturii.";
  if (Object.values(f.preturi).some((p) => p.moneda === "RON") && !(f.curs && f.curs > 0)) {
    return "Prețul e în lei: scrie cursul de pe factură.";
  }
  const data = new Date().toISOString();
  const noi = inlocuiesteCuFactura(c, citesteDepozit().miscari, aviz, f, idNou, data);
  if (noi.length === 0) return `Avizul ${aviz} nu are intrări pe comanda asta.`;
  schimbaDepozit((s) => ({ ...s, miscari: [...s.miscari, ...noi] }));
  if (mod === "server") {
    const ids = noi.map((m) => m.id);
    trimite(() => api(`/api/comenzi/${enc(id)}/facturi`, "POST", { aviz, factura: f, ids, data }));
  }
  return null;
}

/** Returul la furnizor, pe o linie a comenzii (S32). */
export function returneaza(id: string, r: Omit<Retur, "comanda">): string | null {
  const c = gasita(id);
  if (!c) return "Comanda nu mai există.";
  const miscari = citesteDepozit().miscari;
  const gresit = valideazaRetur({ ...r, comanda: c }, miscari);
  if (gresit) return gresit;
  const data = new Date().toISOString();
  const m = returLaFurnizor({ ...r, comanda: c }, miscari, idNou, data);
  schimbaDepozit((s) => ({ ...s, miscari: [...s.miscari, m] }));
  if (mod === "server") trimite(() => api(`/api/comenzi/${enc(id)}/retururi`, "POST", { ...r, id: m.id, data }));
  return null;
}

/* -------------------------------------- pornirea si inventarul (Faza 8) */

/**
 * Stocul de pornire: materialul care era deja in central sau in atelier, ca
 * intrare marcata. Pe server, aceeasi intrare se socoteste din nou din baza
 * (pretul din ultima cumparare), cu id-ul de aici. Intoarce motivul refuzului.
 */
export function treceStocDePornire(p: Pornire): string | null {
  const id = idNou();
  const data = new Date().toISOString();
  let m: Miscare;
  try { m = intrareDePornire(p, citesteDepozit().miscari, id, data); } catch (e) { return (e as Error).message; }
  schimbaDepozit((s) => ({ ...s, miscari: [...s.miscari, m] }));
  if (mod === "server") {
    const { depozit, ...rest } = p;
    trimite(() => api(`/api/depozite/${enc(depozit)}/pornire`, "POST", { ...rest, id, data }));
  }
  return null;
}

/**
 * Inventarul unui loc (S45): ajustarile care aduc fiecare material numarat la
 * cifra numarata, cu motivul ales. Ce nu s-a numarat nu se atinge. Pe server
 * se socotesc din nou fata de soldul din baza, cu id-urile de aici (cate unul
 * pe linie), deci retrimis nu se dubleaza.
 */
export function inregistreazaInventar(inv: Inventar): { ajustari: Miscare[] } | string {
  const gresit = valideazaInventar(inv);
  if (gresit) return gresit;
  const ids = inv.numarat.map(() => idNou());
  const data = new Date().toISOString();
  const ajustari = ajustariInventar(citesteDepozit().miscari, inv, (i) => ids[i]!, data);
  schimbaDepozit((s) => ({ ...s, miscari: [...s.miscari, ...ajustari] }));
  if (mod === "server") {
    const { depozit, ...rest } = inv;
    trimite(() => api(`/api/depozite/${enc(depozit)}/inventar`, "POST", { ...rest, ids, data }));
  }
  return { ajustari };
}

/**
 * Poza sau PDF-ul avizului, atasat comenzii (S31). Doar pe server: pe linkul
 * demo fisierul nu are unde sta. Intoarce false cand nu se pastreaza.
 */
export function ataseazaDocument(d: DocumentAtasat & { fisier: string }): boolean {
  if (mod !== "server") return false;
  const { fisier, ...fara } = d;
  schimbaDepozit((s) => ({ ...s, documente: [...(s.documente ?? []).filter((x) => x.id !== d.id), fara] }));
  trimite(() => api(`/api/comenzi/${enc(d.comanda)}/documente`, "POST", { id: d.id, tip: d.tip, numar: d.numar, nume: d.nume, fisier }));
  return true;
}

/** Linkul de deschis documentul atasat (se deschide in alta fila). */
export const linkDocument = (id: string): string => `${location.pathname.replace(/[^/]*$/, "")}api/documente/${enc(id)}`;

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
export function salveazaMasuratori(scop: "oferta" | "situatie" | "comanda", santierId: string | undefined, pagini: { poza?: string; randuri: unknown }[]): void {
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
