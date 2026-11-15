import { describe, expect, it } from "vitest";
import {
  ZILE_RASPUNS, ZILE_SITUATIE, deFacutLucrare, gasesteLucrarea, lucrariDin, stadiu, stareFile, titluLucrare, urmeaza,
  zileDe, type StareLucrare,
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

  it("fila Materiale: ✓ când tot materialul e adus sau totul e executat, nu doar comandat", () => {
    const of = { numar: "RAD284", data: "27.05.2026" };
    const mat = (santier: NonNullable<StareLucrare["santier"]>): boolean => stareFile({ ...baza, oferta: of, santier }).materiale.gata;
    // Totul executat, 12 materiale necomandate: „Urmează” zice „Închide șantierul”, deci fila e gata.
    expect(mat({ deComandat: 12, neadus: 12, progres: 100 })).toBe(true);
    expect(urmeaza({ ...baza, oferta: of, santier: { deComandat: 12, neadus: 12, progres: 100 } }).primar?.eticheta).toBe("Închide șantierul");
    // Comandat tot, dar nevenit: încă nu.
    expect(mat({ deComandat: 0, neadus: 3, progres: 40 })).toBe(false);
    expect(mat({ deComandat: 0, neadus: 0, progres: 40 })).toBe(true);
    // Fără `neadus` (apelanții vechi): ca înainte, după ce e de comandat.
    expect(mat({ deComandat: 0, progres: 40 })).toBe(true);
    expect(mat({ deComandat: 2, progres: 40 })).toBe(false);
  });
});

describe("Acasă, „De făcut” (planul UX, Faza 5)", () => {
  const azi = "2026-11-15T10:00:00.000Z";
  const inainte = (zile: number): string => new Date(Date.parse(azi) - zile * 86_400_000).toISOString();
  const b: StareLucrare = { deVerificat: 0, areCerere: true };
  const of = (zile: number) => ({ numar: "RAD284", data: "27.05.2026", cand: inainte(zile) });
  const sant = (x: Partial<NonNullable<StareLucrare["santier"]>>) => ({ deComandat: 0, progres: 40, ultimaSituatie: inainte(3), ...x });

  it("fiecare pas cu butonul lui și fila unde se face; textul e cel din „Urmează”", () => {
    const cazuri: [StareLucrare, string, string][] = [
      [{ ...b, deVerificat: 2 }, "Verifică 2 poziții", "cerere"],
      [{ ...b, deVerificat: 1 }, "Verifică o poziție", "cerere"],
      [b, "Termină oferta", "oferta"],
      [{ ...b, oferta: of(ZILE_RASPUNS) }, "Notează răspunsul", "oferta"],
      [{ ...b, oferta: of(1), santier: sant({ deComandat: 3 }) }, "Comandă ce lipsește", "materiale"],
      [{ ...b, oferta: of(1), santier: sant({ deTrimis: 13 }) }, "Trimite comenzile", "materiale"],
      [{ ...b, oferta: of(1), santier: sant({ ultimaSituatie: inainte(ZILE_SITUATIE) }) }, "Fă situația", "situatii"],
      [{ ...b, oferta: of(1), santier: sant({ progres: 100, deComandat: 12 }) }, "Închide șantierul", "inchidere"],
    ];
    for (const [s, buton, fila] of cazuri) {
      const d = deFacutLucrare(s, azi)!;
      expect([d.buton, d.fila]).toEqual([buton, fila]);
      expect(d.text.startsWith(urmeaza(s).text)).toBe(true);
    }
  });

  it("oferta fără răspuns apare din prima zi, cu vechimea; după 14 zile e marcată; situația după 30", () => {
    const azi0 = deFacutLucrare({ ...b, oferta: of(0) }, azi)!;
    expect(azi0).toMatchObject({ grup: "raspuns", buton: "Notează răspunsul", fila: "oferta", zile: 0 });
    expect(azi0.text).toBe("Oferta RAD284 e făcută din 27.05.2026. Ce a răspuns clientul? Făcută azi.");
    expect(azi0.intarziat).toBeUndefined();
    expect(deFacutLucrare({ ...b, oferta: of(3) }, azi)!.text).toMatch(/Aștepți răspunsul de 3 zile\.$/);
    expect(deFacutLucrare({ ...b, oferta: of(ZILE_RASPUNS - 1) }, azi)!.intarziat).toBeUndefined();
    expect(deFacutLucrare({ ...b, oferta: of(20) }, azi)).toMatchObject({
      text: "Oferta RAD284 e făcută din 27.05.2026. Ce a răspuns clientul? Aștepți răspunsul de 20 de zile.",
      intarziat: "Întreabă clientul",
    });
    expect(deFacutLucrare({ ...b, oferta: of(1), santier: sant({ ultimaSituatie: inainte(ZILE_SITUATIE - 1) }) }, azi)).toBeNull();
    expect(deFacutLucrare({ ...b, oferta: of(1), santier: sant({ ultimaSituatie: inainte(45) }) }, azi)!.text)
      .toBe("Șantierul e în lucru: 40 % executat. Nicio situație nouă de 45 de zile.");
  });

  it("grupurile, în ordinea fluxului", () => {
    const g = (s: StareLucrare): string | undefined => deFacutLucrare(s, azi)?.grup;
    expect(g({ ...b, deVerificat: 2 })).toBe("birou");
    expect(g(b)).toBe("birou");
    expect(g({ ...b, oferta: of(0) })).toBe("raspuns");
    expect(g({ ...b, oferta: of(1), santier: sant({ deComandat: 3 }) })).toBe("santiere");
    expect(g({ ...b, oferta: of(1), santier: sant({ progres: 100 }) })).toBe("santiere");
  });

  it("ciornele netrimise: pasul e „Trimite comenzile”, spre Comenzi, după ce nu mai e nimic de comandat", () => {
    const s = { ...b, oferta: of(1), santier: sant({ deTrimis: 13 }) };
    expect(urmeaza(s)).toMatchObject({ text: "13 materiale sunt pe comenzi netrimise.", primar: { eticheta: "Trimite comenzile", act: "comenzi" } });
    expect(urmeaza({ ...s, santier: sant({ deTrimis: 1 }) }).text).toBe("Un material e pe o comandă netrimisă.");
    expect(deFacutLucrare(s, azi)!.href).toBe("#/comenzi");
    expect(urmeaza({ ...s, santier: sant({ deTrimis: 2, deComandat: 1 }) }).primar?.eticheta).toBe("Comandă ce lipsește");
    expect(urmeaza({ ...s, santier: sant({ deTrimis: 2, progres: 100 }) }).primar?.eticheta).toBe("Închide șantierul");
  });

  it("refuzată sau închisă: nimic de făcut", () => {
    expect(deFacutLucrare({ ...b, oferta: of(30), refuzat: inainte(5) }, azi)).toBeNull();
    expect(deFacutLucrare({ ...b, oferta: of(30), santier: sant({ inchis: inainte(1), progres: 100 }) }, azi)).toBeNull();
  });

  it("zilele: o dată lipsă sau stricată nu face din nimic o lucrare întârziată", () => {
    expect(zileDe(undefined, azi)).toBe(0);
    expect(zileDe("nu e dată", azi)).toBe(0);
    expect(zileDe(inainte(7), azi)).toBe(7);
  });
});
