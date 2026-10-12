# Planul de implementare, după întâlnirea cu firma

> Pentru noi (Andrei, Adrian). Pornește de la răspunsurile din
> `docs/intrebari-firma.md` (commit „raspunsuri depozit”, 7 octombrie 2026) și de
> la exemplele din `attachments/`. **Nu mai întrebăm nimic:** ce a rămas fără
> răspuns se hotărăște aici, din date, cu dovada scrisă lângă. Când vin hârtiile
> promise (comanda, avizul, factura, listele furnizorilor), devin teste. Nu
> blochează nimic.
>
> Starea: fazele 1–4 sunt făcute (Faza 4 pe 11 octombrie 2026, 540 de teste).
> Exportul ofertei într-un singur fel e făcut (11 octombrie 2026, pașii 0–1
> din `docs/plan-import.md`); ecranul de import rămâne cum era. Faza 5 făcută
> pe 11 octombrie 2026. Următorul: Faza 6. Pe 5
> octombrie au venit evidența de achiziții, o comandă cu aviz și factură și lista
> K-Flex: deciziile de mai jos marcate „11 oct.” sunt luate din ele.

## Deciziile luate fără firmă

| Ce lipsea | Decizia | De unde |
|---|---|---|
| „7. la 0,8” (fără întrebare lângă) | **Tabla de aluminiu fără grosime scrisă = 0,8 mm.** Perechea răspunsului „inox → 0,4” | Lista rezidențială are 0,8 pe 39 din 63 de rânduri și e singura grosime cu preț pe m² |
| Cât tub ia un cot sub 3 țoli | 3 piese pe metru, ca la cel mai mic interval spus de ei (114–140). Pe ecran apare „regulă presupusă” | Șirul lor 3 · 2 · 1 scade cu diametrul. Sub 3 țoli nu pot ieși mai puține piese decât la ø114 |
| Peste ø273, câte piese pe metru | 1, ca la 219–273, marcat „presupus” | Nu se poate coborî sub o piesă pe metru fără o regulă nouă |
| Flanșă, robinet, casetă, reducție la comandă | Aceeași regulă ca la cot și teu (piese pe metru). Tabelul de echivalență **nu** se folosește la comandă | Răspunsul 5 de la final: „echivalența doar în oferta pentru client, la comandă cum s-a discutat la telefon” |
| Rezerva (S21) față de „10%” | Rezerva peste calcul = 0. Pierdere la croit 10% doar la tablă și la plăci. 10% pe total = pragul de pierdere normală pe șantier | S15 și S16 au 10% pe material. La telefon: „să nu rămână marfă”. S42 și răspunsul „6. 10% per total general” |
| Mărunte (S18, răspuns tăiat) | Cost general, nu intră în stoc | „comandăm la cutie, cât se consumă se consumă” |
| Goluri la foc (S19), distribuitor (S20) | Linie de material adăugată de mână pe necesar, cu cantitatea pusă de om | S20: „în funcție de dimensiune”. Azi ies la „fără necesar” |
| Verifică cineva stocul înainte de comandă (S24) | Aplicația arată resturile din depozit și de pe alte șantiere ca propunere de transfer. Omul decide | S10: materialul e al firmei și se redistribuie. S1: problema e marfa rămasă |
| Costul materialului pe șantier (S44) | Prețul intrărilor făcute pentru șantier. Pentru ce vine din depozit sau de pe alt șantier: prețul mediu | S5: se comandă pe șantier, uneori și din stocul general |
| Curs: „BNR + 1–2 %” | **11 oct.:** euro = lei / cursul de pe document, fără marjă | Evidența firmei: PRET EURO = PRET RON / CURS pe 3.191 din 3.191 de rânduri (2025–2026); marja e deja în cursul facturii (ISOLINE: 5,31) |
| PVC pe industrial | Rămâne pe lista rezidențială, „De verificat”. Nota spune că la tablă industrialul e cu ~10% mai mare | Din listele lor nu reiese un raport sigur (elastomer +20/25%, vată +25%, tablă +10%) |
| ROB, „preț dublu”, „× 2” | Rămân citite cum sunt azi (casetă de robinet, de două ori prețul, grupul de două ori) | Se verifică singure când vine oferta Ecoterm |
| Diferența de 0,13 € la SPIRO ø250 / ø315 | Încercăm întâi ipoteza „grosime + 1 mm” (dă 16,35 / 20,29 față de 16,36 / 20,30 semnat). Dacă nicio regulă nu iese la ±0,01, formula lor rămâne, iar SPIRO peste listă rămâne „De verificat” | Oferta 27.04.2026. Firma: la SPIRO diametrul e exterior |
| Tabla în kg (S13) | kg/m² = densitate × grosime: aluminiu 2,70, inox 7,93 (0,8 mm Al = 2,16 kg/m²) | Fizică, nu de întrebat |
| Ambalajele (S13, S14) | **11 oct.:** tub elastomer 2 m, cochilie 1 m, placă elastomer 2 m², saltea pe rolă după grosime; tabla fără (kg). Ambalajul scris de om bate | Cantitățile cumpărate în evidență: 96 % / 100 % / 97 % multipli; rola e în denumire (LM ECO ALU M 50X1000X5000) |
| Formele vatei (S12) | **11 oct.:** tub (cochilie), saltea lamelară (vata peste prag), placă (elastomer; vata doar la foc), tablă. Prag implicit 3 țoli; peste, tub pe diametrul ales | Evidența 2024–2026: saltelele LM ECO, 36.851 m²; 93 % din cochilii ≤ ø89; TRANSAVIA cumpărată în cochilii până la ø168 |
| Atelierul (S36) | Tabla rămâne în m² și când e croită. Piesele nu se urmăresc ca articole separate | Aplicație mică. Ce contează e unde stă tabla și pentru ce șantier |

