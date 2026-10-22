import type { LinieProcesata } from "../../src/import/nucleu.js";
import type { LinieExtrasa } from "../../src/import/schema.js";
import type { StratTarifat } from "../../src/pricing/types.js";
import { esc } from "../ecrane/tip.js";
import { celulaNumar, celulaText, numarInCelula } from "../celula.js";
import type { DocumentOferta, PozitieOferta } from "../document-oferta.js";
import type { OptiuniDocument } from "./oferta-vizual.js";
import { FORME_EDITOR, GROSIMI, MATERIAL, MATERIALE, MOTIV, STARE, ajutorDiametru, motiveLinie, stareLinie, type Sistem } from "./text.js";
import { actiuniPozitie } from "./vizual.js";

/**
 * Tabul „Verificare” (Andrei, 21 octombrie 2026): ce a înțeles aplicația din
 * fiecare rând al cererii, pe care angajatul îl verifică și îl corectează.
 *
 * Un tabel ca foaia Excel: pe fiecare rând descrierea clientului, apoi ce am
 * înțeles din ea (izolația, grosimea, protecția, diametrul, piesa), UM-ul,
 * cantitatea, prețul și starea, toate casete de aceeași înălțime, cu butoanele
 * pe aceeași linie. Fără total pe rând: îl arată „Cum iese oferta”, iar
 * descrierea are nevoie de loc la 1440 px. Al doilea strat de izolație
 * (elastomer + vată, NISAL) stă sub primul, cu grosimea lui sub grosime. Înainte, ce am înțeles stătea în pastile sub
 * descriere („Vată minerală 50 mm · ø114 în listă”).
 *
 * Totul se scrie pe loc. Descrierea e celula din fișierul clientului: schimbată
 * („DN100” → „DN50”), rândul se recitește și se retarifează la fiecare tastă.
 * O casetă schimbată face poziția a omului (ca o corectură din editor); prețul
 * scris e prețul pus de mână. Fără butoane „mai mult” (Andrei: fără rost).
 *
 * Pur, fără DOM: testat în Node.
 */

export const JACHETE = new Set<Sistem>(["tabla", "tabla_inox", "pvc"]);
/** Câte straturi poate avea un rând: izolația, cele de sub protecție și protecția (Andrei, 22 octombrie 2026). */
export const STRATURI_MAXIM = 4;
/** Ce poate sta sub jachetă, ca strat în plus: izolațiile. */
const IZOLATII = MATERIALE.filter((m) => !JACHETE.has(m) && m !== "goluri_foc");
/** UM-urile pe care le citește importul; un UM scris altfel de client rămâne în listă. */
const UM: [string, string][] = [["ml", "ml"], ["buc", "buc"], ["mp", "m²"]];

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
  // Strat nou de izolație, sub protecție: vată, cu grosimea de scris (Andrei, 22 octombrie 2026).
  // Primul strat scos: următoarea izolație îi ia locul, cu grosimea ei; protecția rămâne.
  if (camp === "scoate-primul") {
    const k = e.straturi_extra.findIndex((x) => !JACHETE.has(x.sistem));
    if (k < 0) return {};
    const urm = e.straturi_extra[k]!;
    return { sistem: urm.sistem, grosime_mm: urm.grosime_mm, straturi_extra: e.straturi_extra.filter((_, j) => j !== k) };
  }
  if (camp === "adauga-strat") {
    if (1 + e.straturi_extra.length >= STRATURI_MAXIM) return {};
    const izolatii = e.straturi_extra.filter((x) => !JACHETE.has(x.sistem));
    const jachete = e.straturi_extra.filter((x) => JACHETE.has(x.sistem));
    return { straturi_extra: [...izolatii, { sistem: "vata_minerala", grosime_mm: null }, ...jachete] };
  }
  // Un strat din mijloc: „strat0” e izolația lui („” îl scoate), „stratg0” grosimea.
  const strat = /^strat(g?)(\d+)$/.exec(camp);
  if (strat) {
    const k = Number(strat[2]);
    return {
      straturi_extra: e.straturi_extra.flatMap((x, j) => (j !== k ? [x]
        : strat[1] ? [{ ...x, grosime_mm: numarSau(valoare) }]
        : valoare ? [{ sistem: valoare as Sistem, grosime_mm: x.grosime_mm }] : [])),
    };
  }
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

const select = (nume: string, idx: number, eticheta: string, optiuni: [string, string][], ales: string): string => {
  const lista = optiuni.some(([v]) => v === ales) ? optiuni : [...optiuni, [ales, ales] as [string, string]];
  return `<select data-vc="${nume}" data-idx="${idx}" aria-label="${esc(eticheta)}">${lista.map(([v, t]) =>
    `<option value="${esc(v)}"${v === ales ? " selected" : ""}>${esc(t)}</option>`).join("")}</select>`;
};

