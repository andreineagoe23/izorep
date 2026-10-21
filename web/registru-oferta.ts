import type { Cell, Worksheet } from "exceljs";
import type { LinieProcesata } from "../src/import/nucleu.js";
import { ADAOS_FOC_INDUSTRIAL } from "../src/pricing/goluri-foc.js";
import { documentOferta, type DocumentOferta, type PozitieOferta, type TabelSpeciale } from "./document-oferta.js";
import { cuAjustare, imparte, type CerereOferta } from "./oferta.js";
import { ETICHETE_BLOCAJ, intrebareaPentru } from "./validare.js";

/**
 * Registrul de ofertă: Excelul care pleacă la client, scris din
 * `documentOferta`, deci exact ce se vede pe ecran.
 *
 * **Foaia „Ofertă”** are cadrul ofertelor semnate (284, 118, 118.1): titlul,
 * numărul, „In atentia”, „Beneficiar”, „Obiectiv”, antetul tabelului pe r15,
 * pozițiile de la r16 pe capitole, totalul, discountul, nota și semnătura.
 * Specificația noastră e scrisă cu roșu după textul clientului, ca pe casetele
 * din 284. Pe foaia asta nu e nimic intern.
 *
 * **Foaia „Pentru noi”** ține ce era pe foaia clientului și în foile „De
 * validat” / „Netarifate”: cum s-a calculat oferta (fișierul, sesiunea,
 * modelul, ajustarea, prețurile puse de mână) și pozițiile rămase afară, cu
 * motivul.
 *
 * De ce `.xlsx`: toate ofertele semnate ale firmei sunt `.xlsx`. ExcelJS se
 * încarcă leneș, ca la citire: ~940 kB n-au ce căuta în bundle-ul ecranului.
 */

const ROSU = "FFFF0000";
const BANI = "#,##0.00";

interface Coloana { titlu: string; latime: number; }

/** Logo-ul firmei, ca în antetul ofertelor semnate; în pixeli, cât îl pune firma în pagină. */
export interface LogoRegistru {
  base64: string;
  latime: number;
  inaltime: number;
}

/**
 * Coloanele tabelului, după document: codul doar cu coduri, golul doar la foc.
 * „Nr.” e mai lată când sub notă vin elementele speciale: pe ea stă „Diametru
 * Ø” și „140 - 273”, ca pe coloana A a ofertei 284.
 */
function coloane(d: DocumentOferta): Coloana[] {
  return [
    { titlu: "Nr.", latime: d.speciale.length > 0 ? 11 : 6 },
    ...(d.coloanaCod ? [{ titlu: "Cod", latime: 16 }] : []),
    { titlu: "Denumire", latime: 70 },
    { titlu: "UM", latime: 7 },
    { titlu: "Cantitate", latime: 11 },
    ...(d.coloaneGol ? [{ titlu: "Dimensiune gol", latime: 14 }, { titlu: "Suprafata (mp)", latime: 11 }] : []),
    { titlu: "Pret unitar Euro", latime: 14 },
    { titlu: "Pret total Euro", latime: 16 },
  ];
}

/** Denumirea: textul clientului (fără materialele pe care le spune specificația), apoi specificația cu roșu. */
function denumire(p: PozitieOferta): Cell["value"] {
  if (!p.specificatie) return p.textOferta;
  return { richText: [{ text: `${p.textOferta} ` }, { text: p.specificatie, font: { color: { argb: ROSU } } }] };
}

/** Eticheta umană a cauzei, plus întrebarea deschisă când există una. */
function cauzaCitita(l: LinieProcesata): string {
  if (!l.codEroare) return l.eroare ?? "—";
  const { eticheta } = ETICHETE_BLOCAJ[l.codEroare];
  const intrebare = intrebareaPentru(l.codEroare, l);
  return intrebare ? `${eticheta} (întrebarea ${intrebare} către firmă)` : eticheta;
}

/**
 * De ce e marcată o poziție cu preț. Doar notele care CER verificare: o notă
 * informativă explică prețul, dar nu e motivul pentru care poziția a rămas
 * afară, iar scrisă aici l-ar ascunde pe cel adevărat.
 */
