import { atentionare, card, cate, esc, eur, indicator, nota, nr, progres, stare, tabel, type Ecran } from "./tip.js";
import { vedeCosturi } from "../nav.js";
import { citesteDepozit, citesteOferte, citestePlanuri, listeaza, type IntrareIstoric } from "../date.js";
import type { OfertaEmisa } from "../oferte-local.js";
import { deComandatPeNecesar } from "../materiale.js";
import { alerte } from "../../src/lucrari/rapoarte.js";
import { progresPlan, type PlanSantier } from "../../src/lucrari/situatii.js";
import { alerteAtentie } from "../rapoarte-vizual.js";
import { gasesteLucrarea, lucrariDin, stadiu, type Lucrare } from "../lucrare.js";

/**
 * Tabloul arată doar ce e în bază (pe linkul demo, în browser): ofertele
 * salvate, cererile importate și șantierele făcute din oferte. Până pe 13
 * octombrie 2026 indicatorii veneau din lucrările de exemplu din `seed.ts`,
 * deci pe server patronul vedea sume care nu erau ale lui.
 */
interface DateTablou {
  planuri: PlanSantier[];
  oferte: Record<string, OfertaEmisa>;
  importuri: IntrareIstoric[];
}

/** Starea unui șantier deschis, din situațiile lui. */
function stareSantier(p: PlanSantier): { text: string; ton: "ok" | "atentie" | "neutru" } {
  if (progresPlan(p) >= 100) return { text: "De închis", ton: "atentie" };
  return p.situatii.length > 0 ? { text: "În execuție", ton: "neutru" } : { text: "Fără situații", ton: "neutru" };
}

/** Cererile fără ofertă, în afară de cele refuzate (refuzul e al unei oferte, dar să nu apară ca de făcut). */
const neofertate = (d: DateTablou): IntrareIstoric[] => d.importuri.filter((m) => !d.oferte[m.id] && !m.antet?.refuzat);

/**
 * Adresa unei lucrări, pe fila ei (14 noiembrie 2026): butoanele din „De făcut”
 * duc pe pagina lucrării, nu în ecranele de dinainte (Oferte și cereri, Șantiere).
 */
const spre = (toate: readonly Lucrare[], id: string, fila: string): string =>
  `#/lucrari/${encodeURIComponent(gasesteLucrarea(toate, id)?.id ?? id)}/${fila}`;

function randIndicatori(d: DateTablou): string {
  const oferte = Object.values(d.oferte);
  const deschise = d.planuri.filter((p) => !p.inchis);
  const inchise = d.planuri.length - deschise.length;
  const cereri = neofertate(d);

  const indicatori: string[] = [];
  if (vedeCosturi()) {
    indicatori.push(indicator(eur(oferte.reduce((s, o) => s + o.valoare, 0)), "Valoare ofertată",
      oferte.length === 1 ? "o ofertă" : `${nr(oferte.length)} oferte`));
  }
  indicatori.push(indicator(nr(deschise.length), "Șantiere deschise"));
  if (inchise > 0) indicatori.push(indicator(nr(inchise), "Șantiere închise"));
  indicatori.push(indicator(nr(cereri.reduce((s, m) => s + m.pozitii, 0)), "Poziții din cereri neofertate",
    cereri.length === 1 ? "o cerere" : `${nr(cereri.length)} cereri`));

  const notaRol = vedeCosturi() ? "" : nota("Valorile ofertate nu se văd pe rolul ăsta.");
  return `<div class="stats">${indicatori.join("")}</div>${notaRol}`;
}

const lista = (numere: string[]): string =>
  numere.length > 1 ? `${numere.slice(0, -1).join(", ")} și ${numere[numere.length - 1]}` : numere[0] ?? "";

