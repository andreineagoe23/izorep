import { describe, expect, it } from "vitest";
import { REGULI_FIRMEI, santierNou, type CerereSantier } from "../web/santier-din.js";
import type { PlanSantier } from "../src/lucrari/situatii.js";
import type { StareDepozit } from "../web/depozit-local.js";

const CAND = "2026-11-14T08:00:00.000Z";
const cerere = (extra: Partial<CerereSantier> = {}, obiectiv = "TRANSAVIA ALBA-IULIA"): CerereSantier => ({
  sesiune: "c1", fisier: "transavia.xlsx", brute: [],
  oferta: {
    linii: [],
    antet: {
      serie: "RAD", numar: "284", data: "27.05.2026", persoana: "", client: "Grup Energoinstal SA", obiectiv,
      firma: "RADOIA ISOLIRUNG SRL", localitate: "PALTINIS",
    },
    provenienta: { generatLa: "2026-05-27T08:00:00.000Z", destinatie: "rezidential", model: null, sesiune: "c1", fisierSursa: "transavia.xlsx" },
  },
  ...extra,
});
let n = 0;
const acum = (planuri: PlanSantier[] = [], depozit: StareDepozit = { miscari: [], necesare: [] }) =>
  ({ planuri, depozit, id: () => `id${++n}`, cand: CAND });

describe("șantierul din ofertă, același pentru ecran și pentru demo", () => {
  it("cu id-urile date (demo) le folosește; fără ele face id-uri noi; planul e legat de cerere", () => {
    const r = santierNou(cerere(), REGULI_FIRMEI, acum(), { santier: "S-TRANSAVIA", necesar: "N-S-TRANSAVIA" });
    if ("eroare" in r) throw new Error(r.eroare);
    expect(r.plan.id).toBe("S-TRANSAVIA");
    expect(r.plan.cerere).toBe("c1");
    expect(r.plan.denumire).toBe("TRANSAVIA ALBA-IULIA");
    expect(r.depozit.necesare.map((x) => [x.id, x.santier, x.creat])).toEqual([["N-S-TRANSAVIA", "S-TRANSAVIA", CAND]]);

    const fara = santierNou(cerere(), REGULI_FIRMEI, acum());
    if ("eroare" in fara) throw new Error(fara.eroare);
    expect(fara.plan.id).toMatch(/^S-id\d+$/);
  });

  it("refăcut, păstrează id-ul șantierului și al listei și înlocuiește planul vechi", () => {
    const prim = santierNou(cerere(), REGULI_FIRMEI, acum());
    if ("eroare" in prim) throw new Error(prim.eroare);
    const din2 = santierNou(cerere(), REGULI_FIRMEI, acum(prim.planuri, prim.depozit), { santier: "S-ALTUL" });
    if ("eroare" in din2) throw new Error(din2.eroare);
    expect(din2.plan.id).toBe(prim.plan.id);
    expect(din2.planuri).toHaveLength(1);
    expect(din2.depozit.necesare.map((x) => x.id)).toEqual(prim.depozit.necesare.map((x) => x.id));
  });

  it("nu pornește: refuzată, fără obiectiv (fila Ofertă), sau cu situații pe șantierul vechi", () => {
    expect(santierNou(cerere({ refuzat: CAND }), REGULI_FIRMEI, acum())).toMatchObject({ eroare: expect.stringContaining("refuzat") });
    expect(santierNou(cerere({}, "  "), REGULI_FIRMEI, acum())).toMatchObject({ fila: "oferta" });
    const prim = santierNou(cerere(), REGULI_FIRMEI, acum());
    if ("eroare" in prim) throw new Error(prim.eroare);
    const cuSituatie = [{ ...prim.plan, situatii: [{ id: "s1", nr: 1, data: CAND, cantitati: [] }] }] as unknown as PlanSantier[];
    expect(santierNou(cerere(), REGULI_FIRMEI, acum(cuSituatie, prim.depozit))).toMatchObject({ eroare: expect.stringContaining("situații") });
  });
});
