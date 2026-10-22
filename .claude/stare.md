# Stare curentă

> Unde am ajuns, ce s-a decis și ce urmează. Actualizează la fiecare etapă.
> Ultima actualizare: 22 octombrie 2026.

## 22 octombrie 2026: pozele pentru ofertă, la Cerere nouă

Andrei: numele „Poze de pe șantier” era prea lung și nu se potrivea; pozele
pentru ofertă se mută la import. Pe ramura `santier-taburi`. Cerere nouă,
pasul 1: filele **Fișier Excel** (cu tipul ofertei) și **Poze din carnet**;
pagina din meniu e acum **Măsurători**, doar pentru situații și comenzi
(detalii în `ui.md`). Verificat cu Playwright pe `build:server`: 390 / 768 /
1440 / 1920 px, ambele teme; fila de poze fără tip de ofertă și fără scop, o
poză cu un rând scris de mână (ø60, 12 ml), fila și pagina rămase după
reîncărcare, „Trimite la ofertă” → Verificare cu „Măsurători de șantier -
masuratori santier.xlsx” (30,02 €); Măsurători cu cele două scopuri și fără
pozele ofertei; zero erori.

## 22 octombrie 2026: pagina șantierului pe file

Andrei: filele sunt mai ușor de navigat decât cardurile pliate. Pe ramura
`santier-taburi` (pornită din `straturi-rand`, încă neunită). Pagina unui
șantier are, sub cifre, filele Situații de lucrări · Materiale · Planul de
șantier · Închide șantierul · Șterge șantierul (detalii în `ui.md`). Verificat
cu Playwright pe `build:server`: TRANSAVIA (deschis) și NISAL (închis, fără
„Închide”), 390 / 768 / 1440 / 1920 px, ambele teme, fiecare filă cu cardul
ei, adresa `#/lucrari/<id>/<fila>` păstrată la reîncărcare, „Situație nouă”
de pe altă filă duce la situații, zero derulare laterală, zero erori.

## 22 octombrie 2026: straturile pe rând, din lista lui ✕

Andrei: la import, un rând poate avea 1–4 straturi, iar angajatul trebuie să
poată adăuga unul fără un buton în plus. Pe ramura `straturi-rand`. ✕ din
„Verificare” e acum o listă („⋯”): „Adaugă un strat” (vată sub protecție,
cursorul în grosime; cel mult 4 straturi cu tot cu protecția) și „Scoate
rândul din ofertă”. Asta înlocuiește „fără buton de adăugat strat” din 21
octombrie. **697 de teste.** A doua trecere, tot pe 22 (Andrei: stratul să
arate ca primul, cu tot până la preț; lista prea mare): meniul e al nostru,
iar stratul e un sub-rând întreg cu prețul lui (ales de Andrei dintre „sub-rând
al aceleiași poziții” și „poziție separată”); TRANSAVIA rândul 1 cu vată 30
peste vata 50: 28,10 + 138,86 = 166,96 €. A treia trecere: fiecare strat se
scoate (✕ pe sub-rând, „Scoate stratul 1” în meniu); TRANSAVIA rândul 1:
50 + 30 + 20 = 207,91 → fără 30: 160,87 → fără primul: doar 20 mm, 58,02 €. Verificat cu Playwright pe `build:server`: 390 /
768 / 1440 / 1920 px, ambele teme, lista de 44 × 44, zero derulare laterală;
TRANSAVIA rândul 1, două straturi de vată adăugate (30 și 20 mm), 121,67 →
207,91 €, a treia adăugare oprită; scoaterea pune rândul pe „Nu e izolație”,
cu „Anulează”.

## 22 octombrie 2026: conturile, jurnalul și ce rămăsese din audit

Cerut de Andrei: „toate astea + securitatea + o pagină de login în loc de
popup”. Ales de el: **email + parolă** (linkul pe email cerea un furnizor de
email pe Render). Pe ramura `conturi-si-audit`, migrarea **0016**. **694 de
teste.** Detalii în `backend.md` („Conturile”) și `ui.md` („Intrarea”).

| Ce | Acum |
|---|---|
| Parola comună (fereastra browserului) | pagina „Intră în cont”; parola scrypt, blocare după 5 greșite, 20 de încercări pe adresă, cookie HttpOnly / SameSite / Secure, parolă temporară cu „Alege-ți parola”, „Contul meu”, „Ieși”; CSP, fără încadrare, HSTS; documentele doar poze și PDF (SVG refuzat) |
| Cine a schimbat ce | tabelul `jurnal` (doar adăugare), scris după fiecare scriere reușită; ecranul „Cine a schimbat ce” la Setări |
| Numărul ofertei | `GET /api/oferte/urmatorul`: cel mai mare de pe seria firmei + 1, pus în casetă la pasul „Oferta”; fără oferte salvate, îl scrie omul |
| Doi oameni pe aceeași cerere | `versiune` pe cerere și necesar: al doilea primește 409 „salvată de X la ora Y” și nu mai pleacă nimic până redeschide |
| Necesarul editat nu ajungea peste tot | „Lipsește” scalează restul pe poziții la cifra omului; ✕ nu mai scade „În ofertă” (`inOfertaPe`, cu `scoase`); lista unui șantier închis e refuzată pe server |
| „Creează șantierul” din nou ștergea editările | `pastreazaEditari`: cantitățile scrise (galbene, cu noul calcul sub mouse), ✕, „Îl dă clientul”, materialul de mână rămân |
| Ștergerea șantierului schimba stocul din central fără s-o spună | panoul: „atenție: se schimbă și stocul din depozitul central, la N materiale: ce a plecat de acolo se întoarce acolo” |
| Comanda primită parțial și anulată nu se mai factura | „A venit factura” și pe ea; apare la „Așteptăm marfa” |
| Ecranele de detaliu fără adresă | `#/lucrari/<id>`: „Înapoi”, reîncărcarea și linkurile din „Necesită atenția ta” |
| Prețul de mână cu ajustarea (±0,01 €, mutat de o ajustare nouă) | prețul scris e final: `cuAjustare` îl sare |
| Serverul nu verifica situații, necesar, mișcări | locuri care există, date valide, anulări care sunt oglinda originalului (și o singură dată), poziții din plan, cantități finite și nenegative, șantier existent |

Contul firmei: `tehnic@isorad.ro` (singurul activ), făcut cu `npm run om`
pe baza locală; conturile de test din seed au plecat. **Pe Render nu există
încă niciun cont**: după publicare, contul se face cu `npm run om` pe adresa
externă a bazei, cu IP-ul laptopului pus temporar în lista ei (ca la seed).
Variabila `IZOREP_PAROLA` se poate scoate de pe Render.

Verificat cu Playwright pe `build:server` (baza de probă): 390 / 1440 px,
ambele teme; fără fereastra browserului, mesajul la parolă greșită, intrarea,
jurnalul, numărul 285, `#/lucrari/S-TRANSAVIA` după reîncărcare, „Ieși”,
parola temporară (403 pe date până la parola nouă), câmpul și „Arată” aliniate
la 48 px. Pe telefon antetul nu mai încăpea cu numele și „Ieși”: cursul BNR
nu se mai arată sub 560 px.

## 21 octombrie 2026 (noaptea): Materiale, trei file

Andrei, despre „Necesar și depozit”: „nu înțeleg nimic, prea mult scris, prea
multe butoane, tabele”. Plan cu machetă (canvasul „Plan: Materiale simplu”),
aprobat („sună bine, poți trece la implementare”). Pe ramura
`materiale-simplu`. **668 de teste.** Detaliile în `ui.md`, „Materiale: trei
file”. Pe scurt: „Necesar și depozit” și „Comenzi la furnizori” devin un
singur „Materiale”, cu filele De cumpărat (`#/materiale`), Comenzi
(`#/comenzi`) și Depozit (`#/depozit`), fiecare cu un buton albastru. Pe
TRANSAVIA, „De cumpărat” are 1.129 px și 2 butoane, față de 16.000 px și 172.
Calculele nu s-au schimbat.

Două lucruri reparate pe drum: transferul propus venea și de pe un șantier
închis (NISAL, 0,01 m² de tablă; serverul l-ar fi refuzat), iar cu două
locuri cu material se propunea mai mult decât lipsea. Ambele în
`propuneriDinDepozit`, cu teste.

Decis de noi (se pot întoarce): „Comandă ce lipsește” ia întâi din depozit;
banii (cost, „În ofertă”) nu mai sunt la Materiale, ci doar pe pagina
șantierului; intrarea de la furnizor fără comandă e la Mai multe › Trecut de
mână.

## 21 octombrie 2026 (noaptea): ce rămăsese de decis, reparat

Andrei: „nu știu ce decizii să iau, mă bazez pe tine”. Pe ramura
`reparatii-de-decis`. **664 de teste.** Deciziile, cu motivul:

| Ce era | Decizia |
|---|---|
| Grosimea pusă pe o casetă trecea pe celelalte casete de același DN (TRANSAVIA: rândul 1 la 60 mm, rândurile 2–3 la fel) | Rămâne doar pe rândul ei. Grosimea pusă de om pe o **piesă** nu mai e sursă în `grosimiDeLaConducte`; pusă pe **conductă** rămâne sursă (armătura se izolează ca țeava). Teste în `nucleu.test.ts` |
| „In atentia d-lui” fix; 118 are „d-nei” | Nu se ghicește din nume. Câmpul „În atenția (cu d-lui sau d-nei)” se scrie în ofertă exact cum e scris; din fișierul clientului se citește și rândul fără „:” („In atentia d-nei Alina Maties”), cu tot cu formulă. Importurile salvate înainte, cu doar numele, ies „In atentia Vlad Emil” până se completează formula |
| Notele de foc din 118.1 nu erau cuvânt cu cuvânt | „Nota 1 :” (cu fraza EI60 / EI90 / EI120 care lipsea) și „Nota 2 :”, ca în 118.1, titlurile îngroșate; fraza ruptă pe două rânduri de lățimea paginii e un rând |
| Coloana „Total” din „Verificare” lua locul descrierii la 1440 px | Scoasă: totalul e în „Cum iese oferta”. Descrierea: 190 → 266 px la 1440 |
| UM-ul și al treilea strat nu se puteau schimba din „Verificare” (le avea doar editorul vechi) | UM-ul e listă (ml / buc / m², plus ce a scris clientul) și se scrie în celula UM a clientului, ca descrierea: rândul se recitește. Al doilea strat de izolație (elastomer + vată, NISAL) stă sub primul, cu grosimea sub grosime; „Fără” îl scoate. Fără buton de adăugat strat: se scrie în descriere |
| „Scoate pagina” era text, sub fiecare pagină de poze | ✕ în colțul paginii, ca pe rânduri. Cu rânduri pe pagină, primul clic întreabă „Sigur scoți pagina?” (pleacă și poza, și ce s-a verificat, fără drum înapoi); orice alt clic renunță. Pagina goală pleacă direct |

Verificat cu Playwright pe `build:server` (modelul blocat / simulat): 390 /
768 / 1280 / 1440 / 1920 px, ambele teme, zero derulare laterală, casete de
44 px, zero erori; TRANSAVIA (grosimea, UM-ul, după reîncărcare), NISAL
(stratul al doilea, 44,35 → 56,44 € cu vata la 50 mm), pozele (✕, întrebarea,
renunțarea).

## 21 octombrie 2026 (seara): pozele de pe șantier, corectate în tabel

Cerut de Andrei: poza mică (miniatură lângă titlu, clic → panou mare cu ✕),
rândurile citite din poză editabile direct, ca la import, în timp real, fără
„Modifică”, cu ✕ în loc de „Scoate”, fără coloana „Pe foaie” (sumele
citite din scrisul de mână greșeau des). Detalii în `ui.md`, „Măsurători”.
Verificat cu Playwright pe `build:server`, cu răspunsul modelului simulat
(pagina Ecoterm din exemplul lui Andrei): 390 / 768 / 1280 / 1440 / 1920 px,
ambele teme, zero derulare laterală, casete de 44 px, cantitatea 12 → 15 la
fiecare tastă (galbenă, „Citit din poză: 12”), Confirmă, ✕, panoul cu
poza (✕, Escape), „Adaugă rând” duce cursorul pe diametru, totul rămâne după
reîncărcare.

## 21 octombrie 2026 (seara): cursul BNR în antet

Cerut de Andrei: cursul live, **doar în antet**, fără să atingă calculele.
`GET /api/curs` (`src/server/curs.ts`) citește `https://curs.bnr.ro/nbrfxrates.xml`
(`www.bnr.ro/nbrfxrates.xml` trimite acum spre prima pagină), îl ține o oră în
memorie, iar când BNR nu răspunde rămâne ultimul citit, cu ziua lui; fără
niciunul, 503 și antetul nu arată nimic. Antetul: „Curs BNR 21 oct.: 1 € =
5,3297 lei”, pe telefon „Curs BNR: 5,3297 lei”; pe linkul demo, nimic. Niciun
calcul nu-l citește: oferta rămâne în euro, depozitul și comenzile pe cursul
de pe document. Gardul e în `tests/curs.test.ts` (doar `app.ts`, `date.ts` și
`main.ts` ating cursul). Regula BNR + 1–2 % de la facturare („De reținut”) e
tot nefăcută. **656 de teste.**

## 21 octombrie 2026: oferta ca exportul, din ofertele semnate

Pe ramura `oferta-ca-exportul`. **648 de teste.** Andrei: „la export și pe
pagina de import, după import, aproximativ aceeași chestie”; coloanele să se
numească ca în ofertele firmei. Ce lipsea, găsit în 284, 118 și anexa din 2024:

| Ce | Acum |
|---|---|
| **Logo-ul firmei** (antetul de pagină al ofertelor: RADOIA pe 284, ISORAD pe 118 și anexă) | `web/public/logo-radoia.jpg`, `logo-isorad.jpg`; `logoFirmei` în `web/date/firme.ts`. Doar în Excel, deasupra titlului (ExcelJS nu scrie imagini în antetul de pagină); pe ecran nu (Andrei) |
| **Tabelele de elemente speciale** de sub notă (cot/teu, robinet, pompă ca X × prețul pe ml, pe benzi de ø) | `elementeSpeciale` în `document-oferta.ts`, din coeficienții listelor (aceiași cu care tarifează motorul): unul pentru izolații (cu „manșetă” doar când e elastomer, ca 118; 284, doar vată, n-o are), unul pentru protecție. Test: TRANSAVIA dă exact tabelele din 284, NISAL pe cele din 118 |
| **„Pagina X din Y”**, A4 pe lățime | `pageSetup` și `oddFooter`, ca 284 și anexa |
| **Pasul de verificare, refăcut** (Andrei, tot pe 21: „UI-ul e îngrozitor”; pastilele „Vată minerală 50 mm · ø114 în listă”, „Completat de noi”, butoanele decalate față de casete; macheta aleasă din două) | două taburi: **„Verificare”** (`web/import/verificare-vizual.ts`): rând pe două niveluri, sus rândul din fișier, codul, descrierea și starea, dedesubt izolația, grosimea, protecția, diametrul, piesa, cantitatea (cu UM-ul), prețul, totalul, ca casete de 44 px pe o linie, cu butoanele pe aceeași linie; scrise pe loc (`patchDinCamp`), poziția devine a omului; fără butoane în plus. **„Cum iese oferta”** (`exportPeEcran`): Excelul de acum, doar citire, fără logo. Foaia clientului ca în Excel (`grila.ts`) a ieșit |
| Pe telefon, butonul „Completează datele ofertei” strângea titlul (o regulă CSS anula pe cea de ecran îngust) | reparat |
| Testele pe fișierele clienților picau cât o ofertă era deschisă în Excel (`~$oferta-284…xlsx`) | fișierele `~$` nu se mai citesc |

**Denumirea în ofertă** (tot pe 21): specificația lipită după textul întreg
repeta materialele („… din tabla aluminiu si vata minerala vata minerala gr. 50
mm …”). Ca în 284, ea ia locul cozii cu materiale (`faraMateriale`: după „din”
/ „cu”, numai materiale și legături, marca inoxului trece în specificație);
unde nu se poate tăia (coadă cu Di / g, liste de mărci), cu roșu se scrie doar
ce lipsește („tabla de inox gr. 0,4 mm”). Testul TRANSAVIA cere acum textul
negru din 284 exact, pe cele 24 de casete.

**Scrisul roșu.** În ofertele semnate roșul e *în* celulă (rich text), nu pe
celulă: **ce a precizat sau schimbat firma în textul clientului**. Pe 284: pe
cele 24 de casete, materialul și grosimea („vata minerala gr. 50 mm si
protectie cu tabla de aluminiu”, în locul lui „din tabla aluminiu si vata
minerala”); pe celelalte 75 de rânduri doar cuvântul „aluminiu”, corectat din
„dealuminiu”. Pe 118: partea de izolație dintr-o descriere mai largă
(tubulatura SPIRO „… izolata termic cu placi adezive de armaflex 9 mm”), adică
ce acoperă prețul nostru. Exportul face deja primul caz (specificația cu roșu,
24 / 24 pe 284); al doilea (marcarea izolației în textul clientului) nu.

În **evidența de achiziții** roșul e altceva: rândul întreg roșu e transportul
(3 rânduri RADOIA) sau o factură izolată; cursul roșu (coloana I, 4 zecimale,
282 de rânduri RADOIA) e cursul BNR pus de mână la furnizorii care facturează
în lei (R&F Izotec, MTM, Ravago), față de cursul de pe factură (2 zecimale) la
Bandatech și Isoline; numele de proiect roșu marchează facturi întregi (91), cu
coloana „Avize facturi” goală în 92 % din cazuri (55 % la restul). Regula
pentru acesta din urmă nu se poate dovedi din date.

**Tot pe 21, a treia trecere:** primul tab e tabel pe coloane, nu rând pe două
niveluri; descrierea scrisă e celula clientului și recitește rândul la fiecare
tastă (DN100 → DN50 pe TRANSAVIA: 52,41 €, ca în 284; rescrisă DN65: 66,10 €).
`pastreazaCursorul` citea cursorul după redesenare, deci în textul editabil
sărea la capăt: acum îl citește înainte.

**Observat la verificare:** grosimea schimbată pe o casetă fără grosime scrisă
trece și pe celelalte casete de același DN din cerere (TRANSAVIA: rândul 1 la
60 mm, rândurile 2–3 la fel), fiindcă `grosimiDeLaConducte` ia cea mai mare
grosime de pe rândurile cu același ø. Regula e veche, nu a ecranului.
(Reparat în aceeași noapte: grosimea omului pe o piesă nu mai e sursă.)

**Rămas:** „In atentia d-lui” e fix (118 are „d-nei”); notele de foc din 118.1
(„Nota 1”, EI60 / EI90 / EI120) nu sunt cuvânt cu cuvânt. (Reparate amândouă
în aceeași noapte, mai sus.)

## 18 octombrie 2026: demo-ul amânat, editarea în timp real

Andrei a anulat demo-ul de luni: aplicația e prea complicată pentru oamenii
firmei, iar câmpurile editate nu se refăceau pe pagină. Pe ramura `timp-real`:

- **Totul la tastă** (`pastreazaCursorul` în `web/celula.ts`): cantitatea,
  prețul („Ca în ofertă”), necesarul, pierderile, cifrele de lângă foaia
  clientului (Toate / Gata / De verificat / Fără preț, foile), valoarea ciornei
  de comandă. Rândul care nu mai e poziție își golește coloanele noastre.
  Verificat cu Playwright pe TRANSAVIA: totalul se schimbă la fiecare cifră,
  cursorul rămâne, „100,” rămâne „100,”, Escape revine la 94.575,06 €.
- **Pe localhost pozele, importul și avizele nu foloseau modelul**, deși
  serverul avea cheia: rutele modelului erau „lângă pagină” (`/izorep/api/…`, de
  pe vremea Pages), iar vite trimite la server doar `/api`, deci răspundea
  `index.html` și ecranul credea că nu există model. Acum `/api/…`, ca datele
  (`rutaModel`, `linkDocument`). Pe Render nu se vedea: acolo pagina e la `/`.
- **Fără jargon pe ecran:** mesajul de la poze („Pe linkul demo … nu există
  server”, „cheia OpenAI”) spune acum doar ce face omul; la fel mesajele de
  salvare și pagina „Aplicația nu se deschide acum”.
- **De făcut, cu machetă întâi:** simplificarea ecranelor pentru oameni fără
  experiență (`utilizatori-fara-experienta` în memoria lui Claude).

## 16 octombrie 2026: auditul, plafonul pe model, bugurile de demo

Pe ramura `limita-model`. **641 de teste.** Audit complet cerut de Andrei
(cinci agenți: import și prețuri, șantier și ștergere, depozit și tablou,
parcurgerea în browser, planul și Render). Calculele ies: TRANSAVIA 99 / 99 linii
și Matari 53 / 53 față de semnat, stocul se conservă, tabloul e egal cu baza.
Problemele erau la margini (editări, reimport, ștergere).

**Plafonul zilnic pe model** (migrarea 0015, `src/server/limita-model.ts`):
3.000 de rânduri din Excel și 100 de poze și avize pe zi, numărat în bază,
peste: 429 cu mesajul pe ecran. Detalii în `backend.md`.

