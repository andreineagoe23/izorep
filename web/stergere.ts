import type { PlanSantier } from "../src/lucrari/situatii.js";
import type { StareDepozit } from "./depozit-local.js";
import type { OfertaEmisa } from "./oferte-local.js";

/**
 * Ștergerea de tot (Andrei, 15 octombrie 2026): o cerere cu tot ce s-a făcut
 * din ea, sau un șantier cu tot ce ține de el. Înainte, o cerere cu ofertă și
 * un șantier cu situații nu se puteau șterge deloc.
 *
 * Aici se hotărăște CE se șterge, o singură dată, pur: ecranul îl arată în
 * confirmare, browserul îl scoate din datele lui, iar serverul îl recalculează
 * din baza lui (nu crede lista trimisă de pagină) și șterge exact asta.
 *
 * - **Cererea**: ofertele ei (toate versiunile), șantierele făcute din ea și,
 *   pentru fiecare, tot ce urmează.
 * - **Șantierul**: situațiile de lucrări, necesarul, comenzile pentru el
 *   (trimise sau nu), mișcările de stoc pe el sau pentru el (intrări,
 *   transferuri, consum, retururi) și avizele / facturile comenzilor. Cererea
 *   și oferta rămân.
 *
 * Mișcările șterse dispar din istoric: un transfer din depozitul central pe
 * șantier, șters, înseamnă că materialul n-a plecat niciodată din central.
 */

export type TintaStergere = { cerere: { id: string; nume: string } } | { santier: string };

export interface Stergere {
  cerere?: { id: string; nume: string };
  oferta?: OfertaEmisa;
  santiere: { id: string; denumire: string; situatii: number; inchis: boolean }[];
  necesare: { id: string; materiale: number }[];
  comenzi: { id: string; furnizor: string; trimisa: boolean }[];
  miscari: string[];
  documente: string[];
}

export interface DateDeSters {
  planuri: PlanSantier[];
  depozit: StareDepozit;
  oferte: Record<string, OfertaEmisa>;
}

/**
 * `santiereInPlus`: șantierele legate de cerere pe care pagina nu le vede
 * (pe server, legătura `santier.oferta_id`).
 */
export function ceSeSterge(d: DateDeSters, t: TintaStergere, santiereInPlus: readonly string[] = []): Stergere {
  const cerere = "cerere" in t ? t.cerere : undefined;
  // Șantierul e al cererii după id. Numele fișierului leagă doar planurile
  // vechi, fără `cerere`: același fișier importat de două ori sunt două cereri,
  // iar ștergerea uneia lua și șantierul celeilalte (16 octombrie 2026).
  const planuri = d.planuri.filter((p) => ("santier" in t ? p.id === t.santier
    : p.cerere === t.cerere.id || (p.cerere === undefined && p.fisier === t.cerere.nume) || santiereInPlus.includes(p.id)));
  const ids = new Set([...planuri.map((p) => p.id), ...("santier" in t ? [t.santier] : santiereInPlus)]);

  const necesare = d.depozit.necesare.filter((n) => (n.santier !== undefined && ids.has(n.santier))
    || (cerere !== undefined && n.santier === undefined && n.fisier === cerere.nume));
  const comenzi = (d.depozit.comenzi ?? []).filter((c) => ids.has(c.spre) || (c.santier !== undefined && ids.has(c.santier)));
  const deComanda = new Set(comenzi.map((c) => c.id));

  const miscari = new Set(d.depozit.miscari.filter((m) => (m.din !== undefined && ids.has(m.din))
    || (m.spre !== undefined && ids.has(m.spre)) || (m.lucrareId !== undefined && ids.has(m.lucrareId))
    || (m.comanda !== undefined && deComanda.has(m.comanda.id))).map((m) => m.id));
  // Anularea unei mișcări șterse n-are ce anula: pleacă și ea.
  for (let schimbat = true; schimbat;) {
    schimbat = false;
    for (const m of d.depozit.miscari) {
      if (m.anuleaza !== undefined && miscari.has(m.anuleaza) && !miscari.has(m.id)) { miscari.add(m.id); schimbat = true; }
    }
  }

  const oferta = cerere ? d.oferte[cerere.id] : undefined;
  return {
    ...(cerere ? { cerere } : {}),
    ...(oferta ? { oferta } : {}),
    santiere: [...ids].map((id) => {
      const p = planuri.find((x) => x.id === id);
      return { id, denumire: p?.denumire ?? id, situatii: p?.situatii.length ?? 0, inchis: Boolean(p?.inchis) };
    }),
    necesare: necesare.map((n) => ({ id: n.id, materiale: n.materiale.length })),
    comenzi: comenzi.map((c) => ({ id: c.id, furnizor: c.furnizor, trimisa: c.trimisa !== undefined })),
    miscari: [...miscari],
    documente: (d.depozit.documente ?? []).filter((x) => deComanda.has(x.comanda)).map((x) => x.id),
  };
}

const cate = (n: number, unu: string, multe: string): string => (n === 1 ? `1 ${unu}` : `${n} ${multe}`);

/** Ce se șterge, în cuvinte, rând cu rând, pentru confirmare. */
export function rezumatStergere(s: Stergere): string[] {
  const r: string[] = [];
  if (s.cerere) r.push(`cererea „${s.cerere.nume}”`);
  if (s.oferta) r.push(`oferta ${s.oferta.numar || "fără număr"}${s.oferta.client ? ` pentru ${s.oferta.client}` : ""}, cu toate versiunile ei`);
  else if (s.cerere) r.push("ofertele salvate din ea, dacă sunt");
  for (const p of s.santiere) {
    r.push(`șantierul „${p.denumire}”${p.inchis ? " (închis)" : ""}${p.situatii ? `, cu ${cate(p.situatii, "situație de lucrări", "situații de lucrări")}` : ""}`);
  }
  for (const n of s.necesare) r.push(`necesarul de materiale (${n.materiale ? cate(n.materiale, "material", "materiale") : "gol"})`);
  if (s.comenzi.length) {
    const trimise = s.comenzi.filter((c) => c.trimisa).length;
    r.push(`${cate(s.comenzi.length, "comandă la furnizor", "comenzi la furnizori")}${trimise ? ` (${trimise === s.comenzi.length && trimise > 1 ? "toate trimise" : `${trimise} trimisă${trimise > 1 ? "e" : ""}`})` : ""}`);
  }
  if (s.miscari.length) r.push(`${cate(s.miscari.length, "mișcare de stoc", "mișcări de stoc")} (intrări, transferuri, consum, retururi)`);
  if (s.documente.length) r.push(`${cate(s.documente.length, "aviz sau factură atașată", "avize și facturi atașate")}`);
  if (s.santiere.length) r.push("pozele din măsurători trimise pe șantier, dacă sunt");
  return r;
}

/** Datele din browser fără ce s-a șters. */
export function faraStergere(d: StareDepozit, s: Stergere): StareDepozit {
  const nec = new Set(s.necesare.map((n) => n.id));
  const com = new Set(s.comenzi.map((c) => c.id));
  const mis = new Set(s.miscari);
  const doc = new Set(s.documente);
  return {
    ...d,
    miscari: d.miscari.filter((m) => !mis.has(m.id)),
    necesare: d.necesare.filter((n) => !nec.has(n.id)),
    ...(d.comenzi ? { comenzi: d.comenzi.filter((c) => !com.has(c.id)) } : {}),
    ...(d.documente ? { documente: d.documente.filter((x) => !doc.has(x.id)) } : {}),
  };
}
