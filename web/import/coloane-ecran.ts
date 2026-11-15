/**
 * Rândul discret de la verificare (planul UX, Faza 6, punctul 1): „Cantitatea
 * e în coloana F, denumirea în C” cu „schimbă”. Omul poate alege alte
 * coloane; alegerea lui se ține în cerere și pe firmă, ca la importul
 * următor cu același antet să nu mai trebuiască aleasă.
 *
 * Separat de `web/ecrane/import.ts` (ecranul doar îl montează): marcajul e pur,
 * iar starea alegerii stă aici.
 */
import {
  coloaneCitite, coloaneFoaie, literaColoana, mapareAleasa, problemaAlegerii,
} from "../../src/import/coloane.js";
import { amprentaFoaie } from "../../src/import/mapare.js";
import { reconstruieste } from "../../src/import/editare.js";
import type { MapareSalvata } from "../../src/import/cache-mapari.js";
import type { FoaieBruta } from "../../src/import/parse-workbook.js";
import { esc } from "../ecrane/tip.js";
import { salveazaAlegerea } from "./mapari-firma.js";

export interface StareColoane {
  /** Foaia, cu numele ei când fișierul are mai multe. */
  foaie: string;
  cuFoaie: boolean;
  /** Ce spune maparea; null = foaia e pe regula veche, fără coloane alese. */
  citite: { cantitate: number | null; denumire: number | null } | null;
  /** Alegerea deschisă pe foaia asta. */
  alegere?: {
    coloane: { coloana: number; litera: string; eticheta: string }[];
    cantitate: number | null;
    denumire: number | null;
    eroare: string;
  };
}

const coloana = (i: number | null): string => (i === null ? "—" : literaColoana(i));

/** Propoziția pe o foaie: unde e cantitatea și denumirea, cu „schimbă”. */
function propozitie(s: StareColoane): string {
  const pe = s.cuFoaie ? `Foaia ${esc(s.foaie)}: ` : "";
  const text = s.citite && s.citite.cantitate !== null
    ? `${pe}Cantitatea e în coloana ${coloana(s.citite.cantitate)}${
      s.citite.denumire !== null ? `, denumirea în ${coloana(s.citite.denumire)}` : ""}.`
    : `${pe}Cantitatea e luată de lângă unitatea de măsură.`;
  return `<p class="imp-coloane">${text} <button type="button" class="legatura" data-act="schimba-coloane"
    data-foaie="${esc(s.foaie)}" aria-expanded="${s.alegere ? "true" : "false"}">${s.citite ? "schimbă" : "alege coloanele"}</button></p>`;
}

function alegere(s: StareColoane): string {
  const a = s.alegere!;
  const file = (act: string, ales: number | null): string => a.coloane.map((c) =>
    `<button type="button" class="fila" data-act="${act}" data-col="${c.coloana}"${c.coloana === ales ? ' aria-current="page"' : ""}
      title="${esc(c.eticheta || `Coloana ${c.litera}`)}">${esc(c.litera)}${c.eticheta ? ` <span class="hint">${esc(c.eticheta.slice(0, 16))}</span>` : ""}</button>`,
  ).join("");
  return `<div class="imp-coloane-alege">
    <p class="imp-eticheta-control" id="col-cant">Cantitatea e în coloana</p>
    <div class="file" role="group" aria-labelledby="col-cant">${file("col-cant", a.cantitate)}</div>
    <p class="imp-eticheta-control" id="col-den">Denumirea e în coloana</p>
    <div class="file" role="group" aria-labelledby="col-den">${file("col-den", a.denumire)}</div>
    ${a.eroare ? `<p class="alerta" role="alert">${esc(a.eroare)}</p>` : ""}
    <div class="imp-formular-butoane">
      <button type="button" class="secundar" data-act="coloane-aplica"${a.cantitate === null || a.denumire === null ? " disabled" : ""}>Folosește coloanele</button>
      <button type="button" class="legatura" data-act="coloane-renunta">Renunță</button>
    </div>
  </div>`;
}

export function randColoane(stari: readonly StareColoane[]): string {
  if (stari.length === 0) return "";
  return `<div class="imp-coloane-rand">${stari.map((s) => propozitie(s) + (s.alegere ? alegere(s) : "")).join("")}</div>`;
}

