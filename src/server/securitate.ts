/**
 * Ce pune serverul pe fiecare răspuns ca pagina să nu poată fi folosită
 * împotriva omului (21 octombrie 2026, odată cu conturile):
 *
 * - CSP: scripturi doar de pe server (plus scriptul inline al temei, după
 *   amprenta lui), nicio încadrare în alt site, niciun `<object>`;
 * - `nosniff`, fără referrer în afară, fără cameră / microfon;
 * - pe https, HSTS: browserul nu mai încearcă http.
 *
 * Plus cookie-ul de sesiune și limita de încercări de intrare pe adresă.
 */
import { createHash } from "node:crypto";
import type { Context, MiddlewareHandler } from "hono";

export const COOKIE = "izorep_sesiune";

/** E https? Pe Render, TLS-ul se termină înaintea serverului, care vede `x-forwarded-proto`. */
export const peHttps = (c: Context): boolean =>
  (c.req.header("x-forwarded-proto") ?? new URL(c.req.url).protocol.replace(":", "")) === "https";

/** Amprentele scripturilor inline din pagina construită, pentru CSP (`script-src 'sha256-…'`). */
export function amprenteScripturi(html: string): string[] {
  return [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)]
    .map((m) => `'sha256-${createHash("sha256").update(m[1]!).digest("base64")}'`);
}

export function antete(scripturi: readonly string[] = []): MiddlewareHandler {
  const csp = [
    "default-src 'self'",
    `script-src 'self' ${scripturi.join(" ")}`.trim(),
    // Ecranele pun stiluri pe elemente (`style="…"`); fără scripturi străine, nu e o cale de atac.
    "style-src 'self' 'unsafe-inline'",
    // Pozele din carnet și avizele se arată din memorie (data:, blob:).
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
  return async (c, next) => {
    await next();
    const h = c.res.headers;
    h.set("X-Content-Type-Options", "nosniff");
    h.set("X-Frame-Options", "DENY");
    h.set("Referrer-Policy", "same-origin");
    h.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    h.set("Cross-Origin-Opener-Policy", "same-origin");
    // Documentele atașate (PDF, poze) se deschid în vizualizatorul browserului: fără CSP pe ele.
    if (!c.req.path.startsWith("/api/documente/")) h.set("Content-Security-Policy", csp);
    if (peHttps(c)) h.set("Strict-Transport-Security", "max-age=31536000");
    // Răspunsurile cu date nu se țin în cache: un calculator comun nu le arată după ieșire.
    if (c.req.path.startsWith("/api/")) h.set("Cache-Control", "no-store");
  };
}

export function cookieSesiune(c: Context, valoare: string, maxAgeSec: number): string {
  return [
    `${COOKIE}=${valoare}`, "Path=/", "HttpOnly", "SameSite=Lax", `Max-Age=${maxAgeSec}`,
    ...(peHttps(c) ? ["Secure"] : []),
  ].join("; ");
}

export function cookieDin(c: Context): string {
  const antet = c.req.header("cookie") ?? "";
  for (const parte of antet.split(";")) {
    const [k, ...v] = parte.trim().split("=");
    if (k === COOKIE) return v.join("=");
  }
  return "";
}

/**
 * Câte încercări de intrare de pe aceeași adresă, într-o fereastră. Peste,
 * 429: cine încearcă parole pe rând se oprește chiar și pe conturi diferite
 * (blocarea pe cont din `intrare.ts` prinde doar un cont). În memorie: la
 * repornire se golește, iar blocarea pe cont rămâne în bază.
 */
export function limitaIncercari(maxim = 20, fereastraMs = 15 * 60 * 1000): { permis: (cheie: string, acum?: number) => boolean } {
  const vazute = new Map<string, { n: number; start: number }>();
  return {
    permis(cheie, acum = Date.now()) {
      for (const [k, v] of vazute) if (acum - v.start > fereastraMs) vazute.delete(k);
      const v = vazute.get(cheie) ?? { n: 0, start: acum };
      v.n++;
      vazute.set(cheie, v);
      return v.n <= maxim;
    },
  };
}

/**
 * Adresa omului: ultima din `x-forwarded-for`, pe care o adaugă proxy-ul
 * Render. Prima o poate scrie oricine în cerere, iar limita s-ar ocoli
 * schimbând-o la fiecare încercare. Fără antet (local), „local”.
 */
export const adresa = (c: Context): string => c.req.header("x-forwarded-for")?.split(",").at(-1)?.trim() || "local";
