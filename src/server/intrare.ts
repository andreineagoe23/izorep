/**
 * Intrarea cu link primit pe email. Fara parole: oamenii firmei nu vor una de
 * tinut minte (`docs/productie.md`).
 *
 *   1. omul scrie emailul → primeste un link valabil 15 minute, o singura data;
 *   2. linkul deschide aplicatia, care trimite tokenul inapoi (POST, nu GET:
 *      scanerele de email deschid linkurile si ar consuma tokenul);
 *   3. serverul da un cookie de sesiune, 30 de zile.
 *
 * In baza stau doar hash-urile (sha256). Cautarea dupa email si dupa hash se
 * face fara tenant, prin politicile „dupa cheie” din schema.ts (`cuCheie`);
 * restul, ca orice cerere, in `caTenant`.
 */
import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { caTenant, cuCheie, type Baza } from "../db/client.js";
import { sesiune, tenant, tokenIntrare, utilizator } from "../db/schema.js";

export const DURATA_TOKEN_MS = 15 * 60 * 1000;
export const DURATA_SESIUNE_MS = 30 * 24 * 60 * 60 * 1000;

export const tokenNou = (): string => randomBytes(32).toString("base64url");
export const hashToken = (t: string): string => createHash("sha256").update(t).digest("hex");

/** Cine a intrat: tot ce stie o cerere despre om. */
export interface Context {
  tenantId: string;
  utilizatorId: string;
  nume: string;
  email: string;
  rol: string;
}

/** Trimite linkul. In teste, o functie care il retine. */
export type TrimiteLink = (catre: { email: string; nume: string; firma: string }, link: string) => Promise<void>;

/**
 * Cere un link. Raspunsul e acelasi daca adresa are cont sau nu: altfel
 * formularul ar spune oricui ce adrese exista.
 *
 * Acelasi email poate fi in doi tenanti (unicitatea e pe tenant): primeste
 * cate un link pentru fiecare, cu numele firmei in mesaj.
 */
export async function cereLink(db: Baza, email: string, urlAplicatie: string, trimite: TrimiteLink): Promise<void> {
  const adresa = email.trim().toLowerCase();
  if (!adresa.includes("@")) return;
  const oameni = await cuCheie(db, "app.email_cautat", adresa, (tx) =>
    tx.select({ id: utilizator.id, tenantId: utilizator.tenantId, nume: utilizator.nume, activ: utilizator.activ })
      .from(utilizator).where(eq(sql`lower(${utilizator.email})`, adresa)));
  for (const om of oameni.filter((o) => o.activ)) {
    const token = tokenNou();
    const firma = await caTenant(db, om.tenantId, async (tx) => {
      await tx.insert(tokenIntrare).values({
        tenantId: om.tenantId, utilizatorId: om.id, hash: hashToken(token),
        expira: new Date(Date.now() + DURATA_TOKEN_MS),
      });
      // `tenant` n-are politica: e granita insasi. Doar numele, pentru mesaj.
      const [t] = await tx.select({ denumire: tenant.denumire }).from(tenant).where(eq(tenant.id, om.tenantId));
      return t?.denumire ?? "";
    });
    await trimite({ email: adresa, nume: om.nume, firma }, `${urlAplicatie}#/intrare/${token}`);
  }
}

/**
 * Tokenul din link devine sesiune. Null = expirat, folosit sau inventat;
 * ecranul spune la fel in toate cazurile: „cere alt link”.
 */
export async function confirmaLink(db: Baza, token: string): Promise<{ cookie: string; ctx: Context } | null> {
  const h = hashToken(token);
  return cuCheie(db, "app.hash_cautat", h, async (tx) => {
    // Un singur UPDATE marcheaza si verifica: doua clicuri simultane pe acelasi
    // link nu pot deschide doua sesiuni.
    const [t] = await tx.update(tokenIntrare).set({ folositLa: new Date() })
      .where(and(eq(tokenIntrare.hash, h), isNull(tokenIntrare.folositLa), gt(tokenIntrare.expira, new Date())))
      .returning({ tenantId: tokenIntrare.tenantId, utilizatorId: tokenIntrare.utilizatorId });
    if (!t) return null;
    await tx.execute(sql`select set_config('app.tenant_id', ${t.tenantId}, true)`);
    const [om] = await tx.select().from(utilizator).where(eq(utilizator.id, t.utilizatorId));
    if (!om?.activ) return null;
    const cookie = tokenNou();
    await tx.insert(sesiune).values({
      tenantId: t.tenantId, utilizatorId: om.id, hash: hashToken(cookie),
      expira: new Date(Date.now() + DURATA_SESIUNE_MS),
    });
    return { cookie, ctx: { tenantId: t.tenantId, utilizatorId: om.id, nume: om.nume, email: om.email, rol: om.rol } };
  });
}

/** Cine e in spatele cookie-ului. Null = fara sesiune, expirata, sau om dezactivat. */
export async function contextDin(db: Baza, cookie: string): Promise<Context | null> {
  const h = hashToken(cookie);
  return cuCheie(db, "app.hash_cautat", h, async (tx) => {
    const [s] = await tx.select().from(sesiune).where(and(eq(sesiune.hash, h), gt(sesiune.expira, new Date())));
    if (!s) return null;
    await tx.execute(sql`select set_config('app.tenant_id', ${s.tenantId}, true)`);
    const [om] = await tx.select().from(utilizator).where(eq(utilizator.id, s.utilizatorId));
    if (!om?.activ) return null;
    return { tenantId: s.tenantId, utilizatorId: om.id, nume: om.nume, email: om.email, rol: om.rol };
  });
}

export async function iesire(db: Baza, cookie: string): Promise<void> {
  const h = hashToken(cookie);
  await cuCheie(db, "app.hash_cautat", h, (tx) => tx.delete(sesiune).where(eq(sesiune.hash, h)));
}
