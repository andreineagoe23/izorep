/**
 * Materialele unei etape, din masuratorile de pe teren (S2: „comanda se da
 * dupa masuratori”, ca sa nu ramana marfa pe santier).
 *
 * Fara reguli proprii: randurile confirmate din carnet trec prin acelasi
 * import ca o cerere de oferta (`spreCerere` → registru → `proceseazaRegistru`),
 * apoi prin acelasi calcul de necesar ca oferta (`necesarDinLinii`), cu
 * pierderile, pragul de tub si diametrele comandate ca tub ale santierului.
 * Deci un metru masurat cere exact cat material ar fi cerut un metru din
 * oferta. Ce se comanda din el o decide `deComandatSantier(..., "sold")`.
 */
import { parseFoiBuffer } from "../import/parse-workbook.js";
import { proceseazaRegistru } from "../import/nucleu.js";
import { stocInMemorie } from "../import/memorie.js";
import type { Destinatie } from "../pricing/lists.js";
import type { RandSantier } from "../santier/agrega.js";
import { spreCerere } from "../santier/spre-cerere.js";
import { registruCerere } from "../santier/registru.js";
import { necesarDinLinii, type Necesar, type OptiuniNecesar } from "./necesar.js";

export async function necesarDinMasuratori(
  randuri: readonly RandSantier[], destinatie: Destinatie, o: OptiuniNecesar = {},
): Promise<Necesar & { randuri: number }> {
  const linii = spreCerere(randuri);
  if (linii.length === 0) return { ...necesarDinLinii([], o), randuri: 0 };
  const foi = await parseFoiBuffer(await registruCerere(linii, "Masuratori pentru comanda"));
  // Fara memoria de sabloane: ce a invatat importul nu schimba ce s-a masurat.
  const rez = await proceseazaRegistru(foi, { stoc: stocInMemorie(), destinatie });
  return { ...necesarDinLinii(rez.linii, o), randuri: linii.length };
}
