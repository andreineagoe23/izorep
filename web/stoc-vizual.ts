/**
 * Marcajul stocului, ca functii pure: numele articolelor, cantitatile si
 * cardul „Materiale necesare" din pasul „Oferta" al importului. Ca
 * `web/import/vizual.ts`: fara DOM, testat in Node, orice text din date trece
 * prin `esc()`.
 */
import { esc, stare, tabel } from "./ecrane/tip.js";
import { MATERIAL } from "./import/text.js";
import type { Sistem } from "../src/pricing/types.js";
import type { Categorie, MaterialNecesar, Necesar } from "../src/stoc/necesar.js";
import type { DeComandatSantier } from "../src/stoc/comenzi.js";
import { articolDin, formaArticol, type UM } from "../src/stoc/registru.js";

/** 50 → „50", 0.8 → „0,8", 12.345 → „12,35". */
export const cifra = (n: number): string => n.toLocaleString("ro-RO", { maximumFractionDigits: 2 });

export const unitate = (um: UM): string => (um === "ml" ? "ml" : "m²");

export const cantitate = (n: number, um: UM): string => `${cifra(n)} ${unitate(um)}`;

/** Cum se numește forma în care se cumpără, pentru om. */
const NUME_FORMA: Record<Categorie, string> = { tub: "tub", saltea: "saltea, m²", placa: "placă, m²", tabla: "m²" };

/**
 * „Vată minerală 50 mm · tub ø114", „Vată minerală 50 mm · saltea, m²",
 * „Elastomer 19 mm · placă, m²", „Tablă aluminiu 0,8 mm · m²". Cochilia de
 * vată și tubul de elastomer au ø; saltelele, plăcile și tabla se cumpără pe
 * suprafață.
 */
export function numeArticol(a: {
  sistem: string; grosime_mm: number | null; rand: number | null; marca?: string; forma?: Categorie; categorie?: Categorie;
}): string {
  const material = MATERIAL[a.sistem as Sistem] ?? a.sistem;
  const grosime = a.grosime_mm !== null ? ` ${cifra(a.grosime_mm)} mm` : "";
  const forma = a.categorie ?? formaArticol(a);
  const cum = forma === "tub" && a.rand !== null ? `tub ø${a.rand}` : NUME_FORMA[forma];
  return `${material}${grosime} · ${cum}${a.marca ? ` · ${a.marca}` : ""}`;
}

/**
 * Filele ecranului „Materiale” (21 octombrie 2026): fiecare răspunde la o
 * singură întrebare (ce lipsește, ce așteptăm, ce avem). Sunt linkuri, deci
 * „Înapoi” din browser și adresa merg; cifra spune câte lucruri sunt de făcut.
 */
export function fileMateriale(activ: "materiale" | "comenzi" | "depozit", n: { deCumparat: number; comenzi: number }): string {
  const fila = (id: string, eticheta: string, numar?: number): string =>
    `<a href="#/${id}" class="fila"${id === activ ? ' aria-current="page"' : ""}>${eticheta}${numar ? ` <b>${cifra(numar)}</b>` : ""}</a>`;
  return `<nav class="file" aria-label="Materiale">${fila("materiale", "De cumpărat", n.deCumparat)}${
    fila("comenzi", "Comenzi", n.comenzi)}${fila("depozit", "Depozit")}</nav>`;
}

/** Ce e un material pe listă, pentru om: clientul îl dă, lipsește, e în ciornă, vine, sau e tot. */
export type FelMaterial = "client" | "lipsa" | "ciorna" | "vine" | "gata";

export function felMaterial(m: Pick<MaterialNecesar, "alClientului">, d: DeComandatSantier | undefined): FelMaterial {
  if (m.alClientului || !d) return "client";
  if (d.ramas > 0) return "lipsa";
  if (d.inCiorna > 0) return "ciorna";
  if (d.comandat > 0) return "vine";
  return "gata";
}

/**
 * Starea unui material, în cuvintele omului: ce lipsește, ce vine, ce e gata.
 * Aceeași în Materiale › De cumpărat și pe fila Materiale a lucrării.
 */
export function stareMaterial(m: Pick<MaterialNecesar, "alClientului">, d: DeComandatSantier | undefined): string {
  const um = d?.articol.um ?? "ml";
  switch (felMaterial(m, d)) {
    case "client": return stare("Îl dă clientul", "neutru");
    case "lipsa": return `${stare(`Lipsește ${cantitate(d!.ramas, um)}`, "atentie")}${
      d!.comandat > 0 ? `<br><span class="hint">${cantitate(d!.comandat, um)} comandat, vine</span>` : ""}`;
    case "ciorna": return stare("În ciornă, de trimis", "atentie");
    case "vine": return stare(`Comandat, vine ${cantitate(d!.comandat, um)}`, "neutru");
    case "gata": return stare("Are tot", "ok");
  }
}

/** „14 materiale: 13 lipsesc, 1 e comandat și vine.” */
export function propozitieMateriale(materiale: readonly MaterialNecesar[], r: readonly DeComandatSantier[]): string {
  const pe = new Map(r.map((d) => [d.material, d]));
  const n: Record<FelMaterial, number> = { client: 0, lipsa: 0, ciorna: 0, vine: 0, gata: 0 };
  for (const m of materiale) n[felMaterial(m, pe.get(m))]++;
  const parti = [
    n.lipsa ? `<strong>${n.lipsa === 1 ? "1 lipsește" : `${cifra(n.lipsa)} lipsesc`}</strong>` : "",
    n.ciorna ? `${n.ciorna === 1 ? "1 e pe o comandă netrimisă" : `${cifra(n.ciorna)} sunt pe comenzi netrimise`}` : "",
    n.vine ? `${n.vine === 1 ? "1 e comandat și vine" : `${cifra(n.vine)} sunt comandate și vin`}` : "",
    n.gata ? `${n.gata === 1 ? "1 e pe șantier" : `${cifra(n.gata)} sunt pe șantier`}` : "",
    n.client ? `${n.client === 1 ? "1 îl dă clientul" : `${cifra(n.client)} le dă clientul`}` : "",
  ].filter(Boolean);
  const total = materiale.length;
  return `${total === 1 ? "Un material" : `${cifra(total)} materiale`}: ${parti.join(", ")}.`;
}

