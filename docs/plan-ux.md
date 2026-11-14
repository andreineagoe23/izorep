# Planul de reorganizare a ecranelor

> Pentru noi (Andrei, Adrian). Scris sâmbătă, 14 noiembrie 2026.
>
> **Stare: propunere. Nu s-a schimbat nimic în cod.**
> Înlocuiește `docs/plan-simplificare.md` (18 octombrie, ramura
> `plan-simplificare`) și macheta „De făcut” din 21 octombrie: ia din amândouă
> ce se potrivește cu ce s-a construit de atunci (filele de la Materiale și de
> pe pagina șantierului) și păstrează navigarea pe file.

## Pe scurt

Aplicația face ce trebuie: calculele ies 1:1 cu ofertele semnate și toate
bucățile fluxului există. Problema e că **o lucrare e împrăștiată în cinci
locuri din meniu**, iar omul trebuie să știe singur în care intră și ce urmează.

Propunerea are trei idei:

1. **Lucrarea e un singur loc.** O pagină pe lucrare, cu filele în ordinea
   fluxului: Cerere · Ofertă · Materiale · Situații · Închidere.
2. **Meniul scade de la 10 la 4:** Acasă · Lucrări · Materiale · Setări.
3. **Pe fiecare ecran, un rând „Urmează” cu un singur buton albastru.** Omul
   nu trebuie să știe fluxul; îl citește.

Calculele, importul, exportul și baza de date nu se schimbă. Se mută ecrane, nu
reguli.

## Cum am făcut auditul

Am citit codul și documentația (`.claude/`, `docs/`), apoi am pornit aplicația
pe o bază separată (`izorep_ux`) cu starea de demo (TRANSAVIA, NISAL, Matari) și
am parcurs cu Playwright toate ecranele, la 1440 și 390 px, măsurând înălțimea,
butoanele și câmpurile. Cifrele de mai jos sunt de pe `main` (65ae583).

## Fluxul de azi, cap-coadă

| Pas | Ce face omul | Unde, în meniu |
|---|---|---|
| 1. Vine cererea | încarcă Excelul sau pozele din carnet | Oferte › Cerere nouă, pasul 1 |
| 2. Verifică | se uită la pozițiile marcate | Cerere nouă, pasul 2 |
| 3. Trimite oferta | completează datele, „Descarcă oferta” | Cerere nouă, pasul 3 |
| 4. Clientul acceptă | „Creează șantierul”, jos pe același pas 3 | Cerere nouă, pasul 3 |
| 5. Comandă material | „Comandă ce lipsește”, „Trimite comanda”, „A venit marfa” | Șantiere › Materiale (3 file) |
| 6. Situații | „Situație nouă”, de mână sau din poze | Șantiere › Șantiere › pagina șantierului; pozele în Șantiere › Măsurători |
| 7. Închide | numără ce a rămas, „Închide șantierul” | pagina șantierului, fila a patra |

Ca să revină la o lucrare, omul are trei intrări diferite: „Importuri recente”
(Cerere nouă), „Oferte și cereri” și „Șantiere”. Niciuna nu arată lucrarea
întreagă.

## Ce am găsit

### Navigarea

| Problemă | Dovada |
|---|---|
| O lucrare stă în 5 locuri | Cerere nouă, Oferte și cereri, Șantiere, Măsurători, Materiale |
| Nimic nu spune ce urmează | după „Descarcă oferta” pagina rămâne pe loc; „Creează șantierul” e la 1.900 px mai jos, sub tabelul de materiale |
| „Oferte și cereri” nu duce la șantier | rândul spune „Șantier făcut”, dar „Deschide” duce înapoi în import |
| Nu există „ofertă trimisă, aștept răspuns” | starea se deduce din „are șantier”; o ofertă refuzată arată la fel ca una nouă |
| Pozele din timpul lucrării sunt alt ecran | în Măsurători alegi întâi scopul, apoi șantierul dintr-o listă, deși vii de pe șantier |
| Materialul unui șantier e în două locuri | fila „Materiale” a șantierului (8 coloane, fără buton de comandă) și Materiale › De cumpărat (4 coloane, cu buton) |
| Meniul are lucruri care nu sunt de lucru | „Module care urmează (2)”, „Calcul rapid”, „Istoric” la același nivel cu fluxul |

