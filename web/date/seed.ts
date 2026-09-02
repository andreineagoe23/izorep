/**
 * Datele demo-ului.
 *
 * Totul de aici e extras din fisierele reale primite de la firma
 * (attachments/): denumiri de clienti, obiective, persoane de contact, numere
 * si date de oferta, si valorile insumate din ofertele efective.
 *
 * Ce NU e real si e marcat ca atare: codurile fiscale si numerele de telefon.
 * Nu inventam identificatori pentru firme reale — raman goale pana le da firma.
 */

export type Categorie = "rezidential" | "industrial" | "rafinarie";
export type TipClient = "antreprenor_general" | "beneficiar_final" | "dezvoltator";

export interface Client {
  id: string;
  denumire: string;
  cui: string | null;
  categorie: Categorie;
  tip: TipClient;
  contacte: { nume: string; rol?: string }[];
  formatSituatii: string;
  termenPlataZile: number | null;
  sursa: string;
}

export interface Santier {
  id: string;
  clientId: string;
  denumire: string;
  adresa: string;
}

export type StareLucrare = "ofertata" | "in_executie" | "de_inchis" | "inchisa";

export interface Lucrare {
  id: string;
  denumire: string;
  clientId: string;
  santierId: string;
  stare: StareLucrare;
  progres: number;
  contractat: number | null;
  facturat: number;
  inceput: string | null;
  pozitii: number;
}

export type StareDocument = "cerere" | "ofertata" | "acceptata" | "contractata" | "confirmata";

export interface Document {
  id: string;
  tip: "cerere" | "oferta" | "contract" | "situatie";
  numar: string;
  data: string;
  clientId: string;
  lucrareId: string | null;
  titlu: string;
  valoare: number | null;
  linii: number;
  stare: StareDocument;
  fisierSursa: string;
}

/** Documentele pleaca de la doua firme. Sistemul e multi-firma din prima zi. */
export const FIRME = [
  { id: "radoia", denumire: "RADOIA ISOLIRUNG SRL", serieOferta: "RAD" },
  { id: "isorad", denumire: "R&F ISORAD SYSTEM SRL", serieOferta: "ISO" },
] as const;

export const CLIENTI: Client[] = [
  {
    id: "nisal", denumire: "NISAL SRL", cui: null,
    categorie: "industrial", tip: "antreprenor_general",
    contacte: [{ nume: "Alina Matieș", rol: "oferta 118" }, { nume: "Bogdan Mirza", rol: "contract 5998" }],
    formatSituatii: "Caietul clientului · coduri poziție (01.82.02.01A), descrieri DE/RO",
    termenPlataZile: null,
    sursa: "Oferta 27.04.2026.xlsx · Anexa 1 la contract 5998",
  },
  {
    id: "regina-maria", denumire: "Spital Regina Maria", cui: null,
    categorie: "industrial", tip: "beneficiar_final",
    contacte: [],
    formatSituatii: "Listă de cantități pe capitole, fără prețuri",
    termenPlataZile: null,
    sursa: "Radoia.xlsx · 7 capitole, 215 poziții",
  },
  {
    id: "transavia", denumire: "Transavia", cui: null,
    categorie: "industrial", tip: "beneficiar_final",
    contacte: [],
    formatSituatii: "Pivot pe zone · tip codat în denumire (Di89, g50 - COT)",
    termenPlataZile: null,
    sursa: "Izolatii Transavia.xlsx",
  },
  {
    id: "flower-city", denumire: "Flower City", cui: null,
    categorie: "rezidential", tip: "dezvoltator",
    contacte: [{ nume: "ing. Emil Pușcaș Pop", rol: "întocmit" }],
    formatSituatii: "Cantitate/unitate × nr. unități · Cluj-Napoca",
    termenPlataZile: null,
    sursa: "Lista de cantitati Flower City_F4.xlsx",
  },
];

export const SANTIERE: Santier[] = [
  { id: "s-lutz", clientId: "nisal", denumire: "XXXLutz + Momax Balotești", adresa: "Balotești, Ilfov" },
  { id: "s-dy", clientId: "nisal", denumire: "DY Nutrition, J8 Office Park", adresa: "J8 Office Park, Etaj 3, Corp A" },
  { id: "s-pipera", clientId: "regina-maria", denumire: "Spital Regina Maria", adresa: "Modul 3 · PUD șos. Pipera nr. 59, NC 242523" },
  { id: "s-transavia", clientId: "transavia", denumire: "Rampe de reducere abur", adresa: "—" },
  { id: "s-flower", clientId: "flower-city", denumire: "Flower City, faza F4", adresa: "Cluj-Napoca · 37 case tip A+B, 6 case tip C" },
];

