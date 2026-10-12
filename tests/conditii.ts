/**
 * Ce le trebuie testelor din afara codului: fișierele clienților și baza.
 *
 * Fișierele clienților (cererile și ofertele semnate) stau în `../attachments`,
 * în afara repo-ului: sunt date reale ale clienților și nu urcă pe GitHub.
 * Deci în CI lipsesc. Până pe 12 octombrie 2026 testele care le cereau ieșeau
 * cu `return` când lipseau: în CI treceau fără să verifice nimic, și arătau
 * exact ca testele care trec. Acum se sar vizibil, iar CI-ul le numără.
 *
 * Baza e altfel: în CI pornește mereu, deci acolo o bază care nu răspunde
 * pică testul, nu-l sare.
 */
import { existsSync } from "node:fs";
import { it } from "vitest";

export const CLIENTI = "../attachments/clienti";

/** Fișierele clienților sunt pe disc (local, nu în CI). */
export const areClienti = existsSync(CLIENTI);

/** Un test pe fișierele clienților: fără ele, sărit vizibil, nu trecut în gol. */
export const cuClienti = it.skipIf(!areClienti);

/**
 * Sondarea bazei, la nivel de modul (vezi `db.test.ts`). În CI baza trebuie
 * să răspundă: acolo o bază lipsă e o eroare, nu un motiv de sărit.
 */
export function bazaDisponibila(disponibila: boolean, ce: string): boolean {
  if (disponibila) return true;
  if (process.env["CI"]) throw new Error(`Baza nu raspunde in CI — ${ce} nu se pot sari aici.`);
  console.warn(`Baza nu raspunde — ${ce} se sar. Porneste: npm run db:up && npm run db:migrate && npm run db:seed`);
  return false;
}
