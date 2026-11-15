import { atentionare, card, esc, eur, indicator, nota, nr, type Ecran } from "./tip.js";
import { vedeCosturi } from "../nav.js";
import { citesteDepozit, citesteOferte, citestePlanuri, listeaza } from "../date.js";
import { deComandatPeNecesar, titluNecesar } from "../materiale.js";
import { alerte } from "../../src/lucrari/rapoarte.js";
import { alerteAtentie } from "../rapoarte-vizual.js";
import { deFacutLucrare, lucrariDin, stadiu, titluLucrare, type Lucrare } from "../lucrare.js";
import { stareLucrarii } from "../stare-lucrare.js";

/**
 * Acasă (planul UX, Faza 5, 15 noiembrie 2026): trei cifre și „De făcut”.
 *
 * „De făcut” are un rând pe lucrare, din același `urmeaza` ca pagina lucrării
 * și lista Lucrări (`deFacutLucrare`): „Verifică N poziții”, „Termină oferta”,
 * „Întreabă clientul” (după 14 zile), „Comandă ce lipsește”, „Fă situația”
 * (după 30 de zile fără situație), „Închide șantierul”; fiecare buton duce pe
 * fila lucrării unde se face. Apoi ce nu e al unei singure lucrări: comenzile
 * nevenite („A venit marfa?”), lipsa și pierderea pe șantier.
 *
 * Doar ce e în bază (pe linkul demo, în browser). Au plecat „Șantiere în lucru”
 * (e Lucrări › În lucru) și cifrele de dinainte (valoarea tuturor ofertelor,
 * șantierele închise, pozițiile neofertate).
 */

const spre = (l: Lucrare, fila: string): string => `#/lucrari/${encodeURIComponent(l.id)}/${fila}`;

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

function deFacut(toate: readonly Lucrare[]): string {
  const dep = citesteDepozit();
  const azi = new Date().toISOString();
  const itemi: { href: string; html: string; actiune: string }[] = [];
  for (const l of toate) {
    const d = deFacutLucrare(stareLucrarii(l, dep), azi);
    if (d) itemi.push({ href: spre(l, d.fila), actiune: d.buton, html: `<b>${esc(titluLucrare(l))}</b>: ${esc(d.text)}` });
  }
  // Lista de materiale fără șantier (pusă de mână în Materiale): nu e a unei lucrări.
  for (const { necesar, articole } of deComandatPeNecesar(dep)) {
    if (articole === 0 || necesar.santier) continue;
    itemi.push({
      href: "#/materiale", actiune: "Comandă ce lipsește",
      html: `<b>${esc(titluNecesar(necesar))}</b>: ${articole === 1 ? "un material" : `${nr(articole)} materiale`} de comandat.`,
    });
  }
  // Comenzile nevenite de 7 zile, lipsa și pierderea pe șantier (Fazele 6–7).
  itemi.push(...alerteAtentie(alerte(citestePlanuri(), dep, azi)));
  if (itemi.length === 0) return card("De făcut", `<p class="hint" style="margin:0">Nimic de făcut acum.</p>`);
  return card("De făcut", itemi.map((i) => atentionare(i.href, i.html, i.actiune)).join(""));
}

export const ecran: Ecran = {
  id: "tablou",
  titlu: "Acasă",
  subtitlu: "Ce ai de făcut acum, pe fiecare lucrare.",
  async render(root) {
    const toate = lucrariDin(await listeaza(), citesteOferte(), citestePlanuri());
    root.innerHTML = `${cifre(toate)}${deFacut(toate)}`;
  },
};