## Faza 1. Prețurile: nicio poziție fără preț — făcută, 8 octombrie 2026

Cerut de Andrei după întâlnire: avem toate listele (5 rezidențiale, 4
industriale), deci nicio poziție dintr-o cerere nu rămâne fără preț, în afară
de rafinărie. Ce se calculează pe o singură dovadă iese cu preț, dar „De
verificat”.

Rezultat, pe cele 10 fișiere de client: **115 / 129 poziții fără preț
(rezidențial / industrial) → 0 / 0**, și 0 pe calea cu model. Cererea
TRANSAVIA dă Oferta 284 la ban, cu tot cu distribuitorul. Regulile, cu dovada
fiecăreia, sunt în `.claude/stare.md` (8 octombrie 2026) și
`.claude/pricing.md`. Testul care ține promisiunea: `tests/fara-pret.test.ts`.

Două decizii din tabelul de sus s-au schimbat pe drum:

- **Protecția la foc a tubulaturii** nu mai e cu preț pus de mână: iese la 48 €/m²
  (singurul preț semnat, EI60), mereu „De verificat”.
- **Echipamentele** au preț din suprafață: suprafața × prețul pe mp × 2,47
  (factorul dat de distribuitorul din Oferta 284).

Pe 9 octombrie: „Măsurători → Pentru ofertă” compară rândurile din poze cu
lista clientului (întrebarea tehnică 1). SPIRO peste listă rămâne „De
verificat”: nicio regulă nu dă și SPIRO ø250 / ø315, și DN250 exact.

## Faza 2. Lista de materiale corectă — făcută, 9 octombrie 2026

Toate cele opt puncte de mai jos sunt în cod, cu teste (`tests/necesar.test.ts`,
`tests/stoc.test.ts`), și verificate în browser. Detaliile în `.claude/stare.md`
(9 octombrie 2026). Necesarul TRANSAVIA nu mai are rânduri „de stabilit”;
testul cu comanda reală a firmei se scrie când vine comanda.

Doar logică în `src/stoc/`, fără bază de date. Se testează pe TRANSAVIA.

1. **Articolul** devine `sistem | formă | grosime | ø | marcă`. Formele sunt
   tub sau cochilie, saltea, placă și coală. Forma se propune după pragul de
   3 țoli, dar se poate schimba pe linie (S12: se comandă și cochilii peste
   3 țoli). Marca se alege la comandă, nu în ofertă (S11). Trebuie hotărât
   **înainte** de Faza 3, ca să nu migrăm stocul.
