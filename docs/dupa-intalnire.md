# După întâlnire: ce facem cu fiecare răspuns

> Pentru noi (Andrei, Adrian), nu pentru firmă. Numerele urmează foaia
> `docs/intrebari-firma.md`: exemplele 1–7, întrebările tehnice 1–8, stocul
> S1–S49. Fiecare răspuns se trece întâi în `.claude/stare.md`, apoi în cod.
>
> Facturarea și Saga nu s-au întrebat la întâlnirea asta. Construim stocul
> operativ (ce material e unde, pe ce șantier, cât a costat). Dacă stocul
> oficial rămâne în Saga sau trece la noi decide doar dacă mai târziu emitem
> și NIR, bon de consum și aviz; nu schimbă nimic din ce e mai jos.

## Exemplele primite

| Ce primim | Ce facem |
|---|---|
| 1. Oferta Ecoterm din cele 4 poze | Devine răspunsul corect pentru poze: corectăm `tests/fixtures-santier-ecoterm.json` (scoatem `nesigur` unde oferta lămurește), rerulăm `npm run compara-poze`, plus o pereche în `tests/oferte-semnate.test.ts` |
| 2. Alte poze cu ofertele lor | Câte un fixture pe lucrare; alegerea modelului se reface pe toate, nu doar pe Ecoterm |
| 3. Oferta semnată pe Transavia inox (și spital, Book15, Flower City) | Test linie cu linie în `tests/oferte-semnate.test.ts`, ca TRANSAVIA abur; din ea citim și grosimea tablei de inox (întrebarea 2) |
| 4. Perechi cerere + ofertă, două de la același client | Teste noi; cu două de la același client măsurăm memoria de șabloane (L4) |
| 5. O situație de lucrări a lor | `web/situatie.ts` adus la formatul lor (coloane, antet, totaluri) |
| 6. Poze din timpul lucrării, cu situația | Test pe `src/lucrari/potrivire.ts`: pozele trebuie să dea situația lor; vedem ce notație folosesc pe o lucrare în curs |
| 7. Comanda de materiale + aviz + factura furnizorului, aceeași lucrare | Test în `tests/necesar.test.ts`: necesarul calculat din ofertă față de ce s-a comandat de fapt, material cu material. Diferențele sunt regulile care ne lipsesc (ambalaj, pierderi, piese). Prețul de pe factură devine preț de achiziție pe intrare |
| Evidența lor de material pe o lucrare (Excel, caiet) | Forma ecranului de șantier: arătăm aceleași coloane, în ordinea lor |
| Ultimul inventar | Lista reală de articole (ce țin, cum le numesc, în ce unitate) și stocul de pornire (S48) |
| Lista de prețuri sau oferta unui furnizor | Ambalajele și unitatea de cumpărare pe articol (S13) |

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

## Stocul și depozitul

Ce avem azi, ca reper: `src/stoc/necesar.ts` (lista de materiale din ofertă),
`src/stoc/registru.ts` (mișcări: intrare, transfer, consum, retur, ajustare;
stocul e suma lor), `web/depozit-local.ts` (totul în browser). Un articol e
`sistem | grosime | rând`, în ml sau m².

### A. Cum e azi

| Răspuns | Ce decide |
|---|---|
| S1. Unde pierd bani sau timp | Ordinea în care construim. „Rămâne marfă” → închiderea șantierului și resturile întâi. „Lipsește pe șantier” → comanda și recepția întâi. „Nu știu cât a costat” → prețul de achiziție și costul pe șantier întâi |
| S2. Evidența de azi | Ce înlocuim. Dacă e un Excel, îl cerem și copiem forma lui |
| S3. Volumul | Dacă merită mișcare cu mișcare. La 2–3 șantiere și câteva comenzi pe lună, ecranul trebuie să ceară foarte puțin scris |
| S4. O lucrare parcursă cap-coadă | Verifică tabelul „Cum credem că merge”; orice pas care lipsește sau e în altă ordine se corectează acolo întâi |

### B. Deciziile mari

