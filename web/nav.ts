export interface ItemMeniu {
  id: string;
  eticheta: string;
}

export interface GrupMeniu {
  titlu: string;
  itemi: ItemMeniu[];
}

/**
 * Meniul contine doar destinatii care exista. Din 14 noiembrie 2026 (planul
 * UX, Faza 2) are patru intrari, fara grupuri: o lucrare (cererea, oferta,
 * santierul, situatiile) e o singura pagina in „Lucrări”, iar ce se atinge rar
 * sta in „Setări”, cu file. Inainte o lucrare era imprastiata in cinci locuri
 * din meniu, iar omul trebuia sa stie singur in care intra.
 *
 * Modulele nelivrate (facturi, portalul clientului) nu apar deloc: lista lor
 * pliata, sub meniu, era inca un lucru de citit fara nimic de facut acolo.
 */
export const MENIU: GrupMeniu[] = [
  { titlu: "", itemi: [
    { id: "tablou", eticheta: "Acasă" },
    { id: "lucrari", eticheta: "Lucrări" },
    { id: "materiale", eticheta: "Materiale" },
    { id: "setari", eticheta: "Setări" },
  ]},
];

/**
 * Filele din „Setări”: ecranele de dinainte, fiecare cu adresa lui (linkurile
 * vechi merg), sub aceeasi bara de file. „Setări” din meniu deschide prima.
 */
export const SETARI: ItemMeniu[] = [
  { id: "clienti", eticheta: "Clienți" },
  { id: "preturi", eticheta: "Liste de prețuri" },
  { id: "deviz", eticheta: "Calcul rapid" },
  { id: "jurnal", eticheta: "Istoric" },
  { id: "cont", eticheta: "Contul meu" },
];

export type Rol = "birou" | "contabilitate";

/**
 * Rolurile se stabilesc cu firma (29 septembrie 2026). Santierul nu foloseste
 * aplicatia, deci nu are rol. `vedeCosturi` ramane carligul pentru regula
 * „cine vede bani", cand va exista una.
 */
export const ROLURI: { id: Rol; eticheta: string; vedeCosturi: boolean }[] = [
  { id: "birou", eticheta: "Birou", vedeCosturi: true },
  { id: "contabilitate", eticheta: "Contabilitate", vedeCosturi: true },
];

export let rolActiv: Rol = "birou";
export const setRol = (r: Rol): void => { rolActiv = r; };
export const vedeCosturi = (): boolean => ROLURI.find((r) => r.id === rolActiv)?.vedeCosturi ?? false;
