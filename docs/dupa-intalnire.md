# După întâlnirea de luni: ce facem cu fiecare răspuns

> Pentru noi (Andrei, Adrian), nu pentru firmă. Numerele urmează foaia
> `docs/intrebari-firma.md` (tipărită: „Intrebari RADOIA 5 octombrie.pdf”).
> Marți: fiecare răspuns se trece întâi în `.claude/stare.md`, apoi în cod.

## Exemplele primite

| Ce primim | Ce facem |
|---|---|
| 1. Oferta Ecoterm din cele 4 poze | Devine răspunsul corect pentru poze: corectăm `tests/fixtures-santier-ecoterm.json` (scoatem `nesigur` unde oferta lămurește), rerulăm `npm run compara-poze`, plus o pereche în `tests/oferte-semnate.test.ts` |
| 2. Alte poze cu ofertele lor | Câte un fixture pe lucrare; alegerea modelului se reface pe toate, nu doar pe Ecoterm |
| 3. Oferta semnată pe Transavia inox (și spital, Book15, Flower City) | Test linie cu linie în `tests/oferte-semnate.test.ts`, ca TRANSAVIA abur; din ea citim și grosimea tablei de inox (întrebarea 2) |
| 4. Perechi cerere + ofertă, două de la același client | Teste noi; cu două de la același client măsurăm memoria de șabloane (L4) |
| 5. O situație de lucrări a lor | `web/situatie.ts` adus la formatul lor (coloane, antet, totaluri) |
| 6. Poze din timpul lucrării, cu situația | Test pe `src/lucrari/potrivire.ts`: pozele trebuie să dea situația lor; vedem ce notație folosesc pe o lucrare în curs |
| 7. Comanda de materiale + factura furnizorului | Comparăm cu `src/stoc/necesar.ts` (tuburi / plăci, m²); prețul de achiziție din factură, pe intrare |

## Întrebările tehnice

| Răspunsul lor | Unde se schimbă |
|---|---|
| 1. Cum se face oferta la clienții din apropiere | Decide dacă „Măsurători → Pentru ofertă” trebuie să compare cu o listă primită de la client (azi nu compară) |
| 2. Grosimea tablei de inox | Grosime implicită pe `tabla_inox` (`grosimeEfectiva`, `src/pricing/engine.ts`); deblochează 72 de poziții Transavia inox |
| 3. ø90 / ø160: rândul de jos sau de sus | `randInferiorNeconfirmat` și `PRAG_ROTUNJIRE_NECONFIRMATA` (`engine.ts`); dacă e „de jos”, cazurile trec din „abateri cunoscute” în suita principală (`tests/pricing.test.ts`) |
| 4. Calculul peste ø219 | `tarifeazaPesteLista` (`engine.ts`); dacă formula e confirmată, `peste_lista` nu mai cere verificare |
| 5. Lucrări fără listă (tablă zincată pe mp, livrare țeavă, protecție foc tubulatură) | Dacă le ofertează cu o listă: lista intră în `data/price-lists/`; dacă se negociază: rămân pe preț pus de mână (`livrare_teava`, `protectie_foc_tubulatura`, `fara_pret_pe_mp`) |
| 6. PVC pe industrial | Lista nouă în `data/price-lists/industrial/`, prin `scripts/extract_price_lists.py`; scade nota de verificat de pe PVC |
| 7a. Coturi „119–123” | `piesePeMetru` (`src/stoc/necesar.ts`) și testul din `tests/necesar.test.ts`; plus ce se întâmplă peste ø324 |
| 7b. Cât tub ia un cot sub 3 țoli | Tot `necesar.ts`: piesele trec din „+ N buc.” în metri de tub și intră în „De comandat” |
| 8. ROB, „preț dublu”, „× 2” | Promptul și schema pozelor (`src/santier/`), prețul dublu la import (`MARCA_PRET_DUBLU`, `web/ecrane/import.ts`); legenda din `.claude/santier.md` |

## Stocul și facturarea

| Răspunsul lor | Ce decide |
|---|---|
| 1. Saga ține stocul oficial? | **Da:** aplicația ține stocul operativ (pe șantiere) și exportă spre Saga. **Nu:** stocul oficial în aplicație, cu NIR, bonuri de consum, avize — mult mai mult. E prima decizie pentru salvarea datelor în bază |
| 2. Unde stă materialul | Câte depozite: central, șantiere, mașini (`web/depozit-local.ts` → tabelele din bază) |
| 3. Cine trece facturile și cine scoate materialul | Cine are nevoie de acces și la ce; de aici pornesc rolurile, când le cere firma |
| 4. Versiunea de Saga și o factură exportată | Formatul fișierului de import în Saga (`docs/productie.md`, „Legătura cu Saga”) |

## Ordinea de după

1. Răspunsurile care schimbă prețuri (2, 3, 4, 6), fiecare cu testul lui.
2. Exemplele primite, ca teste (oferte semnate, poze, situația).
3. Salvarea datelor într-o bază comună, după răspunsul despre Saga.