| Răspuns | Ce decide |
|---|---|
| S5. Pentru cine se comandă | **Pe șantier:** comanda are un singur șantier, `deComandat` rămâne cum e. **Mai multe într-o comandă:** linia de comandă poartă șantierul, nu comanda. **Stoc general:** apare rezervarea (S10) și stocul minim pe articol |
| S6. Unde ajunge marfa | Dacă vine și direct pe șantier, intrarea trebuie să poată avea `spre` un șantier (azi merge) și recepția o face cineva care nu e la depozit (S31) |
| S7. Cum se află consumul | **a) plecat = consumat:** scoatem „consum” din ecran, transferul pe șantier e consumul, restul se întoarce cu „retur”. **b) notează cineva:** rămâne mișcarea „consum”, introdusă de birou. **c) din situație:** consumul se calculează din executat × materialul poziției; cere necesarul ținut pe poziție (azi e adunat pe material, `MaterialNecesar.pozitii` e doar un număr). **d) la final:** inventar pe șantier la închidere, o singură „ajustare” |
| S8. Ce rămâne la sfârșit | „Retur” spre depozit și transfer șantier → șantier există; lipsește pasul de închidere care obligă la una din ele |
| S9. Ce vrea să vadă | Cifrele de sus de pe ecranul șantierului (`web/ecrane/lucrari.ts`) și cardul din tabloul de bord. Scriem exact lista lui |
| S10. Material pus deoparte | Rezervare pe șantier: stoc disponibil = stoc − rezervat. Fără ea, `deComandat` numără același material pentru două șantiere |

### C. Lista de materiale

| Răspuns | Ce decide |
|---|---|
| S11. Marca | Dacă contează, intră în cheia articolului (`cheieMaterial`) și în ofertă nu există: se alege la comandă. De hotărât înainte de tabelele din bază, altfel se migrează tot stocul |
| S12. Formele vatei | Articol separat pe formă (cochilie, saltea, placă); azi forma se deduce din pragul de 3 țoli (`PRAG_TUB_MM`) |
| S13. Ambalajul | Unitate de cumpărare pe articol (cutie, rolă, coală, kg) cu factor spre unitatea de evidență. `UM` are azi doar ml și m². Tabla la kg cere greutatea pe m² pe grosime |
| S14. Rotunjirea la ambalaj | `deComandat` rotunjește în sus la ambalaj și arată diferența ca rest așteptat |
| S15, S16. Pierderi la tablă și la plăci | Adaos pe material, nu unul singur pe tot necesarul (`ADAOS_IMPLICIT`, parametrul `adaos`). Eventual separat pe drept și pe piese |
| S17. Material pe casetă, flanșă, reductor | Tabel piesă × diametru → m² de vată și de tablă, lângă `piesePeMetru`. Dispare „+ N buc., de stabilit” din Depozit |
| S18. Mărunte | Urmărite: articole noi, în bucăți, cu normă pe m². Cost general: nu intră în stoc deloc |
| S19. Goluri la foc | Azi ies la `faraNecesar` („materialele ei nu sunt în liste”). Cu regula lor: necesar din suprafața golului, banda și colierul pe bucată |
| S20. Preț pus de mână | Linie de material adăugată de mână pe necesar (azi tot la `faraNecesar`) |
| S21. Rezerva | Confirmă `ADAOS_IMPLICIT = 0`, sau îl înlocuiește cu adaosurile de la S15–S16 |

### D. Comanda

| Răspuns | Ce decide |
|---|---|
| S22. Cine comandă, cine aprobă | Stările comenzii (ciornă, aprobată, trimisă) și primul rol adevărat din aplicație |
| S23. Când | Dacă șantierul trebuie să aibă „contract semnat” înainte de comandă; comandă pe etape = mai multe comenzi pe același necesar, cu „rămas de comandat” |
| S24. Verificarea stocului | `deComandat` scade azi depozitul central și șantierul lucrării. Dacă folosesc resturile altor șantiere, le arătăm ca propunere de transfer înaintea comenzii |
| S25. Furnizorii | Tabel de furnizori; furnizor implicit pe articol; termen de livrare → data la care trebuie făcută comanda |
| S26. Prețul | Fix: preț pe articol și furnizor, costul se știe înainte de comandă. Negociat: doar pe intrare (ca azi). În lei: cursul intră în aplicație (BNR + 1–2 %, `PretAchizitie` e doar EUR). Transportul: rând separat, împărțit pe valoare |
| S27. Cum se trimite | Export Excel al comenzii, ca `web/situatie.ts` |
| S28. Schimbări față de ofertă | Comandă suplimentară legată de șantier, cu motiv. Planul de șantier e azi înghețat; lucrările suplimentare cer plan cu anexă, nu plan refăcut |

### E. Recepția

