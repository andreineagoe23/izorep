import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { eq } from "drizzle-orm";
import { caTenant, conecteaza, URL_PROPRIETAR, type Baza } from "./client.js";
import {
  client, firma, listaPreturi, sectiuneRectangulara, serieDiametre, tenant, utilizator,
} from "./schema.js";
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

/** Listele industriale au venit pe 4 septembrie 2026. */
const VALABIL_INDUSTRIAL = "2026-09-04";

const DATE = fileURLToPath(new URL("../../data/", import.meta.url));

/**
 * Listele industriale se citesc de pe disc, nu prin `catalogDinFisiere()`.
 *
 * Motorul importa static doar destinatia rezidentiala — pe ea ruleaza, si ea
 * trebuie sa mearga identic in browser. Industrialul exista deocamdata numai
 * ca date: intra in baza, marcat cu destinatia lui, si asteapta regula dupa
 * care se alege destinatia (intrebarea 12 din .claude/stare.md). Citirea cu
 * `node:fs` e in regula aici — seed-ul e cod de Node, nu de browser.
 */
function listeIndustriale(): { sistem: Sistem; lista: Record<string, unknown> }[] {
  const dir = `${DATE}price-lists/industrial/`;
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      const lista = JSON.parse(readFileSync(dir + f, "utf8")) as Record<string, unknown>;
      return { sistem: lista["sistem"] as Sistem, lista };
    });
}

interface Conversii {
  serii_diametre: {
    material: string; dn: number | null; diametru_exterior: number;
    toli: string | null; standard: string | null;
  }[];
  sectiuni_rectangulare: { a_mm: number; b_mm: number }[];
}

const conversii = (): Conversii =>
  JSON.parse(readFileSync(`${DATE}referinte/conversii-tevi.json`, "utf8")) as Conversii;

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

/**
 * Referintele sunt globale, nu per tenant: sunt norme de teava, aceleasi
 * pentru oricine. De aceea se sterg si se refac in afara lui `caTenant` —
 * n-au tenant_id si nu sunt sub nicio politica de RLS.
 */
async function seedReferinte(db: Baza): Promise<{ serii: number; sectiuni: number }> {
  const c = conversii();
  await db.delete(serieDiametre);
  await db.delete(sectiuneRectangulara);
  await db.insert(serieDiametre).values(c.serii_diametre.map((r) => ({
    material: r.material,
    dn: r.dn,
    diametruExterior: r.diametru_exterior.toFixed(2),
    toli: r.toli,
    standard: r.standard,
  })));
  await db.insert(sectiuneRectangulara).values(
    c.sectiuni_rectangulare.map((r) => ({ aMm: r.a_mm, bMm: r.b_mm })),
  );
  return { serii: c.serii_diametre.length, sectiuni: c.sectiuni_rectangulare.length };
}

async function main(): Promise<void> {
  const { db, inchide } = conecteaza(process.env["DATABASE_URL"] ?? URL_PROPRIETAR);
  try {
    const existent = await db.select().from(tenant).where(eq(tenant.denumire, NUME_TENANT));
    for (const t of existent) await sterge(db, t.id);

    const [t] = await db.insert(tenant).values({ denumire: NUME_TENANT }).returning();
    const tenantId = t!.id;
    let nrListe = 0;

    await caTenant(db, tenantId, async (tx) => {
      // Doua entitati juridice, acelasi tenant: impart clienti si preturi.
      await tx.insert(firma).values([
        { tenantId, denumire: "SC RADOIA ISOLIRUNG SRL", serieOferta: "RI" },
        { tenantId, denumire: "R&F ISORAD SYSTEM SRL", serieOferta: "IS" },
      ]);

      await tx.insert(utilizator).values([
        { tenantId, email: "birou@radoia.test", nume: "Birou", rol: "birou" },
        { tenantId, email: "contabilitate@radoia.test", nume: "Contabilitate", rol: "contabilitate" },
      ]);

      await tx.insert(client).values([
        { tenantId, denumire: "NISAL SRL", categorie: "industrial", sursa: "Oferta 118 / 27.04.2026" },
        { tenantId, denumire: "Transavia", categorie: "industrial", sursa: "cerere-de-oferta-transavia-inox.xlsx" },
      ]);

      const catalog = catalogDinFisiere();
      const liste = [
        ...Object.values(catalog.matrice).map((l) => [l.sistem as Sistem, l] as const),
        ["goluri_foc" as Sistem, catalog.goluriFoc] as const,
      ];

      await tx.insert(listaPreturi).values(liste.map(([sistem, l]) => ({
        tenantId,
        sistem,
        destinatie: "rezidential",
        denumire: l.denumire,
        contine: l.contine,
        moneda: l.moneda,
        valabilDeLa: VALABIL_DE_LA,
        status: "activa",
        sursa: "data/price-lists/",
        continut: l,
      })));

      const ind = listeIndustriale();
      await tx.insert(listaPreturi).values(ind.map(({ sistem, lista }) => ({
        tenantId,
        sistem,
        destinatie: "industrial",
        denumire: lista["denumire"] as string,
        contine: lista["contine"] as string,
        moneda: lista["moneda"] as string,
        valabilDeLa: VALABIL_INDUSTRIAL,
        status: "activa",
        sursa: "data/price-lists/industrial/",
        continut: lista,
      })));
      nrListe = liste.length + ind.length;
    });

    const ref = await seedReferinte(db);
    console.log(
      `Tenant ${NUME_TENANT} (${tenantId}): 2 firme, 2 utilizatori, 2 clienti, ` +
      `${nrListe} liste de preturi (5 rezidentiale + 4 industriale).`,
    );
    console.log(
      `Referinte globale: ${ref.serii} randuri de serie de diametre, ` +
      `${ref.sectiuni} sectiuni rectangulare.`,
    );
  } finally {
    await inchide();
  }
}

await main();
