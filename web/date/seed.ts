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
  /** Lipsa = fisierul clientului nu poarta data; nu o inventam. */
  data: string | null;
  clientId: string;
  lucrareId: string | null;
  titlu: string;
  valoare: number | null;
  linii: number;
  stare: StareDocument;
  fisierSursa: string;
  /** Firma emitenta, pentru documentele emise de noi. */
  firmaId?: "radoia" | "isorad";
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
    formatSituatii: "Caietul clientului: cod pe fiecare poziție (01.82.02.01A), descrieri în germană și română",
    termenPlataZile: null,
    sursa: "oferta-118-nisal.xlsx · oferta-manopera-anexa-contract-2024.xlsx",
  },
  {
    id: "regina-maria", denumire: "Spital Regina Maria", cui: null,
    categorie: "industrial", tip: "beneficiar_final",
    contacte: [],
    formatSituatii: "Listă de cantități pe capitole, fără prețuri",
    termenPlataZile: null,
    sursa: "cerere-de-oferta-spital.xlsx · 7 foi, 129 de poziții de izolație",
  },
  {
    id: "energoinstal", denumire: "Grup Energoinstal SA", cui: null,
    categorie: "industrial", tip: "antreprenor_general",
    contacte: [{ nume: "Vlad Emil", rol: "oferta 284" }],
    formatSituatii: "Listă pe rânduri; diametrul, grosimea și piesa scrise în denumire (Di114, g50 - COT)",
    termenPlataZile: null,
    sursa: "cerere-de-oferta-transavia-abur.xlsx · Oferta 284 / 27.05.2026",
  },
  {
    id: "transavia", denumire: "Transavia", cui: null,
    categorie: "industrial", tip: "beneficiar_final",
    contacte: [],
    formatSituatii: "Cantitățile pe zone, câte o coloană pe zonă; diametrul și grosimea în denumire (Di89, g50 - COT)",
    termenPlataZile: null,
    sursa: "cerere-de-oferta-transavia-inox.xlsx",
  },
  {
    id: "flower-city", denumire: "Flower City", cui: null,
    categorie: "rezidential", tip: "dezvoltator",
    contacte: [{ nume: "ing. Emil Pușcaș Pop", rol: "întocmit" }],
    formatSituatii: "Cantitate pe casă × numărul de case · Cluj-Napoca",
    termenPlataZile: null,
    sursa: "cerere-de-oferta-flower-city.xlsx",
  },
];

export const SANTIERE: Santier[] = [
  { id: "s-lutz", clientId: "nisal", denumire: "XXXLutz + Momax Balotești", adresa: "Balotești, Ilfov" },
  { id: "s-dy", clientId: "nisal", denumire: "DY Nutrition, J8 Office Park", adresa: "J8 Office Park, Etaj 3, Corp A" },
  { id: "s-pipera", clientId: "regina-maria", denumire: "Spital Regina Maria", adresa: "Modul 3 · PUD șos. Pipera nr. 59, NC 242523" },
  { id: "s-transavia", clientId: "energoinstal", denumire: "TRANSAVIA Alba-Iulia", adresa: "Alba-Iulia" },
  { id: "s-flower", clientId: "flower-city", denumire: "Flower City, faza F4", adresa: "Cluj-Napoca · 37 case tip A+B, 6 case tip C" },
];

export const LUCRARI: Lucrare[] = [
  {
    id: "L-118", denumire: "Izolații termice, sanitare și ventilație",
    clientId: "nisal", santierId: "s-lutz", stare: "ofertata", progres: 0,
    contractat: 170519.39, facturat: 0, inceput: null, pozitii: 61,
  },
  {
    id: "L-118.1", denumire: "Închideri goluri la foc",
    clientId: "nisal", santierId: "s-lutz", stare: "ofertata", progres: 0,
    contractat: 12692.04, facturat: 0, inceput: null, pozitii: 53,
  },
  {
    id: "L-5998", denumire: "Izolații conducte PPR și apă răcită",
    clientId: "nisal", santierId: "s-dy", stare: "de_inchis", progres: 100,
    contractat: 706.90, facturat: 706.90, inceput: "2024-12-06", pozitii: 16,
  },
  {
    id: "L-284", denumire: "Izolații abur: vată minerală și tablă de aluminiu",
    clientId: "energoinstal", santierId: "s-transavia", stare: "ofertata", progres: 0,
    contractat: 91737.81, facturat: 0, inceput: null, pozitii: 99,
  },
];

