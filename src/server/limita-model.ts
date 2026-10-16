/**
 * Plafonul zilnic pe model (OpenAI), cerut de Andrei pe 16 octombrie 2026.
 *
 * Serverul e in internet cu parola comuna. Cine trece de ea (parola scapata,
 * un script) ar putea chema `/api/extrage`, `/api/poza` si `/api/aviz` la
 * nesfarsit, pe cheia firmei. Plafonul pune o limita pe zi, pe doua tipuri:
 *
 *   linii  randurile din Excel trimise la model (`/api/extrage`)
 *   poze   pozele din carnet si avizele / facturile (`/api/poza`, `/api/aviz`),
 *          cu modelul pozelor, cel mai scump
 *
 * Ziua e cea de la Bucuresti si se numara in baza (`folosire_model`), nu in
 * memorie: pe Render serverul gratuit adoarme dupa 15 minute si ar porni de la
 * zero la fiecare trezire.
 *
 * Nu apara de o cheie OpenAI scapata: cu cheia, cineva cheama OpenAI direct,
 * fara serverul nostru. Acolo apara doar limita de cheltuieli din contul
 * OpenAI.
 */
import { sql } from "drizzle-orm";
import type { Baza } from "../db/client.js";

export type TipModel = "linii" | "poze";

export type Plafoane = Record<TipModel, number>;

/**
 * Implicitele: cu mult peste o zi de lucru (TRANSAVIA trimite 1 rand la model,
 * spitalul 81; o zi cu multe poze din carnet are zeci), dar destul de jos cat
 * o zi de abuz sa nu coste mult.
 */
export const PLAFOANE_IMPLICITE: Plafoane = { linii: 3000, poze: 100 };

/** `IZOREP_PLAFON_LINII`, `IZOREP_PLAFON_POZE`; altfel implicitele. */
export function plafoaneDinMediu(env: NodeJS.ProcessEnv = process.env): Plafoane {
  const nr = (c: string, i: number): number => {
    const v = Number(env[c]);
    return env[c] !== undefined && Number.isInteger(v) && v >= 0 ? v : i;
  };
  return {
    linii: nr("IZOREP_PLAFON_LINII", PLAFOANE_IMPLICITE.linii),
    poze: nr("IZOREP_PLAFON_POZE", PLAFOANE_IMPLICITE.poze),
  };
}

/** Trece cererea (true) sau a atins plafonul de azi (false). Daca trece, unitatile s-au numarat. */
export type Limita = (tip: TipModel, unitati: number) => Promise<boolean>;

/**
 * Plafonul tinut in baza. Numararea e un singur `insert … on conflict`, cu
 * conditia in el: doua cereri deodata nu pot trece amandoua peste plafon.
 * `zi` e doar pentru teste; altfel, ziua de azi la Bucuresti.
 */
export function limitaDinBaza(db: Baza, plafoane: Plafoane, zi?: string): Limita {
  return async (tip, unitati) => {
    const max = plafoane[tip];
    const ziua = zi !== undefined ? sql`${zi}::date` : sql`(now() at time zone 'Europe/Bucharest')::date`;
    // Parametrii pleaca fara tip: fara `::int`, „6” <= „10” se compara ca text.
    const r = await db.execute(sql`
      insert into folosire_model (zi, tip, unitati)
      select ${ziua}, ${tip}::text, ${unitati}::int where ${unitati}::int <= ${max}::int
      on conflict (zi, tip) do update set unitati = folosire_model.unitati + excluded.unitati
        where folosire_model.unitati + excluded.unitati <= ${max}::int
      returning unitati`);
    return r.length > 0;
  };
}

/** Ce vede omul cand s-a atins plafonul. */
export function mesajPlafon(tip: TipModel, plafoane: Plafoane): string {
  return tip === "linii"
    ? `S-a atins limita de azi pentru citirea cu model (${plafoane.linii} de rânduri din Excel). Rândurile rămase merg pe reguli; limita se reia mâine.`
    : `S-a atins limita de azi pentru citirea cu model (${plafoane.poze} de poze și avize). Se poate scrie de mână; limita se reia mâine.`;
}
