/**
 * Ce circula intre browser si server. Formele sunt cele pe care le tinea
 * browserul (`web/*-local.ts`, `web/istoric.ts`): ecranele nu se schimba, se
 * schimba doar unde ajung datele. Fisierul clientului si pozele merg ca base64.
 */
import type { SesiuneImport } from "../../web/istoric.js";
import type { OfertaEmisa } from "../../web/oferte-local.js";
import type { StareDepozit } from "../../web/depozit-local.js";
import type { CerereOferta } from "../../web/oferta.js";
import type { PlanSantier } from "../lucrari/situatii.js";

export interface Eu {
  nume: string;
  email: string;
  /** birou | contabilitate — rolurile provizorii, ambele cu acces la tot. */
  rol: string;
}

/** Tot ce citesc ecranele sincron; se ia la fiecare schimbare de ecran. */
export interface DateComune {
  planuri: PlanSantier[];
  depozit: StareDepozit;
  /** Ultima versiune salvata a ofertei, pe id-ul cererii. */
  oferte: Record<string, OfertaEmisa>;
}

/** Cererea (importul) ca pe fir: fisierul in base64, doar la prima salvare. */
export type CererePeFir = Omit<SesiuneImport, "fisier"> & { fisier?: string };

export interface OfertaDeSalvat {
  /** Codul firmei emitente: `radoia` | `isorad`. */
  firma: string;
  continut: CerereOferta;
}

export interface OfertaSalvata {
  versiune: number;
  valoare: number;
}

export interface MasuratoareDeSalvat {
  scop: "oferta" | "situatie";
  santierId?: string;
  /** Poza ca data URL (`data:image/jpeg;base64,...`). */
  poza?: string;
  randuri: unknown;
}

/** Ce muta butonul „Muta datele din acest browser”, o singura data. */
export interface Mutare {
  cereri: CererePeFir[];
  oferte: Record<string, OfertaEmisa>;
  planuri: PlanSantier[];
  depozit: StareDepozit;
}

/** Cate inregistrari au intrat; ce exista deja pe server nu se numara. */
export interface RezultatMutare {
  cereri: number;
  oferte: number;
  santiere: number;
  situatii: number;
  miscari: number;
  necesare: number;
  ambalaje: number;
  /** Ofertele a caror cerere nu mai era in browser (istoricul tine 10). */
  oferteFaraCerere: number;
}
