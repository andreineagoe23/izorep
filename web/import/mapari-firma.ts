/**
 * Coloanele foilor, cum le știe firma (planul UX, Faza 6, punctul 1): cele din
 * repo (`mapari-statice`), plus cele de pe server, citite cu modelul la un
 * import de dinainte sau alese de un om („schimbă”). Pe linkul demo (fără
 * server) rămân doar cele din repo, ca până acum.
 *
 * Tot ce e aici e best-effort: un server care nu răspunde lasă importul pe
 * maparile pe care le are, adică pe comportamentul de dinainte.
 */
import { mapariStatice } from "../../src/import/mapari-statice.js";
import { amprentaFoaie, type MapareFoaie } from "../../src/import/mapare.js";
import { foaiePeFir, foiDeCitit } from "../../src/import/coloane.js";
import type { MapareSalvata } from "../../src/import/cache-mapari.js";
import type { FoaieBruta } from "../../src/import/parse-workbook.js";
import { modDate } from "../date.js";

/** Maparile de folosit la import și amprentele deja încercate (și cele respinse). */
export interface MapariImport {
  mapari: Map<string, MapareSalvata>;
  cunoscute: Set<string>;
}

interface MapareFirmei { amprenta: string; mapare: MapareFoaie; acceptata: boolean; sursa: string; fisier: string | null; foaie: string | null; model: string | null; actualizat: string }

const salvata = (amprenta: string, mapare: MapareFoaie, fisier: string, foaie: string, model: string): MapareSalvata => ({
  amprenta, mapare, fisier, foaie, model, generat: new Date().toISOString(),
});

const cere = async <T>(cale: string, metoda = "GET", corp?: unknown): Promise<{ ok: boolean; status: number; json: T | null }> => {
  const r = await fetch(cale, {
    method: metoda, credentials: "same-origin",
    headers: { "content-type": "application/json", "x-izorep": "1" },
    ...(corp !== undefined ? { body: JSON.stringify(corp) } : {}),
  });
  let json: T | null = null;
  try { json = (await r.json()) as T; } catch { /* nu e JSON */ }
  return { ok: r.ok, status: r.status, json };
};

/**
 * Maparile pentru un import: din repo, peste ele cele ale firmei, peste toate
 * cele ținute în cererea redeschisă (`proprii`), ca o cerere veche să iasă
 * cum a văzut-o omul, chiar dacă între timp un coleg a ales alte coloane.
 */
export async function mapariImport(proprii: readonly [string, MapareFoaie][] = []): Promise<MapariImport> {
  const mapari = mapariStatice();
  const cunoscute = new Set(mapari.keys());
  if (modDate() === "server") {
    try {
      const r = await cere<MapareFirmei[]>("/api/mapari");
      for (const m of r.ok && Array.isArray(r.json) ? r.json : []) {
        cunoscute.add(m.amprenta);
        if (m.acceptata) mapari.set(m.amprenta, salvata(m.amprenta, m.mapare, m.fisier ?? "", m.foaie ?? "", m.model ?? m.sursa));
      }
    } catch { /* fără server: maparile din repo */ }
  }
  for (const [a, m] of proprii) {
    cunoscute.add(a);
    mapari.set(a, salvata(a, m, "", "", "cererea"));
  }
  return { mapari, cunoscute };
}

/**
 * Foile cu antet necunoscut, citite cu modelul pe server. Ce acceptă
 * verificarea intră în `m.mapari`; ce respinge rămâne pe euristică. Întoarce
 * mesajul plafonului zilnic, dacă s-a atins.
 */
export async function citesteColoanele(foi: readonly FoaieBruta[], fisier: string, m: MapariImport): Promise<string> {
  let plafon = "";
  for (const f of foiDeCitit(foi, m.cunoscute)) {
    try {
      const r = await cere<{ amprenta: string; mapare: MapareFoaie; acceptata: boolean; eroare?: string }>(
        "/api/mapare", "POST", { foaie: foaiePeFir(f), fisier },
      );
      if (r.status === 429 && r.json?.eroare) { plafon = r.json.eroare; break; }
      if (!r.ok || !r.json) continue;
      m.cunoscute.add(r.json.amprenta);
      if (r.json.acceptata) m.mapari.set(r.json.amprenta, salvata(r.json.amprenta, r.json.mapare, fisier, f.nume, "model"));
    } catch { /* foaia rămâne pe euristică */ }
  }
  return plafon;
}

/**
 * Coloanele alese de om, salvate pe firmă (`null` le scoate). Null = salvate;
 * altfel de ce nu. Pe linkul demo, doar în cerere.
 */
export async function salveazaAlegerea(f: FoaieBruta, mapare: MapareFoaie | null, fisier: string): Promise<string | null> {
  if (modDate() !== "server") return null;
  try {
    const r = await cere<{ eroare?: string }>("/api/mapari", "PUT", { foaie: foaiePeFir(f), mapare, fisier });
    return r.ok ? null : r.json?.eroare ?? "Alegerea nu s-a putut salva.";
  } catch {
    return "Alegerea nu s-a putut salva: serverul nu răspunde.";
  }
}

/** Maparile folosite pe foile cererii, de ținut în ea. */
export function mapariFolosite(foi: readonly FoaieBruta[], mapari: ReadonlyMap<string, MapareSalvata>): [string, MapareFoaie][] {
  const out = new Map<string, MapareFoaie>();
  for (const f of foi) {
    const a = amprentaFoaie(f);
    const m = mapari.get(a);
    if (m) out.set(a, m.mapare);
  }
  return [...out];
}
