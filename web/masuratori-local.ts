import type { RandSantier } from "../src/santier/agrega.js";
import type { Destinatie } from "../src/pricing/lists.js";
import type { PaginaSantier, Scop } from "./santier-vizual.js";

/**
 * Măsurătorile în lucru, în browser, până pleacă (R4, 14 octombrie 2026).
 *
 * Pozele din carnet și rândurile verificate pe jumătate se pierdeau la
 * reîncărcarea paginii: starea ecranului stătea doar în memorie. Acum se țin
 * în IndexedDB, ca importul (`web/istoric.ts`), dar într-o bază separată:
 * baza istoricului are magazinele fixate pe versiunea 1, iar una nouă nu
 * atinge importurile nimănui. Pozele intră ca `Blob`, fără base64.
 *
 * Doar lucrul curent, un singur rând: după „Trimite la ofertă”, „Pune în
 * situație” sau „Fă ciornele”, paginile pleacă (pe server se păstrează cu poza
 * lor, `/api/masuratori`) și de aici se șterg.
 *
 * Best-effort, ca tot ce e în browser: fără IndexedDB (fereastră privată,
 * stocare blocată), ecranul merge ca înainte, doar că reîncărcarea pierde lucrul.
 */

const BAZA = "izorep-masuratori";
const LUCRU = "lucru";
const CHEIE = "curent";

export interface PaginaSalvata {
  id: string;
  nume: string;
  poza: Blob;
  stare: PaginaSantier["stare"];
  eroare: string;
  randuri: RandSantier[];
  note: string[];
  verificata: boolean;
  faraModel: boolean;
}

export interface LucruSalvat {
  scop: Scop;
  destinatie: Destinatie;
  planAles: string;
  titlu: string;
  pagini: PaginaSalvata[];
}

/**
 * Pagina refăcută după reîncărcare. O citire pornită înainte n-are cum să se
 * mai termine (cererea a murit cu pagina): pagina trece la „nu s-a putut
 * citi”, cu „Citește din nou” și „Scriu de mână”, nu rămâne „Se citește…” la
 * nesfârșit.
 */
export function paginaRefacuta(p: PaginaSalvata, url: string): PaginaSantier {
  const intrerupta = p.stare === "citeste";
  return {
    id: p.id, nume: p.nume, url, randuri: p.randuri, note: p.note, verificata: p.verificata, faraModel: p.faraModel,
    stare: intrerupta ? "eroare" : p.stare,
    eroare: intrerupta ? "Citirea s-a oprit când s-a reîncărcat pagina." : p.eroare,
  };
}

function deschide(): Promise<IDBDatabase> {
  return new Promise((rezolva, respinge) => {
    const c = indexedDB.open(BAZA, 1);
    c.onupgradeneeded = () => {
      if (!c.result.objectStoreNames.contains(LUCRU)) c.result.createObjectStore(LUCRU);
    };
    c.onsuccess = () => rezolva(c.result);
    c.onerror = () => respinge(c.error ?? new Error("IndexedDB indisponibil"));
  });
}

async function cuMagazin<T>(mod: IDBTransactionMode, f: (m: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await deschide();
  try {
    return await new Promise<T>((rezolva, respinge) => {
      const t = db.transaction(LUCRU, mod);
      const r = f(t.objectStore(LUCRU));
      t.oncomplete = () => rezolva(r.result);
      t.onerror = () => respinge(t.error ?? new Error("tranzacție IndexedDB eșuată"));
    });
  } finally {
    db.close();
  }
}

/** `cheie`: „curent” pe pagina Măsurători, „oferta” la Cerere nouă › Poze (22 octombrie 2026). */
export async function citesteLucru(cheie = CHEIE): Promise<LucruSalvat | null> {
  try {
    return (await cuMagazin("readonly", (m) => m.get(cheie) as IDBRequest<LucruSalvat | undefined>)) ?? null;
  } catch {
    return null;
  }
}

export async function scrieLucru(l: LucruSalvat, cheie = CHEIE): Promise<void> {
  try {
    if (l.pagini.length === 0) await cuMagazin("readwrite", (m) => m.delete(cheie));
    else await cuMagazin("readwrite", (m) => m.put(l, cheie));
  } catch {
    // Cotă depășită sau stocare blocată: lucrul rămâne pe ecran, doar nu supraviețuiește reîncărcării.
  }
}
