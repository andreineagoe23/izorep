# Stare curentă

> Unde am ajuns, ce s-a decis și ce urmează. Actualizează la fiecare etapă.
> Ultima actualizare: 26 noiembrie 2026.

## 26 noiembrie 2026 (seara târziu): testul complet

Cerut de Andrei: „testează tot software-ul la maxim”. **845 de teste**, nimic sărit. Ramurile vechi
(`plan-simplificare`, `main-backup`, `cloud-design`, `ux-lucrare`) șterse, local și pe GitHub; singurul
lucru care nu era pe `main` era `docs/plan-simplificare.md` (planul vechi, înlocuit de `plan-ux.md`),
recuperabil din commit-ul `4838e1a`.

**Ce s-a testat:**

| Strat | Cum | Rezultat |
|---|---|---|
| Suita | typecheck, toate testele, build | trece |
| Bază nouă de la zero | `izorep_full`: migrări, seed, `npm run demo` | RAD118.1 12.692,04 · RAD118 163.979,93 · RAD284 91.737,81, ca în documentație |
| Oracol independent | `scripts/oracol/*.py` calculează prețul din JSON-urile listelor, fără motor; două cereri inventate (34 + 9 rânduri, două formate), ambele tipuri de ofertă | **86 / 86** (după trei corecturi ale oracolului, toate greșeli ale lui, nu ale motorului); rămâne test: `tests/oracol.test.ts` |
| Fluxul în browser | ISORAD, industrial: cerere → filele ca în oracol → întrebări (7) → „E bine” → −5 % → bifa de foc → ambele descărcări → acceptare → materiale → comenzi → recepție → facturi → situație → închidere | totalurile egale cu oracolul în toate cele 5 locuri (30.221,73 €); lucrarea la ISORAD › Închise |
| Toate ecranele | 47 de rute × 390 / 768 / 1440 / 1920 px, ambele teme | 0 erori, 0 derulare laterală; nicio țintă sub 40 px (în afară de caseta de fișier, ascunsă în eticheta mare) |
| Serverul | fără cont, fără `X-Izorep`, 5 parole greșite, antetele | 401, 403, 423 (blocat de pe calculator), CSP / `nosniff` / `DENY` / `no-store` |
| Text periculos din fișier | `<img onerror>`, `<script>`, `<svg onload>` în descrieri și în numele foii | nimic executat, nimic injectat |

**Ce a găsit și s-a reparat** (`07acca6`):

| Greșeala | Acum |
|---|---|
| Cu oferta descărcată și rânduri rămase „Fără preț” (întrebările), „Urmează” stătea pe „Verifică”: „Clientul a acceptat” nu mai apărea, șantierul nu se putea porni | cu oferta salvată, pasul e răspunsul clientului: „Oferta ISO501 e făcută din 26.11.2026. 6 poziții nu sunt în ea. Ce a răspuns clientul?” |
| Necesarul pe tubulatura rectangulară în metri: socotit ca o țeavă de ø0 (500×400, vată 40, 30 ml → 8,25 m² în loc de 64,68) | prețul poartă `suprafata_mp` (2 × (A + B + 2g) / 1000), iar necesarul comandă din ea. A/B pe 3.706 rânduri: niciun preț schimbat |
| **Casetele `type="number"`: „2,97” tastat devenea 297** (Chrome aruncă virgula, caseta rămâne „validă”): prețuri, cursul, cantități, numărătoarea, ajustarea și discountul | toate 41 sunt text cu `inputmode="decimal"`, citite cu `numarScris` („2,97”, „1.250”, „12.5”); test-gard: nicio casetă `type="number"` în `web/` |
| Valoarea așteptată a comenzii: „19.951,3 lei” | banii pe Comenzi cu două zecimale |

**Neacoperit:** modelul real (costă din contul OpenAI al firmei; nefolosit fără acordul lui Andrei),
Excel / LibreOffice (nu sunt pe calculator), pozele din carnet citite de model, Render cu mâna.

## 26 noiembrie 2026 (noaptea, târziu): Etapa 7, mărunțișurile din predări

> Etapele 1, 2, 4 (fără Conlit), 5, 6 și 7 sunt pe `main` și pe Render din seara de 26 noiembrie.
> Ramurile pomenite mai jos (`etapa-…`) s-au șters după unire.

