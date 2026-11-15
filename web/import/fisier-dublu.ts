/**
 * Același fișier încărcat a doua oară (planul UX, Faza 6, punctul 8): făcea o
 * cerere nouă, cu același număr de ofertă (bugul din 16 octombrie). Acum, la
 * încărcare, dacă fișierul (după amprenta conținutului, nu după nume) e deja
 * la o lucrare, omul alege: „Deschide-o” sau „Încarcă-l ca lucrare nouă”.
 *
 * Pe server se caută în bază (`/api/cereri-dupa-fisier`); pe linkul demo, în
 * istoricul din browser. Best-effort: dacă nu se poate afla, importul merge ca
 * înainte.
 */
import * as ist from "../istoric.js";
import { citesteOferte, citestePlanuri, listeaza, modDate } from "../date.js";
import { gasesteLucrarea, lucrariDin, titluLucrare } from "../lucrare.js";
import { esc } from "../ecrane/tip.js";

/** SHA-256 al conținutului, hex. */
export async function amprentaFisier(buf: ArrayBuffer): Promise<string> {
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", buf));
  return [...h].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Cererile care au deja fișierul, cele mai noi întâi. */
async function cereriCuFisierul(buf: ArrayBuffer): Promise<string[]> {
  const amprenta = await amprentaFisier(buf);
  if (modDate() === "server") {
    const r = await fetch(`/api/cereri-dupa-fisier?amprenta=${amprenta}`, { credentials: "same-origin" });
    return r.ok ? (await r.json()) as string[] : [];
  }
  const out: string[] = [];
  for (const m of [...await ist.listeaza()].sort((a, b) => b.cand.localeCompare(a.cand))) {
    const s = await ist.incarca(m.id);
    if (s && await amprentaFisier(s.fisier) === amprenta) out.push(m.id);
  }
  return out;
}

/** Lucrarea la care e deja fișierul, cu numele ei; null = fișier nou (sau nu se poate afla). */
export async function lucrareaFisierului(buf: ArrayBuffer, faraCererea?: string): Promise<{ id: string; titlu: string } | null> {
  try {
    // Pe pagina unei lucrări, „Schimbă fișierul” cu același fișier nu e o dublură.
    const ids = (await cereriCuFisierul(buf)).filter((id) => id !== faraCererea);
    if (ids.length === 0) return null;
    const toate = lucrariDin(await listeaza(), citesteOferte(), citestePlanuri());
    const l = gasesteLucrarea(toate, ids[0]!);
    return { id: ids[0]!, titlu: l ? titluLucrare(l) : ids[0]! };
  } catch {
    return null;
  }
}

/** Întrebarea, în locul ecranului de încărcare. Un singur albastru: deschiderea. */
export function ecranDublura(fisier: string, titlu: string): string {
  return `<section class="imp-card imp-dublura" role="alert">
    <h2>Fișierul ăsta e deja la lucrarea ${esc(titlu)}.</h2>
    <p class="hint">${esc(fisier)} a mai fost încărcat. Deschide lucrarea, ca să nu ai două oferte pentru aceeași cerere.</p>
    <div class="imp-formular-butoane">
      <button type="button" class="primar" data-act="dublura-deschide">Deschide-o</button>
      <button type="button" class="secundar" data-act="dublura-nou">Încarcă-l ca lucrare nouă</button>
      <button type="button" class="legatura" data-act="dublura-renunta">Alt fișier</button>
    </div>
  </section>`;
}
