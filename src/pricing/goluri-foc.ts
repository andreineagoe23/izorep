import { bani } from "./engine.js";
import { listaGoluriFoc } from "./lists.js";
import {
  PozitieNetarifata,
  type CerereGolFoc, type ComponentaGolFoc, type Gol,
  type MaterialConducta, type RezultatGolFoc, type Traversare,
} from "./types.js";

/**
 * Inchideri goluri la foc.
 *
 * O conducta care trece printr-un perete rezistent la foc cere o gaura —
 * "golul" — iar gaura anuleaza peretele. Golul se inchide la loc pana la
 * clasa peretelui. De aici forma pretului, care nu seamana cu nimic altceva
 * din motor:
 *
 *   pret = golul (dupa SUPRAFATA lui) + banda WRAP + colier PROMASTOP
 *
 * Nota 2 din "Oferta pret inchideri goluri la foc.xlsx" o scrie explicit:
 * "Daca inchiderile golurilor la foc necesita banda wrap, pretul acestora va
 * fi constituit din pretul inchiderii golului la foc + pretul benzii wrap".
 * Nota 1, la fel: "In pretul inchiderilor golurilor la foc nu sunt incluse
 * colierele si banda wrap".
 *
 * Verificat pe oferta 118.1 / 27.04.2026 (NISAL SRL, XXXLutz+Momax
 * Balotesti): 53 de pozitii, total 12.692,04 EUR, identic cu oferta trimisa.
 * Vezi tests/goluri-foc.test.ts.
 */

/** Suprafata reala a golului, in mp. Ea alege pragul de pret. */
export function suprafataGol(gol: Gol): number {
  const { latime_mm, inaltime_mm } = gol;
  if (!(latime_mm > 0) || !(inaltime_mm > 0)) {
    throw new PozitieNetarifata("gol_dimensiuni_invalide", "dimensiunile golului trebuie sa fie pozitive", { gol });
  }
  return (latime_mm * inaltime_mm) / 1_000_000;
}

/**
 * Suprafata asa cum o scrie firma in coloana "suprafata": rotunjita IN SUS
 * la 2 zecimale, nu la cel mai apropiat. In oferta 118.1, golul 150/150 =
 * 0,0225 mp e trecut 0,03, iar 320/320 = 0,1024 mp e trecut 0,11.
 *
 * Exista doar pentru export, ca fisierul generat sa arate ca al firmei. NU
 * intra in alegerea pragului — si nici nu ar schimba-o: pragurile sunt valori
 * cu 2 zecimale, deci rotunjirea in sus depaseste un prag exact atunci cand
 * il depaseste si suprafata reala.
 */
export const suprafataAfisata = (mp: number): number => Math.ceil(mp * 100 - 1e-9) / 100;

/**
 * Pretul golului, dupa suprafata.
 *
 * Pragurile sunt scrise "Goluri pana la 0,05 mp", deci limita superioara e
 * INCLUSIVA. Se vede si in oferta: un gol 1000/600 = 0,60 mp exact e tarifat
 * pe pragul "pana la 0,60" (53,78), iar 1500/600 = 0,90 mp exact pe pragul
 * "pana la 0,90" (84,51). Cu limita exclusiva, ambele ar fi urcat un prag.
 *
 * Peste ultimul prag lista trece la tarif pe mp: "Goluri mai mari de 1,00 mp
 * — 134,43 / mp".
 */
export function pretGol(mp: number): number {
  const l = listaGoluriFoc();
  for (const prag of l.praguri_suprafata) {
    if (mp <= prag.pana_la_mp) return bani(prag.pret_buc);
  }
  return bani(mp * l.peste_1mp_pret_pe_mp);
}

/**
 * Banda WRAP.
 *
 * Lista are DOUA tabele, dupa materialul conductei, cu preturi mult diferite
 * la acelasi diametru: la ø140 sunt 12,19 EUR pe otel si 65,665 EUR pe
 * plastic. Diferenta vine din numarul de infasurari — 1 la otel, 2 pana la 6
 * la plastic, dupa diametru. De aceea materialul e obligatoriu, nu implicit.
 *
 * Cautarea e pe diametru EXACT: fara cel-mai-apropiat, fara interpolare.
 * Pretul urmeaza numarul de infasurari, care sare in trepte; un diametru
 * intre doua trepte nu are un numar de infasurari "intre ele", ci are nevoie
 * de decizia omului.
 */
