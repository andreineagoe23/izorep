/**
 * Parola comuna pe tot site-ul (12 octombrie 2026): poarta pana revin
 * conturile, pentru demo-ul de pe Render (`docs/plan-deploy.md`, pasul 1 de
 * securitate). Basic Auth: browserul o cere o data si o retine, fara ecran de
 * intrare la noi. Numele de utilizator nu conteaza; parola, da.
 *
 * Nu inlocuieste conturile: cu o parola comuna nu se stie cine a schimbat un
 * pret (`docs/productie.md`). E pentru date de test, nu pentru lucru real.
 */
import { createHash, timingSafeEqual } from "node:crypto";
import type { MiddlewareHandler } from "hono";

/**
 * Ruta pe care o verifica Render ca sa stie daca serverul traieste. Ramane
 * deschisa: in spatele parolei ar primi 401, iar Render ar opri serverul. Nu
 * spune nimic despre firma.
 */
export const RUTA_VIATA = "/api/viu";

const amprenta = (s: string): Buffer => createHash("sha256").update(s).digest();

/** Parola din antetul `Authorization: Basic …`, sau null. */
function parolaDinAntet(antet: string | undefined): string | null {
  const m = /^Basic\s+(\S+)$/i.exec(antet ?? "");
  if (!m) return null;
  const text = Buffer.from(m[1]!, "base64").toString("utf8");
  const i = text.indexOf(":");
  return i < 0 ? null : text.slice(i + 1);
}

export function parolaComuna(parola: string): MiddlewareHandler {
  const asteptata = amprenta(parola);
  return async (c, next) => {
    const data = parolaDinAntet(c.req.header("authorization"));
    // Comparatie in timp constant, pe amprente de aceeasi lungime.
    if (data !== null && timingSafeEqual(amprenta(data), asteptata)) return next();
    return c.text("Parola lipsește sau e greșită.", 401, {
      "WWW-Authenticate": 'Basic realm="Izorep", charset="UTF-8"',
    });
  };
}
