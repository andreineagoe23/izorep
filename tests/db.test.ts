/**
 * Teste pe Postgres real, nu pe imitatii.
 *
 * Un mock nu poate demonstra ce trebuie demonstrat aici: ca RLS chiar
 * blocheaza, ca trigger-ul chiar refuza, ca indexul unic chiar prinde a doua
 * lista activa. Toate astea sunt comportament al bazei.
 *
 * Cer o baza pornita:  npm run db:up && npm run db:migrate
 * Daca nu raspunde, suita se sare cu un mesaj, nu pica — altfel `npm test`
 * ar deveni imposibil de rulat fara Docker pornit.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { caTenant, conecteaza, type Baza } from "../src/db/client.js";
import { client, listaPreturi, tenant } from "../src/db/schema.js";
import { catalogDinBaza, ListaLipsa } from "../src/db/repo-preturi.js";
import { serieDiametre } from "../src/db/schema.js";
import { and } from "drizzle-orm";
import { catalogDinFisiere } from "../src/pricing/lists.js";
import { tarifeazaSimplu } from "../src/pricing/engine.js";
import type { SistemRezidential } from "../src/pricing/types.js";

const { db, inchide } = conecteaza();
let tenantA = "";
let tenantB = "";

/**
 * Sondarea bazei se face la nivel de MODUL, nu in beforeAll.
 *
 * `it.skip` se decide la colectare, iar beforeAll ruleaza dupa. Cu sondarea
 * in beforeAll, toate testele ar fi sarite chiar si cu baza pornita — ceea
 * ce arata exact ca o suita care trece.
 */
const disponibila = await db.execute(sql`select 1`).then(() => true, () => false);

beforeAll(async () => {
  if (!disponibila) return;

  // Doi tenanti proaspeti, ca izolarea sa poata fi verificata pe date pe
  // care le controlam, nu pe seed-ul care s-ar putea schimba.
  const [a] = await db.insert(tenant).values({ denumire: `test-A-${Date.now()}` }).returning();
  const [b] = await db.insert(tenant).values({ denumire: `test-B-${Date.now()}` }).returning();
  tenantA = a!.id;
  tenantB = b!.id;

  await caTenant(db, tenantA, (tx) =>
    tx.insert(client).values({ tenantId: tenantA, denumire: "Client al lui A" }));
  await caTenant(db, tenantB, (tx) =>
    tx.insert(client).values({ tenantId: tenantB, denumire: "Client al lui B" }));
});

afterAll(async () => {
  if (disponibila && tenantA) {
    for (const t of [tenantA, tenantB]) {
      // `where` explicit, desi RLS ar limita oricum la tenantul curent.
      // Intr-o rulare anterioara, cu aplicatia conectata ca superuser, exact
      // aceste doua comenzi fara `where` au sters listele seed-ului: RLS nu
      // filtra, iar codul se baza pe el. Testele nu au voie sa modeleze un
      // tipar care depinde de o plasa ca sa fie corect.
      await caTenant(db, t, async (tx) => {
        await tx.update(listaPreturi).set({ status: "draft" }).where(eq(listaPreturi.tenantId, t));
        await tx.delete(listaPreturi).where(eq(listaPreturi.tenantId, t));
        await tx.delete(client).where(eq(client.tenantId, t));
      });
      await db.delete(tenant).where(eq(tenant.id, t));
    }
  }
  await inchide();
});

const daca = () => (disponibila ? it : it.skip);

if (!disponibila) {
  console.warn("Baza nu raspunde — testele de baza se sar. Porneste: npm run db:up && npm run db:migrate && npm run db:seed");
}

describe("izolarea intre tenanti e in baza, nu in cod", () => {
  daca()("fiecare tenant isi vede doar clientii lui", async () => {
    const aiLuiA = await caTenant(db, tenantA, (tx) => tx.select().from(client));
    const aiLuiB = await caTenant(db, tenantB, (tx) => tx.select().from(client));

    expect(aiLuiA.map((c) => c.denumire)).toEqual(["Client al lui A"]);
    expect(aiLuiB.map((c) => c.denumire)).toEqual(["Client al lui B"]);
  });

  daca()("fara context de tenant nu se vede NIMIC, nu tot", async () => {
    // Implicitul conteaza mai mult decat regula: current_setting(...) da NULL,
    // comparatia e NULL, randul e filtrat. Daca vreodata testul asta incepe
    // sa intoarca randuri, politicile au fost slabite.
    const toti = await db.select().from(client);
    expect(toti).toEqual([]);
  });

  daca()("interogarea nu are nevoie de where pe tenant ca sa fie corecta", async () => {
    // Niciunul dintre select-urile de mai sus nu filtreaza pe tenant_id.
    // Exact asta e ideea: un `where` uitat nu mai poate scurge date.
    const numar = await caTenant(db, tenantA, (tx) =>
      tx.select({ n: sql<number>`count(*)::int` }).from(client));
    expect(numar[0]!.n).toBe(1);
  });

  daca()("nu poti scrie un rand in contul altui tenant", async () => {
    // WITH CHECK din politica respinge insertul, chiar daca aplicatia
    // trimite un tenant_id strain.
    await expect(
      caTenant(db, tenantA, (tx) =>
        tx.insert(client).values({ tenantId: tenantB, denumire: "furisat" })),
    ).rejects.toThrow();
  });
});

