import { atentionare, card, esc, eur, indicator, nota, nr, progres, stare, tabel, type Ecran } from "./tip.js";
import { DOCUMENTE, LUCRARI, client, santier, type StareLucrare } from "../date/seed.js";
import { vedeCosturi } from "../nav.js";
import { citesteDepozit, citestePlanuri } from "../date.js";
import { deComandatPeNecesar } from "./stoc.js";
import { alerte, listaSaptamanala, santiereInchise } from "../../src/lucrari/rapoarte.js";
import { alerteAtentie, cardInchise, cardSaptamana } from "../rapoarte-vizual.js";

/** Eticheta afisata si tonul indicatorului `stare()`, per stare de lucrare. */
const ETICHETA_STARE: Record<StareLucrare, { text: string; ton: "ok" | "atentie" | "neutru" }> = {
  ofertata: { text: "Ofertată", ton: "neutru" },
  in_executie: { text: "În execuție", ton: "neutru" },
  de_inchis: { text: "De închis", ton: "atentie" },
  inchisa: { text: "Închisă", ton: "ok" },
};

/** Varianta la plural, pentru indicatorul "cate lucrari in fiecare stare". */
const STARE_PLURAL: Record<StareLucrare, string> = {
  ofertata: "ofertate",
  in_executie: "în execuție",
  de_inchis: "de închis",
  inchisa: "închise",
};

function randIndicatori(): string {
  const totalContractat = LUCRARI.reduce((s, l) => s + (l.contractat ?? 0), 0);
  const totalFacturat = LUCRARI.reduce((s, l) => s + l.facturat, 0);

  const dupaStare = LUCRARI.reduce<Partial<Record<StareLucrare, number>>>((acc, l) => {
    acc[l.stare] = (acc[l.stare] ?? 0) + 1;
    return acc;
  }, {});

  const cereriNeofertate = DOCUMENTE.filter((d) => d.tip === "cerere" && d.stare === "cerere");
  const pozitiiNeofertate = cereriNeofertate.reduce((s, d) => s + d.linii, 0);

  const indicatoriStari = (Object.keys(STARE_PLURAL) as StareLucrare[])
    .filter((s) => dupaStare[s])
    .map((s) => indicator(String(dupaStare[s]), `Lucrări ${STARE_PLURAL[s]}`));

  const indicatori: string[] = [];
  if (vedeCosturi()) {
    indicatori.push(indicator(eur(totalContractat), "Valoare totală ofertată", `${LUCRARI.length} lucrări`));
  }
  indicatori.push(...indicatoriStari);
  if (vedeCosturi()) {
    indicatori.push(indicator(eur(totalFacturat), "Total facturat"));
  }
  indicatori.push(indicator(nr(pozitiiNeofertate), "Poziții din cereri neofertate", `${cereriNeofertate.length} cereri`));

  const notaRol = vedeCosturi() ? "" : nota("Valorile ofertate și facturate nu se văd pe rolul ăsta.");

  return `<div class="stats">${indicatori.join("")}</div>${notaRol}`;
}

function sectiuneAtentie(): string {
  const itemi: { href: string; html: string }[] = [];

  for (const l of LUCRARI.filter((x) => x.stare === "de_inchis")) {
    itemi.push({
      href: "#/lucrari",
      html: `Lucrarea <b>${esc(l.id)}</b> — ${esc(l.denumire)} — e în starea ${stare(
        ETICHETA_STARE.de_inchis.text,
        ETICHETA_STARE.de_inchis.ton
      )}: lucrarea e terminată și mai trebuie hotărât ce se face cu materialul rămas pe șantier.`,
    });
  }

  const cerereMaiMare = [...DOCUMENTE].filter((d) => d.tip === "cerere" && d.stare === "cerere").sort((a, b) => b.linii - a.linii)[0];
  if (cerereMaiMare) {
    const c = client(cerereMaiMare.clientId);
    itemi.push({
      href: "#/documente",
      html: `Cererea <b>${esc(c?.denumire ?? "client necunoscut")}</b> are <b>${nr(
        cerereMaiMare.linii
      )}</b> poziții neofertate.`,
    });
  }

  const oferteTrimise = DOCUMENTE.filter((d) => d.tip === "oferta" && d.stare === "ofertata");
  if (oferteTrimise.length > 0) {
    const toate = oferteTrimise.map((d) => esc(d.numar.split(" / ")[0] ?? d.numar));
    const numere = toate.length > 1 ? `${toate.slice(0, -1).join(", ")} și ${toate[toate.length - 1]}` : toate[0]!;
    itemi.push({
      href: "#/documente",
      html: `Oferta${oferteTrimise.length > 1 ? "le" : ""} <b>${numere}</b> ${
        oferteTrimise.length > 1 ? "sunt trimise" : "e trimisă"
      } și așteaptă răspuns de la client.`,
    });
  }

  for (const { necesar, articole } of deComandatPeNecesar(citesteDepozit())) {
    if (articole === 0) continue;
    itemi.push({
      href: "#/stoc",
      html: `Pentru <b>${esc(necesar.obiectiv || necesar.fisier)}</b> ${articole === 1
        ? "e un material" : `sunt <b>${nr(articole)}</b> materiale`} de comandat.`,
    });
  }

  // Faza 7 (S49): lipsa pe santier, pierderea peste 10 % (Faza 6), comenzile nereceptionate.
  itemi.push(...alerteAtentie(alerte(citestePlanuri(), citesteDepozit(), new Date().toISOString())));

  if (itemi.length === 0) return "";

  return card(
    "Necesită atenția ta",
    itemi.map((i) => atentionare(i.href, i.html)).join("")
  );
}

function tabelDerulare(): string {
  const inDerulare = LUCRARI.filter((l) => l.stare !== "inchisa");

  const randuri = inDerulare.map((l) => {
    const c = client(l.clientId);
    const s = santier(l.santierId);
    const et = ETICHETA_STARE[l.stare];
    return `<tr>
      <td><b>${esc(l.id)}</b><br><span class="hint">${esc(l.denumire)}</span></td>
      <td>${esc(c?.denumire ?? "—")}<br><span class="hint">${esc(s?.denumire ?? "—")}</span></td>
      <td>${progres(l.progres)}</td>
      <td>${stare(et.text, et.ton)}</td>
    </tr>`;
  });

  return card("Lucrări în derulare", tabel(["Lucrare", "Client / Șantier", "Progres", "Stare"], randuri));
}

/** Faza 7 (S49): lista săptămânală și cifrele la închiderea șantierelor. */
function rapoarte(): string {
  const planuri = citestePlanuri();
  if (planuri.length === 0) return "";
  const d = citesteDepozit();
  const inchise = cardInchise(santiereInchise(planuri, d), vedeCosturi());
  return card("Ultimele 7 zile pe șantiere", cardSaptamana(listaSaptamanala(planuri, d, new Date().toISOString()), vedeCosturi()))
    + (inchise ? card("Șantiere închise", inchise) : "");
}

function notaCurs(): string {
  return nota(
    `Prețurile din oferte sunt în euro, fără TVA. Plata se face în lei, la cursul BNR din ziua facturii. ` +
      `Cursul se scrie pe fiecare document, ca suma să nu se schimbe mai târziu.`
  );
}

export const ecran: Ecran = {
  id: "tablou",
  titlu: "Tablou de bord",
  subtitlu: "Situația curentă a lucrărilor, ofertelor trimise și cererilor nerezolvate.",
  render(root) {
    root.innerHTML = `${randIndicatori()}${sectiuneAtentie()}${rapoarte()}${tabelDerulare()}${notaCurs()}`;
  },
};