export const LUCRARI: Lucrare[] = [
  {
    id: "L-118", denumire: "Izolații termice, sanitare și ventilație",
    clientId: "nisal", santierId: "s-lutz", stare: "ofertata", progres: 0,
    contractat: 341038.78, facturat: 0, inceput: null, pozitii: 63,
  },
  {
    id: "L-118.1", denumire: "Închideri goluri la foc",
    clientId: "nisal", santierId: "s-lutz", stare: "ofertata", progres: 0,
    contractat: 25384.08, facturat: 0, inceput: null, pozitii: 54,
  },
  {
    id: "L-5998", denumire: "Izolații conducte PPR și apă răcită",
    clientId: "nisal", santierId: "s-dy", stare: "de_inchis", progres: 100,
    contractat: 585.40, facturat: 585.40, inceput: "2024-12-06", pozitii: 10,
  },
];

export const DOCUMENTE: Document[] = [
  {
    id: "d-118", tip: "oferta", numar: "118 / 27.04.2026", data: "2026-04-27",
    clientId: "nisal", lucrareId: "L-118",
    titlu: "Izolații termice — XXXLutz + Momax Balotești",
    valoare: 341038.78, linii: 63, stare: "ofertata",
    fisierSursa: "Oferta 27.04.2026.xlsx",
  },
  {
    id: "d-118-1", tip: "oferta", numar: "118.1 / 27.04.2026", data: "2026-04-27",
    clientId: "nisal", lucrareId: "L-118.1",
    titlu: "Închideri goluri la foc — Mătari",
    valoare: 25384.08, linii: 54, stare: "ofertata",
    fisierSursa: "Oferta 27.04.2026 Matari.xlsx",
  },
  {
    id: "d-5997", tip: "oferta", numar: "5997 / 06.12.2024", data: "2024-12-06",
    clientId: "nisal", lucrareId: "L-5998",
    titlu: "DY Nutrition, J8 Office Park — manoperă",
    valoare: 585.40, linii: 10, stare: "acceptata",
    fisierSursa: "Anexa 1 la contract - Oferta 06.12.2024.xlsx",
  },
  {
    id: "d-5998", tip: "contract", numar: "5998 / 06.12.2024", data: "2024-12-06",
    clientId: "nisal", lucrareId: "L-5998",
    titlu: "Contract cu oferta 5997 ca Anexa 1",
    valoare: 585.40, linii: 10, stare: "contractata",
    fisierSursa: "Anexa 1 la contract - Oferta 06.12.2024.xlsx",
  },
  {
    id: "d-6009", tip: "situatie", numar: "6009 / 19.12.2024", data: "2024-12-19",
    clientId: "nisal", lucrareId: "L-5998",
    titlu: "Situație de lucrări — aceeași structură ca anexa, fără prețuri",
    valoare: null, linii: 10, stare: "confirmata",
    fisierSursa: "Anexa 1 la contract - Oferta 06.12.2024.xlsx",
  },
  {
    id: "d-spital", tip: "cerere", numar: "— / 04.09.2026", data: "2026-09-04",
    clientId: "regina-maria", lucrareId: null,
    titlu: "Spital Regina Maria — listă de cantități, 7 capitole",
    valoare: null, linii: 215, stare: "cerere",
    fisierSursa: "Radoia.xlsx",
  },
  {
    id: "d-transavia", tip: "cerere", numar: "— ", data: "2026-01-01",
    clientId: "transavia", lucrareId: null,
    titlu: "Izolații cu vată minerală și protecție inox 304",
    valoare: null, linii: 77, stare: "cerere",
    fisierSursa: "Izolatii Transavia.xlsx",
  },
  {
    id: "d-flower", tip: "cerere", numar: "12.1 / 29.05.2026", data: "2026-05-29",
    clientId: "flower-city", lucrareId: null,
    titlu: "Flower City F4 — case tip A+B (37) și tip C (6)",
    valoare: null, linii: 9, stare: "cerere",
    fisierSursa: "Lista de cantitati Flower City_F4.xlsx",
  },
];

export const client = (id: string): Client | undefined => CLIENTI.find((c) => c.id === id);
export const santier = (id: string): Santier | undefined => SANTIERE.find((s) => s.id === id);

/** Curs de referință. Într-o aplicație reală vine din API-ul BNR și se îngheață pe document. */
export const CURS_BNR = 4.9772;
