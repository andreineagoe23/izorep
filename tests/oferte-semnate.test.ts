/**
 * Acoperirea față de ofertele pe care firma le-a semnat deja.
 *
 * Astea sunt **exemplele făcute de angajați**: patru fișiere din
 * `attachments/clienti/` care poartă un rând de TOTAL cu valoare. Celelalte
 * cinci sunt cereri — n-au preț, deci n-au cu ce fi comparate.
 *
 * Ce apără testul, și e altceva decât restul suitei: `pricing.test.ts` verifică
 * **prețul pe linie**, aici se verifică **acoperirea** — câte poziții dintr-o
 * ofertă reală reușește sistemul să le ducă până la capăt, în registrul care
 * pleacă la client. Sunt două eșecuri diferite, iar al doilea nu se vedea
 * nicăieri: un fișier care se tarifează perfect pe 25% din poziții arată, în
 * toate contoarele de azi, exact ca unul care merge.
 *
 * **Cifrele de mai jos nu sunt ținte, sunt măsurători.** O acoperire sub 100%
 * nu e un bug de reparat cu orice preț — vezi `deCe` la fiecare caz. Testul e o
 * clichetă: dacă un număr **crește**, e bine, se actualizează aici. Dacă
 * **scade**, s-a stricat ceva și trebuie aflat ce, înainte de a atinge cifra.
 *
 * **De ce bucla e ÎN test și nu un `describe.runIf`:** fișierele firmei nu sunt
 * commit-uite, deci în CI nu există. Cu `describe.runIf` suita se SARE, iar CI
 * pică deliberat pe orice suită sărită — „o suită care se sare arată exact ca
 * una care trece". Același tipar ca în `golden.test.ts`: fără fișiere, testele
 * rulează, nu verifică nimic despre ele și spun asta.
 */
import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { imparte, registruOferta, totalOferta, type AntetOferta, type Provenienta } from "../web/oferta.js";
import { importaFisier } from "../src/import/pipeline.js";
import { stocInMemorie } from "../src/import/memorie.js";
import { proceseazaRegistru, reevalueaza } from "../src/import/nucleu.js";
import { parseFoi } from "../src/import/parse-workbook.js";
import { confirma } from "../web/validare.js";
import { bani } from "../src/pricing/engine.js";

const DIR = "../attachments/clienti";

const ANTET: AntetOferta = {
  serie: "RAD", numar: "0", data: "07.09.2026", persoana: "—",
  client: "—", obiectiv: "—", firma: "RADOIA ISOLIRUNG SRL", localitate: "PALTINIS",
};
const PROV: Provenienta = {
  generatLa: "2026-09-07T00:00:00.000Z", destinatie: "rezidential",
  model: null, sesiune: "test", fisierSursa: "test.xlsx",
};

interface Caz {
  fisier: string;
  /** Totalul din oferta semnată, citit din rândul ei de TOTAL. */
  semnat: number;
  /** Poziții care ajung pe foaia `Ofertă`, măsurat azi pe `--fara-model`. */
  peOferta: number;
  /** Totalul generat de noi, măsurat azi. */
  generat: number;
  /** De ce nu e 100%. Scris aici, ca cifra să nu rămână un mister. */
  deCe: string;
}