### Ecran cu ecran (1440 px, datele de demo)

| Ecran | Înălțime | Butoane | Câmpuri | Ce încurcă |
|---|---|---|---|---|
| Acasă | 1.476 px | 0 | 0 | „Necesită atenția ta” sunt rânduri gri fără buton (sunt linkuri, dar nu se vede); trei tabele de raport sub ele; nota despre curs |
| Cerere nouă · Verificare (TRANSAVIA) | 12.472 px | 106 | 895 | 99 de rânduri „Gata”, fiecare cu 9 casete; filtrul pornește pe „Toate”; nimic nu spune „poți merge mai departe” |
| Cerere nouă · Oferta | 2.234 px | 4 | 18 | două butoane albastre; pierderile la tablă / saltele / plăci / tuburi și pragul de 3 țoli înainte ca clientul să accepte |
| Oferte și cereri | 900 px | 6 | 0 | numele fișierului mai vizibil decât obiectivul; nu duce la șantier |
| Pagina șantierului | 900 px | 9 | 0 | titlul paginii rămâne „Șantiere”, cu subtitlul listei; „Închide” și „Șterge” sunt file egale cu „Situații” |
| Șantier · Materiale | 1.695 px | 8 | 3 | 8 coloane, 12 din 14 rânduri pline de „—”; nu se poate comanda de aici |
| Șantier · Planul | 4.968 px | 7 | 0 | doar citire; e oferta încă o dată |
| Șantier · Situație nouă | 7.635 px | 11 | 101 | toate cele 99 de poziții, și cele terminate; fără căutare, fără grupare |
| Măsurători | 900 px | 1 | 4 | scop + șantier de ales; listă nativă |
| Materiale (3 file) | 1.129 px | 2–5 | 0–5 | e bine, e modelul pentru restul |
| Liste de prețuri | ~5.900 px | 3 | 1 | se consultă rar; e la nivel de meniu |

Două nepotriviri de formă, mici dar vizibile: la Verificare, „Tip ofertă” și
„Ce vezi” sunt perechi de butoane, deși fac ce fac filele din restul
aplicației; iar la Cerere nouă pașii de sus (1 · 2 · 3) și filele de dedesubt
(Fișier Excel · Poze din carnet) arată diferit și fac același lucru: te mută.

### Găsite pe drum, nu de UX

- **Baza de pe Render expiră azi, 14 noiembrie**, fără backup
  (`stare.md`, 23 octombrie). Dacă n-a fost schimbat planul, linkul nu mai are
  date de azi.
- **`npm run demo` nu mai merge** de la conturi încoace (22 octombrie): scriptul
  nu intră în cont și primește 401 la primul pas. Pentru audit l-am rulat
  dintr-o copie care intră în cont. De reparat în `scripts/demo.ts`, altfel
  starea de demo nu se mai poate reface.

## Propunerea

### Trei reguli pentru orice ecran

1. **Un singur buton albastru**: ce face omul acum. Restul sunt albe.
2. **File pe două niveluri, peste tot la fel.** Meniul din stânga alege locul;
   filele de sus aleg partea. Fără carduri pliate, fără liste native.
3. **Nimic gol.** O coloană plină de „—” nu se desenează; ce e gata nu ocupă
   loc.

### Meniul: 10 → 4

| Acum | Propus |
|---|---|
| Acasă | **Acasă** |
| Cerere nouă · Oferte și cereri · Șantiere · Măsurători | **Lucrări** |
| Materiale | **Materiale** (neschimbat: De cumpărat · Comenzi · Depozit) |
| Clienți · Liste de prețuri · Calcul rapid · Istoric · Cont | **Setări**, cu file |

„Module care urmează” pleacă din meniu. Adresele vechi rămân ca alias-uri
(`ALIAS` din `main.ts`).

