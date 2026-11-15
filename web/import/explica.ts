import {
  diametreNotate, diametreScrise, diferenteDinMotiv, MOTIVE_DOVEDITE, PUS_DE_OM, type LinieProcesata,
} from "../../src/import/nucleu.js";
import { DN_TO_OD } from "../../src/pricing/dn-table.js";
import type { MotivVerificare } from "../../src/pricing/types.js";
import { FORME_EDITOR, MATERIAL, diametruText, motiveLinie, stareLinie, type CodMotiv, type Sistem } from "./text.js";

/**
 * Motivul de la „De verificat”, spus ca propoziție (planul UX, Faza 6, punctul
 * 9): ce am presupus, cu valoarea concretă, și unde se schimbă. Până acum
 * rândul spunea doar „Grosime propusă, nu scrisă de client”, iar omul nu știa
 * ce să facă cu el. Acum: „Am pus 50 mm, grosimea obișnuită a firmei la
 * diametrul ăsta.”, cu „E bine” (confirmă) și „Schimb” (cursorul în grosime).
 *
 * Fiecare propoziție se termină cu ce a rămas pe rând, ca „E bine” să aibă
 * sens: confirmă exact valoarea scrisă. Pur, fără DOM: testat în Node; textul
 * din date trece prin `esc()` acolo unde se desenează.
 */

/** Coloana în care se schimbă presupunerea: cheile din `CASETA_COLOANEI`. */
export type Camp = "desc" | "material" | "gros" | "prot" | "diam" | "piesa" | "um" | "cant" | "pret";

export interface Explicatie {
  /** Una sau două propoziții, ale motivelor care cer ochi întâi. */
  text: string;
  /** Unde duce „Schimb”; `null`: nu e o casetă de schimbat (rândul necitit, lista celuilalt tip). */
  camp: Camp | null;
}

const ro = (v: number): string => String(v).replace(".", ",");
const mm = (g: number | null | undefined): string => (g === null || g === undefined ? "fără grosime" : `${ro(g)} mm`);
const eur = (v: number): string => `${v.toFixed(2).replace(".", ",")} €`;

/** Piesele, cum le spune omul (în nota motorului sunt codurile). */
const FORMA_RO: Record<string, string> = Object.fromEntries(FORME_EDITOR);

/** Câmpul citit diferit → coloana lui. */
const CAMP_CITIRE: Record<string, Camp> = {
  diametru: "diam", grosime: "gros", sistem: "material", forma: "piesa", straturi: "prot", gol: "gros",
};

/** O valoare citită de model, cum o scrie omul: „vata_minerala” → „vată minerală”. */
function valoareCitita(camp: string, v: string): string {
  if (camp === "sistem" && v in MATERIAL) return MATERIAL[v as Sistem].toLowerCase();
  if (camp === "forma") return FORMA_RO[v] ?? v;
  if (camp === "straturi") {
    return v === "fără" ? "fără protecție" : v.split("+").map((x) => (x in MATERIAL ? MATERIAL[x as Sistem].toLowerCase() : x)).join(" și ");
  }
  return v;
}