const CAZURI: Caz[] = [
  {
    fisier: "oferta-118-1-matari-goluri-foc.xlsx",
    semnat: 12692.04, peOferta: 53, generat: 12692.04,
    deCe: "nimic — închiderile la foc se tarifează 100% determinist, la bănuț",
  },
  {
    fisier: "oferta-118-nisal.xlsx",
    semnat: 162585.99 + 7933.40, peOferta: 51, generat: 163979.93,
    deCe: "Pe 13 sep 2026, două mișcări în sensuri opuse. SCĂZUT deliberat: pozițiile la ø90 și "
        + "ø160 (SPIRO, țeavă PEHD, „Enteisungssystem Regenwasserrohre”) au preț, dar stau la 1 mm "
        + "peste rândul de dedesubt, iar oferta semnată le-a tarifat și pe acela, și pe cel de sus — "
        + "rotunjire neconfirmată, întrebarea 3 — deci merg la „De validat”. CRESCUT: șase poziții "
        + "în țoli (Ø1/2\"…Ø2\") se citeau ca ø1…ø3 și ieșeau toate la 5,70 €; unsprezece poziții "
        + "„PEHD D40x3.0” nu aveau diametru; DN80 și DN100 elastomer + vată + tablă (44,35 și "
        + "57,82 €) ieșeau cu grosime ambiguă. Toate cele noi sunt exacte față de oferta semnată. "
        + "Pe 15 sep 2026, CRESCUT: rândurile 44–47 scriu „DN20” în germană și „Ø20mm” în română. "
        + "Ø20 / 25 / 32 / 40 nu e DN-ul ăla pe nicio coloană a tabelului de conversie (ISO, DIN), "
        + "e seria de PP-R, iar oferta semnată le-a tarifat pe Ø (5,79 / 5,99 / 6,15 / 8,29) — "
        + "acum la fel, în loc de un rând mai sus. „Ø32mm” și „Ø50mm” lipite de unitate (rândurile "
        + "76–77) nu se citeau deloc; acum ies exact. Rămân: 3 peste maximul listei (întrebarea 4) "
        + "și grosimi inexistente. Pe 25 sep 2026, CRESCUT (41 → 45), toate exacte față de oferta semnată: "
        + "tubulatura rectangulară în m² (UM „m²” se citea „m”) = vată 50 pe mp + tablă pe mp, 79,73 × 460; "
        + "elastomer „S=20mm” = prețul de 19 mm, DN100 / 150 / 200 (15,71 / 17,66 / 19,44). Peste ø219 "
        + "prețul vine acum din formula firmei pe mp, dar marcat (SPIRO ø250 / ø315 semnate cu 0,13 € "
        + "peste formulă). Canalul de desfumare EI60 (semnat 48 €/m²) rămâne fără preț: protecție la foc, "
        + "fără listă (întrebarea 8). Pe 8 oct 2026, CRESCUT (45 → 51): firma a răspuns „rândul de sus” la "
        + "ø90 / ø160, deci cele patru poziții (PEHD D90, DTIP8, SPIRO DN160 ×2) nu mai merg la „De validat”. "
        + "Ies pe rândul de sus (11,12 / 34,98 / 14,37), nu pe cel semnat (10,57 / 35,32 / 14,16): oferta "
        + "semnată s-a abătut de la regula pe care firma a spus-o. Tot de aici, canalul de desfumare are "
        + "preț (48 €/m², exact), dar stă la „De validat”, ca orice protecție la foc. Niciun rând fără preț.",
  },
  {
    fisier: "oferta-284-transavia-abur.xlsx",
    semnat: 94575.06, peOferta: 85, generat: 75611.04,
    deCe: "79% din oferta semnată. Două schimbări au urcat-o de la 25%: extragerea deterministă a "
        + "început să construiască `straturi_extra` (jachetele nu se tarifau deloc), iar firma a "
        + "confirmat pe 11 sep 2026 regula „cot/teu de vată sub ø60 nu intră în preț” — cele 24 de "
        + "poziții care o foloseau nu mai sunt oprite la validare, fiindcă regula nu mai e o "
        + "presupunere a noastră. Au rămas 13 netarifate, toate `grosime_inexistenta`. "
        + "Pe 25 sep 2026, SCĂZUT deliberat cu 2 (85 → 83): „Di169, g50 - COT” cu UM `ml` (r54–55) "
        + "ieșea 51,44 € „Gata”, oferta semnată are cotul, 102,88 €. Textul și UM-ul se contrazic și "
        + "dau prețuri diferite, deci merg la „De validat” (`forma_contrazisa`). Di76 COT/TEU cu UM "
        + "`ml` rămân pe ofertă: acolo coeficientul e 1, prețul e același. "
        + "Tot pe 25 sep 2026, după verificarea față de oferta semnată, CRESCUT (83 → 85): „- COT” scris "
        + "explicit bate UM-ul, cum a tarifat firma (102,88 €, 2 din 2). Cele 13 poziții cu vată 40 mm la "
        + "DN15 / Di21 au acum preț exact (celula 22|40 dedusă proporțional: 47,41 și 25,68), dar stau la "
        + "„De validat” — o singură valoare dovedită (întrebarea 18). Rămâne netarifat doar distribuitorul "
        + "de abur (2.296,70, echipament la comandă). Toate cele 98 de prețuri calculate sunt exacte. "
        + "Pe 8 oct 2026, și distribuitorul are preț: suprafața lui × prețul pe mp × factorul dedus din chiar "
        + "oferta asta (2.296,70, exact), la „De validat”. Toate cele 99 de prețuri sunt exacte; după "
        + "confirmare, totalul e 94.575,06.",
  },
  {
    fisier: "oferta-manopera-anexa-contract-2024.xlsx",
    semnat: 706.90, peOferta: 0, generat: 0,
    deCe: "ofertă de MANOPERĂ pură (2,20 / 2,30 / 3,00 €/ml), listă pe care motorul nu o are. "
        + "Zero e răspunsul CORECT: tarifată din matricea material+manoperă, aceeași poziție iese "
        + "de 2,5-3,8 ori prețul semnat (ø22 g13 = 5,99 € față de 2,30 €). Vezi `randuriManopera`.",
  },
];

