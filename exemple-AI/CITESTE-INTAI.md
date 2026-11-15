# Exemple de probă pentru aplicație (date inventate)

Două lucrări duse de la cap la coadă: cerere de ofertă → ofertă → comandă de
material → aviz → factură → situații de lucrări. Sunt făcute după hârtiile
firmei (cererea și Oferta 284 TRANSAVIA, Oferta 118 NISAL, Oferta 118.1 Matari,
avizul și factura ISOLINE, comanda pe email), dar **clienții, obiectivele,
cantitățile și furnizorul sunt inventate**. Prețurile de vânzare sunt cele din
listele firmei, calculate cu motorul aplicației. Avizele și facturile au jos
„EXEMPLU PENTRU TESTAREA APLICAȚIEI” și un furnizor fictiv.

În cereri lipsesc **intenționat** cuvinte (materialul, grosimea, „Di”, UM-ul),
sunt greșeli de tastare și prescurtări. Scopul: să vedem ce completează
aplicația singură, ce trimite la om și ce greșește fără să spună.

## Ce e în fiecare folder

| Fișier | Ce e | Unde se încarcă în aplicație |
|---|---|---|
| `1-cerere-de-oferta-….xlsx` | cererea clientului, cu lipsuri | Lucrări → Cerere nouă |
| `2-oferta-….xlsx` | oferta corectă, în formatul firmei: cu ea compari ce iese din aplicație | (doar de comparat) |
| `3-…comanda-materiale….eml` | comanda către furnizor, ca emailul firmei | (de comparat cu „Trimite comanda”) |
| `…aviz-….pdf` | avizul furnizorului | Materiale → Comenzi → „A venit marfa” |
| `…factura-….pdf` | factura pentru același aviz, în lei, cu curs | „A venit factura” |
| `…situatie-de-lucrari-1 / 2.xlsx` | două situații, în formatul aplicației | (de comparat cu fila Situații) |
| `cheie-de-verificare.xlsx` | pe fiecare rând din cerere: ce lipsește, ce trebuie să iasă, ce a ieșit fără AI și cu AI | (pentru noi) |

`_generator/` ține scripturile din care s-au făcut fișierele (se pot reface).
Folderul există în două locuri, identic: `attachments/exemple-AI` și, comis, în
proiect, la `izorep/exemple-AI` (de acolo îl pot folosi testele).

## Exemplul 1: abur, ofertă industrială (`exemplu-1-abur-industrial`)

Ca TRANSAVIA: o foaie fără antet, „IZOLATII” în coloana A, 34 de rânduri.
Vată + tablă de aluminiu, vată + inox, elastomer, elastomer + PVC, casete,
un distribuitor, un rezervor fără dimensiuni, tubulatură pe m², două rânduri
care nu sunt izolație. La import se alege **Ofertă industrială**.

Oferta corectă: 32 de poziții, **59.750,36 €**, cu discount 3 %: 57.957,85 €.
Situația 1: 23.324,92 €; situația 2: 31.815,94 €; cumulat 55.140,85 € (o
treime din poziții rămân neterminate, ca să se vadă „rămas”).

Capcane puse în avize: avizul de cochilii e **parțial** (ø60: 100 din 127 m),
un rând scris altfel decât în catalog („COCHILII VATA CASERATE 48/40”), un rând
**fără UM**, unul care nu e pe comandă (bandă de aluminiu) și transportul pe
factură. Avizul de tablă e la **kg** și nu are factură (șantierul nu se poate
închide cu el deschis).

## Exemplul 2: clădire, ofertă rezidențială (`exemplu-2-cladire-rezidential`)

Ca NISAL + Matari: trei foi cu antet (Termice+Sanitare, Ventilație, Treceri
foc), 42 de rânduri. Elastomer, vată caserată, vată + tablă, vată + PVC,
elastomer + vată, țoli, cupru, PPR / PEHD, SPIRO, tubulatură pe m², protecție
la foc, închideri de goluri cu dimensiunea golului în coloană separată,
rânduri „idem DN20”.

