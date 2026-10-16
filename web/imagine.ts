/**
 * Poza trimisa modelului sau pastrata pe server: micsorata la latura maxima,
 * ca JPEG. Folosita de Masuratori (pozele din carnet) si de Comenzi (avizul).
 */

/** Latura maxima trimisa modelului. API-ul oricum reduce la 2048; mai mult e doar upload. */
const LATURA = 2048;

export async function micsoreaza(f: File): Promise<string> {
  const bmp = await createImageBitmap(f, { imageOrientation: "from-image" });
  const k = Math.min(1, LATURA / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * k);
  c.height = Math.round(bmp.height * k);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  return c.toDataURL("image/jpeg", 0.85);
}

/** Un fisier oarecare (PDF-ul avizului) ca data URL, neschimbat. */
export function caDataUrl(f: File): Promise<string> {
  return new Promise((ok, nu) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result));
    r.onerror = () => nu(r.error);
    r.readAsDataURL(f);
  });
}

/**
 * Serverul a refuzat cititul pentru ca s-a atins plafonul de azi
 * (`src/server/limita-model.ts`, 429). Mesajul lui ajunge la om asa cum e:
 * spune ce s-a intamplat si cand se reia, nu „nu s-a putut citi”.
 */
export class PlafonModel extends Error {}

/** Ruta unui model, langa pagina (merge si sub un subdirector). */
export const rutaModel = (nume: string): string => location.pathname.replace(/[^/]*$/, "") + `api/${nume}`;

/**
 * Cum sta modelul, cu motivul. Masuratorile treceau pe tacute pe „scrii de
 * mana” cand modelul nu era pornit, iar omul credea ca a citit poza si n-a
 * gasit nimic (Andrei, 14 octombrie 2026). Motivul se spune pe ecran:
 * - `pornit`: serverul are cheia;
 * - `fara-cheie`: serverul raspunde, dar n-are cheia OpenAI;
 * - `fara-server`: ruta lipseste (linkul demo de pe Pages);
 * - `nu-raspunde`: serverul n-a raspuns in 8 secunde.
 */
export type StareModel = "pornit" | "fara-cheie" | "fara-server" | "nu-raspunde";

export async function stareModel(nume: string): Promise<StareModel> {
  try {
    // 8 s, nu 3: pe Render, primul apel dupa o pauza trezeste serverul.
    const r = await fetch(rutaModel(nume), { signal: AbortSignal.timeout(8000) });
    if (r.status === 404) return "fara-server";
    if (!r.ok) return "nu-raspunde";
    const corp = (await r.json().catch(() => null)) as { disponibil?: boolean } | null;
    if (corp === null) return "fara-server";
    return corp.disponibil ? "pornit" : "fara-cheie";
  } catch {
    return "nu-raspunde";
  }
}

/** GET pe ruta modelului: raspunde si e pornit? Pe Pages ruta lipseste. */
export async function modelPornit(nume: string): Promise<boolean> {
  return (await stareModel(nume)) === "pornit";
}
