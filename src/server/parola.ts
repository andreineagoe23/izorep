/**
 * Parolele conturilor (21 octombrie 2026, ales de Andrei: email + parolă, în
 * locul parolei comune pe tot site-ul și al linkului pe email, care cerea un
 * furnizor de email pe Render).
 *
 * În bază stă doar `scrypt$N$r$p$sare$hash`: scrypt e lent intenționat și cere
 * memorie, deci o bază scăpată nu se sparge ușor cu plăci video. Comparația e
 * în timp constant. Fără dependențe: `node:crypto`.
 */
import { randomBytes, randomInt, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from "node:crypto";

const scrypt = (parola: string, sare: Buffer, lungime: number, o: ScryptOptions): Promise<Buffer> =>
  new Promise((ok, nu) => scryptCb(parola, sare, lungime, o, (e, k) => (e ? nu(e) : ok(k))));

/** 2^15 iterații de memorie, cum recomandă OWASP pentru scrypt: ~50 ms și 32 MB pe verificare. */
const N = 2 ** 15;
const R = 8;
const P = 1;
const LUNGIME = 32;
const MEMORIE = 128 * N * R * 2;

export const PAROLA_MINIMA = 10;
const PAROLA_MAXIMA = 200;

export async function hashParola(parola: string): Promise<string> {
  const sare = randomBytes(16);
  const h = await scrypt(parola.normalize("NFC"), sare, LUNGIME, { N, r: R, p: P, maxmem: MEMORIE });
  return `scrypt$${N}$${R}$${P}$${sare.toString("base64url")}$${h.toString("base64url")}`;
}

export async function verificaParola(parola: string, stocat: string): Promise<boolean> {
  const [alg, n, r, p, sare, hash] = stocat.split("$");
  if (alg !== "scrypt" || !sare || !hash) return false;
  const asteptat = Buffer.from(hash, "base64url");
  const o = { N: Number(n), r: Number(r), p: Number(p), maxmem: 128 * Number(n) * Number(r) * 2 };
  const calculat = await scrypt(parola.normalize("NFC"), Buffer.from(sare, "base64url"), asteptat.length, o);
  return calculat.length === asteptat.length && timingSafeEqual(calculat, asteptat);
}

/**
 * Un hash care nu se potrivește cu nimic, verificat când emailul n-are cont:
 * răspunsul durează la fel, deci după timp nu se ghicește ce adrese există.
 */
let hashFals: Promise<string> | null = null;
export const verificaInGol = async (parola: string): Promise<void> => {
  hashFals ??= hashParola(randomBytes(16).toString("hex"));
  await verificaParola(parola, await hashFals);
};

/** Cele mai folosite parole, refuzate oricât de lungi ar fi. */
const SLABE = new Set(["1234567890", "0123456789", "parola1234", "password12", "qwertyuiop", "izorep1234", "aaaaaaaaaa"]);

/** De ce nu merge parola aleasă, în cuvintele omului; null = merge. */
export function problemaParola(parola: string): string | null {
  if (parola.length < PAROLA_MINIMA) return `Parola trebuie să aibă cel puțin ${PAROLA_MINIMA} caractere.`;
  if (parola.length > PAROLA_MAXIMA) return `Parola poate avea cel mult ${PAROLA_MAXIMA} de caractere.`;
  if (SLABE.has(parola.toLowerCase()) || new Set(parola).size < 4) return "Parola e prea ușor de ghicit: alege alta.";
  return null;
}

/** O parolă temporară ușor de dictat: fără 0/O, 1/l/I. „kdm7-pq3x-hw9t”. */
export function parolaTemporara(): string {
  const litere = "abcdefghjkmnpqrstuvwxyz23456789";
  const grup = (): string => Array.from({ length: 4 }, () => litere[randomInt(litere.length)]).join("");
  return `${grup()}-${grup()}-${grup()}`;
}