function motivulMarcarii(l: LinieProcesata): string {
  const av = (l.avertismente ?? []).map((a) => ETICHETE_BLOCAJ[a.cod].eticheta);
  const note = (l.pret?.noteDeVerificat ?? []).map((n) => n.replace(/\s+/g, " ").trim());
  const tot = [...av, ...note];
  return tot.length > 0 ? tot.join(" · ") : `încredere ${l.extras.incredere} sub prag`;
}

/** Litera coloanei n (1 = A). Tabelul are cel mult nouă coloane. */
const litera = (n: number): string => String.fromCharCode(64 + n);

function foaiaOferta(ws: Worksheet, d: DocumentOferta): void {
  const col = coloane(d);
  const n = col.length;
  const ultima = litera(n);
  ws.columns = col.map((c) => ({ width: c.latime }));

  const intins = (rand: number, valoare: string, bold = true): void => {
    ws.getCell(`A${rand}`).value = valoare;
    ws.mergeCells(`A${rand}:${ultima}${rand}`);
    if (bold) ws.getCell(`A${rand}`).font = { bold: true };
  };

  intins(5, "OFERTA LUCRARI IZOLATII TERMICE");
  ws.getCell("A5").font = { bold: true, size: 14 };
  ws.getCell("A5").alignment = { horizontal: "center" };
  intins(7, `Nr. ${d.antet.serie}${d.antet.numar} / ${d.antet.data}`);
  ws.getCell("A7").alignment = { horizontal: "center" };
  ws.getCell("A10").value = `In atentia ${d.antet.persoana}`.trim();
  ws.getCell("A11").value = `Beneficiar : ${d.antet.client}`;
  ws.getCell("A12").value = `Obiectiv : ${d.antet.obiectiv}`;
  for (const r of [10, 11, 12]) ws.getCell(`A${r}`).font = { bold: true };

  const antet = ws.getRow(15);
  antet.values = col.map((c) => c.titlu);
  antet.font = { bold: true };
  antet.alignment = { wrapText: true, vertical: "middle" };

  const iDen = col.findIndex((c) => c.titlu === "Denumire") + 1;
  const iPU = n - 1;

  /** Un rând de total: eticheta întinsă până la penultima coloană, valoarea în ultima. */
  const total = (rand: number, eticheta: string, valoare: number): void => {
    ws.getCell(`A${rand}`).value = eticheta;
    ws.mergeCells(`A${rand}:${litera(n - 1)}${rand}`);
    ws.getCell(`${ultima}${rand}`).value = valoare;
    ws.getCell(`${ultima}${rand}`).numFmt = BANI;
    ws.getRow(rand).font = { bold: true };
  };

  let r = 16;
  const cuTitlu = d.capitole.filter((c) => c.pozitii.some((p) => p.nr !== null));
  for (const cap of cuTitlu) {
    if (cap.titlu) intins(r++, cap.titlu);
    for (const p of cap.pozitii) {
      if (p.nr === null) continue;
      const valori: Cell["value"][] = [
        p.nr, ...(d.coloanaCod ? [p.cod ?? ""] : []), denumire(p), p.um, p.cantitate,
        ...(d.coloaneGol ? [p.gol?.dimensiune ?? "", p.gol?.suprafata ?? ""] : []),
        p.pretUnitar, p.valoare,
      ];
      const rand = ws.getRow(r);
      valori.forEach((v, i) => { rand.getCell(i + 1).value = v; });
      rand.getCell(iDen).alignment = { wrapText: true, vertical: "top" };
      rand.getCell(iPU).numFmt = BANI;
      rand.getCell(n).numFmt = BANI;
      r++;
    }
    if (cap.titlu && cuTitlu.length > 1) total(r++, `Total ${cap.titlu}`, cap.subtotal);
  }

  let rand = r + 1;
  if (d.adaosFoc > 0) {
    total(rand, `ADAOS INCHIDERI GOLURI LA FOC, OFERTA INDUSTRIALA ${ADAOS_FOC_INDUSTRIAL * 100} % `
      + `(pe totalul lor de ${d.bazaFoc.toFixed(2)} €)`, d.adaosFoc);
    rand += 2;
  }
  total(rand, "TOTAL LUCRARI IZOLATII TERMICE (fara TVA)", d.total);
  if (d.discount > 0) {
    rand += 2;
    total(rand, `DISCOUNT ${d.antet.discountProcent} %` + (d.antet.discountConditie ? ` (${d.antet.discountConditie})` : ""), d.discount);
    rand += 2;
    total(rand, "TOTAL GENERAL (FARA TVA)", d.totalGeneral);
  }

  rand += 2;
  ws.getCell(`A${rand}`).value = "Nota :";
  ws.getCell(`A${rand}`).font = { bold: true };
  for (const linie of d.note) {
    ws.getCell(`A${++rand}`).value = linie;
    if (/^Nota \d+ :$/.test(linie)) ws.getCell(`A${rand}`).font = { bold: true };
  }
  for (const t of d.speciale) rand = tabelSpeciale(ws, t, col, rand + 2);

  rand += 3;
  ws.getCell(`A${rand}`).value = `${d.antet.localitate},`;
  ws.getCell(`${ultima}${rand}`).value = d.antet.firma;
  ws.getCell(`${ultima}${rand}`).alignment = { horizontal: "right" };
  ws.getCell(`A${rand + 1}`).value = d.antet.data;
  for (const c of [`A${rand}`, `${ultima}${rand}`, `A${rand + 1}`]) ws.getCell(c).font = { bold: true };
}

