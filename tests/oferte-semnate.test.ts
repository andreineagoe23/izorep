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
 * nu e un bug de reparat cu orice preț — vezi comentariul fiecărui caz, unde
 * scrie ce anume lipsește. Testul e o clichetă: dacă un număr **crește**, e
 * bine, se actualizează aici. Dacă **scade**, s-a stricat ceva și trebuie
 * aflat ce, înainte de a atinge cifra.
 *
 * Rulează doar cu fișierele firmei pe disc (nu sunt commit-uite), ca restul
 * suitelor care ating `../attachments/`.
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
    semnat: 162585.99 + 7933.40, peOferta: 29, generat: 92609.35,
    deCe: "8 poziții SPIRO marcate (întrebarea 10), 4 DN inexistent, 3 peste maximul listei "
        + "(întrebarea 4), 5 grosime inexistentă. Prețurile pe liniile care ies sunt corecte; "
        + "lipsește ce motorul refuză deliberat să ghicească.",
  },
  {
    fisier: "Oferta 284 Abur TRANSAVIA 27.05.2026 - tabla aluminiu.xlsx",
    semnat: 94575.06, peOferta: 61, generat: 23787.78,
    deCe: "24 din cele 37 netarifate sunt întrebarea 9 (cot/teu de vată pe banda 18-60). Regula "
        + "există în motor, dar lucrează pe poziții COMPUSE, iar calea deterministă nu construiește "
        + "`straturi_extra` — deci cifra asta e un artefact al lui `--fara-model`, nu plafonul real. "
        + "Restul de 13 sunt grosimi inexistente în listă.",
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

describe.runIf(prezente.length > 0)("acoperirea față de ofertele semnate", () => {
  for (const caz of prezente) {
    describe(caz.fisier, () => {
      const ruleaza = async () => {
        const raport = await importaFisier(`${DIR}/${caz.fisier}`, {
          faraModel: true, stoc: stocInMemorie(),
        });
        return { raport, ...imparte(raport.linii) };
      };

      it(`duce ${caz.peOferta} poziții pe foaia Ofertă`, async () => {
        const { oferta } = await ruleaza();
        expect(oferta.length, `dacă a CRESCUT, actualizează cifra; dacă a SCĂZUT, s-a stricat ceva. ${caz.deCe}`)
          .toBe(caz.peOferta);
      });

      it(`totalul generat e ${caz.generat.toFixed(2)} € din ${caz.semnat.toFixed(2)} € semnate`, async () => {
        const { oferta } = await ruleaza();
        expect(totalOferta(oferta)).toBeCloseTo(caz.generat, 2);
      });

      it("registrul scris pe disc are exact totalul calculat", async () => {
        // Nu e redundant cu testul de mai sus: acolo se verifica functia pura,
        // aici ce ajunge CHIAR in fisierul care pleaca la client. Intre ele
        // stau scrierea randurilor si rândul de TOTAL, adica exact locul unde
        // o pozitie se poate pierde fara ca vreun contor sa se miste.
        const { raport, oferta } = await ruleaza();
        const buf = await registruOferta({ linii: raport.linii, antet: ANTET, provenienta: PROV });
        const ExcelJS = (await import("exceljs")).default;
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

        expect(valori).toHaveLength(caz.peOferta);
        if (caz.peOferta > 0) {
          expect(Number(ws.getCell(`F${randTotal}`).value)).toBeCloseTo(caz.generat, 2);
          expect(Math.round(valori.reduce((s, v) => s + v, 0) * 100) / 100).toBeCloseTo(caz.generat, 2);
        }
        expect(totalOferta(oferta)).toBeCloseTo(caz.generat, 2);
      });
    });
  }

  it("Matari reproduce oferta semnată la bănuț", async () => {
    // Singurul caz la 100%, si de-aia e scris separat: e dovada ca lantul
    // import -> tarifare -> registru chiar poate reproduce un document semnat.
    // Celelalte trei masoara cat mai lipseste pana acolo.
    const caz = prezente.find((c) => c.fisier.includes("Matari"));
    if (!caz) return;
    expect(caz.generat).toBe(caz.semnat);
  });
});

/**
 * Fișierul de manoperă nu trebuie să înceapă tăcut să se tarifeze.
 *
 * E cea mai scumpă regresie posibilă din tot testul ăsta: „acoperirea a crescut
 * de la 0 la 100%" ar arăta ca un progres și ar fi de fapt un preț de 2,5-3,8
 * ori mai mare, semnat și trimis.
 */
describe.runIf(existsSync(`${DIR}/Anexa 1 la contract - Oferta 06.12.2024.xlsx`))(
  "oferta de manoperă rămâne netarifată, și se vede de ce", () => {
    it("se recunoaște ca manoperă și nu produce niciun preț", async () => {
      const raport = await importaFisier(`${DIR}/Anexa 1 la contract - Oferta 06.12.2024.xlsx`, {
        faraModel: true, stoc: stocInMemorie(),
      });
      expect(raport.randuriManopera).toBeGreaterThan(0);
      expect(raport.tarifate).toBe(0);
      expect(raport.valoareTotala).toBe(0);
    });

    it("niciun alt fișier de client nu se dă drept manoperă", async () => {
      // Semnalul trebuie sa ramana ingust: aprins pe fisierele obisnuite, ar
      // pune o alerta rosie pe importuri perfect normale si n-ar mai fi citit.
      const raport = await importaFisier(`${DIR}/Oferta 27.04.2026 Matari.xlsx`, {
        faraModel: true, stoc: stocInMemorie(),
      });
      expect(raport.randuriManopera).toBe(0);
    });
  });