Pe `etapa-7-maruntisuri`. **837 de teste**, nimic sărit.

| Ce | Acum |
|---|---|
| „Clientul a acceptat” pica cu „Scrie întâi obiectivul…” pe o ofertă descărcată cu obiectivul gol | „Obiectiv (numele șantierului)” e obligatoriu la descărcare |
| Propoziția de pe fila Cerere tăcea despre rândurile lăsate afară („Toate cele 99 au preț.”) | „… 3 rânduri cu cantitate au rămas afară: vezi „Lăsate afară”.” |
| Titlul lucrării lua numărul de ordine din numele fișierului („1 Fabrica Demo Abur”) | `clientPropus` taie numărul din față urmat de litere: „Fabrica Demo Abur” |
| UM gol în ofertă la „Di60, g40 - ML” fără coloană de UM (exemplul 1) | `umLinie`: UM-ul clientului; fără el, din piesă (ml, buc; m² pe suprafață, buc la goluri) |

Văzut în browser, din ce era nevăzut în predările vechi: „Lăsate afară” pe NISAL (3, „E izolație” pe
unul) și pe spital (58), la 1920 px pe tema închisă; zero derulare laterală, zero erori.

Rămân din Etapa 7, nefăcute aici: necesarul (placa de vată fără grosime, PVC fără preț de cumpărare,
elastomerul Ravago pe cutie) cere datele firmei; modelul real cere cheia și bani; ramura
`plan-simplificare` se șterge doar cu acordul lui Andrei.

## 26 noiembrie 2026 (noaptea): Etapa 4 fără Conlit, ± % pe poziție și bifa de foc

Pe `etapa-4-procent-rand`. **833 de teste**, nimic sărit. Nicio migrare. Lista Conlit (N7) așteaptă
prețurile furnizorului.

| Ce | Acum |
|---|---|
| Discount sau adaos doar pe toată oferta (N8) | **± % pe rând**: pe rândul deschis, sub preț, căsuța „± %” (−5 = mai ieftin, 10 = mai scump). Bate ajustarea pe toată oferta pentru rândul lui (ca prețul pus de mână, care rămâne final și n-are căsuța); discountul de la sfârșit se aplică peste tot. Pe rândul text: „6,73 −10 %”. Stă pe linie (`procentRand`, `cuProcente` în `web/oferta.ts`), deci ajunge în oferta salvată (serverul o socotește din linii), în plan și în fișierul clientului; „Cum a fost calculată oferta” listează rândurile |
| +20 % la foc pe industrial, automat (C2: firma nu știe de unde e) | **Bifă** în cardul „Prețul”, doar pe industrial cu închideri la foc: „Adaugă 20 % pe totalul închiderilor la foc”. O cerere nouă pornește cu ea **oprită** (planul). Fără bifa scrisă (ofertele și cererile de dinainte) rămâne pornită: Matari pe industrial tot 15.230,45 € |

Verificat în browser (1440, 390 px): exemplul 2 pe industrial, bifa oprită (41.850,68 €), bifată
(+287,62 €), −10 % pe DN15 (7,48 → 6,73 €, oferta −240 €), procentul rămâne la reîncărcare.

## 26 noiembrie 2026 (seara): Etapa 6, întrebările pentru client

Pe `etapa-6-intrebari`. **829 de teste**, nimic sărit. Nicio migrare (numărul întrebărilor stă în
lucrul cererii, ca `deVerificat`).

- **Fila Cerere**: „5 lucruri de întrebat clientul.” cu „Scrie întrebările”: textul de email (rândul din
  fișierul lui, descrierea între ghilimele, întrebarea), „Copiază textul”, „Descarcă Excel” (cu o
  coloană goală „Răspunsul”). `web/import/intrebari.ts`, teste în `tests/intrebari.test.ts`.
- **Ce se întreabă**: grosimea, materialul izolației, tabla fără material, diametrul (dimensiunile la
  tubulatura rectangulară), golul, diametrul și materialul țevii la gol, dimensiunile echipamentului,
  „buc” fără piesă, rândul fără UM. Nu: grosimea care nu e în listă, peste listă, demontarea,
  protecția la foc (prețul e al nostru, nu o lipsă a clientului).
