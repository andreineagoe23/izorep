/**
 * Notitele de santier: de la termenii cititi din poza la pozitii tarifate.
 *
 * Modelul nu ruleaza aici. Se testeaza ce face codul cu ce a citit modelul —
 * suma, textul pentru motor, tarifarea — si ca referinta transcrisa a pozelor
 * Ecoterm trece integral prin motor. Pozele nu sunt in repo; comparatia intre
 * modele e `npm run compara-poze`.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { agrega, formula, type RandSantier } from "../src/santier/agrega.js";
import { spreCerere, textRand, MARCA_PRET_DUBLU } from "../src/santier/spre-cerere.js";
import { registruCerere } from "../src/santier/registru.js";
import { scor, type RandRef } from "../src/santier/scor.js";
import { ELEMENTE, type TermenPoza } from "../src/santier/schema.js";
import { extrageDeterminist } from "../src/import/extract-regex.js";
import { parseFoiBuffer } from "../src/import/parse-workbook.js";
import { proceseazaRegistru } from "../src/import/nucleu.js";
import { stocInMemorie } from "../src/import/memorie.js";

const termen = (p: Partial<TermenPoza>): TermenPoza => ({
  zona: "A) Zona 1", diametru_valoare: 60, diametru_tip: "exterior", izolatie: "vata_minerala", grosime_mm: 50,
  jacheta: "aluminiu", element: "ml", cantitate: 1, multiplicator: 1, pret_dublu: false, text: "", nesigur: false, ...p,
});

describe("agrega", () => {
  it("aduna termenii aceluiasi element, cu multiplicatorul grupului", () => {
    const r = agrega([
      termen({ cantitate: 40, multiplicator: 2, text: "40 ml" }),
      termen({ cantitate: 1, multiplicator: 2, text: "1 ml" }),
      termen({ element: "cot", cantitate: 18, multiplicator: 2 }),
    ]);
    expect(r.map((x) => [x.element, x.cantitate])).toEqual([["ml", 82], ["cot", 36]]);
    expect(formula(r[0]!)).toBe("(40 + 1) × 2");
  });

  it("zecimalele nu lasa resturi: 1,50 × 2 = 3", () => {
    expect(agrega([termen({ cantitate: 1.5, multiplicator: 2 })])[0]!.cantitate).toBe(3);
  });

  it("pretul dublu si zona diferita fac randuri separate", () => {
    const r = agrega([
      termen({ element: "robinet", cantitate: 12 }),
      termen({ element: "robinet", cantitate: 3, pret_dublu: true }),
      termen({ element: "robinet", cantitate: 2, zona: "B) Zona 2" }),
    ]);
    expect(r.map((x) => x.cantitate)).toEqual([12, 3, 2]);
  });

  it("un termen nesigur face tot randul nesigur", () => {
    const r = agrega([termen({ cantitate: 6 }), termen({ cantitate: 4, nesigur: true })]);
    expect(r[0]!.nesigur).toBe(true);
    expect(formula(r[0]!)).toBe("6 + 4");
  });

  it("fara izolatie, grosimea se ignora: „doar Al” n-are strat de vata", () => {
    expect(agrega([termen({ izolatie: null, grosime_mm: 50 })])[0]!.grosime_mm).toBeNull();
  });
});

describe("textul pentru motor", () => {
  const STRATURI: Pick<RandSantier, "izolatie" | "grosime_mm" | "jacheta">[] = [
    { izolatie: "vata_minerala", grosime_mm: 50, jacheta: "aluminiu" },
    { izolatie: null, grosime_mm: null, jacheta: "aluminiu" },
    { izolatie: "vata_minerala", grosime_mm: 50, jacheta: "inox" },
    { izolatie: "elastomer", grosime_mm: 19, jacheta: null },
    { izolatie: "vata_minerala", grosime_mm: 80, jacheta: null },
  ];
  const FORMA: Record<string, string | null> = {
    ml: "ml", cot: "cot", teu: "teu", robinet: "robinet", flansa: "flansa", reductie: "reductie", alt: null,
  };
  const SISTEM = { vata_minerala: "vata_minerala", elastomer: "elastomer" } as const;
  const JACHETA = { aluminiu: "tabla", inox: "tabla_inox", pvc: "pvc" } as const;

  it("fiecare element × straturi se citeste complet de regulile importului", () => {
    const gresite: string[] = [];
    for (const s of STRATURI) {
      for (const element of ELEMENTE.filter((e) => e !== "alt")) {
        const campuri = { zona: "Z", diametru_valoare: 168, diametru_tip: "exterior" as const, element, pret_dublu: false, ...s };
        const { linie } = extrageDeterminist(1, textRand(campuri), element === "ml" ? "ml" : "buc");
        const straturi = [linie.sistem, ...linie.straturi_extra.map((x) => x.sistem)];
        const asteptat = [s.izolatie ? SISTEM[s.izolatie] : null, s.jacheta ? JACHETA[s.jacheta] : null].filter(Boolean);
        const bun = linie.diametru_valoare === 168 && linie.diametru_tip === "exterior" && linie.forma === FORMA[element]
          && JSON.stringify(straturi) === JSON.stringify(asteptat) && (!s.izolatie || linie.grosime_mm === s.grosime_mm);
        if (!bun) gresite.push(`${element} · ${s.izolatie ?? "-"} ${s.grosime_mm ?? ""} + ${s.jacheta ?? "-"}`);
      }
    }
    expect(gresite).toEqual([]);
  });

  it("DN ramane DN", () => {
    const text = textRand({ zona: "Z", diametru_valoare: 400, diametru_tip: "DN", izolatie: "vata_minerala", grosime_mm: 50, jacheta: "aluminiu", element: "ml", pret_dublu: false });
    const { linie } = extrageDeterminist(1, text, "ml");
    expect([linie.diametru_tip, linie.diametru_valoare]).toEqual(["DN", 400]);
  });

  it("pretul dublu e scris pe rand, ca importul sa-l gaseasca", () => {
    const text = textRand({ zona: "Z", diametru_valoare: 168, diametru_tip: "exterior", izolatie: "vata_minerala", grosime_mm: 50, jacheta: "aluminiu", element: "robinet", pret_dublu: true });
    expect(text).toContain(MARCA_PRET_DUBLU);
  });
});

interface Referinta { pagini: { fisier: string; note: string[]; randuri: (RandRef & { zona: string })[] }[] }
const referinta = JSON.parse(readFileSync("tests/fixtures-santier-ecoterm.json", "utf8")) as Referinta;

/** Referinta, ca randuri confirmate de om. */
const randuriReferinta = (): RandSantier[] => referinta.pagini.flatMap((p) => p.randuri.map((r) => ({
  ...r, id: "", termeni: [], nesigur: Boolean(r.nesigur),
})));

