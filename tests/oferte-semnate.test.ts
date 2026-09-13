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
    fisier: "Oferta 27.04.2026 Matari.xlsx",
    semnat: 12692.04, peOferta: 53, generat: 12692.04,
    deCe: "nimic — închiderile la foc se tarifează 100% determinist, la bănuț",
  },
  {
    fisier: "Oferta 27.04.2026.xlsx",
    semnat: 162585.99 + 7933.40, peOferta: 39, generat: 117484.07,
    deCe: "Pe 13 sep 2026, două mișcări în sensuri opuse. SCĂZUT deliberat: pozițiile la ø90 și "
        + "ø160 (SPIRO, țeavă PEHD, „Enteisungssystem Regenwasserrohre”) au preț, dar stau la 1 mm "
        + "peste rândul de dedesubt, iar oferta semnată le-a tarifat și pe acela, și pe cel de sus — "
        + "rotunjire neconfirmată, întrebarea 3 — deci merg la „De validat”. CRESCUT: șase poziții "
        + "în țoli (Ø1/2\"…Ø2\") se citeau ca ø1…ø3 și ieșeau toate la 5,70 €; unsprezece poziții "
        + "„PEHD D40x3.0” nu aveau diametru; DN80 și DN100 elastomer + vată + tablă (44,35 și "
        + "57,82 €) ieșeau cu grosime ambiguă. Toate cele noi sunt exacte față de oferta semnată. "
        + "Rămân: 3 peste maximul listei (întrebarea 4), grosimi inexistente, și DN20–DN40 de la "
        + "rândurile 44–47, pe care oferta însăși le-a tarifat cu un rând mai jos decât aceleași "
        + "țevi scrise în țoli.",
  },
  {
    fisier: "Oferta 284 Abur TRANSAVIA 27.05.2026 - tabla aluminiu.xlsx",
    semnat: 94575.06, peOferta: 85, generat: 74993.76,
    deCe: "79% din oferta semnată. Două schimbări au urcat-o de la 25%: extragerea deterministă a "
        + "început să construiască `straturi_extra` (jachetele nu se tarifau deloc), iar firma a "
        + "confirmat pe 11 sep 2026 regula „cot/teu de vată sub ø60 nu intră în preț” — cele 24 de "
        + "poziții care o foloseau nu mai sunt oprite la validare, fiindcă regula nu mai e o "
        + "presupunere a noastră. Au rămas 13 netarifate, toate `grosime_inexistenta`.",
  },
  {
    fisier: "Anexa 1 la contract - Oferta 06.12.2024.xlsx",
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
    const caz = CAZURI.find((c) => c.fisier.includes("Matari"))!;
    expect(caz.generat).toBe(caz.semnat);

    if (!existsSync(`${DIR}/${caz.fisier}`)) return;
    const { oferta } = await ruleaza(caz);
    expect(totalOferta(oferta)).toBe(caz.semnat);
  });

  it("oferta de manoperă rămâne netarifată, și se vede de ce", async () => {
    // Cea mai scumpa regresie posibila din tot testul: „acoperirea a crescut de
    // la 0 la 100%" ar arata ca un progres si ar fi de fapt un pret de 2,5-3,8
    // ori mai mare, semnat si trimis.
    const anexa = `${DIR}/Anexa 1 la contract - Oferta 06.12.2024.xlsx`;
    if (!existsSync(anexa)) return;
    const raport = await importaFisier(anexa, { faraModel: true, stoc: stocInMemorie() });
    expect(raport.randuriManopera).toBeGreaterThan(0);
    expect(raport.tarifate).toBe(0);
    expect(raport.valoareTotala).toBe(0);
  });

  it("niciun alt fișier de client nu se dă drept manoperă", async () => {
    // Semnalul trebuie sa ramana ingust: aprins pe fisierele obisnuite, ar pune
    // o alerta rosie pe importuri perfect normale si n-ar mai fi citit.
    const matari = `${DIR}/Oferta 27.04.2026 Matari.xlsx`;
    if (!existsSync(matari)) return;
    const raport = await importaFisier(matari, { faraModel: true, stoc: stocInMemorie() });
    expect(raport.randuriManopera).toBe(0);
  });
});