- **„Urmează” și Acasă**: cu tot ce a rămas întrebări, „Așteaptă răspunsul clientului la 5 întrebări.”
  („Scrie întrebările”, „Mergi la ofertă”), pe Acasă la „Așteaptă răspunsul clientului”; cu altceva
  de verificat, „9 poziții cer să te uiți (5 sunt întrebări pentru client).”
- Pe exemplul 2: exact cele cinci lipsuri puse de Adrian; pe Matari, cele 12 goluri EI180.

Verificat în browser (1440, 390 px, ambele teme): cardul, textul, copierea (clipboardul = textul),
Excelul, Acasă; zero derulare laterală, zero erori. Cererile salvate înainte nu au numărul: îl primesc
la prima deschidere.

## 26 noiembrie 2026 (după-amiază): Etapa 5, oferta în fișierul clientului

Pe `etapa-5-fisier-client`. **822 de teste**, nimic sărit. Nicio migrare; dependență nouă
directă: `jszip` (era deja, prin ExcelJS).

Pe fila Ofertă, lângă „Descarcă oferta”: **„Descarcă în fișierul clientului”** (alb, doar când
cererea e un `.xlsx`). Salvează oferta ca butonul vechi, apoi descarcă fișierul clientului cu
„Preț unitar (€)” și „Valoare (€)” după ultima coloană cu conținut a fiecărei foi, pe rândurile
din ofertă; sub ultima poziție a foii (cu preț sau fără): totalul, apoi adaosul de foc, discountul
și totalul general, când sunt. Cu mai multe foi: „Total foaia X” pe fiecare, „TOTAL OFERTĂ” pe
ultima. Etichetele coloanelor stau pe rândul de antet; fără antet (TRANSAVIA începe pe rândul 1),
sub totaluri. `web/oferta-client.ts`, teste în `tests/oferta-client.test.ts`.

Verificat: pe toate cele 13 fișiere de client și pe cele două exemple, fiecare fișier din arhivă
pe care nu-l atingem iese octet cu octet, fiecare celulă a clientului cu conținut iese identică
(XML-ul ei), prețurile și valorile sunt ale ofertei; deschise cu ExcelJS și openpyxl. În browser
(1440 și 390 px): TRANSAVIA cu distribuitorul confirmat → 94.575,06 € sub ultima poziție, ca Oferta 284.

Decise de noi (se pot întoarce):

- **Valori, nu formule**: o formulă peste cantitatea clientului ar depinde de coloana citită de
  noi, iar Excel ar putea recalcula alt total decât oferta salvată.
- **Celulele goale doar formatate nu împing coloanele noastre**: unele foi au chenar până la Z.
  O celulă goală formatată din coloana noastră se înlocuiește; peste conținut nu se scrie niciodată.
- **Totalul sub ultima poziție a foii**, nu sub ultima cu preț: pe Matari golurile EI180 (fără preț)
  sunt la sfârșit, iar totalul ar fi stat printre ele.
- **Nicio verificare în Excel sau LibreOffice**: pe calculator n-avem niciunul. De deschis o dată în
  Excel înainte de primul trimis.

## 26 noiembrie 2026: Etapa 1 văzută în browser, Etapa 2 (lucrările pe firme)

Pe `etapa-1-import` (o reparație) și `etapa-2-firme` (ramura nouă, pornită din ea), baza
`izorep_e1`. **815 teste**, nimic sărit. Nicio migrare.

| Ce | Acum |
|---|---|
| „Treceri prin planșee rezistente la foc EI120” (exemplul 2, D07–D08): antetul nu era recunoscut, iar țeava PP 50 și patul de cabluri, cu golul scris, stăteau la „Lăsate afară” | `TRECERI_PRIN_PERETI` ia și „planșee”: 26,89 „Gata”, respectiv 26,89 „De verificat” (`pat_cabluri`), ca în cheia lui Adrian. A/B pe 3.706 rânduri: doar aceste două, pe ambele tipuri |
| Lucrările ambelor firme într-o singură listă (N1) | **Lucrări**: filele RADOIA · ISORAD (cu cifra) pe rândul lui „Cerere nouă”, stadiile dedesubt; `#/lucrari?firma=…&stadiu=…`. „Cerere nouă” pornește pe firma filei; „← Toate lucrările” se întoarce la fila firmei |
| Firma se alegea abia pe fila Ofertă | **Cerere nouă**: „Firma” lângă „Tip ofertă”, implicit ultima aleasă (`ultimaFirma` / `tineFirma`, în browser); intră în antetul cererii la prima deschidere. Pe Ofertă se schimbă ca înainte, iar lucrarea trece la cealaltă filă |
| Clienții și Acasă fără firmă | **Clienți** pe aceleași file (un client cu lucrări la amândouă apare la amândouă); **Acasă** cu ambele, firma în fața lucrării pe fiecare rând; pagina lucrării o are pe rândul de sub titlu |