const prezente = CAZURI.filter((c) => existsSync(`${DIR}/${c.fisier}`));

const ruleaza = async (caz: Caz) => {
  const raport = await importaFisier(`${DIR}/${caz.fisier}`, {
    faraModel: true, stoc: stocInMemorie(),
  });
  return { raport, ...imparte(raport.linii) };
};

describe("acoperirea față de ofertele semnate", () => {
  it("tabelul de cazuri e coerent", () => {
    // Ruleaza si fara fisierele firmei: verifica fixtura in sine, nu importul.
    // Fara el, in CI toata suita ar trece fara sa fi afirmat nimic.
    for (const c of CAZURI) {
      expect(c.semnat, `${c.fisier}: total semnat`).toBeGreaterThan(0);
      expect(c.deCe.length, `${c.fisier}: fara explicatie pentru cifra`).toBeGreaterThan(20);
      expect(c.generat, `${c.fisier}: generat peste semnat`).toBeLessThanOrEqual(c.semnat + 0.01);
      expect(c.peOferta, `${c.fisier}: pozitii negative`).toBeGreaterThanOrEqual(0);
      // O acoperire nenula fara nicio pozitie pe oferta (sau invers) ar
      // insemna ca tabelul a fost actualizat pe jumatate.
      expect(c.peOferta === 0, `${c.fisier}: pozitii si total nu se potrivesc`)
        .toBe(c.generat === 0);
    }
  });

  it("fiecare ofertă semnată duce exact atâtea poziții pe foaia Ofertă", async () => {
    for (const caz of prezente) {
      const { oferta } = await ruleaza(caz);
      expect(oferta.length, `${caz.fisier} — dacă a CRESCUT, actualizează cifra; dacă a SCĂZUT, s-a stricat ceva. ${caz.deCe}`)
        .toBe(caz.peOferta);
    }
  });

  it("totalul generat rămâne cel măsurat", async () => {
    for (const caz of prezente) {
      const { oferta } = await ruleaza(caz);
      expect(totalOferta(oferta), `${caz.fisier} (semnat: ${caz.semnat.toFixed(2)} €)`)
        .toBeCloseTo(caz.generat, 2);
    }
  });

  it("registrul scris pe disc are exact totalul calculat", async () => {
    // Nu e redundant cu testul de mai sus: acolo se verifica functia pura, aici
    // ce ajunge CHIAR in fisierul care pleaca la client. Intre ele stau
    // scrierea randurilor si randul de TOTAL, adica exact locul unde o pozitie
    // se poate pierde fara ca vreun contor sa se miste.
    const ExcelJS = (await import("exceljs")).default;
    for (const caz of prezente) {
      const { raport } = await ruleaza(caz);
      const buf = await registruOferta({ linii: raport.linii, antet: ANTET, provenienta: PROV });
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buf);
      const ws = wb.getWorksheet("Ofertă")!;

      const valori: number[] = [];
      let randTotal = 0;
      ws.eachRow((r, n) => {
        if (n < 16) return;
        if (String(r.getCell(1).value ?? "").startsWith("TOTAL")) { randTotal = n; return; }
        const v = r.getCell(6).value;
        if (typeof v === "number" && !randTotal) valori.push(v);
      });

      expect(valori, caz.fisier).toHaveLength(caz.peOferta);
      if (caz.peOferta > 0) {
        expect(Number(ws.getCell(`F${randTotal}`).value), caz.fisier).toBeCloseTo(caz.generat, 2);
        expect(Math.round(valori.reduce((s, v) => s + v, 0) * 100) / 100, caz.fisier)
          .toBeCloseTo(caz.generat, 2);
      }
    }
  });

  it("Matari reproduce oferta semnată la bănuț", async () => {
    // Singurul caz la 100%, si de-aia e scris separat: e dovada ca lantul
    // import -> tarifare -> registru chiar poate reproduce un document semnat.
    // Celelalte trei masoara cat mai lipseste pana acolo.
    const caz = CAZURI.find((c) => c.fisier.includes("matari"))!;
    expect(caz.generat).toBe(caz.semnat);

    if (!existsSync(`${DIR}/${caz.fisier}`)) return;
    const { oferta } = await ruleaza(caz);
    expect(totalOferta(oferta)).toBe(caz.semnat);
  });

  it("oferta de manoperă rămâne netarifată, și se vede de ce", async () => {
    // Cea mai scumpa regresie posibila din tot testul: „acoperirea a crescut de
    // la 0 la 100%" ar arata ca un progres si ar fi de fapt un pret de 2,5-3,8
    // ori mai mare, semnat si trimis.
    const anexa = `${DIR}/oferta-manopera-anexa-contract-2024.xlsx`;
    if (!existsSync(anexa)) return;
    const raport = await importaFisier(anexa, { faraModel: true, stoc: stocInMemorie() });
    expect(raport.randuriManopera).toBeGreaterThan(0);
    expect(raport.tarifate).toBe(0);
    expect(raport.valoareTotala).toBe(0);
  });

  it("niciun alt fișier de client nu se dă drept manoperă", async () => {
    // Semnalul trebuie sa ramana ingust: aprins pe fisierele obisnuite, ar pune
    // o alerta rosie pe importuri perfect normale si n-ar mai fi citit.
    const matari = `${DIR}/oferta-118-1-matari-goluri-foc.xlsx`;
    if (!existsSync(matari)) return;
    const raport = await importaFisier(matari, { faraModel: true, stoc: stocInMemorie() });
    expect(raport.randuriManopera).toBe(0);
  });
});