### Lucrări: lista

- Sus, butonul albastru **„Cerere nouă”**.
- File după stadiu, cu cifra pe fiecare: **De ofertat · Oferte trimise · În
  lucru · Închise**. Se deschide prima filă care are ceva.
- Un rând pe lucrare: obiectivul, clientul, valoarea, ce urmează („2 poziții de
  verificat”, „aștepți răspunsul de 12 zile”, „13 materiale de comandat”) și
  „Deschide”.

### Lucrarea: o pagină, cinci file

Antetul: obiectivul (titlul paginii), clientul, numărul ofertei, valoarea.
Sub el, rândul **„Urmează”**: o propoziție și butonul albastru al pasului de
acum. Apoi filele, în ordinea fluxului, cu ✓ pe cele terminate; cele la care
nu s-a ajuns sunt gri și spun de ce („după ce acceptă clientul”).

| Fila | Ce e pe ea | De unde vine |
|---|---|---|
| **1. Cerere** | fișierul sau pozele din carnet, apoi verificarea pozițiilor | pașii 1 și 2 din Cerere nouă |
| **2. Ofertă** | datele ofertei, „Cum iese oferta”, „Descarcă oferta”; apoi „Am trimis-o”, „Clientul a acceptat”, „Clientul a refuzat” | pasul 3, fără materiale |
| **3. Materiale** | ce trebuie, ce a venit, „Comandă ce lipsește”, „A venit marfa” | Materiale › De cumpărat, doar pentru lucrarea asta |
| **4. Situații** | „Situație nouă” (de mână sau din poze), istoricul, Excelul fiecăreia | fila Situații + Măsurători |
| **5. Închidere** | inventarul de la final, costul față de ofertă | fila „Închide șantierul” |

Ce se folosește rar stă într-un meniu „⋯” în antet (stilul `.meniu-rand`, deja
făcut): planul de șantier, consumul de mână, „Șterge lucrarea”.

Trei consecințe:

- **„Clientul a acceptat” pornește șantierul.** E „Creează șantierul” de azi,
  cu alt nume și în alt loc. Necesarul se calculează atunci, cu valorile firmei
  (pierderi 10 / 10 / 10 / 0 %, tuburi până la 3 țoli); se schimbă din fila
  Materiale, „Schimbă lista”, unde e deja.
- **Două stări noi pe ofertă: trimisă și refuzată**, cu data. E singura
  schimbare de date din plan (două coloane pe `oferta` sau pe `cerere`).
  Fără ele nu se poate face fila „Oferte trimise” și nici „aștepți de N zile”.
- **„Măsurători” dispare ca ecran.** Pozele intră de unde e nevoie de ele:
  fila Cerere (pentru ofertă, deja așa din 22 octombrie), „Situație din poze”
  pe fila Situații și „Comandă din poze” pe fila Materiale. Șantierul nu mai
  trebuie ales: ești deja pe el.

### Fila Cerere: verificarea

Tabelul pe coloane, ca în Excel, rămâne (decizia din 21 octombrie). Se schimbă
ce e în jur:

- Sus, o propoziție: „97 din 99 de poziții au preț sigur. 2 cer să te uiți.”
  Când nu e nimic marcat: „Toate cele 99 au preț” și butonul albastru „Mergi la
  ofertă”.
- Filtrele devin **file**: De verificat · Toate · Lăsate afară (vezi la
  import). Se deschide „De verificat” când are ceva. „Fără preț” intră în „De
  verificat”: regula „nicio poziție fără preț” rămâne, deci aproape mereu e 0.
- „Verificare / Cum iese oferta” devin tot file; „Cum iese oferta” se mută pe
  fila Ofertă, unde e întrebarea ei.
- „Tip ofertă” se alege la încărcare și apare sus ca text, cu „schimbă”.
- **De hotărât cu machetă:** rândurile „Gata” ca text simplu, care devin casete
  la clic pe rând. Scade TRANSAVIA de la 895 de câmpuri la câteva zeci și pagina
  la o treime. Costă un clic în plus când vrei să schimbi un rând bun. Pe 21
  octombrie Andrei a cerut casete vizibile, de aceea nu o hotărâm fără machetă.