Decise de noi (se pot întoarce):

- **Firma lucrării** (`firmaLucrare` în `web/lucrare.ts`): șantierul, apoi cererea, apoi seria
  ofertei (RAD / ISO). **Fără nimic scris: RADOIA**, nu o filă „Fără firmă”: e firma pe care o pune
  formularul ofertei, deci lista spune ce ar ieși pe antet. Cererile vechi fără antet sunt puține
  și se mută dintr-o alegere pe Ofertă.
- **Țeava fără material la gol** (D06, „Teava DN100 | 320/320”) rămâne „Gata”: prețul închiderii
  vine doar din suprafața golului (banda și colierul nu intră, Matari), deci materialul nu schimbă
  niciun ban. Planul o voia „Fără preț”.
- **Fără „Toate”** peste cele două firme: firma a cerut „2 foldere”.

## 23 noiembrie 2026: după demo, importul întreabă clientul (Etapa 1)

Din notițele lui Adrian de la firmă (16 noiembrie) și răspunsurile pe
`docs/intrebari-firma-3.md`; planul întreg în `docs/plan-dupa-demo.md`. Pe
ramura `etapa-1-import`, baza `izorep_e1`. **810 teste**, nimic sărit. Regulile
noi sunt în `pricing.md` și `import.md` (secțiunile din 23 noiembrie).

A/B pe toate fișierele clienților și pe cele două exemple, ambele tipuri de
ofertă (3.708 rânduri, doar regulile). Pe fișierele clienților s-a mișcat doar:

| Fișier | Ce |
|---|---|
| Oferta 284 / cererea TRANSAVIA | distribuitorul „Gata” → „De verificat” (2.296,70, tot exact); oferta fără clic: 92.278,36 |
| Transavia inox | 10 casete cu două grosimi pe același ø → „De verificat”; caseta DN150 → „Fără preț” |
| Matari (118.1) | golurile EI180 r72–83 → „Fără preț”, ca în oferta semnată |
| Spital | elastomer 40 mm pe m² (r134–135) → „Fără preț” |

Pe exemplele lui Adrian, prețurile corecte din `cheie-de-verificare.xlsx` ies acum
și pe rândurile cu greșeli de scris (r12 31,24 €, r13 29,70 € pe industrial).

Decise de noi (se pot întoarce):

- **Distribuitorul „De verificat”**: factorul 2,47 e dintr-o singură ofertă, iar
  firma n-a înțeles întrebarea. Se întoarce scoțând `echipament_suprafata` din
  comentariu, în `MOTIVE_DOVEDITE`.
- **Două grosimi pe același ø**: cea mai mare, „De verificat” (era „Gata”).
- **„Pune grosimea uzuală”** rămâne, până se lămurește C1.

## 15 noiembrie 2026: Fazele 4–6 văzute în browser, Faza 6 închisă

Pe `ux-lucrare` (cu `ux-import` și `ux-faza6-rest` unite), baza `izorep_ux`,
serverul pe 8813 (`build:server`), modelul simulat. **768 de teste**, nimic
sărit. Migrările 0018 și 0019 aplicate; nicio migrare nouă, nicio regulă de
preț schimbată.

**Parcurs cu Playwright** (detaliile în `.claude/istoric.md`, 15 noiembrie,
a doua intrare):

- Fazele 4 și 5: pagina lucrării (TRANSAVIA, Matari, NISAL închis) × 5 file ×
  390 / 1440 / 1920 px × ambele teme; o lucrare nouă din fișierul TRANSAVIA
  dusă până la „Totul e executat.” (285 propus, 94.575,06 €, 12 materiale,
  „Schimbă regulile”, „Refă lista”, „Comandă ce lipsește”, „Tot restul”);
  situație și comandă din poze; fiecare buton din „De făcut”. Propoziția e
  aceeași pe Acasă, în „Urmează” și în lista Lucrări.
