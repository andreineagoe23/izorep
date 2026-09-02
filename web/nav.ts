export interface ItemMeniu {
  id: string;
  eticheta: string;
  /** false = apare in meniu, dar ca destinatie viitoare. */
  construit: boolean;
  contor?: () => number;
}

export interface GrupMeniu {
  titlu: string;
  itemi: ItemMeniu[];
}

/**
 * Meniul e harta intregului sistem, nu doar a ce e construit.
 *
 * Arata clientului unde se ajunge, dar marcheaza explicit ce e livrat si ce
 * urmeaza: un demo in care jumatate din ecrane sunt goale fara avertisment
 * isi pierde credibilitatea exact acolo unde era mai puternic.
 */
export const MENIU: GrupMeniu[] = [
  { titlu: "Activitate", itemi: [
    { id: "tablou", eticheta: "Tablou de bord", construit: true },
    { id: "lucrari", eticheta: "Lucrări", construit: true },
  ]},
  { titlu: "Comercial", itemi: [
    { id: "clienti", eticheta: "Clienți", construit: true },
    { id: "cereri", eticheta: "Cereri", construit: true },
    { id: "deviz", eticheta: "Calcul deviz", construit: true },
    { id: "oferte", eticheta: "Oferte", construit: true },
    { id: "contracte", eticheta: "Contracte", construit: false },
  ]},
  { titlu: "Execuție", itemi: [
    { id: "stoc", eticheta: "Depozit și stoc", construit: false },
    { id: "teren", eticheta: "Aplicația de teren", construit: false },
    { id: "situatii", eticheta: "Situații de lucrări", construit: false },
  ]},
  { titlu: "Financiar", itemi: [
    { id: "facturi", eticheta: "Facturi", construit: false },
  ]},
  { titlu: "Configurare", itemi: [
    { id: "preturi", eticheta: "Liste de prețuri", construit: true },
    { id: "import", eticheta: "Import Excel", construit: true },
    { id: "portal", eticheta: "Portal client", construit: false },
  ]},
];

export type Rol = "patron" | "tehnic" | "sef_echipa" | "gestionar" | "contabilitate";

export const ROLURI: { id: Rol; eticheta: string; vedeCosturi: boolean }[] = [
  { id: "patron", eticheta: "Patron", vedeCosturi: true },
  { id: "tehnic", eticheta: "Tehnic / Ofertant", vedeCosturi: false },
  { id: "sef_echipa", eticheta: "Șef echipă", vedeCosturi: false },
  { id: "gestionar", eticheta: "Gestionar", vedeCosturi: false },
  { id: "contabilitate", eticheta: "Contabilitate", vedeCosturi: false },
];

/** Rolul activ. Marja si costul de achizitie se vad doar de patron. */
export let rolActiv: Rol = "patron";
export const setRol = (r: Rol): void => { rolActiv = r; };
export const vedeCosturi = (): boolean => ROLURI.find((r) => r.id === rolActiv)?.vedeCosturi ?? false;
