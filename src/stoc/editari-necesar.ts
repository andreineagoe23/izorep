/**
 * Ce a schimbat omul pe lista de materiale a unui șantier, păstrat când lista
 * se calculează din nou (21 octombrie 2026: „Creează șantierul” apăsat a doua
 * oară, după o corectură în ofertă, ștergea cantitățile scrise de om, „Îl dă
 * clientul”, ✕ și materialele de mână).
 */
import { articolDin, cantitateNecesara } from "./registru.js";
import type { MaterialNecesar } from "./necesar.js";

/**
 * Materialul cu altă cantitate, în unitatea articolului (ml la tub, m² altfel).
 * Greutatea tablei se ține proporțională.
 */
export function cuCantitatea(m: MaterialNecesar, q: number): MaterialNecesar {
  const acum = cantitateNecesara(m);
  const kg = m.kg !== undefined && acum > 0 ? { kg: Math.round((m.kg * q / acum) * 100) / 100 } : {};
  return articolDin(m).um === "ml" ? { ...m, ml: q, ...kg } : { ...m, m2: q, ...kg };
}

/**
 * Lista nouă, calculată din ofertă, cu ce a făcut omul pe cea veche, după
 * materialul (cheia articolului):
 *
 * - cantitatea scrisă de el rămâne a lui; `calculat` devine cifra nouă, deci
 *   celula rămâne galbenă și arată, sub mouse, noul calcul;
 * - „Îl dă clientul” rămâne;
 * - ce a scos cu ✕ rămâne scos (în `scoase`, cu cifrele noi);
 * - materialele adăugate de mână rămân, la coadă.
 *
 * Un material care nu mai e în ofertă nu se întoarce din editări.
 */
export function pastreazaEditari(
  vechi: { materiale: readonly MaterialNecesar[]; scoase?: readonly MaterialNecesar[] } | undefined,
  nou: readonly MaterialNecesar[],
): { materiale: MaterialNecesar[]; scoase?: MaterialNecesar[] } {
  if (!vechi) return { materiale: [...nou] };
  const cheie = (m: MaterialNecesar): string => articolDin(m).cheie;
  const peCheie = new Map(vechi.materiale.filter((m) => !m.manual).map((m) => [cheie(m), m]));
  const scoaseVechi = new Set((vechi.scoase ?? []).map(cheie));
  const materiale: MaterialNecesar[] = [];
  const scoase: MaterialNecesar[] = [];
  for (const m of nou) {
    if (scoaseVechi.has(cheie(m))) { scoase.push(m); continue; }
    const v = peCheie.get(cheie(m));
    let rez = m;
    if (v?.calculat !== undefined) {
      const calculat = cantitateNecesara(m);
      const scris = cantitateNecesara(v);
      rez = Math.abs(scris - calculat) < 0.005 ? m : { ...cuCantitatea(m, scris), calculat };
    }
    if (v?.alClientului) rez = { ...rez, alClientului: true };
    materiale.push(rez);
  }
  materiale.push(...vechi.materiale.filter((m) => m.manual));
  return { materiale, ...(scoase.length ? { scoase } : {}) };
}
