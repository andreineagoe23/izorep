# Planul de simplificare a ecranelor

> Pentru noi (Andrei, Adrian). Scris duminică, 18 octombrie 2026.
>
> **Stare: propunere. Nu se implementează nimic până nu dă Adrian OK-ul.**
> Răspunsul lui (da / nu / schimbă) se scrie la „Ce hotărăște Adrian”, la
> final, apoi se începe pe o ramură nouă, în ordinea fazelor de mai jos.
>
> Macheta e pe canvas (privat, se deschide după Share din pagina lui):
> https://claude.ai/artifact/ExHeaPaA7mYMynH9bqbSHH, cu șase planșe: fluxul,
> Acasă, dosarul lucrării, verificarea, oferta, șantierul.

## De ce

Demo-ul de luni, 19 octombrie, s-a amânat. Aplicația face ce trebuie (calculele
ies 1:1 cu ofertele semnate), dar e prea complicată pentru cei care o vor
folosi: oameni de birou cu foarte puțină experiență cu aplicațiile. Ținta este
ca un om care n-a văzut aplicația să ducă o cerere până la oferta trimisă fără
să întrebe pe cineva.

Măsurat pe ecranele de acum (localhost, 1440 px, 18 octombrie):

| Ecran | Înălțime | Butoane | Câmpuri | Ce încurcă |
|---|---|---|---|---|
| Cerere nouă · Verificare (TRANSAVIA) | 17.000 px | 106 | — | 99 de rânduri „Gata”, fiecare cu „Modifică” și cu etichete ca „ø114 în listă”, „DN100 = ø114,3”; nimic nu spune „poți trece mai departe” |
| Cerere nouă · Oferta | 2.200 px | 4 | 18 | datele ofertei lângă pierderile la tablă / saltele / plăci / tuburi, pragul de 3 țoli și „peste prag, comandă tot tuburi la ø114…” |
| Necesar și depozit | 6.700 px | 99 | 71 | nouă carduri pe un ecran: necesar, stoc, mișcare nouă, inventar, atelier, locuri, ambalaje, drumul materialului |
| Pagina șantierului | 3.100 px | 5 | — | tabel de 7 coloane, majoritatea „—”; acțiunile principale nu se văd |
| Meniul | — | 9 ecrane | — | „Oferte și cereri”, „Șantiere”, „Necesar și depozit”, „Comenzi”, „Poze de pe șantier” sunt bucăți din aceeași lucrare |

## Fluxul cap-coadă: șase pași

Fiecare cerere devine un **dosar de lucrare**. Pașii lui se văd sus, iar pasul
de acum are un singur buton albastru.

| Pas | Cine | Ce apasă | Ce face aplicația |
|---|---|---|---|
| 1. Vine cererea | birou | „Cerere nouă de la client”, alege Excelul | citește și pune prețurile (TRANSAVIA: 99 de poziții, 94.575,06 €) |
| 2. Verifică ce cere ochi | birou | „E bine” / „Schimb” pe pozițiile marcate | când nu e nimic marcat, pasul se sare |
| 3. Trimite oferta | birou | completează numărul ofertei, „Descarcă oferta” | Excelul în formatul firmei, oferta salvată în dosar |
| 4. Clientul acceptă | birou | „Clientul a acceptat: pornește șantierul” | planul și necesarul din ofertă, cu pierderile firmei |
| 5. Vine materialul | birou | „Comandă ce lipsește”, apoi „Am primit marfă” (poza avizului) | comenzile pe furnizor, recepția din aviz |
| 6. Lucrul și situațiile | birou, cu pozele de pe șantier | „Situație nouă” (poze sau scris de mână), la final „Închide șantierul” | situația în Excel, consumul, costul față de ofertă |

Șantierul tot nu folosește aplicația: trimite poze, ca acum
(`.claude/santier.md`).

## Trei reguli pentru orice ecran

1. **Un singur buton albastru**: ce face omul acum. Restul sunt butoane albe sau
   linkuri.
2. **Cuvintele firmei, nu ale aplicației.** Pe ecran nu apar: „ø114 în listă”,
   „rândul din listă”, „regulă presupusă”, „segment”, „model”, „server”. Ce
   explică un calcul se vede doar la „Schimb” sau sub „Mai multe”.
3. **Nimic gol pe ecran.** O coloană plină de „—” nu se desenează; un card fără
   conținut nu apare.

## Meniul: 9 ecrane → 4

