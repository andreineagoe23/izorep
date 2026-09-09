import type { Ecran } from "./tip.js";
import { eur, nr, esc, card, indicator, tabel, nota, stare } from "./tip.js";
import {
  DESTINATII, diametreDin, inventarPe, listaGoluriFoc, listaPe,
  type BandaMultiplicator, type Destinatie, type ListaPreturi,
} from "../../src/pricing/lists.js";
import type { MaterialConducta, Sistem, SistemMatrice } from "../../src/pricing/types.js";

const SISTEME: { id: Sistem; eticheta: string }[] = [
  { id: "elastomer", eticheta: "Elastomer" },
  { id: "vata_minerala", eticheta: "Vată minerală" },
  { id: "tabla", eticheta: "Tablă aluminiu" },
  { id: "tabla_inox", eticheta: "Tablă inox" },
  { id: "pvc", eticheta: "PVC" },
  { id: "goluri_foc", eticheta: "Închideri goluri la foc" },
];

const ETICHETA_DEST: Record<Destinatie, string> = {
  rezidential: "Rezidențial",
  industrial: "Industrial",
  rafinarie: "Rafinărie",
};

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

/** Matricea diametru x grosime a unei liste, cu randul "per mp" adaugat la final daca exista. */
function deseneazaMatrice(l: ListaPreturi): string {
  const diam = diametreDin(l);
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

function deseneazaMultiplicatori(l: ListaPreturi): string {
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

function deseneazaIndicatori(l: ListaPreturi): string {
  const diam = diametreDin(l);
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
    ${indicator(
      diam.length ? `Ø${nr(diam[0]!)}–${nr(diam[diam.length - 1]!)}` : "—",
      "interval de diametre",
      `${nr(diam.length)} rânduri`,
    )}
  </div>`;
}

/**
 * Inventarul, pe sisteme si destinatii.
 *
 * Aici absentele spun la fel de mult ca prezentele: tabla de inox exista DOAR
 * pe industrial, PVC-ul si inchiderile la foc doar pe rezidential, iar
 * rafinaria n-a venit deloc. De-aia coloana ei ramane in tabel, goala, in loc
 * sa fie stearsa.
 */
function deseneazaInventar(): string {
  const capete = ["Sistem", ...DESTINATII.map((d) => ETICHETA_DEST[d])];
  const clase = capete.map((_, i) => (i === 0 ? "" : "n"));

  const randuri = SISTEME.filter((s) => s.id !== "goluri_foc").map((s) => {
    const celule = DESTINATII.map((d) => {
      const l = listaPe(s.id as SistemMatrice, d);
      if (!l) return `<td class="n gol" title="${esc(`${s.eticheta} — nicio listă pe ${ETICHETA_DEST[d].toLowerCase()}`)}">—</td>`;
      const diam = diametreDin(l);
      const detaliu = `Ø${nr(diam[0]!)}–${nr(diam[diam.length - 1]!)}`;
      return `<td class="n" title="${esc(`${l.denumire} — ${detaliu}`)}">${nr(Object.keys(l.cells).length)}
        <span class="hint">${esc(detaliu)}</span></td>`;
    }).join("");
    return `<tr><th scope="row">${esc(s.eticheta)}</th>${celule}</tr>`;
  });

  // Inchiderile goluri la foc nu sunt matrice o × grosime, deci n-au numar de
  // celule comparabil: se trec cu forma lor, nu cu o cifra care ar sugera ca
  // se citesc la fel ca restul.
  randuri.push(`<tr><th scope="row">Închideri goluri la foc</th>
    <td class="n">${stare("preț aditiv", "ok")}</td>
    <td class="n gol">—</td>
    <td class="n gol">—</td></tr>`);

  return tabel(capete, randuri, clase);
}

/**
 * Inchiderile goluri la foc — singura lista care NU e matrice ø × grosime.
 *
 * Pretul e ADITIV: golul (dupa suprafata lui) + banda WRAP + colierul. De-aia
 * are trei tabele, nu unul, si de-aia banda apare de doua ori: preturile difera
 * dupa materialul conductei, pentru ca difera numarul de infasurari. La ø140
 * sunt 12,19 € pe otel si 65,67 € pe plastic — aceeasi conducta, alt pret,
 * deci un singur tabel ar fi o capcana.
 */
function construiesteGoluriFoc(): string {
  const l = listaGoluriFoc();
  const mp = (v: number): string => `${nr(v, 2)} mp`;

  const praguri = tabel(
    ["Gol până la", "€ / buc"],
    [
      ...l.praguri_suprafata.map((p) =>
        `<tr><th scope="row">${esc(mp(p.pana_la_mp))}</th><td class="n">${eur(p.pret_buc)}</td></tr>`),
      `<tr><th scope="row">peste 1,00 mp</th><td class="n">${eur(l.peste_1mp_pret_pe_mp)} <span class="hint">/ mp</span></td></tr>`,
    ],
    ["", "n"],
  );

  const banda = (material: MaterialConducta): string => tabel(
    ["Ø mm", "€", "Observații"],
    l.banda_wrap[material].map((b) =>
      `<tr><th scope="row">${nr(b.diametru)}</th><td class="n">${eur(b.pret)}</td>
       <td class="hint">${esc(b.obs)}</td></tr>`),
    ["", "n", ""],
  );

  const coliere = tabel(
    ["Ø mm", "Urcare (1 colier)", "Orizontal (2 coliere)"],
    l.colier_promastop.map((c) =>
      `<tr><th scope="row">${nr(c.diametru)}</th>
       <td class="n">${eur(c.pret_urcare_1colier)}</td>
       <td class="n">${eur(c.pret_orizontal_2coliere)}</td></tr>`),
    ["", "n", "n"],
  );

  return `
    <h2>${esc(l.denumire)}</h2>
    ${nota(`Preț aditiv, nu matrice: <strong>${esc(l.regula)}</strong>.`)}

    <h2>Golul, după suprafața lui</h2>
    ${praguri}
    ${nota(
      "Suprafața = lățime × înălțime, din coloana „dimensiune gol” (<code>130/130</code>) — " +
      "<strong>diametrul conductei nu intră</strong> în prețul golului. Pragurile sunt scrise „Goluri până la " +
      "0,05 mp”, deci limita de sus e <strong>inclusivă</strong>: se vede în ofertă la 1000/600 = 0,60 mp și " +
      "1500/600 = 0,90 mp, amândouă tarifate pe pragul cu acea limită.",
    )}

    <h2>Banda WRAP, pe conductă de plastic</h2>
    ${banda("plastic")}
    <h2>Banda WRAP, pe conductă de oțel</h2>
    ${banda("otel")}
    ${nota(
      "Două tabele, nu unul: prețul urmează <strong>numărul de înfășurări</strong>, care diferă după material " +
      "(1 la oțel, 2–6 la plastic). La ø140 sunt 12,19 € pe oțel și 65,67 € pe plastic — de aceea materialul " +
      "conductei e obligatoriu, nu implicit. Căutarea e pe <strong>diametru exact</strong>: între două trepte " +
      "nu există valoare intermediară, ci o decizie umană.",
    )}

    <h2>Colier PROMASTOP UNICOLLAR</h2>
    ${coliere}
    ${nota(
      "Clasa peretelui (EI30, EI60, EI120) e <strong>etichetă de grupare, nu variabilă de preț</strong>: " +
      "în oferta 118.1 aceeași conductă DN15 costă 23,05 € și la EI30, și la EI120.",
    )}
  `;
}

function construiesteContinut(sistem: Sistem, dest: Destinatie): string {
  if (sistem === "goluri_foc") return construiesteGoluriFoc();
  const l = listaPe(sistem as SistemMatrice, dest);
  if (!l) {
    return nota(`Nu există listă de <strong>${esc(SISTEME.find((s) => s.id === sistem)?.eticheta ?? sistem)}</strong> ` +
      `pe segmentul ${esc(ETICHETA_DEST[dest].toLowerCase())}.`);
  }
  return `
    <h2>${esc(l.denumire)}</h2>
    ${deseneazaMatrice(l)}
    ${deseneazaIndicatori(l)}
    ${nota(
      "Matricile sunt <strong>rare</strong>: combinațiile care nu se execută rămân goale. Golul înseamnă " +
      "„nu se ofertează”, NU „preț zero”. O poziție fără preț se marchează pentru tarifare manuală — nu se ghicește.",
    )}
    ${dest === "industrial"
      ? nota(
          "Lista industrială se poate <strong>citi</strong>, dar motorul încă nu tarifează cu ea: ofertele ies " +
          "pe prețuri rezidențiale. Nu e o scăpare — lipsește regula după care se alege segmentul, iar un motor " +
          "care ar alege singur ar putea oferta o lucrare rezidențială la prețuri de industrial. Excepția e " +
          "<strong>tabla de inox</strong>, care n-are variantă rezidențială: acolo lista asta e singura care există.",
        )
      : ""}
    <h2>Multiplicatori pentru elemente speciale</h2>
    ${deseneazaMultiplicatori(l)}
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
  subtitlu: "Datele reale de tarifare ale firmei, pe segment și pe sistem de izolație.",
  render(root) {
    let dest: Destinatie = "rezidential";

    root.innerHTML =
      card("Ce liste avem, pe segment", deseneazaInventar() + nota(
        "Industrialul <strong>nu e un coeficient</strong> peste rezidențial: raportul diferă pe sistem și " +
        "chiar pe grosime — vata ×1,25 constant, elastomerul ×1,25 la 9/13/19 mm dar ×1,20 la 25/32 mm. " +
        "De-asta sunt liste proprii, nu un procent aplicat la ofertare.",
      )) +
      `<div class="filtre" role="group" aria-label="Segmentul listei de prețuri">
         ${DESTINATII.map((d) => `<button class="filtru" data-dest="${d}" aria-pressed="${d === dest}">
           ${esc(ETICHETA_DEST[d])} <span class="hint">${nr(inventarPe(d).length)}</span></button>`).join("")}
       </div>
       <label for="sistemSel">Alege sistemul de izolație</label>
       <select id="sistemSel" class="ingust"></select>
       <div id="corpPreturi"></div>`;

    const select = root.querySelector<HTMLSelectElement>("#sistemSel");
    const corp = root.querySelector<HTMLDivElement>("#corpPreturi");
    if (!select || !corp) return;

    /**
     * Reface lista de sisteme pentru segmentul curent si pastreaza selectia
     * daca sistemul exista si acolo. Trecerea de pe industrial (unde e tabla de
     * inox) pe rezidential (unde nu e) cade pe primul sistem disponibil, nu pe
     * un `select` gol care ar arata ca o eroare.
     */
    const deseneaza = (): void => {
      const disponibile = inventarPe(dest);
      const pastrat = disponibile.includes(select.value as Sistem)
        ? (select.value as Sistem)
        : disponibile[0];

      select.innerHTML = SISTEME.filter((s) => disponibile.includes(s.id))
        .map((s) => `<option value="${s.id}"${s.id === pastrat ? " selected" : ""}>${esc(s.eticheta)}</option>`)
        .join("");
      select.disabled = disponibile.length === 0;

      corp.innerHTML = pastrat
        ? construiesteContinut(pastrat, dest)
        : nota(
            "Lista de <strong>rafinărie</strong> nu a fost primită încă. Segmentul rămâne aici, gol, pentru că " +
            "absența lui e o informație: s-a cerut și nu a venit.",
          );
    };

    for (const b of root.querySelectorAll<HTMLButtonElement>("button.filtru")) {
      b.onclick = () => {
        for (const alt of root.querySelectorAll<HTMLButtonElement>("button.filtru")) {
          alt.setAttribute("aria-pressed", String(alt === b));
        }
        dest = b.dataset["dest"] as Destinatie;
        deseneaza();
      };
    }

    select.addEventListener("change", deseneaza);
    deseneaza();
  },
};
