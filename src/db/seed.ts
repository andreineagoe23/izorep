import { eq } from "drizzle-orm";
import { caTenant, conecteaza, URL_PROPRIETAR, type Baza } from "./client.js";
import { client, firma, listaPreturi, tenant, utilizator } from "./schema.js";
import { catalogDinFisiere } from "../pricing/lists.js";
import type { Sistem } from "../pricing/types.js";

/**
 * `npm run db:seed` — populeaza baza locala cu datele reale ale firmei.
 *
 * Idempotent: sterge tenantul cu acelasi nume si il reface. E scriptul de
 * dezvoltare, nu unul de productie — in productie listele intra prin ecranul
 * de import, cu autor si data, nu dintr-un fisier commit-uit.
 */

const NUME_TENANT = "RADOIA";

/** Data de la care sunt valabile listele primite de la firma. */
const VALABIL_DE_LA = "2026-01-01";

async function sterge(db: Baza, tenantId: string): Promise<void> {
  // Trigger-ul de imutabilitate interzice stergerea listelor activate, si
  // pe buna dreptate. La reseed le trecem intai in draft, in mod explicit:
  // asa ocolirea e vizibila in cod, nu ascunsa intr-un `delete` tacut.
  await caTenant(db, tenantId, async (tx) => {
    await tx.update(listaPreturi).set({ status: "draft" });
    await tx.delete(listaPreturi);
    await tx.delete(client);
    await tx.delete(utilizator);
    await tx.delete(firma);
  });
  await db.delete(tenant).where(eq(tenant.id, tenantId));
}

async function main(): Promise<void> {
  const { db, inchide } = conecteaza(process.env["DATABASE_URL"] ?? URL_PROPRIETAR);
  try {
    const existent = await db.select().from(tenant).where(eq(tenant.denumire, NUME_TENANT));
    for (const t of existent) await sterge(db, t.id);

    const [t] = await db.insert(tenant).values({ denumire: NUME_TENANT }).returning();
    const tenantId = t!.id;

    await caTenant(db, tenantId, async (tx) => {
      // Doua entitati juridice, acelasi tenant: impart clienti si preturi.
      await tx.insert(firma).values([
        { tenantId, denumire: "SC RADOIA ISOLIRUNG SRL", serieOferta: "RI" },
        { tenantId, denumire: "R&F ISORAD SYSTEM SRL", serieOferta: "IS" },
      ]);

      await tx.insert(utilizator).values([
        { tenantId, email: "patron@radoia.test", nume: "Patron", rol: "patron" },
        { tenantId, email: "tehnic@radoia.test", nume: "Tehnic", rol: "tehnic" },
      ]);

      await tx.insert(client).values([
        { tenantId, denumire: "NISAL SRL", categorie: "industrial", sursa: "Oferta 118 / 27.04.2026" },
        { tenantId, denumire: "Transavia", categorie: "industrial", sursa: "Izolatii Transavia.xlsx" },
      ]);

      const catalog = catalogDinFisiere();
      const liste = [
        ...Object.values(catalog.matrice).map((l) => [l.sistem as Sistem, l] as const),
        ["goluri_foc" as Sistem, catalog.goluriFoc] as const,
      ];

      await tx.insert(listaPreturi).values(liste.map(([sistem, l]) => ({
        tenantId,
        sistem,
        denumire: l.denumire,
        contine: l.contine,
        moneda: l.moneda,
        valabilDeLa: VALABIL_DE_LA,
        status: "activa",
        sursa: "data/price-lists/",
        continut: l,
      })));
    });

    console.log(`Tenant ${NUME_TENANT} (${tenantId}): 2 firme, 2 utilizatori, 2 clienti, 5 liste de preturi.`);
  } finally {
    await inchide();
  }
}

await main();
