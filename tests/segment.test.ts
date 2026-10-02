/**
 * Segmentul ofertei (rezidential / industrial) pe materialele care exista
 * doar pe unul dintre ele.
 *
 * Pachetul industrial n-a adus PVC si nici inchideri goluri la foc; tabla de
 * inox a venit doar pe industrial. Pe segmentul care n-are lista, pretul vine
 * din singura care exista — nu se refuza, fiindca pozitia are pret — dar
 * trebuie SPUS, altfel o oferta industriala amesteca tacut preturi
 * rezidentiale. PVC-ul primea deja nota; inchiderile la foc nu.
 */
import { describe, it, expect } from "vitest";
import { tarifeazaGolFoc } from "../src/pricing/goluri-foc.js";
import { tarifeazaExtras } from "../src/import/nucleu.js";
import type { LinieExtrasa } from "../src/import/schema.js";

const extrasa = (p: Partial<LinieExtrasa>): LinieExtrasa => ({
  index: 1, sistem: "elastomer", diametru_valoare: 50, diametru_tip: "DN",
  grosime_mm: 13, forma: "ml", gol_latime_mm: null, gol_inaltime_mm: null,
  straturi_extra: [], incredere: 0.99, motiv: "test",
  ...p,
});

describe("inchiderile goluri la foc pe alt segment decat rezidential", () => {
  const gol = { latime_mm: 200, inaltime_mm: 200 };

  it("pe rezidential nu poarta nicio nota", () => {
    const r = tarifeazaGolFoc({ gol, cantitate: 1 });
    expect(r.note).toBeUndefined();
    expect(r.noteDeVerificat).toBeUndefined();
  });

  it("pe industrial au pretul rezidential pe produs; +20 % vine pe total, in oferta", () => {
    const rez = tarifeazaGolFoc({ gol, cantitate: 1 });
    const ind = tarifeazaGolFoc({ gol, cantitate: 1, destinatie: "industrial" });
    expect(ind.pret_unitar).toBe(rez.pret_unitar);
    expect(ind.note?.join(" ")).toContain("20 %");
    expect(ind.noteDeVerificat).toBeUndefined();
  });

  it("pe rafinarie regula nu e spusa: merg la om", () => {
    const raf = tarifeazaGolFoc({ gol, cantitate: 1, destinatie: "rafinarie" });
    expect(raf.noteDeVerificat?.join(" ")).toContain("intrebarea 14");
  });

  it("segmentul ajunge pana la ele din import", () => {
    const t = tarifeazaExtras(
      extrasa({ sistem: "goluri_foc", diametru_valoare: null, diametru_tip: null, grosime_mm: null,
        gol_latime_mm: 200, gol_inaltime_mm: 200 }),
      1, "rafinarie",
    );
    expect(t.pret?.noteDeVerificat?.length).toBe(1);
  });
});

describe("PVC pe industrial", () => {
  it("ia pretul rezidential si il marcheaza, ca inainte", () => {
    const t = tarifeazaExtras(
      extrasa({ sistem: "vata_minerala", grosime_mm: 50, straturi_extra: [{ sistem: "pvc", grosime_mm: null }] }),
      1, "industrial",
    );
    expect(t.pret?.noteDeVerificat?.join(" ")).toContain("pvc: pret din lista REZIDENTIALA");
  });
});