| Acum | Propus |
|---|---|
| Acasă | **Acasă** |
| Cerere nouă · Oferte și cereri · Șantiere · Poze de pe șantier | **Lucrări**: lista dosarelor, cu „Cerere nouă” sus |
| Necesar și depozit · Comenzi la furnizori | **Materiale**: depozitul și comenzile, fiecare pe o filă |
| Clienți · Liste de prețuri · Calcul rapid | **Setări** |

Rutele vechi (`#/import`, `#/documente`, `#/lucrari`, `#/masuratori`, `#/stoc`,
`#/comenzi`) rămân ca alias-uri (`ALIAS` din `main.ts`), ca linkurile să meargă.

## Ecran cu ecran

### Acasă (planșa 1)

- Sus: „Cerere nouă de la client”, mare.
- „De făcut”: câte un rând pe lucru, cu un singur buton: „Termină oferta”
  (ofertă nedescărcată), „Comandă ce lipsește” (material necomandat), „Am primit
  marfa” (comandă trimisă de 7 zile, nevenită), „Fă situația” (șantier deschis
  fără situație de 30 de zile). Materialul de comandat, comenzile nevenite și
  ofertele fără șantier există deja la „Necesită atenția ta”
  (`src/lucrari/rapoarte.ts`): se schimbă textul și se adaugă butonul. Oferta
  nedescărcată și situația veche de 30 de zile sunt noi (pragul de 30 de zile e
  al nostru, de confirmat).
- Dedesubt, trei cifre: oferte fără răspuns, șantiere deschise, valoarea
  ofertelor deschise. „Ultimele 7 zile pe șantiere” și nota despre curs pleacă
  sub „Mai multe”.

### Dosarul lucrării (planșa 2), ecran nou

- Titlul (obiectivul), beneficiarul, oferta și valoarea.
- Pașii: Cerere → Ofertă trimisă → Acceptată → Material → Situații → Închis,
  socotiți din ce există deja (cerere, ofertă salvată, plan de șantier,
  necesar, situații, `inchis`). Nu e o stare nouă în bază.
- „Pasul de acum”: un card cu un buton.
- „În dosar”: cererea, oferta (Descarcă Excel), materialul, situațiile.
- „Mai multe”: planul de șantier, consumul de mână, pierderile, închide,
  șterge.
- **De lămurit:** „Acceptată” înseamnă azi „are șantier”. Nu avem un câmp
  „clientul a acceptat”, iar până nu se creează șantierul nu se poate ști.
  Varianta noastră: butonul „Clientul a acceptat: pornește șantierul” face
  ambele, deci nu e nevoie de câmp nou.

### Cerere nouă · Verificarea (planșa 3)

**Foaia clientului rămâne ca în Excel** (decizia din 11 octombrie). Se schimbă
doar ce e în jurul ei:

- Sus, o propoziție și butonul de mers mai departe: „97 din 99 de poziții sunt
  gata. 2 cer să te uiți.” · „Mergi la ofertă”. Cu tot gata (TRANSAVIA azi),
  „Toate cele 99 au preț” și același buton.
- Filtrul pornește pe „De verificat” când există, altfel pe tot fișierul.
  Filtrele rămân două: „De verificat · N” și „Tot fișierul · N”. „Gata” și „Fără
  preț” intră în „De verificat” (fără preț e tot ceva de verificat; regula
  „nicio poziție fără preț” rămâne).
- Coloanele noastre: „Preț” și „Ce faci”. Pe rândurile gata, „● Gata”, fără
  buton; pe cele marcate, motivul într-o propoziție sub descriere și „E bine” /
  „Schimb”. „Am înțeles” (materialul, rândul din listă, DN = ø) apare doar în
  editorul de la „Schimb”.
- „Tip ofertă” (rezidențială / industrială) se alege la pasul 1 și apare sus ca
  text, cu „schimbă”.
- „Mod de afișare: Fișierul clientului / Ca în ofertă” rămâne, dar trece în
  pasul 3, ca previzualizare a ofertei („Vezi oferta cum o primește clientul”).

### Cerere nouă · Oferta (planșa 4)

- Șase câmpuri: număr ofertă (marcat dacă lipsește), data, beneficiar,
  obiectivul, în atenția, firma. Localitatea se ia din fișier, ca acum, și se
  vede în previzualizare.
- Dreapta: „Clientul plătește 91.737,81 €” și „Descarcă oferta (Excel)”.
- Discountul și ajustarea prețurilor sub „Mai multe”.
- **„Materiale de comandat” pleacă de aici**: înainte să accepte clientul nu e
  nevoie de necesar. Se calculează la „Pornește șantierul” cu valorile firmei
  (pierderi 10 / 10 / 10 / 0 %, tuburi până la 3 țoli); se schimbă din dosar,
  sub „Mai multe”. „Creează șantierul” se mută în dosar.