| Bug | Acum |
|---|---|
| Șantierul se lega de cerere și după numele fișierului: ștergerea unei cereri reimportate lua șantierul închis al celeilalte; „Creează șantierul” era blocat la reimport | după id-ul cererii (`plan.cerere`); numele doar pentru planurile vechi, fără `cerere` |
| Același număr („RAD284”) salvat pe două cereri: tabloul dubla valoarea | serverul refuză (409) numărul care e deja pe oferta altei cereri |
| Șantierul închis cerea „7 materiale de comandat” (tablou, pagina lui) | nimic de comandat pe un șantier închis |
| „Lipsește un material” după comenzile normale: 0,02 m² de tablă din rotunjirea kg ↔ m² | lipsa sub 0,5 % din necesar (min. 0,05) nu e lipsă (`tolerantaLipsa`) |
| Cantitatea 0 în „Ca în ofertă” devenea 1, fără semn | refuzată cu mesaj (și literele, minusul); poziția se scoate cu ✕ |
| Prețul pus de mână scotea materialul din necesar (TRANSAVIA: 8.899 €) | straturile din liste rămân; valoarea liniei se împarte pe ele |
| `demo.ts` salva cererile fără antet: TRANSAVIA redeschisă arăta 94.575,06 fără discount | antetul, cu discountul, stă în cerere |

**După parcurgerea pe Render (tot pe 16):** cu modelul pornit, TRANSAVIA ieșea
98 „Gata” în loc de 99 (distribuitorul trecea prin model, iar regula dovedită
conta doar pe sursa „regex”); la fel Transavia inox, 67 în loc de 69. Acum
**regulile întâi** (`ramanDupaReguli` în `nucleu.ts`): se tarifează întâi ca fără
model, iar ce iese „Gata” nu mai pleacă la model. Testul din `fara-pret.test.ts`
trece toate fișierele de client cu un model care întoarce cel mai rău răspuns:
nicăieri mai puține „Gata” decât fără model. TRANSAVIA nu mai trimite niciun rând
la model. Tot atunci: „Anulează modificările” pune rândurile la locul lor
(`ordineNecesar`); avizul citit rămâne până la înregistrare (`sessionStorage`);
șantierul se creează doar cu obiectivul scris; închiderea spune când materialul
pus n-a venit pe șantier și lipsește din cost; „Importuri recente” arată oferta
salvată, cu discountul.

**Rămase din audit, după demo:** necesarul editat nu ajunge peste tot („Lipsește”
folosește încă cel calculat, ✕ scade „În ofertă”, șantierul închis îl lasă
editabil); „Creează șantierul” din nou șterge editările necesarului; ștergerea
unui șantier rescrie stocul central / atelier fără s-o spună în panou; comanda
primită parțial și anulată nu se mai poate factura; ecranele de detaliu n-au
adresă; prețul de mână cu ajustarea (±0,01 €, ajustarea schimbată după îl
mută); validarea pe server la situații / necesar / mișcări; meniul la 40 px.
Repo-ul GitHub e public (listele de prețuri, prețurile furnizorilor, avizul
ISOLINE). Pe Render lipsește starea de demo.

## 15 octombrie 2026: pe Render, meniul pe flux, oferta și necesarul editabile

**Render** (plan gratuit până la „100 % live”, decis de Andrei): creat din API
în workspace-ul firmei, nu din `render.yaml` (care rămâne varianta plătită).
Server `srv-db8etiuq1p3s73ajg2bg`, https://izorep.onrender.com, deploy din
`main` doar cu CI verde. Postgres 18 gratuit, Frankfurt, **expiră pe 14
noiembrie 2026**, fără backup, fără acces din afară. Pe gratuit nu există
pre-deploy și nici shell: migrările rulează la pornire
(`npm run db:migrate && npm run server`), iar seed-ul s-a rulat de pe laptop,
cu IP-ul pus temporar în lista bazei. Logul: „aplicatia intra ca izorep_app”.
Publicarea pe Pages (`pages.yml`) a ieșit.

**Meniul pe flux** (angajații nu găseau șantierul): Acasă · Oferte (Cerere
nouă, Oferte și cereri, Calcul rapid) · Șantiere (Șantiere, Poze de pe
șantier) · Materiale (Necesar și depozit, Comenzi la furnizori) · Setări.
Titlurile ecranelor și trimiterile din texte au aceleași nume; `#/santiere` e
alias. Șantierul apare abia după „Creează șantierul”, la pasul „Oferta”.

**Ștergerea de tot** (cerută de Andrei): înainte, o cerere cu ofertă și un
șantier cu situații nu se puteau șterge deloc. Acum „Șterge” (Oferte și
cereri, importurile recente, pagina șantierului) deschide un panou cu tot ce
pleacă, rând cu rând („cererea …”, „oferta RAD11 …, cu toate versiunile ei”,
„șantierul …, cu 3 situații”, necesarul, comenzile, mișcările de stoc,
avizele); „Șterge definitiv” merge doar după bifa „Am înțeles”. Cererea ia cu
ea ofertele și șantierele făcute din ea; șantierul ia situațiile, necesarul,
comenzile (și trimise), mișcările pe el sau pentru el (cu storno-urile lor) și
documentele comenzilor, iar cererea și oferta rămân. Ce se șterge se
hotărăște într-un singur loc, pur (`web/stergere.ts`); serverul îl
recalculează din bază (`POST /api/stergere`, `stergeLucrarea`), într-o
tranzacție. Trigger-ele de imutabilitate lasă să treacă doar cu
`app.sterge_lucrare` pus local (migrarea **0014**); altfel aplicația e
refuzată ca înainte. Test pe Postgres: `tests/stergere-server.test.ts`.

**Tabele editabile, ca în Excel** (macheta aprobată de Andrei): celula scrisă
e galbenă și arată, sub mouse, ce era; Enter coboară, Escape renunță
(`web/celula.ts`, `legaCelule`).

- **Oferta, vederea „Ca în ofertă”:** denumirea (doar a ofertei, `cuDenumiri`;
  prețul nu se schimbă), cantitatea (celula din fișierul clientului, ca o
  corectură în foaie, cu `EditareCelula.inainte`), prețul unitar (prețul pus de
  mână, fără ajustarea tehnicului; gol = lista), ✕ (scoate din ofertă).
  Ajung în Excel și pe șantier. Verificat: TRANSAVIA, ecran = Excel, după
  reîncărcare la fel.
- **Necesarul**, în „Necesar și depozit”: cantitatea (`MaterialNecesar.calculat`
  ține cifra calculată), ✕ pe orice rând (cele calculate merg în
  `NecesarLucrare.scoase`), „Anulează modificările”, „+ Rând nou” (materialul de
  mână). Tot acolo, explicația de sub „Rămas de comandat” se rupe pe rânduri:
  înainte împingea „În ofertă” în afara cardului.
- **După demo:** situațiile și comenzile (același tabel); „+ Rând nou” pe
  ofertă (o poziție nouă cere un index nou în import, `editare.ts`).

Verificat cu Playwright pe demo: 390 / 768 / 1440 / 1920 px, ambele teme, zero
derulare laterală, zero erori, nicio celulă sau ✕ sub 44 px. Netestat pe
server cu baza: se vede după deploy.

## 14 octombrie 2026: sesiunea de cloud, design și bug-uri (ramura `cloud-design`)

Cerut de Andrei, pentru demo (19 octombrie): aplicația să arate profesional și
să fie ușor de folosit de oameni de birou și de șantier, plus bug-urile din
`docs/sesiune-cloud.md`. Unit pe `main` prin #5 (c86981a).

**Importul, în formatul ofertei** (decis de Andrei pe 13 octombrie seara,
peste decizia din 11 octombrie): „cererile vin în structuri diferite, dar pe
pagină și la export trebuie să aibă același format”. Pasul „Verificare” arată
`documentOferta`, adică exact documentul din care se scrie Excelul: aceleași
coloane pentru orice fișier (Nr., Cod doar cu coduri, Denumire, UM, Cantitate,
golul doar la foc, Preț unitar, Valoare), capitolele clientului cu subtotal,
totalul, discountul și nota. Pozițiile „De verificat” și „Fără preț” stau la
locul lor, fără număr. Cei trei pași rămân. După prima privire a lui Andrei,
tot pe 14: vederea implicită e „Fișierul clientului” (grila), cu „Ca în ofertă”
alături; descrierea se vede întreagă, fără „Tot textul”; „Stare” are lățime
fixă, lipită de marginea din dreapta, descrierea ia cel mai mult din rest, iar
observațiile puțin; sub 1100 px rândurile devin carduri (`ui.md`). `web/import/oferta-vizual.ts`. Verificat pe
Book15, Flower City, CET (prin izolația pe foaie) și o cerere scrisă de noi:
același tabel, Excelul descărcat are aceleași rânduri ca ecranul.

- Datele ofertei (număr, beneficiar, obiectiv, discount, ajustare) stau în
  sesiune (`SesiuneImport.antet`): la reîncărcare nu se mai pierd, iar
  „Creează șantierul” nu mai ia numele fișierului drept beneficiar. Beneficiarul
  și obiectivul se propun din antetul fișierului („Beneficiar : …”).
- Rândurile de continuare („Same - Ø125 mm”, „idem DN20”) se scriu în ofertă ca
  descrierea poziției de deasupra urmată de dimensiune (`textClient`).
- „ø114 în listă” în loc de „rândul 114”: lângă „Excel: rândul 13” se citea
  ca rând din fișier.

**Bug-uri:**

| Ce | Acum |
|---|---|
| Ciorna netrimisă era „comandat, nesosit” (`comandatNesosit`): șantierul arăta „Lipsește: nimic” pe material necomandat | doar comenzile trimise sunt comandate; ciornele apar „în ciornă, de trimis” și nu se dublează (`inCiorna`) |
| Comanda deschisă pe un șantier închis era alertă | nu mai e (`alerte`) |
| Factura care înlocuiește avizul număra material venit a doua oară | se numără la data avizului (`dataSosirii`); textul de sub titlu o spune |
| „15.641,41 €” sus, „din 15.641,42 €” jos, pe același șantier | valorile pe materiale se rotunjesc ca suma lor să fie oferta (`laBani`) |
| R4: Măsurătorile se pierdeau la reîncărcare | paginile în lucru, cu poza, în IndexedDB până pleacă (`web/masuratori-local.ts`) |
| Măsurători: fără model (link demo, server fără `OPENAI_API_KEY`), pozele treceau pe tăcute la „De verificat”, fără nicio citire | sus scrie „Pozele nu se citesc automat” și de ce, cu „Verifică din nou”; pagina are „Scrii de mână”, iar cu modelul pornit între timp, „Citește poza acum” (`stareModel`) |
| Tooltipul meniului pliat ieșea sub carduri | bara pliată are `z-index` |
| R6: avertismentul de Node 20 în CI | `checkout` și `setup-node` v5 |
| favicon 404 în consolă; „Comandă nouă, mai jos” când formularul e ascuns; „1 poziții” | reparate |

**Designul, pe toate ecranele** (`web/style.css`, blocul „sistemul comun”):
cifrele de sus pe grilă, fără rupere; etichetele de stare ca pastile cu punct
(arătau ca butoane); toate controalele de 44 px; secțiunile pliate la fel;
ștergerea fără roșu; tabelele pe telefon cu titlu de card; antetul cu numele
aplicației pe telefon. Pe ecrane: șantierul cu numele sus, situațiile înaintea
materialului, planul și ștergerea pliate, soldul negativ marcat; Depozit cu
„Sari la” și secțiunile în ordinea folosirii; Cereri și oferte cu titlul
documentului primul; matricea de prețuri compactă pe telefon.

Verificat cu Playwright pe `build:server` (bază goală, date făcute din ecrane)
și pe demo: 10 ecrane + pagina șantierului, 390 / 768 / 1440 / 1920 px, ambele
teme: zero derulare laterală, zero erori (pe demo, doar sonda `/api/stare`),
nicio țintă sub 44 px în afara linkurilor din text. **592 de teste.**

## 13 octombrie 2026: starea de demo (R3)

`npm run demo -- [adresa bazei, ca proprietar]` (`scripts/demo.ts`). Golește
datele firmei, fără listele de prețuri, furnizori, clienți, centralul și
atelierul, ca proprietar cu `app.purjare`. Apoi pune starea de demo prin
`web/date.ts`, cu `fetch` legat de `creeazaServer` în proces și ceasul fixat
pe fiecare pas (`la`). Conținutul și cifrele sunt în
`docs/plan-pana-la-render.md`, R3. Rulat de două ori, dă aceeași stare.

Găsit pe drum, cu ochii pe ecran:
- **tabla pentru prima situație:** fără ea, situația scrisă pe un șantier fără
  tablă dădea „Rămas −249 m²”;
- **kg-ul tablei la recepție, rotunjit în sus:** rotunjit la cel mai apropiat,
  comanda rămânea „venită doar în parte”.

## 13 octombrie 2026: ecranele doar din bază (R2)

Pe server, niciun ecran nu mai arată datele de exemplu din `web/date/seed.ts`:

- **Tabloul**: valoarea ofertelor salvate, șantierele deschise și închise,
  pozițiile din cererile fără ofertă; la „Necesită atenția ta”, șantierele cu
  tot executat, cea mai mare cerere fără ofertă, ofertele fără șantier.
- **Clienții**: beneficiarul de pe antetul ofertelor salvate, cu ofertele și
  șantierele lui (`clientiDinOferte`).
- **Cereri și oferte, Lucrări, Depozit**: secțiunile cu exemple apar doar pe
  linkul demo (`exemple()` din `web/date/exemple.ts`).
- **Firmele** emitente au trecut în `web/date/firme.ts`: sunt antetul
  ofertelor, nu exemple.

Construit cu `build:server`, `seed.ts` nu mai intră în pachet. CI-ul o
verifică: pică dacă „Energoinstal”, „TRANSAVIA” sau „170519” apar în
`dist-web`. Verificat cu Playwright pe proba ca pe Render, cu baza goală după
seed: cele 10 ecrane, la 1440 și 390 px, fără niciun nume de client, fără
erori, fără derulare laterală.

În pachet au rămas numele fișierelor din memoria de coloane a importului
(`data/mapari/index.json`): sunt metadate și nu se afișează.

## 13 octombrie 2026: primul deploy merge și fără `CREATEROLE`

R0 și R1 din `docs/plan-pana-la-render.md`. **613 teste.**

- **Proba ca o comandă:** `npm run ca-pe-render`, cu `--fara-createrole`,
  `--teste`, `--fara-server`, `--opreste`.
- **0002** creează `izorep_app` doar dacă proprietarul are voie; altfel
  aplicația intră cu proprietarul (`alegeAplicatia`). Logul serverului spune
  care variantă e.
- **Garda** (`verificaRolul`): serverul nu pornește cu un rol care ocolește
  RLS.
- **Bug din 0006, găsit de probă, reparat în 0013:** `purjare_permisa`
  întorcea NULL pentru proprietar, deci trigger-ele cu `NOT` nu-l opreau:
  planul înghețat și lista de prețuri activă se puteau schimba din `psql`.

Pe probă trec ambele variante. Fără `CREATEROLE`, un singur test se sare:
purjarea rezervată altui rol decât aplicația, care acolo e proprietarul.

## 12 octombrie 2026 (seara): pregătit pentru Render

Pe ramura `render`; **610 teste**. Planul până la demo (luni, 19) e în
`docs/plan-demo.md`; deploy-ul în `docs/plan-deploy.md`, cu tot ce s-a
schimbat și proba „ca pe Render”. Pe scurt:

- `render.yaml`;
- două conexiuni la bază (proprietar și `izorep_app`, cu parola din
  variabilă);
- parola comună pe site;
- `tsx` la dependențele de rulare, Node ≥ 22.

Proba, pe un Postgres 18 nou, cu un proprietar fără drepturi depline: cu
`CREATEROLE` totul trece (610 teste, RLS ține, serverul închis fără parolă);
fără `CREATEROLE`, 0002 pică. Pe Render, primul lucru de verificat.

## 12 octombrie 2026: fazele 6–8 unite, testele în CI

Fazele 6, 7 și 8 sunt pe `main` (secțiunile de mai jos; legăturile dintre ele
sunt la Faza 7, „Legate la unirea fazelor 6–8”). **605 teste.** Migrările
0010 → 0011 → 0012, `drizzle-kit generate` fără schimbări.

**CI-ul era roșu din 11 octombrie** și, mai rău, mințea pe dos: 30 de teste
pe fișierele clienților ieșeau cu `return` când lipsea `../attachments`, deci în
CI treceau fără să verifice nimic, printre ele „gata când”-urile fazelor 6 și
7 și reproducerea ofertelor semnate. Doar cele 3 din `izolatie-foaie` erau
`it.skip`, și ele țineau CI-ul roșu. Fișierele clienților nu urcă în repo (date
reale), deci acum (`tests/conditii.ts`):

- `cuClienti` în loc de `return`: fără fișiere, testul e **sărit vizibil**.
  În CI: 572 trec, 33 sărite, iar pasul „Ce nu a rulat în CI” le numără într-un
  avertisment. Orice alt test sărit pică pasul.
- `bazaDisponibila`: în workflow-ul CI (`IZOREP_CERE_BAZA=1`) o bază care nu
  răspunde **pică** testele, nu le sare. Local și în workflow-ul de Pages (fără
  Postgres) se sar, ca înainte. Prima variantă se lega de `CI`, pe care GitHub
  îl pune și în Pages: publicarea demo-ului a picat o dată.
- Local, cu `../attachments`, nu se sare nimic: CI verde nu înlocuiește
  `npm test` local înainte de push.

## 11 octombrie 2026: Faza 6, consumul

Pe ramura `faza-6`. **572 de teste** (557 + 15). Logica în `src/stoc/consum.ts`,
pură; testul fazei e în `tests/consum.test.ts`.

| Ce | Cum | Unde |
|---|---|---|
| **Consumul din situație** (S7 c, S41) | la salvarea situației se scrie, pe fiecare material al necesarului, consumul calculat până la ea minus ce au scris situațiile de dinainte. Calculat = necesarul × partea executată: Σ executat cumulat × `pePozitie` / Σ cantitate ofertată × `pePozitie`. Tot executat = exact necesarul, la ban, oricâte situații. Mișcarea e `consum`, din depozitul șantierului, cu `situatieId`; id-ul e `consum-<depozit>-<situație>-<articol>`, deci browserul și serverul scriu aceeași mișcare | `consumDinSituatie` |
| **Ștearsă situația** | storno pe consumul ei (`anulare-<id>`), nimic nu se șterge. În jurnal, consumul din situație n-are „Anulează” | `anuleazaConsumSituatie` |
| **Marca** | consumul se ia din mărcile de pe șantier, pe rând, cât are fiecare; ce lipsește iese sold negativ (marcat), pe ultima marcă sau pe materialul fără marcă | `dinMarci` |
| **Consumul de mână** (S7 b) | „Mișcare nouă → Consum pe lucrare” rămâne; în plus, în Lucrări, „Notează consum de mână” pe cardul șantierului (aceleași mărci) | `web/consum-vizual.ts` |
| **Consumul real și pierderea** (S42) | real = venit pe șantier − întors − rămas (soldul), deci cuprinde consumul de mână și ajustările la inventar. Pierderea = real − calculat; pe șantier, pe valoare (prețul mediu de achiziție, altfel cel din ofertă). Peste 10 % → „Necesită atenția ta” | `consumSantier` |

**API pentru Faza 7** (`src/stoc/consum.ts`):

- `consumSantier(plan, materiale, miscari, depozit = plan.id): ConsumSantier` →
  `{ depozit, situatii, pierdereProcent, pestePrag, materiale: ConsumMaterial[] }`;
  pe material (fără marcă, `cheie`): `necesar`, `trimis` (intrări pe șantier,
  transferuri și retururi primite), `returnat` (transfer, retur, retur la
  furnizor de pe șantier), `ramas` (= soldul), `consumCalculat`,
  `consumScris: { situatii, mana }`, `consumReal`, `pierdere`,
  `pierdereProcent` (null fără nimic calculat), `pret`.
- `consumCalculat(plan, materiale, nr?)`, `parteExecutata(plan, material, nr)`,
  `PRAG_PIERDERE` (0,1), `dinMarci(articol, cantitate, miscari, depozit)`.
- În ecrane: `consumPlan(plan, stareDepozit)` și `santiereCuPierdere` din
  `web/consum-vizual.ts`.

**Deciziile, din date:**

- **Pierderea la croit e consum, nu pierdere.** Necesarul o are deja (S15, S16:
  tablă și plăci 10 %), resturile merg la reciclat (S43). Socotită pierdere,
  tabla ar sta mereu la 10 % și pragul n-ar mai spune nimic. Deci o situație cu
  tot executat consumă necesarul întreg, iar „rămas” = ce s-a trimis peste el.
- **„10 % per total general”** (S42, răspunsul 6) e pe tot șantierul, pe
  valoare: ml și m² nu se adună. Prețul e al intrărilor (S44), altfel cel din
  ofertă. Pe material se vede și procentul lui.
- **Necesarul micșorat după situații** nu scrie consum cu minus: corectura e la
  inventar (Faza 7 / 8).
- **Materialul clientului** (S38) și cel adăugat de mână pe necesar nu se
  consumă din situații: n-au poziție în plan, respectiv nu sunt în stocul nostru.
  Se notează de mână.
- **Mutarea din browser**: situațiile intră fără consum, apoi, după mișcări,
  consumul ultimei situații se completează (cel scris deja în browser are
  aceleași id-uri și nu se dublează).