export const DOCUMENTE: Document[] = [
  {
    id: "d-118", tip: "oferta", numar: "118 / 27.04.2026", data: "2026-04-27",
    clientId: "nisal", lucrareId: "L-118",
    titlu: "Izolații termice — XXXLutz + Momax Balotești",
    valoare: 170519.39, linii: 61, stare: "ofertata",
    fisierSursa: "oferta-118-nisal.xlsx", firmaId: "radoia",
  },
  {
    id: "d-118-1", tip: "oferta", numar: "118.1 / 27.04.2026", data: "2026-04-27",
    clientId: "nisal", lucrareId: "L-118.1",
    titlu: "Închideri goluri la foc — Mătari",
    valoare: 12692.04, linii: 53, stare: "ofertata",
    fisierSursa: "oferta-118-1-matari-goluri-foc.xlsx", firmaId: "radoia",
  },
  {
    id: "d-5997", tip: "oferta", numar: "5997 / 06.12.2024", data: "2024-12-06",
    clientId: "nisal", lucrareId: "L-5998",
    titlu: "DY Nutrition, J8 Office Park — manoperă",
    valoare: 706.90, linii: 16, stare: "acceptata",
    fisierSursa: "oferta-manopera-anexa-contract-2024.xlsx", firmaId: "isorad",
  },
  {
    id: "d-5998", tip: "contract", numar: "5998 / 06.12.2024", data: "2024-12-06",
    clientId: "nisal", lucrareId: "L-5998",
    titlu: "Contract cu oferta 5997 ca Anexa 1",
    valoare: 706.90, linii: 16, stare: "contractata",
    fisierSursa: "oferta-manopera-anexa-contract-2024.xlsx", firmaId: "isorad",
  },
  {
    id: "d-6009", tip: "situatie", numar: "6009 / 19.12.2024", data: "2024-12-19",
    clientId: "nisal", lucrareId: "L-5998",
    titlu: "Situație de lucrări pe contractul 5998",
    valoare: null, linii: 16, stare: "confirmata",
    fisierSursa: "oferta-manopera-anexa-contract-2024.xlsx", firmaId: "isorad",
  },
  {
    id: "d-spital", tip: "cerere", numar: "— / 04.09.2026", data: "2026-09-04",
    clientId: "regina-maria", lucrareId: null,
    titlu: "Spital Regina Maria — listă de cantități, 7 capitole",
    valoare: null, linii: 129, stare: "cerere",
    fisierSursa: "cerere-de-oferta-spital.xlsx",
  },
  {
    id: "d-transavia-abur", tip: "cerere", numar: "—", data: null,
    clientId: "energoinstal", lucrareId: "L-284",
    titlu: "TRANSAVIA Alba-Iulia — izolații abur",
    valoare: null, linii: 99, stare: "ofertata",
    fisierSursa: "cerere-de-oferta-transavia-abur.xlsx",
  },
  {
    id: "d-284", tip: "oferta", numar: "284 / 27.05.2026", data: "2026-05-27",
    clientId: "energoinstal", lucrareId: "L-284",
    titlu: "Izolații abur — TRANSAVIA Alba-Iulia",
    valoare: 91737.81, linii: 99, stare: "ofertata",
    fisierSursa: "oferta-284-transavia-abur.xlsx", firmaId: "radoia",
  },
  {
    id: "d-transavia", tip: "cerere", numar: "—", data: null,
    clientId: "transavia", lucrareId: null,
    titlu: "Izolații cu vată minerală și protecție inox 304",
    valoare: null, linii: 72, stare: "cerere",
    fisierSursa: "cerere-de-oferta-transavia-inox.xlsx",
  },
  {
    id: "d-flower", tip: "cerere", numar: "12.1 / 29.05.2026", data: "2026-05-29",
    clientId: "flower-city", lucrareId: null,
    titlu: "Flower City F4 — case tip A+B (37) și tip C (6)",
    valoare: null, linii: 9, stare: "cerere",
    fisierSursa: "cerere-de-oferta-flower-city.xlsx",
  },
];

export const client = (id: string): Client | undefined => CLIENTI.find((c) => c.id === id);
export const santier = (id: string): Santier | undefined => SANTIERE.find((s) => s.id === id);

/** Curs de referință. Într-o aplicație reală vine din API-ul BNR și se îngheață pe document. */
export const CURS_BNR = 4.9772;
