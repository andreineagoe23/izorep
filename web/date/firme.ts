/**
 * Firmele emitente ale tenantului: RADOIA ISOLIRUNG și R&F ISORAD SYSTEM. Le
 * scrie și `src/db/seed.ts` în bază, cu aceeași cheie (`cod` = `id`) și serie.
 * Nu sunt date de exemplu, ci antetul ofertelor, deci rămân și pe server.
 *
 * Logo-ul e cel din antetul ofertelor semnate (284 pe RADOIA, 118 pe ISORAD),
 * din `web/public`; lățimea și înălțimea, în pixeli, sunt cât îl pune firma
 * în pagină (284: 236 × 43 pt, 118: 152 × 68 pt).
 */
export const FIRME = [
  { id: "radoia", denumire: "RADOIA ISOLIRUNG SRL", scurt: "RADOIA", serieOferta: "RAD", logo: { fisier: "logo-radoia.jpg", latime: 315, inaltime: 58 } },
  { id: "isorad", denumire: "R&F ISORAD SYSTEM SRL", scurt: "ISORAD", serieOferta: "ISO", logo: { fisier: "logo-isorad.jpg", latime: 203, inaltime: 91 } },
] as const;

export type IdFirma = (typeof FIRME)[number]["id"];

/** Firma după cheie (`radoia`), după denumirea de pe antet sau după numele scurt; altfel nimic. */
export const firmaDupa = (cheieSauDenumire: string | undefined): (typeof FIRME)[number] | undefined =>
  cheieSauDenumire
    ? FIRME.find((f) => f.id === cheieSauDenumire || f.denumire === cheieSauDenumire || f.scurt === cheieSauDenumire.trim().toUpperCase())
    : undefined;

/**
 * Ultima firmă aleasă la „Cerere nouă” sau pe fila Ofertă (Etapa 2, 26 noiembrie
 * 2026): cererea următoare pornește pe ea. În browser, best-effort: blocat,
 * pornește pe prima firmă.
 */
const CHEIE_FIRMA = "izorep-firma";
export function ultimaFirma(d?: Storage): IdFirma {
  try {
    const v = (d ?? globalThis.localStorage)?.getItem(CHEIE_FIRMA) ?? undefined;
    return firmaDupa(v)?.id ?? FIRME[0].id;
  } catch {
    return FIRME[0].id;
  }
}
export function tineFirma(id: string, d?: Storage): void {
  const f = firmaDupa(id);
  if (!f) return;
  try { (d ?? globalThis.localStorage)?.setItem(CHEIE_FIRMA, f.id); } catch { /* best-effort */ }
}

export type LogoFirma = (typeof FIRME)[number]["logo"];

/** Logo-ul firmei de pe antet, după denumire (antetul ofertei ține denumirea). */
export const logoFirmei = (denumire: string): LogoFirma | null =>
  FIRME.find((f) => f.denumire === denumire)?.logo ?? null;