**Pe drum:** indicatorul „Materiale de comandat” din Lucrări număra din stocul
de acum: după o situație cu tot executat ar fi cerut din nou toate cele 12
materiale TRANSAVIA. Acum e „rămas de comandat” ca în Depozit (necesar − adus −
comandat nesosit).

Migrarea **0011**: `miscare.situatie_id` (fără cheie străină: situația se
șterge, consumul rămâne anulat) și `miscare_situatie_chk` (doar consumul o
poartă). `POST /api/miscari` refuză o mișcare cu `situatieId`.

Verificat cu Playwright pe `build:server` (8806, `izorep_f6`) și pe demo static
(build-ul de Pages, servit separat): TRANSAVIA importată → „Creează șantierul” →
material trimis = necesar + 2 pe fiecare din cele 12 → situație „Tot restul” →
„Situația a scris consumul pe 12 materiale”, rămas 2 ml / 2 m² peste tot,
pierdere 0 %, „Materiale de comandat” 0 → consum de mână 60 % din tabla de 0,8
→ 20,3 %, „peste prag”, rândul în tabloul de bord → situația ștearsă → rămas =
venit − consumul de mână. Pe server: 12 consumuri și 12 storno-uri în bază.
Lucrări (cu și fără formularul deschis), Tablou, Depozit: 390 / 768 / 1440 /
1920 px, ambele teme, zero derulare laterală, zero erori (pe demo, doar sonda
`/api/stare`, care lipsește acolo).

**Rămas:** închiderea șantierului, inventarul, costul față de ofertă (Faza 7)
folosesc `consumSantier`; consumul pe zone / parcele (S40) nu e făcut — se
calculează pe tot șantierul.

## 11 octombrie 2026: Faza 8, pornirea

Pe ramura `faza-8`. **576 de teste** (19 noi, `tests/pornire.test.ts`). Totul
în „Depozit și stoc”; nicio migrare (`miscare.motiv` exista din 0010).

| Ce | Cum | Unde |
|---|---|---|
| **Doar șantierele noi** (S48) | fără stare nouă: pe server, locurile sunt centralul, atelierul și șantierele create din ofertă; șantierele din datele firmei (`SANTIERE` din seed, lucrări de dinainte) rămân doar pe linkul demo. Un șantier nou pornește gol: stocul de pornire nu se poate trece pe șantier (nici pe ruta lui, nici ca `/api/miscari`) | `santiere()` în `web/ecrane/stoc.ts`, `valideazaPornire` |
| **Stocul de pornire** | o `intrare` cu `motiv: "stoc de pornire"` în central sau în atelier, din „Mișcare nouă” (tipul implicit cât depozitul e gol). Fără inventar complet: se trece ce se știe, oricând; tot așa intră restul care se întoarce de pe un șantier început înainte de aplicație (șantierul acela nu e în aplicație, deci nu e retur). În jurnal „Stoc de pornire”, în drum „stoc de pornire → Depozit central”; nu intră în evidența cumpărărilor | `intrareDePornire`, `POST /api/depozite/:id/pornire` |
| **Prețul stocului de pornire** | scris de om, altfel ultimul preț de cumpărare cunoscut (factură din aplicație sau evidența firmei, cea mai nouă), în euro cu cursul documentului, tabla din kg în m²; sursa în notă. Cochilia ø140×50: Isoline 47,4544 lei / 5,32 = 8,92 €/ml. Un rând în lei fără curs nu se trece în euro | `ultimulPretCumparat` |
| **Inventarul** (S45) | cardul „Inventar”: locul (orice loc), „Ce arată aplicația”, „Ce ai numărat”, diferența pe loc; motivul (diferență la numărătoare, pierdut, furat, deteriorat, dus la reciclat, găsit în plus, sau scris) e obligatoriu. Diferența devine `ajustare` cu motiv; ce nu se numără nu se atinge; „alt material găsit” adaugă. Ajustarea de mână din „Mișcare nouă” a ieșit (n-avea motiv) | `ajustariInventar`, `POST /api/depozite/:id/inventar` |
| **Evidența pe șantier în Excel** | „Descarcă evidența” pe fiecare șantier din „Locurile”: foaia „Evidenta santier” cu cele 13 coloane ale Excelului firmei (intrarea iese identic cu „Descarcă evidența” din Comenzi) plus TIP MISCARE, DE UNDE / UNDE, MOTIV / NOTA; cantitate cu semn; fără document, prețul mediu (S44). Foaia „Sold pe material”: adus, consumat, plecat, ajustat, rămas = soldul aplicației | `web/evidenta-santier.ts` |

**API-ul din `src/stoc/inventar.ts`** (pentru unirea cu Faza 7, care are un
helper local pentru inventarul de la închidere):

- `ajustariInventar(miscari, { depozit, numarat: [{ articol, cantitate, motiv? }], motiv, nota? }, id: (linie) => string, data): Miscare[]`
  — pe orice loc; o ajustare pe fiecare linie numărată care diferă de sold
  (`spre: depozit`, cantitate cu semn, `motiv` al liniei sau al inventarului,
  nota „inventar: numărat X, aplicația arăta Y”). Numărat 0 = tot restul.
  Nenumăratul nu se atinge. Aruncă dacă `valideazaInventar` refuză (fără
  motiv, cifră negativă, același articol de două ori, nimic numărat).
- `valideazaInventar(inv)`, `rezumatInventar(miscari, inv, ajustari)`,
  `inAplicatie(miscari, depozit, cheie)`, `MOTIVE_INVENTAR`.
- Pornirea: `intrareDePornire(p, miscari, id, data)`, `valideazaPornire`,
  `ultimulPretCumparat`, `estePornire`, `MOTIV_PORNIRE`, `LOCURI_PORNIRE`.

Pe server ambele rute recalculează din mișcările din bază: inventarul aduce
locul la ce s-a numărat chiar dacă un coleg a mutat ceva între timp; id-urile
vin din browser (unul pe linie numărată), deci retrimis nu dublează. În
browser, `treceStocDePornire` și `inregistreazaInventar` din `web/date.ts`.

Gata când (testat): pe central, stocul de pornire trecut fără inventar, apoi
inventarul numărat (cochilie 112 din 120, motiv „furat”; tabla la fel; elastomerul
nenumărat) → o ajustare de −8, soldul = numărat, elastomerul neatins; pe
TRANSAVIA, lanțul ISOLINE + transfer + consum + retur + inventar dă Excelul
cu rândul facturii ca în evidența firmei și „Sold pe material” = 85 ml, soldul
aplicației.

Verificat cu Playwright pe `build:server` (8808, baza `izorep_f8`) și pe
build-ul de Pages servit static: stoc de pornire (preț 8,92 și 9,72 €/m² din
evidență), inventar cu diferența pe loc și refuz fără motiv, transfer,
reîncărcare, drumul, Excelul descărcat și recitit; 390 / 768 / 1440 / 1920 px,
ambele teme, pe Depozit, Comenzi și Măsurători: zero derulare laterală, zero
erori.

## 11 octombrie 2026: Faza 7, închiderea șantierului și ce vede directorul

Pe ramura `faza-7`. **570 de teste** (13 noi: `tests/inchidere.test.ts`,
`tests/inchidere-server.test.ts`). Logica e pură, în `src/lucrari/inchidere.ts`
și `src/lucrari/rapoarte.ts`; marcajul în `web/inchidere-vizual.ts` și
`web/rapoarte-vizual.ts`.

| Ce | Cum | De unde |
|---|---|---|
| **Inventarul de închidere** (S45) | pe pagina șantierului, „Închide șantierul” (pliat): fiecare material din registru, „Numărat” (implicit cât e în registru) și „Unde pleacă”. Diferența dintre registru și numărat devine ajustare cu motivul „inventar la închidere” | S45: „la un sfârșit de șantier, șeful de lucrare” |
| **Destinațiile** (S4, S8, S43) | depozitul central, atelierul sau alt șantier deschis → transfer; „Înapoi la <furnizor>” (furnizorii care l-au adus pe șantier) → retur fără depozit de sosire, cu prețul de pe șantier, deci iese cu minus în evidența cumpărărilor; pierdut / furat / reciclat → ajustare cu minus, cu motivul. Clientul nu e destinație | S4: „nu există posibilitatea de a da materialele rămase la client” |
| **Stoc zero** | se închide doar când pe șantier nu rămâne nimic (`stocZero`); a doua apăsare confirmă. Închis, nu mai primește situații sau mișcări (trigger, migrarea 0012), iar ecranul nu mai oferă „Situație nouă” | planul Fazei 7 |
| **Aviz fără factură** | oprește închiderea: prețul lui ar lipsi din cost, iar după închidere factura n-ar mai avea unde intra | decis aici |
| **Costul față de ofertă** | pe fiecare material, costul pe unitate pe șantier = media a ce a venit: intrarea cu prețul ei, transferul cu media intrărilor făcute pentru șantier, altfel prețul mediu al firmei. Costul = (venit − plecat înapoi) × costul pe unitate: pus, pierdut, reciclat. La închidere e un singur număr, lângă „În ofertă” (suma `valoareOferta` din necesar, ca în Depozit și stoc) și procentul | regula S44 din tabelul de decizii |
| **Ecranul șantierului** (S9) | cardul „Materialul șantierului”: necesar, comandat (comenzi trimise), venit, pus (consumul), rămas, lipsește (materialul pozițiilor neexecutate, după ultima situație, cu pierderea la croit, minus ce e pe șantier și pe drum) și costul până acum | S9: „toate din exemple” |
| **Tabloul** (S49) | „Ultimele 7 zile pe șantiere” (situații, material venit, comenzi trimise, închideri), „Șantiere închise” (cost, în ofertă, procent), iar la „Necesită atenția ta”: lipsa pe șantier (doar când necesarul e adus sau comandat tot, ca să nu repete „de comandat”) și comenzile trimise de 7 zile și nevenite | S49: „toate”. Pragul de 7 zile: comanda TRANSAVIA a venit în 4 (13 → 17 iulie) |

**Legate la unirea fazelor 6–8 (12 octombrie 2026).** Alerta „pierdere peste
10 %” vine din `consumSantier` (Faza 6), prin `pierderiPestePrag` din
`src/lucrari/rapoarte.ts`, doar pe șantierele deschise; textul e cel al Fazei 6
(„s-a consumat cu N % mai mult material decât arată situațiile”). Diferența de
la inventarul de închidere o scrie `ajustariInventar` din `src/stoc/inventar.ts`
(Faza 8), cu `lucrareId` pe șantier; inventarul rotunjește acum la miime, ca
`miscare.cantitate`: la sutime, un rest de 10,125 lăsa 0,005 pe șantier și
oprea închiderea. „Pus” sunt mișcările `consum`, scrise de Faza 6 din situații.
Formularele (Mișcare nouă, Inventar, Atelier, necesarul, recepția și returul din
Comenzi, Măsurători) nu mai oferă șantierele închise (`deschis()` din
`web/ecrane/stoc.ts`); listele care doar arată le păstrează. Pe linkul demo nu
există trigger-ul din bază: acolo oprirea e doar în formulare.

**Testul „gata când”** (`tests/inchidere.test.ts`): pe cererea TRANSAVIA
(planul și necesarul din import, cu discountul de 3 %), fiecare material adus
cu 10 % peste necesar (unul din trei prin central, la prețul mediu), pus cât
cere necesarul, apoi închis cu toate destinațiile și o lipsă la inventar: stoc
zero, nimic fără preț, costul egal cu cel socotit separat, procentul față de
„În ofertă”. Pe server (`tests/inchidere-server.test.ts`): aceleași mișcări cu
id-urile browserului, retrimis nu dublează, numărătoarea veche e refuzată, iar
după închidere situația, mișcarea, schimbarea planului și ștergerea primesc 409,
și direct în bază trigger-ul le oprește.

Verificat cu Playwright pe `build:server` (baza `izorep_f7`, portul 8807): două
șantiere din TRANSAVIA, cu intrări, consum, situații și o comandă veche;
închiderea TRANSAVIA din ecran (furnizor, alt șantier, reciclat, furat, o
lipsă de 1 m²) → 14.627,99 €, 15,9 % din 91.737,81 €, la fel după reîncărcare și
pe tablou; mișcările din bază sunt cele din ecran. Pe linkul demo (build-ul de
Pages, servit static, datele în browser) același drum. 390 / 768 / 1440 /
1920 px, ambele teme: zero derulare laterală, zero erori (pe demo, doar 404-ul
așteptat al `/api/stare`). Pe telefon, alegerea destinației ieșea din rând
(`min-width` al select-urilor din tabele): reparat.

## 11 octombrie 2026 (noaptea): Faza 5, locurile, atelierul, transferurile

Pe ramura `faza-5`. **557 de teste.** Totul în ecranul „Depozit și stoc”, trei
carduri noi în stilul celor de acolo, fără altă așezare.

| Ce | Cum | Unde |
|---|---|---|
| **Locurile** (S33, S34) | centralul, „Atelier București”, apoi șantierele; fiecare cu firma (centralul și atelierul: RADOIA, ca în seed; șantierul: firma ofertei) și responsabilul, scris în tabel (pe server în `depozit.responsabil`, `PUT /api/depozite/:id`; centralul și atelierul se fac la nevoie) | `locuri()` în `src/stoc/locuri.ts`, cardul „Locurile” |
| **Atelierul** (S36, răspunsul 4) | „Trimite material la atelier”: pentru ce șantier, ce a cerut șeful de șantier („10 ml ø100, 3 coturi, 10 carcase”), cât, din ce depozit. E un transfer în atelier cu `lucrareId` = șantierul, deci nimic nou în registru sau în bază. În atelier tabla stă „pusă deoparte” pe șantier, separat de cea liberă; „Trimite pe șantier” o mută cu tot cu cererea în notă. Tabla rămâne în m² (decizia „Atelierul”) | `inAtelier()`, cardul „Atelierul” |
| **Șantier → șantier** (S37) | transferul exista; „Mișcare nouă” are acum și atelierul | — |
| **Între firme** (S46) | un transfer între depozitele a două firme e spus în formular înainte de înregistrare și marcat „între firme” în jurnal și în drum | `intreFirme()` |
| **Drumul materialului** (gata când) | material + șantier → furnizor → central → atelier → șantier, pe toate mărcile | `drumul()`, cardul „Drumul materialului” |

Verificat cu Playwright pe build-ul de Pages, servit static (fără `/api`):
tabla de 0,8 intră în central de la ISOLINE, 12 m² trec în atelier pentru
TRANSAVIA cu cererea șefului de șantier, pleacă pe șantier, iar drumul arată
cei trei pași; transferul TRANSAVIA → Hala ISORAD e semnalat; responsabilul
rămâne după reîncărcare; 390–1920 px, ambele teme, zero derulare, zero erori.

**Atenție la verificare:** `vite preview` moștenește proxy-ul din
`vite.config.ts`, deci cu `npm start` pornit scrie în baza locală. Azi au ajuns
acolo date de test (importuri, ofertele RAD285 / RAD286 / RAD1, mișcări de tablă,
șantierul TRANSAVIA redenumit „Hala ISORAD”). Baza locală avea oricum doar date
de test din 11 octombrie; `npm run db:reset` o golește.

## 11 octombrie 2026 (seara): exportul într-un singur fel

Decis de Andrei: **ecranul de import rămâne cum era**, cu foaia clientului ca
în Excel și cei trei pași. Ce trebuie uniformizat e **exportul**: oricum vine
cererea, oferta descărcată are aceeași structură. Ecranul nou din planul de
import (doi pași, oferta pe carduri, panou în dreapta, „Adaugă poziție”) a fost
făcut și scos (revert pe `import-sablon`). Au rămas pașii 0 și 1:

| Ce | Unde |
|---|---|
| **Oferta ca date**: capitolele din foile și secțiunile clientului (fără antetul documentului), numerotarea pe pozițiile „Gata” (aceeași cu planul de șantier), codul clientului (din text sau din prima celulă), specificația noastră doar unde textul nu spune tot ce s-a tarifat, golul la foc, totalul cu ajustare, adaos și discount | `web/document-oferta.ts` |
| **Excelul într-un singur fel**: foaia „Ofertă” cu Nr., Cod (doar cu coduri), Denumire, UM, Cantitate, golul (doar la foc), P.U., Valoare; capitole cu subtotal, specificația cu roșu, nota firmei, semnătura. Proveniența și pozițiile rămase afară, pe foaia „Pentru noi” | `web/registru-oferta.ts`, folosit de „Descarcă oferta” |

Dovada (`tests/document-oferta.test.ts`): cererea TRANSAVIA dă Oferta 284 rând
cu rând, iar specificația e exact textul roșu al firmei pe cele 24 de casete;
Matari dă capitolele EI30–EI180 și 12.692,04; NISAL, două capitole și codul pe
fiecare rând; pe toate cele 12 fișiere documentul, registrul și planul de
șantier au aceleași poziții și total. **549 de teste.**

## 11 octombrie 2026 (după-amiază): Faza 4 terminată, izolația pe foaie

Ce rămăsese din Faza 4 și „izolația pe foaie” pentru CET. **540 de teste.**

| Ce | Cum | Unde |
|---|---|---|
| **Prețul pe ciornă** | cel mai nou preț al furnizorului ales: o factură trecută în aplicație, altfel `data/preturi-furnizori.json` (lista K-Flex ST de la Banda Tech, 24.06.2026, în €/ml, și ultima factură din evidență pe furnizor și articol, din 2025, în lei cu cursul ei; 202 articole). Pe ciornă: preț fără TVA pe unitatea documentului (kg la tablă), cu sursa sub el, și valoarea așteptată pe monedă. Alt furnizor ales → prețurile propuse se iau de la el; cele scrise de mână rămân. Fără preț la cel ales: hint cu cine l-a vândut („STEELMET Romania: 23,63 lei”) | `src/stoc/preturi-furnizori.ts`, `npm run preturi-furnizori` |
| **Avizul citit din poză sau PDF** (S31) | modelul pozelor (`gpt-5.5-2026-04-23`) transcrie antetul și liniile; `receptieDinCitire` le pune pe liniile comenzii după articol (`articolDinDenumire`, ca la evidență); omul vede formularul completat și înregistrează el. Rândurile care nu sunt pe comandă sau au altă UM apar separat. Fișierul rămâne atașat la comandă (doar pe server), cu link pe card. Pe avizul și factura reale ISOLINE: 4 s și 3 s, totul exact (`tests/fixtures-aviz-isoline.json`) | `src/stoc/aviz.ts`, `aviz-model.ts`, `POST /api/aviz`, `POST /api/comenzi/:id/documente`, `GET /api/documente/:id` |
| **Returul la furnizor** (S32) | o mișcare `retur` fără depozit de sosire, cu furnizorul și linia comenzii (`laFurnizor`). Primitul pe comandă rămâne; scade „adus pe șantier”, deci materialul de înlocuit reapare la „Rămas de comandat”. Cu prețul mediu al liniei; în evidență iese cu minus | `returLaFurnizor` în `comenzi.ts`, `POST /api/comenzi/:id/retururi` |
| **Comanda din măsurători** (S2) | Măsurători → „Pentru comanda de material”: rândurile din carnet trec prin import și prin `necesarDinLinii` (aceleași pierderi și praguri ca necesarul șantierului), apoi se scade ce e **acum** pe șantier (sold, nu „adus”: ce s-a pus pe țeavă nu mai e acolo) și ce e comandat nesosit; restul, la ambalaj, devine ciornă pe furnizor, cu preț | `src/stoc/din-masuratori.ts`, `deComandatSantier(..., "sold")` |
| **Izolația pe foaie** (CET) | un fișier fără nicio poziție, dar cu liste de țevi (antet cu descriere, DN, cantitate, UM), deschide un pas nou: pe fiecare foaie omul alege izolația (vată / elastomer / fără), grosimea (tabelul de protecție la atingere din specificație, DIN 4140 D.2 la o temperatură, D.4 la rece, sau fixă), protecția și dacă intră piesele și armăturile. Codul citește țevile, coturile, teurile, reducțiile, flanșele și robineții (șuruburile, suporții și aparatele nu) și le scrie ca rândurile din carnet, prin același import | `src/import/izolatie-foaie.ts`, `web/import/izolatie-vizual.ts` |

Pe CET, cu OMS pe vată + tablă la atingere și PWS pe elastomer la rece: **20 de
poziții, toate „Gata”, 32.999,59 €** (`tests/izolatie-foaie.test.ts`). Grosimea
din tabel urcă la următoarea din listă (14 → 19 mm la elastomer). Coturile,
teurile și reducțiile fără protecție sub ø60 nu se pun separat: lista n-are
coeficient pe banda 18–60, deci intră în prețul pe metru (regula 4, confirmată
de firmă). Ce rămâne fără preț pe CET, cu alte alegeri, e real: grosimi care nu
se oferă la acel diametru (vată 80 mm la ø60) și robinetul de PE ø63, unde
rândul 64 al listei nu cade în nicio bandă de multiplicatori.

**Bug reparat pe drum:** o grosime scrisă peste listă („vată minerală 110 mm”)
nu era citită, iar grosimea se lua de la conducta de același diametru (100 mm),
cu poziția „Gata”. Acum se citește (`grosimeScrisa` prinde grosimea lipită de
material) și iese „De verificat”, cu motivul nou `grosime_peste_lista` (nu e în
`MOTIVE_DOVEDITE`: peste listă înseamnă două straturi sau alt material). A/B pe
toate fișierele de client, pe ambele segmente: niciun număr schimbat.

Migrarea 0009: `document_furnizor` (doar se adaugă), returul legat de comandă
(`miscare_comanda_chk`, `miscare_retur_chk`), scopul `comanda` la măsurători.

