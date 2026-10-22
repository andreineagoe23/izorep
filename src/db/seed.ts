import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { and, eq, ilike, sql } from "drizzle-orm";
import { caTenant, conecteaza, URL_PROPRIETAR, type Baza } from "./client.js";
import {
  client, depozit, firma, furnizor, listaPreturi, sectiuneRectangulara, serieDiametre, tenant,
} from "./schema.js";

/**
 * Cele doua firme, ca `FIRME` din `web/date/seed.ts`: aceeasi cheie (`cod`),
 * aceeasi denumire si serie ca pe ofertele generate. `cauta` gaseste randul
 * scris de seed-ul de dinainte de 9 octombrie 2026 („SC RADOIA …", seria RI).
 */
const FIRME = [
  { cod: "radoia", denumire: "RADOIA ISOLIRUNG SRL", serieOferta: "RAD", cauta: "%RADOIA%" },
  { cod: "isorad", denumire: "R&F ISORAD SYSTEM SRL", serieOferta: "ISO", cauta: "%ISORAD%" },
];

/** Furnizorii spusi de firma la intalnirea din 5 octombrie 2026 (S25). */

import { catalogDinFisiere } from "../pricing/lists.js";
import { FURNIZORI } from "../stoc/furnizori.js";
import type { Sistem } from "../pricing/types.js";

/**
 * `npm run db:seed` — populeaza baza locala cu datele reale ale firmei.
 *
 * Idempotent, dar NU mai sterge tenantul (din 9 octombrie 2026 are ofertele,
 * santierele si stocul oamenilor, iar o parte din ele nu se pot sterge):
 * completeaza ce lipseste si reface doar listele de preturi. Baza goala se
 * obtine cu `npm run db:reset`. E scriptul de dezvoltare, nu unul de productie
 * — in productie listele intra prin ecranul de import, cu autor si data.
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
  const { db, inchide } = conecteaza(URL_PROPRIETAR);
  try {
    const [existent] = await db.select().from(tenant).where(eq(tenant.denumire, NUME_TENANT));
    const tenantId = existent?.id
      ?? (await db.insert(tenant).values({ denumire: NUME_TENANT }).returning())[0]!.id;
    let nrListe = 0;

    await caTenant(db, tenantId, async (tx) => {
      // Doua entitati juridice, acelasi tenant: impart clienti si preturi.
      let central: string | undefined;
      for (const f of FIRME) {
        const [gasita] = await tx.select().from(firma)
          .where(and(eq(firma.tenantId, tenantId), ilike(firma.denumire, f.cauta)));
        const val = { tenantId, cod: f.cod, denumire: f.denumire, serieOferta: f.serieOferta };
        const id = gasita
          ? (await tx.update(firma).set(val).where(eq(firma.id, gasita.id)).returning())[0]!.id
          : (await tx.insert(firma).values(val).returning())[0]!.id;
        central ??= id;
      }

      // Fără conturi de test (21 octombrie 2026): conturile adevărate se fac cu `npm run om`.

      for (const denumire of ["NISAL SRL", "Transavia"]) {
        const [are] = await tx.select().from(client).where(eq(client.denumire, denumire));
        if (are) continue;
        await tx.insert(client).values(denumire === "NISAL SRL"
          ? { tenantId, denumire, categorie: "industrial", sursa: "Oferta 118 / 27.04.2026" }
          : { tenantId, denumire, categorie: "industrial", sursa: "cerere-de-oferta-transavia-inox.xlsx" });
      }

      // Depozitul central e al firmei RADOIA (S46: stocul e in principiu separat pe firme).
      await tx.insert(depozit).values({ tenantId, id: "central", denumire: "Depozit central", tip: "central", firmaId: central })
        .onConflictDoNothing();
      // Atelierul din București (răspunsul 4): tabla se croiește acolo pentru șantiere (Faza 5).
      await tx.insert(depozit).values({ tenantId, id: "atelier", denumire: "Atelier București", tip: "atelier", firmaId: central })
        .onConflictDoNothing();
      await tx.insert(furnizor).values(FURNIZORI.map(([denumire, vinde]) => ({ tenantId, denumire, vinde })))
        .onConflictDoNothing();

      // Listele se refac. Cele active nu se sterg (trigger): trec intai in draft,
      // explicit, ca ocolirea sa se vada in cod.
      await tx.update(listaPreturi).set({ status: "draft" });
      await tx.delete(listaPreturi);

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
      `Tenant ${NUME_TENANT} (${tenantId}): 2 firme, depozitul central, ${FURNIZORI.length} furnizori, ` +
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