/** Pragul tub / placă: până la ce diametru se comandă tuburi (S12). */
export const PRAGURI_TUB: [number, string][] = [
  [90, "3 țoli (ø90), ca de obicei"], [114, "4 țoli (ø114)"], [140, "5 țoli (ø140)"], [168, "6 țoli (ø168)"],
  // Nu `Infinity`: pragul se salveaza in JSON, unde `Infinity` devine `null`.
  [9999, "toate în tuburi"],
];

const procent = (x: number): string => cifra(Math.round(x * 1000) / 10);

/**
 * Regulile de calcul ale listei de materiale: cât material cere oferta, strat
 * cu strat, după regulile firmei. Până pe 14 noiembrie 2026 stătea în pasul
 * „Oferta”, cu „Creează șantierul”; acum e „Schimbă regulile de calcul” pe fila
 * Materiale a lucrării, iar butonul reface lista cu regulile scrise.
 */
export function cardNecesar(n: Necesar): string {
  const randuri = n.materiale.map((m) => {
    const um = articolDin(m).um;
    const seComanda = um === "ml" ? m.ml : m.m2;
    return `<tr>
      <td>${esc(numeArticol(m))}</td>
      <td class="n"><strong>${cantitate(seComanda, um)}</strong>${m.kg !== undefined ? `<br><span class="hint">${cifra(m.kg)} kg</span>` : ""}</td>
      <td class="n">${m.ml > 0 ? cantitate(m.ml, "ml") : "—"}</td>
      <td class="n">${m.piese > 0 ? `${cifra(m.piese)} buc.${m.piesePresupuse > 0 ? `<br><span class="hint">${cifra(m.piesePresupuse)} pe regulă presupusă</span>` : ""}` : "—"}</td>
    </tr>`;
  });
  const fara = n.faraNecesar.length;
  const presupuse = n.materiale.some((m) => m.piesePresupuse > 0);
  const camp = (cat: Categorie, eticheta: string): string =>
    `<label>${eticheta}<input type="text" inputmode="decimal" autocomplete="off" data-act="pierdere" data-cat="${cat}" value="${procent(n.pierderi[cat])}" /></label>`;
  // Peste prag, firma comandă de obicei saltea sau placă; pe unele lucrări tot
  // tub (TRANSAVIA: cochilii ø116, ø140, ø168). Alegerea e pe diametru.
  const pestePrag = n.pestePrag.length > 0 ? `<fieldset class="imp-segment">
      <legend>Peste prag, comandă tot tuburi la</legend>
      <div>${n.pestePrag.map((d) => `<label><input type="checkbox" data-act="tub-peste" value="${d}"${
        n.tuburiPeste.includes(d) ? " checked" : ""} /><span>ø${d}</span></label>`).join("")}</div>
    </fieldset>` : "";
  return `<section class="imp-card" id="necesar">
    <h2>Materiale de comandat</h2>
    <p class="hint">Pentru pozițiile din ofertă. Până la pragul de mai jos se comandă tuburi, pe diametru și grosime;
      peste el, saltele de vată sau plăci de elastomer, în m². Coturile, teurile, flanșele și casetele sunt incluse, trecute în metri de țeavă (3 piese pe
      metru până la ø140, 2 la ø159–168, una de la ø219). Tabla, în m² și în kg.${presupuse
        ? " Sub 3 țoli și peste ø273 regula pieselor e presupusă: verifică la prima comandă." : ""}</p>
    <div class="imp-campuri">
      <label>Tuburi până la
        <select id="prag-tub">${PRAGURI_TUB.map(([v, t]) =>
          `<option value="${v}"${v === n.pragTub ? " selected" : ""}>${t}</option>`).join("")}</select>
      </label>
      ${camp("tabla", "Pierderi la tablă (%)")}
      ${camp("saltea", "Pierderi la saltele (%)")}
      ${camp("placa", "Pierderi la plăci (%)")}
      ${camp("tub", "Pierderi la tuburi (%)")}
    </div>
    ${pestePrag}
    ${n.materiale.length
      ? tabel(["Material", "Se comandă", "Metri de țeavă", "Din piese"], randuri, ["", "n", "n", "n"])
      : `<p class="nota">Nicio poziție cu preț din liste: nu e nimic de calculat.</p>`}
    ${fara > 0 ? `<p class="hint">${fara === 1 ? "O poziție nu are" : `${fara} poziții nu au`} necesar calculat
      (preț pus de mână sau închideri la foc): materialul lor se adaugă de mână, în „Materiale”.</p>` : ""}
    <p class="hint">„Refă lista” pune pe șantier lista calculată cu regulile de mai sus. Ce ai schimbat de mână pe
      listă (cantități, „Îl dă clientul”, materialul adăugat) rămâne.</p>
    <div class="imp-formular-butoane">
      <button type="button" class="primar" data-act="refa-lista">Refă lista</button>
      <button type="button" class="secundar" data-act="reguli-renunta">Renunță</button>
    </div>
  </section>`;
}