Verificat cu Playwright pe `build:server`, cu modelul real doar pe aviz și
factură: CET (pasul nou, 20 „Gata”), TRANSAVIA → șantier cu ø114/140/168 ca tub
→ ciornele cu prețuri → trimisă → avizul PDF citit și recepționat (350 ml pe
ø140) → factura PDF citită (39,7719 lei, curs 5,31) → cele două PDF-uri atașate
și deschise → retur 6 ml → evidența descărcată; Măsurători „Pentru comandă” cu
pozele simulate → ciornă Banda Tech doar cu tabla etapei (cochiliile erau deja
comandate). Linkul demo: CET și recepția merg, fără zona de document. 390 și
1440 px: zero derulare laterală, zero erori.

## 11 octombrie 2026: hârtiile firmei, pasul 0 și Faza 4

Adrian a adus de la firmă (5 octombrie) 8 emailuri; atașamentele sunt în
`../attachments/` (`achizitii/` nou și două cereri în `clienti/`), descrise în
`../attachments/README.md`. Ce a ieșit din ele:

**Importul, pe cele două cereri noi** (`tests/cereri-octombrie.test.ts`). SRU
Craiova ieșea 9,6 mil. €, cu 3 poziții greșite „Gata”:

| Problemă | Acum |
|---|---|
| „Tubulatura rectangulara din tabla zincata … elastomer 13 mm” primea și jacheta (80,06 €/m² în loc de 20,55) | `TABLA_E_TUBULATURA` acceptă adjectivul dintre tubulatură și „din tablă” |
| „… fara izolatie”, „neizolata” ieșeau tablă la 59,51 €/m² (45.643 m²) | `FARA_IZOLATIE`: nu e poziție |
| 45 de rânduri „Teava … izolatie elastomerica 19mm … grunduire etc” respinse ca altă meserie | „grunduire” respinge doar fără material de izolație numit (`GRUNDUIRE`); aparatele de aer condiționat din Book15 rămân respinse |
| „idem DN20” (9 caractere) nu era rând deloc | un marcaj de continuare cu UM și cantitate e poziție (`rand.ts`) |
| Cantitatea: prima din „Cantitate · Cantitate AT · CANTITATE TOTALA” | `aplicaCantitateDinAntet` (`mapare.ts`): pe foile fără mapare, coloana de cantitate din antet, „total” dacă sunt mai multe; totalul gol = suma celorlalte, doar dacă așa e pe toată foaia; un 0 scris rămâne 0 |
| CET Constanța: fitinguri și aparate de inox / PVC ieșeau jachetă, cu prețul (5 lei) drept cantitate | materialul țevii fără niciun cuvânt de izolație sau jachetă nu e poziție; coloana QTY. dă cantitatea |

A/B pe cele 10 fișiere vechi: niciun preț mișcat; o poziție nouă la Book15
(r164, distribuitorul-colector izolat, „De verificat”). SRU: 48 de poziții, 0
fără preț. **CET rămâne 0 poziții**: e lista de țevi a instalatorului, iar
izolația vine din specificație pe sistem, cu grosimea după temperatură (clasele
din PDF). Îi trebuie „izolația pe foaie”, aleasă de om — nefăcută.

**Evidența de achiziții** (2017–2026, ambele firme) a dat dovezile pentru:

| Ce | Dovada | În cod |
|---|---|---|
| Formele articolului: tub, saltea, placă, tablă | 2024–2026: LM ECO ALU M (saltea lamelară) 36.851 m², cel mai cumpărat; plăcile de vată sunt Conlit/Techrock, la foc | `Categorie` în `necesar.ts`; forma intră în cheia articolului (`sistem|forma|grosime|ø`) |
| Pragul de 3 țoli rămâne implicit | 93 % din metrii de cochilie și 99,9 % din tubul de elastomer sunt ≤ ø89 | `PRAG_TUB_MM` neschimbat |
| Peste prag, tub pe diametrul ales | TRANSAVIA: cochilii ø116 / 140 / 168 (iul.–sep. 2026) | `tuburiPeste`; pastilele „Peste prag, comandă tot tuburi la” din cardul „Materiale de comandat” |
| Ambalajele | tub elastomer 2 m (96 %), cochilie 1 m, placă elastomer 2 m² (97 %), saltea pe rolă după grosime (20 → 10 m² … 100 → 2,5 m²) | `src/stoc/ambalaje.ts`, folosite când omul n-a scris alt ambalaj |
| Euro = lei / cursul de pe document, fără marjă | 3.191 din 3.191 de rânduri 2025–2026 | `comenzi.ts`; înlocuiește decizia „BNR + 2 %” |
| Furnizorul propus | Isoline 239 rânduri la cochilii; Banda Tech la elastomer, saltele, foc; Direct Line la inox | `furnizorPropus` |

Necesarul TRANSAVIA față de ce s-a cumpărat (fără pierderi): ø140 641 ml
calculat / 635 cumpărat, ø114 193 / 200, ø168 161 / 200, ø89 97 / 140; sub 3 țoli
s-a cumpărat mult mai puțin decât metrii din ofertă (ø22: 60 față de 136 ml fără
piese), deci restul a venit din stoc. **Regula pieselor sub 3 țoli rămâne
nelămurită**: datele nu o pot dovedi.

Articolele și ambalajele salvate înainte (cheie fără formă) se citesc mai
departe: forma se deduce (`formaImplicita`), ambalajul se găsește și pe cheia
veche. Migrarea 0007 adaugă `articol.forma`.

**Faza 4, comanda și recepția** (`src/stoc/comenzi.ts`, `tests/comenzi.test.ts`):

- **Rămas de comandat** = necesar − adus pe șantier − comandat nesosit.
  Centralul și surplusul altor șantiere apar ca propunere de transfer („Mută …
  pe șantier”), nu se mai scad din fiecare șantier: problema 2 din audit.
- „Fă comenzile” face ciornele, una pe furnizor, la ambalaj întreg. Ecranul nou
  **Comenzi**: ciornă (cantități, furnizor, notă), „Trimite comanda” (o
  îngheață; textul de email după comanda reală TRANSAVIA și Excelul), recepția
  pe aviz sau factură, „Trece factura” pe un aviz fără preț, anularea. Comanda
  nouă de mână, pe un șantier, cere motivul (S28).
- **Recepția e intrarea în stoc**: miscarea poartă comanda, linia, documentul și
  furnizorul; primitul se socotește din miscări. Factura venită după aviz face
  storno pe intrările avizului și le scrie din nou, cu preț (lanțul real
  ISOLINE: aviz CS 20261262 → factura CS 202627295, 39,7719 lei / 5,31 = 7,49 €,
  13.920,17 lei fără TVA, ca în evidența firmei). Tabla vine la kg și intră în
  m². Transportul se împarte pe linii după valoare.
- **Evidența cumpărărilor** se descarcă cu coloanele Excelului firmei
  (Faza 8.4, adusă înainte): rândul facturii de mai sus iese ca în evidența lor.
- Pe server, operații proprii (`/api/comenzi/...`), nu diferențe de stare;
  trimisă, comanda nu se schimbă nici direct în bază (trigger, migrarea 0008).
  Serverul recalculează intrările din comanda lui, cu id-urile browserului, deci
  o recepție trimisă de două ori nu se dublează.

Verificat cu Playwright pe `build:server` (TRANSAVIA: import, ø114/140/168 ca
tub, șantier, „Fă comenzile”, trimite, aviz, factură, evidența) și pe linkul
demo (datele în browser, după reîncărcare); 390 / 768 / 1440 / 1920 px, ambele
teme: zero derulare laterală, zero erori. **494 de teste.**

Rămas din Faza 4 atunci: comanda din măsurători, avizul din poză, prețurile pe
ciornă și returul — făcute în aceeași zi, mai sus.

## 10 octombrie 2026: „De verificat” doar unde chiar trebuie; fără intrare

Cerut de Andrei: scopul e să nu verifice omul linie cu linie. Pe cele 10
cereri, rezidențial: **138 → 77 „De verificat”** (494 → 555 „Gata”, 0 fără
preț). Regula: o poziție merge la „De verificat” doar dacă are un motiv
**nedovedit** (`MOTIVE_DOVEDITE` în `nucleu.ts`, fiecare cu dovada lângă el):

| Dovedit, deci „Gata” | Dovada |
|---|---|
| celula dedusă din rândul următor | Oferta 284, exact |
| echipamentul (suprafață × mp × 2,47) | Oferta 284, distribuitorul exact |
| grosimea propusă (tabelul firmei, conducta de același ø) | răspunsul firmei 11 sep; casetele 284, 24 / 24 |
| grosimea cea mai apropiată, jacheta cea mai apropiată | 20 → 19 la elastomer, 3 / 3 semnate |
| tabla pe mp din lista celuilalt segment | 0,8 e identic în ambele liste |
| seria de cupru | registrul de conversie al firmei |
| inoxul din singura listă de inox | vezi mai jos |

Rămân „De verificat”, verificat pe ofertele semnate, nu presupus:
protecția la foc (firma: Conlit / Techrock, preț pus de mână, 32), formula
peste listă (iese cu 0,13 € sub SPIRO ø250 / ø315 și PEHD D250 din NISAL),
golul luat de la aceeași țeavă (Matari r72–83: EI180 fără dimensiuni, lăsate
**fără preț** în oferta semnată), bucăți fără piesă numită, grosime-interval,
extrapolări, livrarea țevii NISAL (contrazice semnatul), banda pe armături.

Garanția are test (`oferte-semnate.test.ts`): pe Oferta 284, NISAL și Matari,
fiecare poziție „Gata” are exact prețul semnat; excepțiile sunt doar cele 4
unde semnatul s-a abătut de la regula spusă de firmă (ø90 / ø160, rândul de
sus). Pus „peste_lista” printre cele dovedite, testul pică. TRANSAVIA iese
acum **99 / 99 „Gata”, 94.575,06 €, fără niciun clic**; Matari 53 „Gata” =
12.692,04 € exact.

**Fără intrare.** Cerut de Andrei: încă nu e nevoie de conturi. Serverul
servește singura firmă din bază, ascultă doar pe 127.0.0.1, iar pagina se
deschide direct. Scoase: `intrare.ts`, `email.ts`, `om.ts`, Mailpit,
`nodemailer`. Tabelele de conturi rămân în bază, nefolosite. Verificat cu
Playwright pe `build:server`: TRANSAVIA, descărcată pe A, văzută pe B; scenariul
cu refuzul; zero derulare la 390–1920 px; serverul nu răspunde din rețea.

## 10 octombrie 2026: Transavia inox, 72 de verificat → 19

Toate cele 72 de poziții ieșeau „De verificat” pe rezidențial, cu „Preț din
lista celuilalt tip de ofertă”: inoxul are o singură listă la firmă (fișierul
industrial), deci orice strat de inox pe o ofertă rezidențială era marcat.
Decizia din 7 septembrie spunea „notă, nu marcaj”; din Faza 1 devenise
marcaj. Acum inoxul e în `LISTA_UNICA`: nota rămâne, marcajul nu. Rămân 19, fiecare
cu motivul lui: 11 casete fără grosime (luată de la conductă, `grosime_propusa`),
3 ø22 × 40 mm (celulă dedusă, ca în Oferta 284), 3 capace în bucăți
(`um_bucata`), 2 „g48” (grosime care nu e în listă). În browser: 53 Gata, 19 De
verificat, 0 fără preț. Testele: `inox.test.ts`, `fara-pret.test.ts`. Oferta
semnată pe Transavia inox n-a venit încă (exemplul 3): când vine, devine test
linie cu linie și lămurește și cele 19.

## 10 octombrie 2026: modelul pe server

`/api/extrage` și `/api/poza` au trecut din pluginul lui `vite dev` (șters) în
server (`src/server/model.ts`). Până acum, pe serverul adevărat
importul mergea doar pe reguli și Măsurătorile din poze deloc. În dev, vite
trimite tot `/api` la server, deci dev și producția au același drum. Teste
(`server.test.ts`, cu model fals): fără cont 401, fără `X-Izorep` 403, plafon
400 de linii, răspuns stricat 502, fără cheie „indisponibil”. Verificat cu
Playwright pe `build:server`, cu OpenAI real: Transavia inox — modelul pe linia
reziduală, 72 de poziții, 0 fără preț; `santier1.jpeg` citită în 42 s, rândurile
la verificat. **437 de teste.** Pagina pe Pages: neschimbată (TRANSAVIA 99,
14 de verificat, 0 fără preț).

## 10 octombrie 2026: auditul Fazei 3, reparații

Audit pe tot ce s-a făcut (Fazele 1–3). Reparat pe `faza-3`, fiecare cu test:

| Ce | Cum |
|---|---|
| **Situația unui coleg se ștergea pe tăcute** | A și B scriu situația 3; a lui A e refuzată, copia se reia de pe server, dar ecranul Lucrări ținea lista veche (`let planuri`). La următoarea scriere a lui A, situația lui B lipsea din listă → `DELETE`. La fel pe Depozit, cu necesarurile și ambalajele. Acum, după refuz, ecranul se redesenează (`laReimprospatare` în `web/date.ts`, legat în `main.ts`), iar până atunci scrierile nu pleacă. Situația se șterge cu id-ul ei (`?id=`): una ștearsă și scrisă din nou de altcineva nu mai pleacă. Reprodus în `date-web.test.ts` și verificat cu Playwright, două browsere, pe build-ul de server |
| `/api/date` aducea liniile tuturor versiunilor de ofertă la fiecare ecran | doar sumarul (`ultimeleOferte`) |
| Fără plafon pe cereri | 5 MB implicit; 25 MB cererea cu fișierul, 15 MB măsurătoarea cu poza, 100 MB mutarea (`LIMITE` în `app.ts`), altfel 413 |
| Linkuri pe email fără limită | cel mult 5 pe om în 15 minute; peste, același răspuns, fără email |
| Build-ul pentru server | `npm run build:server` (`VITE_BASE=/`, `VITE_DATE=server`); `build:web` rămâne pentru Pages. Serverul refuză să servească un `dist-web` construit pentru Pages |

**432 de teste.** Verificat după reparații, față de răspunsurile firmei și
exemple: regulile din `docs/intrebari-firma.md` aplicate direct pe cod (inox
0,4; aluminiu 0,8 unde rândul are mai multe grosimi, altfel cea din listă;
rândul de sus la ø90 / ø160; piese 3 / 2 / 1 pe metru; exemplul ø114 + vată 30
= 0,55 m²/ml; pierderi 10 / 10 / 0 %; tabla în kg; rotunjirea la ambalaj),
cei 13 furnizori din S25, listele regenerate din fișierele firmei identice cu
`data/price-lists/`. Cap-coadă cu Playwright, pe `build:server`, fără model:
TRANSAVIA 99 / 99, după „Confirmă toate” 94.575,06 € pe ecran, în `.xlsx` și
pe server; deschisă pe al doilea browser la aceeași valoare; stocul văzut de
amândoi; zero derulare laterală la 390–1920 px.

Rămase din audit, pentru mai târziu:

- Cererea și necesarul se salvează „ultimul câștigă”: doi oameni pe același import se suprascriu.
- Faza 4 și mai departe: rute proprii, cu operații explicite (adaugă, anulează), nu diferența de stare din `date.ts` — de acolo a venit bugul de mai sus. Faza 6: consumul scris la situație trebuie stornat când se șterge situația.
- Numărul ofertei nu îl dă serverul; fără jurnal „cine a schimbat ce”.
- `main` e în urmă cu Fazele 1–3: linkul de pe Pages arată varianta de dinainte de Faza 1, iar CI-ul (doar pe `main`) n-a rulat pe ele.

## 9 octombrie 2026: Faza 3, datele comune

Datele nu mai stau în browser: server mic peste baza din `src/db/`, cu intrare
prin link pe email. Ramura `faza-3` (peste `faza-1-2`), fără push. Decis cu
Andrei: oferta se salvează la „Descarcă oferta”; linkul de pe Pages rămâne demo
în browser; conturile le adăugăm noi, cu o comandă.

