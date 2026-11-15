/**
 * Lucrarea (planul UX, Faza 2, 14 noiembrie 2026): o cerere de la client plus,
 * când există, oferta salvată din ea și șantierul făcut din ofertă. Înainte
 * stăteau în cinci locuri din meniu și omul trebuia să știe singur ce urmează.
 *
 * Aici, fără DOM: cum se leagă cele trei, în ce stadiu e lucrarea și ce
 * urmează (o propoziție și un buton). Aceeași funcție scrie rândul „Urmează”
 * de pe pagina lucrării și ce urmează din lista „Lucrări”, deci nu pot spune
 * lucruri diferite.
 */
import type { IntrareIstoric } from "./istoric.js";
import type { OfertaEmisa } from "./oferte-local.js";
import type { PlanSantier } from "../src/lucrari/situatii.js";

export interface Lucrare {
  /** Id-ul cererii; fără cerere (șantierele vechi), id-ul șantierului. */
  id: string;
  cerere?: IntrareIstoric;
  oferta?: OfertaEmisa;
  plan?: PlanSantier;
}

/**
 * Cererile, ofertele și șantierele, legate în lucrări. Șantierul e al cererii
 * după `plan.cerere`; planurile de dinainte de 9 octombrie 2026 n-au legătura și
 * se leagă după numele fișierului, de cea mai nouă cerere cu acel nume (ca
 * `creeazaSantier` din import). Un șantier fără cerere e o lucrare singur.
 */
export function lucrariDin(
  cereri: readonly IntrareIstoric[], oferte: Readonly<Record<string, OfertaEmisa>>, planuri: readonly PlanSantier[],
): Lucrare[] {
  const folosite = new Set<string>();
  const noi = [...cereri].sort((a, b) => b.cand.localeCompare(a.cand));
  const dinCereri: Lucrare[] = noi.map((c) => {
    const plan = planuri.find((p) => !folosite.has(p.id) && p.cerere === c.id)
      ?? planuri.find((p) => !folosite.has(p.id) && p.cerere === undefined && p.fisier === c.nume);
    if (plan) folosite.add(plan.id);
    const o = oferte[c.id];
    return { id: c.id, cerere: c, ...(o ? { oferta: o } : {}), ...(plan ? { plan } : {}) };
  });
  const singure: Lucrare[] = planuri.filter((p) => !folosite.has(p.id)).map((p) => ({ id: p.id, plan: p }));
  return [...dinCereri, ...singure];
}

/** Lucrarea cu id-ul dat: al cererii, sau al șantierului (adresele vechi `#/lucrari/<santier>`). */
export function gasesteLucrarea(toate: readonly Lucrare[], id: string): Lucrare | undefined {
  return toate.find((l) => l.id === id) ?? toate.find((l) => l.plan?.id === id);
}

/** Numele lucrării: obiectivul; altfel clientul; altfel fișierul. */
export function titluLucrare(l: Lucrare): string {
  return l.oferta?.obiectiv || l.plan?.denumire || l.cerere?.antet?.obiectiv
    || l.oferta?.client || l.plan?.client || l.cerere?.antet?.client
    || l.cerere?.nume || l.plan?.fisier || l.id;
}

export const clientLucrare = (l: Lucrare): string => l.oferta?.client || l.plan?.client || l.cerere?.antet?.client || "";

/** Ziua refuzului, ISO; doar pe lucrările fără șantier. */
export const refuzata = (l: Lucrare): string | undefined => (l.plan ? undefined : l.cerere?.antet?.refuzat || undefined);

export type Stadiu = "de-ofertat" | "trimise" | "in-lucru" | "inchise";

export const STADII: { id: Stadiu; eticheta: string }[] = [
  { id: "de-ofertat", eticheta: "De ofertat" },
  { id: "trimise", eticheta: "Oferte trimise" },
  { id: "in-lucru", eticheta: "În lucru" },
  { id: "inchise", eticheta: "Închise" },
];

export function stadiu(l: Lucrare): Stadiu {
  if (l.plan) return l.plan.inchis ? "inchise" : "in-lucru";
  if (refuzata(l)) return "inchise";
  return l.oferta ? "trimise" : "de-ofertat";
}

/** Câte poziții cer ochi: socotit la salvare; la cererile de dinainte, cele fără preț. */
export const deVerificatCerere = (c: IntrareIstoric): number => c.deVerificat ?? Math.max(0, c.pozitii - c.tarifate);

/* ------------------------------------------------------------- urmează */

export type FilaLucrare = "cerere" | "oferta" | "materiale" | "situatii" | "inchidere";

export const FILE_LUCRARE: { id: FilaLucrare; eticheta: string }[] = [
  { id: "cerere", eticheta: "Cerere" },
  { id: "oferta", eticheta: "Ofertă" },
  { id: "materiale", eticheta: "Materiale" },
  { id: "situatii", eticheta: "Situații" },
  { id: "inchidere", eticheta: "Închidere" },
];

/** Ce știe pagina despre lucrare, cât trebuie ca să spună ce urmează. */
export interface StareLucrare {
  /** Pozițiile de verificat și cele fără preț, din cerere. */
  deVerificat: number;
  areCerere: boolean;
  oferta?: { numar: string; data: string } | undefined;
  /** ISO. */
  refuzat?: string | undefined;
  santier?: {
    /** ISO, când s-a închis. */
    inchis?: string | undefined;
    /** Câte materiale mai sunt de comandat. */
    deComandat: number;
    /**
     * Câte materiale nu sunt încă toate pe șantier (lipsesc, sunt în ciornă sau
     * comandate și nevenite). Fără el, se socotește `deComandat`.
     */
    neadus?: number | undefined;
    /** Cât s-a executat, în procente din ofertă. */
    progres: number;
  } | undefined;
}