const CHENAR = { style: "thin" } as const;

/**
 * Un tabel de elemente speciale, de la rândul `r`, pe coloanele ofertei ca în
 * 284: o coloană a tabelului pe o coloană a foii, iar ultima întinsă până la
 * capăt când tabelul e mai îngust decât foaia. Excel nu crește singur rândul
 * cu text rupt, deci înălțimea se socotește din cel mai lung text pe lățimea
 * lui. Întoarce ultimul rând scris.
 */
function tabelSpeciale(ws: Worksheet, t: TabelSpeciale, col: Coloana[], r: number): number {
  ws.getCell(`A${r}`).value = t.titlu;
  ws.getCell(`A${r}`).font = { bold: true };
  const k = t.capete.length;
  const latimeCelula = (i: number): number =>
    i < k - 1 ? col[i]!.latime : col.slice(i).reduce((s, c) => s + c.latime, 0);
  for (const [j, valori] of [t.capete, ...t.randuri].entries()) {
    const rand = r + 1 + j;
    let linii = 1;
    valori.forEach((v, i) => {
      const cel = ws.getCell(`${litera(i + 1)}${rand}`);
      cel.value = v;
      cel.alignment = { wrapText: true, vertical: "middle", horizontal: i === 0 ? "left" : "center" };
      if (j === 0) cel.font = { bold: true };
      linii = Math.max(linii, Math.ceil(v.length / Math.max(1, latimeCelula(i) - 1)));
    });
    if (k < col.length) ws.mergeCells(`${litera(k)}${rand}:${litera(col.length)}${rand}`);
    for (let i = 1; i <= col.length; i++) ws.getCell(`${litera(i)}${rand}`).border = { top: CHENAR, left: CHENAR, bottom: CHENAR, right: CHENAR };
    if (linii > 1) ws.getRow(rand).height = 15 * linii;
  }
  return r + t.randuri.length + 1;
}

