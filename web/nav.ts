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
 * Modulele nelivrate (facturi, portalul clientului) nu apar deloc: lista lor
 * pliata, sub meniu, era inca un lucru de citit fara nimic de facut acolo
 * (planul UX, 14 noiembrie 2026).
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
  // „Materiale” (un ecran cu trei file, 21 octombrie 2026) stă cu șantierele: un grup
  // fără titlu lăsa un gol în meniu (Andrei, 22 octombrie 2026).
  { titlu: "Șantiere", itemi: [
    { id: "lucrari", eticheta: "Șantiere" },
    { id: "masuratori", eticheta: "Măsurători" },
    { id: "materiale", eticheta: "Materiale" },
  ]},
  { titlu: "Setări", itemi: [
    { id: "clienti", eticheta: "Clienți" },
    { id: "preturi", eticheta: "Liste de prețuri" },
    { id: "jurnal", eticheta: "Istoric" },
  ]},
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
