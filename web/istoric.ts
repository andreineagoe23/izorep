import type { PozitieAdaugata } from "../src/import/adaugate.js";
import type { LinieExtrasa, Sursa } from "../src/import/schema.js";
import type { Destinatie } from "../src/pricing/lists.js";

/**
 * Istoricul importurilor si importul curent, in IndexedDB.
 *
 * De ce nu `localStorage`: acolo intra ~5 MB de TEXT, iar un registru de la
 * client are sute de kB binari. IndexedDB tine `ArrayBuffer` direct, fara
 * base64 si fara sa consume cota celuilalt depozit.
 *
 * Ce se salveaza: **fisierul**, plus ce a iesit din extragere si ce a corectat
 * omul. Nu grila: aceeasi parsare pe acelasi fisier da aceleasi randuri, deci
 * grila se reface la deschidere. Asa reincarcarea paginii nu pierde nimic, iar
 * redeschiderea unui import vechi nu cheama modelul din nou — deci nu costa
 * tokeni si nu poate da alt rezultat decat cel pe care l-a validat omul.
 *
 * Totul e best-effort: in fereastra privata sau cu stocarea blocata, fiecare
 * apel de aici esueaza tacut si ecranul se poarta ca inainte. Istoricul e o
 * comoditate, nu o garantie — documentele adevarate stau in baza, nu aici.
 */

const BAZA = "izorep";
const VERSIUNE = 1;
const SESIUNI = "sesiuni";
const META = "meta";
/** Cate importuri se tin. Peste atat, cel mai vechi cade. */
const MAX_ISTORIC = 10;
const CHEIE_CURENT = "izorep-import-curent";

export interface IntrareIstoric {
  id: string;
  nume: string;
  marime: number;
  cand: string;
  /** Modelul care a lucrat, sau null cand a rulat doar stratul determinist. */
  model: string | null;
  pozitii: number;
  tarifate: number;
  valoare: number;
  /**
   * Segmentul pe care a fost tarifat importul. Lipseste la sesiunile salvate
   * inainte sa existe, care au fost toate rezidentiale. Fara el, un import
   * lucrat pe industrial se redeschidea pe rezidential, cu alte preturi si cu
   * butonul aratand altceva decat ce vazuse omul.
   */
  destinatie?: Destinatie;
}

/** O corectie facuta de om intr-o celula a fisierului. */
export interface EditareCelula {
  foaie: string;
  rand: number;
  cel: number;
  v: string | number | null;
}

export interface SesiuneImport extends IntrareIstoric {
  fisier: ArrayBuffer;
  /** `text` lipseste la sesiunile salvate inainte sa existe: nucleul il ia pe cel de acum. */
  extrase: { index: number; extras: LinieExtrasa; sursa: Sursa; text?: string }[];
  editari: EditareCelula[];
  /** Grosimile uzuale cerute de om, `[index, mm]`. Vezi `OptiuniNucleu.grosimiPropuse`. */
  grosimiPropuse?: [number, number][];
  /** Vezi `OptiuniNucleu.descrieriSchimbate`. */
  descrieriSchimbate?: number[];
  /** Preturile unitare puse de om, `[index, EUR]`. Vezi `OptiuniNucleu.preturiManuale`. */
  preturiManuale?: [number, number][];
  /** Pozitiile adaugate de mana in oferta. Vezi `src/import/adaugate.ts`. */
  adaugate?: PozitieAdaugata[];
  /** Registrul facut de aplicatie, nu primit de la client. Vezi `OrigineImport`. */
  origine?: OrigineImport;
}

/**
 * De unde vine registrul, cand nu e fisierul clientului: paginile din carnet
 * (Masuratori) sau lista de tevi cu izolatia aleasa pe foaie. Ecranul spune
 * asta in locul numelui fisierului facut de aplicatie.
 */
export type OrigineImport =
  | { tip: "masuratori"; pagini: number }
  | { tip: "izolatie_foaie"; fisier: string };

/**
 * Ce iese din istoric cand se depaseste plafonul: cele mai vechi.
 *
 * Functie pura si exportata ca sa poata fi testata — restul modulului cere
 * IndexedDB, care nu exista in Node. Sortarea e pe `cand`, un ISO, deci
 * comparatia de siruri e si comparatie de timp.
 */
