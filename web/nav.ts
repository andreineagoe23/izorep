export interface ItemMeniu {
  id: string;
  eticheta: string;
}

export interface GrupMeniu {
  titlu: string;
  itemi: ItemMeniu[];
}

/**
 * Meniul contine doar destinatii care exista. Grupurile urmeaza fluxul
 * firmei (oferte → santiere → materiale), cu nume pe care le folosesc
 * angajatii (15 octombrie 2026): „Lucrari” si „Masuratori” nu spuneau ca acolo
 * e santierul. Setarile, care se ating rar, stau la urma.
 *
 * Varianta anterioara amesteca ecrane livrate cu module viitoare in cinci
 * grupuri. Harta sistemului e utila clientului, dar nu are ce cauta in
 * navigatia zilnica: modulele nelivrate stau in `VIITOR`, intr-o lista
 * pliata, sub meniu.
 */
export const MENIU: GrupMeniu[] = [
  { titlu: "", itemi: [
    { id: "tablou", eticheta: "Acasă" },
  ]},
  { titlu: "Oferte", itemi: [
    { id: "import", eticheta: "Cerere nouă" },
    { id: "documente", eticheta: "Oferte și cereri" },
    { id: "deviz", eticheta: "Calcul rapid" },
  ]},
  { titlu: "Șantiere", itemi: [
    { id: "lucrari", eticheta: "Șantiere" },
    { id: "masuratori", eticheta: "Poze de pe șantier" },
  ]},
  // Un singur ecran, cu trei file (De cumpărat, Comenzi, Depozit): 21 octombrie 2026.
  { titlu: "", itemi: [
    { id: "materiale", eticheta: "Materiale" },
  ]},
  { titlu: "Setări", itemi: [
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
