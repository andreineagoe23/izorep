import { data as dataRo, esc, eur, nota, progres, stare, tabel, type Ecran } from "./tip.js";
import { LUCRARI, client, santier, type Lucrare, type StareLucrare } from "../date/seed.js";
import { vedeCosturi } from "../nav.js";

/** Eticheta afisata si tonul indicatorului `stare()`, per stare de lucrare. */
const ETICHETA_STARE: Record<StareLucrare, { text: string; ton: "ok" | "atentie" | "neutru" }> = {
  ofertata: { text: "Ofertată", ton: "neutru" },
  in_executie: { text: "În execuție", ton: "neutru" },
  de_inchis: { text: "De închis", ton: "atentie" },
  inchisa: { text: "Închisă", ton: "ok" },
};

function randTabel(l: Lucrare): string {
  const c = client(l.clientId);
  const s = santier(l.santierId);
  const et = ETICHETA_STARE[l.stare];

  const coloaneBani = vedeCosturi()
    ? `<td class="n">${l.contractat !== null ? eur(l.contractat) : "—"}</td><td class="n">${eur(l.facturat)}</td>`
    : "";

  return `<tr>
    <td><b>${esc(l.id)}</b><br><span class="hint">${esc(l.denumire)}</span></td>
    <td>${esc(c?.denumire ?? "—")}<br><span class="hint">${esc(s?.denumire ?? "—")}</span></td>
    <td>${l.inceput ? dataRo(l.inceput) : "—"}</td>
    <td>${progres(l.progres)}</td>
    ${coloaneBani}
    <td>${stare(et.text, et.ton)}</td>
  </tr>`;
}

function notaInchidere(): string {
  return nota(
    `O lucrare nu se poate închide cu sold de material nezero pe gestiunea de șantier: la închidere, sistemul ` +
      `cere o decizie explicită pentru fiecare poziție rămasă — retur, casare sau facturare suplimentară. ` +
      `Modulul de depozit și stoc care ține această gestiune urmează.`
  );
}

export const ecran: Ecran = {
  id: "lucrari",
  titlu: "Lucrări",
  subtitlu:
    "Lucrarea e obiectul central al sistemului: de ea se leagă materialele consumate, raportările de teren, situațiile de lucrări și facturile.",
  render(root) {
    const capete = [
      "Lucrare",
      "Client / Șantier",
      "Început",
      "Progres",
      ...(vedeCosturi() ? ["Contractat", "Facturat"] : []),
      "Stare",
    ];
    const clase = ["", "", "", "", ...(vedeCosturi() ? ["n", "n"] : []), ""];

    root.innerHTML = `${tabel(capete, LUCRARI.map(randTabel), clase)}${notaInchidere()}`;
  },
};