describe("cererea TRANSAVIA importată reproduce Oferta 284 semnată", () => {
  // Singura pereche cerere → ofertă pe aceleași rânduri: ce a trimis clientul
  // și ce a semnat firma pe el. Importul cererii trebuie să dea, poziție cu
  // poziție, prețul unitar din oferta semnată — deși cererea nu scrie grosimea
  // casetelor (o ia de la conducta de același diametru), are un „- COT” cu UM
  // `ml` și un „tabla dealuminiu” lipit.
  const CERERE = `${DIR}/cerere-de-oferta-transavia-abur.xlsx`;
  const OFERTA = `${DIR}/oferta-284-transavia-abur.xlsx`;

  it("99 de prețuri exacte din 99, inclusiv distribuitorul de abur; niciun rând fără preț", async () => {
    if (!existsSync(CERERE) || !existsSync(OFERTA)) return;
    const poz = async (f: string) => (await importaFisier(f, { faraModel: true, stoc: stocInMemorie() }))
      .linii.filter((l) => l.extras.sistem !== null);
    const cerere = await poz(CERERE);
    const oferta = await poz(OFERTA);
    expect(cerere).toHaveLength(oferta.length);

    const diferite: string[] = [];
    const faraPret: string[] = [];
    cerere.forEach((l, i) => {
      // Rândul ofertei: … | cantitate | preț unitar | preț total.
      const numere = oferta[i]!.bruta.celule.filter((c): c is number => typeof c === "number");
      const semnat = numere[numere.length - 2]!;
      if (!l.pret) faraPret.push(l.bruta.text);
      else if (Math.abs(l.pret.pret_unitar - semnat) >= 0.005) {
        diferite.push(`r${l.bruta.rand}: ${l.pret.pret_unitar} față de ${semnat} — ${l.bruta.text}`);
      }
    });
    expect(diferite).toEqual([]);
    expect(faraPret).toEqual([]);
  });
});

