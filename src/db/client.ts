import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import postgres from "postgres";
import * as schema from "./schema.js";

export type Baza = PostgresJsDatabase<typeof schema>;

/**
 * Aplicatia se conecteaza cu `izorep_app`, NU cu proprietarul schemei.
 *
 * Proprietarul e superuser in baza locala, iar superuserii ocolesc RLS —
 * inclusiv cu FORCE ROW LEVEL SECURITY. Cu el, politicile din schema.ts n-ar
 * bloca nimic si testele de izolare ar trece fals. Vezi migrarea 0002.
 */
export const URL_IMPLICIT = "postgres://izorep_app:izorep_app@localhost:5433/izorep";

/** Proprietarul schemei. Doar pentru migrari si pentru seed-ul local. */
export const URL_PROPRIETAR = "postgres://izorep:izorep@localhost:5433/izorep";

/**
 * Conexiunea la baza.
 *
 * `transform` nu e pus deliberat: driverul `postgres` intoarce coloanele
 * `numeric` ca STRING, si asa trebuie sa ramana. Momentul in care cineva le
 * face `Number()` "ca sa fie mai comod", principiul 5 din arhitectura —
 * "bani niciodata in float" — e incalcat fara sa se vada.
 */
export function conecteaza(url = process.env["DATABASE_URL"] ?? URL_IMPLICIT): {
  db: Baza;
  sql: postgres.Sql;
  inchide: () => Promise<void>;
} {
  const client = postgres(url, { max: 10, onnotice: () => {} });
  return {
    db: drizzle(client, { schema, casing: "snake_case" }),
    sql: client,
    inchide: () => client.end(),
  };
}

/**
 * Ruleaza o unitate de lucru in contextul unui tenant.
 *
 * Contextul se pune cu `set_config(..., true)` — al treilea argument
 * inseamna "local pentru tranzactia curenta". E esential intr-un pool de
 * conexiuni: fara el, valoarea ar ramane lipita de conexiune si urmatoarea
 * cerere, a altui utilizator, ar mosteni tenantul precedent. Aia e exact
 * scurgerea de date pe care RLS ar trebui s-o previna.
 *
 * Politicile din schema.ts citesc `app.tenant_id`. Daca nu e pus,
 * `current_setting(..., true)` da NULL, comparatia e NULL si nu se vede
 * niciun rand — implicitul e "nu vezi nimic", nu "vezi tot".
 */
export async function caTenant<T>(
  db: Baza,
  tenantId: string,
  lucru: (tx: Baza) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.tenant_id', ${tenantId}, true)`);
    return lucru(tx as unknown as Baza);
  });
}

/**
 * Ruleaza in afara oricarui tenant, pentru operatiile care privesc tabelul
 * `tenant` insusi: creare de cont nou, listare administrativa.
 *
 * `tenant` e singurul tabel fara politica — nu are `tenant_id`, el ESTE
 * granita. Orice altceva care are nevoie de acces incrucisat e un bug.
 */
export const caAdmin = <T>(db: Baza, lucru: (db: Baza) => Promise<T>): Promise<T> => lucru(db);

export { schema };