/** Propoziția unui singur motiv, cu valorile rândului. */
function propozitie(l: LinieProcesata, m: CodMotiv): Explicatie {
  const e = l.extras;
  const text = l.bruta.text;
  const d = diametruText(e) ?? "fără diametru";
  const pret = l.pret ? eur(l.pret.pret_unitar) : "fără preț";
  const note = l.pret?.note ?? [];
  const jacheta = l.pret && "straturi" in l.pret
    ? l.pret.straturi.find((s) => s.sistem === "tabla" || s.sistem === "tabla_inox") : undefined;
  switch (m) {
    case "citit_diferit": {
      const dif = diferenteDinMotiv(e.motiv);
      const prim = dif[0];
      if (prim?.prima && prim.adoua) {
        const a = valoareCitita(prim.camp, prim.prima);
        const b = valoareCitita(prim.camp, prim.adoua);
        return { text: `Citit de două ori, diferit: o dată ${a}, o dată ${b}. Am luat ${a}.`, camp: CAMP_CITIRE[prim.camp] ?? null };
      }
      return { text: "Citit de două ori, diferit. Uită-te la ce scrie pe rând.", camp: prim ? CAMP_CITIRE[prim.camp] ?? null : null };
    }
    case "doua_diametre": {
      const av = l.avertismente?.find((a) => a.cod === "doua_diametre");
      const doua = av?.diametre ?? [];
      const lista = doua.length > 1 ? `${doua.slice(0, -1).join(", ")} și ${doua.at(-1)}` : doua.join("");
      return { text: `Pe rând sunt două diametre: ${lista}. Am luat ${d}.`, camp: "diam" };
    }
    case "necitit":
      return { text: "Rândul n-a fost citit: e doar ce se vede din text. Apasă „Încearcă din nou” sus sau completează-l.", camp: null };
    case "diametru_contrazis": {
      const o = diametreScrise(text)[0];
      return { text: `Scrie ${d}, dar și Ø${o === undefined ? "" : ro(o)}, care nu e aceeași țeavă. Am luat ${d}.`, camp: "diam" };
    }
    case "diametru_nenotat": {
      const n = diametreNotate(text);
      const scrise = [...n.dn.map((v) => `DN${v}`), ...n.exterior.map((v) => `Ø${ro(v)}`)];
      return { text: `Am luat ${d}, dar pe rând diametrul e scris ${[...new Set(scrise)].join(", ")}.`, camp: "diam" };
    }
    case "diametru_necitat":
      return { text: `Am luat ${d}, dar cifra nu apare pe rând.`, camp: "diam" };
    case "notatie_contrazice_materialul":
      return { text: `Scrie ${d}, dar la țeava asta (plastic sau spiro) cifra e chiar diametrul exterior. Am luat ${d} ca la oțel.`, camp: "diam" };
    case "dn_necunoscut":
      return { text: `${d} nu e în tabelul de diametre.`, camp: "diam" };
    case "grosime_necitata":
      return { text: `Am pus ${mm(e.grosime_mm)}, dar grosimea nu apare pe rând.`, camp: "gros" };
    case "grosime_in_afara_listei":
      return { text: `${mm(e.grosime_mm)} nu e o grosime din listă la ${e.sistem ? MATERIAL[e.sistem].toLowerCase() : "material"}.`, camp: "gros" };
    case "strat_necitat": {
      // Auditul din 15 noiembrie: „vată minrală … tablă de alumniu” ieșea 10,71 €
      // în loc de 31,24 €. Omul trebuie să afle întâi că prețul e FĂRĂ protecție.
      const scos = /^(tabla_inox|tabla|pvc)\b[^:]*: nu e numit in text/.exec(note.find((n) => n.includes("nu e numit in text")) ?? "")?.[1];
      const ce = scos === "tabla_inox" ? "tablă de inox" : scos === "pvc" ? "PVC" : "tablă";
      return { text: `Prețul e fără ${ce}: ${pret}. Rândul pare să ceară ${ce}, dar n-o scrie limpede; dacă e, alege-o la Protecție.`, camp: "prot" };
    }
    case "gol_necitat":
      return { text: `Am pus golul ${e.gol_latime_mm ?? "?"}/${e.gol_inaltime_mm ?? "?"}, dar dimensiunile nu apar pe rând.`, camp: "gros" };
    case "forma_contrazice_um":
    case "forma_contrazisa": {
      const um = l.bruta.um?.trim() || "ml";
      // Nota spune piesa din text („… dar textul spune "cot", care da 102,88 €”).
      const piesa = m === "forma_contrazisa" ? /textul spune "([^"]+)"/.exec(note.join(" "))?.[1] : e.forma;
      return { text: `Unitatea e „${um}”, dar textul spune ${piesa ? FORMA_RO[piesa] ?? piesa : "altă piesă"}. Am păstrat „${um}”: ${pret}.`, camp: "piesa" };
    }
    case "grosime_propusa": {
      const g = mm(e.grosime_mm);
      const vecina = note.find((n) => n.includes("conducta cea mai apropiata"));
      if (vecina) return { text: `Am pus ${g}, ca la țeava cu diametrul cel mai apropiat (${/ø[\d.,]+/.exec(vecina)?.[0] ?? ""}).`, camp: "gros" };
      const alt = note.find((n) => n.startsWith("conductele de acelasi diametru au"));
      if (alt) return { text: `Țevile de același diametru au ${/au (.*?) mm/.exec(alt)?.[1]?.replace(" si ", " și ") ?? "grosimi diferite"} mm. Am pus ${g}.`, camp: "gros" };
      if (note.some((n) => n.startsWith("grosime") && n.includes("de la conducta"))) {
        return { text: `Am pus ${g}, ca la țeava de același diametru.`, camp: "gros" };
      }
      return { text: `Am pus ${g}, grosimea obișnuită a firmei la diametrul ăsta.`, camp: "gros" };
    }
    case "grosime_conducta_vecina": {
      const vecina = note.find((n) => n.includes("conducta cea mai apropiata"));
      return { text: `Nicio țeavă de același diametru: am pus ${mm(e.grosime_mm)}, ca la țeava cu diametrul cel mai apropiat (${/ø[\d.,]+/.exec(vecina ?? "")?.[0] ?? ""}).`, camp: "gros" };
    }
    case "grosime_fara_conducta": {
      const n = note.find((x) => x.includes("tabelul de grosimi uzuale"));
      return { text: `Grosimea nu e scrisă și nicio țeavă din listă n-are diametrul ăsta: am pus ${mm(e.grosime_mm)}, grosimea obișnuită a firmei (cea mai apropiată țeavă, ${/ø[\d.,]+/.exec(n ?? "")?.[0] ?? ""}, are alta).`, camp: "gros" };
    }
    case "tabla_fara_material":
      return { text: `Rândul spune „tablă”, fără material: am pus tablă de aluminiu, ${pret}.`, camp: "prot" };
    case "grosime_apropiata":
      return { text: `Grosimea scrisă nu e în listă: am luat ${mm(e.grosime_mm)}, cea mai apropiată.`, camp: "gros" };
    case "grosime_peste_lista":
      return { text: `Clientul cere ${mm(e.grosime_mm)}, mai gros decât lista: pot fi două straturi. Am pus prețul celui mai gros.`, camp: "gros" };
    case "grosime_extrapolata":
      return { text: `${mm(e.grosime_mm)} e peste listă: prețul pe m² e calculat din ultimele două grosimi (${pret}).`, camp: "pret" };
    case "grosime_interval":
      return { text: `Grosimea e scrisă ca interval: am luat ${mm(e.grosime_mm)}, capătul de sus.`, camp: "gros" };
    case "grosime_jacheta_apropiata":
      return { text: `Tabla n-are grosimea obișnuită aici: am luat ${mm(jacheta?.grosime_mm)}.`, camp: "prot" };
    case "protectie_foc": {
      const ei = /\bEI\s*(\d{2,3})/i.exec(text)?.[1];
      return {
        text: ei && ei !== "60"
          ? `Preț de mână: 48 €/m² e doar pentru EI60, aici scrie EI${ei}. Am pus ${pret}.`
          : `Preț de mână: 48 €/m² e doar pentru EI60. Am pus ${pret}.`,
        camp: "pret",
      };
    }
    case "doar_izolatia":
      return { text: `E livrarea țevii cu izolația: am pus doar izolația, ${pret}.`, camp: "pret" };
    case "peste_lista":
      return { text: `Diametrul e peste listă: prețul e din formula pe m² a firmei, ${pret}.`, camp: "pret" };
    case "celula_dedusa":
    case "celula_din_rezidential":
      return { text: `Combinația lipsește din listă: prețul e calculat, ${pret}.`, camp: "pret" };
    case "echipament_suprafata":
      return { text: `Echipament: prețul e din suprafața lui, ${pret}.`, camp: "pret" };
    case "banda_armaturi":
      return { text: `Bandă pe armături: am pus prețul elastomerului de 9 mm, ${pret}.`, camp: "pret" };
    case "mp_din_celalalt_segment":
    case "segment_diferit":
      return { text: `Prețul e din lista celuilalt tip de ofertă: ${pret}.`, camp: "pret" };
    case "gol_de_la_aceeasi_teava":
      return { text: `Golul nu e scris: am pus ${e.gol_latime_mm}/${e.gol_inaltime_mm}, ca la aceeași țeavă din fișier.`, camp: "gros" };
    case "um_bucata":
      return { text: `Cantitatea e în bucăți, dar prețul e pe metru: ${pret}.`, camp: "um" };
    case "serie_inox": {
      const od = e.diametru_valoare !== null ? DN_TO_OD[e.diametru_valoare] : undefined;
      return { text: `Țeavă de inox: am luat ${d}${od ? ` = ø${ro(od)}` : ""}, ca la oțel.`, camp: "diam" };
    }
    case "serie_cupru":
      return { text: `Țeavă de cupru: am luat ${d} pe seria cuprului.`, camp: "diam" };
    case "rotunjire_neconfirmata":
      return { text: `${d} e între două rânduri din listă: am luat rândul de sus.`, camp: "diam" };
    case "descriere_schimbata":
      return { text: "Descrierea s-a schimbat după ce ai verificat-o: am citit-o din nou.", camp: "desc" };
    case "citit_nesigur":
      return e.motiv === PUS_DE_OM
        ? { text: `L-ai pus tu din „Lăsate afară”: am propus ${e.sistem ? MATERIAL[e.sistem].toLowerCase() : "materialul"}, ${mm(e.grosime_mm)}.`, camp: "material" }
        : { text: "Citit automat, dar nesigur. Uită-te la ce scrie pe rând.", camp: null };
    default:
      return { text: "", camp: null };
  }
}