/** Ce face butonul: duce pe o filă, sau face ceva pe loc (pagina știe ce). */
export type ActUrmeaza = "fila" | "situatie-noua" | "accepta" | "refuza" | "accepta-tarziu";

export interface ButonUrmeaza { eticheta: string; act: ActUrmeaza; fila?: FilaLucrare }

export interface Urmeaza {
  text: string;
  /** Butonul albastru al pasului de acum. */
  primar?: ButonUrmeaza;
  /** Un al doilea drum, alb. */
  alb?: ButonUrmeaza;
  /** Fila pe care se deschide pagina. */
  fila: FilaLucrare;
}

/** „27.05.2026”, din ISO. */
export const ziRo = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("ro-RO", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Bucharest" });
};

const pozitiiText = (n: number): string => (n === 1 ? "O poziție cere" : `${n}${n % 100 >= 20 || (n > 0 && n % 100 === 0) ? " de" : ""} poziții cer`);
const materialeText = (n: number): string => (n === 1 ? "Un material" : `${n}${n % 100 >= 20 || (n > 0 && n % 100 === 0) ? " de" : ""} materiale`);

/**
 * Pasul de acum, în ordinea fluxului. Cu șantier pornit, pozițiile cererii nu
 * mai sunt pasul de acum: oferta a plecat, iar ce s-a executat se scrie în
 * situații. De aceea „cer să te uiți” vine doar înainte de șantier.
 */
export function urmeaza(s: StareLucrare): Urmeaza {
  const st = s.santier;
  if (st?.inchis) return { text: `Lucrare închisă pe ${ziRo(st.inchis)}.`, fila: "inchidere" };
  if (st) {
    // Totul executat: ce n-a fost comandat nu mai e de comandat, iar pasul e
    // inventarul de la închidere (Andrei, 14 noiembrie 2026). Înainte lucrarea
    // spunea „12 materiale de comandat”, iar Acasă că se poate închide.
    if (st.progres >= 100) {
      return { text: "Totul e executat.", fila: "inchidere", primar: { eticheta: "Închide șantierul", act: "fila", fila: "inchidere" } };
    }
    if (st.deComandat > 0) {
      return {
        text: `${materialeText(st.deComandat)} de comandat.`, fila: "materiale",
        primar: { eticheta: "Comandă ce lipsește", act: "fila", fila: "materiale" },
      };
    }
    return {
      text: `Șantierul e în lucru: ${st.progres} % executat.`, fila: "situatii",
      primar: { eticheta: "Situație nouă", act: "situatie-noua", fila: "situatii" },
    };
  }
  if (s.refuzat) {
    return {
      text: `Clientul a refuzat pe ${ziRo(s.refuzat)}.`, fila: "oferta",
      alb: { eticheta: "A acceptat până la urmă", act: "accepta-tarziu" },
    };
  }
  if (s.areCerere && s.deVerificat > 0) {
    return {
      text: `${pozitiiText(s.deVerificat)} să te uiți.`, fila: "cerere",
      primar: { eticheta: "Verifică", act: "fila", fila: "cerere" },
    };
  }
  if (!s.oferta) {
    return {
      text: "Completează datele ofertei și descarc-o.", fila: "oferta",
      primar: { eticheta: "Mergi la ofertă", act: "fila", fila: "oferta" },
    };
  }
  const numar = s.oferta.numar ? `Oferta ${s.oferta.numar}` : "Oferta";
  const din = s.oferta.data ? ` din ${s.oferta.data}` : "";
  return {
    text: `${numar} e făcută${din}. Ce a răspuns clientul?`, fila: "oferta",
    primar: { eticheta: "Clientul a acceptat", act: "accepta" },
    alb: { eticheta: "A refuzat", act: "refuza" },
  };
}

/** Ce e gata pe fiecare filă (✓) și de ce nu se poate folosi încă una. */
export function stareFile(s: StareLucrare): Record<FilaLucrare, { gata: boolean; inchisa?: string }> {
  const st = s.santier;
  const faraSantier = s.refuzat ? "Clientul a refuzat oferta." : s.oferta ? "După ce acceptă clientul." : "După ce faci oferta.";
  const faraCerere = "Lucrarea e de dinainte ca cererea să stea în aplicație.";
  return {
    cerere: s.areCerere ? { gata: s.deVerificat === 0 } : { gata: true, inchisa: faraCerere },
    oferta: s.areCerere ? { gata: !!s.oferta } : { gata: true, inchisa: faraCerere },
    // ✓ când tot materialul e pe șantier, sau când totul e executat: atunci
    // „Urmează” zice „Închide șantierul”, iar ce n-a venit nu mai e de adus
    // (15 noiembrie 2026; înainte fila rămânea fără ✓, cu materiale necomandate).
    materiale: st ? { gata: (st.neadus ?? st.deComandat) === 0 || st.progres >= 100 } : { gata: false, inchisa: faraSantier },
    situatii: st ? { gata: st.progres >= 100 } : { gata: false, inchisa: faraSantier },
    inchidere: st ? { gata: !!st.inchis } : { gata: false, inchisa: faraSantier },
  };
}
