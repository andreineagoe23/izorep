/**
 * Etapa 7 (`docs/plan-dupa-demo.md`, 26 noiembrie 2026): mărunțișurile rămase
 * din predări, pe rândurile din `exemple-AI/`.
 */
import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { parseFoi } from "../src/import/parse-workbook.js";
import { proceseazaRegistru } from "../src/import/nucleu.js";
import { mapariStatice } from "../src/import/mapari-statice.js";
import { stocInMemorie } from "../src/import/memorie.js";
import { clientPropus, umLinie } from "../web/oferta.js";
import { rezumatVerificare } from "../web/import/oferta-vizual.js";
import { ecranOferta } from "../web/import/vizual.js";

const EX1 = join(__dirname, "../exemple-AI/exemplu-1-abur-industrial/1-cerere-de-oferta-fabrica-demo-abur.xlsx");

describe("mărunțișurile din Etapa 7", () => {
  it("titlul lucrării nu ia numărul de ordine din numele fișierului", () => {
    expect(clientPropus("1-cerere-de-oferta-fabrica-demo-abur.xlsx")).toBe("Fabrica Demo Abur");
    expect(clientPropus("cerere-de-oferta-transavia-abur.xlsx")).toBe("Transavia Abur");
    // Un număr în fața numelui e al documentului (ca „oferta 118”), nu al clientului.
    expect(clientPropus("118 Nisal.xlsx")).toBe("Nisal");
    // Fără litere după el, rămâne: altfel titlul ar fi gol.
    expect(clientPropus("2026.xlsx")).toBe("2026");
  });

  it("„Di60, g40 - ML” fără coloană de UM: în ofertă scrie ml", async () => {
    const rez = await proceseazaRegistru(await parseFoi(EX1), { stoc: stocInMemorie(), mapari: mapariStatice(), destinatie: "industrial" });
    const l = rez.linii.find((x) => /Di60, g40 - ML/.test(x.bruta.text) && !x.bruta.um);
    expect(l).toBeDefined();
    expect(umLinie(l!)).toBe("ml");
    // Cu UM scris de client, rămâne al lui.
    const cu = rez.linii.find((x) => x.bruta.um && x.pret)!;
    expect(umLinie(cu)).toBe(cu.bruta.um!.trim());
  });

  it("propoziția de pe fila Cerere spune și rândurile rămase afară", () => {
    const n = { toate: 10, gata: 10, de_validat: 0, netarifate: 0 };
    expect(rezumatVerificare(n, 2)).toContain("Toate cele 10 au preț. 2 rânduri cu cantitate au rămas afară");
    expect(rezumatVerificare(n)).not.toContain("afară");
    expect(rezumatVerificare({ ...n, gata: 8, netarifate: 2 }, 1)).toContain("Un rând cu cantitate a rămas afară");
  });

  it("obiectivul e obligatoriu la descărcare: șantierul se numește după el", () => {
    const h = ecranOferta({
      gata: 1, valoare: 1, adaosFoc: 0, ajustare: 0, deVerificat: 0, faraPret: 0, destinatie: "rezidential",
      antet: { firma: "radoia", numar: "1", data: "", client: "", obiectiv: "", persoana: "", localitate: "", discount: 0 },
      firme: [], eroare: "",
    });
    expect(h).toMatch(/name="obiectiv"[^>]*required/);
  });
});