### Fila Ofertă

- Un card „Cui trimitem”: firma, numărul, data, beneficiarul, obiectivul, în
  atenția, localitatea.
- Un card „Prețul”: suma mare, discountul, ajustarea, cu efectul la tastă.
- Dedesubt, „Cum iese oferta” (Excelul de acum, doar citire).
- Un buton albastru: „Descarcă oferta”. După descărcare, rândul „Urmează” devine
  „Ai trimis-o clientului?”, apoi „Ce a răspuns clientul?”.
- „Materiale de comandat” pleacă de aici.

### Fila Materiale a lucrării

Același tabel ca Materiale › De cumpărat: Material · Trebuie · Adus · Stare, cu
„Comandă ce lipsește”. Ce are tot se strânge într-un rând („încă 6 materiale,
toate pe șantier”). Costul față de ofertă stă sub tabel, ca acum. Cele 8
coloane de azi (comandat, venit, pus, rămas, pierdere) se arată doar pe
materialele unde s-a întâmplat ceva.

Meniul „Materiale” rămâne pentru vederea peste toate lucrările și pentru
depozit.

### Fila Situații

- „Situație nouă” arată doar pozițiile care mai au de executat, grupate pe
  capitolele ofertei, cu o casetă de căutare. „Tot restul” rămâne.
- „Situație din poze” lângă ea: aceeași citire și verificare ca azi, fără
  alegerea scopului și a șantierului.

### Acasă

- **„De făcut”**: un rând pe lucru, fiecare cu butonul lui: „Verifică 2
  poziții”, „Termină oferta”, „Întreabă clientul” (ofertă trimisă de 14 zile),
  „Comandă ce lipsește”, „A venit marfa?” (comandă de 7 zile), „Fă situația”.
  Patru dintre ele există deja ca alerte (`src/lucrari/rapoarte.ts`); li se
  schimbă textul și primesc buton.
- Trei cifre: oferte care așteaptă răspuns, lucrări deschise, valoarea lor.
- „Ultimele 7 zile”, „Șantiere închise” și nota despre curs pleacă: primele
  două sunt fila „Închise” din Lucrări.

### Setări

File: Clienți · Liste de prețuri · Calcul rapid · Istoric · Contul meu.

## Importul Excel: modelul și gardurile

Prețurile sunt deterministe și verificate pe ofertele semnate; aici nu e nimic
de reparat. Ce am găsit e în jurul lor, în ordinea riscului:

