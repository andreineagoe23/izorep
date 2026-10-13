/**
 * Firmele emitente ale tenantului: RADOIA ISOLIRUNG și R&F ISORAD SYSTEM. Le
 * scrie și `src/db/seed.ts` în bază, cu aceeași cheie (`cod` = `id`) și serie.
 * Nu sunt date de exemplu, ci antetul ofertelor, deci rămân și pe server.
 */
export const FIRME = [
  { id: "radoia", denumire: "RADOIA ISOLIRUNG SRL", serieOferta: "RAD" },
  { id: "isorad", denumire: "R&F ISORAD SYSTEM SRL", serieOferta: "ISO" },
] as const;
