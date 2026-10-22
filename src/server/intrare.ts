/**
 * Intrarea în cont (21 octombrie 2026): email + parolă, pe pagina de intrare.
 *
 *   1. omul scrie emailul și parola → serverul verifică hash-ul (`parola.ts`);
 *   2. bine → o sesiune nouă: în cookie un token aleator, în bază doar
 *      sha256-ul lui. Cookie-ul e HttpOnly (scripturile paginii nu-l văd),
 *      SameSite=Lax și, pe https, Secure;
 *   3. greșit de `PRAG_BLOCARE` ori la rând → contul stă blocat
 *      `DURATA_BLOCARE_MS`, oricât de bună ar fi parola de după.
 *
 * Mesajul e același pentru email necunoscut și parolă greșită, iar timpul la
 * fel (`verificaInGol`): pagina nu spune nimănui ce adrese au cont.
 *
 * Serverul servește o singură firmă, deci totul rulează în `caTenant`: RLS-ul
 * vede doar oamenii ei.
 */
import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, lt, ne, sql } from "drizzle-orm";
import { caTenant, type Baza } from "../db/client.js";
import { sesiune, utilizator } from "../db/schema.js";
import { hashParola, problemaParola, verificaInGol, verificaParola } from "./parola.js";

export const DURATA_SESIUNE_MS = 7 * 24 * 60 * 60 * 1000;
export const PRAG_BLOCARE = 5;
export const DURATA_BLOCARE_MS = 15 * 60 * 1000;

export const tokenNou = (): string => randomBytes(32).toString("base64url");
export const hashToken = (t: string): string => createHash("sha256").update(t).digest("hex");

/** Cine e intrat: ce știe o cerere despre om. */
export interface Om {
  utilizatorId: string;
  nume: string;
  email: string;
  rol: string;
  /** Intrat cu parola dată de noi: până nu-și alege alta, nu face nimic altceva. */
  parolaTemporara: boolean;
}

export type RezultatIntrare =
  | { fel: "ok"; cookie: string; om: Om }
  | { fel: "gresit" }
  | { fel: "blocat"; pana: Date };

const omDin = (u: typeof utilizator.$inferSelect): Om => ({
  utilizatorId: u.id, nume: u.nume, email: u.email, rol: u.rol, parolaTemporara: u.parolaTemporara,
});

export async function intra(db: Baza, tenantId: string, email: string, parola: string, acum = new Date()): Promise<RezultatIntrare> {
  const adresa = email.trim().toLowerCase();
  return caTenant(db, tenantId, async (tx) => {
    const [u] = await tx.select().from(utilizator).where(eq(sql`lower(${utilizator.email})`, adresa)).limit(1);
    if (!u || !u.activ || !u.parolaHash) {
      await verificaInGol(parola);
      return { fel: "gresit" } as const;
    }
    if (u.blocatPana && u.blocatPana > acum) return { fel: "blocat", pana: u.blocatPana } as const;
    if (!(await verificaParola(parola, u.parolaHash))) {
      const incercari = u.incercariGresite + 1;
      const blocheaza = incercari >= PRAG_BLOCARE;
      const pana = new Date(acum.getTime() + DURATA_BLOCARE_MS);
      await tx.update(utilizator).set(blocheaza
        ? { incercariGresite: 0, blocatPana: pana }
        : { incercariGresite: incercari }).where(eq(utilizator.id, u.id));
      return blocheaza ? { fel: "blocat", pana } as const : { fel: "gresit" } as const;
    }
    await tx.update(utilizator).set({ incercariGresite: 0, blocatPana: null, ultimaIntrare: acum }).where(eq(utilizator.id, u.id));
    // Sesiunile expirate ale omului pleacă la fiecare intrare: tabelul nu crește la nesfârșit.
    await tx.delete(sesiune).where(and(eq(sesiune.utilizatorId, u.id), lt(sesiune.expira, acum)));
    const cookie = tokenNou();
    await tx.insert(sesiune).values({
      tenantId, utilizatorId: u.id, hash: hashToken(cookie), expira: new Date(acum.getTime() + DURATA_SESIUNE_MS),
    });
    return { fel: "ok", cookie, om: omDin(u) } as const;
  });
}

/** Cine e în spatele cookie-ului. Null = fără sesiune, expirată, sau cont dezactivat. */
export async function omDinCookie(db: Baza, tenantId: string, cookie: string, acum = new Date()): Promise<Om | null> {
  if (!cookie || cookie.length > 100) return null;
  return caTenant(db, tenantId, async (tx) => {
    const [r] = await tx.select({ u: utilizator }).from(sesiune)
      .innerJoin(utilizator, and(eq(utilizator.tenantId, sesiune.tenantId), eq(utilizator.id, sesiune.utilizatorId)))
      .where(and(eq(sesiune.hash, hashToken(cookie)), gt(sesiune.expira, acum))).limit(1);
    return r && r.u.activ ? omDin(r.u) : null;
  });
}

export async function iesi(db: Baza, tenantId: string, cookie: string): Promise<void> {
  await caTenant(db, tenantId, (tx) => tx.delete(sesiune).where(eq(sesiune.hash, hashToken(cookie))));
}

/**
 * Parola nouă, cu cea veche ca dovadă. Celelalte sesiuni ale omului se închid
 * (un telefon pierdut, un calculator lăsat deschis); rămâne doar cea de acum.
 * Întoarce motivul refuzului, sau null.
 */
export async function schimbaParola(
  db: Baza, tenantId: string, om: Om, cookie: string, veche: string, noua: string,
): Promise<string | null> {
  const problema = problemaParola(noua);
  if (problema) return problema;
  if (veche === noua) return "Parola nouă trebuie să fie alta decât cea de acum.";
  return caTenant(db, tenantId, async (tx) => {
    const [u] = await tx.select().from(utilizator).where(eq(utilizator.id, om.utilizatorId));
    if (!u?.parolaHash || !(await verificaParola(veche, u.parolaHash))) return "Parola de acum nu e cea scrisă.";
    await tx.update(utilizator).set({ parolaHash: await hashParola(noua), parolaTemporara: false })
      .where(eq(utilizator.id, u.id));
    await tx.delete(sesiune).where(and(eq(sesiune.utilizatorId, u.id), ne(sesiune.hash, hashToken(cookie))));
    return null;
  });
}

/** Câte conturi pot intra (active, cu parolă). Zero → nimeni nu intră: `porneste.ts` o spune. */
export async function conturiActive(db: Baza, tenantId: string): Promise<number> {
  return caTenant(db, tenantId, async (tx) => {
    const [r] = await tx.select({ n: sql<number>`count(*)` }).from(utilizator)
      .where(and(eq(utilizator.activ, true), sql`${utilizator.parolaHash} is not null`));
    return Number(r?.n ?? 0);
  });
}
