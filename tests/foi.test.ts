/**
 * Grila 1:1 a registrului — ce vede omul de la tehnic in ecranul de import.
 *
 * Cazurile de aici nu sunt inventate: fiecare reproduce forma unui fisier real
 * primit de la un client, cu randul de antet exact unde sta in fisierul ala.
 * Antetul NU e pe pozitie fixa nicaieri, deci regula care il gaseste e o
 * euristica — si o euristica fara teste se strica tacut, la urmatorul fisier.
 *
 * Registrele se construiesc in memorie, nu se citesc din `../attachments/`:
 * fisierele firmei nu sunt commit-uite, iar un test care depinde de ele nu
 * ruleaza in CI.
 */
import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import { parseFoiBuffer, liniile, esteRandAntet } from "../src/import/parse-workbook.js";

type Celula = string | number | null;

/** Construieste un registru din randuri brute, cu imbinarile cerute. */
async function registru(
  foi: { nume: string; randuri: Celula[][]; imbinari?: string[] }[],
): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  for (const f of foi) {
    const ws = wb.addWorksheet(f.nume);
    f.randuri.forEach((r, i) => { ws.getRow(i + 1).values = r as ExcelJS.CellValue[]; });
    for (const m of f.imbinari ?? []) ws.mergeCells(m);
  }
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}

describe("randul de antet se gaseste acolo unde e, nu unde ne-ar conveni", () => {
  it("Radoia: antet pe r6, sub patru randuri de metadate imbinate", async () => {
    // ["", "Nume proiect", "SPITAL…"×3] — doua valori distincte intinse pe
    // cinci coloane. Fara desfacerea imbinarii ar parea un rand de 4 celule.
    const foi = await parseFoiBuffer(await registru([{
      nume: "izolatie",
      randuri: [
        ["", "Nume proiect", "SPITAL REGINA MARIA", null, null],
        ["", "Localitate", "Modul 3", null, null],
        ["", "Garantie", "3 ani", null, null],
        ["", "Termen oferta", "04.09.2026", null, null],
        [],
        ["Numar curent", "Denumire articol", "UM", "Cantitate", "Observatii"],
        [],
        ["1.1", "Izolatie vata minerala DN15", "ml", 8004, ""],
      ],
      imbinari: ["C1:E1", "C2:E2", "C3:E3", "C4:E4"],
    }]));

    expect(foi).toHaveLength(1);
    expect(foi[0]!.nume).toBe("izolatie");
    expect(foi[0]!.antet?.rand).toBe(6);
    expect(foi[0]!.antet?.celule.map((c) => c.v)).toEqual([
      "Numar curent", "Denumire articol", "UM", "Cantitate", "Observatii",
    ]);
  });

  it("Matari: antet pe r14, sub un titlu imbinat peste sase coloane", async () => {
    const foi = await parseFoiBuffer(await registru([{
      nume: "Matari",
      randuri: [
        ["OFERTA LUCRARI IZOLATII TERMICE", null, null, null, null, null],
        [],
        ["Beneficiar : NISAL SRL"],
        ["Nr. Crt.", "Denumire", "UM", "Cantitate", "dimensiune gol", "suprafata"],
        ["1", "Teava OL/OLZN DN15", "buc", 6, "130/130", 0.017],
      ],
      imbinari: ["A1:F1"],
    }]));

    // Titlul imbinat e o singura celula cu span 6, nu sase celule identice —
    // altfel ar trece drept antet, fiind primul rand "plin" din foaie.
    expect(foi[0]!.randuri[0]!.celule).toEqual([{ v: "OFERTA LUCRARI IZOLATII TERMICE", span: 6 }]);
    expect(foi[0]!.antet?.celule[0]?.v).toBe("Nr. Crt.");
  });

  it("Transavia: foaie fara antet — se intoarce fara antet, nu cu unul ghicit", async () => {
    // Datele incep de la primul rand. Un antet "gasit" aici ar fi o pozitie
    // reala mutata din tabel in capul tabelului, adica o linie disparuta.
    const foi = await parseFoiBuffer(await registru([{
      nume: "Sheet1",
      randuri: [
        ["IZOLATII", null, null, null, null],
        [1, "IZOLATII", "Izolatii cu vata minerala caserata Ø15", "ml", 45],
        [2, "IZOLATII", "Izolatii cu vata minerala caserata Ø20", "buc", 30],
      ],
    }]));

    expect(foi[0]!.antet).toBeUndefined();
    expect(foi[0]!.randuri).toHaveLength(3);
  });

  it("randul de numerotare a coloanelor (1 2 3 4) nu e antet", async () => {
    // In Flower City si Book15, sub antetul real sta un rand "1 2 3 4 5" care
    // numeroteaza coloanele. Are multe celule scurte, deci trece toate
    // celelalte reguli.
    expect(esteRandAntet([
      { v: "Nr. Articol", span: 1 }, { v: "Descriere articol", span: 1 }, { v: "Unitate de masura", span: 1 },
    ])).toBe(true);
    expect(esteRandAntet([
      { v: "1", span: 1 }, { v: "2", span: 1 }, { v: "3", span: 1 }, { v: "4", span: 1 },
    ])).toBe(false);
  });

  it("o eticheta lunga e permisa, un rand de descrieri nu", async () => {
    // Antetul real din `Oferta 27.04.2026` are o celula de 87 de caractere.
    // Un prag de 60 il taia; de-aia limita e "cel mult o eticheta lunga".
    const lunga = "DENUMIRE MATERIAL, DATE TEHNICE, OPERATIUNI INCLUSE IN ARTICOL (U_Center 3 - PTh)";
    expect(esteRandAntet([
      { v: "Nr.", span: 1 }, { v: lunga, span: 1 }, { v: "Cant.", span: 1 }, { v: "U.M.", span: 1 },
    ])).toBe(true);
    expect(esteRandAntet([
      { v: lunga, span: 1 }, { v: `${lunga} varianta 2`, span: 1 }, { v: "buc", span: 1 },
    ])).toBe(false);
  });
});