2. **Necesarul ținut pe poziția din ofertă**, nu doar adunat pe material. Fără
   asta nu se poate calcula consumul din situații (Faza 6).
3. **Pierderile pe material:** tablă și plăci 10%, tuburi 0. Se pot schimba
   din Setări.
4. **Piesele în metri:** regula „piese pe metru” acoperă toate piesele, sub și
   peste 3 țoli. „+ N buc., de stabilit” dispare din Depozit.
5. **Tabla în kg**, lângă m², pentru comandă.
6. **Ambalajul:** unitate de cumpărare pe articol (cutie, sac, pachet, kg) și
   rotunjire în sus. Diferența apare ca „rest așteptat în depozit”.
7. **Linii adăugate de mână** pe necesar: goluri la foc, distribuitor, Conlit
   sau Techrock la protecția la foc.
8. **Materialul clientului** (S38): linie marcată „al clientului”, cu valoare 0.
   Nu intră nici în „De comandat”, nici în cost.

**Gata când:** necesarul TRANSAVIA nu mai are rânduri „de stabilit”. Când vine
comanda lor reală, devine test material cu material, iar fiecare diferență are
o cauză scrisă.

## Faza 3. Datele comune — făcută, 9 octombrie 2026

Pe ramura `faza-3`, peste `faza-1-2`. Detaliile în `.claude/stare.md`
(9 octombrie 2026, Faza 3) și `.claude/backend.md`. Pe scurt:

- **Serverul** (`src/server/`, Hono): fiecare cerere în `caTenant`. Intrarea cu
  link pe email s-a făcut, apoi s-a scos pe 10 octombrie (Andrei: încă nu e
  nevoie de conturi); serverul ascultă doar local până revin.
- **În bază** (migrările 0005, 0006): cererile cu fișierul clientului, ofertele
  pe versiuni (nu se modifică și nu se șterg), șantierele (planul se îngheață la
  prima situație), anexele, situațiile (se șterge doar ultima), măsurătorile cu
  poze, depozitele cu firma, articolele, ambalajele, necesarurile, mișcările
  (doar storno) și cei 13 furnizori.
- **Oferta se salvează la „Descarcă oferta”**, înainte de descărcare, ca
  versiune nouă; valoarea o socotește serverul din liniile salvate.
- **Linkul de pe Pages rămâne demo**, cu datele în browser (`web/date.ts` alege
  singur unde stau datele).
- **„Mută datele pe server”** apare o dată, cât browserul mai are date din
  prototip; apăsat de două ori nu dublează nimic.

**Gata când:** verificat cu Playwright, două browsere separate: TRANSAVIA
salvată pe primul se deschide pe al doilea la 94.575,06 €, iar intrarea de stoc
scrisă pe al doilea se vede pe primul. Test pe Postgres: `tests/server.test.ts`.

Pe drum: confirmarea din ecran scotea prețul distribuitorului (linia omului se
tarifa fără textul rândului), deci TRANSAVIA confirmată ieșea 92.278,36 €.
Reparat în `tarifeazaExtras` (`textLucrare`), cu test.

Ce a cerut faza inițial:

Firma are 12–14 șantiere deodată, iar la stoc lucrează mai mulți oameni de la
tehnic și de la contabilitate (S47). Datele nu mai pot sta în browser.

1. Un server mic peste baza care există deja (`src/db/`, cu RLS). Fiecare om
   intră cu un link primit pe email. Rolurile rămân cele două provizorii, cu
   acces la tot.
2. În bază trec ofertele (fără modificări după salvare, cu versiuni),
   șantierele (planul înghețat, plus anexe pentru lucrările suplimentare),
   situațiile, măsurătorile cu pozele și stocul: articole, depozite (cu firma,
   S46), mișcări (fără modificare sau ștergere, doar storno) și furnizori.
3. Un buton care mută, o singură dată, ce e deja în browser.
4. Până la sfârșitul fazei rulează local, în Docker. Unde stă în producție se
   hotărăște atunci.

**Gata când:** TRANSAVIA salvată pe un calculator se deschide pe altul la
94.575,06 €, iar o intrare în stoc scrisă pe unul se vede pe celălalt.