Oferta corectă: 37 de poziții, **46.478,23 €**, fără discount.
Situația 1: 18.819,84 €; situația 2: 23.271,06 €; cumulat 42.090,90 €.

Capcane în aviz: tuburi scrise în trei feluri („ST 13x22”, „TUBURI K-FLEX
13X42”, „ARMAFLEX ACE PLUS TUBES 19 X 60”), placă livrată la **rolă** în loc de
m², saltele livrate parțial (300 din 435 m²).

## Ce a ieșit la import pe 15 noiembrie 2026

Rulat din linia de comandă (`npm run import`), pe ramura `ux-lucrare`, cu
modelul real. În ecran mai e în plus citirea coloanelor, dar citirea rândurilor
e aceeași. Detaliile pe rând sunt în `cheie-de-verificare.xlsx`.

| | Exemplul 1 (34 rânduri) | Exemplul 2 (42 rânduri) |
|---|---|---|
| Corect, cu AI | 26 | 36 |
| Preț bun, dar „Gata” unde trebuia întrebat omul | 0 | 2 |
| Preț greșit, marcat „De verificat” | 4 | 2 |
| **Preț greșit, iese „Gata”** | **2** | **1** |
| **Rămas afară din ofertă, deși e izolație** | **1** | **1** |
| Fără preț, îl pune omul (așteptat) | 1 | 0 |

Fără AI (doar regulile), rămân afară 7 rânduri la exemplul 1 și 6 la exemplul 2:
AI-ul le recuperează pe aproape toate.

**Ce completează bine AI-ul:** „vată” fără „minerală”, „minerală” fără „vată”,
„cochilii”, „cauciuc”, „elastmer”, „apă răcită” fără material (elastomer),
diametrul fără „Di”, secțiunea „Treceri prin planșee”.

**Ce greșește fără să spună (iese „Gata”):**

| Rând | În cerere | Iese | Corect |
|---|---|---|---|
| Ex. 1, r10 | „protecție cu tablă Di76, g50” (fără „aluminiu”) | 16,00 €: tabla e scoasă din preț | 38,51 € |
| Ex. 1, r14 | „… Di273 - ML” (fără grosime) | 82,89 €: vată 60 mm, luată de la țeava ø169 | 101,84 € (100 mm, tabelul firmei) |
| Ex. 2, r27 | „DN80 cu elastomer gr 19” (fără „mm”) | 10,57 €: 9 mm, luat de la țeava ø110 | 14,82 € (19 mm) |

**Ce rămâne afară din ofertă (la „Lăsate afară”):** „Casetă armături DN80” și
„Izolare conductă DN65” (fără niciun material).

**Ce marchează, dar cu preț mult prea mic:** „vată minrală … tablă de alumniu”
(10,71 în loc de 31,24 €), „vată min. + tb. Al” (9,94 în loc de 29,70 €),
„din tablă și vată” la casetă, „saltele vată … și protecție tablă” pe m²,
tubulatura 400×300 în metri (20,22 în loc de 36,40 €/ml).

## Cum le folosești la prezentare

1. Încarcă `1-cerere-de-oferta-…` ca cerere nouă (industrială, respectiv
   rezidențială) și deschide lângă ea `cheie-de-verificare.xlsx`.
2. Uită-te întâi la „De verificat” și la „Lăsate afară”, apoi compară totalul
   cu `2-oferta-…`.
3. Acceptă oferta, „Comandă ce lipsește”, trimite comenzile, apoi „A venit
   marfa” cu avizul PDF și „A venit factura” cu factura PDF.
4. Fă situațiile cu cantitățile din `…situatie-de-lucrari-1` și `-2` și compară
   totalurile.

Numerele pozițiilor din situații sunt ale ofertei corecte (toate lipsurile
rezolvate). Dacă în aplicație rămâne o poziție nerezolvată, numerotarea se
decalează cu una.