export interface OptiuniControl {
  foi: () => readonly FoaieBruta[];
  /** Foile cu cel puțin o poziție: doar pe ele se arată rândul. */
  cuPozitii: () => ReadonlySet<string>;
  mapari: () => Map<string, MapareSalvata>;
  fisier: () => string;
  /** Maparea s-a schimbat: recitește, redesenează și spune, cu „Anulează”. */
  aplicat: (mesaj: string, anulare: () => void) => void;
  deseneaza: () => void;
  mesaj: (text: string) => void;
}

/** Starea alegerii și evenimentele ei; ecranul cheamă `html()` și `click()`. */
export function controlColoane(o: OptiuniControl) {
  let deschis: { foaie: string; cantitate: number | null; denumire: number | null; eroare: string } | null = null;

  const foaia = (nume: string): FoaieBruta | undefined => o.foi().find((f) => f.nume === nume);

  /** Rândurile foii refăcute din celule: o mapare veche nu lasă nimic în urmă. */
  const refa = (f: FoaieBruta): void => { for (const r of f.randuri) reconstruieste(r); };

  function puneMapare(f: FoaieBruta, m: MapareSalvata | undefined): void {
    const a = amprentaFoaie(f);
    if (m) o.mapari().set(a, m); else o.mapari().delete(a);
    for (const g of o.foi()) if (amprentaFoaie(g) === a) refa(g);
  }

  return {
    html(): string {
      const cu = o.cuPozitii();
      const foi = o.foi().filter((f) => cu.has(f.nume));
      return randColoane(foi.map((f) => {
        const m = o.mapari().get(amprentaFoaie(f))?.mapare;
        const s: StareColoane = { foaie: f.nume, cuFoaie: foi.length > 1, citite: m ? coloaneCitite(m) : null };
        if (deschis?.foaie === f.nume) {
          s.alegere = { coloane: coloaneFoaie(f), cantitate: deschis.cantitate, denumire: deschis.denumire, eroare: deschis.eroare };
        }
        return s;
      }));
    },

    /** true = evenimentul era al alegerii coloanelor. */
    click(b: HTMLElement): boolean {
      const act = b.dataset["act"];
      if (act === "schimba-coloane") {
        const nume = b.dataset["foaie"] ?? "";
        const f = foaia(nume);
        if (!f) return true;
        if (deschis?.foaie === nume) { deschis = null; o.deseneaza(); return true; }
        const m = o.mapari().get(amprentaFoaie(f))?.mapare;
        const c = m ? coloaneCitite(m) : { cantitate: null, denumire: null };
        deschis = { foaie: nume, cantitate: c.cantitate, denumire: c.denumire, eroare: "" };
        o.deseneaza();
        return true;
      }
      if (!deschis) return act === "col-cant" || act === "col-den" || act === "coloane-aplica" || act === "coloane-renunta";
      if (act === "col-cant" || act === "col-den") {
        const col = Number(b.dataset["col"]);
        if (act === "col-cant") deschis.cantitate = col; else deschis.denumire = col;
        deschis.eroare = "";
        o.deseneaza();
        return true;
      }
      if (act === "coloane-renunta") { deschis = null; o.deseneaza(); return true; }
      if (act === "coloane-aplica") {
        const d = deschis;
        const f = foaia(d.foaie);
        if (!f || d.cantitate === null || d.denumire === null) return true;
        if (d.cantitate === d.denumire) {
          d.eroare = "Cantitatea și denumirea sunt în coloane diferite: alege altă coloană pentru una dintre ele.";
          o.deseneaza();
          return true;
        }
        const a = amprentaFoaie(f);
        const veche = o.mapari().get(a);
        const mapare = mapareAleasa(f, veche?.mapare, { cantitate: d.cantitate, denumire: d.denumire });
        const problema = problemaAlegerii(f, mapare);
        if (problema) { d.eroare = problema; o.deseneaza(); return true; }
        deschis = null;
        puneMapare(f, { amprenta: a, mapare, fisier: o.fisier(), foaie: f.nume, model: "om", generat: new Date().toISOString() });
        o.aplicat("Coloanele au fost schimbate: pozițiile sunt recitite.", () => {
          puneMapare(f, veche);
          void salveazaAlegerea(f, veche?.mapare ?? null, o.fisier());
        });
        void salveazaAlegerea(f, mapare, o.fisier()).then((e) => { if (e) o.mesaj(e); });
        return true;
      }
      return false;
    },
  };
}