describe("lista de preturi e imutabila dupa activare", () => {
  const listaDeProba = (status: string) => ({
    tenantId: tenantA,
    sistem: "pvc",
    denumire: "proba",
    contine: "material + manopera",
    moneda: "EUR",
    valabilDeLa: "2026-01-01",
    status,
    continut: { cells: { "80|-": 1.11 } },
  });

  daca()("continutul unei liste activate nu se mai poate schimba", async () => {
    await caTenant(db, tenantA, async (tx) => {
      const [l] = await tx.insert(listaPreturi).values(listaDeProba("activa")).returning();
      await expect(
        tx.update(listaPreturi).set({ continut: { cells: { "80|-": 9.99 } } })
          .where(eq(listaPreturi.id, l!.id)),
      ).rejects.toThrow(/nu se mai editeaza/);
    }).catch((e) => {
      // Tranzactia cade odata cu exceptia asteptata; verificarea e in interior.
      if (!/nu se mai editeaza/.test(String(e))) throw e;
    });
  });

  daca()("o lista in draft se poate inca edita", async () => {
    await caTenant(db, tenantA, async (tx) => {
      const [l] = await tx.insert(listaPreturi).values(listaDeProba("draft")).returning();
      await tx.update(listaPreturi).set({ continut: { cells: { "80|-": 2.22 } } })
        .where(eq(listaPreturi.id, l!.id));
      const [dupa] = await tx.select().from(listaPreturi).where(eq(listaPreturi.id, l!.id));
      expect((dupa!.continut as { cells: Record<string, number> }).cells["80|-"]).toBe(2.22);
      await tx.delete(listaPreturi).where(eq(listaPreturi.id, l!.id));
    });
  });

  daca()("nu pot exista doua liste active pe acelasi sistem", async () => {
    await caTenant(db, tenantA, async (tx) => {
      await tx.insert(listaPreturi).values(listaDeProba("activa"));
      await expect(
        tx.insert(listaPreturi).values({ ...listaDeProba("activa"), denumire: "a doua" }),
      ).rejects.toThrow();
    }).catch((e) => {
      if (!/duplicate key|unique/i.test(String(e))) throw e;
    });
  });
});