describe("grila si pipeline-ul raman aceleasi randuri", () => {
  it("indexul liniei e acelasi in grila si in lista trimisa la extragere", async () => {
    // Ecranul ataseaza coloanele extrase de AI pe randul din grila dupa
    // `index`. Daca numerotarea ar fi facuta de doua ori, in doua parcurgeri,
    // randul din tabel si linia extrasa ar putea ajunge sa fie randuri
    // diferite — exact genul de eroare care se vede abia in oferta trimisa.
    const foi = await parseFoiBuffer(await registru([
      {
        nume: "foaia unu",
        randuri: [
          ["Nr", "Denumire articol", "UM", "Cantitate"],
          ["1", "Izolatie elastomer DN15 grosime 13", "ml", 187],
          ["2", "Izolatie elastomer DN20 grosime 13", "ml", 360],
        ],
      },
      {
        nume: "foaia doi",
        randuri: [["3", "Izolatie vata minerala DN25 grosime 30", "ml", 1550]],
      },
    ]));

    const linii = liniile(foi);
    expect(linii.map((l) => l.index)).toEqual([0, 1, 2, 3]);
    expect(linii.map((l) => l.foaie)).toEqual(["foaia unu", "foaia unu", "foaia unu", "foaia doi"]);

    // Aceleasi obiecte, nu copii: o corectie facuta pe grila se vede in linia
    // pe care o primeste extragerea.
    const dinGrila = foi.flatMap((f) => f.randuri.flatMap((r) => (r.linie ? [r.linie] : [])));
    expect(dinGrila[2]).toBe(linii[2]);
  });

  it("imbinarea se desface doar in grila; `celule` pastreaza valoarea repetata", async () => {
    // `esteAntetSectiune` recunoaste antetul de sectiune dupa valoarea
    // repetata pe rand. Desfacuta si acolo, extragerea inchiderilor goluri la
    // foc pierde sectiunea si, cu ea, 53 de pozitii reale.
    const foi = await parseFoiBuffer(await registru([{
      nume: "goluri",
      randuri: [["Treceri prin pereti rezistenti la foc EI30", null, null, null]],
      imbinari: ["A1:D1"],
    }]));

    expect(foi[0]!.randuri[0]!.celule).toEqual([
      { v: "Treceri prin pereti rezistenti la foc EI30", span: 4 },
    ]);
    expect(foi[0]!.randuri[0]!.linie?.celule).toEqual([
      "Treceri prin pereti rezistenti la foc EI30",
      "Treceri prin pereti rezistenti la foc EI30",
      "Treceri prin pereti rezistenti la foc EI30",
      "Treceri prin pereti rezistenti la foc EI30",
    ]);
  });
});