## Faza 4. Comanda și recepția — făcută, 11 octombrie 2026

Toate cele nouă puncte, detaliile în `.claude/stare.md` (11 octombrie 2026,
ambele secțiuni). Prețul pe ciornă vine din lista K-Flex și din ultima factură
din evidență; cursul e cel de pe document (decizia din 11 octombrie, nu „BNR +
marjă”). Avizul se citește din poză sau PDF cu modelul și rămâne atașat.
Comanda din măsurători scade ce e acum pe șantier, nu tot ce s-a adus.

Ce a cerut faza:

Aici e problema lor principală (S1): rămâne marfă când se comandă totul dintr-o
dată.

1. **Furnizorii:** cei 13 din S25, cu ce vinde fiecare. Pe fiecare categorie de
   material e propus un furnizor.
2. **Comanda pe șantier** (S5), pe etape (S23). Se face din necesar sau din
   **măsurătorile de pe teren** (S2: comanda se dă după măsurători). Pozele din
   carnet se potrivesc pe planul șantierului (`src/lucrari/potrivire.ts`) și dau
   materialele etapei. Comanda arată mereu cât a mai rămas de comandat.
   Comandă pentru stocul general se face doar spre depozitul central.
3. **Înainte de trimitere:** resturile din depozit și de pe alte șantiere apar
   ca propunere de transfer.
4. **Stările comenzii:** ciornă, trimisă, primită parțial, primită. Fără pas de
   aprobare: comandă directorul sau șeful de șantier (S22).
5. **Comanda se trimite** ca Excel, plus un text gata de pus în email (S27).
6. **Comanda suplimentară** e legată de șantier și are un motiv (S28).
7. **Prețul:** din lista furnizorului dacă există, altfel se scrie pe comandă.
   Prețul în lei se trece în euro cu cursul BNR + marja din Setări (S26).
   Transportul e un rând separat, împărțit pe valoare.
8. **Recepția:** biroul trece avizul primit de la furnizor și atașează poza sau
   PDF-ul lui (S31). Recepția merge pe liniile comenzii: comandat, primit, rămas
   de primit. Marfa poate ajunge în depozit sau direct pe șantier (S6). Avizul
   fără șantier pe el primește un șantier ales de birou. Când rămâne timp,
   avizul se citește cu modelul, pe același drum ca pozele din carnet.
9. **Returul la furnizor** e o mișcare simplă (S32: se întâmplă rar).

**Gata când:** pe un șantier se văd comandat, primit și rămas de primit, iar
„De comandat” scade singur resturile.

## Faza 5. Depozitele, atelierul, transferurile — făcută, 11 octombrie 2026

Detaliile în `.claude/stare.md`. Pe scurt: locurile cu firma și responsabilul,
atelierul ca transfer „pentru șantier” (tabla pusă deoparte, apoi trimisă),
transferul între firme marcat, drumul materialului de la furnizor la șantier.

Ce a cerut faza:

1. **Locurile:** depozitul central, atelierul din București și câte un depozit
   pe fiecare șantier, cu un responsabil (șeful de șantier desemnat, S34).
2. **Atelierul** (S36 și răspunsul 4 de la final): șeful de șantier cere la
   atelier, de exemplu 10 ml ø100, 3 coturi și 10 carcase. Biroul trece tabla
   din central în atelier. Tabla croită e pusă deoparte pentru acel șantier și
   apare separat, apoi pleacă pe șantier.
3. **Transferul de pe un șantier pe altul** se face din ecran (S37), notat de
   birou.
4. **Mutarea între cele două firme** e un transfer marcat, vizibil (S46: „se
   mai amestecă”).

**Gata când:** pentru o bucată de tablă se vede drumul complet: furnizor,
central, atelier, șantier.

## Faza 6. Consumul

1. **Consumul se calculează din situația de lucrări** (S7, răspunsul principal):
   executat × materialul poziției, scris automat ca mișcare „consum” la
   salvarea situației. Ritmul e al situațiilor: lunar sau mai des (S41).
2. **Consumul notat de mână** rămâne disponibil (S7 b).
3. **Pierderea normală e 10% pe total** (S42). Consumul real se compară cu cel
   calculat: plecat spre șantier, minus returul, minus ce a rămas. Peste prag,
   șantierul apare la „Necesită atenția ta”.