- Importul: „Gata” ca text pe TRANSAVIA (0 câmpuri; 7.065 px la 1440, 27.781
  la 390), punctele 6, 7 și 9 pe un fișier de probă, 1440 și 390 px, tema
  deschisă. După unire: Acasă, Lucrări, Matari, TRANSAVIA (Cerere, Materiale)
  la 1440 și 390, zero derulare, zero erori; „E bine” pe Matari: 53 / 12 →
  54 / 11, „Anulează” le pune la loc.

| Ce | Acum |
|---|---|
| După „Comandă ce lipsește”, ciornele netrimise dispăreau din „De făcut”: lucrarea zicea „Situație nouă”, iar Acasă n-o mai arăta | pas nou în „Urmează”: „13 materiale sunt pe comenzi netrimise.” cu „Trimite comenzile” (→ Comenzi), la fel pe pagină, în listă și pe Acasă; după „Comandă ce lipsește”, înaintea situației; cedează lui „Închide șantierul” |
| Căutarea din „Situație nouă”: „ø60” nu găsea nimic pe TRANSAVIA (pozițiile scriu „Di60”) | ø, Ø, φ, Di și D urmate de cifre sunt același lucru; DN rămâne separat (`src/lucrari/situatii.ts`) |
| Două diametre pe același rând, modelul îl alege pe cel greșit: niciun gard (Faza 6, punctul 6) | `douaDiametre` în `valideaza.ts`, cod `doua_diametre`, pe liniile modelului și ale șablonului: la om. Pe cele 623 de poziții citite de reguli și pe cele 152 de linii golden: 0 aprinderi |
| Un lot căzut la model cerea fișierul din nou (punctul 7) | rândurile neîntoarse sunt `necitite` (ținute în cerere), nu pot fi „Gata”; sus „N rânduri n-au fost citite.” cu „Încearcă din nou”, care trimite doar pe ele, de două ori, și păstrează corecturile |
| Motivul de la „De verificat” era scurt, fără acțiune (punctul 9) | o propoziție cu ce s-a presupus și valoarea („Golul nu e scris: am pus 130/130, ca la aceeași țeavă din fișier.”), cu „Schimb” (cursorul în caseta ei) și „E bine” (`web/import/explica.ts`) |

Decise de noi (se pot întoarce):

- **„Confirmă” se numește „E bine”** peste tot la verificare, iar butonul în
  masă „Toate cele N poziții sunt bine”: propoziția se termină cu valoarea
  rămasă pe rând, deci „E bine” confirmă exact pe ea.
- **Cu două citiri, o singură citire întoarsă = rând necitit**, nu „citit
  diferit”: reîncercarea îl citește iar de două ori.
- **La plafonul zilnic** apare mesajul lui, fără „Încearcă din nou”; butonul
  revine la redeschidere.
- **DN150 lângă ø165,1** (EN 10255, spitalul) și textul moștenit de un rând de
  continuare („Same - Ø125”, `textPropriu`) nu sunt „două diametre”: fără ele
  gardul se aprindea pe 37 de poziții corecte.

**Nevăzut în browser** (tăiat ca să ajungă folosirea): „Lăsate afară” pe NISAL
și spital, coloanele citite cu „schimbă”, cardul fișierului dublu, bara unică
a celor două citiri, importul la 1920 px și pe tema închisă, cardurile între
390 și 1240 px, clicul pe „Schimb”, mesajul plafonului. Toate au teste.

**Găsite, nereparate** (de UX, pentru o trecere viitoare): alegerile „De ales”
din poze și situația începută se pierd la reîncărcare; cu „Schimbă regulile”
deschis lista de materiale apare de două ori, cu două butoane albastre;
„Comandă ce lipsește” are două ieșiri („Înapoi…” și „Renunță”); pe telefon
filele lucrării se rup pe două rânduri; „Costul materialului 0,00 €, 0 %” pe
un șantier nou; NISAL, închisă, arată încă „De verificat 7” pe fila Cerere.

## 14 noiembrie 2026 (seara): Faza 3 parcursă pe server, cu baza

Pe `ux-lucrare`, cu Docker, baza `izorep_ux`, serverul pe 8813 (`build:server`),
fără cheie de model. **709 teste** (706 + 3 în `tests/santier-din.test.ts`).