/** „De făcut”: un rând pe lucru, fiecare cu butonul care duce unde se rezolvă. */
function deFacut(d: DateTablou): string {
  const itemi: { href: string; html: string; actiune: string }[] = [];
  const toate = lucrariDin(d.importuri, d.oferte, d.planuri);

  for (const p of d.planuri.filter((x) => !x.inchis && progresPlan(x) >= 100)) {
    itemi.push({
      href: spre(toate, p.id, "inchidere"),
      actiune: "Închide șantierul",
      html: `Șantierul <b>${esc(p.denumire)}</b> are tot executat: se poate închide, după ce se
        numără ce a rămas pe șantier.`,
    });
  }

  const cerereMaiMare = [...neofertate(d)].sort((a, b) => b.pozitii - a.pozitii)[0];
  if (cerereMaiMare) {
    itemi.push({
      href: spre(toate, cerereMaiMare.id, "cerere"),
      actiune: "Deschide cererea",
      html: `Cererea <b>${esc(cerereMaiMare.nume)}</b> are <b>${cerereMaiMare.pozitii === 1 ? "o poziție" : cate(cerereMaiMare.pozitii, "poziții")}</b> și încă n-are ofertă.`,
    });
  }

  // Oferta descarcata, fara santier si nerefuzata: asteapta raspunsul clientului.
  const trimise = toate.filter((l) => stadiu(l) === "trimise");
  const asteapta = trimise.map((l) => l.oferta!);
  if (asteapta.length > 0) {
    const numere = asteapta.map((o) => `<b>${esc(o.numar || o.obiectiv || "fără număr")}</b>`);
    itemi.push({
      href: asteapta.length > 1 ? "#/lucrari?stadiu=trimise" : spre(toate, trimise[0]!.id, "oferta"),
      actiune: asteapta.length > 1 ? "Vezi ofertele" : "Vezi oferta",
      html: `${asteapta.length > 1 ? "Ofertele" : "Oferta"} ${lista(numere)} ${asteapta.length > 1
        ? "n-au încă șantier: așteaptă" : "n-are încă șantier: așteaptă"} răspunsul clientului.`,
    });
  }

  // Pe un șantier cu tot executat, pasul e închiderea (rândul de mai sus), nu
  // comanda: la fel spune „Urmează” pe lucrare și în lista Lucrări (`urmeaza`).
  const deInchis = new Set(d.planuri.filter((x) => !x.inchis && progresPlan(x) >= 100).map((x) => x.id));
  for (const { necesar, articole } of deComandatPeNecesar(citesteDepozit())) {
    if (articole === 0 || (necesar.santier && deInchis.has(necesar.santier))) continue;
    itemi.push({
      href: necesar.santier ? spre(toate, necesar.santier, "materiale") : "#/materiale",
      actiune: "Comandă ce lipsește",
      html: `Pentru <b>${esc(necesar.obiectiv || necesar.fisier)}</b> ${articole === 1
        ? "e un material" : `sunt <b>${nr(articole)}</b> materiale`} de comandat.`,
    });
  }

  // Faza 7 (S49): lipsa pe santier, pierderea peste 10 % (Faza 6), comenzile nereceptionate.
  itemi.push(...alerteAtentie(alerte(d.planuri, citesteDepozit(), new Date().toISOString())));

  if (itemi.length === 0) return card("De făcut", `<p class="hint" style="margin:0">Nimic de făcut acum.</p>`);
  return card("De făcut", itemi.map((i) => atentionare(i.href, i.html, i.actiune)).join(""));
}

function tabelDerulare(d: DateTablou): string {
  const deschise = d.planuri.filter((p) => !p.inchis);
  if (deschise.length === 0) {
    return card("Șantiere în lucru", `<p class="hint" style="margin:0">Niciun șantier deschis. Șantierul se face din
      ofertă: în <a href="#/lucrari">Lucrări</a>, pe lucrarea lui, „Clientul a acceptat”.</p>`);
  }
  const randuri = deschise.map((p) => {
    const st = stareSantier(p);
    return `<tr>
      <td><b>${esc(p.denumire)}</b><br><span class="hint">${esc(p.oferta || "—")}</span></td>
      <td>${esc(p.client || "—")}</td>
      <td>${progres(progresPlan(p))}</td>
      <td>${stare(st.text, st.ton)}</td>
    </tr>`;
  });
  return card("Șantiere în lucru", tabel(["Șantier", "Client", "Executat", "Stare"], randuri));
}

export const ecran: Ecran = {
  id: "tablou",
  titlu: "Acasă",
  subtitlu: "Ofertele, cererile neofertate și șantierele în lucru.",
  async render(root) {
    const d: DateTablou = { planuri: citestePlanuri(), oferte: citesteOferte(), importuri: await listeaza() };
    root.innerHTML = `${randIndicatori(d)}${deFacut(d)}${tabelDerulare(d)}`;
  },
};
