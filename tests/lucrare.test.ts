import { describe, expect, it } from "vitest";
import {
  gasesteLucrarea, lucrariDin, stadiu, stareFile, titluLucrare, urmeaza, type StareLucrare,
} from "../web/lucrare.js";
import type { IntrareIstoric } from "../web/istoric.js";
import type { OfertaEmisa } from "../web/oferte-local.js";
import type { PlanSantier } from "../src/lucrari/situatii.js";

const cerere = (id: string, extra: Partial<IntrareIstoric> = {}): IntrareIstoric => ({
  id, nume: `${id}.xlsx`, marime: 1, cand: "2026-11-01T08:00:00.000Z", model: null, pozitii: 10, tarifate: 10, valoare: 100, ...extra,
});
const oferta = (extra: Partial<OfertaEmisa> = {}): OfertaEmisa => ({
  numar: "RAD284", data: "27.05.2026", client: "TRANSAVIA", obiectiv: "Abur Bucium", valoare: 100, pozitii: 10, cand: "2026-11-02T08:00:00.000Z", ...extra,
});
const plan = (id: string, extra: Partial<PlanSantier> = {}): PlanSantier => ({
  id, creat: "2026-11-03T08:00:00.000Z", denumire: `Șantier ${id}`, client: "C", firma: "RADOIA", oferta: "", fisier: "x.xlsx",
  destinatie: "rezidential", ajustareProcent: 0, discountProcent: 0, adaosFocProcent: 0, pozitii: [], situatii: [], ...extra,
});

describe("lucrările: cererea, oferta și șantierul legate", () => {
  it("leagă șantierul de cerere după id, iar pe cele vechi după fișier; un șantier fără cerere e lucrare singur", () => {
    const l = lucrariDin(
      [cerere("a"), cerere("b"), cerere("c", { nume: "vechi.xlsx" })],
      { a: oferta() },
      [plan("S-1", { cerere: "a" }), plan("S-2", { fisier: "vechi.xlsx" }), plan("S-3", { cerere: "nu-mai-e" })],
    );
    expect(l.map((x) => [x.id, x.plan?.id ?? null, !!x.oferta])).toEqual([
      ["a", "S-1", true], ["b", null, false], ["c", "S-2", false], ["S-3", "S-3", false],
    ]);
    // Adresele vechi, pe id-ul șantierului, duc la aceeași lucrare.
    expect(gasesteLucrarea(l, "S-1")?.id).toBe("a");
  });

  it("titlul e obiectivul, apoi clientul, apoi fișierul", () => {
    expect(titluLucrare({ id: "a", cerere: cerere("a"), oferta: oferta() })).toBe("Abur Bucium");
    expect(titluLucrare({ id: "a", cerere: cerere("a", { antet: { client: "NISAL" } }) })).toBe("NISAL");
    expect(titluLucrare({ id: "a", cerere: cerere("a") })).toBe("a.xlsx");
  });

  it("stadiul: de ofertat, trimisă, în lucru, închisă; refuzata e închisă", () => {
    expect(stadiu({ id: "a", cerere: cerere("a") })).toBe("de-ofertat");
    expect(stadiu({ id: "a", cerere: cerere("a"), oferta: oferta() })).toBe("trimise");
    expect(stadiu({ id: "a", cerere: cerere("a", { antet: { refuzat: "2026-11-10" } }), oferta: oferta() })).toBe("inchise");
    expect(stadiu({ id: "a", cerere: cerere("a"), oferta: oferta(), plan: plan("S") })).toBe("in-lucru");
    expect(stadiu({ id: "a", plan: plan("S", { inchis: "2026-11-12T10:00:00.000Z" }) })).toBe("inchise");
  });
});