describe("registrul generat din cererea TRANSAVIA are rândurile Ofertei 284", () => {
  const CERERE = `${DIR}/cerere-de-oferta-transavia-abur.xlsx`;
  const OFERTA = `${DIR}/oferta-284-transavia-abur.xlsx`;

  it("după „Confirmă toate”: aceleași coloane și numere, rând cu rând, și totalul semnat", async () => {
    if (!existsSync(CERERE) || !existsSync(OFERTA)) return;
    const cerere = await importaFisier(CERERE, { faraModel: true, stoc: stocInMemorie() });
    // „Confirmă toate cele 13” din ecran: pozițiile cu preț nu mai cer validare.
    const confirmate = cerere.linii.map((l) => (l.pret ? { ...l, necesitaValidare: false } : l));
    const buf = await registruOferta({ linii: confirmate, antet: ANTET, provenienta: PROV });
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);
    const ws = wb.getWorksheet("Ofertă")!;

    const semnate = (await importaFisier(OFERTA, { faraModel: true, stoc: stocInMemorie() })).linii
      .filter((l) => l.extras.sistem !== null)
      .map((l) => l.bruta.celule);
    const generate: unknown[][] = [];
    ws.eachRow((r, n) => {
      if (n > 15 && typeof r.getCell(6).value === "number" && !String(r.getCell(1).value).startsWith("TOTAL")) {
        generate.push([1, 2, 3, 4, 5, 6].map((c) => r.getCell(c).value));
      }
    });

    expect(generate).toHaveLength(semnate.length);
    generate.forEach((g, i) => {
      const s = semnate[i]!;
      const cum = `rândul ${i + 16}: ${String(g[1])}`;
      expect(g[0], cum).toBe(s[0]);                                   // Identificare_Norma
      expect(g[2], cum).toBe(s[2]);                                   // UM
      expect(g[3], cum).toBe(s[3]);                                   // cantitate
      expect(g[4], cum).toBe(s[4]);                                   // preț unitar
      expect(g[5] as number, cum).toBeCloseTo(s[5] as number, 4);     // total pe linie, exact ca în ofertă
      const gr = /gr\. (\d+) mm/.exec(String(s[1]));
      if (gr) expect(String(g[1]), cum).toContain(`gr. ${gr[1]} mm`);
    });

    let total = 0;
    ws.eachRow((r) => { if (String(r.getCell(1).value).startsWith("TOTAL LUCRARI")) total = Number(r.getCell(6).value); });
    expect(total).toBe(94575.06);
  });
});

describe("prețul pus de om închide oferta semnată", () => {
  const CERERE = `${DIR}/cerere-de-oferta-transavia-abur.xlsx`;

  it("cererea TRANSAVIA + distribuitorul de abur pus de mână (2.296,70) = totalul Ofertei 284", async () => {
    if (!existsSync(CERERE)) return;
    const fara = await importaFisier(CERERE, { faraModel: true, stoc: stocInMemorie() });
    const distribuitor = fara.linii.find((l) => /DISTRIBUITOR ABUR/.test(l.bruta.text))!;
    // Are preț din regula echipamentului, dar merge la om: o singură valoare semnată.
    expect(distribuitor.necesitaValidare).toBe(true);

    const cerere = await importaFisier(CERERE, {
      faraModel: true, stoc: stocInMemorie(), preturiManuale: new Map([[distribuitor.extras.index, 2296.70]]),
    });
    const d = cerere.linii.find((l) => l.extras.index === distribuitor.extras.index)!;
    expect(d.pret!.pret_unitar).toBe(2296.70);
    expect(d.necesitaValidare).toBe(false);
    expect(d.pret!.note!.join(" ")).toContain("pus de om");

    // „Confirmă toate cele 13”, ca în ecran.
    const confirmate = cerere.linii.map((l) => (l.pret ? { ...l, necesitaValidare: false } : l));
    expect(totalOferta(imparte(confirmate).oferta)).toBe(94575.06);
  });
});

describe("confirmarea din ecran nu scoate prețul pozițiilor care depind de textul rândului", () => {
  // „Confirmă toate cele 14” pune `sursa: "om"`, iar linia omului se tarifa
  // fără textul rândului: distribuitorul de abur (echipament, D și L din text)
  // rămânea „Lipsește diametrul”, iar oferta ieșea 92.278,36 în loc de 94.575,06.
  const CERERE = `${DIR}/cerere-de-oferta-transavia-abur.xlsx`;

  it("TRANSAVIA, toate confirmate: 94.575,06 € și niciun rând fără preț", async () => {
    if (!existsSync(CERERE)) return;
    const opt = { stoc: stocInMemorie() };
    const rez = await proceseazaRegistru(await parseFoi(CERERE), opt);
    const deConfirmat = rez.linii.filter((l) => l.pret && l.necesitaValidare).map((l) => l.extras.index);
    expect(deConfirmat).toHaveLength(14);
    confirma(deConfirmat, rez.rezolvate);
    reevalueaza(rez, opt);
    const { oferta, deValidat, netarifate } = imparte(rez.linii);
    expect(netarifate.map((l) => l.bruta.text)).toEqual([]);
    expect(deValidat).toEqual([]);
    expect(totalOferta(oferta)).toBe(94575.06);
  });
});
