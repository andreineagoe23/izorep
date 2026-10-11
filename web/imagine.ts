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

/** Ruta unui model, langa pagina (merge si sub un subdirector). */
export const rutaModel = (nume: string): string => location.pathname.replace(/[^/]*$/, "") + `api/${nume}`;

/** GET pe ruta modelului: raspunde si e pornit? Pe Pages ruta lipseste. */
export async function modelPornit(nume: string): Promise<boolean> {
  try {
    const r = await fetch(rutaModel(nume), { signal: AbortSignal.timeout(3000) });
    if (!r.ok) return false;
    return Boolean(((await r.json()) as { disponibil?: boolean }).disponibil);
  } catch {
    return false;
  }
}
