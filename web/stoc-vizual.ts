/**
 * Marcajul stocului, ca functii pure: numele articolelor, cantitatile si
 * cardul „Materiale necesare" din pasul „Oferta" al importului. Ca
 * `web/import/vizual.ts`: fara DOM, testat in Node, orice text din date trece
 * prin `esc()`.
 */
import { esc, tabel } from "./ecrane/tip.js";
import { MATERIAL } from "./import/text.js";
import type { Sistem } from "../src/pricing/types.js";
import type { Categorie, Necesar } from "../src/stoc/necesar.js";
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

/** Pragul tub / placă: până la ce diametru se comandă tuburi (S12). */
export const PRAGURI_TUB: [number, string][] = [
  [90, "3 țoli (ø90), ca de obicei"], [114, "4 țoli (ø114)"], [140, "5 țoli (ø140)"], [168, "6 țoli (ø168)"],
  // Nu `Infinity`: pragul se salveaza in JSON, unde `Infinity` devine `null`.
  [9999, "toate în tuburi"],
];

const procent = (x: number): string => cifra(Math.round(x * 1000) / 10);

/**
 * Cardul din pasul „Oferta": cât material cere oferta, strat cu strat, după
 * regulile firmei, și butonul care face șantierul din ofertă.
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
    <p class="hint">„Creează șantierul” face șantierul din ofertă (pozițiile, cantitățile și prețurile ei, cu ajustarea
      și discountul de mai sus). Materialele ajung în „Materiale”, iar pe șantier se fac situațiile de lucrări.</p>
    <div class="imp-formular-butoane">
      <button type="button" class="primar" data-act="creeaza-santier">Creează șantierul</button>
    </div>
  </section>`;
}
