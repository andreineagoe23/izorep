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
    { id: "stoc", eticheta: "Depozit și stoc" },
  ]},
  { titlu: "Nomenclatoare", itemi: [
    { id: "clienti", eticheta: "Clienți" },
    { id: "preturi", eticheta: "Liste de prețuri" },
  ]},
];

/** Module care fac parte din sistem, dar nu sunt livrate in aceasta etapa. */
export const VIITOR: string[] = [
  "Aplicația de teren",
  "Situații de lucrări",
  "Facturi",
  "Portal client",
];

export type Rol = "birou" | "santier" | "contabilitate";

/**
 * Trei roluri, cat are o firma mica: biroul face ofertele, santierul
 * raporteaza, contabilitatea factureaza. Valorile in bani nu se vad pe santier.
 */
export const ROLURI: { id: Rol; eticheta: string; vedeCosturi: boolean }[] = [
  { id: "birou", eticheta: "Birou", vedeCosturi: true },
  { id: "santier", eticheta: "Șantier", vedeCosturi: false },
  { id: "contabilitate", eticheta: "Contabilitate", vedeCosturi: true },
];

/** Rolul activ. Valorile ofertate si facturate nu se vad pe santier. */
export let rolActiv: Rol = "birou";
export const setRol = (r: Rol): void => { rolActiv = r; };
export const vedeCosturi = (): boolean => ROLURI.find((r) => r.id === rolActiv)?.vedeCosturi ?? false;