| Răspuns | Ce decide |
|---|---|
| S29, S30. Verificare, livrări pe bucăți | Recepția se face pe comandă: comandat, primit, rămas de primit; diferențele rămân vizibile pe comandă |
| S31. Cum află biroul | Poză cu avizul: același drum ca pozele din carnet (`src/santier/`), cu omul care confirmă. Telefon: biroul scrie de mână |
| S32. Retur la furnizor | Mișcare nouă (ieșire spre furnizor), nu storno al intrării: marfa a existat în depozit |

### F. Depozitul și drumul

| Răspuns | Ce decide |
|---|---|
| S33. Locurile | Lista de depozite și tipul lor (central, atelier, mașină, șantier). Azi: central plus câte unul pe șantier |
| S34. Cine răspunde | Responsabil pe depozit. Subcontractor care primește material = încă un depozit |
| S35. Hârtia de transport | Dacă vor document din aplicație la fiecare plecare. Legat de Saga, deci doar notăm |
| S36. Tabla lucrată | Separat: mișcare de transformare (coli → piese) și articole pe piesă. Altfel tabla rămâne în m² până la consum |
| S37. Șantier → șantier | Transferul există; trebuie doar lăsat din ecran între două șantiere |
| S38. Materialul clientului | Stoc cu valoare zero, marcat al clientului, care nu intră în „De comandat” și nici în cost |
| S39. Scule, schele | În afara stocului acum; dacă le vor, e alt modul |

### G. Consumul și sfârșitul

| Răspuns | Ce decide |
|---|---|
| S40. Cât de amănunțit | Pe șantier: ajunge ce avem. Pe zonă sau poziție: necesarul ținut pe poziție (aceeași schimbare ca la S7 c) |
| S41. Cât de des | Dacă situația de lucrări cere consumul la zi înainte de salvare |
| S42. Pierderea normală | Prag pe material; peste el, șantierul apare la „Necesită atenția ta” |
| S43. Resturile | Sub prag, bucata e pierdere, nu retur. Deșeul vândut: în afara stocului |
| S44. Costul pe șantier | Prețul lui: costul se ia din intrările șantierului. Mediu: `pretMediu`, ca azi. Dacă există stoc general, trebuie mediul |

### H. Controlul și pornirea

| Răspuns | Ce decide |
|---|---|
| S45. Inventar | Ecran de inventar pe depozit, care scrie „ajustări”; azi ajustarea se face rând cu rând |
| S46. Cele două firme | Separat: firma pe depozit și pe mișcare (granița moale din `backend.md`). Comun: nimic în plus |
| S47. Cine lucrează în aplicație | Rolurile și cât de simplu trebuie să fie ecranul; de pe telefon = recepția și transferul gândite întâi pentru telefon |
| S48. Pornirea | Stoc inițial ca intrare marcată „stoc de pornire”, cu preț. Șantierele în curs: intră cu ce au executat până acum, sau doar cele noi |
| S49. Ce primește directorul | Raportul și alertele din tabloul de bord |

## Ce construim, în ordine

1. **Răspunsurile care schimbă prețuri** (tehnice 2, 3, 4, 6), fiecare cu
   testul lui.
2. **Exemplele primite, ca teste** (oferte semnate, poze, situația, comanda
   reală față de necesar).
3. **Stocul în bază, cu mai mulți oameni** (etapele B și C din `stare.md`).
   Înainte de tabele trebuie S5, S11, S13, S33, S46. Gata când: o intrare
   scrisă pe un calculator se vede pe altul.
4. **Lista de materiale corectă** (S11–S21). Gata când: necesarul TRANSAVIA
   dă comanda lor reală, material cu material, sau diferența are o cauză
   scrisă.
5. **Comanda și recepția** (S22–S32). Gata când: pentru un șantier se vede
   comandat, primit și rămas de primit.
6. **Consumul** (S7, S40–S42), după varianta aleasă.
7. **Închiderea șantierului** (S8, S43, S44). Gata când: un șantier închis
   are stoc zero și costul materialului față de ofertă.
8. **Inventarul și pornirea** (S45, S48).

Dacă S1 arată altă durere, pașii 5–7 își schimbă ordinea între ei.

## Rămâne deschis după întâlnire

- Saga și facturarea (amânate).
- Orice ★ rămas fără răspuns: se trece aici, cu cine îl poate da (directorul
  sau omul care face comenzile).
