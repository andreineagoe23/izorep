import type { Ecran } from "./tip.js";
import { eur, nr, esc, card, indicator, tabel, nota } from "./tip.js";
import { lista, diametre, type BandaMultiplicator } from "../../src/pricing/lists.js";
import type { Sistem } from "../../src/pricing/types.js";

const SISTEME: { id: Sistem; eticheta: string }[] = [
  { id: "elastomer", eticheta: "Elastomer" },
  { id: "vata_minerala", eticheta: "Vată minerală" },
  { id: "tabla", eticheta: "Tablă" },
  { id: "pvc", eticheta: "PVC" },
];

/** Coloanele din tabelul de multiplicatori, in ordinea ceruta. "band" e desenat separat. */
type CampFactor = Exclude<keyof BandaMultiplicator, "band">;
const CAMPURI_MULT: { cheie: CampFactor; eticheta: string }[] = [
  { cheie: "ml", eticheta: "ml" },
  { cheie: "manseta", eticheta: "Manșetă" },
  { cheie: "cot_teu_reductie", eticheta: "Cot / teu / reducție" },
  { cheie: "robinet_vana_flansa_contor", eticheta: "Robinet / vană / flanșă / contor" },
  { cheie: "flansa_robinet_contor_distribuitor", eticheta: "Flanșă / robinet / contor / distribuitor" },
  { cheie: "pompa_filtru_distribuitor", eticheta: "Pompă / filtru / distribuitor" },
  { cheie: "pompa_filtru_vana23", eticheta: "Pompă / filtru / vană Ø2–3" },
];

/** Grosimile din liste au 0-1 zecimale (tabla: 0.6/0.8/1); restul sunt intregi. */
const formatGrosime = (g: number): string => nr(g, Number.isInteger(g) ? 0 : 1);

const formatFactor = (v: number | null | undefined): string =>
  v == null ? "—" : `× ${nr(v, Number.isInteger(v) ? 0 : 2)}`;

/** Matricea diametru x grosime pentru sistemul dat, cu randul "per mp" adaugat la final daca exista. */
function deseneazaMatrice(sistem: Sistem): string {
  const l = lista(sistem);
  const diam = diametre(sistem);
  const areGrosimi = l.grosimi_mm.length > 0;
  // PVC nu are coloana de grosime: cheia din lista e "diametru|-".
  const coloane: (number | null)[] = areGrosimi ? l.grosimi_mm : [null];
  const cheieCell = (d: number, g: number | null): string => (g == null ? `${d}|-` : `${d}|${g}`);

  const capete = ["Ø mm", ...coloane.map((g) => (g == null ? "€ / ml" : `${formatGrosime(g)} mm`))];
  const clase = capete.map((_, i) => (i === 0 ? "" : "n"));

  const randuriDiam = diam.map((d) => {
    const celule = coloane
      .map((g) => {
        const v = l.cells[cheieCell(d, g)];
        const detaliu = g == null ? `Ø${nr(d)}` : `Ø${nr(d)}, ${formatGrosime(g)} mm`;
        const titlu = v == null ? `${detaliu} — nu se ofertează, poziție netarifată (tarifare manuală)` : detaliu;
        return `<td class="n${v == null ? " gol" : ""}" title="${esc(titlu)}">${v == null ? "—" : eur(v)}</td>`;
      })
      .join("");
    return `<tr><th scope="row">${nr(d)}</th>${celule}</tr>`;
  });

  const mpChei = Object.keys(l.per_mp);
  const randMp = mpChei.length
    ? [
        `<tr><th scope="row">€ / mp</th>${coloane
          .map((g) => {
            const v = g == null ? undefined : l.per_mp[String(g)];
            return `<td class="n">${v != null ? eur(v) : "—"}</td>`;
          })
          .join("")}</tr>`,
      ]
    : [];

  return `<div class="matrice">${tabel(capete, [...randuriDiam, ...randMp], clase)}</div>`;
}

