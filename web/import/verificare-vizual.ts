import type { LinieProcesata } from "../../src/import/nucleu.js";
import type { LinieExtrasa } from "../../src/import/schema.js";
import { esc, eur } from "../ecrane/tip.js";
import { celulaNumar, celulaText, numarInCelula } from "../celula.js";
import type { DocumentOferta, PozitieOferta } from "../document-oferta.js";
import type { OptiuniDocument } from "./oferta-vizual.js";
import { FORME_EDITOR, GROSIMI, MATERIAL, MATERIALE, ajutorDiametru, type Sistem } from "./text.js";
import { actiuniPozitie, starePozitie } from "./vizual.js";

/**
 * Tabul „Verificare” (Andrei, 21 octombrie 2026): ce a înțeles aplicația din
 * fiecare rând al cererii, pe care angajatul îl verifică și îl corectează.
 *
 * Un rând pe două niveluri. Sus: rândul din fișier, codul, descrierea
 * clientului și starea. Dedesubt, pe o linie: câmpurile înțelese (izolația,
 * grosimea, protecția, diametrul, piesa, cantitatea cu UM-ul ei, prețul), toate casete de
 * aceeași înălțime, cu butoanele pe aceeași linie. Înainte, ce am înțeles stătea
 * în pastile sub descriere („Vată minerală 50 mm · ø114 în listă”), iar
 * „Modifică” și ✕ nu erau în dreptul casetelor.
 *
 * Câmpurile se scriu pe loc; schimbate, poziția devine a omului (ca o corectură
 * din editor). Fără alt buton de „mai mult” (Andrei: un buton fără rost):
 * prețul scris în casetă e prețul pus de mână, descrierea e denumirea din ofertă.
 *
 * Pur, fără DOM: testat în Node.
 */

const JACHETE = new Set<Sistem>(["tabla", "tabla_inox", "pvc"]);

/** Protecția, cu grosimea în aceeași alegere: la inox grosimea schimbă prețul, la aluminiu lista o știe. */
const PROTECTII: [string, string][] = [
  ["", "Fără"],
  ["tabla|", "Tablă aluminiu"],
  ...GROSIMI.tabla!.map((g): [string, string] => [`tabla|${g}`, `Tablă aluminiu ${numarInCelula(g)} mm`]),
  ...GROSIMI.tabla_inox!.map((g): [string, string] => [`tabla_inox|${g}`, `Tablă inox ${numarInCelula(g)} mm`]),
  ["tabla_inox|", "Tablă inox"],
  ["pvc|", "Manta PVC"],
];

const NOTATII: [NonNullable<LinieExtrasa["diametru_tip"]>, string][] = [["DN", "DN"], ["exterior", "Ø"], ["interior", "Di"]];

/** Jacheta de pe poziție, ca valoare a listei „Protecție”: „tabla|0.8”, „tabla_inox|0.5”, „” fără. */
function protectieDin(e: LinieExtrasa): string {
  const j = e.straturi_extra.find((s) => JACHETE.has(s.sistem));
  return j ? `${j.sistem}|${j.grosime_mm ?? ""}` : "";
}

const numarSau = (v: string): number | null => {
  const s = v.trim().replace(",", ".");
  return s === "" || !Number.isFinite(Number(s)) ? null : Number(s);
};

/**
 * Corectura dintr-un câmp al rândului, ca `patch` peste extragere. Protecția
 * înlocuiește doar jacheta: straturile de izolație de la mijloc (elastomer +
 * vată, NISAL) rămân. Un diametru scris fără notație e Ø.
 */
export function patchDinCamp(e: LinieExtrasa, camp: string, valoare: string): Partial<LinieExtrasa> {
  switch (camp) {
    case "sistem": return { sistem: (valoare || null) as LinieExtrasa["sistem"] };
    case "grosime": return { grosime_mm: numarSau(valoare) };
    case "forma": return { forma: (valoare || null) as LinieExtrasa["forma"] };
    case "diam_tip": return { diametru_tip: valoare as LinieExtrasa["diametru_tip"] };
    case "diam": {
      const d = numarSau(valoare);
      return d === null ? { diametru_valoare: null, diametru_tip: null } : { diametru_valoare: d, diametru_tip: e.diametru_tip ?? "exterior" };
    }
    case "gol_l": return { gol_latime_mm: numarSau(valoare) };
    case "gol_h": return { gol_inaltime_mm: numarSau(valoare) };
    case "protectie": {
      const [s, g] = valoare.split("|");
      const izolatii = e.straturi_extra.filter((x) => !JACHETE.has(x.sistem));
      return { straturi_extra: s ? [...izolatii, { sistem: s as Sistem, grosime_mm: numarSau(g ?? "") }] : izolatii };
    }
    default: return {};
  }
}

/** O casetă cu eticheta deasupra; `clasa` îi dă lățimea. */
const camp = (eticheta: string, control: string, clasa: string): string =>
  `<label class="ver-camp ${clasa}"><span>${eticheta}</span>${control}</label>`;

const select = (nume: string, idx: number, eticheta: string, optiuni: [string, string][], ales: string): string => {
  const lista = optiuni.some(([v]) => v === ales) ? optiuni : [...optiuni, [ales, ales] as [string, string]];
  return `<select data-vc="${nume}" data-idx="${idx}" aria-label="${esc(eticheta)}">${lista.map(([v, t]) =>
    `<option value="${esc(v)}"${v === ales ? " selected" : ""}>${esc(t)}</option>`).join("")}</select>`;
};