| # | Ce am găsit | Risc | Propunere |
|---|---|---|---|
| 1 | **Coloanele unui format nou nu se citesc cu modelul în aplicație.** `propuneMapare` e chemat doar din `npm run mapare`, de pe laptop. Un client nou, încărcat din ecran, cade pe euristica veche de cantitate, cea care dădea 0 din 56 cantități corecte pe oferta semnată (`import.md`). | cantități greșite, tăcut, la fiecare client nou | rută `/api/mapare`, chemată la import când antetul nu e cunoscut; `valideazaMapare` decide ca acum; maparea acceptată se ține în bază. Pe ecran, un rând: „Cantitatea e în coloana F, denumirea în C” cu „schimbă” |
| 2 | **Ce a corectat omul rămâne în browserul lui.** Memoria de șabloane (L4) e în `localStorage` (`stocLocal`). | colegul reface aceleași corecturi; se pierd la schimbarea calculatorului | tabel pe firmă în bază, cu aceeași interfață (`StocSabloane`) |
| 3 | **Rândurile lăsate afară nu se văd.** Un rând cu UM și cantitate care n-a fost recunoscut ca izolație dispare din ofertă (așa dispărea torcretul de la spital). | lucrări neofertate, fără urmă | fila „Lăsate afară · N” la verificare: rândurile cu UM și cantitate care nu sunt poziții, cu „E izolație” pe fiecare |
| 4 | **Încrederea e cea pe care și-o dă modelul**, cu prag 0,85. Pe TRANSAVIA a oscilat pe prag de la o rulare la alta. | „De verificat” fără motiv sau „Gata” fără temei | pe rândurile citite de model, două citiri; dacă diferă la un câmp care intră în preț, rândul merge la om. Pragul rămâne doar ca plasă |
| 5 | **Modelul e `gpt-4.1-2025-04-14`**, ales în septembrie pe 2 fișiere. Există 3 fișiere golden. | nu știm dacă un model mai nou citește mai bine | `npm run compara` pe toate cele 10 fișiere, cu ofertele semnate ca răspuns corect unde există; se schimbă modelul doar cu zero diferențe care mișcă prețul. Regula „temperature 0” exclude azi familia gpt-5; cu punctul 4 (două citiri) ea n-ar mai fi singura apărare, deci se poate reevalua |
| 6 | **Două diametre scrise pe același rând** (DN80 și Ø89) și modelul îl alege pe cel greșit: niciun gard nu prinde (`import.md`, „Ce nu prinde”). | alt rând din listă, alt preț | gard nou: două diametre notate, care nu sunt același DN în tabelul de conversie, pe o linie citită de model → la om |
| 7 | **Un lot căzut la model** cere „Încarcă fișierul din nou”. | omul reface tot importul | „Încearcă din nou” doar pe rândurile necitite |
| 8 | **Același fișier încărcat a doua oară** face o cerere nouă. | două cereri, același număr de ofertă (bugul din 16 octombrie) | la încărcare: „Fișierul ăsta e deja la lucrarea TRANSAVIA. Deschide-o / Încarcă-l ca lucrare nouă” |
| 9 | **Motivul de la „De verificat”** e scurt și fără acțiune. | omul nu știe ce să facă cu rândul | o propoziție cu ce s-a presupus și butonul care o rezolvă („Am pus 50 mm, ca la țeava de același diametru. E bine / Schimb”) |

**Cel mai mare câștig nu e la model.** Din 623 de poziții pe cele 10 fișiere,
116 ies „De verificat”; 97 dintre ele țin de trei întrebări deja scrise pentru
firmă (`docs/intrebari-firma-2.md`, 10–12): protecția la foc (40), țeava cu
izolația inclusă (34), peste ultimul rând din listă (23). Trei răspunsuri scot
mai multe verificări decât orice schimbare de model.

## Ce nu se schimbă

- Motorul de prețuri, regulile, exportul ofertei, situațiile, stocul.
- Testele pe ofertele semnate (`oferte-semnate.test.ts`,
  `document-oferta.test.ts`) trec neatinse după fiecare fază.
- Tabelul de verificare pe coloane, editarea la tastă, filele de la Materiale.
- Nicio funcție nu dispare; se mută.

## Fazele

Fiecare fază e o ramură, verificată în browser (390–1920 px, ambele teme, pe
`npm run dev` și pe build-ul de server), arătată, apoi pe `main`.

| Faza | Ce | Mărime |
|---|---|---|
| **0. Urgent** | planul bazei pe Render; `npm run demo` reparat | o jumătate de zi |
| **1. Fără mutări** | Acasă: butoane pe alerte, tabelele de raport scoase. Verificarea: propoziția de sus, se deschide pe „De verificat”, filtrele și „Ce vezi” ca file. Pagina șantierului: titlul = numele lucrării, „Închide” și „Șterge” în „⋯”, coloanele goale ascunse. Meniul fără „Module care urmează” | 2–3 zile |
| **2. Lucrarea** | pagina lucrării cu cele cinci file și rândul „Urmează”; lista Lucrări pe stadii; stările „trimisă” și „refuzată”; meniul pe 4; alias-urile | 5–7 zile, cea mai mare |
| **3. Cerere și Ofertă** | oferta pe două carduri, necesarul mutat la acceptare, „Cum iese oferta” pe fila Ofertă; macheta pentru rândurile „Gata” | 3–4 zile |
| **4. Șantierul în lucrare** | Situație nouă scurtă, „Situație din poze” și „Comandă din poze” în file, Materiale pe patru coloane; ecranul Măsurători scos | 3–4 zile |
| **5. Acasă** | „De făcut” complet, cu pașii noi (ofertă neterminată, răspuns întârziat, situație veche) | 1–2 zile |
| **6. Importul** | punctele 1, 2, 3 și 8 din tabel întâi; apoi 4–7 și 9 | 4–6 zile, se poate face în paralel cu 3–5 |
| **7. Proba** | un om care n-a văzut aplicația duce TRANSAVIA de la fișier la prima situație, fără să întrebe; notăm unde se oprește | o zi |

