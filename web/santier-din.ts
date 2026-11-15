/**
 * Șantierul din ofertă, fără DOM: planul (pozițiile ofertei, înghețate) plus
 * necesarul lui, pe depozitul șantierului. Până pe 14 noiembrie 2026 era
 * „Creează șantierul” din pasul „Oferta”; acum îl pornesc „Clientul a
 * acceptat” și „Refă lista” de pe fila Materiale (`web/ecrane/import.ts`), iar
 * `scripts/demo.ts` face cu el TRANSAVIA și NISAL. Înainte demo-ul își ținea
 * o copie, care rămânea în urmă la fiecare schimbare a regulilor.
 *
 * Unul pe cerere: refăcut, îl înlocuiește pe cel vechi și păstrează ce a
 * schimbat omul pe listă, dar nu și după ce are situații de lucrări, fiindcă
 * istoricul lor e pe pozițiile vechi.
 */
import type { LinieProcesata } from "../src/import/nucleu.js";
import { PIERDERI_IMPLICITE, PRAG_TUB_MM, necesarDinLinii, type Pierderi } from "../src/stoc/necesar.js";
import { pastreazaEditari } from "../src/stoc/editari-necesar.js";
import type { PlanSantier } from "../src/lucrari/situatii.js";
import { cuAjustare, imparte, planDinOferta, type CerereOferta } from "./oferta.js";
import type { NecesarLucrare, StareDepozit } from "./depozit-local.js";
import { citesteDepozit, citestePlanuri, idNou, scrieDepozit, scriePlanuri } from "./date.js";

/** Regulile necesarului: pierderile la croit, pragul tub / placă și diametrele comandate tot ca tub. */
export interface ReguliNecesar { pierderi: Pierderi; pragTub: number; tuburiPeste: number[] }

/** Ce pune firma de obicei (pierderi 10 / 10 / 10 / 0 %, tuburi până la 3 țoli): cu ele pornește șantierul. */
export const REGULI_FIRMEI: ReguliNecesar = { pierderi: { ...PIERDERI_IMPLICITE }, pragTub: PRAG_TUB_MM, tuburiPeste: [] };

/** Șantierul făcut, sau de ce nu (și fila unde se rezolvă). */
export type RezultatSantier = { plan: string } | { eroare: string; fila?: "oferta" };

/** Cererea din care se face șantierul, așa cum o are ecranul sau demo-ul. */
export interface CerereSantier {
  /** Id-ul cererii salvate (leagă șantierul de ea) și numele fișierului. */
  sesiune: string;
  fisier: string;
  /** Oferta, cu antetul ei (obiectivul, discountul, ajustarea). */
  oferta: CerereOferta;
  /** Rândurile citite din fișier, pentru secțiunea fiecărei poziții. */
  brute: readonly { index: number; sectiune?: string | undefined }[];
  /** Ziua refuzului, ISO: refuzată, nu se pornește. */
  refuzat?: string | undefined;
}

/** Id-urile noi: date de demo (`S-TRANSAVIA`), altfel făcute acum. */
export interface IduriSantier { santier?: string; necesar?: string }

/**
 * Pur: din cerere, planurile și depozitul de acum, planurile și depozitul de
 * după. Șantierul acestei cereri se caută după id: același fișier importat din
 * nou e altă cerere, cu șantierul ei (16 octombrie 2026); numele fișierului
 * leagă doar planurile vechi, fără `cerere`.
 */
export function santierNou(
  c: CerereSantier, reguli: ReguliNecesar,
  acum: { planuri: readonly PlanSantier[]; depozit: StareDepozit; id: () => string; cand: string },
  iduri: IduriSantier = {},
): { plan: PlanSantier; planuri: PlanSantier[]; depozit: StareDepozit } | { eroare: string; fila?: "oferta" } {
  if (c.refuzat) return { eroare: "Clientul a refuzat oferta. Apasă întâi „A acceptat până la urmă”." };
  const vechi = acum.planuri.find((p) => p.cerere === c.sesiune || (p.cerere === undefined && p.fisier === c.fisier));
  if (vechi && vechi.situatii.length > 0) {
    return { eroare: `Șantierul „${vechi.denumire}” are deja situații de lucrări, deci pozițiile lui nu se mai schimbă.` };
  }
  // Fără obiectiv, șantierul lua numele fișierului („Transavia Abur”) și se
  // confunda cu altul din aceeași cerere (16 octombrie 2026).
  if (!c.oferta.antet.obiectiv.trim()) {
    return { eroare: "Scrie întâi obiectivul la „Datele ofertei”: așa se va numi șantierul.", fila: "oferta" };
  }
  // Planul e „creat” acum: oferta e refăcută la pornire.
  const oferta: CerereOferta = { ...c.oferta, provenienta: { ...c.oferta.provenienta, generatLa: acum.cand } };
  const plan = planDinOferta(oferta, vechi?.id ?? iduri.santier ?? `S-${acum.id()}`,
    new Map(c.brute.map((b) => [b.index, b.sectiune ?? ""])));
  const linii: LinieProcesata[] = imparte(cuAjustare(oferta.linii, oferta.antet.ajustareProcent ?? 0)).oferta;
  const n = necesarDinLinii(linii, {
    pierderi: reguli.pierderi, pragTub: reguli.pragTub, tuburiPeste: reguli.tuburiPeste,
    discountProcent: oferta.antet.discountProcent ?? 0,
  });
  const st = acum.depozit;
  const vechiNecesar = vechi ? st.necesare.find((x) => x.santier === vechi.id || (x.santier === undefined && x.fisier === c.fisier)) : undefined;
  // Refăcut, lista păstrează ce a schimbat omul pe ea (cantități, ✕, „Îl dă clientul”, materialul de mână).
  const pastrat = pastreazaEditari(vechiNecesar, n.materiale);
  const nou: NecesarLucrare = {
    id: vechiNecesar?.id ?? iduri.necesar ?? acum.id(), creat: acum.cand, fisier: c.fisier,
    obiectiv: plan.denumire, pierderi: n.pierderi, pragTub: n.pragTub, tuburiPeste: n.tuburiPeste, ...pastrat,
    faraNecesar: n.faraNecesar.length, santier: plan.id,
    ...(vechiNecesar?.versiune !== undefined ? { versiune: vechiNecesar.versiune } : {}),
  };
  return {
    plan,
    planuri: [plan, ...acum.planuri.filter((p) => p !== vechi)],
    depozit: { ...st, necesare: [nou, ...st.necesare.filter((x) => x !== vechiNecesar)] },
  };
}

/** Șantierul pornit și scris (pe server, sau în browser pe linkul demo). */
export function santierDin(c: CerereSantier, reguli: ReguliNecesar = REGULI_FIRMEI, iduri: IduriSantier = {}): RezultatSantier {
  const r = santierNou(c, reguli, {
    planuri: citestePlanuri(), depozit: citesteDepozit(), id: idNou, cand: new Date().toISOString(),
  }, iduri);
  if ("eroare" in r) return r;
  if (!scriePlanuri(r.planuri)) return { eroare: "Browserul nu permite salvarea: șantierul nu a putut fi pornit." };
  scrieDepozit(r.depozit);
  return { plan: r.plan.id };
}