Parcurs cu Playwright, pe server: intrare → Lucrări → Cerere nouă → TRANSAVIA
→ pagina lucrării (trecerea de la `#/lucrari/noua` merge) → Ofertă (285
propus, scris 290; 94.575,06 €, cu 3 %: 91.737,81 €; „Cum iese oferta” și suma
la tastă, și cu ajustarea) → descărcată → A refuzat (lista: „Închise”,
„refuzată”, din `antet.refuzat`) → A acceptat până la urmă → șantierul →
Schimbă regulile, Refă lista → situație „Tot restul” (91.737,81 €, consum pe 12
materiale) → Închidere efectivă (un rest în central, unul la reciclat, restul
ajustat) → lista „Închise”. Reîncărcarea pe toate cele șase file ale celor 4
lucrări ține fila; al doilea browser (alt cookie) vede aceeași listă; 390 și
1440 px, ambele teme: zero derulare laterală, nicio țintă sub 40 px (linkurile
din text nu se numără), zero erori.

| Ce | Acum |
|---|---|
| Deschisă direct pe fila Ofertă (adresa, reîncărcarea), caseta numărului rămânea goală: numărul se propunea doar după „Mergi la ofertă” | se propune și la deschidere (`deschideSesiune`) |
| Cu tot executat și nimic comandat, lucrarea și lista: „12 materiale de comandat”; Acasă: „se poate închide” și „12 materiale de comandat” | „Totul e executat.” cu „Închide șantierul” (decis de Andrei); Acasă nu mai cere comanda pentru un șantier cu tot executat |
| `scripts/demo.ts` își ținea copia lui de „creează șantierul” | `web/santier-din.ts` (fără DOM, id-urile ca parametru), folosit de ecran și de demo; partea pură, `santierNou`, cu teste |
| Demo-ul salva cererile fără `deVerificat`: Matari în listă „Ce a răspuns clientul?”, pe pagină „12 poziții cer să te uiți” | salvate ca din ecran; Matari spune la fel în ambele locuri și se deschide pe Cerere |

`npm run demo` pe `izorep_ux` după schimbări: RAD118.1 12.692,04 €, RAD118
163.979,93 €, RAD284 91.737,81 €, 88 de mișcări, 4 comenzi (ca înainte).

## 14 noiembrie 2026: planul UX, Faza 2 (lucrarea) și Faza 3 (Cerere și Ofertă)

Din `docs/plan-ux.md`, pe ramura `ux-lucrare`. Nicio regulă de preț, nicio
migrare. **706 teste** (705 + testul de server pentru lista cererilor).

| Ce | Acum |
|---|---|
| O lucrare stătea în cinci locuri din meniu (Cerere nouă, Oferte și cereri, Șantiere, Măsurători, Materiale) | **Meniul pe patru**: Acasă · Lucrări · Materiale · Setări (cu file: Clienți, Liste de prețuri, Calcul rapid, Istoric, Contul meu). Adresele vechi trec prin `ALIAS` / `MUTATE` din `main.ts` |
| Nimic nu spunea în ce stadiu e o lucrare | **Lucrări** pe file: De ofertat · Oferte trimise · În lucru · Închise, cu cifra; „Cerere nouă” albastru sus |
| Cerere, ofertă și șantier erau ecrane diferite | **Pagina lucrării** (`#/lucrari/<id>/<fila>`): antetul, „⋯” (Planul de șantier, Șterge lucrarea), rândul **„Urmează”** cu butonul pasului, cinci file: Cerere · Ofertă · Materiale · Situații · Închidere (✓ pe cele gata, gri cu motivul pe cele la care nu s-a ajuns) |
| „Creează șantierul” era jos pe pasul 3, sub materiale | **„Clientul a acceptat”** în „Urmează”: întreabă „Pornești șantierul …?”, apoi planul și lista cu regulile firmei (`santierDin`), și duce pe fila Materiale. „A refuzat” / „A acceptat până la urmă” scriu `antet.refuzat` în cerere |
| Fila Ofertă era un singur formular, cu două butoane albastre | **Două carduri**: „Cui trimitem” (firma, numărul, data, beneficiarul, obiectivul, în atenția, localitatea) și „Prețul” (suma, ajustarea, discountul, „Descarcă oferta”); dedesubt „Cum iese oferta” |
| „Tip ofertă” la verificare: două butoane mari | text „Ofertă rezidențială” cu „schimbă”, care arată cele două tipuri pe loc |
| „Mergi la ofertă” de două ori pe fila Cerere | doar în „Urmează”; propoziția „Toate cele 99 au preț.” rămâne, fără buton |
| Sub titlu, pe o lucrare fără ofertă, se repeta titlul | rândul arată doar ce nu e în titlu (clientul, oferta, valoarea, „refuzată”); fără text, „⋯” urcă pe rândul lui „← Toate lucrările”, în dreapta (`.doar-inapoi`) |
| Verificarea nu mai lua toată lățimea (regula `main:has(.imp-vedere)` nu mai prindea nimic de când a ieșit „Ce vezi”) | `main:has(.ver-tabel:not([hidden] *))`: tabelul de verificare și cel al pozelor din carnet, doar cât se văd; pe Ofertă, Materiale și lista Lucrări `main` rămâne la 1400 px |
| Linia de sub file părea ruptă după „Închidere” | filele inactive aveau `opacity`, care stingea și linia; acum doar textul e mai stins |