Faza 1 se vede imediat și nu strică nimic. Faza 2 e cea care schimbă cum se
simte aplicația; restul se sprijină pe ea.

## Riscuri

- **Importul e un fișier de 1.636 de linii** (`web/ecrane/import.ts`) care își
  ține singur starea și pașii. Mutarea lui în filele lucrării e partea grea a
  Fazei 2; întâi se montează ca atare în fila Cerere, apoi se desface.
- **„Creează șantierul” mutat** schimbă drumul pe care stau testele de șantier
  și `scripts/demo.ts`. Se actualizează împreună, în Faza 3.
- **Stările noi ale ofertei** cer o migrare (0018) și o valoare pentru ofertele
  de dinainte: cele cu șantier sunt „acceptate”, restul „trimise”.
- **Rândurile „Gata” ca text** contrazic o cerere mai veche a lui Andrei; nu se
  fac fără machetă văzută.

## De hotărât

Pentru fiecare: da / nu / altfel.

1. Lucrarea ca pagină unică, cu filele Cerere · Ofertă · Materiale · Situații ·
   Închidere.
2. Meniul pe 4: Acasă · Lucrări · Materiale · Setări.
3. Stările „trimisă” și „refuzată” pe ofertă; „Clientul a acceptat” pornește
   șantierul.
4. „Materiale de comandat” scos din pasul Oferta.
5. „Măsurători” scos din meniu; pozele intră din filele lucrării.
6. Rândurile „Gata” ca text până la clic (cu machetă întâi).
7. La import: citirea coloanelor cu modelul din aplicație, corecturile în bază,
   fila „Lăsate afară”.
8. Ordinea fazelor.

## Unde am rămas (14 noiembrie 2026)

Pentru cine continuă pe alt calculator, într-o sesiune nouă. Ramura `ux-lucrare`,
nepublicată (fără push). Faza 2 e **scrisă, trece testele și a fost parcursă în
browser** pe varianta fără server; din Faza 3 sunt făcute fila Ofertă pe două
carduri, „Tip ofertă” cu „schimbă” și un singur „Mergi la ofertă”.

### Ce s-a schimbat după primul rând de mai jos

- **Faza 2, parcursă în browser** pe varianta fără server (`npx vite --port
  5183`, datele în browser): de la Cerere nouă până la situație, la 390 și 1440
  px, ambele teme, cu adresele vechi și reîncărcarea pe fiecare filă, fără
  erori. **Pe server cu baza (`izorep_ux`) rămâne de parcurs**, de un coleg cu
  Docker (comenzile la „Cum verifici pe alt calculator”).
- Reparate după parcurgere: rândul de sub „← Toate lucrările” nu mai repetă
  titlul (doar clientul dacă diferă, oferta, valoarea, „refuzată”); linia de
  sub file nu mai pare ruptă după „Închidere” (filele inactive aveau `opacity`,
  care stingea și linia); `deschideLaIntrare` / `iaDeDeschis` scoase.
- Testul de server pentru `antet` / `deVerificat` în `/api/cereri` e scris
  (`tests/server.test.ts`); se sare fără Postgres.
- Cod mort după ecranele plecate, scos: „Importuri recente” din `ecranStart`,
  „Ce vezi” din `baraVerificare`, `LANT` / `LANT_VALOARE` / `CURS_BNR` din
  `seed.ts`. Linkul „Șantiere” de pe Materiale duce la „Lucrări › Închise”.
