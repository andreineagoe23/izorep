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
/**
 * Numele bazei locale. `IZOREP_DB` da fiecarei copii de lucru baza ei: doua
 * ramuri cu migrari diferite pe aceeasi baza se strica una pe alta (drizzle
 * aplica doar migrarile mai noi decat ultima aplicata).
 */
const BAZA = process.env["IZOREP_DB"] ?? "izorep";

export const URL_IMPLICIT = `postgres://izorep_app:izorep_app@localhost:5433/${BAZA}`;

/**
 * Proprietarul schemei: migrarile, seed-ul, purjarea din teste. Pe Render vine
 * din `DATABASE_URL_PROPRIETAR`, separat de `DATABASE_URL` (aplicatia): cele
 * doua roluri sunt chiar granita RLS (migrarea 0002).
 */
export const URL_PROPRIETAR = process.env["DATABASE_URL_PROPRIETAR"]
  ?? `postgres://izorep:izorep@localhost:5433/${BAZA}`;

/**
 * Unde se conecteaza aplicatia: `DATABASE_URL`, daca e scris. Altfel, pe
 * Render, aceeasi baza ca proprietarul, dar cu rolul `izorep_app` si parola
 * lui (`IZOREP_APP_PAROLA`, pusa de `db:migrate`): `render.yaml` nu poate
 * compune o adresa din doua variabile, deci o compunem aici. Local, rolul
 * aplicatiei din docker-compose.
 */
export function urlAplicatie(mediu: NodeJS.ProcessEnv = process.env): string {
  if (mediu["DATABASE_URL"]) return mediu["DATABASE_URL"];
  const proprietar = mediu["DATABASE_URL_PROPRIETAR"];
  const parola = mediu["IZOREP_APP_PAROLA"];
  if (proprietar && parola) {
    const u = new URL(proprietar);
    u.username = "izorep_app";
    u.password = parola;
    return u.toString();
  }
  return URL_IMPLICIT;
}

/**
 * Conexiunea la baza.
 *
 * `transform` nu e pus deliberat: driverul `postgres` intoarce coloanele
 * `numeric` ca STRING, si asa trebuie sa ramana. Momentul in care cineva le
 * face `Number()` "ca sa fie mai comod", principiul 5 din arhitectura —
 * "bani niciodata in float" — e incalcat fara sa se vada.
 */
export function conecteaza(url = urlAplicatie()): {
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

/**
 * O tranzactie in care aplicatia cunoaste o cheie, dar nu tenantul: emailul
 * scris la intrare (`app.email_cautat`) sau hash-ul unui token sau al unui
 * cookie (`app.hash_cautat`). Politicile din schema.ts lasa sa se vada doar
 * randurile cu cheia asta — nimic altceva, nici din tenantul gasit.
 */
export async function cuCheie<T>(
  db: Baza,
  nume: "app.email_cautat" | "app.hash_cautat",
  valoare: string,
  lucru: (tx: Baza) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config(${nume}, ${valoare}, true)`);
    return lucru(tx as unknown as Baza);
  });
}

/**
 * Sterge un tenant cu tot ce are, inclusiv documentele care altfel nu se
 * sterg niciodata (oferta, miscarea de stoc). Doar pentru tenantii de test si
 * doar ca proprietar: trigger-ele (migrarea 0006) refuza `izorep_app` chiar
 * cu `app.purjare` pus.
 */
export async function purjeazaTenant(dbProprietar: Baza, tenantId: string): Promise<void> {
  // Id-ul intra in SQL brut mai jos (numele tabelului nu se poate parametriza).
  if (!/^[0-9a-f-]{36}$/i.test(tenantId)) throw new Error(`tenant invalid: ${tenantId}`);
  await dbProprietar.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.purjare', ${tenantId}, true)`);
    await tx.execute(sql`select set_config('app.tenant_id', ${tenantId}, true)`);
    // Copiii inaintea parintilor: cheile straine sunt `restrict`.
    for (const tabel of [
      "situatie", "anexa_santier", "masuratoare", "miscare", "document_furnizor", "comanda", "articol", "ambalaj", "necesar",
      "depozit", "santier", "oferta", "cerere", "furnizor", "sesiune", "token_intrare",
      "lista_preturi", "client", "utilizator", "firma",
    ]) {
      await tx.execute(sql.raw(`delete from "${tabel}" where tenant_id = '${tenantId}'`));
    }
    await tx.execute(sql`delete from tenant where id = ${tenantId}`);
  });
}
