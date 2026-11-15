import { describe, expect, it } from "vitest";
import {
  CHEIE_SITUATII, citesteInceputa, refaPePlan, situatiiIncepute, tineSituatia, uitaSituatia,
} from "../web/situatie-local.js";
import { deFacutLucrareToate, urmeaza, type StareLucrare } from "../web/lucrare.js";
import type { PlanSantier, Situatie } from "../src/lucrari/situatii.js";

class Depozit implements Storage {
  m = new Map<string, string>();
  get length(): number { return this.m.size; }
  clear(): void { this.m.clear(); }
  getItem(k: string): string | null { return this.m.get(k) ?? null; }
  key(i: number): string | null { return [...this.m.keys()][i] ?? null; }
  removeItem(k: string): void { this.m.delete(k); }
  setItem(k: string, v: string): void { this.m.set(k, v); }
}

const sit = (cantitati: Record<number, number>, extra: Partial<Situatie> = {}): Situatie => ({
  id: "s1", nr: 1, data: "2026-11-15T12:00:00.000Z", cantitati, ...extra,
});
const plan = (extra: Partial<PlanSantier> = {}): PlanSantier => ({
  id: "S-1", creat: "2026-11-03T08:00:00.000Z", denumire: "Hala", client: "C", firma: "RADOIA", oferta: "", fisier: "x.xlsx",
  destinatie: "rezidential", ajustareProcent: 0, discountProcent: 0, adaosFocProcent: 0,
  pozitii: [1, 2].map((nr) => ({ nr, denumire: `p${nr}`, um: "ml", cantitate: 10, pretUnitar: 1 })) as PlanSantier["pozitii"],
  situatii: [], ...extra,
});

describe("situația începută, ținută în browser", () => {
  it("se ține doar cu ceva scris; se reia; se uită la salvare sau renunțare", () => {
    const d = new Depozit();
    tineSituatia("S-1", sit({}), null, "2026-11-15T10:00:00.000Z", d);
    expect(citesteInceputa("S-1", d)).toBeNull();
    expect(d.getItem(CHEIE_SITUATII)).toBeNull();
    tineSituatia("S-1", sit({ 1: 4 }), null, "2026-11-15T10:00:00.000Z", d);
    tineSituatia("S-2", sit({}, { nota: "etaj 1" }), null, "2026-11-15T11:00:00.000Z", d);
    expect(citesteInceputa("S-1", d)?.situatie.cantitati).toEqual({ 1: 4 });
    expect(Object.keys(situatiiIncepute(d))).toEqual(["S-1", "S-2"]);
    uitaSituatia("S-1", d);
    expect(Object.keys(situatiiIncepute(d))).toEqual(["S-2"]);
    // Golită (cantitățile șterse), pleacă.
    tineSituatia("S-2", sit({}), null, "2026-11-15T12:00:00.000Z", d);
    expect(d.getItem(CHEIE_SITUATII)).toBeNull();
  });

  it("stocarea stricată sau blocată nu aruncă", () => {
    const d = new Depozit();
    d.setItem(CHEIE_SITUATII, "{nu e json");
    expect(situatiiIncepute(d)).toEqual({});
    const blocat = new Depozit();
    blocat.setItem = () => { throw new Error("QuotaExceeded"); };
    expect(() => tineSituatia("S-1", sit({ 1: 1 }), null, "x", blocat)).not.toThrow();
  });

  it("refăcută pe planul de acum: numărul următor, doar pozițiile care există; pe închis, nimic", () => {
    const x = { situatie: sit({ 1: 3, 9: 5 }), dinPoze: null, cand: "x" };
    const p = plan({ situatii: [sit({ 1: 1 }, { id: "a" })] });
    expect(refaPePlan(x, p)?.situatie).toMatchObject({ nr: 2, cantitati: { 1: 3 } });
    expect(refaPePlan(x, { ...p, inchis: "2026-11-14T00:00:00.000Z" })).toBeNull();
    expect(refaPePlan(x, undefined)).toBeNull();
  });
});

describe("situația începută pe Acasă și în „Urmează”", () => {
  const azi = "2026-11-15T10:00:00.000Z";
  const b: StareLucrare = { deVerificat: 0, areCerere: true, oferta: { numar: "RAD1", data: "01.11.2026", cand: azi } };
  const inceputa = { nr: 3, cand: azi };

  it("fără alt pas, „Urmează” zice „Continuă situația”; Acasă are un rând", () => {
    const s = { ...b, santier: { deComandat: 0, progres: 40, ultimaSituatie: azi, inceputa } };
    expect(urmeaza(s)).toMatchObject({ text: "Situația nr. 3 e începută și nesalvată.", primar: { eticheta: "Continuă situația" }, fila: "situatii" });
    const r = deFacutLucrareToate(s, azi);
    expect(r.map((x) => [x.grup, x.buton, x.fila])).toEqual([["santiere", "Continuă situația", "situatii"]]);
  });

  it("cu alt pas (de comandat), Acasă le arată pe amândouă", () => {
    const s = { ...b, santier: { deComandat: 2, progres: 40, ultimaSituatie: azi, inceputa } };
    expect(deFacutLucrareToate(s, azi).map((x) => x.buton)).toEqual(["Comandă ce lipsește", "Continuă situația"]);
    expect(deFacutLucrareToate({ ...s, santier: { ...s.santier, inceputa: undefined } }, azi).map((x) => x.buton)).toEqual(["Comandă ce lipsește"]);
  });
});
