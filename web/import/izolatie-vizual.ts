/**
 * Ecranul „Izolația pe foaie”: lista de țevi a instalatorului, fără izolație pe
 * rând (CET Constanța). Omul alege, pe fiecare foaie, izolația din
 * specificația clientului; codul face din ea o listă de izolații, care trece
 * prin importul obișnuit (`src/import/izolatie-foaie.ts`).
 *
 * Pur: marcaj din date, ca restul ecranului de import.
 */
import { esc } from "../ecrane/tip.js";
import { TABELE, tabelDin4140Cald, type IzolatieAleasa, type TabelGrosimi } from "../../src/import/izolatie-foaie.js";

export interface FoaieCuTevi {
  nume: string;
  tevi: number;
  piese: number;
  armaturi: number;
  ignorate: number;
}

/** Cum a ales omul grosimea, ca în formular. */
export type FelGrosime = "atingere" | "cald" | "rece" | "fixa";

export interface AlegereFoaie {
  izolatie: "fara" | "vata_minerala" | "elastomer";
  grosime: FelGrosime;
  temperatura: number;
  fixa: number;
  jacheta: "aluminiu" | "inox" | "fara";
  piese: boolean;
  armaturi: boolean;
}

export const ALEGERE_INITIALA: AlegereFoaie = {
  izolatie: "fara", grosime: "atingere", temperatura: 100, fixa: 50, jacheta: "aluminiu", piese: true, armaturi: true,
};

/** Alegerea din formular, pe foaia `i`. */
export function alegereDin(d: FormData, i: number): AlegereFoaie {
  const v = (n: string): string => String(d.get(`${n}-${i}`) ?? "");
  const n = (s: string, implicit: number): number => {
    const x = Number(s.replace(",", "."));
    return Number.isFinite(x) && x > 0 ? x : implicit;
  };
  const iz = v("iz");
  const gr = v("gr");
  const ja = v("ja");
  return {
    izolatie: iz === "vata_minerala" || iz === "elastomer" ? iz : "fara",
    grosime: gr === "cald" || gr === "rece" || gr === "fixa" ? gr : "atingere",
    temperatura: n(v("t"), 100),
    fixa: n(v("mm"), 50),
    jacheta: ja === "inox" || ja === "fara" ? ja : "aluminiu",
    piese: d.get(`pi-${i}`) !== null,
    armaturi: d.get(`ar-${i}`) !== null,
  };
}

/** Alegerea omului, în forma pe care o cere `randuriIzolate`. Null = foaia nu se izolează. */
export function izolatieDin(a: AlegereFoaie): IzolatieAleasa | null {
  if (a.izolatie === "fara") return null;
  const tabel: TabelGrosimi | null = a.grosime === "atingere" ? TABELE.atingere.tabel
    : a.grosime === "rece" ? TABELE.rece.tabel
      : a.grosime === "cald" ? tabelDin4140Cald(a.temperatura) : null;
  return {
    izolatie: a.izolatie,
    grosime: tabel ? { tabel } : { fixa: a.fixa },
    jacheta: a.jacheta === "fara" ? null : a.jacheta,
    piese: a.piese,
    armaturi: a.armaturi,
  };
}

/** Câmpurile care contează pentru alegerea dată: restul nu se arată (o foaie fără izolație are un singur câmp). */
export function campuriVizibile(a: AlegereFoaie): Record<"gr" | "t" | "mm" | "ja" | "pi" | "ar", boolean> {
  const iz = a.izolatie !== "fara";
  return { gr: iz, t: iz && a.grosime === "cald", mm: iz && a.grosime === "fixa", ja: iz, pi: iz, ar: iz };
}
const ascuns = (a: AlegereFoaie, camp: keyof ReturnType<typeof campuriVizibile>): string => (campuriVizibile(a)[camp] ? "" : " hidden");

const optiune = (v: string, text: string, ales: string): string =>
  `<option value="${v}"${v === ales ? " selected" : ""}>${esc(text)}</option>`;

