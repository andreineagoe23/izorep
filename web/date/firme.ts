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
  { id: "radoia", denumire: "RADOIA ISOLIRUNG SRL", serieOferta: "RAD", logo: { fisier: "logo-radoia.jpg", latime: 315, inaltime: 58 } },
  { id: "isorad", denumire: "R&F ISORAD SYSTEM SRL", serieOferta: "ISO", logo: { fisier: "logo-isorad.jpg", latime: 203, inaltime: 91 } },
] as const;

export type LogoFirma = (typeof FIRME)[number]["logo"];

/** Logo-ul firmei de pe antet, după denumire (antetul ofertei ține denumirea). */
export const logoFirmei = (denumire: string): LogoFirma | null =>
  FIRME.find((f) => f.denumire === denumire)?.logo ?? null;