/** Grosimea și diametrul se scriu pe loc, ca cantitatea și prețul (`legaCelule`). */
const numarPeLoc = (ed: string, idx: number, valoare: number | null, eticheta: string, gol = ""): string =>
  celulaNumar({ ed, valoare, eticheta, ...(gol ? { gol } : {}), date: { idx } });

/** O valoare a rândului, arătată pe sub-rândul stratului: aceeași casetă, fără scris. */
const fix = (v: string, titlu = ""): string =>
  `<span class="ver-fix"${titlu ? ` title="${esc(titlu)}"` : ""}>${esc(v)}</span>`;
const SUB_STRAT = fix("—", "Protecția stă pe stratul de deasupra");
/** Prețul unui strat (cu multiplicatorul piesei), plus protecția pusă peste el. */
function pretStrat(t: StratTarifat | undefined, peste: (StratTarifat | undefined)[] = []): string {
  const toate = [t, ...peste];
  if (toate.some((x) => !x)) return fix("—");
  const v = toate.reduce((s, x) => s + (x!.inclus ? Math.round(x!.pret_unitar * x!.multiplicator * 100) / 100 : 0), 0);
  return fix(v.toFixed(2).replace(".", ","), t!.inclus ? "" : "Stratul ăsta nu intră în prețul piesei (regula firmei)");
}

/** Capul tabelului; pe ecran îngust, același text e eticheta din card (`data-eticheta`). */
interface Coloane { gros: string; prot: string }

/**
 * Starea, în coloana ei: pe linia casetelor butonul care o rezolvă („Confirmă”,
 * „Pune 50 mm”) sau, gata, cuvântul ei, apoi lista rândului; motivul, mărunt,
 * dedesubt. Meniul „⋯” ține locul vechiului ✕ (Andrei, 22 octombrie 2026: fără loc
 * pentru încă un buton): „Adaugă un strat” (până la 4) sau „Scoate rândul din ofertă”.
 * Meniu al nostru, nu listă nativă: aceea se deschidea mare, în stilul sistemului.
 */
function stare(l: LinieProcesata, propunere: number | null, cine: string): string {
  const st = stareLinie(l);
  const actiune = actiuniPozitie(l, propunere, false, false);
  const motive = motiveLinie(l).map((m) => MOTIV[m]);
  const e = l.extras;
  const areStraturi = e.straturi_extra.some((x) => !JACHETE.has(x.sistem));
  const poateStrat = e.sistem !== null && e.sistem !== "goluri_foc" && 1 + e.straturi_extra.length < STRATURI_MAXIM;
  return `<div class="ver-actiuni">${actiune || `<span class="imp-stare" data-stare="${st}">${STARE[st]}</span>`}
      <div class="cel-meniu-loc">
        <button type="button" class="cel-meniu" data-act="meniu-rand" data-idx="${e.index}" aria-haspopup="menu" aria-expanded="false"
          aria-label="${esc(`Ce faci cu ${cine}`)}" title="Adaugă un strat sau scoate rândul">⋯</button>
        <div class="meniu-rand" role="menu" hidden>
          <button type="button" role="menuitem" data-act="strat-nou" data-idx="${e.index}"${poateStrat ? "" : " disabled"}>${
            poateStrat ? "Adaugă un strat" : `Adaugă un strat (cel mult ${STRATURI_MAXIM})`}</button>
          ${areStraturi ? `<button type="button" role="menuitem" data-act="scoate-primul" data-idx="${e.index}">Scoate stratul 1</button>` : ""}
          <button type="button" role="menuitem" data-act="scoate-pozitie" data-idx="${e.index}">Scoate rândul din ofertă</button>
        </div>
      </div></div>
    ${motive.length ? `<p class="ver-motiv">${esc(motive.join(" · "))}</p>` : ""}`;
}