function cardFoaie(f: FoaieCuTevi, i: number, a: AlegereFoaie): string {
  const ce = [
    `${f.tevi} ${f.tevi === 1 ? "țeavă" : "țevi"}`,
    f.piese ? `${f.piese} coturi, teuri, reducții` : "",
    f.armaturi ? `${f.armaturi} robineți și flanșe` : "",
  ].filter(Boolean).join(" · ");
  return `<fieldset class="imp-card">
    <legend><strong>${esc(f.nume)}</strong></legend>
    <p class="hint" style="margin:0 0 12px">${esc(ce)}${f.ignorate ? ` · ${f.ignorate} rânduri care nu se izolează (șuruburi, suporți, aparate)` : ""}</p>
    <div class="imp-campuri">
      <label>Izolație<select name="iz-${i}">
        ${optiune("fara", "Fără izolație (foaia rămâne afară)", a.izolatie)}
        ${optiune("vata_minerala", "Vată minerală", a.izolatie)}
        ${optiune("elastomer", "Elastomer", a.izolatie)}
      </select></label>
      <label data-camp="gr-${i}"${ascuns(a, "gr")}>Grosimea<select name="gr-${i}">
        ${optiune("atingere", TABELE.atingere.nume, a.grosime)}
        ${optiune("cald", "La cald, după temperatură (DIN 4140, tabelul D.2)", a.grosime)}
        ${optiune("rece", TABELE.rece.nume, a.grosime)}
        ${optiune("fixa", "Aceeași grosime pe toată foaia", a.grosime)}
      </select></label>
      <label data-camp="t-${i}"${ascuns(a, "t")}>Temperatura de lucru, °C<input name="t-${i}" type="number" inputmode="decimal" min="0" step="any" value="${a.temperatura}" /></label>
      <label data-camp="mm-${i}"${ascuns(a, "mm")}>Grosimea, mm<input name="mm-${i}" type="number" inputmode="decimal" min="0" step="any" value="${a.fixa}" /></label>
      <label data-camp="ja-${i}"${ascuns(a, "ja")}>Protecție<select name="ja-${i}">
        ${optiune("aluminiu", "Tablă de aluminiu", a.jacheta)}
        ${optiune("inox", "Tablă de inox", a.jacheta)}
        ${optiune("fara", "Fără protecție", a.jacheta)}
      </select></label>
      <label data-camp="pi-${i}"${ascuns(a, "pi")}><input type="checkbox" name="pi-${i}"${a.piese ? " checked" : ""} /> Coturi, teuri și reducții</label>
      <label data-camp="ar-${i}"${ascuns(a, "ar")}><input type="checkbox" name="ar-${i}"${a.armaturi ? " checked" : ""} /> Robineți și flanșe, ca casete</label>
    </div>
  </fieldset>`;
}

/**
 * Pasul dintre fișier și verificare: fișierul n-are nicio poziție de izolație,
 * dar are foi cu liste de țevi. Fiecare foaie primește izolația ei.
 */
export function ecranIzolatieFoaie(o: { fisier: string; foi: FoaieCuTevi[]; alegeri: AlegereFoaie[]; eroare?: string }): string {
  return `<form class="imp-izolatie-foaie" id="izolatie-foaie">
    <section class="imp-card">
      <h2>${esc(o.fisier)}: listă de țevi, fără izolație pe rând</h2>
      <p class="hint" style="margin:0">Fișierul are ${o.foi.length === 1 ? "o foaie" : `${o.foi.length} foi`} cu țevi și piese, dar niciun rând
        nu spune izolația: ea e în specificația clientului, pe sistem. Alege izolația pe fiecare foaie, ca acolo. Grosimea din tabel urcă la
        următoarea din lista noastră (14 mm → elastomer 19); peste listă, poziția iese „De verificat”. Coturile fără protecție sub ø60
        nu se pun separat: lista nu le tarifează, intră în prețul pe metru.</p>
    </section>
    ${o.foi.map((f, i) => cardFoaie(f, i, o.alegeri[i] ?? ALEGERE_INITIALA)).join("")}
    ${o.eroare ? `<p class="alerta" role="alert">${esc(o.eroare)}</p>` : ""}
    <div class="imp-formular-butoane">
      <button type="submit" class="primar">Fă lista de izolații</button>
      <button type="button" class="secundar" data-act="renunta-izolatie">Alt fișier</button>
    </div>
  </form>`;
}