Decise de noi (se pot întoarce):

- **Fără starea „trimisă”**: o ofertă salvată, fără șantier și fără refuz, e
  „Oferte trimise”. Refuzul fără migrare, în lucrul cererii.
- **Un singur albastru pe fila Ofertă**: „Descarcă oferta” e albastru cât
  lucrarea n-are ofertă; după prima descărcare (și la redeschidere) e alb, iar
  albastrul e „Clientul a acceptat” din „Urmează”. Butonul din „Urmează” care
  ar duce pe fila deschisă nu se desenează.
- **„Nu intră …” și „Înapoi la verificare”** stau într-un singur paragraf, în
  cardul „Prețul”, lângă descărcare (erau două, sus și jos).
- ~~**`scripts/demo.ts` rămâne cu funcția lui de șantier**~~: unificate în
  `web/santier-din.ts` (seara, decis de Andrei), vezi mai sus.

Curățat: `deschideLaIntrare` / `iaDeDeschis`, „Importuri recente” din
`ecranStart`, ramura „Ce vezi” din `baraVerificare` (cu tipul `Vedere`),
`LANT`, `LANT_VALOARE`, `CURS_BNR` și `client` / `santier` din `seed.ts`, CSS-ul
lor; „Șantiere” ca link pe Materiale → „Lucrări › Închise”.

Verificat: Faza 2 parcursă în browser pe varianta fără server (`npx vite`,
datele în browser), de la Cerere nouă până la situație, 390 și 1440 px, ambele
teme, adresele vechi și reîncărcarea pe fiecare filă, zero erori. Faza 3, la fel
pe TRANSAVIA: tipul schimbat și pus la loc, fila Ofertă (284, discount 3 % →
91.737,81 €, „Descarcă oferta”, apoi alb), zero derulare laterală. **Rămâne**:
parcurgerea pe server cu baza (`izorep_ux`), de un coleg cu Docker; testul nou
de server se sare fără Postgres.

## 14 noiembrie 2026: planul UX, Faza 0 (fără Render) și Faza 1

Din `docs/plan-ux.md`, pe ramura `ux-lucrare`. Nicio mutare de ecran, nicio
regulă de preț, nicio migrare. **698 de teste**, neschimbate.