### Pagina șantierului (planșa 5)

- Sus: cât s-a lucrat (procent și bani).
- Trei butoane mari: „Situație nouă” (albastru), „Comandă ce lipsește”, „Am
  primit marfă”.
- „Poze de pe șantier” nu mai e ecran separat: pozele intră din „Situație nouă”
  (pozele pentru ofertă, de la clienții din apropiere, intră din „Cerere nouă”,
  ca a doua variantă lângă Excel).
- Materialul: patru coloane (Material, Trebuie, Pe șantier, Stare) cu trei
  stări: „Are tot”, „Comandat, vine”, „Lipsește”. Ce are tot se strânge într-un
  rând („încă 6 materiale, toate pe șantier”). Coloanele de acum (comandat,
  venit, pus, rămas, lipsește, pierdere) rămân sub „Mai multe”, pentru cine
  vrea detaliul.
- Situațiile trimise, cu Excelul fiecăreia.

### Materiale

- Două file: „Depozit” și „Comenzi”.
- Depozit: stocul pe locuri și „Mișcare nouă”. Inventarul, atelierul, locurile
  și responsabilii, ambalajele, drumul materialului trec fiecare sub „Mai
  multe”, pliate.
- Necesarul pe șantier pleacă din Depozit: stă pe pagina șantierului.
- Comenzi: neschimbat ca logică; ciorna arată valoarea la fiecare tastă (deja
  făcut, 18 octombrie).

## Ce nu se schimbă

- Calculele, regulile de preț, importul, exportul ofertei: nimic. Testele de
  reproducere a ofertelor semnate (`oferte-semnate.test.ts`,
  `document-oferta.test.ts`) trebuie să treacă neatinse după fiecare fază.
- Foaia clientului ca în Excel, editabilă, cu actualizarea la tastă.
- Datele din bază: nicio migrare. Pașii dosarului se socotesc din ce există.
- Nicio funcție nu dispare; ce se folosește rar se pliază.

## Fazele, în ordine

Fiecare fază e o ramură, verificată în browser (Playwright, 390–1920 px, ambele
teme, pe `npm run dev` și pe build-ul de server), arătată lui Andrei, apoi pe
`main`.

1. **Regulile pe ecranele de acum**, fără să mutăm nimic: un singur buton
   albastru, textele fără jargon, coloanele goale ascunse, „Mai multe” pliat.
   Cel mai ieftin pas și cel mai vizibil.
2. **Verificarea și oferta** (planșele 3, 4): propoziția de sus, filtrul pe „De
   verificat”, „E bine” / „Schimb”, oferta cu șase câmpuri, necesarul mutat la
   pornirea șantierului.
3. **Dosarul lucrării** (planșa 2) și meniul pe 4: ecranul nou, lista
   „Lucrări”, alias-urile.
4. **Pagina șantierului** (planșa 5): cele trei butoane, materialul pe trei
   stări, pozele în „Situație nouă”.
5. **Acasă** (planșa 1) și **Materiale** pe două file.

Gata când: un om care n-a văzut aplicația duce TRANSAVIA de la fișier la oferta
descărcată (94.575,06 €, 91.737,81 € cu discount) și apoi la șantier pornit,
fără să întrebe. Îl încercăm pe cineva din afara proiectului înainte de firmă.

## Riscuri

- **Mutarea necesarului din pasul „Oferta”** schimbă drumul „Creează
  șantierul”, pe care se sprijină testele de șantier și starea de demo
  (`scripts/demo.ts`). Faza 2 le actualizează împreună.
- **Alias-urile**: orice link vechi (din texte, din tablou) trebuie să ducă în
  locul nou; le verificăm pe toate cu Playwright.
- **„Fără preț” în „De verificat”**: nu trebuie să ascundă o poziție fără preț.
  Contorul și propoziția de sus spun separat câte n-au preț, dacă există.

## Ce hotărăște Adrian

Pentru fiecare: da / nu / altfel.

1. Dosarul lucrării ca loc unic pentru cerere, ofertă, șantier și situații.
2. Meniul pe 4: Acasă · Lucrări · Materiale · Setări.
3. Verificarea pornește pe „De verificat”, cu „E bine” / „Schimb”; foaia ca în
   Excel rămâne.
4. „Materiale de comandat” mutat din pasul „Oferta” la pornirea șantierului.
5. „Poze de pe șantier” intră în „Situație nouă” și „Cerere nouă”, fără ecran
   separat.
6. Materialul șantierului pe trei stări, cu detaliul sub „Mai multe”.
7. Ordinea fazelor.

Răspunsul lui Adrian:

> _de completat_
