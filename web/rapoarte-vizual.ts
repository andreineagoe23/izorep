/**
 * Marcajul rapoartelor de pe tabloul de bord (Faza 7, S49): alertele, lista
 * săptămânală și cifrele șantierelor închise. Funcții pure, ca
 * `web/inchidere-vizual.ts`; logica e în `src/lucrari/rapoarte.ts`.
 */
import { cate, esc, eur, tabel } from "./ecrane/tip.js";
import { cifra } from "./stoc-vizual.js";
import type { Alerta, ListaSaptamanala, SantierInchis } from "../src/lucrari/rapoarte.js";

const zi = (iso: string): string => new Date(iso).toLocaleDateString("ro-RO");

/** Liniile din „Necesită atenția ta”, cu linkul spre ecranul care rezolvă. */
export function alerteAtentie(a: readonly Alerta[]): { href: string; html: string }[] {
  return a.map((x) => {
    switch (x.fel) {
      case "lipsa":
        return {
          href: "#/lucrari",
          html: `Pe șantierul <b>${esc(x.denumire)}</b> ${x.materiale === 1 ? "lipsește un material" : `lipsesc <b>${x.materiale}</b> materiale`}
            ca să se termine lucrarea, deși tot necesarul a fost adus sau comandat.`,
        };
      case "pierdere":
        return {
          href: "#/lucrari",
          html: `Pe șantierul <b>${esc(x.denumire)}</b> s-a consumat cu <b>${cifra(x.procent)} %</b> mai mult material decât
            arată situațiile (normal până la 10 %).`,
        };
      case "comanda":
        return {
          href: "#/comenzi",
          html: `Comanda la <b>${esc(x.furnizor)}</b>${x.pentru ? ` pentru ${esc(x.pentru)}` : " pentru depozit"}, trimisă pe
            ${esc(zi(x.trimisa))}, ${x.partial ? "a venit doar în parte" : "n-a venit"} de ${cate(x.zile, "zile")}.`,
        };
    }
  });
}

/** Ultimele 7 zile, pe șantier: situații, material venit, comenzi trimise, închideri. */
export function cardSaptamana(l: ListaSaptamanala, bani: boolean): string {
  const perioada = `${zi(l.de)} – ${zi(l.pana)}`;
  if (l.randuri.length === 0) {
    return `<p class="hint" style="margin:0">${esc(perioada)}: pe șantiere nu s-a scris nimic.</p>`;
  }
  const randuri = l.randuri.map((r) => `<tr>
    <td><b>${esc(r.denumire)}</b>${r.inchis ? `<br><span class="hint">închis în perioada asta</span>` : ""}</td>
    <td class="n">${r.situatii || "—"}${bani && r.situatii ? `<br><span class="hint">${eur(r.executat)}</span>` : ""}</td>
    <td class="n">${r.livrari ? (r.livrari === 1 ? "o livrare" : `${r.livrari} livrări`) : "—"}${bani && r.livrari ? `<br><span class="hint">${eur(r.valoareVenita)}</span>` : ""}</td>
    <td class="n">${r.comenziTrimise || "—"}</td>
  </tr>`);
  return `<p class="hint" style="margin:0 0 12px">${esc(perioada)}. Valoarea situațiilor e cea din perioadă. Materialul venit
      se numără la data avizului: factura care vine după aviz nu aduce material nou, pune doar prețul.</p>
    ${tabel(["Șantier", "Situații", "Material venit", "Comenzi trimise"], randuri, ["", "n", "n", "n"])}`;
}

/** Cifrele la închidere: costul materialului față de ofertă, pe fiecare șantier închis. */
export function cardInchise(s: readonly SantierInchis[], bani: boolean): string {
  if (s.length === 0) return "";
  const randuri = s.map(({ plan, cifre: c }) => `<tr>
    <td><b>${esc(plan.denumire)}</b><br><span class="hint">${esc(plan.client || "—")}</span></td>
    <td>${esc(zi(c.inchis))}</td>
    ${bani ? `<td class="n">${eur(c.cost.cost)}${c.cost.faraPret ? `<br><span class="hint">${c.cost.faraPret === 1 ? "un material" : cate(c.cost.faraPret, "materiale")} încă fără preț</span>` : ""}</td>
    <td class="n">${eur(c.cost.inOferta)}</td>` : ""}
    <td class="n">${c.cost.procent === null ? "—" : `${cifra(c.cost.procent)} %`}</td>
  </tr>`);
  const capete = ["Șantier", "Închis", ...(bani ? ["Cost material", "În ofertă"] : []), "Cost / ofertă"];
  return `<p class="hint" style="margin:0 0 12px">Costul materialului rămas pe șantier (pus, pierdut, reciclat), față de cât
      plătește clientul pe el în ofertă, cu manopera.</p>
    ${tabel(capete, randuri, ["", "", ...(bani ? ["n", "n"] : []), "n"])}`;
}