function foaiaPentruNoi(ws: Worksheet, c: CerereOferta, d: DocumentOferta): void {
  ws.columns = [{ width: 24 }, { width: 10 }, { width: 70 }, { width: 8 }, { width: 11 }, { width: 14 }, { width: 14 }, { width: 60 }];
  ws.getCell("A1").value = "Pentru noi — nu se trimite clientului";
  ws.getCell("A1").font = { bold: true, size: 13 };

  // Proveniența: peste un an listele s-au schimbat, modelul e altul, iar
  // „de unde a ieșit 13,74 pe rândul ăla?” trebuie să aibă răspuns aici.
  const ajustare = c.antet.ajustareProcent ?? 0;
  const linii = cuAjustare(c.linii, ajustare);
  const { oferta } = imparte(linii);
  const detalii: [string, string][] = [
    ["Generată la", c.provenienta.generatLa],
    ["Listele de prețuri", `destinația ${c.provenienta.destinatie}`],
    ["Model de extragere", c.provenienta.model ?? "niciunul (doar stratul determinist)"],
    ["Fișier sursă", c.provenienta.fisierSursa],
    ["Sesiune de import", c.provenienta.sesiune],
    ["În afara ofertei", `${d.numarate.de_validat} de verificat, ${d.numarate.netarifate} fără preț — mai jos`],
  ];
  if (ajustare) detalii.push(["Ajustare prețuri", `${ajustare > 0 ? "+" : ""}${ajustare} % pe toate prețurile unitare din liste`]);
  const manuale = oferta.filter((l) => l.pret && "manual" in l.pret && l.pret.manual);
  if (manuale.length > 0) {
    detalii.push(["Prețuri puse de mână", manuale
      .map((l) => `rândul ${l.bruta.rand}${l.bruta.foaie ? ` (${l.bruta.foaie})` : ""}: ${l.pret!.pret_unitar} €`)
      .join("; ")]);
  }
  ws.getCell("A3").value = "Cum a fost calculată oferta";
  ws.getCell("A3").font = { bold: true };
  detalii.forEach(([k, v], i) => {
    ws.getCell(`A${4 + i}`).value = k;
    ws.getCell(`C${4 + i}`).value = v;
  });

  let r = 4 + detalii.length + 1;
  ws.getCell(`A${r}`).value = "Poziții care nu sunt în ofertă";
  ws.getCell(`A${r}`).font = { bold: true };
  const antet = ws.getRow(++r);
  antet.values = ["Capitol", "Rândul", "Denumire", "UM", "Cantitate", "Preț propus €", "Stare", "De ce"];
  antet.font = { bold: true };
  const peIndex = new Map(linii.map((l) => [l.extras.index, l]));
  for (const cap of d.capitole) {
    for (const p of cap.pozitii) {
      if (p.nr !== null) continue;
      const l = peIndex.get(p.linie)!;
      ws.getRow(++r).values = [
        cap.titlu ?? p.sursa.foaie, `${p.sursa.foaie} r${p.sursa.rand}`,
        p.cod ? `${p.cod} · ${p.textClient}` : p.textClient, p.um, p.cantitate,
        p.pretUnitar ?? "", p.stare === "de_validat" ? "De verificat" : "Fără preț",
        p.stare === "de_validat" ? motivulMarcarii(l) : cauzaCitita(l),
      ];
      ws.getCell(`C${r}`).alignment = { wrapText: true, vertical: "top" };
    }
  }
}

/**
 * Registrul ca `ArrayBuffer`: foaia „Ofertă” pentru client și foaia „Pentru noi”.
 *
 * Logo-ul vine de la apelant (în browser, din `web/public`): modulul rămâne
 * fără I/O, ca să se testeze în Node. Ofertele semnate îl au în antetul de
 * pagină, care se vede doar la tipărire; ExcelJS nu scrie imagini în antet,
 * deci stă deasupra titlului, pe rândurile 1–4, goale și în ofertele firmei.
 */
export async function registruOferta(c: CerereOferta, o: { logo?: LogoRegistru } = {}): Promise<ArrayBuffer> {
  const { default: ExcelJS } = await import("exceljs");
  const d = documentOferta(c);
  const wb = new ExcelJS.Workbook();
  wb.creator = c.antet.firma;
  wb.created = new Date(c.provenienta.generatLa);
  // A4 pe lățimea paginii și „Pagina 1 din 3” jos, ca 284 și anexa din 2024.
  const ws = wb.addWorksheet("Ofertă", {
    pageSetup: { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    headerFooter: { oddFooter: "&CPagina &P din &N" },
  });
  foaiaOferta(ws, d);
  if (o.logo) {
    // Rândurile 1–4 cresc cât să încapă logo-ul deasupra titlului (pt = px × 0,75).
    const peRand = Math.max(15, Math.ceil((o.logo.inaltime * 0.75) / 4) + 1);
    for (let r = 1; r <= 4; r++) ws.getRow(r).height = peRand;
    const id = wb.addImage({ base64: o.logo.base64, extension: "jpeg" });
    ws.addImage(id, { tl: { col: 0, row: 0 }, ext: { width: o.logo.latime, height: o.logo.inaltime }, editAs: "oneCell" });
  }
  foaiaPentruNoi(wb.addWorksheet("Pentru noi"), c, d);
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}