/**
 * Explicația unui rând „De verificat”. `null` pe celelalte: „Gata” n-are ce
 * spune, iar „Fără preț” își are butonul lui („Pune 50 mm”) și motivul scurt.
 * Motivele care cer ochi vin întâi (cele dovedite stau pe rând doar ca notă);
 * cel mult două propoziții, pe casete diferite; „Schimb” duce la prima.
 */
export function explicaRand(l: LinieProcesata): Explicatie | null {
  if (stareLinie(l) !== "de_validat") return null;
  const motive = motiveLinie(l);
  const dovedit = (m: CodMotiv): boolean => MOTIVE_DOVEDITE.has(m as MotivVerificare);
  const ordonate = [...motive.filter((m) => !dovedit(m)), ...motive.filter(dovedit)];
  const prop = ordonate.map((m) => propozitie(l, m)).filter((p) => p.text);
  if (prop.length === 0) return null;
  // A doua propoziție doar pe altă casetă: „două diametre” și „DN contrazis de Ø” spun același lucru.
  const alese = [prop[0]!, ...prop.slice(1).filter((p) => p.camp !== prop[0]!.camp).slice(0, 1)];
  const text = alese.map((p) => p.text).join(" ");
  return { text, camp: prop.find((p) => p.camp !== null)?.camp ?? null };
}