export const idsDeSters = (toate: IntrareIstoric[], max = MAX_ISTORIC): string[] =>
  [...toate]
    .sort((a, b) => b.cand.localeCompare(a.cand))
    .slice(max)
    .map((x) => x.id);

function deschide(): Promise<IDBDatabase> {
  return new Promise((rezolva, respinge) => {
    const c = indexedDB.open(BAZA, VERSIUNE);
    c.onupgradeneeded = () => {
      const db = c.result;
      if (!db.objectStoreNames.contains(SESIUNI)) db.createObjectStore(SESIUNI, { keyPath: "id" });
      if (!db.objectStoreNames.contains(META)) db.createObjectStore(META, { keyPath: "id" });
    };
    c.onsuccess = () => rezolva(c.result);
    c.onerror = () => respinge(c.error ?? new Error("IndexedDB indisponibil"));
  });
}

const cuMagazin = async <T>(
  magazine: string[], mod: IDBTransactionMode, f: (t: IDBTransaction) => Promise<T> | T,
): Promise<T> => {
  const db = await deschide();
  try {
    return await f(db.transaction(magazine, mod));
  } finally {
    db.close();
  }
};

const cerere = <T>(r: IDBRequest<T>): Promise<T> =>
  new Promise((rezolva, respinge) => {
    r.onsuccess = () => rezolva(r.result);
    r.onerror = () => respinge(r.error ?? new Error("cerere IndexedDB esuata"));
  });

const metaDin = (s: SesiuneImport): IntrareIstoric => ({
  id: s.id, nume: s.nume, marime: s.marime, cand: s.cand,
  model: s.model, pozitii: s.pozitii, tarifate: s.tarifate, valoare: s.valoare,
  ...(s.destinatie ? { destinatie: s.destinatie } : {}),
});

/** Id-ul importului deschis acum, ca reincarcarea paginii sa il regaseasca. */
export const idCurent = (): string | null => {
  try {
    return localStorage.getItem(CHEIE_CURENT);
  } catch {
    return null;
  }
};

export const puneCurent = (id: string | null): void => {
  try {
    if (id === null) localStorage.removeItem(CHEIE_CURENT);
    else localStorage.setItem(CHEIE_CURENT, id);
  } catch {
    // Fara pointer, importul nu se restaureaza. Nimic altceva nu se strica.
  }
};

export async function salveaza(s: SesiuneImport): Promise<void> {
  try {
    await cuMagazin([SESIUNI, META], "readwrite", async (t) => {
      t.objectStore(SESIUNI).put(s);
      t.objectStore(META).put(metaDin(s));
      // Taierea se face in aceeasi tranzactie: altfel o inchidere de tab intre
      // scriere si curatare ar lasa istoricul sa creasca la nesfarsit.
      const toate = await cerere(t.objectStore(META).getAll() as IDBRequest<IntrareIstoric[]>);
      for (const id of idsDeSters(toate)) {
        t.objectStore(SESIUNI).delete(id);
        t.objectStore(META).delete(id);
      }
    });
    puneCurent(s.id);
  } catch {
    // Cota depasita sau stocare blocata: importul curent ramane pe ecran.
  }
}

export async function listeaza(): Promise<IntrareIstoric[]> {
  try {
    const toate = await cuMagazin([META], "readonly", (t) =>
      cerere(t.objectStore(META).getAll() as IDBRequest<IntrareIstoric[]>));
    return toate.sort((a, b) => b.cand.localeCompare(a.cand));
  } catch {
    return [];
  }
}

export async function incarca(id: string): Promise<SesiuneImport | null> {
  try {
    const s = await cuMagazin([SESIUNI], "readonly", (t) =>
      cerere(t.objectStore(SESIUNI).get(id) as IDBRequest<SesiuneImport | undefined>));
    return s ?? null;
  } catch {
    return null;
  }
}

export async function sterge(id: string): Promise<void> {
  try {
    await cuMagazin([SESIUNI, META], "readwrite", (t) => {
      t.objectStore(SESIUNI).delete(id);
      t.objectStore(META).delete(id);
    });
  } catch {
    // Nimic de facut: randul ramane in lista pana la urmatoarea deschidere.
  }
  if (idCurent() === id) puneCurent(null);
}