function randVerificare(p: PozitieOferta, o: OptiuniDocument, c: Coloane): string {
  const l = o.linii.get(p.linie)!;
  const e = l.extras;
  const i = e.index;
  const s = o.schimbari?.(p) ?? {};
  const cine = p.nr === null ? `rândul ${p.sursa.rand}` : `poziția ${p.nr}`;
  // Descrierea e celula din fișierul clientului: scrisă, rândul se recitește pe loc.
  const cel = o.descriere?.(l);
  const text = cel
    ? celulaText({ ed: "desc", text: cel.text, eticheta: `Descrierea, ${cine}`, clasa: "ver-text",
      date: { idx: i, foaie: p.sursa.foaie, rand: p.sursa.rand, cel: cel.cel } })
    : `<p class="ver-text">${esc(p.textClient)}</p>`;
  const gol = e.sistem === "goluri_foc";
  const td = (eticheta: string, continut: string, clasa = ""): string =>
    `<td${clasa ? ` class="${clasa}"` : ""} data-eticheta="${esc(eticheta)}">${continut}</td>`;
  const material = select("sistem", i, `Izolația, ${cine}`,
    [...MATERIALE.map((m): [string, string] => [m, MATERIAL[m]]), ["", "Nu e izolație"]], e.sistem ?? "");
  // Straturile de izolație de sub protecție, peste primul: fiecare e un sub-rând
  // întreg (Andrei, 22 octombrie 2026), cu protecția pe cel de deasupra.
  const mijloc = e.straturi_extra.flatMap((x, k) => (JACHETE.has(x.sistem) ? [] : [{ x, k }]));
  const protectie = select("protectie", i, `Protecția, ${cine}`, PROTECTII, protectieDin(e));
  const celUm = o.um?.(l);
  const um = celUm
    ? `<select data-um="1" data-idx="${i}" aria-label="${esc(`UM, ${cine}`)}">${
      (UM.some(([v]) => v === celUm.v.trim()) ? UM : [...UM, [celUm.v.trim(), celUm.v.trim()] as [string, string]])
        .map(([v, t]) => `<option value="${esc(v)}"${v === celUm.v.trim() ? " selected" : ""}>${esc(t)}</option>`).join("")}</select>`
    : "";
  // Straturile tarifate, pe ordinea din extragere: primul, apoi cele în plus.
  const tarifate = l.pret && "straturi" in l.pret ? l.pret.straturi : [];
  const pe: (StratTarifat | undefined)[] = [e.sistem, ...e.straturi_extra.map((x) => x.sistem)]
    .map((sis, k) => (tarifate[k]?.sistem === sis ? tarifate[k] : undefined));
  const jachete = e.straturi_extra.flatMap((x, k) => (JACHETE.has(x.sistem) ? [pe[k + 1]] : []));
  const cantitate = celulaNumar({ ed: "cant", valoare: p.cantitate, eticheta: `Cantitate, ${cine}`,
    schimbat: s.cant !== undefined, ...(s.cant !== undefined ? { inainte: s.cant } : {}), date: { idx: i } });
  const pret = celulaNumar({ ed: "pret", valoare: p.pretUnitar, eticheta: `Preț unitar, ${cine}`, gol: "fără preț",
    schimbat: s.pret !== undefined, ...(s.pret !== undefined ? { inainte: s.pret } : {}), date: { idx: i } });
  return `<tr class="ver-poz" data-idx="${i}" data-stare="${p.stare}">
    <td class="ver-rand" data-eticheta="Rândul">${p.sursa.rand}</td>
    <td class="ver-desc">${text}${p.cod ? `<span class="ver-cod">${esc(p.cod)}</span>` : ""}</td>
    ${td("Izolație", material)}
    ${gol
      ? td("Lățime gol (mm)", numarPeLoc("gol_l", i, e.gol_latime_mm, `Lățimea golului, ${cine}`, "lățime"))
        + td("Înălțime gol (mm)", numarPeLoc("gol_h", i, e.gol_inaltime_mm, `Înălțimea golului, ${cine}`, "înălțime"))
        + td("Diametru", "") + td("Piesă", "")
      : td(c.gros, numarPeLoc("gros", i, e.grosime_mm, `Grosimea, ${cine}`, "—"))
        + td(c.prot, mijloc.length ? SUB_STRAT : protectie)
        + td("Diametru", `<div class="ver-diametru"${ajutorDiametru(l) ? ` title="${esc(ajutorDiametru(l))}"` : ""}>${
          select("diam_tip", i, `Notația diametrului, ${cine}`, NOTATII, e.diametru_tip ?? "exterior")}${
          numarPeLoc("diam", i, e.diametru_valoare, `Diametrul, ${cine}`, "—")}</div>`)
        + td("Piesă", select("forma", i, `Piesa, ${cine}`, FORME_EDITOR, e.forma ?? "ml"))}
    ${um ? td("UM", um) : td("UM", esc(p.um || "—"), "ver-text-cel")}
    ${td("Cantitate", cantitate, "n")}
    ${td("Preț unitar €", mijloc.length ? pretStrat(pe[0]) : pret, "n")}
    <td class="ver-stare">${stare(l, o.propunere(l), cine)}</td>
  </tr>${mijloc.map(({ x, k }, j) => {
    const ultim = j === mijloc.length - 1;
    const t = pe[k + 1];
    const eticheta = `stratul ${j + 2}, ${cine}`;
    return `<tr class="ver-strat" data-idx="${i}" data-stare="${p.stare}">
    <td class="ver-rand" data-eticheta="Rândul"></td>
    <td class="ver-desc"><p class="ver-text ver-strat-nume">Stratul ${j + 2}</p></td>
    ${td("Izolație", select(`strat${k}`, i, `Izolația, ${eticheta}`,
      IZOLATII.map((m): [string, string] => [m, MATERIAL[m]]), x.sistem))}
    ${td(c.gros, numarPeLoc(`stratg${k}`, i, x.grosime_mm, `Grosimea, ${eticheta}`, "—"))}
    ${td(c.prot, ultim ? protectie : SUB_STRAT)}
    ${td("Diametru", fix(t ? `ø${numarInCelula(Math.round(t.diametru_geometric * 10) / 10)}` : "—",
      t ? `Stă peste stratul de dedesubt: ø${numarInCelula(Math.round(t.diametru_geometric * 10) / 10)}, rândul ${t.rand_lista} din listă` : ""))}
    ${td("Piesă", fix(FORME_EDITOR.find(([f]) => f === (e.forma ?? "ml"))?.[1] ?? "—"))}
    ${td("UM", fix(p.um || "—"))}
    ${td("Cantitate", fix(numarInCelula(p.cantitate)), "n")}
    ${td("Preț unitar €", pretStrat(t, ultim ? jachete : []), "n")}
    <td class="ver-stare"><div class="ver-actiuni"><button type="button" class="cel-scoate" data-act="sterge-strat" data-idx="${i}" data-k="${k}"
      aria-label="${esc(`Scoate ${eticheta}`)}" title="Scoate stratul">✕</button></div></td>
  </tr>`;
  }).join("")}${mijloc.length ? `<tr class="ver-strat ver-strat-total" data-idx="${i}" data-stare="${p.stare}">
    <td class="ver-rand"></td>
    <td class="ver-desc" colspan="8"><p class="ver-text ver-strat-nume">Prețul rândului, suma straturilor</p></td>
    ${td("Preț unitar €", pret, "n")}
    <td class="ver-stare"></td>
  </tr>` : ""}`;
}

