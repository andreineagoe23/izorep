/**
 * Ce vede fiecare rol. Santierul are un meniu scurt, fara ecranele cu preturi;
 * biroul si contabilitatea vad tot.
 */
import { describe, expect, it } from "vitest";
import { MENIU, ROLURI, areAcces, meniuPentru } from "../web/nav.js";

const toateEcranele = MENIU.flatMap((g) => g.itemi.map((i) => i.id));

describe("rolurile", () => {
  it("sunt trei: birou, santier, contabilitate", () => {
    expect(ROLURI.map((r) => r.id)).toEqual(["birou", "santier", "contabilitate"]);
  });

  it("biroul si contabilitatea vad tot meniul", () => {
    for (const rol of ["birou", "contabilitate"] as const) {
      expect(meniuPentru(rol).flatMap((g) => g.itemi.map((i) => i.id))).toEqual(toateEcranele);
    }
  });

  it("santierul vede doar tabloul, lucrarile si depozitul", () => {
    expect(meniuPentru("santier").flatMap((g) => g.itemi.map((i) => i.id))).toEqual(["tablou", "lucrari", "stoc"]);
    for (const ecran of ["deviz", "import", "preturi", "documente", "clienti"]) {
      expect(areAcces(ecran, "santier")).toBe(false);
    }
  });

  it("un grup ramas fara itemi dispare din meniu", () => {
    expect(meniuPentru("santier").map((g) => g.titlu)).toEqual(["Zi de zi"]);
  });

  it("ecranele permise santierului exista in meniu", () => {
    const santier = ROLURI.find((r) => r.id === "santier")!;
    for (const ecran of santier.ecrane ?? []) expect(toateEcranele).toContain(ecran);
  });
});