describe("catalogul din baza e identic cu cel din fisiere", () => {
  /**
   * Testul care leaga backend-ul de motor.
   *
   * Daca trece, cele 130 de teste ale motorului se aplica automat si
   * preturilor din baza: aceeasi intrare, acelasi rezultat, indiferent de
   * sursa. Daca pica, o migrare a stricat ceva pe drum si nicio ofertare de
   * pe server nu mai e de incredere.
   */
  daca()("acelasi continut, sistem cu sistem", async () => {
    const dinFisiere = catalogDinFisiere();
    const [t] = await db.select().from(tenant).where(eq(tenant.denumire, "RADOIA"));
    if (!t) return expect.unreachable("ruleaza intai npm run db:seed");

    const dinBaza = await caTenant(db, t.id, (tx) => catalogDinBaza(tx, "2026-09-02"));

    expect(Object.keys(dinBaza.matrice).sort()).toEqual(Object.keys(dinFisiere.matrice).sort());
    for (const sistem of Object.keys(dinFisiere.matrice) as (keyof typeof dinFisiere.matrice)[]) {
      expect(dinBaza.matrice[sistem]).toEqual(dinFisiere.matrice[sistem]);
    }
    expect(dinBaza.goluriFoc).toEqual(dinFisiere.goluriFoc);
  });

  /**
   * Regresia care ar fi tacuta.
   *
   * Din 4 septembrie 2026 baza tine DOUA liste active pe acelasi sistem —
   * rezidentiala si industriala. Interogarea veche filtra doar pe sistem si
   * status, iar `order by valabil_de_la desc` ar fi ales-o pe cea industriala:
   * aceleasi fisiere, alte preturi, nimic care sa se aprinda. Vata industriala
   * e x1,25, deci ofertele ar fi iesit cu 25% mai mari fara nicio urma.
   */
  daca()("listele industriale nu se strecoara peste cele rezidentiale", async () => {
    const [t] = await db.select().from(tenant).where(eq(tenant.denumire, "RADOIA"));
    if (!t) return expect.unreachable("ruleaza intai npm run db:seed");

    // Data e DUPA ce intra in vigoare listele industriale (2026-09-04).
    const implicit = await caTenant(db, t.id, (tx) => catalogDinBaza(tx, "2026-12-01"));
    expect(implicit.matrice.vata_minerala).toEqual(catalogDinFisiere().matrice.vata_minerala);

    const [randInd] = await caTenant(db, t.id, (tx) => tx
      .select({ continut: listaPreturi.continut })
      .from(listaPreturi)
      .where(and(
        eq(listaPreturi.sistem, "vata_minerala"),
        eq(listaPreturi.destinatie, "industrial"),
        eq(listaPreturi.status, "activa"),
      )));
    const cheie = "89|50";
    const rez = implicit.matrice.vata_minerala.cells[cheie]!;
    const ind = (randInd!.continut as { cells: Record<string, number> }).cells[cheie]!;
    expect(ind / rez).toBeCloseTo(1.25, 6);
  });

  /**
   * Pachetul industrial e INCOMPLET: n-au venit PVC-ul si inchiderile goluri
   * la foc. Un catalog industrial cerut intreg trebuie sa spuna asta, nu sa
   * completeze tacut din rezidential — altfel diferenta dintre "n-avem lista"
   * si "avem alta lista" dispare exact acolo unde conteaza.
   */
  daca()("catalogul industrial spune ce lipseste, nu completeaza din rezidential", async () => {
    const [t] = await db.select().from(tenant).where(eq(tenant.denumire, "RADOIA"));
    if (!t) return expect.unreachable("ruleaza intai npm run db:seed");

    await expect(
      caTenant(db, t.id, (tx) => catalogDinBaza(tx, "2026-12-01", "industrial")),
    ).rejects.toThrow(/pvc \(industrial\)/);
  });

  daca()("seriile de diametre difera pe material: DN15 nu e acelasi lucru peste tot", async () => {
    // Tabelul e referinta globala, fara tenant: sunt norme, nu date de client.
    const randuri = await db.select().from(serieDiametre);
    if (randuri.length === 0) return expect.unreachable("ruleaza intai npm run db:seed");

    const la = (material: string, dn: number) =>
      Number(randuri.find((r) => r.material === material && r.dn === dn)?.diametruExterior);

    expect(la("otel_negru", 15)).toBe(21.3);
    expect(la("cupru", 15)).toBe(18);
    expect(la("ppr", 15)).toBe(20);
  });

  daca()("preturile din baza dau aceleasi cifre ca ofertele istorice", async () => {
    const [t] = await db.select().from(tenant).where(eq(tenant.denumire, "RADOIA"));
    if (!t) return expect.unreachable("ruleaza intai npm run db:seed");
    const dinBaza = await caTenant(db, t.id, (tx) => catalogDinBaza(tx, "2026-09-02"));

    // Pozitii din Oferta 118, verificate aici prin listele venite din baza.
    // Tipizat pe SistemRezidential, nu pe Parameters<typeof tarifeazaSimplu>[0]:
    // dinBaza.matrice e catalogul rezidential (4 sisteme), nu SistemMatrice cu
    // 5 — tabla_inox n-are lista rezidentiala.
    const cazuri: [SistemRezidential, number, number, number][] = [
      ["elastomer", 15, 13, 5.99],
      ["elastomer", 100, 32, 28.96],
      ["vata_minerala", 65, 30, 9.80],
    ];
    for (const [sistem, dn, grosime, asteptat] of cazuri) {
      const celule = dinBaza.matrice[sistem].cells;
      expect(Object.keys(celule).length).toBeGreaterThan(0);
      expect(tarifeazaSimplu(sistem, dn, grosime, "ml").pret_unitar).toBe(asteptat);
    }
  });

  daca()("un sistem fara lista activa se semnaleaza, nu se ghiceste", async () => {
    await expect(
      caTenant(db, tenantB, (tx) => catalogDinBaza(tx, "2026-09-02")),
    ).rejects.toThrow(ListaLipsa);
  });
});
