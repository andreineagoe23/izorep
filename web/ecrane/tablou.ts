import { atentionare, card, esc, eur, indicator, nota, nr, stare, type Ecran } from "./tip.js";
import { vedeCosturi } from "../nav.js";
import { citesteDepozit, citesteOferte, citestePlanuri, listeaza } from "../date.js";
import { deComandatPeNecesar, titluNecesar } from "../materiale.js";
import { alerte } from "../../src/lucrari/rapoarte.js";
import { alerteAtentie } from "../rapoarte-vizual.js";
import { GRUPURI_ACASA, deFacutLucrareToate, firmaLucrare, lucrariDin, stadiu, titluLucrare, type GrupAcasa, type Lucrare } from "../lucrare.js";
import { firmaDupa } from "../date/firme.js";
import { stareLucrarii } from "../stare-lucrare.js";
import { situatiiIncepute } from "../situatie-local.js";

/**
 * Acasă (planul UX, Faza 5; pe grupuri din 15 noiembrie 2026): trei cifre și
 * tot ce a rămas la jumătate, pe grupuri, în ordinea fluxului (`GRUPURI_ACASA`):
 * „De terminat la birou”, „Așteaptă răspunsul clientului” (orice ofertă fără
 * răspuns, din prima zi, cu vechimea), „Șantiere în lucru”, „Marfă și
 * materiale”. Un grup apare doar cu rânduri; fără nimic, „Nimic de făcut acum.”
 *
 * Rândurile lucrărilor vin din același `urmeaza` ca pagina lucrării și lista
 * Lucrări (`deFacutLucrare`); fiecare buton duce pe fila unde se face.
 */

const spre = (l: Lucrare, fila: string): string => `#/lucrari/${encodeURIComponent(l.id)}/${fila}`;

interface Rand { href: string; html: string; actiune: string; intarziat?: string | undefined; zile?: number | undefined }

function cifre(toate: readonly Lucrare[]): string {
  const asteapta = toate.filter((l) => stadiu(l) === "trimise").length;
  const inLucru = toate.filter((l) => stadiu(l) === "in-lucru");
  const valoare = inLucru.reduce((t, l) => t + (l.oferta?.valoare ?? 0), 0);
  const indicatori = [
    indicator(nr(asteapta), "Oferte care așteaptă răspuns"),
    indicator(nr(inLucru.length), "Lucrări deschise", "șantiere în lucru"),
    ...(vedeCosturi() ? [indicator(eur(valoare), "Valoarea lor", "din oferte")] : []),
  ];
  return `<div class="stats">${indicatori.join("")}</div>${vedeCosturi() ? "" : nota("Valorile nu se văd pe rolul ăsta.")}`;
}

function grupuri(toate: readonly Lucrare[]): string {
  const dep = citesteDepozit();
  const azi = new Date().toISOString();
  const incepute = situatiiIncepute();
  const pe: Record<GrupAcasa, Rand[]> = { birou: [], raspuns: [], santiere: [], marfa: [] };
  for (const l of toate) {
    for (const d of deFacutLucrareToate(stareLucrarii(l, dep, incepute), azi)) {
      pe[d.grup].push({
        href: d.href ?? spre(l, d.fila), actiune: d.buton, intarziat: d.intarziat, zile: d.zile,
        // Acasă arată amândouă firmele: firma stă în fața lucrării (Etapa 2, 26 noiembrie 2026).
        html: `<span class="hint">${esc(firmaDupa(firmaLucrare(l))?.scurt ?? "")}</span> <b>${esc(titluLucrare(l))}</b>: ${esc(d.text)}`,
      });
    }
  }
  // Ofertele: cele care așteaptă de mai mult, sus.
  pe.raspuns.sort((a, b) => (b.zile ?? 0) - (a.zile ?? 0));
  // Comenzile trimise și nevenite (din prima zi), lipsa și pierderea pe șantier (Fazele 6–7).
  pe.marfa.push(...alerteAtentie(alerte(citestePlanuri(), dep, azi, 0)));
  // Lista de materiale fără șantier (pusă de mână în Materiale): nu e a unei lucrări.
  for (const { necesar, articole } of deComandatPeNecesar(dep)) {
    if (articole === 0 || necesar.santier) continue;
    pe.marfa.push({
      href: "#/materiale", actiune: "Comandă ce lipsește",
      html: `<b>${esc(titluNecesar(necesar))}</b>: ${articole === 1 ? "un material" : `${nr(articole)} materiale`} de comandat.`,
    });
  }
  const carduri = GRUPURI_ACASA.filter((g) => pe[g.id].length > 0).map((g) => card(
    `${g.titlu} · ${pe[g.id].length}`,
    pe[g.id].map((r) => atentionare(r.href, `${r.html}${r.intarziat ? ` ${stare(r.intarziat, "atentie")}` : ""}`, r.actiune)).join(""),
  ));
  if (carduri.length === 0) return card("De făcut", `<p class="hint" style="margin:0">Nimic de făcut acum.</p>`);
  return carduri.join("");
}

export const ecran: Ecran = {
  id: "tablou",
  titlu: "Acasă",
  subtitlu: "Tot ce a rămas de făcut, pe fiecare lucrare.",
  async render(root) {
    const toate = lucrariDin(await listeaza(), citesteOferte(), citestePlanuri());
    root.innerHTML = `${cifre(toate)}${grupuri(toate)}`;
  },
};