| Ce | Acum |
|---|---|
| `npm run demo` murea cu 401 de la conturi (22 octombrie) și crăpa la rezumat (`oferte` lipsea din răspunsul refuzat) | scriptul are contul lui, `starea-de-demo@izorep.invalid` („Starea de demo (scriptul)”), **fără parolă**: nu se poate intra cu el din pagină. E activ și are o sesiune (6 ore) doar cât rulează, apoi sesiunea se șterge și contul se dezactivează, și când scriptul pică. Niciun cont existent nu se atinge (`asiguraCont` le-ar fi dezactivat). Contul nu se șterge: ofertele și mișcările scrise de el îl țin în `creat_de`, iar ștergerea le-ar modifica. Jurnalul arată cine a scris starea de demo |
| Meniul avea „Module care urmează (2)” | scos (`VIITOR`, `.viitor`) |
| Acasă: „Necesită atenția ta”, rânduri gri care nu păreau apăsabile, trei carduri de raport și nota despre curs | **„De făcut”**, cu un buton alb pe fiecare rând care spune ce faci („Comandă ce lipsește”, „Vezi comanda”, „Vezi oferta”, „Deschide cererea”, „Închide șantierul”…); fără nimic, „Nimic de făcut acum.” Au ieșit „Ultimele 7 zile”, „Șantiere închise” și nota |
| Verificare: filtrul pornea pe „Toate”, nimic nu spunea „poți merge mai departe”; filtrele și „Ce vezi” erau pastile și perechi de butoane | propoziția de sus („97 din 99 de poziții au preț sigur. 2 cer să te uiți.”, sau „Toate cele 99 au preț.” cu „Mergi la ofertă”), filtrele și „Ce vezi” ca file; se deschide pe „De verificat” când are ceva |
| Pagina șantierului: titlul „Șantiere” cu propoziția listei; „Închide” și „Șterge” file egale cu „Situații”; 8 coloane, multe „—”; nu se putea comanda de acolo | titlul e șantierul, „← Toate șantierele”; „Închide” și „Șterge” în „⋯” din antet, cu adresele lor; coloana goală pe toate rândurile nu se desenează; „Comandă ce lipsește” → Materiale |

Decise de noi (se pot întoarce; detalii în `ui.md`):

- **Fila implicită la Verificare:** „De verificat”, altfel **„Fără preț”**
  dacă are ceva, altfel „Toate”: o poziție fără preț nu stă ascunsă printre
  cele gata. Fila aleasă de aplicație se schimbă doar când rămâne goală (după
  „Confirmă” pe ultima), nu la tastă: altfel un rând care devine „De verificat”
  cât scrii ar muta pagina pe altă filă.
- **Butoanele din „De făcut” duc puțin mai aproape decât linkurile vechi:**
  „Închide șantierul” direct la panoul de închidere (`…/inchide`), lipsa și
  pierderea pe fila Materiale a șantierului; restul, unde duceau.
- **„Lipsește” rămâne mereu** pe fila Materiale, chiar când e „nimic” peste
  tot: e întrebarea paginii. Pe TRANSAVIA nicio coloană nu e goală pe toate
  rândurile (cochilia ø140 și tabla au comandat, venit, pus), deci tabelul arată
  la fel; restrângerea pe rânduri e Faza 4 din plan.
- **„Comandă ce lipsește” e alb** pe pagina șantierului: albastrul paginii e
  „Situație nouă”. Apare când fila Materiale are cifră (ceva de cumpărat).

Verificat: `npm run demo` pe `izorep_ux` (rezumatul: RAD118.1, RAD118, RAD284,
cele două șantiere, 88 de mișcări, 4 comenzi; contul de probă neatins, contul
scriptului inactiv, fără sesiuni). Cu Playwright pe `build:server`: Acasă,
Verificare (TRANSAVIA) și pagina șantierului (TRANSAVIA, NISAL închis), 390 și
1440 px, ambele teme, zero derulare laterală, zero erori; butoanele din „De
făcut” duc la `#/materiale` și `#/comenzi`; TRANSAVIA se deschide pe „Toate”
cu „Mergi la ofertă” (→ pasul 3), o descriere schimbată cu „g48” face „97 din
98 … 1 cere să te uiți.” fără să schimbe fila, redeschisă pornește pe „De
verificat”, iar după „Confirmă” trece singură pe „Fără preț”; „⋯” → Închide /
Șterge, Escape și clicul în afară îl închid, adresa ține la reîncărcare.

**Rămas din Faza 0:** planul bazei de pe Render (expiră azi), nefăcut aici.

## Mai vechi de 14 noiembrie 2026

Secțiunile datate de dinainte (28 septembrie – 23 octombrie 2026: motorul,
importul, fazele 1–8, Render, conturile, auditurile) au fost scoase pe 23
noiembrie 2026: fișierul avea 2.295 de linii și se încărca la fiecare sesiune.
Regulile care contează sunt în `pricing.md`, `import.md`, `tevi.md`,
`backend.md`, `santier.md`, `ui.md`; textul vechi întreg e în
`git show d82af7e:.claude/stare.md`.

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

## Comenzi

```bash
npm test                                       # 845 de teste (cu IZOREP_DB pe o bază de probă)
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