export function pretBandaWrap(diametru: number, material: MaterialConducta): number {
  const tabel = listaGoluriFoc().banda_wrap[material];
  const b = tabel.find((x) => x.diametru === diametru);
  if (!b) {
    throw new PozitieNetarifata("banda_wrap_inexistenta", "banda WRAP nu e ofertata la acest diametru", {
      diametru, material,
      disponibile: tabel.map((x) => x.diametru),
    });
  }
  return bani(b.pret);
}

/**
 * Colier de protectie antifoc PROMASTOP UNICOLLAR.
 *
 * Lista il da doar pentru conducte de plastic, cu doua preturi per diametru:
 * "1 colier/conducta plastic (urcare)" si "2 coliere/conducta plastic
 * (orizontala)", al doilea exact dublu. Cautarea e tot pe diametru exact:
 * colierul e piesa de catalog, nu marime continua.
 */
export function pretColier(diametru: number, traversare: Traversare): number {
  const tabel = listaGoluriFoc().colier_promastop;
  const c = tabel.find((x) => x.diametru === diametru);
  if (!c) {
    throw new PozitieNetarifata("colier_inexistent", "colierul PROMASTOP nu e ofertat la acest diametru", {
      diametru, disponibile: tabel.map((x) => x.diametru),
    });
  }
  return bani(traversare === "orizontal" ? c.pret_orizontal_2coliere : c.pret_urcare_1colier);
}

/**
 * Tarifeaza o inchidere de gol la foc.
 *
 * Rotunjirea la 2 zecimale se face PE FIECARE COMPONENTA, apoi se aduna —
 * aceeasi regula ca la straturile de izolatie din `tarifeaza`.
 */
export function tarifeazaGolFoc(cerere: CerereGolFoc): RezultatGolFoc {
  const {
    gol, diametru_conducta, material_conducta,
    banda_wrap, colier, clasa_foc, cantitate,
  } = cerere;

  const mp = suprafataGol(gol);
  const componente: ComponentaGolFoc[] = [{
    tip: "gol",
    descriere: `gol ${gol.latime_mm}/${gol.inaltime_mm} mm = ${suprafataAfisata(mp).toFixed(2)} mp`,
    pret: pretGol(mp),
  }];

  if (banda_wrap || colier) {
    if (diametru_conducta === undefined) {
      throw new PozitieNetarifata(
        "diametru_conducta_lipsa",
        "banda WRAP si colierul se tarifeaza pe diametrul conductei, care lipseste",
        { gol, banda_wrap, colier },
      );
    }
    if (banda_wrap) {
      if (material_conducta === undefined) {
        // Fara material nu exista un pret unic: tabelele de otel si de plastic
        // dau valori diferite la acelasi diametru. Un implicit ar ghici.
        throw new PozitieNetarifata(
          "material_conducta_lipsa",
          "banda WRAP are pret diferit pe conducta de otel fata de plastic; materialul lipseste",
          { diametru_conducta },
        );
      }
      componente.push({
        tip: "banda_wrap",
        descriere: `banda WRAP ø${diametru_conducta} ${material_conducta}`,
        pret: pretBandaWrap(diametru_conducta, material_conducta),
      });
    }
    if (colier) {
      componente.push({
        tip: "colier",
        descriere: `colier PROMASTOP ø${diametru_conducta}, ${colier === "orizontal" ? "2 coliere" : "1 colier"}`,
        pret: pretColier(diametru_conducta, colier),
      });
    }
  }

  const unitar = bani(componente.reduce((s, c) => s + c.pret, 0));
  return {
    componente,
    suprafata_mp: mp,
    suprafata_afisata: suprafataAfisata(mp),
    clasa_foc: clasa_foc ?? null,
    pret_unitar: unitar,
    cantitate,
    total: bani(unitar * cantitate),
    moneda: "EUR",
  };
}
