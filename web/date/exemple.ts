/**
 * Datele de exemplu din `seed.ts` (clienții, lucrările și documentele firmei,
 * citite din fișierele lor), doar pe linkul demo, unde datele stau în browser.
 *
 * Pe server, ce se vede vine numai din bază (`docs/plan-demo.md`, direcția 2):
 * `exemple()` dă `null`. Construit cu `VITE_DATE=server` (`build:server`),
 * ramura cu `seed` nu se poate atinge, deci nici nu intră în pachet: numele și
 * sumele clienților nu mai pleacă în pagina servită de server.
 */
import * as seed from "./seed.js";
import { modDate } from "../date.js";

const DOAR_SERVER = (import.meta as { env?: Record<string, string | undefined> }).env?.["VITE_DATE"] === "server";

export type Exemple = typeof seed;

export function exemple(): Exemple | null {
  if (DOAR_SERVER) return null;
  return modDate() === "server" ? null : seed;
}