/** Grosimea și diametrul se scriu pe loc, ca cantitatea și prețul (`legaCelule`). */
const numarPeLoc = (ed: string, idx: number, valoare: number | null, eticheta: string, gol = ""): string =>
  celulaNumar({ ed, valoare, eticheta, ...(gol ? { gol } : {}), date: { idx } });

function campuri(p: PozitieOferta, l: LinieProcesata, o: OptiuniDocument): string {
  const e = l.extras;
  const i = e.index;
  const cine = p.nr === null ? `rândul ${p.sursa.rand}` : `poziția ${p.nr}`;
  const s = o.schimbari?.(p) ?? {};
  const material = camp("Izolație", select("sistem", i, `Izolația, ${cine}`,
    [...MATERIALE.map((m): [string, string] => [m, MATERIAL[m]]), ["", "Nu e izolație"]], e.sistem ?? ""),
    e.sistem === "goluri_foc" ? "ver-c-material ver-c-lat" : "ver-c-material");
  const gol = e.sistem === "goluri_foc";
  const tehnice = gol
    ? camp("Lățime gol (mm)", numarPeLoc("gol_l", i, e.gol_latime_mm, `Lățimea golului, ${cine}`), "ver-c-gol")
      + camp("Înălțime gol (mm)", numarPeLoc("gol_h", i, e.gol_inaltime_mm, `Înălțimea golului, ${cine}`), "ver-c-gol")
    : camp("Grosime (mm)", numarPeLoc("gros", i, e.grosime_mm, `Grosimea, ${cine}`, "—"), "ver-c-mic")
      + camp("Protecție", select("protectie", i, `Protecția, ${cine}`, PROTECTII, protectieDin(e)), "ver-c-protectie")
      + `<div class="ver-camp ver-c-diametru"><span id="ver-d-${i}">Diametru</span><div class="ver-diametru"${
        ajutorDiametru(l) ? ` title="${esc(ajutorDiametru(l))}"` : ""}>${
        select("diam_tip", i, `Notația diametrului, ${cine}`, NOTATII, e.diametru_tip ?? "exterior")}${
        numarPeLoc("diam", i, e.diametru_valoare, `Diametrul, ${cine}`, "—")}</div></div>`
      + camp("Piesă", select("forma", i, `Piesa, ${cine}`, FORME_EDITOR, e.forma ?? "ml"), "ver-c-piesa");
  const cantitate = celulaNumar({ ed: "cant", valoare: p.cantitate, eticheta: `Cantitate, ${cine}`,
    schimbat: s.cant !== undefined, ...(s.cant !== undefined ? { inainte: s.cant } : {}), date: { idx: i } });
  const pret = celulaNumar({ ed: "pret", valoare: p.pretUnitar, eticheta: `Preț unitar, ${cine}`, gol: "fără preț",
    schimbat: s.pret !== undefined, ...(s.pret !== undefined ? { inainte: s.pret } : {}), date: { idx: i } });
  return `<div class="ver-campuri">
    ${material}${tehnice}
    ${camp(`Cantitate${p.um ? ` (${esc(p.um)})` : ""}`, cantitate, "ver-c-numar")}
    ${camp("Preț unitar €", pret, "ver-c-numar")}
    <div class="ver-camp ver-c-total"><span>Total €</span><output>${p.valoare === null ? "—" : eur(p.valoare)}</output></div>
    <div class="ver-actiuni">${actiuniPozitie(l, o.propunere(l), false, false)}
      <button type="button" class="cel-scoate" data-act="scoate-pozitie" data-idx="${i}"
        aria-label="Scoate ${cine} din ofertă" title="Scoate din ofertă">✕</button></div>
  </div>`;
}

function randVerificare(p: PozitieOferta, o: OptiuniDocument): string {
  const l = o.linii.get(p.linie)!;
  const s = o.schimbari?.(p) ?? {};
  const cine = p.nr === null ? `rândul ${p.sursa.rand}` : `poziția ${p.nr}`;
  const text = celulaText({ ed: "den", text: p.textClient, eticheta: `Descrierea, ${cine}`, clasa: "ver-text",
    schimbat: s.den !== undefined, ...(s.den !== undefined ? { inainte: s.den } : {}), date: { idx: p.linie } });
  return `<article class="ver-poz" data-idx="${p.linie}" data-stare="${p.stare}">
    <div class="ver-sus">
      <p class="ver-rand">Rândul ${p.sursa.rand}${p.cod ? `<span>${esc(p.cod)}</span>` : ""}</p>
      ${text}
      <div class="ver-stare">${starePozitie(l)}</div>
    </div>
    ${campuri(p, l, o)}
  </article>`;
}

/** Tabul „Verificare”: pozițiile pe capitolele clientului, toate (și cele care nu intră încă în ofertă). */
export function verificarePeEcran(d: DocumentOferta, o: OptiuniDocument): string {
  const vede = (p: PozitieOferta): boolean => o.vizibile === null || o.vizibile.has(p.linie);
  const corp = d.capitole.map((cap) => {
    const vazute = cap.pozitii.filter(vede);
    if (vazute.length === 0) return "";
    return `${cap.titlu ? `<h3 class="ver-capitol">${esc(cap.titlu)}</h3>` : ""}${vazute.map((p) => randVerificare(p, o)).join("")}`;
  }).join("");
  return `<section class="imp-card ver" aria-label="Verificare">
    ${corp || `<p class="imp-gol">Nicio poziție aici.</p>`}
  </section>`;
}
