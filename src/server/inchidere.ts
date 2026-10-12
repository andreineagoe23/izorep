/**
 * Inchiderea santierului pe server (Faza 7). O operatie, ca receptia din Faza
 * 4: miscarile se calculeaza aici, din ce e in baza, cu id-urile trimise de
 * browser, iar santierul se inchide in aceeasi tranzactie, doar cu stocul la
 * zero. Trimisa de doua ori, a doua oara nu face nimic.
 */
import { eq } from "drizzle-orm";
import type { Baza } from "../db/client.js";
import { santier } from "../db/schema.js";
import { miscariInchidere, stocZero, valideazaInchidere, type RestNumarat } from "../lucrari/inchidere.js";
import { adaugaMiscare, Refuz, stareDepozit } from "./repo.js";
import type { Context } from "./contract.js";

export async function inchideSantier(
  tx: Baza, ctx: Context, id: string, inventar: RestNumarat[], ids: string[], data: string,
): Promise<number> {
  const [s] = await tx.select({ inchis: santier.inchisLa }).from(santier).where(eq(santier.id, id));
  if (!s) throw new Refuz(404, "Șantierul nu e pe server.");
  if (s.inchis) return 0; // inchis deja: retrimisa
  const { miscari } = await stareDepozit(tx);
  const inc = { santier: id, inventar };
  const gresit = valideazaInchidere(inc, miscari);
  if (gresit) throw new Refuz(409, gresit);
  let i = 0;
  const noi = miscariInchidere(inc, miscari, () => {
    const x = ids[i++];
    if (!x) throw new Refuz(400, "Lipsesc id-urile mișcărilor.");
    return x;
  }, data);
  let scrise = 0;
  for (const m of noi) if (await adaugaMiscare(tx, ctx, m)) scrise++;
  if (!stocZero([...miscari, ...noi], id)) throw new Refuz(409, "Stocul șantierului nu ajunge la zero: numără din nou.");
  await tx.update(santier).set({ inchisLa: new Date(data) }).where(eq(santier.id, id));
  return scrise;
}
