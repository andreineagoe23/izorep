/**
 * Rândurile lăsate afară (planul UX, Faza 6, punctul 3, 14 noiembrie 2026):
 * au unitate de măsură și cantitate, deci arată ca o poziție, dar n-au devenit
 * poziție de izolație. Până acum dispăreau din ofertă fără urmă (așa dispărea
 * torcretul de la spital, până l-am recunoscut ca protecție la foc). Pe
 * ecranul de verificare stau în fila „Lăsate afară · N”, fiecare cu „E
 * izolație”.
 *
 * Pur, izomorf: ecranul arată lista, testele o numără pe fișierele clienților.
 */
import type { LinieProcesata, Rezolvare, Rezultat } from "./nucleu.js";
import { citesteText, PUS_DE_OM } from "./nucleu.js";

export interface LasatAfara {
  index: number;
  foaie: string;
  rand: number;
  text: string;
  um: string;
  cantitate: number;
  /**
   * De ce nu e poziție, când știm: vine izolat de la producător, l-a scos omul,
   * sau a plecat la citit și nu s-a întors (`necitit`: „Încearcă din nou”).
   */
  motiv?: "preizolat" | "scos" | "necitit";
}

/** Rândurile cu UM și cantitate care nu sunt poziții, în ordinea din fișier. */
export function lasateAfara(
  rez: Pick<Rezultat, "brute" | "linii" | "rezolvate">, necitite?: ReadonlySet<number>,
): LasatAfara[] {
  const linii = new Map<number, LinieProcesata>(rez.linii.map((l) => [l.extras.index, l]));
  const out: LasatAfara[] = [];
  for (const b of rez.brute) {
    const um = b.um?.trim();
    if (!um || !(b.cantitate !== undefined && b.cantitate > 0)) continue;
    const l = linii.get(b.index);
    if (l && l.extras.sistem !== null) continue;
    const motiv = l?.preizolat ? "preizolat" as const
      : rez.rezolvate.get(b.index)?.sursa === "om" ? "scos" as const
      : necitite?.has(b.index) ? "necitit" as const : undefined;
    out.push({
      index: b.index, foaie: b.foaie, rand: b.rand, text: b.text, um, cantitate: b.cantitate,
      ...(motiv ? { motiv } : {}),
    });
  }
  return out;
}

/** Materialul propus când rândul nu-l numește: cel mai des ofertat; omul îl schimbă din rând. */
export const SISTEM_PROPUS = "vata_minerala" as const;

/**
 * „E izolație”: rezolvarea care face din rând o poziție. Ce se citește din
 * rând rămâne; materialul lipsă e propus. Intră ca o citire nesigură
 * (încredere 0, `PUS_DE_OM`), deci trece la „De verificat” (sau la „Fără
 * preț”, cât îi lipsesc grosimea ori diametrul) până o confirmă sau o
 * corectează omul. Regulile care l-au lăsat afară nu-l mai scot.
 */
export function faPozitie(rez: Pick<Rezultat, "brute">, a: LasatAfara): Rezolvare {
  const b = rez.brute.find((x) => x.index === a.index);
  const citit = citesteText(a.index, a.text, a.um, b?.sectiune, a.cantitate);
  const extras = {
    ...citit, sistem: citit.sistem ?? SISTEM_PROPUS, incredere: 0, motiv: PUS_DE_OM,
  };
  return { extras, sursa: "model", text: a.text };
}
