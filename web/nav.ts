export interface ItemMeniu {
  id: string;
  eticheta: string;
}

export interface GrupMeniu {
  titlu: string;
  itemi: ItemMeniu[];
}

/**
 * Meniul contine doar destinatii care exista. Opt intrari, doua grupuri:
 * fluxul zilnic sus, nomenclatoarele care se ating rar dedesubt.
 *
 * Varianta anterioara amesteca ecrane livrate cu module viitoare in cinci
 * grupuri. Harta sistemului e utila clientului, dar nu are ce cauta in
 * navigatia zilnica: modulele nelivrate stau in `VIITOR`, intr-o lista
 * pliata, sub meniu.
 */
export const MENIU: GrupMeniu[] = [
  { titlu: "Zi de zi", itemi: [
    { id: "tablou", eticheta: "Tablou de bord" },
    { id: "lucrari", eticheta: "Lucrări" },
    { id: "documente", eticheta: "Cereri și oferte" },
    { id: "deviz", eticheta: "Calcul deviz" },
    { id: "import", eticheta: "Import Excel" },
    { id: "masuratori", eticheta: "Măsurători" },
    { id: "stoc", eticheta: "Depozit și stoc" },
  ]},
  { titlu: "Nomenclatoare", itemi: [
    { id: "clienti", eticheta: "Clienți" },
    { id: "preturi", eticheta: "Liste de prețuri" },
  ]},
];

/** Module care fac parte din sistem, dar nu sunt livrate in aceasta etapa. */
export const VIITOR: string[] = [
  "Facturi",
  "Portal client",
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