/**
 * Tabul „Verificare”: un tabel ca în Excel (Andrei, 21 octombrie 2026: „prefer
 * view-ul pe coloane”), pe capitolele clientului, cu toate pozițiile (și cele
 * care nu intră încă în ofertă). Pe ecran îngust rândul devine card.
 */
export function verificarePeEcran(d: DocumentOferta, o: OptiuniDocument): string {
  const vede = (p: PozitieOferta): boolean => o.vizibile === null || o.vizibile.has(p.linie);
  const toate = d.capitole.flatMap((cap) => cap.pozitii);
  // Doar închideri la foc (Matari): coloanele grosimii și protecției țin golul.
  const doarGoluri = toate.length > 0 && toate.every((p) => o.linii.get(p.linie)?.extras.sistem === "goluri_foc");
  const c: Coloane = doarGoluri ? { gros: "Lățime gol (mm)", prot: "Înălțime gol (mm)" } : { gros: "Grosime (mm)", prot: "Protecție" };
  const capete = ["Rând", "Descrierea clientului", "Izolație", c.gros, c.prot, "Diametru", "Piesă", "UM", "Cantitate", "Preț unitar €", "Stare"];
  const n = capete.length;
  const corp = d.capitole.map((cap) => {
    const vazute = cap.pozitii.filter(vede);
    if (vazute.length === 0) return "";
    return `<tbody>${cap.titlu ? `<tr class="ver-capitol"><th colspan="${n}" scope="colgroup">${esc(cap.titlu)}</th></tr>` : ""}${
      vazute.map((p) => randVerificare(p, o, c)).join("")}</tbody>`;
  }).join("");
  return `<section class="imp-card ver" aria-label="Verificare">
    ${corp ? `<table class="ver-tabel">
      <colgroup>${["rand", "desc", "material", "gros", "prot", "diam", "piesa", "um", "n", "n", "stare"]
        .map((k) => `<col class="ver-col-${k}">`).join("")}</colgroup>
      <thead><tr>${capete.map((t, k) => `<th scope="col"${[8, 9].includes(k) ? ' class="n"' : ""}>${t}</th>`).join("")}</tr></thead>
      ${corp}
    </table>` : `<p class="imp-gol">Nicio poziție aici.</p>`}
  </section>`;
}