describe("pozele Ecoterm, transcrise, prin motor", () => {
  it("scorul referintei fata de ea insasi e complet", () => {
    for (const p of referinta.pagini) {
      const s = scor(p.randuri, p.randuri);
      expect(s.corecte).toBe(s.total);
    }
  });

  it("fiecare rand iese cu pret, determinist, fara model", async () => {
    const linii = spreCerere(randuriReferinta());
    const foi = await parseFoiBuffer(await registruCerere(linii, "Ecoterm — masuratori santier"));
    const rez = await proceseazaRegistru(foi, { stoc: stocInMemorie() });
    const izolatie = rez.linii.filter((l) => l.extras.sistem !== null);
    expect(izolatie).toHaveLength(linii.length);
    expect(izolatie.filter((l) => !l.pret)).toEqual([]);
    expect(izolatie.every((l) => l.sursa === "regex")).toBe(true);
    // Cantitatea ajunge neatinsa: suma de pe foaie, nu altceva.
    expect(izolatie.map((l) => l.bruta.cantitate)).toEqual(linii.map((l) => l.cantitate));
    // Zona e sectiunea randului, ca in registrul clientului.
    const sectiune = new Map(rez.brute.map((b) => [b.index, b.sectiune]));
    expect(new Set(izolatie.map((l) => sectiune.get(l.bruta.index)))).toEqual(new Set(linii.map((l) => l.zona)));
  });
});

describe("Măsurătorile în lucru, după reîncărcare (R4)", () => {
  it("pagina se reface cu rândurile ei; o citire întreruptă se poate porni din nou", async () => {
    const { paginaRefacuta } = await import("../web/masuratori-local.js");
    const baza = {
      id: "p1", nume: "santier1.jpeg", poza: new Blob(["x"], { type: "image/jpeg" }), eroare: "", note: [],
      randuri: [], verificata: true, faraModel: false,
    };
    expect(paginaRefacuta({ ...baza, stare: "gata" }, "blob:1")).toMatchObject({ stare: "gata", verificata: true, url: "blob:1" });
    const r = paginaRefacuta({ ...baza, stare: "citeste" }, "blob:2");
    expect(r.stare).toBe("eroare");
    expect(r.eroare).toMatch(/reîncărcat/);
  });
});

describe("Pozele, când modelul nu e pornit (14 octombrie 2026)", () => {
  it("ecranul spune ce ai de făcut când pozele nu se citesc, iar pagina necitită nu arată „De verificat”", async () => {
    const { cardIncarca, cardPagina, mesajModel } = await import("../web/santier-vizual.js");
    expect(mesajModel("pornit")).toBe("");
    // Ruta e `/api`, ca datele: sub `/izorep/` din `npm run dev`, „lângă pagină” dădea HTML-ul lui vite.
    const { rutaModel } = await import("../web/imagine.js");
    expect(rutaModel("poza")).toBe("/api/poza");
    // Pe ecran doar ce face omul, fără server, model sau cheie (18 octombrie 2026).
    for (const m of ["fara-cheie", "fara-server", "nu-raspunde"] as const) {
      expect(mesajModel(m).replace(/<[^>]*>/g, "")).not.toMatch(/server|OpenAI|cheia|demo|model/i);
    }
    expect(mesajModel("fara-server")).toMatch(/Adaugă rând/);
    expect(mesajModel("nu-raspunde")).toMatch(/Încearcă din nou/);
    const sus = cardIncarca({ scop: "oferta", santiere: [], planAles: "", eroare: "", model: "fara-cheie" });
    expect(sus).toMatch(/Scrii de mână/);
    // Pentru ofertă (Cerere nouă › Poze) doar pozele; pe Măsurători, doar situația și comanda (22 octombrie 2026).
    expect(sus).not.toMatch(/name="scop"|name="segment"/);
    const santier = cardIncarca({ scop: "situatie", santiere: [], planAles: "", eroare: "" });
    expect([...santier.matchAll(/name="scop" value="(\w+)"/g)].map((m) => m[1])).toEqual(["situatie", "comanda"]);

    const p = { id: "p1", nume: "carnet.jpg", url: "blob:1", stare: "gata" as const, eroare: "", randuri: [], note: [], verificata: false, faraModel: true };
    const fara = cardPagina(p, 1, { destinatie: "rezidential" });
    expect(fara).toMatch(/Scrii de mână/);
    expect(fara).not.toMatch(/De verificat/);
    // Cheia pusă între timp: pagina se poate citi fără s-o încarci din nou.
    expect(cardPagina(p, 1, { destinatie: "rezidential", cuModel: true })).toMatch(/data-act="reciteste"/);
  });
});
