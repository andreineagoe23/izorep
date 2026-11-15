/**
 * Memoria de șabloane a importului (L4), după unde stau datele (planul UX,
 * Faza 6, punctul 2, 14 noiembrie 2026):
 *
 * - pe server, în bază, pe firmă (`/api/sabloane`): corectura unui coleg îl
 *   ajută și pe celălalt și nu se pierde la schimbarea calculatorului;
 * - pe linkul demo (fără server), în `localStorage`, ca până acum (`stoc-local.ts`).
 *
 * Aceeași interfață (`StocSabloane`), sincronă: nucleul o citește la fiecare
 * tastă. Deci șabloanele firmei se aduc o dată, la deschiderea importului,
 * iar o corectură se pune întâi în copia din pagină și pleacă apoi la server.
 * Un server care nu răspunde nu oprește importul: memoria e o optimizare.
 *
 * Ce era deja în `localStorage` se mută o dată pe server
 * (`/api/sabloane/mutare`); un tipar pe care firma îl știe deja nu se scrie
 * peste. Copia din browser rămâne, nefolosită, ca la mutarea datelor.
 */
import type { SablonInvatat, StocSabloane } from "../src/import/memorie.js";
import { modDate } from "./date.js";
import { stocLocal } from "./stoc-local.js";

const CHEIE_MUTAT = "izorep-sabloane-mutate";

const trimite = (metoda: string, cale: string, corp: unknown): Promise<Response> => fetch(cale, {
  method: metoda, credentials: "same-origin",
  headers: { "content-type": "application/json", "x-izorep": "1" }, body: JSON.stringify(corp),
});

/** Peste o copie în memorie: scrierile pleacă la server fără să aștepte ecranul. */
export function stocPeServer(initial: SablonInvatat[], scrie = trimite): StocSabloane {
  const m = new Map(initial.map((s) => [s.tipar, s]));
  const fara = (p: Promise<unknown>): void => { p.catch(() => { /* rămâne în pagină; la importul următor se reia */ }); };
  return {
    toate: () => [...m.values()],
    pune(s) { m.set(s.tipar, s); fara(scrie("PUT", "/api/sabloane", s)); },
    sterge(tipar) { m.delete(tipar); fara(scrie("DELETE", "/api/sabloane", { tipar })); },
  };
}

const mutat = (): boolean => { try { return localStorage.getItem(CHEIE_MUTAT) !== null; } catch { return true; } };

/** Ce era în browser, o dată pe server. Întoarce câte au intrat. */
async function mutaDinBrowser(): Promise<number> {
  if (mutat()) return 0;
  const locale = stocLocal().toate();
  let n = 0;
  if (locale.length > 0) {
    const r = await trimite("POST", "/api/sabloane/mutare", { sabloane: locale });
    if (!r.ok) return 0;
    n = ((await r.json()) as { mutate?: number }).mutate ?? 0;
  }
  try { localStorage.setItem(CHEIE_MUTAT, new Date().toISOString()); } catch { /* se reîncearcă; nu dublează */ }
  return n;
}

/** Memoria pentru un import: a firmei pe server, a browserului pe linkul demo. */
export async function stocSabloane(): Promise<StocSabloane> {
  if (modDate() !== "server") return stocLocal();
  try {
    await mutaDinBrowser();
    const r = await fetch("/api/sabloane", { credentials: "same-origin" });
    if (!r.ok) throw new Error(String(r.status));
    return stocPeServer((await r.json()) as SablonInvatat[]);
  } catch {
    // Serverul nu răspunde acum: importul merge fără memorie; corecturile se trimit oricum.
    return stocPeServer([]);
  }
}