- **Faza 3, făcut**: fila Ofertă pe două carduri, „Cui trimitem” și „Prețul”,
  cu „Cum iese oferta” dedesubt și un singur albastru („Descarcă oferta” cât
  nu e ofertă, apoi alb, iar albastrul e „Clientul a acceptat”); „Tip ofertă”
  pe fila Cerere ca text cu „schimbă”; „Mergi la ofertă” doar în „Urmează”.
  **Nefăcut din Faza 3**: rândurile „Gata” ca text (cer machetă), iar
  `scripts/demo.ts` își păstrează funcția lui de șantier (`santierDin` e în
  ecran și face id-uri noi; demo-ul vrea `S-TRANSAVIA`). Demo-ul compilează pe
  API-urile de acum; nerulat (cere Postgres).

### Făcut (commit-uri)

| Commit | Ce |
|---|---|
| `3fe4c69` | Meniul pe patru, fără grupuri: Acasă · Lucrări · Materiale · Setări (`web/nav.ts`, `MENIU` și `SETARI`). Setările sunt ecranele de dinainte (Clienți, Liste de prețuri, Calcul rapid, Istoric, Contul meu), fiecare cu adresa lui, sub o bară de file comună desenată de `main.ts` (`fileSetari`), cu „Setări” aprins în meniu (`IN_MENIU`). Adresele vechi: `ALIAS` (`cereri`, `oferte`, `documente`, `santiere` → `lucrari`; `setari` → `clienti`) și `MUTATE` (`#/import[/poze]` → `#/lucrari/noua[/poze]`). În același commit a ieșit `web/ecrane/documente.ts` (Oferte și cereri). |
| `ba1d742` | `web/lucrare.ts`, pur, cu teste (`tests/lucrare.test.ts`, 7): legarea cerere + ofertă + șantier (`lucrariDin`, `gasesteLucrarea`, și după id-ul șantierului), stadiul, rândul „Urmează” (`urmeaza`) și starea filelor (`stareFile`). Lista cererilor de pe server (`listaCereri` în `src/server/repo.ts`) întoarce acum și `antet` și `deVerificat` din `lucru` (jsonb), fără migrare. |
| `3e82999` | `web/ecrane/lucrari.ts` rescris: lista pe stadii (De ofertat · Oferte trimise · În lucru · Închise, cu cifra; `#/lucrari?stadiu=…`; „Cerere nouă” albastru sus) și pagina lucrării (`#/lucrari/<id>/<fila>`; antet, „⋯” cu Planul de șantier și Șterge lucrarea, rândul „Urmează”, cinci file-butoane cu ✓ și file inactive cu motivul). `web/ecrane/import.ts` nu mai e ecran: `montezaImport(gazda, opt)` întoarce un control (`arata`, `salveazaAcum`, `refuz`, `santier`); fără pașii 1·2·3, fără „Importuri recente”, fără „Materiale de comandat” și „Creează șantierul” pe Ofertă; „Cum iese oferta” stă sub datele ofertei și se reface la tastă. `web/ecrane/santier-panou.ts` (nou): Materiale, Situații, Închidere și planul, mutate din pagina șantierului, plus „Schimbă regulile de calcul” (cardul vechi, `cardNecesar`, cu „Refă lista”), „Comandă din poze”, „Situație din poze”. Pozele (`#/masuratori/<santier>/<situatie|comanda>`) fără alegerea scopului și a șantierului, cu titlul și „← Înapoi la lucrare”. Acasă: butoanele duc pe pagina lucrării, pe fila potrivită. Linia filelor pe două rânduri, reparată în `.file` / `.fila` (`style.css`). |

Verificat: `npm run typecheck` curat, `npm test` **705 teste** trec (698 + 7 noi),
`npm run build:server` trece. **Nimic verificat în browser.**

### Pe jumătate / nefăcut