**Gata când:** pe TRANSAVIA, o situație cu tot executat duce materialul
șantierului la „rămas” = cât s-a trimis peste necesar.

## Faza 7. Închiderea șantierului și ce vede directorul — făcută, 11 octombrie 2026

Detaliile în `.claude/stare.md`. Pe scurt: pe pagina șantierului, cardul
„Materialul șantierului” (necesar, comandat, venit, pus, rămas, lipsește, costul
până acum) și „Închide șantierul”: șeful de lucrare numără, diferența devine
ajustare „inventar la închidere”, fiecare rest pleacă în depozit, pe alt
șantier, la furnizor sau se scrie pierdut / furat / reciclat. Se închide doar cu
stocul la zero; închis, nu mai primește situații sau mișcări (trigger, migrarea
0012). Costul: (venit − plecat înapoi) × costul pe unitate pe șantier, după
regula S44 din tabelul de sus, față de „În ofertă”. Tabloul: ultimele 7 zile,
șantierele închise, alertele (lipsa pe șantier, comenzile nevenite de 7 zile;
pierderea peste 10 % se leagă de Faza 6). Testul „gata când” e pe TRANSAVIA
(`tests/inchidere.test.ts`).

Ce a cerut faza:

1. **Închiderea** pornește de la inventarul pe șantier, făcut de șeful de lucrare
   (S45). Fiecare rest primește o destinație: înapoi în depozit, alt șantier,
   furnizorul, sau pierdut / furat / reciclat (S4, S8, S43). Șantierul se
   închide doar cu stocul la zero.
2. **Costul materialului față de ofertă**, după regula din tabelul de sus.
3. **Ecranul șantierului** (S9): comandat, venit, pus, rămas, cost față de
   ofertă și ce lipsește ca să se termine lucrarea.
4. **Tabloul și rapoartele** (S49: „toate”):
   - lista săptămânală;
   - alertele: lipsă pe șantier, pierdere peste 10%, comenzi nerecepționate;
   - cifrele la închiderea șantierului.

   Pe email (de pus la loc odată cu conturile).

**Gata când:** un șantier închis are stoc zero și un singur număr pentru costul
materialului față de ofertă.

## Faza 8. Pornirea

1. **Pornim doar cu șantierele noi** (S48). Șantierele în curs nu intră.
2. **Depozitul central:** stocul de pornire se poate trece ca intrare marcată.
   Inventarul complet nu e condiție de pornire.
3. **Ecranul de inventar pe depozit** scrie ajustări, cu motiv (S45).
4. **Exportul în Excel** al evidenței de material pe șantier, cât timp mai țin
   și Excelul lor separat.

## Ce nu intră acum

Saga și facturarea (amânate, nu s-au discutat), documentele de gestiune (NIR,
bon de consum, aviz emis din aplicație), sculele și schelele (S39: intră în
manoperă), rafinăria, rolurile noi, aplicația pe telefon.

## Ce facem cu hârtiile când vin

| Hârtia | Devine |
|---|---|
| Comanda, avizul, factura și certificatul pe aceeași lucrare | **Venit 5 oct. (TRANSAVIA, cochilii ø140):** testul lanțului comandă → aviz → factură, la ban (`tests/comenzi.test.ts`). Necesarul față de cumpărat e în `stare.md`: peste 3 țoli se potrivește, sub 3 țoli nu se poate dovedi |
| Listele furnizorilor (Banda Tech, Isoline) | **K-Flex ST de la Banda Tech, venită 5 oct.:** încărcată ca prețuri pe ciornă (`data/preturi-furnizori.json`), alături de ultima factură din evidență pe furnizor și articol. Lista Isoline lipsește: la cochilii prețul vine din facturi |
| Excelul lor de evidență | **Venit 5 oct.:** formele, ambalajele, cursul și furnizorul propus (mai sus); „Descarcă evidența” scrie intrările cu coloanele lui |
| Oferta Ecoterm, alte poze din carnet | Testul pentru ROB, „preț dublu” și „× 2” |
| O situație de lucrări a lor | Formatul din `web/situatie.ts` |