describe("„Urmează”: un pas, în ordinea fluxului", () => {
  const baza: StareLucrare = { deVerificat: 0, areCerere: true };

  it("întâi pozițiile care cer ochi, apoi oferta", () => {
    expect(urmeaza({ ...baza, deVerificat: 2 })).toEqual({
      text: "2 poziții cer să te uiți.", fila: "cerere", primar: { eticheta: "Verifică", act: "fila", fila: "cerere" },
    });
    expect(urmeaza({ ...baza, deVerificat: 1 }).text).toBe("O poziție cere să te uiți.");
    expect(urmeaza({ ...baza, deVerificat: 21 }).text).toBe("21 de poziții cer să te uiți.");
    expect(urmeaza(baza)).toEqual({
      text: "Completează datele ofertei și descarc-o.", fila: "oferta",
      primar: { eticheta: "Mergi la ofertă", act: "fila", fila: "oferta" },
    });
  });

  it("oferta făcută întreabă ce a răspuns clientul; refuzul are data și drumul înapoi", () => {
    const u = urmeaza({ ...baza, oferta: { numar: "RAD284", data: "27.05.2026" } });
    expect(u.text).toBe("Oferta RAD284 e făcută din 27.05.2026. Ce a răspuns clientul?");
    expect(u.primar).toEqual({ eticheta: "Clientul a acceptat", act: "accepta" });
    expect(u.alb).toEqual({ eticheta: "A refuzat", act: "refuza" });
    const r = urmeaza({ ...baza, oferta: { numar: "RAD284", data: "27.05.2026" }, refuzat: "2026-11-10T09:00:00.000Z" });
    expect(r.text).toBe("Clientul a refuzat pe 10.11.2026.");
    expect(r.primar).toBeUndefined();
    expect(r.alb?.act).toBe("accepta-tarziu");
  });

  it("pe șantier: tot executat = închiderea, chiar cu material necomandat; apoi ce e de comandat; altfel situația nouă; închis, fără buton", () => {
    const of = { numar: "RAD284", data: "27.05.2026" };
    // Cu șantier, pozițiile cererii nu mai sunt pasul de acum.
    expect(urmeaza({ ...baza, deVerificat: 3, oferta: of, santier: { deComandat: 13, progres: 40 } })).toMatchObject({
      text: "13 materiale de comandat.", fila: "materiale", primar: { eticheta: "Comandă ce lipsește", fila: "materiale" },
    });
    expect(urmeaza({ ...baza, oferta: of, santier: { deComandat: 0, progres: 100 } })).toMatchObject({
      text: "Totul e executat.", fila: "inchidere", primar: { eticheta: "Închide șantierul" },
    });
    // TRANSAVIA cu „Tot restul” și nimic comandat: înainte, „12 materiale de comandat”, iar Acasă „se poate închide”.
    expect(urmeaza({ ...baza, oferta: of, santier: { deComandat: 12, progres: 100 } })).toMatchObject({
      text: "Totul e executat.", fila: "inchidere", primar: { eticheta: "Închide șantierul", fila: "inchidere" },
    });
    expect(urmeaza({ ...baza, oferta: of, santier: { deComandat: 0, progres: 37 } })).toMatchObject({
      text: "Șantierul e în lucru: 37 % executat.", fila: "situatii", primar: { eticheta: "Situație nouă", act: "situatie-noua" },
    });
    const inchis = urmeaza({ ...baza, oferta: of, santier: { deComandat: 0, progres: 100, inchis: "2026-11-12T10:00:00.000Z" } });
    expect(inchis).toEqual({ text: "Lucrare închisă pe 12.11.2026.", fila: "inchidere" });
  });

  it("filele: ✓ pe ce e gata; cele la care nu s-a ajuns spun de ce", () => {
    const f = stareFile({ ...baza, oferta: { numar: "", data: "" } });
    expect(f.cerere).toEqual({ gata: true });
    expect(f.oferta).toEqual({ gata: true });
    expect(f.materiale.inchisa).toBe("După ce acceptă clientul.");
    expect(stareFile({ ...baza, deVerificat: 2 }).situatii.inchisa).toBe("După ce faci oferta.");
    expect(stareFile({ ...baza, oferta: { numar: "", data: "" }, refuzat: "2026-11-10" }).inchidere.inchisa).toBe("Clientul a refuzat oferta.");
    expect(stareFile({ deVerificat: 0, areCerere: false, santier: { deComandat: 0, progres: 0 } }).cerere.inchisa).toBeDefined();
  });
});