- ~~**Parcurgerea în browser, de la cap la coadă, nefăcută.**~~ Făcută pe
  varianta fără server (mai sus); pe server, nu. De făcut întâi:
  Lucrări (file, cifre) → Cerere nouă → TRANSAVIA a doua oară → fila Cerere →
  Mergi la ofertă → număr și obiectiv → Descarcă oferta (94.575,06 €; cu 3 %:
  91.737,81 €) → A refuzat → A acceptat până la urmă → Da, pornește șantierul →
  Materiale → Schimbă regulile → Situații → Închidere; Matari, NISAL; adresele
  vechi; reîncărcarea pe fiecare filă; 390 și 1440 px, ambele teme. Locuri de
  suspectat: trecerea de la `#/lucrari/noua` la pagina lucrării după fișier
  (`cerereNoua` în `lucrari.ts`, depinde de salvarea cererii înainte), plierea
  barei (`ceriSpatiu`) la schimbarea filelor, focusul după „Urmează”.
- ~~Un test de server pentru `antet` / `deVerificat` în `/api/cereri` nu e scris.~~ Scris.
- ~~`.claude/stare.md` și `.claude/ui.md` nu sunt actualizate pentru Faza 2.~~ Actualizate.
- Pe linkul demo (fără server) au plecat „Documentele firmei” și „Lucrările din
  datele firmei” (exemplele): nu mai au ecran, și rămâne așa.
- ~~`deschideLaIntrare` / `iaDeDeschis` din `web/date.ts` au rămas nefolosite.~~ Scoase.

### Decizii luate (de păstrat)

- **Fără starea „trimisă”**: o ofertă salvată fără șantier și fără refuz e
  „Oferte trimise”.
- **Refuzul fără migrare**: ziua refuzului e `antet.refuzat` (ISO) în lucrul
  cererii (`SesiuneImport.antet`, deja salvat cu versiune); lista o citește din
  `lucru->'antet'`. „A acceptat până la urmă” îl scoate; un refuz oprește
  pornirea șantierului (`santierDin` în `import.ts`).
- **„Clientul a acceptat” = „Creează șantierul” de dinainte**: întreabă pe loc
  „Pornești șantierul …?”, apoi plan + listă pe depozitul șantierului, cu
  regulile firmei (`REGULI_FIRMEI`: pierderi implicite, tuburi până la 3 țoli),
  și duce pe fila Materiale. Fără obiectiv: mesaj și fila Ofertă. Codul e o
  singură funcție, `santierDin`, folosită și de „Refă lista” (care păstrează
  editările omului, `pastreazaEditari`). `scripts/demo.ts` nu e atins.
- **„Urmează”, în ordine**: 1 poziții de verificat → Verifică; 2 fără ofertă →
  Mergi la ofertă; 3 ofertă fără răspuns → Clientul a acceptat / A refuzat;
  4 refuzată → A acceptat până la urmă; 5 de comandat → Comandă ce lipsește;
  6 totul executat → Închide șantierul; 7 în lucru → Situație nouă; 8 închisă,
  fără buton. Abatere luată de noi: cu șantier pornit, pasul 1 nu mai apare
  (refuzul vine înaintea lui 1). Butonul care doar ar duce pe fila deschisă
  deja nu se desenează.
- **Măsurători iese din meniu**; ruta rămâne, iar pozele intră din filele
  lucrării cu șantierul și scopul deja alese.

### Cum verifici pe alt calculator

Baza de probă `izorep_ux` nu e în repo; se face din nou:

```bash
docker exec izorep-db createdb -U <proprietar> izorep_ux   # sau din psql: create database izorep_ux;
IZOREP_DB=izorep_ux npm run db:migrate
IZOREP_DB=izorep_ux npm run db:seed
IZOREP_DB=izorep_ux npm run demo          # TRANSAVIA deschis, NISAL închis, Matari fără șantier
IZOREP_DB=izorep_ux npm run om -- <email> "<nume>" --parola-stdin   # contul de intrare
npm run build:server
IZOREP_DB=izorep_ux PORT=8813 OPENAI_API_KEY= npx tsx src/server/porneste.ts
```

Comenzile cer `< /dev/null` când rulează fără terminal. Nu folosi baza
implicită `izorep` și nici porturile 8787 / 5173.