| Ce | Cum |
|---|---|
| Serverul | `src/server/` (Hono): `app.ts` rutele, `intrare.ts` linkul și sesiunea, `repo.ts` tabelele, `contract.ts` formele de pe fir. `npm run server` (8787); `vite dev` îi trimite `/api/*`, în afară de rutele modelului |
| Intrarea | emailul → link `#/intrare/<token>`, 15 minute, o dată; pagina îl trimite cu POST (scanerele de email nu-l consumă); cookie `httpOnly`, `SameSite=Lax`, 30 de zile. În bază doar hash-uri. Local, emailurile stau în Mailpit (http://localhost:8025) |
| Fără tenant la intrare | politici RLS „după cheie”: emailul scris (`app.email_cautat`), hash-ul tokenului sau al cookie-ului (`app.hash_cautat`), prin `cuCheie`. Fără `SECURITY DEFINER` |
| CSRF | orice schimbare cere antetul `X-Izorep: 1` |
| Tabelele | migrarea 0005 (din schemă) și 0006 (scrisă de mână: `FORCE`, verificări, trigger-e). Id-urile sunt cele din browser, text: mutarea nu traduce nimic |
| Ce nu se schimbă | oferta, mișcarea, măsurătoarea, anexa: fără UPDATE și DELETE. Situația: se șterge doar ultima. Planul șantierului: înghețat la prima situație |
| Ștergerea unui tenant | doar ca proprietar, cu `app.purjare` (`purjeazaTenant`): testele și `db:reset`. `db:seed` nu mai șterge tenantul, doar completează și reface listele |
| Oferta | la „Descarcă oferta”: întâi se salvează importul și versiunea nouă (`CerereOferta` întreagă), apoi descărcarea. Valoarea o socotește serverul (`valoareOferta` în `web/oferta.ts`) |
| Browserul | `web/date.ts`: ecranele citesc sincron dintr-o copie luată la fiecare schimbare de ecran; o scriere trimite doar diferența, în ordine; refuzată → mesaj sus și copia de pe server |
| Pages | `/api/eu` lipsește → datele rămân în browser, ca înainte (`VITE_DATE=server` la build impune serverul) |
| Mutarea | cardul „Datele din acest browser” → `POST /api/mutare`; ce există deja nu se dublează; datele de exemplu nu pleacă; ofertele vechi intră „mutate”, cu sumarul (browserul nu ținea liniile) |
| Măsurătorile | paginile verificate, cu poza, se păstrează la „Trimite la ofertă” / „Pune în situație”. Nu există încă ecran care să le arate |
| Furnizorii | cei 13 din S25, din seed. Ecranul vine în Faza 4 |

**Bug găsit pe drum, din Faza 1:** „Confirmă toate cele 14” scotea prețul
distribuitorului. Linia confirmată (`sursa: "om"`) se tarifa fără textul
rândului, iar echipamentul își ia D și L din text: TRANSAVIA confirmată dădea
92.278,36 €. Acum regulile care spun ce lucrare e rândul (echipament, protecția
la foc a tubulaturii, livrarea de țeavă) primesc mereu textul (`textLucrare`).
Forma și straturile rămân ale omului. Test în `oferte-semnate.test.ts`.

Verificat cu Playwright, două browsere separate: intrare prin Mailpit,
TRANSAVIA importată, confirmată, descărcată pe A (94.575,06 €), deschisă pe B
din „Cereri și oferte” (94.575,06 € la pasul „Oferta”), șantierul vizibil pe B,
intrare de stoc pe B vizibilă pe A; mutarea din browser; demo-ul static fără
server. 390 / 768 / 1440 / 1920 px, ambele teme: zero derulare. **429 de teste**
(noi: `server.test.ts` pe Postgres, `date-web.test.ts`).

Rămâne pentru producție: SMTP-ul (`SMTP_URL`), unde stă serverul, plafon pe
mărimea cererilor, backup. Rulare locală: `npm start` (bază, Mailpit, server,
vite), apoi `npm run om -- <email> "<nume>"`.

## 9 octombrie 2026: Faza 2, lista de materiale

Planul din `docs/plan-implementare.md`, Faza 2, făcut. Necesarul
(`src/stoc/necesar.ts`) și stocul (`src/stoc/registru.ts`):

| Ce | Cum | De unde |
|---|---|---|
| Piesele (cot, teu, flanșă, casetă, reducție) | trecute în metri de țeavă: 3 / 2 / 1 pe metru, apoi tub sau m²; nu mai există „+ N buc., de stabilit” | firma: echivalența doar în ofertă; sub 3 țoli și peste ø273 presupus, marcat |
| Pierderi la croit | pe categorie: tablă 10 %, plăci 10 %, tuburi 0; se schimbă din cardul „Materiale de comandat” | S15, S16; rezerva peste calcul a ieșit (S21, „să nu rămână marfă”) |
| Tub sau placă | pragul se alege: 3 țoli implicit, până la „toate în tuburi” | S12 |
| Tabla | și în kg (densitate × grosime: aluminiu 2,70, inox 7,93) | S13 |
| Necesarul pe poziție | `pePozitie`: material pe unitatea fiecărei poziții din plan | baza consumului din situații (Faza 6) |
| Marca | pe articolul din stoc (intrare), nu pe necesar; „De comandat” adună toate mărcile; costul e media pe mărci | S11 |
| Ambalajul | pe material: unitate + conținut; comanda se rotunjește în sus, restul rămâne în depozit | S13, S14; listele furnizorilor le completează |
| Material adăugat de mână | pe necesar, cu motivul (goluri la foc, distribuitor) | S19, S20 |
| Materialul clientului | marcat pe rând: nu se comandă, valoare zero | S38 |

Necesarurile vechi din browser (cu `bucati` și `adaos`) se citesc mai departe:
piesele lor apar ca zero. Verificat cu Playwright pe TRANSAVIA, de la import
la „Depozit și stoc” (prag 4 țoli, plăci 5 %, ambalaj, client, material de
mână, intrare cu marcă), 390 / 768 / 1440 / 1920 px, ambele teme: zero
derulare, zero erori — după ce a prins o redesenare dublă a cardului la
`change` (reparată, `redeseneazaNecesar`). **414 teste.**

## 8 octombrie 2026: răspunsurile de la întâlnire, nicio poziție fără preț

Adrian a fost la firmă pe 5 octombrie; răspunsurile sunt în
`docs/intrebari-firma.md`, planul pe faze în `docs/plan-implementare.md`.
Regula cerută de Andrei: **nicio poziție dintr-o cerere de ofertă nu rămâne
fără preț** (în afară de rafinărie): listele sunt toate, restul se calculează
după regulile firmei, iar ce stă pe o singură dovadă iese cu preț, dar „De
verificat”. Nu întrebăm nimic în plus pe Adrian sau pe firmă.

Măsurat pe cele 10 fișiere de client, fără model: **115 poziții fără preț pe
rezidențial și 129 pe industrial → 0 și 0**. Cu model (spital, Book15, NISAL,
Transavia inox și abur, Flower City): 0. Cererea TRANSAVIA dă acum Oferta 284
**99 / 99**, cu tot cu distribuitorul, iar după „Confirmă toate” totalul e
94.575,06 € fără niciun preț pus de mână.

| Ce era fără preț | Regula | De unde |
|---|---|---|
| Inox fără grosime (72 Transavia inox) | 0,4 mm | firma |
| Aluminiu fără grosime, unde lista are mai multe | 0,8 mm | firma („7. la 0,8”), singura grosime pe mp rezidențială |
| ø90 / ø160 la 1 mm peste un rând | rândul de sus, nemarcat | firma; ofertele semnate care au coborât rămân abateri |
| Tablă „min 0,5 mm” | cea mai subțire din listă care o acoperă (0,6) | spitalul, marcat |
| Tablă 0,6 pe mp pe rezidențial | prețul pe mp din lista industrială | 0,8 e identic în ambele liste |
| Elastomer 40 mm pe mp | extrapolat din 25 și 32 mm | marcat |
| Grosime scrisă care nu e în listă („g48”) | cea mai apropiată (ca 20 → 19 la elastomer) | marcat |
| Grosime ca interval („20 to 50mm”) | capătul de sus | marcat |
| Casetă fără grosime, două conducte de același ø | grosimea mai mare | marcat |
| Casetă fără conductă de același ø | conducta cu ø cel mai apropiat | marcat |
| Fără grosime de nicăieri | grosimea uzuală a firmei, aplicată singură | marcat (ca butonul) |
| Celulă industrială lipsă | rezidențial × raportul median pe grosime | marcat |
| Protecția la foc a tubulaturii (spital, Book15, NISAL) | 48 €/m², pe ml × suprafața | Oferta 27.04.2026, EI60; mereu marcat |
| Torcretul de la spital (fără material pe rând) | recunoscut ca protecție la foc | dispărea din import |
| Livrare de țeavă cu izolația inclusă | doar izolația din liste | firma: izolația, nu țeava; marcat |
| Echipament (distribuitorul de abur) | suprafața × preț/mp × 2,47 | factorul din Oferta 284; marcat |
| Gol EI180 fără dimensiuni (Matari) | golul aceleiași țevi din fișier | marcat |
| Protecție cu tablă fără ø, UM buc | pe mp | marcat |
| Bandă autoadezivă pe armături | elastomer 9 mm, primul rând | marcat |
| Tubulatură flexibilă izolată, rezervor izolat (Book15) | nu se ofertează: vin izolate | firma („nu se face izolația pe țevile preizolate”) |
| Jachetă inventată de model („protejată cu folie”) | scoasă din preț | spitalul: 23,31 → 6,23 €/ml |

Codurile `protectie_foc_tubulatura` și `livrare_teava` au ieșit din
`CodNetarifare`: nu mai există drum spre ele. `echipament` rămâne doar fără D
și L pe rând. Teste: **401** (nou: `tests/fara-pret.test.ts`, care trece toate
fișierele de client pe ambele segmente). Golden files: doar prețurile
recalculate, răspunsurile modelului neatinse.

**9 octombrie 2026, Faza 1 închisă:** „Măsurători → Pentru ofertă” poate
compara rândurile din poze cu lista clientului (un import din istoric, refăcut
fără model prin `src/import/redeschide.ts`, același drum pe care îl folosește
acum și ecranul de import). Comparația e în `src/lucrari/comparatie.ts`, pe
amprenta de la situații; detalii în `ui.md`. **406 teste.** SPIRO peste listă
rămâne „De verificat”:
ipoteza „grosime + 1 mm” nu dă 16,36 / 20,30, iar π întreg cu φ + 20 le dă,
dar strică DN250 / 19 mm, care iese exact cu 3,14.

## 2 octombrie 2026: audit, necesarul legat de ofertă

Munca din 29 septembrie era necommit-uită (linkul arăta versiunea de dinainte
de apel): intrată pe `main` în trei commit-uri, Pages la zi. Reparat apoi
necesarul: se calculează doar din pozițiile ofertei, „În ofertă” e cu
ajustarea și discountul, piesele fără regulă de material se văd în Depozit
(„+ N buc.”, „de stabilit”). Detalii în `ui.md`, „Depozit și stoc”.

Tot pe 2 octombrie: demo-ul din `docs/demo-firma.md` rulat cap-coadă pe link
(Playwright), toate cifrele ies; cheia OpenAI merge (pozele Ecoterm: 39 / 50
exacte, 47 s). Pozele din carnet vin în două momente (Andrei): înainte de
ofertă și în timpul lucrării — logica de potrivire pe planul de șantier e în
`src/lucrari/potrivire.ts` (`santier.md`); ecranul: pagina „Șantier” devine
„Măsurători”, cu „Pentru ofertă” / „Pentru situație de lucrări” (`ui.md`).
Foaia pentru întâlnirea de luni, 5 octombrie: `docs/intrebari-firma.md`
(tipărită ca `../Intrebari RADOIA 5 octombrie.pdf`, cu loc de răspuns); ce
facem cu fiecare răspuns: `docs/dupa-intalnire.md`. **384 de teste.**

## Unde am rămas (29 septembrie 2026, după apelul cu firma)

Andrei a vorbit cu cineva de la firmă și a trimis notițele, plus trei poze
(`~/Downloads/preturi1–3.jpeg`): tabelul DN → ISO și notițele scrise de mână
din care fuseseră transcrise `tabel-conversie-tevi.docx` și regula „peste
listă”. Tot ce era în poze era deja în sistem; o singură corectură: bifele
firmei sunt pe **DN și ISO**, cu „?” pe Toli (docx-ul transcris spunea „Toli
și ISO”). Codul folosea deja DN → ISO.

**Fluxul firmei**, cum l-au spus: import cerere → verificarea prețurilor →
oferta la client → **șantierul din ofertă** (plan de șantier) → materialele
cumpărate / depozit / stoc pe șantier → **situații de lucrări, cu istoric**.

| Ce au spus | Ce s-a făcut |
|---|---|
| Până la 3 țoli se comandă tuburi (elastomer, cochilie), pe diametru și grosime | necesarul: tub pe ø și grosime, în ml, până la ø90 |
| Peste 3 țoli, plăci pe m²: (0,114 + 2 × 0,03) × 3,14 = 0,5463 → 0,55; × 100 m = 55 m² | `m2PeMetru` cu 3,14, rotunjit la 2 zecimale; plăcile pe grosime, fără ø; testul e exemplul lor |
| Coturi / teuri: 1 m = 3 la ø114–140, 2 la ø159–168, „119–123” 1 la 1 | `piesePeMetru`; „119–123” citit ca 219+ (de confirmat) |
| Lista include manopera; necesarul să nu lase marfă pe stoc | rezerva de 5–10 % nu mai e implicită (0) |
| Tehnicul poate crește tot cu 10 % | „Ajustare prețuri (%)” în pasul „Oferta”, pe fiecare preț unitar |
| Închiderile la foc pe industrial = rezidențial + 20 %, pe total | rând separat în ofertă; închiderile nu mai stau „De verificat” pe industrial |
| Șantierul se face din ofertă | „Creează șantierul” în pasul „Oferta”: plan (pozițiile ofertei, înghețate) + necesar pe depozitul șantierului |
| Situații de lucrări, cu istoric | ecranul Lucrări: situație nouă, cumulat, „Tot restul”, Excel, se șterge doar ultima |
| Depozitul = cantitate și valoare: cost de achiziție față de ofertă | preț de achiziție pe intrare, în euro; cost față de „în ofertă” pe fiecare necesar |
| Coturi „119–123 → 1 la 1” (Andrei a confirmat că așa s-a spus) | nicio țeavă nu are ø între 119 și 123 → citit 219–323, de confirmat (`tevi.md`) |

**De reținut, fără cod încă** (cerut de Andrei, 29 septembrie 2026):

- **Cursul: BNR + 1–2 %.** Firma pune la valoarea stocului „cursul valutar
  +1–2 % în euro”. Nu avem încă cursul în aplicație, deci prețul de achiziție
  se scrie direct în euro. Când vine cursul (facturare, etapa E), costul în lei
  trecut în euro primește marja asta (de aflat: 1 sau 2 %).
- **Rafinăria: momentan nu lucrăm pe ea.** Rămâne ca loc pregătit (tipul
  `Destinatie`, segmentul gol din „Liste de prețuri”), fără buton la import și
  fără întrebare către firmă acum. Se reia când vine lista.

Verificat: TRANSAVIA în browser dă 94.575,06 € (+10 % → 104.031,67 €);
șantierul cu discount 3 % = 91.737,81 €, adică Oferta 284, iar o situație cu tot
executat dă exact atât (test). Matari pe industrial: 15.230,45 € (12.692,04 +
2.538,41). Lucrări, Depozit, Tablou, pasul „Oferta”: 5 lățimi × 2 teme, zero
derulare. **377 de teste.** Detalii în `tevi.md` (materialul), `pricing.md`
(ajustarea, focul pe industrial), `ui.md` (ecranele).

## Mai devreme, 29 septembrie 2026

**Șantier: notițele din carnet** (detalii în `santier.md`). Decis cu Andrei: șantierul
nu folosește aplicația, scrie în carnet și trimite poze; aplicația nu va fi
PWA; o folosesc tehnicul și patronul, pe web; rolurile se stabilesc mai târziu.
Ecranul nou citește pozele cu modelul, omul confirmă pagină cu pagină lângă
poză, iar rândurile trec prin import ca o listă de client. Modelul pentru poze
e `gpt-5.5-2026-04-23`, snapshot datat, ales pe 4 × 4 rulări: 39–45 de rânduri
exacte din 50, față de 28 cu gpt-4.1. Referința e transcrisă de noi. **De cerut firmei:**
oferta Ecoterm făcută din cele 4 pagini și confirmarea notației (ROB, „preț
dublu”, „× 2”).

**Testele, curățate (29 septembrie 2026): 630 → 363.** Regula, cerută de
Andrei: rămân testele care păzesc banii (prețurile față de ofertele semnate,
nicio poziție greșită „Gata” pe tăcute, importul cap-coadă, registrul ofertei),
cheia OpenAI și izolarea datelor. Au plecat testele pe marcaj și texte de
ecran, pe preferințe din browser și pe detalii de formă: aplicația nu e gata,
iar aspectul se verifică în browser. Familiile „un test pe poziție” (Matari
53, Oferta 118 48, coduri de cauză, cot/teu Oferta 284, combinațiile Șantier)
sunt acum un test pe ofertă, care la eșec listează toate pozițiile greșite:
aceeași acoperire, alt număr.

## 28 septembrie 2026, seara

Produsul e pregătit pentru demo-ul lui Adrian la firmă: scenariul e în
`docs/demo-firma.md`, întrebările în `docs/intrebari-firma.md`. Totul e pe
`main` (**363 de teste**, build verde, publicat pe Pages).

- **Calculele de import, verificate linie cu linie** față de ofertele semnate,
  cu model și fără: TRANSAVIA 98 / 98 prețuri și 99 / 99 cantități, Oferta
  27.04.2026 48 exacte (cele 9 diferite, toate „De verificat”), Matari 53 / 53;
  DN → ø → rând exact pe 209 linii. Cu prețul pus de mână pe distribuitor,
  cererea TRANSAVIA dă **94.575,06 € = Oferta 284**, la ban.
- **Datele demo sunt cele din ofertele semnate** (erau dublate la 118 / 118.1),
  cu perechea TRANSAVIA și cu un test care le leagă de fișiere.
- **Depozit și stoc, prototip:** necesarul de materiale din oferta importată,
  registrul de mișcări, „de comandat”; datele stau în browser.
- **Două roluri provizorii: Birou și Contabilitate** (erau cinci; Șantierul,
  scos pe 29 septembrie: nu folosește aplicația). Amândouă văd tot; rolurile se
  stabilesc cu firma. `docs/productie.md` e rescris simplu: un link, cont pe
  email, Saga rămâne cum e, contabila importă un fișier.
- **Importul, trecut prin ochii omului de la birou:** fișier stricat / PDF /
  .xls primesc un mesaj în română cu ce să facă (nu eroarea JSZip în engleză);
  un Excel fără poziții se oprește la pasul 1 cu explicație; lângă „Descarcă
  oferta” scrie câte poziții lipsesc din ea.
- **Modelul rămâne `gpt-4.1-2025-04-14`.** Bugul din 28 septembrie era de
  arhitectură, nu de calitate; un model nou se alege abia când ofertele semnate
  pe spital / Book15 / Transavia inox dau răspunsul corect de comparat.

Detaliile fiecărei zile sunt în secțiunile datate de mai jos; ce urmează, la
„Ce urmează”.

## Contextul proiectului

Client: **SC RADOIA ISOLIRUNG SRL** (+ R&F ISORAD SYSTEM SRL), firmă de izolații
termice pentru instalații — conducte și tubulatură în clădiri mari, hale,
rafinării. Echipa de dezvoltare: **Andrei Neagoe** și **Adrian Popescu**.

Problema de rezolvat: clienții trimit liste de cantități în Excel, fiecare în
alt format, iar tarifarea se face manual, linie cu linie — 300+ linii pe
proiect, câteva ore, cu greșeli invizibile.

Materialul sursă stă în `../attachments/` și **nu e commit-uit** — conține
prețurile reale ale firmei. E grupat pe ce înseamnă, nu plat: `preturi/` pe
segment (rezidențiale / industriale / rafinărie) plus listele marcate „NUUUU"
de firmă, și `clienti/` pentru listele de cantități și ofertele trimise pe ele.
Inventarul complet, cu ce lipsește din fiecare segment și cu numele
cu care au venit fișierele (redenumite pe 13 septembrie 2026: scurte, fără
spații — `clienti/cerere-de-oferta-transavia-abur.xlsx`), e în
`../attachments/README.md`. ETL-ul caută fișierele după nume, recursiv, deci
gruparea nu-l afectează.

## Ce e construit

**Motorul de prețuri** (`src/pricing/`) — determinist, fără AI, izomorf
(rulează identic în Node și în browser). Reproduce pozițiile reale facturate din
Oferta 118 / 27.04.2026, inclusiv cele compuse din trei straturi și totalurile
pe linie, plus toate cele 53 de poziții din oferta 118.1 de închideri goluri la
foc (12.692,04 €, exact totalul semnat). Din 7 septembrie 2026 reproduce și
Oferta 284: **13 din 13** linii verificate direct, la bănuț. Regulile complete
sunt în `pricing.md`; ce s-a schimbat atunci — regula de serie, jacheta în sus,
multiplicatorii pe strat, toleranța de capăt de listă — e mai jos, la „Ce am
descoperit".

**`tabla_inox` e sistem de sine stătător** (7 septembrie 2026). Înainte,
promptul mapa explicit inoxul pe `tabla`, adică pe lista de **aluminiu**. E
singurul sistem fără listă rezidențială, deci `lista("tabla_inox")` întoarce
lista industrială — nu ca alegere de segment, ci fiindcă e singura care există.
Poziția primește `note` că amestecă destinații. Întrebarea 15 rămâne.

**Pipeline-ul de import** (`src/import/`) — L0 parsare fizică, L2a extragere
deterministă (~55% din linii), L2b completare cu OpenAI prin structured outputs
pe reziduu, L3 tarifare. Rulat pe lista reală a unui spital: 191 poziții
detectate, 63% tarifate automat. Rulează identic din CLI și din aplicație, când
aceasta e pornită local (`npm run dev`): pe `cerere-de-oferta-transavia-inox.xlsx` ambele dau
72 poziții, 39 tarifate, 6.034,70 €. Pe `oferta-118-1-matari-goluri-foc.xlsx`
(închideri goluri la foc): 53 de poziții, 100% tarifate determinist, fără niciun
apel la model.

**L1 — rolurile coloanelor** (`src/import/mapare.ts`) — modelul propune maparea
pe blocul de antet, un apel per layout, iar un validator determinist o acceptă
sau o respinge după conținutul coloanelor. Pe fișierele reale: 8 mapări
acceptate, 2 respinse. Cantitățile față de oferta semnată au trecut de la
**0/56 corecte la 56/56** — euristica veche citea prețul unitar drept cantitate.

**L4 — memoria de șabloane** (`src/import/memorie.ts`) — ce a corectat omul o
dată nu se mai întreabă. Se memorează rolul și harta sloturilor, nu valorile;
se învață doar din corecția umană, niciodată din ce a zis modelul.

**Deduplicarea reziduului** (`src/import/sabloane.ts`) — un reprezentant per
șablon pleacă la model, restul se deduc: −54% linii trimise (697 → 321), cu
rezultate identice pe golden files.

**Capcana SPIRO, făcută vizibilă** (7 septembrie 2026) — tubulatura spiro scrisă
`DN` se tarifa pe seria de țeavă de oțel: `DN125` ieșea **13,74 €/ml** (rândul
140) în loc de 11,36 (rândul 125), adică **+21%, tăcut**. Inversarea era ce o
făcea periculoasă: cazurile sigure dădeau eroare și se vedeau (ø160, ø250, ø315
nu există în tabelul de oțel), iar cele periculoase treceau neobservate, tocmai
fiindcă 125 și 200 există și se convertesc „cu succes". Cauza: `valideazaExtragere`
nu se aplică liniilor `sursa: "regex"`, iar SPIRO e prins chiar de `RE_DN`, deci
pe calea deterministă nu trecea pe la niciun validator.
`notatieContraziceMaterialul` rulează acum **indiferent de sursă** (excepție
`"om"`) și aprinde 16 linii pe cele 10 fișiere. **Nu schimbă niciun preț** —
poziția e marcată și merge la om. Pe 11 septembrie 2026 firma a răspuns („la spiro
este doar diametru exterior"), deci extragerea citește SPIRO direct ca exterior;
ø160 rămâne marcat, dar pentru rotunjire (întrebarea 3), nu pentru notație.

**Guardrails pe stratul cu model** (`src/import/valideaza.ts`) — verificare
deterministă a ceea ce iese din model, față de textul sursă: numere care nu
apar în linie, DN inexistent, grosime pe care sistemul ăla nu o ofertează,
formă care contrazice unitatea de măsură. Un avertisment anulează încrederea
raportată de model și trimite poziția la validare umană. Modelul e pinuit pe
**snapshot datat**, iar `tests/golden/` ține ieșirea lui reală pe fișiere de
client, ca deriva să se vadă. Detaliile în `import.md`.

**Ieșirea ofertei** (`web/oferta.ts`, `web/descarca.ts`) — din 7 septembrie 2026
importul nu se mai oprește în grilă. Butonul „Generează oferta" produce un
registru `.xlsx` cu trei foi: `Ofertă` (doar pozițiile cu preț **și** nemarcate,
în layoutul ofertei 284 reale), `De validat` și `Netarifate`, ultimele două cu
motivul scris pe fiecare rând. Verificat cap-coadă: `oferta-118-1-matari-goluri-foc.xlsx` importat determinist dă un registru cu 53 de poziții și total
**12.692,04 €**, adică exact totalul ofertei semnate. `web/oferta.ts` e pur,
fără DOM, deci se testează în Node ca motorul; `Blob` și `<a download>` stau
singure în `web/descarca.ts`. Detaliile în `ui.md`.

**Nicio poziție fără preț nu mai rămâne fără cauză.** `tarifeazaExtras` întorcea
`{}` când sistemul era cunoscut dar diametrul lipsea: fără preț, fără eroare,
fără cod și — dacă modelul raportase încredere peste prag — fără să fie nici
marcată. Se vedea exclusiv ca diferență între două contoare, iar pe `cerere-de-oferta-spital.xlsx`
însemna ~45 din 51 de poziții netarifate invizibile în blocul de cauze. Codul
`fara_diametru` acoperă cazul (tubulatură **rectangulară**, care chiar n-are ø,
ci A×B — conversia e în `tevi.md`, neimplementată). Un test exhaustiv peste toate
combinațiile de câmpuri garantează acum: **ori preț, ori cauză, niciodată
tăcere.**

**Cauzele netarifării, ca valori** (`CodNetarifare` în `src/pricing/types.ts`) —
`PozitieNetarifata` poartă un cod stabil lângă mesaj, iar ecranul grupează pe
el: „Ce blochează 130 de poziții — 64 niciun strat n-are coeficient pe banda lui
(întrebarea 9), 43 grosime care nu există în listă, 15 diametru peste maximul
listei (întrebarea 4), 8 DN inexistent în seria de oțel (întrebarea 10)".
Mesajele nu s-au schimbat: textul rămâne pentru citit, codul e ce se poate
număra. Fiecare click filtrează grila prin lentila existentă.

**Istoricul importurilor** (`web/istoric.ts`) — ultimele 10 importuri în
IndexedDB: fișierul, extragerile și corecțiile omului, nu grila (aceeași parsare
pe aceiași bytes o reface). Reîncărcarea paginii nu mai pierde munca, iar
redeschiderea unui import vechi **nu cheamă modelul din nou**. Detaliile în
`ui.md`.

**Aplicația** (`web/`) — 9 ecrane: tablou de bord, lucrări, cereri și oferte,
calcul deviz, import Excel, șantier (pozele din carnet), depozit și stoc
(prototip), clienți, liste de prețuri. Datele sunt reale,
extrase din fișierele firmei. Paleta și tipografia respectă WCAG AA; detaliile
în `ui.md`. Bara laterală se pliază la o bandă de pictograme pe ecran larg
(preferință reținută) și glisează ca sertar pe ecran îngust.

**Baza de date** (`src/db/`) — Postgres 18 local în Docker, Drizzle, migrări
commit-uite. Izolarea între tenanți e impusă de bază prin row-level security,
nu de `where`-uri în cod; listele de prețuri sunt documente versionate,
imutabile după activare, cu trigger care refuză editarea. Catalogul din bază e
verificat că e identic cu cel din fișiere — cât timp testul ăla trece, cele
130 de teste ale motorului se aplică și prețurilor din bază. Detaliile în
`backend.md`.

**Infrastructură** — CI (typecheck + teste + semnalarea modificărilor de
prețuri), verificare care respinge trailerele de atribuire AI, deploy automat
pe GitHub Pages: <https://andreineagoe23.github.io/izorep/>

## Decizii luate

**Motorul nu extrapolează tăcut.** Până pe 25 septembrie 2026, peste ultimul
rând din listă arunca `PozitieNetarifata`. De atunci aplică formula scrisă a
firmei pe mp, dar poziția iese **marcată** (`peste_lista`): pe Oferta 27.04.2026
formula dă exact DN250 / 19 mm, iar SPIRO ø250 / ø315 au fost semnate cu 0,13 €
peste ea. La fel golul din matrice: se deduce doar din rândul imediat următor,
tot marcat. Fără preț pe mp (PVC peste ø710), poziția rămâne refuzată.

**RAG-ul a fost respins pentru citirea Excel-urilor.** Datele sunt deja
localizate în celule; problema e mapare, nu regăsire. Chunking-ul rupe rândul
de antet, iar embeddings-urile confundă DN80 cu DN100. Soluția e extragere cu
schemă închisă (5 câmpuri, domenii enumerate) plus memorie per client.
Detalii în `import.md`.

**Stratul cu model rulează local, nu pe Pages.** Cu `npm run dev` și cheia în
`.env`, ecranul de import face pipeline-ul complet: ruta `/api/extrage` din
`scripts/vite-plugin-model.ts` există doar pe serverul de dezvoltare, deci cheia
nu ajunge în pagină și nu poate ajunge într-un build. Pe Pages ruta lipsește și
ecranul cade curat pe stratul determinist.

**Ce iese din model se verifică determinist, nu se crede pe cuvânt.** Zod
validează forma răspunsului, nu sensul lui: `diametru_valoare: 76` trece
perfect și când în linie scria `Di60`, cu încredere raportată 0,95. Regulile de
plauzibilitate stau în cod, cu teste, nu în prompt — o regulă din prompt e o
rugăminte, una din cod e o verificare. Aplicarea e în `extrageCuModel`, singurul
punct prin care trec toate căile.

**Modelul e pinuit pe snapshot datat, nu pe alias.** `gpt-4.1` e mutat de
OpenAI pe alt model fără ca nimic din repo să se schimbe — aceleași fișiere,
alte prețuri, zero urme în `git log`. Implicitul din cod e
`gpt-4.1-2025-04-14`, iar golden files spun când răspunsul începe să difere.

**Nu inventăm identificatori pentru firme reale.** CUI-urile și telefoanele din
`web/date/seed.ts` sunt `null` și se afișează „—". Un CUI plauzibil dar greșit
costă mai mult într-un demo decât o casetă goală.

**Meniul conține doar ecrane care există.** Modulele nelivrate stau într-un
`<details>` pliat sub meniu. Harta sistemului rămâne vizibilă pentru client, dar
nu mai ocupă jumătate din navigația zilnică.

**Cererile și ofertele sunt un singur ecran.** Sunt același obiect în stadii
diferite ale aceluiași flux; două ecrane separate ascundeau exact lanțul
cerere → ofertă → contract → situație.

**Culoarea de acțiune e separată de culorile de stare.** Accentul e albastru,
starea rămâne verde/chihlimbar/roșu, iar roșul înseamnă doar eroare. Accentul
maro anterior era, pentru un daltonist, aceeași culoare cu avertizarea. Neutrele
sunt reci în ambele teme: sub accent albastru, un fundal cald arăta maro în
tema închisă și se bătea cu albastrul.

**Tema se alege din aplicație**, cu un comutator Sistem / Deschis / Închis
salvat în `localStorage`. Înainte, tema urma orbește sistemul și nu se putea
schimba din interfață.

## Prețurile pe destinație (4 septembrie 2026)

> Istoric. Din 12 septembrie 2026 motorul tarifează și pe industrial, cu
> segmentul ales de om la import — vezi „10–13 septembrie 2026", mai jos.

Firma a spus că listele sunt de **trei feluri**: rezidențiale, industriale,
rafinărie — prima axă din `liste-preturi.md`. Am primit primele două;
**rafinăria nu a venit încă**.

- **Rezidențiale** — cele 5 pe care le aveam deja. Zip-ul nou e identic ca
  conținut; `L.pret elastomer` diferă doar la nivel de bytes (re-salvat pe
  4 iunie 2026), celulă cu celulă aceleași valori. Nu e o listă nouă.
- **Industriale** — 4 fișiere noi: vată minerală, elastomer, tablă aluminiu și
  **tablă inox**, sistem pe care motorul nu-l are deloc. Inoxul e jachetare, ca
  aluminiul: ø80–ø710 din 10 în 10, grosimi 0,4 / 0,5 / 0,6 mm, 192 de celule
  pline (aluminiul are 63, rare). Lipsesc PVC și închiderile goluri la foc.
- **Rafinărie** — nimic.

**Industrialul nu e un coeficient peste rezidențial**, deci nu se poate ține ca
multiplicator: vata e ×1,25 constant, elastomerul e ×1,25 la 9/13/19 mm dar
**×1,20** la 25/32 mm, iar tabla variază pe rând în jurul lui ×1,10–1,11.
Trebuie stocate ca liste proprii, versionate pe destinație.

**Motorul rămâne pe rezidențial. Baza le ține pe amândouă.**
`data/price-lists/*.json` — ce importă static `src/pricing/lists.ts` — e
neatins, verificat byte cu byte după regenerare. Industrialul stă separat, în
`data/price-lists/industrial/`, și intră în `lista_preturi` cu destinația lui.

Împărțirea e deliberată: motorul ar trebui să afle de undeva *care* destinație
se aplică unei lucrări, iar regula aia nu există încă (întrebarea 12). Un motor
care cunoaște două liste și nu știe să aleagă între ele e mai prost decât unul
care cunoaște una singură și o spune.

Riscul concret, prins cu test: cu două liste active pe același sistem,
interogarea veche — filtru pe sistem + status, `order by valabil_de_la desc` —
ar fi ales-o tăcut pe cea industrială, fiindcă e mai recentă. Vata industrială
e ×1,25, deci toate ofertele ar fi ieșit cu 25% mai mari fără nicio urmă.
`catalogDinBaza` cere acum destinația explicit. Detalii în `backend.md`.

Ce s-a mai adăugat în bază: **seriile de diametre pe material** (oțel, cupru,
PP-R, PE-HD, PE-Xa, PVC, spiro — 141 de rânduri) și cele 34 de secțiuni
standard de tubulatură rectangulară, din registrul de conversie ml → mp.
Sunt norme, deci tabele globale, fără `tenant_id` și fără RLS. Motorul încă nu
le folosește: azi `dn-table.ts` aplică tabelul de oțel tuturor materialelor,
deci o poziție DN15 de cupru se caută pe rândul 22 în loc de 18.

## Ce am descoperit din datele reale

**Regula de potrivire pe rând diferă după notația diametrului.** La DN de oțel
se caută rândul cel mai apropiat (rândurile listei *sunt* seria standard); la
diametru exterior (plastic, PEHD, SPIRO) se rotunjește în sus, pentru că mufa
de izolație trebuie să încapă peste țeavă. Regula asta singură repară 3 poziții
care ieșeau greșit.

**Diametrul geometric pornește de la rândul primului strat**, nu de la
diametrul real, și crește cu 2 × grosime. La egalitate între două rânduri se
alege rândul superior. Asta reproduce ambele poziții compuse din oferta 118.

**Închiderile goluri la foc au preț aditiv**, nu matrice: golul după suprafață,
plus banda WRAP, plus colierul. Pragurile sunt scrise „Goluri până la 0,05 mp",
deci limita superioară e inclusivă — se vede la golurile de 0,60 și 0,90 mp
exact. Clasa EI e etichetă de grupare, nu variabilă de preț: aceeași conductă
DN15 costă 23,05 € și la EI30, și la EI120.

**Banda WRAP are două liste, după materialul conductei.** La ø140 sunt 12,19 €
pe oțel și 65,67 € pe plastic, pentru că numărul de înfășurări diferă. Extragerea
le citea ca pe una singură și tăia tabelul de oțel după primul rând — deci ø140
oțel ar fi fost tarifat de cinci ori prețul real. Reparat în ETL, cu test.

**Trei abateri reale rămân**, documentate în blocul „abateri cunoscute" din
`tests/pricing.test.ts`: ø90 PEHD (0,55 €/ml diferență), ø160 tarifat diferit
ca țeavă PEHD față de tubulatură SPIRO în aceeași ofertă, și rotunjirea la
stratul de jachetă.

**Modelul nu întoarce toate liniile pe care le primește.** Contractul e „câte
un obiect per linie, cu același index"; pe `oferta-118-nisal.xlsx` au plecat
43 de linii și s-au întors 35. Liniile lipsă nu apăreau nicăieri în raport, deci
un fișier ciuntit arăta ca un fișier cu mai puține poziții. Acum se numără
(`modelFaraRaspuns`).

**Tabelul de conversie DN, primit de la firmă, confirmă exact ce era în cod.**
Coloana ISO coincide valoare cu valoare cu `DN_TO_OD` pe tot intervalul
DN10–DN400 — dedus din listele de cantități, validat independent de sursă.
Restul notițelor (cupru/inox pe altă serie, tubulaturi rectangulare, formula
pentru diametre peste ultimul rând) stau în `tevi.md`, cu întrebările deschise.

**Notele de la finalul ofertei erau citite ca poziții.** „Preturile se refera la
inchideri goluri la foc EI60", „nu sunt incluse colierele si banda wrap" conțin
exact cuvintele după care se recunoaște sistemul. Regula care le scoate e
fizică, nu semantică: un rând fără unitate de măsură **și** fără cantitate nu e
poziție. Pe cele 9 fișiere, 513 poziții devin 441, iar cele tarifate rămân 261.

**Lista de manoperă are altă structură** decât matricea completă: tarif plat pe
sistem și grosime (2,20 / 2,30 / 3,00 €/ml), nu matrice ø × grosime. Nu e o
coloană a aceleiași linii, e o listă separată.

**Lista de inox lipsea, dar lucrările de inox nu.** `cerere-de-oferta-transavia-inox.xlsx`
are **72 de rânduri** care spun „tabla de inox 304" — practic tot fișierul.
Neavând listă, `extract-llm.ts` mapa explicit inoxul pe `tabla`, adică pe lista
de aluminiu, iar cele 39 de poziții tarifate din el (6.039,90 €) au ieșit pe
lista greșită. Inoxul e mult mai scump: la ø90, 30,89 € (0,4 mm) față de
17,08 € (aluminiu 0,6 mm). Lista industrială de inox rezolvă asta — dar abia
după ce motorul capătă sistemul și regula de segment.

**Prima pereche cerere → ofertă pe aceleași rânduri.** `cerere-de-oferta-transavia-abur.xlsx` (99 rânduri) și
`oferta-284-transavia-abur.xlsx` sunt același proiect, întrebat și răspuns.
Până acum aveam ori cereri, ori oferte, niciodată perechea — deci nu se putea
măsura tarifarea fără să ghicim ce a fost întrebat.

**Lucrarea e industrială, dar a fost tarifată pe lista rezidențială.** Transavia
Alba-Iulia, abur, beneficiar Grup Energoinstal. Pe cele 30 de linii distincte
`Di<ø>, g<gr>` (vată + tablă de aluminiu), prețurile ofertei ies **exact** din
listele rezidențiale; pe cele industriale ar fi ieșit cu 25% mai mult. Deci
segmentul nu se deduce din tipul lucrării — cineva îl alege. Întrebarea 12.

**Regula de rând se confirmă pe straturi diferite: primul strat cel mai
apropiat, jacheta în sus.** Măsurat pe cele 30 de linii, cu cele patru
combinații posibile:

| primul strat / jachetă | potriviri exacte |
|---|---|
| în sus / în sus | 15 / 30 |
| în sus / cel mai apropiat (motorul de azi, pe `interior`) | 12 / 30 |
| **cel mai apropiat / în sus** | **18 / 30** |
| cel mai apropiat / cel mai apropiat | 15 / 30 |

Cifrele astea le înlocuiesc pe cele înregistrate inițial (23 / 21 / 27 / 24),
care erau greșite: măsurătoarea veche nu rula `multiplicator()` din motor, deci
nu contoriza ca eșec cele **10 linii pe care motorul le refuză în toate cele
patru combinații** — 3 la Di21 g40 (lista n-are celula `22|40`) și 7 coturi/teuri
de vată pe banda 18–60, unde coeficientul e `null`. Raportat doar la cele 20 de
linii pe care motorul dă vreun preț: 15 / 12 / **18** / 15. Ordinea e neschimbată.

Cele două linii care despart variantele sunt Di114 (geometric 214, între
rândurile 210 și 220 — oferta ia 220) și Di273 (geometric 393 — oferta ia 400).
Asta e exact „rotunjirea la stratul de jachetă" din blocul de abateri
cunoscute, acum cu dovadă independentă: **jacheta se rotunjește în sus**.

Diametrele sunt scrise `Di21, Di27, Di34, Di49, Di60, Di76, Di89, Di114, Di140,
Di169, Di273` — adică seria de țeavă de oțel rotunjită (21,3 · 26,9 · 33,7 ·
48,3 · 60,3 · 76,1 · 88,9 · 114,3 · 139,7 · 168,3). Notația spune „exterior",
dar rândurile *sunt* seria standard, deci se aplică regula de la `tip: "DN"`.
Motorul leagă azi regula de notație, nu de serie: pe fișierul ăsta ar rotunji
în sus și ar rata Di49, Di169 și Di273.

**Coturile și teurile de vată sub ø76 se facturează doar cu jacheta.** Banda
18–60 nu are coeficient de cot/teu în lista de prețuri (întrebarea 9), dar
oferta le tarifează: Di21 și Di27 = 17,78 €, Di34 = 18,12 €, Di49 = 18,48 €,
Di60 = 18,83 €. Fiecare e **exact** prețul tablei la rândul geometric
(ø110, ø110, ø120, ø130, ø140) — stratul de vată nu intră în preț.

**Nouă poziții din nouă**, nu cinci cum se scrisese prima dată: cot și teu la
Di21, Di27, Di34, Di60, plus cot la Di49 (teu nu există acolo). Cinci diametre,
două forme, exacte la bănuț pe o ofertă semnată.

Regula generalizează fără caz special: **un strat al cărui sistem n-are
coeficient pentru forma cerută pe banda lui contribuie cu geometria — rândul și
grosimea, pentru diametrul stratului următor — dar nu cu prețul.** La Di60 cot
vata iese, tabla intră cu ×1 → 18,83 €. La Di114 cot ambele au coeficient, deci
nimic nu se schimbă și abaterea de 76,43 față de 45,24 rămâne exact cum era.

Consecință care nu se vedea din formularea veche: la Di21 stratul de vată nu
mai e nici măcar căutat în matrice, deci lipsa celulei `22|40` nu mai blochează
poziția — Di21 cot și teu devin tarifabile la 17,78 €. Di21 **ml** rămâne
netarifat, corect: acolo vata are coeficient 1, deci e inclusă, deci celula
lipsă oprește poziția.

Intră în cod cu preț **plus notă de proveniență**, iar poziția trece obligatoriu
pe la om. Rămâne de confirmat cu firma (întrebarea 9).

**Două abateri rămân pe oferta asta.** Di114 cot și teu sunt 76,43 € în loc de
45,24 € (banda 76–114 spune ×1 pentru cot; raportul real e 1,689 — nu e niciun
coeficient din tabel). Iar Di21 la 40 mm pe metru liniar e 25,68 € față de
25,73 € calculat: lista noastră n-are ø22 la 40 mm, iar motorul cade pe ø28.

**Ce a intrat în cod pe 7 septembrie 2026.** Patru reguli, toate cu dovadă
măsurată, plus o a cincea care e o corecție a uneia dintre ele:

1. **Regula de serie, nu de notație** — `peSeriaDeOtel`, toleranță 0,8 mm.
   Pragul e ales pe date: maximul măsurat e 0,70 (Di49, Di169), iar ø90 e la
   1,1 de 88,9 și ø75 la 1,1 de 76,1, deci plasticul nu se confundă cu oțelul.
   Doar pe `interior`; pe `exterior` nu se schimbă nimic.
2. **Jacheta se rotunjește în sus** — după **material** (`tabla`, `tabla_inox`),
   nu după poziția în stivă. Prima variantă lega regula de „ultimul strat" și
   dădea același rezultat pe datele de azi, dar predicatul se rupe la prima
   poziție cu altă ordine. Motivul fizic e materialul: tabla se croiește pe
   șantier la măsura superioară, manșoanele vin în alezaje fixe și se ia cel mai
   apropiat — de-aia stratul de vată din mijloc la DN80 compus rămâne pe 114.
3. **Multiplicatorii se aplică pe strat**, iar straturile fără coeficient pe
   banda lor ies din preț păstrându-și geometria. Asta rezolvă cele 9 poziții
   de cot/teu sub ø76.
4. **Toleranță de 0,5 mm la capătul listei.** DN200 (ø219,1) cădea cu 0,1 mm
   peste ultimul rând al elastomerului, care e 219 — adică exact DN200.
5. **Corecție la 3, găsită de testul golden.** Excluzând stratul de vată din
   preț, îi dispărea și verificarea grosimii — iar `Di60, g48` (48 mm nu se
   ofertează la vată, în niciun segment) a început să se tarifeze la 19,45 €.
   Greșit: `geometric = rând + 2 × grosime`, deci grosimea stratului exclus
   decide rândul jachetei. Un strat scos din preț nu e un strat inexistent.
   Regula corectă: îi trebuie o grosime **ofertată de sistem**, nu îi trebuie
   celula `rând|grosime`. Separă exact `Di21 g40` (40 e ofertat, celula `22|40`
   lipsește → 17,78 €) de `Di60 g48` (48 nu e ofertat → rămâne netarifat).
   Fixtura golden avea dreptate; nu s-a re-înregistrat nimic.

**Inoxul nu se tarifează automat, și ăsta e răspunsul corect.** Lista de
aluminiu e **rară** — exact o grosime per diametru — deci grosimea jachetei e
implicită și poziția iese cu preț fără ca textul să spună ceva. Lista de inox e
**densă**: toate cele trei grosimi (0,4 / 0,5 / 0,6) la fiecare din cele 64 de
rânduri, 192 de celule pline. Textul clientului nu spune niciodată grosimea
jachetei — „tablă de inox 304", atât — deci `grosimeEfectiva` nu mai are ce
deduce și poziția iese „grosime nespecificată și ambiguă".

Deci cele 39 de poziții din `Izolatii Transavia` nu trec de la *preț greșit* la
*preț corect*, ci de la **preț greșit, tăcut** la **poziție marcată**. La rândul
140, aceeași poziție e 18,83 € pe aluminiu și 45,57 € pe inox 0,5 mm — de 2,4
ori. Un număr fals cu care semnezi o ofertă e mai scump decât o casetă goală.

Rezultă o întrebare nouă, îngustă și ușor de răspuns, care deblochează 72 de
rânduri dintr-un singur fișier: **care e grosimea implicită de tablă de inox?**
E acum partea concretă a întrebării 15.

**Golden files erau decalate față de prompt** (re-înregistrat pe 13 septembrie
2026; paragraful rămâne ca istoric). `tests/golden/` conține
ieșirea modelului de **dinainte** ca promptul să știe de `tabla_inox`: liniile
de inox din `Izolatii Transavia` sunt înregistrate cu `{"sistem": "tabla"}`,
adică pe lista de aluminiu. Testul trece — el rejoacă partea deterministă peste
ce e înregistrat — dar înregistrarea nu mai reprezintă ce ar răspunde modelul
azi. Re-înregistrarea costă un apel real:
`npm run golden -- ../attachments/clienti/cerere-de-oferta-transavia-inox.xlsx`.

**Efectul pe fișierele reale, doar pe stratul determinist** (`--fara-model`,
cele 10 fișiere din `attachments/clienti/`):

| | înainte | după |
|---|---|---|
| poziții de izolație | 505 | 505 |
| tarifate | 370 (73,3%) | **375 (74,3%)** |
| valoare | 700.130,82 € | 717.230,26 € |

Cifra mică e înșelătoare și merită spus de ce: pe calea deterministă nu se
construiesc `straturi_extra`, deci fiecare poziție e un singur strat. Regula 3
și `tabla_inox` lucrează numai pe poziții **compuse**, adică pe cele care trec
prin model. Acolo se vede efectul, iar dovada lor sunt testele unitare și
golden files, nu sweep-ul. Valoarea s-a schimbat și în minus pe unele fișiere
(Oferta 284: 24.052 → 23.788 €) — corect: regula de serie mută Di49 de pe
rândul 54 pe 48, care e mai ieftin și e cel din oferta semnată.

## Acoperirea față de ofertele semnate (actualizat 25 septembrie 2026)

Din cele 9 fișiere de client, **4 sunt oferte** cu rând de TOTAL — restul sunt
cereri, n-au cu ce fi comparate. Măsurat pe `--fara-model`, comparând registrul
generat cu totalul semnat. `tests/oferte-semnate.test.ts` ține cifrele ca
clichetă: dacă cresc, se actualizează; dacă scad, s-a stricat ceva — sau e o
scădere deliberată, explicată în `deCe`.

| Ofertă semnată | pe ofertă (7 sep → 13 sep → 15 sep → 25 sep) | generat | semnat | |
|---|---|---|---|---|
| Matari (goluri foc) | 53 → 53 → 53 → 53 | 12.692,04 | 12.692,04 | **100%** |
| Oferta 27.04.2026 | 29 → 39 → **41** → **45** | 156.805,03 | 170.519,39 | 92% |
| Oferta 284 Transavia | 61 → 85 → 85 → **85** | 75.611,04 | 94.575,06 | 80% |
| Anexa 1 / 06.12.2024 | 0 → 0 → 0 → 0 | 0,00 | 706,90 | **0%** |

Pe 25 septembrie, cifrele de mai sus se referă la foaia `Ofertă` fără nicio
confirmare. Oferta 284: 98 de prețuri calculate, toate exacte; 13 stau la „De
validat” (celula 22|40 dedusă) și ajung în ofertă cu un clic, iar singura
poziție fără preț e distribuitorul de abur. Vezi „Cererea TRANSAVIA
reprodusă”, mai jos.

Distincția care contează: **nu e o problemă de preț, e una de acoperire.**
Prețurile pe liniile care ies sunt comparate linie cu linie cu oferta semnată:

- **Oferta 284** — **83 din 85** de prețuri unitare exacte. Cele două diferite
  sunt `Di169, g50 - COT` cu UM `ml` în fișierul clientului: UM-ul decide forma,
  deci iese prețul pe ml (51,44), oferta are cotul (102,88). E fișierul, nu
  motorul. Restul de 13 netarifate sunt grosimi inexistente în listă. Din 25
  septembrie 2026 cele două coturi nu mai ies „Gata”: textul (COT) și UM-ul
  (`ml`) se contrazic și dau prețuri diferite, deci poziția merge la om.
- **Oferta 27.04.2026** — **43** de prețuri exacte (erau 20, apoi 37). Ce diferă
  e marcat: ø90 și ø160 (rotunjire, întrebarea 3), 3 peste maximul listei
  (întrebarea 4), grosimi inexistente. Rândurile 44–47 (DN20–DN40), care
  păreau o inconsecvență a ofertei, ies acum exact — vezi „15 septembrie 2026".
- **Anexa 1 — zero e răspunsul CORECT.** Vezi mai jos.

**Anexa 1 e o ofertă de MANOPERĂ, și forțarea acoperirii ar fi cea mai scumpă
greșeală posibilă.** Fișierul are altă formă: descrierea stă în antetul de
secțiune („1. Izolatii conducte PPR cu Armaflex gr. 9 mm - **manopera** :"), iar
rândurile de date sunt numai cifre — `1 | 22 | 2,3 | m | 20 | 46` — deci
`construiesteLinie` nu le vede ca linii (n-au text). Prețurile semnate sunt
2,20 / 2,30 / 3,00 €/ml, adică exact tariful plat de manoperă din
`liste-preturi.md`. Motorul are doar liste **material + manoperă**:

| poziție | motorul | semnat | raport |
|---|---|---|---|
| Armaflex g13 ø22 | 5,99 € | 2,30 € | **2,6×** |
| Armaflex g13 ø48 | 8,84 € | 2,30 € | **3,8×** |
| vată g30 ø28 | 6,86 € | 2,20 € | **3,1×** |

Aceeași capcană ca la SPIRO, dar de trei ori mai mare. `randuriManopera` din
`Statistici` recunoaște fișierul după marcajul „manoperă" din secțiuni și
aprinde o alertă în ecran și în CLI, ca zero-ul să spună **„n-avem lista"**, nu
să arate ca o foaie goală. Se aprinde pe exact un fișier din zece.

## 10–13 septembrie 2026: segmentul, răspunsurile firmei, reparații

**Răspunsurile firmei din 11 septembrie 2026**, intrate în cod de Adrian:

- **SPIRO** — „la spiro este doar diametru exterior". `extract-regex.ts` îl
  citește direct ca exterior (întrebarea 10).
- **Coturile și teurile de vată sub ø60** — regula e a firmei (întrebarea 9).
  Nota rămâne pe poziție, validarea obligatorie a căzut.
- **Grosimile uzuale** când clientul nu scrie grosimea: vată 20–100 mm după
  DN, elastomer 13/19/25 mm după ø. Tabelul dedus din Oferta 284 (40/50/60)
  era o **excepție** a clientului TRANSAVIA, nu regula. Detalii în `pricing.md`.

**Ce a mai intrat (Adrian, 10–12 septembrie 2026).** Ecranul de liste arată
listele pe segmente, inclusiv închiderile la foc. Motorul tarifează pe segmentul
ales la import (comutatorul „Tipul ofertei") prin `listaDe`, cu notă de
verificat unde segmentul n-are lista unui material. Extragerea deterministă vede
toate materialele de pe un rând (`straturi_extra`), iar liniile extrase pe
jumătate rămân poziții marcate, nu dispar. Grila are coloane de preț. Pe Oferta
284 prețurile exacte au urcat de la 0 la 83 din 85.

**Ce a găsit verificarea din 13 septembrie 2026 și s-a reparat.** A/B linie cu
linie pe cele 10 fișiere de client, comparație cu prețurile semnate, și un test
cap-coadă în browser (import → segment → grosimi → confirmare → registru →
reîncărcare):

| Problemă | Efect măsurat | Acum |
|---|---|---|
| Registrul scria „destinația rezidential" fix | ofertă industrială cu proveniență falsă | scrie segmentul ales |
| Segmentul nu se salva în istoric | import redeschis pe alt segment, alte prețuri | se salvează și se reface |
| „Completează grosimi" punea `sursa: "om"` | 24 de casete plecau în ofertă nevalidate | rămân de validat |
| Poziție confirmată, dar cu notă de verificat | confirmarea n-avea efect, nu ajungea în ofertă | confirmarea o eliberează |
| Grosimi propuse pe `Di34/Di49/Di89` | 30/50/100 mm în loc de 20/40/80 | pe seria de oțel |
| Elastomer DN50 / DN200 | 19 / 25 mm în loc de 13 / 19 | cu toleranța de capăt de rând |
| „Tablă zincată" = materialul tubulaturii (Book15) | jachetă adăugată, +90…250%, nemarcat | nu mai e jachetă |
| „Treceri prin pereți" la țevi (Radoia) | 58 de închideri de gol false | cere context de foc |
| `Ø1/2"`, `Dn 1 1/4"` | citite φ1 / DN1, 5,70 € pe toate | DN15…DN50, exacte |
| `PEHD D40x3.0` | 11 poziții fără diametru | exterior 40…250 |
| „13mm+40mm vata minerala" | DN80/DN100 compus netarifat | 44,35 / 57,82, exacte |
| ø90 / ø160 rotunjit în sus, tăcut | oferta semnată a luat și rândul de jos | preț + notă, întrebarea 3 |
| Închideri la foc pe industrial | preț rezidențial fără notă | notă, ca PVC |
| Grosime ambiguă → „întrebarea 15" | trimitea casetele de vată la o întrebare despre inox | 15 doar la inox |

Golden file-ul `izolatii-transavia.json` e **re-înregistrat** pe 13 septembrie
2026 cu promptul care știe de `tabla_inox`; decalajul de mai sus nu mai există.

## 15 septembrie 2026: DN lângă Ø, straturile în editor, descrierea după verificare

Verificare cerută de Andrei: conversia DN → φ, editarea cu mai multe straturi,
recalcularea după o descriere schimbată, și cererile față de oferte. A/B linie cu
linie pe cele 10 fișiere de client, comparație cu prețurile semnate și test
cap-coadă în browser, la 1440 și 390 px.

**Conversia DN → φ e corectă.** Pe cele 231 de linii DN din fișiere, fiecare DN
trece pe coloana ISO și pe rândul cel mai apropiat: DN15 → 22, DN20 → 28,
DN25 → 35, DN32 → 42, DN40 → 48, DN50 → 60, DN65 → 76, DN80 → 89, DN100 → 114,
DN125 → 140, DN150 → 168/169, DN200 → 219, DN250 → 273.

| Problemă | Efect măsurat | Acum |
|---|---|---|
| „DN20" în germană, „Ø20mm" în română (NISAL 44–47) | tarifat pe ISO: 5,99 / 6,15 / 8,29 / 8,45, nemarcat | Ø-ul care nu e DN-ul în tabelul de conversie câștigă: 5,79 / 5,99 / 6,15 / 8,29, ca oferta |
| `DN150din`, `Ø32mm`, `Ø50mm` lipite de text | fără diametru (Transavia inox r70, NISAL r76–77) | se citesc; NISAL r76–77 exacte |
| „tablă de inox 0,5 mm" în descriere | grosimea ignorată, inoxul rămânea fără preț | citită, doar din grosimile listei; „0.6 – 0.8 mm" rămâne a omului |
| DN citit de model lângă un Ø care nu-i corespunde | nemarcat | `diametru_contrazis`, la validare |
| Descriere schimbată după „Modifică" sau „Confirmă" | prețul rămânea pe textul vechi, „Gata" (45,24 €/ml după scoaterea tablei) | recitită, „De verificat", cu „Anulează" |
| Descriere schimbată pe o linie citită de model | extragerea veche se păstra | recitită determinist, marcată |
| Editorul: un material, diametru, grosime | jacheta nu se putea scoate sau adăuga, grosimea inoxului nu se putea pune | straturi cu material și grosime, formă, descriere, UM, cantitate, „Citește din descriere" |
| φ nu se vedea nicăieri la import (16 sep) | „DN100" și „Ø100" arătau la fel pe ecran, deși unul caută ø114,3 și celălalt ø100 | eticheta scrie „DN100 = ø114,3", iar fiecare strat își poartă rândul din listă |

**De unde regula DN / Ø.** Ø20 / 25 / 32 / 40 e seria de PP-R și PE-Xa din
`conversie-ml-mp-tevi-tubulaturi.xlsx`, nu DN20–DN40 pe vreo coloană a tabelului
(la DN20: ISO 26,9, DIN 25). La plastic firma nu convertește, rotunjește în sus —
iar `tests/pricing.test.ts` avea deja exact prețurile astea pentru ø20 / 25 / 32 /
40 cu elastomer 9 mm, din aceeași ofertă. Un Ø care *este* DN-ul în tabel
(`Dn 80 (88,9 x 4)`, `Ф 57 (Dn 2")` — 57 pe coloana DIN) nu schimbă nimic. Pe
Oferta 27.04.2026: **37 → 43** de prețuri exacte; restul fișierelor, aceleași
prețuri.

**Cererile față de ofertele semnate.** Singura pereche e Abur → Oferta 284. Pe
cerere: 52 de prețuri exacte, 2 diferite (cotul Di169 cu UM `ml`), 33 fără preț,
din care 24 fiindcă clientul n-a scris grosimea. Cu grosimea din oferta semnată
pusă din editor, 11 din 11 verificabile ies exact; 6 rămân fără preț (vată 40 mm
la DN15, întrebarea 18). „Pune grosimea uzuală" dă 3 exacte din 16 verificabile —
normal, la TRANSAVIA grosimile au fost la cererea clientului. Celelalte cereri
n-au ofertă pereche.

**Descrierea după verificare.** Fiecare extragere ține minte textul din care a
ieșit (`Rezolvare.text`). O linie `om` rămâne a omului cât timp textul e același;
schimbat, se recitește și intră în `descrieriSchimbate` (salvat în istoric), cu
motivul „Descrierea s-a schimbat după verificare". Cantitatea schimbată nu atinge
verificarea: nu e descriere.

## 25 septembrie 2026: audit, stratul cu model, foaia fără derulare

Audit cerut de Andrei: sunt corecte calculele de la import și își face
modelul treaba? Măsurat, nu citit: fiecare preț unitar calculat comparat cu
cel din oferta semnată (testele verificau până acum doar totaluri și
acoperire), plus simulări ale stratului cu model și `npm run golden --
--verifica` pe modelul real.

**Prețurile ies corect.** Pe stratul determinist: Oferta 284 — 83 din 85 de
prețuri unitare exacte; Oferta 27.04.2026 — 43 exacte, cele 4 diferite toate
marcate (ø90, ø160 SPIRO ×2, DTIP8); Matari — 53 din 53, total exact. Toate
pozițiile fără preț au cauză. Ce nu era în regulă stătea în jurul calculelor:

| Problemă | Efect măsurat | Acum |
|---|---|---|
| „Di169, g50 - COT” cu UM `ml` | 51,44 € „Gata”, oferta are 102,88 € (−50%, tăcut) | forma scrisă după liniuță bate UM-ul (ca firma, 2 din 2); o mențiune în trecere („inclusiv coturi”) care dă alt preț → `forma_contrazisa`, „De validat” |
| Modelul nu primea antetul de secțiune | pe Matari, 12 poziții își iau sistemul doar din el | secțiunea pleacă la model, doar pentru sistem; intră și în cheia de șablon (+1 linie trimisă pe 10 fișiere) |
| `sistem: null` de la model suprascria citirea parțială | acele 12 poziții ar fi dispărut din „Netarifate”, fără cauză | `null` nu mai șterge ce știa determinismul |
| Indecșii întorși de model nu se filtrau | un index străin suprascria o linie citită de reguli | doar indecșii trimiși; un index dublu se aruncă (`modelFaraRaspuns`) |
| La `temperature 0`, o rulare a pus `tabla_inox` ca strat pe țeavă la 14 casete Transavia, următoarea nu | jacheta pe primul rând mută toată geometria | `jachetaLaExterior` înainte de tarifare, plus regula în prompt |

A/B pe cele 10 fișiere pentru reparațiile de mai sus: nicio altă poziție nu
s-a mișcat. Golden: 35/35 pe Oferta 27.04.2026; pe Izolații Transavia modelul
citește acum „g48” fidel (48, nu null) pe 2 rânduri — fără efect de preț (48 nu
e grosime de vată), re-înregistrat sub numele nou al fișierului,
`cerere-de-oferta-transavia-inox.json` (cel vechi, `izolatii-transavia.json`,
a fost scos).

**Cererea TRANSAVIA reprodusă.** Cerută de Andrei: importul cererii Abur
trebuie să dea Oferta 284 semnată, rând cu rând. Prima măsurătoare: 64 exacte,
33 fără preț. Tot ce lipsea era de găsit în date:

| Ce lipsea | Dovada | Regula |
|---|---|---|
| Grosimea celor 24 de casete („… DN100 din tabla aluminiu si vata minerala”) | fiecare casetă are grosimea conductei de același diametru din aceeași cerere (DN100 ↔ Di114 g50 …), 11 diametre din 11 | `grosimiDeLaConducte`: aceeași listă, același material, o singură grosime pe diametru; altfel nimic |
| Vată 40 mm pe rândul 22 (golul e și în lista originală a firmei) | 25,68 și 47,41 dau amândouă vata 7,90 = 7,9522 × 6,8157 / 6,8569 | `celulaDedusa`: doar din rândul imediat următor, preț + „De validat” (o singură valoare dovedită, întrebarea 18) |
| „Di169, g50 - COT” cu UM `ml` | semnat ca cot, 102,88 (2 din 2) | forma scrisă după liniuță bate UM-ul (`formaExplicitaDinText`) |
| „tabla dealuminiu” | typo în cerere | „de” lipit e acceptat |
| Totalul, 1 ban peste | Excel-ul firmei adună 143,808, nu 143,81 | `valoareLinie` exactă, total rotunjit o dată |
| „IZOLATII | Caseta …” în Denumire | oferta are IZOLATII în coloana A | codul de rând merge în Identificare_Norma; grosimea nescrisă apare în denumire („, gr. 50 mm”) |

Acum: **98 de prețuri exacte din 98**, 0 diferite; după „Confirmă toate cele 13”,
registrul are rândurile ofertei semnate (Identificare, UM, cantitate, preț
unitar, total pe linie) și totalul 92.278,36 € = 94.575,06 − distribuitorul.
Distribuitorul de abur (2.296,70, `g100 D=500, L=4500, 10 racorduri`) nu iese
din nicio regulă de listă — echipament la comandă, rămâne al omului. Testul
„cererea TRANSAVIA importată reproduce Oferta 284 semnată” ține cifra.

**Oferta 27.04.2026 (NISAL).** Același exercițiu, pe oferta semnată: 43 → 48
de prețuri exacte, 41 → 45 de poziții pe ofertă.

| Ce | Dovada | Acum |
|---|---|---|
| Tubulatură rectangulară, UM „m²” | 79,73 = vată 50 pe mp + tablă pe mp; „m²” se citea „m” | tarifată pe mp (`tarifeazaPeMp`), exact |
| Elastomer „S=20mm” | 3 din 3 semnate cu prețul de 19 mm | 20 → 19 cu notă (`ECHIVALENTE`) |
| Peste ø219 | formula scrisă a firmei dă exact DN250 / 19 mm (23,13); SPIRO ø250 / ø315 semnate cu 0,13 € peste ea | formula firmei, marcată `peste_lista` |
| Canal de desfumare EI60 | semnat 48 €/m²; din vată pe mp ar fi ieșit 22,22 (−54%) | fără preț, `protectie_foc_tubulatura` (întrebarea 8); prinde și Book15 „fire-resistant” |
| „20 to 50mm” (Book15, 4.148 m²) | interval, nu grosime | grosime necompletată, a omului |
| ø90, ø160, DTIP8, țeava de inox Ø125 | ø160 semnat și în sus, și în jos, în aceeași ofertă | neschimbate, marcate (întrebarea 3) |

Celelalte cereri (Book15, Flower City, spital, Transavia inox) n-au ofertă
semnată pereche, deci n-au cu ce fi comparate linie cu linie. Pe ele s-a
verificat doar că nimic nu se tarifează tăcut greșit: tot ce e nou are preț
dovedit sau stă la „De validat”.

**Ecranul de import.** Meniul se pliază singur cât e un fișier deschis —
temporar, fără să schimbe preferința; redeschis de om, rămâne deschis. Foaia
ca în Excel încape pe lățimea ecranului: `table-layout: fixed`, coloanele goale
nu se desenează, descrierea cedează loc și se rupe pe rânduri, coloanele
noastre sunt două („Am înțeles · preț”, „Stare”) cu butoanele pe un rând. Sub
~1000 px de ecran de import pornește ca listă. Verificat cu Playwright: 10
fișiere × 5 lățimi (390–1920 px), zero derulare laterală, nicio eroare.

**Rămâne deschis din audit:** cuprul se convertește încă pe seria de oțel,
nemarcat (DN15 → rândul 22 în loc de 18) — azi nu apare în niciun fișier, dar
prima cerere cu cupru ar ieși greșit tăcut. Și confuzia între două numere care
apar amândouă în text („inox 304 Di89”) nu o prinde niciun validator.

## 25 septembrie 2026 (2): cererile fără ofertă, citite linie cu linie

Firma nu e disponibilă până săptămâna viitoare; scopul e un produs cât mai
corect până atunci, ca întrebările să fie puține. Pe cererile fără ofertă
semnată (spital, Book15, Flower City, Transavia inox) am citit fiecare poziție
„Gata” și am căutat prețuri care ies tăcut greșit. A/B pe cele 10 fișiere după
fiecare reparație: s-au mișcat doar rândurile de mai jos.

| Problemă | Efect măsurat | Acum |
|---|---|---|
| „tabla zincata de 0. 6 mm” (spațiu după punct), spital r137 | 83,19 €/mp „Gata” pe 2.564 mp (213 k€), cu tabla la 0,8; r136, identic cu „0.6”, era refuzat | citit 0,6, refuzat ca r136 (`fara_pret_pe_mp`) |
| Elastomer cu UM „buc.”, fără piesă, spital r26–28 | 750 buc. × preț pe ml, „Gata” | preț pe ml, „De verificat” (`um_bucata`) |
| „Di76, g48 - COT”, Transavia inox r30 | primea 50 mm de la conductă, încredere 0,99 (azi blocat de inox, după întrebarea 15 ar fi ieșit tăcut) | grosimea scrisă nu se completează |
| „țeavă din inox” | adăuga o jachetă de inox necerută | inoxul e jachetă doar lângă tablă / casetă / jacket |
| NISAL r83, livrare de țeavă de inox cu izolația „inclusiv” | din liste 14,68, semnat 20,09; nicio combinație nu dă 20,09 | refuzat, `livrare_teava` |
| Țeavă de cupru în DN | DN15 pe rândul 22, nemarcat | seria de cupru a firmei (DN15 → ø18), `serie_cupru` |
| Țeavă de inox în DN | ISO, nemarcat | ISO, `serie_inox` |
| Model: „inox 304 Di89” citit 304 | niciun validator | `diametru_nenotat`; 0 alarme pe 575 de linii citite de reguli |

Spitalul, pe stratul determinist: 1.454.100 → 1.240.778 € tarifat, 3 poziții
în plus la „De verificat”, una în plus fără preț. Celelalte fișiere: aceleași
prețuri; NISAL r83 rămâne fără preț, cu cauza corectă.

**Importul cu model** (pasul 2 din „Ce urmează”, gpt-4.1-2025-04-14,
`IZOREP_CONCURENTA=1` — cu 4 loturi în paralel contul lovește plafonul de
30.000 TPM). Pe spital modelul citește 81 de linii, pe Book15 2, pe Flower
City 0. Ce ieșea greșit „Gata”:

| Ce | Efect | Acum |
|---|---|---|
| Foile „țeavă … + izolație” (spital, 58 de rânduri): livrarea țevii cu fitinguri, susțineri și izolația inclusă | tarifate ca izolație, „Gata” | `livrare_teava`, fără preț (ca NISAL r83) |
| „izolație 20 mm protejată cu **folie** de aluminiu” | modelul adăuga tablă: 23,31 €/ml în loc de 6,23 | `strat_necitat` |
| Book15 r48, „jacketing 0.6 – 0.8 mm”, 1.850 m² | „Gata” pe 0,8 (110 k€) | `grosime_interval` |
| „Protecție mecanică … tablă zincată min 0,5 mm” (13 rânduri, 360 k€) | modelul citește 0,5 → fără preț; determinist 0,8 la „De verificat” | neschimbat; e întrebare (tabla zincată pe mp) |

Rejucat pe răspunsurile salvate ale modelului: pe spital, **zero** poziții
citite de model mai ies „Gata”. Cele trei avertismente noi, puse pe cele 617
poziții citite de reguli din cele 10 fișiere: 2 aprinderi, amândouă rândurile
cu interval din Book15.

Golden nou: `tests/golden/cerere-de-oferta-spital.json` (101 linii ale
modelului; niciuna cu preț „Gata”). `scripts/golden.ts` tarifa la înregistrare
fără textul rândului, iar testul rejoacă cu el: un golden proaspăt pica pe
regulile care depind de text. Acum amândouă îl folosesc.

**Prețul pus de mână.** Pozițiile fără regulă în liste (distribuitorul de
abur, livrarea țevii cu izolație, protecția la foc) n-aveau cum ajunge în
ofertă, deci registrul generat rămânea mereu sub cel semnat. Acum omul pune
prețul unitar în editor (vezi `ui.md`). Cererea TRANSAVIA importată, cu
distribuitorul la 2.296,70 și cele 13 celule deduse confirmate, dă **94.575,06
€ = Oferta 284**, la ban (test în `oferte-semnate.test.ts` și verificat în
browser).

## 28 septembrie 2026: casetele TRANSAVIA pe calea cu model

Raportat de Andrei din ecran (cu `npm run dev`, deci cu model): cererea Abur
ieșea 67 Gata / 32 De verificat / 0 Fără preț, cu „Citit nesigur din text” pe
casete cu prețul exact al Ofertei 284. Determinist ieșea 85 / 13 / 1.

| Problemă | Efect măsurat | Acum |
|---|---|---|
| Casetele fără grosime plecau la model, deși grosimea vine de la conducta de același DN (`grosimiDeLaConducte`) | modelul întorcea încredere 0,85 într-o rulare, mai mică în alta: toate 24 „Gata” sau toate „De verificat”, fără motiv | `completeazaDinConducte`: rămân ale regulilor, nu mai pleacă la model; două rulări cu model = determinist |
| Distribuitorul de abur, citit de model ca țeavă D=500 | 191,83 € „De verificat” (semnat 2.296,70, −92%); determinist „Lipsește diametrul” | `echipament`, fără preț, „preț de pus manual” |

2.296,70 = 17,5 × prețul pe ml la ø500 g100, dar 17,5 nu iese din nicio regulă
(L = 4,5 m, coeficientul de distribuitor 4,5, 10 racorduri) — o valoare,
nededusă. A/B pe cele 10 fișiere: s-a mișcat doar cauza distribuitorului.
Verificare linie cu linie, cu și fără model: TRANSAVIA 98 / 98 prețuri și
99 / 99 cantități; NISAL 48 exacte, cele 9 diferite toate „De verificat”
(întrebările 3–4); Matari 53 / 53; DN → ø → rând pe 209 linii, zero abateri.
Browser, cu model: 85 / 13 / 1, un apel (distribuitorul). 554 de teste.

## 28 septembrie 2026 (2): produsul pentru demo, prototipul de stoc

Adrian merge la firmă să arate ce e făcut; ținta a fost un produs corect și
coerent cu ce avem, plus primul ecran de stoc. Planul complet a fost aprobat de
Andrei; întrebări pentru firmă nu intră aici.

| Ce | Efect | Acum |
|---|---|---|
| Lucrările 118 / 118.1 în datele demo | 341.038,78 / 25.384,08 €: dublate față de ofertele semnate | 170.519,39 / 12.692,04, cu test pe fișiere (`tests/seed.test.ts`) |
| Anexa 5997 | 585,40 € din 10 rânduri | 706,90 din 16, emisă de R&F ISORAD |
| Perechea TRANSAVIA | lipsea; „d-transavia” era cererea de inox, cu dată inventată | cerere → Oferta 284 (Grup Energoinstal, 91.737,81 după discount) → lucrare; inoxul fără dată |
| „Poză cu foaia de măsurători … vision”, „categoria clientului decide lista” | funcții care nu există | scoase; textul descrie importul real |
| Calcul deviz | eticheta „SistemMatrice”, exemplul „netarifabilă” avea preț | „Material”, tip ofertă, exemplu chiar refuzat, notele de verificat marcate |
| Tabelele pe telefon | derulau lateral în interior pe aproape toate ecranele | rândul devine card (`tabel()`), zero derulare |

**Necesarul de materiale** (`src/stoc/necesar.ts`): strat cu strat, din
pozițiile cu preț, m²/ml = π × (φ + 2g) / 1000 (formula registrului firmei, π
întreg), piesele în bucăți, adaos ales pentru coturi și fitinguri (registrul:
5–10 %). Pe cererea TRANSAVIA: 21 de materiale, toată vata pe metru din ofertă
ajunge în necesar; doar distribuitorul rămâne fără.

**Registrul de stoc** (`src/stoc/registru.ts`): stocul e suma mișcărilor, o
greșeală se anulează cu mișcarea inversă, soldul negativ e marcat. Ecranul
„Depozit și stoc” și cardul „Materiale necesare” sunt în `ui.md`.

Verificat în browser, pe dev și pe build-ul de producție: fluxul demo cap-coadă
(import → 13 confirmate → distribuitor 2.296,70 → 94.575,06 € → ofertă
descărcată → necesar → depozit → exemple → intrare → anulare → reîncărcare →
tabloul de bord) și cele 8 ecrane × 5 lățimi × 2 teme × 2 roluri: 160 de
verificări, zero derulare, zero erori.

## Pentru întâlnirea cu firma (25 septembrie 2026)

Varianta scurtă, de dus la firmă: `docs/intrebari-firma.md`. Ordonate după
cât deblochează pe cele 10 fișiere. Tot restul s-a dedus din
date și e în cod, marcat unde dovada e subțire. Numerele din paranteză sunt cele
din lista completă de mai jos (codul le citează).

**Două documente, care închid mai multe întrebări deodată:**

- **D1. Oferte semnate pe cereri pe care le avem** — mai ales pe
  `cerere-de-oferta-transavia-inox.xlsx` (72 de poziții blocate), apoi spital,
  Book15, Flower City. Fiecare pereche devine un test ca TRANSAVIA și confirmă
  sau răstoarnă regulile deduse dintr-o singură ofertă (11, 15, 18). Ideal și
  două cereri de la același client, din proiecte diferite (11).
- **D2. Listele lipsă:** ~~rafinărie (13)~~ (amânată), manopera dacă e scrisă (5), PVC și
  închiderile la foc pe industrial (14).

**Șapte întrebări:**

1. **Tabla de inox: grosimea implicită, 0,4 / 0,5 / 0,6 mm?** (15) Clienții n-o
   scriu; lista are toate trei. 72 de poziții Transavia inox; la r140: 40,25 /
   45,57 / 50,89 €. Dacă vine D1, se citește din ofertă.
2. **Tabla zincată ca protecție mecanică, pe mp.** Spitalul cere „tablă zincată
   min 0,5 mm” (13 rânduri) și „0,6 mm” (6 rânduri), ~14.600 mp. Lista
   rezidențială are pe mp doar aluminiu 0,8 (59,51 €), industrialul și 0,6
   (45,00). Zincata se tarifează ca aluminiul? Ce preț pe mp la 0,6 pe
   rezidențial?
3. **„Țeavă + izolație” — livrarea țevii cu fitinguri, susțineri și izolația
   inclusă** (spital, 4 foi, 58 de rânduri; NISAL r83). O ofertați, sau doar
   izolația? NISAL r83 e semnat 20,09 €/m, iar vata 50 pe ø125 din listă dă
   14,68 — ce mai intră? Azi: fără preț, cu preț pus de mână.
4. **Protecția la foc a tubulaturii** (8) — EI60/120/180, torcret Parafoc
   20–40 mm (spital, 28 de rânduri; Book15, 2.233 mp). O ofertați? De unde
   48 €/m² la canalul EI60 din Oferta 27.04.2026?
5. **Diametrele între rânduri și peste listă** (3, 4), 19 poziții:
   a) la 1 mm peste un rând (ø90, ø160): rândul de jos sau de sus? În aceeași
   ofertă, țeava ø160 a luat 169 (14,37), iar SPIRO 160 a luat 159 (14,16);
   PEHD ø90 a luat 89.
   b) peste ø219: formula voastră cu 3,14 dă exact DN250 / 19 mm (23,13), dar
   SPIRO ø250 și ø315 cu 9 mm ies exact (16,36 și 20,30) doar cu π și φ + 20
   mm, adică 10 mm pe parte. Care e calculul?
6. **Confirmări da / nu** — reguli aplicate azi, cu poziția la „De validat”:
   - vata 40 mm pe DN15 = 7,90 €/ml, proporțional din rândul următor (18);
   - elastomer „20 mm” = prețul de 19 mm;
   - țeava de cupru în DN pe seria cuprului: DN15 → ø18 (tevi.md, 3); și
     țeava de inox?
   - UM „buc” pe izolație dreaptă (spital, 750 buc.): bucata e tubul de 2 m
     sau metrul?
   - un Ø scris lângă un DN care nu-i corespunde bate DN-ul (17);
   - elastomer „până la ø60 → 13 mm” include DN50 (16).
7. **Segmentul** (12): Oferta 284 e industrială, dar tarifată pe lista
   rezidențială. Se deduce din client sau din obiectiv, ori îl alege omul?

**Pentru etapele următoare** (nu blochează ofertarea): stocul — aplicația sau
Saga (1); cine emite și trimite factura în SPV (2); cele două firme (6);
cursul la facturare (7).

## Întrebări deschise către firmă

Astea blochează arhitectura, nu doar implementarea:

1. **Cine ține stocul oficial — aplicația sau Saga?** Determină tot modulul de
   stoc și cine răspunde pentru SAF-T.
2. Cine emite factura și cine o trimite în SPV?
3. La ø90 și ø160, care e regula corectă de rotunjire? (Rotunjirea la stratul
   de jachetă e acum lămurită de Oferta 284 — **în sus**. ø90 și ø160 rămân.)
   Până la răspuns, pozițiile la 1 mm peste un rând ies cu prețul „în sus" și
   **marcate** — pe cele 10 fișiere, 7 linii.
4. Există listă de prețuri pentru elastomer peste ø219? Nici lista industrială
   nu trece de ø219, deci întrebarea e acum pe amândouă segmentele. Din 25
   septembrie 2026 se aplică formula firmei pe mp, marcat: pe Oferta 27.04.2026
   dă exact DN250 / 19 mm, dar SPIRO ø250 / ø315 au fost semnate cu 0,13 € mai
   sus. Care e calculul exact?
5. Lista de manoperă e scrisă undeva sau se negociază de fiecare dată?
6. Cum se împart cele două firme (RADOIA ISOLIRUNG / R&F ISORAD SYSTEM)?
7. Care e regula de curs folosită azi la facturare — BNR din ziua anterioară,
   din ziua facturii, sau cursul din contract? (De verificat cu contabila.
   Până atunci `CURS_BNR` rămâne constantă: cursul contează abia la facturare.)
8. „Protecție la foc pentru tubulatură" (28 de rânduri în `cerere-de-oferta-spital.xlsx`) e o
   lucrare pe care o ofertați? Nu are listă de prețuri printre cele primite.
   Oferta 27.04.2026 are canalul de desfumare EI60 la 48 €/m² — de unde vine?
9. ~~**Coturile și teurile de vată minerală sub ø76.**~~ **Răspuns 11
   septembrie 2026: e regula firmei.** Prețul e tabla la rândul geometric, fără
   stratul de vată; nota de proveniență rămâne, validarea obligatorie a căzut.
10. ~~**SPIRO ø160.**~~ **Răspuns 11 septembrie 2026: la spiro nominalul e
    diametrul exterior.** Rotunjirea lui ø160 (159 sau 169) a trecut la
    întrebarea 3.
11. **Două liste de cantități de la același client, din proiecte diferite.**
   Cele 9 fișiere pe care le avem vin de la clienți diferiți, deci reutilizarea
   șabloanelor între proiecte — tot câștigul lui L4 — nu se poate măsura.
   Vezi `plan-l1-l4.md`.
12. **Cine alege segmentul de preț și după ce regulă?** Oferta 284 e o lucrare
   industrială (Transavia, abur) tarifată pe lista rezidențială. Dacă alegerea
   e a omului la deschiderea lucrării, e un câmp pe lucrare. Dacă se deduce din
   client sau din tipul obiectivului, e o regulă. **Din 12 septembrie 2026** omul
   alege segmentul la import; rămâne de aflat dacă se poate deduce și dacă
   trebuie scris pe lucrare, în bază.
13. ~~**Lista de prețuri pentru rafinărie.**~~ **Amânată, 29 septembrie 2026:**
   momentan lucrăm doar rezidențial și industrial; locul pentru rafinărie rămâne.
14. **PVC și închiderile goluri la foc pe industrial.** Nu au venit în pachetul
   industrial. **Răspuns pentru închideri, 29 septembrie 2026:** rezidențial +
   20 %, pe totalul lor. PVC-ul rămâne pe rezidențial, cu notă de verificat.
15. **Tabla de inox.** Două întrebări acum, prima fiind cea care blochează:
   - **Care e grosimea implicită — 0,4, 0,5 sau 0,6 mm?** Lista are toate trei
     la fiecare diametru, iar clienții nu scriu grosimea jachetei niciodată.
     Fără răspuns, toate cele 72 de rânduri de inox din `Izolatii Transavia`
     rămân marcate. La rândul 140 diferența e 40,25 / 45,57 / 50,89 €.
   - Se ofertează inox și pe **rezidențial**? Fiind singurul sistem fără listă
     rezidențială, prețul vine azi din cea industrială chiar când restul
     straturilor sunt rezidențiale; poziția poartă `note`, nu e tăcută.
   (Benzile de multiplicatori sunt confirmate identice cu ale aluminiului.)
16. **Elastomer „până la ø60 → 13 mm": intră și DN50 (ø60,3)?** Rândul 60 din
    listă e chiar DN50, deci codul îi propune 13 mm; la fel DN200 (ø219,1) →
    19 mm. E interpretarea noastră, aliniată cu toleranța motorului.
17. ~~**Oferta 27.04.2026, rândurile 44–47.**~~ **Lămurit din date, 15 septembrie
    2026:** descrierea română scrie Ø20 / 25 / 32 / 40 mm, adică seria de PP-R,
    nu DN-ul de oțel din coloana germană. Oferta a tarifat pe Ø, deci corect, iar
    codul face la fel. De confirmat doar că regula „Ø-ul scris bate DN-ul care
    nu-i corespunde" e a firmei.
18. **Grosimi care nu sunt în listă, dar au preț în oferta semnată.** Oferta 284,
    casetele de armături DN15 cu vată 40 mm: lista n-are celula 22|40, oferta are
    47,41 €. **Dedus din date, 25 septembrie 2026:** ambele poziții (ml și
    casetă) dau vata 7,90 = 7,9522 × 6,8157 / 6,8569, proporția rândului 28 la
    30 mm. Codul o aplică marcat; de confirmat că e regula firmei pentru golurile
    din listă.

## Ce urmează

**Pe import rămân doar lucruri mici:** fiecare pereche nouă cerere ↔ ofertă
semnată devine test, ca TRANSAVIA; comparația dintre modele se face abia când
există răspunsul corect; bara de filtre a fișierelor cu o singură foaie, adusă
la așezarea registrelor cu mai multe foi. Rafinăria și manopera — liste care
n-au venit (D2); rafinăria e amânată, nu scoasă.

**Făcut pe 28 septembrie 2026:** prototipul de stoc (etapa A de mai jos) și
lustruirea pentru demo. Mai departe, în ordine:

- **B. Fundația multi-utilizator.** Server HTTP, autentificare, rolurile pe
  server; oferta importată devine document imutabil în Postgres (versiuni,
  preț copiat, legat de `SesiuneImport`), lucrarea se creează din oferta
  acceptată. Gata când: TRANSAVIA salvată și redeschisă pe alt calculator dă
  94.575,06 € la ban.
- **C. Stocul real, în bază.** Tabele `articol`, `depozit`, `miscare` cu RLS pe
  tenant și firmă, trigger care refuză UPDATE / DELETE pe `miscare` (ca la
  `lista_preturi`), soldul ca view; `src/stoc/` rămâne logica comună. Necesarul
  devine rezervare pe lucrare.
- **D. Situații de lucrări.** ~~Prototipul~~ făcut pe 29 septembrie 2026
  (ecranul Lucrări, în browser). Rămâne: formatul situației al firmei (cerut),
  pozele din carnet ca sursă pentru cantitățile executate, consum real față de
  necesar, pe lucrare.
- **E. Contabilitate.** Facturi, curs BNR înghețat pe document, e-Factura,
  export spre Saga.

**Întrebări de stoc pentru firmă:**

1. Saga ține stocul oficial? Dacă da: aplicația ține stocul operativ și
   exportă. Dacă nu: emite NIR, bon de consum, avize numerotate și intră în
   SAF-T — mult mai mult.
2. Câte depozite; materialul stă și pe șantier sau în mașini; se urmărește pe
   lucrare?
3. Cine înregistrează mișcările (gestionar, șef de echipă) și cine aprobă?
4. Evaluarea stocului: cost mediu sau FIFO?
5. Cele două firme: stoc comun sau separat? (6)
6. Fișierele „calcul preț” (`nefolosite/`, marcate NUUUU) au costul de
   manoperă și de material pe ml, pe ø × grosime — baza pentru marjă și pentru
   valoarea consumului. Sunt actuale?

De cerut: exportul de stoc și nomenclatorul din Saga, 2–3 facturi de
furnizor, un bon de consum sau aviz, ultimul inventar, și forma de cumpărare
(m² pe rolă de vată la fiecare grosime, tuburile de elastomer, tabla în coli
sau rolă, accesoriile).

## Comenzi

```bash
npm test                                       # 384 de teste (motor, import, baza, ofertă, șantier)
npm run typecheck
npm run dev                                    # UI local, /izorep/
npm run import -- ../attachments/clienti/cerere-de-oferta-spital.xlsx   # pipeline complet
npm run import -- <fisier> --fara-model        # doar determinist
npm run golden -- <fisier.xlsx>                # inregistreaza iesirea modelului
npm run golden -- --verifica                   # cauta deriva modelului
npm run compara-poze -- gpt-5.5-2026-04-23 gpt-5.6-terra --repetari 3   # modelele pe pozele de santier
npm run mapare -- <fisier.xlsx>                # inregistreaza maparea de coloane
IZOREP_FARA_MAPARE=1 npm run import -- <fisier>  # masoara A/B fara L1
python scripts/extract_price_lists.py ../attachments   # regenerează prețurile
python scripts/extract_conversii.py ../attachments     # regenerează seriile de țevi
npm run db:up && npm run db:migrate && npm run db:seed  # baza locală
npm start                                      # baza, serverul (8787, doar local) și vite, împreună
```