function deseneazaMultiplicatori(sistem: Sistem): string {
  const l = lista(sistem);
  const campuriActive = CAMPURI_MULT.filter((c) => l.multiplicatori.some((m) => c.cheie in m));
  const capete = ["Bandă Ø mm", ...campuriActive.map((c) => c.eticheta)];
  const clase = capete.map((_, i) => (i === 0 ? "" : "n"));

  const randuri = l.multiplicatori.map((m) => {
    const [de, pana] = m.band;
    const eticBanda = `Ø ${nr(de)}–${pana >= 9999 ? "∞" : nr(pana)}`;
    const valori = campuriActive.map((c) => `<td class="n">${formatFactor(m[c.cheie])}</td>`).join("");
    return `<tr><th scope="row">${eticBanda}</th>${valori}</tr>`;
  });

  return tabel(capete, randuri, clase);
}

function deseneazaIndicatori(sistem: Sistem): string {
  const l = lista(sistem);
  const diam = diametre(sistem);
  const areGrosimi = l.grosimi_mm.length > 0;
  const coloane = areGrosimi ? l.grosimi_mm.length : 1;
  const completate = Object.keys(l.cells).length;
  const posibile = diam.length * coloane;

  return `<div class="stats">
    ${indicator(nr(completate), "celule completate", `din ${nr(posibile)} posibile (Ø × grosime)`)}
    ${indicator(
      nr(l.grosimi_mm.length),
      "grosimi disponibile",
      areGrosimi ? `${l.grosimi_mm.map((g) => formatGrosime(g)).join(", ")} mm` : "sistem fără variație de grosime",
    )}
  </div>`;
}

function construiesteContinut(sistem: Sistem): string {
  const l = lista(sistem);
  return `
    <h2>${esc(l.denumire)}</h2>
    ${deseneazaMatrice(sistem)}
    ${deseneazaIndicatori(sistem)}
    ${nota(
      "Matricile sunt <strong>rare</strong>: combinațiile care nu se execută rămân goale. Golul înseamnă " +
      "„nu se ofertează”, NU „preț zero”. O poziție fără preț se marchează pentru tarifare manuală — nu se ghicește.",
    )}
    <h2>Multiplicatori pentru elemente speciale</h2>
    ${deseneazaMultiplicatori(sistem)}
    ${nota(
      "Fitingurile (coturi, teuri, robinete, vane, flanșe…) nu au preț propriu: se tarifează ca multiplu al " +
      "prețului pe metru liniar de la acel diametru, pe benzi de diametru. Tabelul de mai sus e valoare " +
      "<strong>implicită</strong>, nu regulă rigidă — ofertele reale conțin abateri negociate, care trebuie " +
      "permise, dar marcate vizibil.",
    )}
    ${nota(
      "Lista se <strong>versionează</strong>, nu se editează. Modificarea prețurilor creează o versiune nouă " +
      "cu valabilitate de la o dată; ofertele vechi rămân reproductibile chiar dacă prețurile curente s-au " +
      "schimbat între timp.",
    )}
  `;
}

export const ecran: Ecran = {
  id: "preturi",
  titlu: "Liste de prețuri",
  subtitlu: "Datele reale de tarifare ale firmei, pe sistem de izolație.",
  render(root) {
    root.innerHTML =
      card(
        "Sistem",
        `<label for="sistemSel">Alege sistemul de izolație</label>
         <select id="sistemSel" class="ingust">
           ${SISTEME.map((s) => `<option value="${s.id}">${esc(s.eticheta)}</option>`).join("")}
         </select>`,
      ) + `<div id="corpPreturi"></div>`;

    const select = root.querySelector<HTMLSelectElement>("#sistemSel");
    const corp = root.querySelector<HTMLDivElement>("#corpPreturi");
    if (!select || !corp) return;

    const deseneaza = (sistem: Sistem): void => {
      corp.innerHTML = construiesteContinut(sistem);
    };

    select.addEventListener("change", () => deseneaza(select.value as Sistem));
    deseneaza(SISTEME[0]!.id);
  },
};
