# Plan după demo-ul din 16 noiembrie 2026

> Pentru Andrei, Adrian și agenții lor. Scris pe 23 noiembrie 2026, pe `main`
> la `d82af7e` (același cu Render). Pune laolaltă trei surse: notițele lui
> Adrian de la firmă, răspunsurile scrise pe `intrebari-firma-3.md` și ce ne
> rămăsese nouă (auditul din 15 noiembrie, `.claude/istoric.md`).
> Nicio linie de cod schimbată încă.

## Pe scurt

Firma a spus trei lucruri mari, pe care nu le aveam:

1. **Situația de lucrări are două documente**: întâi situația **fără bani**,
   trimisă șefului de lucrări spre aprobare, apoi **recepția**, aceeași cu bani.
   Iar situația trebuie să aibă toate pozițiile (tubulatura și fitingurile
   lipseau), cu descrierea întreagă și prețul, plus consumul de materiale.
2. **Oferta trebuie să poată pleca în fișierul clientului**, neatins, cu
   coloanele noastre de preț adăugate la sfârșit.
3. **Când lipsește ceva din cerere, se întreabă clientul**, iar rândul nu intră
   în ofertă până răspunde. Noi presupuneam (tabla e aluminiu, grosimea vine de
   la țeava vecină sau din tabelul uzual). Se schimbă câteva reguli, iar
   aplicația ar trebui să facă singură lista de întrebări pentru client.

Plus, mai mici: lucrările despărțite pe cele două firme, discount sau adaos pe
fiecare poziție, lista Conlit (EI60 / 120 / 180) editabilă din aplicație,
cantitatea 0, tubulatura „din tablă zincată” citită greșit.

Șapte etape, cam 3–4 săptămâni pentru un om, mai puțin pe două ramuri în
paralel (la „Ordinea”). Prima e importul, fiindcă acolo sunt banii.

## Ce au spus, ce înseamnă în aplicație

### Notițele lui Adrian

| # | Ce au spus | Ce e azi | Ce facem | Etapa |
|---|---|---|---|---|
| N1 | Fiecare șantier / beneficiar separat pe cele două firme, „2 foldere / taburi” | firma e pe antetul ofertei și pe plan (`PlanSantier.firma`), dar lista Lucrări n-o folosește | file RADOIA · ISORAD deasupra stadiilor, la Lucrări și la Clienți | 2 |
| N2 | Situația fără bani, trimisă șefului de lucrări spre aprobare; apoi recepția, cu bani | o singură situație, cu bani, fără aprobare | situația are stări: de trimis → trimisă → aprobată; două Excel-uri din ea | 3 |
| N3 | La Conlit, în cerere, grosimea e 60 | protecția la foc a tubulaturii nu ia grosimea | Conlit fără grosime scrisă = 60 mm, dovedit (spus de firmă) | 1 |
| N4 | Pe oferta nouă, dimensiunile sunt în coloana 2; a luat „size” drept cantitate, trebuia la grosime | **fișierul nu e la noi** | de primit fișierul; apoi rolul de coloană „dimensiune” în citirea coloanelor și „Dimensiunea e în coloana” la „schimbă” | 0, 1 |
| N5 | Uneori se trece cantitatea 0, să se poată pune 0 | la import un 0 scris rămâne 0, dar pe ecran „Cantitatea trebuie să fie mai mare decât 0” (`web/ecrane/import.ts:1816`) | 0 e voie: poziția rămâne în ofertă, cu preț și valoarea 0 | 1 |
| N6 | „Tubulatura rectangulară pentru ventilație, din tablă zincată, - VATĂ MINERALĂ 30 mm”: tabla e a tubulaturii, nu jachetă; facem doar ce e după virgulă | `TABLA_E_TUBULATURA` (`extract-regex.ts:94`) cere cel mult două cuvinte între „tubulatură” și „din tablă”; aici sunt trei și o virgulă, deci tabla devine jachetă | regula ia și virgula și mai multe cuvinte; test pe rândul lor | 1 |
| N7 | Lista Conlit (EI60, EI120, EI180), doar la tubulatura de desfumare / rectangulară, cu prețuri schimbate des de furnizor | 48 €/m² fix, mereu „De verificat” | lista Conlit în Setări › Liste de prețuri, editabilă, cu data; motorul ia prețul după clasa EI | 4 |
| N8 | Discount sau adaos pe fiecare poziție | doar ajustarea pe toată oferta și prețul pus de mână | „± %” pe rând | 4 |
| N9, N10 | Oferta trimisă în formatul în care a venit cererea; foile clientului neschimbate, doar coloane noi la sfârșit (preț pe element, total) | oferta iese mereu în formatul nostru | a doua descărcare: „În fișierul clientului” | 5 |
| N11, N12 | În situație lipsesc tubulatura rectangulară și fitingurile | planul de șantier ia doar rândurile „Gata” (`planDinOferta`, `web/oferta.ts:260`); tubulatura e mereu „De verificat” (protecția la foc), cea dată în metri e „Fără preț”, iar piesele rămase „De verificat” nu intră | „Clientul a acceptat” spune ce rămâne afară; în situație se poate aduce o poziție din cerere; formula tubulaturii în metri | 1, 3 |
| N13 | La fiecare poziție din situație: prețul și descrierea completă, ca în ofertă | planul are denumirea din ofertă și prețul; de văzut ce taie ecranul și Excelul situației | descrierea întreagă și prețul unitar pe ecran și în recepție | 3 |
| N14 | Pentru fiecare situație, consumul de materiale | consumul se scrie la fiecare situație (`consumDinSituatie`), dar nu se vede ca document | „Consumul pe situația nr. N”: tabel pe filă și foaie în Excel | 3 |
| N15 | Cumpărăm 120 m², pe situație avem 19,93: ce se întâmplă cu diferența? | restul stă pe șantier până la închidere; nu scrie nicăieri | pe fila Materiale: cumpărat · pus până acum · pe șantier · mai trebuie · în plus; „în plus” se poate muta oricând | 3 |

### Răspunsurile de pe foaie

| Întrebarea | Răspunsul | Ce se schimbă | Etapa |
|---|---|---|---|
| 1. „Protecție cu tablă” fără material | depinde, întrebăm clientul | azi: aluminiu, „De verificat”. Devine **„Fără preț”, „Întreabă clientul: din ce e tabla?”** | 1 |
| 2. Lipsește grosimea | întrebăm clientul | grosimea de la țeava **altui** diametru sau din tabelul uzual: „Fără preț”, întrebare. Rămâne „Gata” doar grosimea țevii **de același** diametru din aceeași cerere (Oferta 284, 24 din 24), de lămurit (C1) | 1 |
| 3. Lipsește materialul | întrebăm clientul de fiecare dată | deja „Fără preț”; intră în lista de întrebări | 1, 6 |
| Cuvintele clienților | bune; pot fi și altele, după client și limbă | adăugăm potrivirea aproximativă („alumniu”, „minrală”, „vată min.”, „tb. Al”) și „MW”, „Mineralwolle”, „K-Flex”, „Kautschuk” | 1 |
| Lipsește UM | ne dăm seama din denumire | azi: metri, „Gata”. Devine: UM din denumire (COT, TEU, ROB, „buc” → bucată; ml, m², ml după text), altfel „De verificat” | 1 |
| Rectangulară în metri | **2 × (A + 50 + B + 50) / 1000**, adică 2 × (A + B + 2g) | noi propusesem 4g. Se implementează formula lor: 400 × 300, vată 50 → 1,6 m²/ml | 1 |
| Tablă 0,6 cerută, lista are 0,8 | grosimea tablei nu contează, prețul de la diametru | `grosime_apropiata` / `grosime_jacheta_apropiata` pe tablă trec la dovedite („Gata”), fără notă către client | 1 |
| Demontarea izolației vechi | după beneficiar, fără preț standard | rândul recunoscut ca demontare: „Fără preț”, cu prețul pus de mână (azi cade la „Lăsate afară”) | 1 |
| Rezervor fără dimensiuni | cerem dimensiunile | intră în lista de întrebări | 6 |
| Pat de cabluri prin perete la foc | după ce trece și dimensiunea golului | dimensiunea patului nu e gol: „De verificat”, întrebare dacă golul nu e scris | 1 |
| Goluri: dimensiune lipsă, țeava fără material | golul e al lucrării, nu al țevii (DN15 poate avea 500/500 sau 100/100) | „golul de la aceeași țeavă din fișier” și „țeavă fără material = oțel” ies **„Fără preț”, întrebare** | 1 |
| Rândul neclar | **fără rând în ofertă, până răspunde clientul** | e regula de azi (doar „Gata” intră). Se adaugă lista de întrebări | 6 |
| 13. Țeava „cu izolație inclusă” | de obicei nu, dar întrebăm | rămâne „Fără preț”, intră în lista de întrebări | 1, 6 |
| Elastomer peste 32 mm | nu avem, sunt rare | fără extrapolare: „Fără preț”, preț de mână | 1 |
| 17. Protecția la foc a tubulaturii | se calculează de fiecare dată | împreună cu N7: prețul vine din lista Conlit, editabilă | 4 |
| PVC pe industrial | lista cu care lucrăm la restul | neclar (nu există PVC industrial): C4 | 1 |
| Manoperă | listele „NUUUU” nu mai sunt bune | rămâne amânată | — |
| 20. Listele de prețuri | și le trimitem noi, și le schimbă ei din aplicație | începem cu Conlit (N7), apoi restul pe același mecanism | 4, 7 |
| Valabilitatea ofertei | nu prea dau | nu scriem valabilitate pe ofertă | 1 |
| Elastomer DN50, 13 mm | „nu există grosimi uzuale” | contrazice tabelul din 11 septembrie: C1 | — |
| Foc pe industrial + 20 % | „nu știu de unde ai ajuns la concluzia asta” | regula vine din apelul din 29 septembrie: C2 | 4 |

Nerăspunse: B14, C, D, E, I și „buc fără piesă”, distribuitorul, NISAL (n-au
înțeles întrebarea sau au lăsat-o goală). La „De întrebat din nou”.

## Contradicții de lămurit întâi (Adrian, un telefon)

Fără ele, o parte din Etapa 1 schimbă prețuri în direcția greșită.

- **C1. Grosimile uzuale.** Pe 11 septembrie firma a dat tabelul (vată 20–100
  mm după DN, elastomer 13 / 19 / 25 după ø), din care „Pune grosimea uzuală”.
  Acum: „nu există grosimi uzuale”. **Până se lămurește:** grosimea uzuală nu
  se mai aplică singură; butonul rămâne ca propunere. Și: grosimea țevii de
  același diametru din aceeași cerere (casetele TRANSAVIA) rămâne „Gata”?
- **C2. + 20 % la închiderile la foc pe industrial.** Spus la apelul din 29
  septembrie (Andrei); acum nimeni nu știe de el. **Până se lămurește:**
  adaosul nu mai e automat, ci o bifă în cardul „Prețul”, oprită.
- **C3. Discountul de 3 %.** Bifa e pusă în fața rândului, nu pe „da” sau „nu”.
- **C4. PVC pe ofertă industrială.** Nu există listă industrială de PVC: luăm
  prețul rezidențial fără semn, sau ne trimit lista?

## Unde am ajuns (26 noiembrie 2026)

| Etapa | Starea |
|---|---|
| 0 | partea noastră făcută: baza locală (`izorep_e1`), `stare.md` tăiat. **De la firmă, nimic încă**: fișierul cu dimensiunile în coloana 2, lista Conlit, o situație și o recepție |
| 1 | făcută pe `etapa-1-import`, văzută în browser pe 26 noiembrie (exemplul 2, TRANSAVIA: 94.575,06 cu „E bine”), plus „Treceri prin planșee”. Lipsește **N4** (coloana de dimensiune), care așteaptă fișierul. D06 rămâne „Gata”: materialul țevii nu intră în prețul golului |
| 2 | făcută pe `etapa-2-firme` (pornită din `etapa-1-import`), văzută în browser. Detaliile în `.claude/stare.md`, 26 noiembrie |
| 5 | făcută pe `etapa-5-fisier-client`, văzută în browser (TRANSAVIA: 94.575,06 în fișierul clientului). De deschis o dată în Excel |
| 6 | făcută pe `etapa-6-intrebari`, văzută în browser |
| 4 | ± % pe poziție și bifa de foc făcute pe `etapa-4-procent-rand`; **lista Conlit așteaptă prețurile furnizorului** |
| 3, 7 | nefăcute; 3 așteaptă situația și recepția firmei |

## Etapele

Fiecare etapă e o ramură, cu teste pe rândurile din `exemple-AI/` și din
fișierele clienților, A/B pe toate fișierele (ce se mișcă trebuie să fie ce am
vrut), ofertele semnate neatinse, parcursă în browser la 390 și 1440 px, apoi
pe `main` și pe Render.

### Etapa 0. Pregătire (o jumătate de zi, cerut de la firmă prin Adrian)

- Fișierul nou de ofertă cu dimensiunile în coloana 2 (N4). Fără el, N4 nu se
  poate face.
- Lista Conlit de la furnizor (prețuri pe EI60 / 120 / 180, și pe grosime dacă
  diferă).
- O situație fără bani și o recepție trimise de ei unui client (formatul, cine
  semnează), plus fișierul pe care s-a făcut demo-ul, ca să reproducem N11–N12.
- La noi: Postgres local pornit (azi 81 de teste se sar), `.claude/stare.md`
  tăiat la ultimele intrări (are 2.295 de linii, se încarcă la fiecare sesiune).

### Etapa 1. Importul după răspunsuri (3–4 zile)

Se schimbă reguli de preț, deci partea cea mai atentă.

| Ce | Unde |
|---|---|
| Tabla fără material: „Fără preț”, motiv nou „întreabă clientul” | `tabla_fara_material`, `MOTIVE_DOVEDITE`, `explicaRand` |
| Grosimea de la alt diametru / din tabel: „Fără preț”, întrebare; grosimea uzuală nu se mai aplică singură | `grosimiDeLaConducte`, `grosime_fara_conducta`, `grosime_conducta_vecina` |
| Goluri: golul de la altă poziție și țeava fără material: „Fără preț”, întrebare | golul dedus, `D06` |
| Tabla: grosimea nu contează, prețul de la diametru („Gata”) | `grosime_apropiata`, `grosime_jacheta_apropiata` pe tablă |
| UM din denumire; fără nimic, „De verificat” | `rand.ts`, forma |
| Tubulatura rectangulară în ml: 2 × (A + B + 2g) / 1000 × preț pe m² | `fara_diametru`, `tarifeazaPeMp`; `tevi.md` |
| „… din tablă zincată, - VATĂ …”: tabla e a tubulaturii | `TABLA_E_TUBULATURA` |
| Conlit fără grosime: 60 mm | protecția la foc a tubulaturii |
| Elastomer peste 32 mm: fără extrapolare | `pretPeMp` |
| Demontarea: „Fără preț”, preț de mână | `lasate-afara.ts`, altă meserie |
| Pat de cabluri, echipamentul × 2,47: „De verificat” (nu „Gata”) | `D08`, `tarifeazaEchipament` |
| Potrivirea aproximativă pe material și cuvintele noi | `extract-regex.ts` |
| Cantitatea 0 voie: import, verificare, „Ca în ofertă”, situație | `import.ts:1816`, `celula.ts` |
| Coloana de dimensiune (N4), după fișier | `mapare.ts`, `coloane-ecran.ts` |
| Fără valabilitate pe ofertă | `registru-oferta.ts` |

Ce se mișcă intenționat: pe cererile fără ofertă semnată (exemplele lui
Adrian, spitalul, Book15, SRU) rânduri „De verificat” trec la „Fără preț”, iar
rânduri de tablă trec la „Gata”. Pe ofertele semnate (284, NISAL, Matari)
**nimic**. Testul `oferte-semnate.test.ts` e gardul.

### Etapa 2. Lucrările pe firme (1 zi)

- Lista Lucrări: file **RADOIA · ISORAD** sus, cu cifra; sub ele stadiile.
  Ținută în adresă (`#/lucrari?firma=…&stadiu=…`).
- Firma se alege la **Cerere nouă** (implicit ultima folosită), nu abia pe
  Ofertă; se poate schimba pe Ofertă. Cererile vechi fără ofertă: „Fără firmă”
  până se alege.
- Clienți: aceleași file. Acasă: amândouă, cu firma pe rând.
- Fără migrare: firma e în `antet` (cerere) și în plan.

### Etapa 3. Situațiile, cum le fac ei (5–6 zile, cea mai mare)

1. **Toate pozițiile în plan.** La „Clientul a acceptat”, dacă rămân poziții
   „De verificat” sau „Fără preț”: „3 poziții nu sunt în ofertă și nu vor fi în
   situații: …” cu „Verifică-le întâi” și „Pornește fără ele”. În „Situație
   nouă”: „Adaugă o poziție din cerere” (rândurile rămase afară, cu prețul pus
   atunci); o poziție nouă față de ofertă e marcată „peste ofertă”. Reprodus
   întâi pe fișierul demo-ului.
2. **Situația fără bani → aprobare → recepția.** Situația are stări: *de
   trimis* (se modifică), *trimisă spre aprobare* (Excel fără prețuri:
   poziția, descrierea întreagă, UM, ofertat, executat înainte, acum, cumulat),
   *aprobată* (cu cantitățile tăiate de șeful de lucrări, dacă le-a tăiat),
   apoi **Recepția** din ea: același tabel, cu prețul unitar și valorile. Pe
   Acasă: „Situația 2 așteaptă aprobarea de 5 zile”. Migrare: starea și data
   pe `situatie`; trigger-ul de imutabilitate lasă schimbarea cantităților doar
   cât nu e aprobată. Cele vechi: aprobate.
3. **Descrierea și prețul pe fiecare poziție**, pe ecran (nu tăiate) și în
   recepție.
4. **Consumul pe situație**: pe fila Situații, sub fiecare situație,
   „Materialul pus” (material, cantitate, de pe ce poziții), și foaia
   „Consum” în Excelul recepției. Calculul există deja.
5. **Diferența dintre cumpărat și pus** (N15): pe fila Materiale, pe fiecare
   material: cumpărat · pus până acum · pe șantier · mai trebuie (pentru ce nu
   s-a executat) · **în plus**. Sub tabel, o propoziție: „Pe șantier sunt
   100,07 m² de saltea; mai trebuie 60. Restul de 40,07 m² se poate muta acum
   în depozit, altfel rămâne acolo până la închidere.”, cu „Mută în depozit”.

### Etapa 4. Prețurile: ± pe poziție, lista Conlit (3–4 zile)

- **± % pe poziție**, pe fila Cerere (rândul deschis) și în „Cum iese oferta”.
  Decis de noi: procentul rândului **înlocuiește** ajustarea pe toată oferta
  pentru acel rând (ca prețul pus de mână), iar discountul de la final se
  aplică peste tot. Clientul vede prețul final pe rând; „Cum a fost calculată”
  arată procentul. Planul de șantier copiază prețul final.
- **Lista Conlit**: Setări › Liste de prețuri › „Conlit, protecție la foc”, un
  tabel EI60 / EI120 / EI180 (× grosime, dacă lista o cere), cu „Schimbă
  prețurile” și „de la data”. Pe mecanismul care există: `lista_preturi` e
  versionată și înghețată după activare, deci o schimbare e o versiune nouă,
  iar ofertele vechi își păstrează prețul. Motorul ia clasa EI din rând
  (EI60 / 120 / 180); fără clasă, „Fără preț”, întrebare. Poziția nu mai e
  mereu „De verificat”.
- Adaosul de foc pe industrial: bifa din cardul „Prețul” (C2).
- După Conlit, același ecran pentru celelalte liste (răspunsul 20). Mai târziu,
  după ce Conlit merge.

### Etapa 5. Oferta în fișierul clientului (3–5 zile)

- Pe fila Ofertă, lângă „Descarcă oferta”: **„Descarcă în fișierul
  clientului”**. Fișierul original (îl avem în bază, `cerere.fisier`), cu
  foile neschimbate; pe fiecare foaie cu poziții, după ultima coloană folosită:
  „Preț unitar (€)” și „Valoare (€)” pe rândurile cu preț, totalul sub ultima
  poziție, iar discountul, dacă este, sub total.
- Rândurile neclare rămân fără preț (aceeași regulă ca în oferta noastră).
- Se scrie direct în XML-ul foii (JSZip), nu prin ExcelJS: ExcelJS rescrie tot
  registrul și poate pierde formatări, imagini, validări. Test pe toate cele 11
  fișiere de client: celulele clientului ies identice, octet cu octet pe
  foile fără poziții.
- `.xls` vechi: doar formatul nostru, cu propoziția de ce.

### Etapa 6. Întrebările pentru client (2 zile, propunerea noastră)

Aproape toate răspunsurile de la A sunt „întrebăm clientul”. Aplicația are
deja tot ce trebuie: rândul, descrierea și ce lipsește.

- Pe fila Cerere, când sunt rânduri cu motiv de întrebat: „5 lucruri de
  întrebat clientul.” cu **„Scrie întrebările”**: text de email gata de
  copiat (rândul din fișierul lui, descrierea, întrebarea: „din ce e tabla?”,
  „ce grosime?”, „ce dimensiune are golul?”), plus un Excel cu aceleași
  rânduri.
- În „Urmează”: „Așteaptă răspunsul clientului la 5 întrebări.” Răspunsul îl
  scrie omul pe rânduri, ca azi; rândul trece la „Gata” și intră în ofertă.

### Etapa 7. Ce ne rămăsese nouă (2–3 zile, în paralel)

- Din predare: „Clientul a acceptat” cu obiectivul gol (de cerut la
  descărcare); propoziția de pe fila Cerere fără rândurile lăsate afară;
  titlul lucrării cu cifra din numele fișierului; UM gol la „Di60, g40 - ML”;
  pe un rând fără material, grosimea scrisă singură tarifează vată.
- Necesarul: placa de vată fără grosime (cu Conlit la 60 se rezolvă), PVC fără
  preț de cumpărare și furnizor, elastomer Ravago 330 lei (pe cutie, nu pe m²).
- Neverificat: modelul real pe import și pe avize, „Lăsate afară” pe NISAL și
  spital, oferta veche de 14 zile, exemplul 2, importul la 1920 px și pe tema
  închisă.
- Documentația: `import.md` și `pricing.md` cu regulile din 15 noiembrie și
  din etapa 1.
- Ramura `plan-simplificare`, de șters.

### Apoi: proba cu un om (Faza 7) și ce vine după răspunsuri

- **Proba**, pe o cerere nouă, reală, de la ei: un om care n-a văzut aplicația
  o duce de la fișier la recepție. Notăm unde se oprește.
- **După răspunsuri**, nefăcute: conturi pe om și roluri (44: azi un singur
  cont comun), backup restaurat măcar o dată, saltele sau cochilii (22),
  materialele mărunte (25), garanția și avansul (32), facturile și Saga.

## Ordinea

| Ramura A (import, prețuri) | Ramura B (lucrare, situații) |
|---|---|
| 0 → 1 → 4 → 6 | 2 → 3 → 5 |
| 7, la sfârșit, de cine termină întâi |

Pe un singur om: 0, 1, 2, 3, 4, 5, 6, 7. Etapele 1 și 3 sunt cele pe care firma
le-a cerut cel mai apăsat. Pe două ramuri deodată: baze și porturi separate
(`IZOREP_DB`, ca pe 15 noiembrie), migrările numerotate din timp (A nu are
migrare; B are una în etapa 3; Conlit, în etapa 4, nu cere).

## Riscuri

- **Etapa 1 schimbă prețuri.** Regula „întrebăm clientul” scoate din ofertă
  rânduri care azi intră cu preț presupus. Corect după firmă, dar o ofertă
  iese mai mică până răspunde clientul. Cu C1 nelămurit, casetele TRANSAVIA ar
  putea ieși din ofertă: nu se atinge regula „aceeași țeavă” până la răspuns.
- **Stările situației** ating trigger-ul de imutabilitate și consumul (scris la
  salvare). Varianta sigură: consumul se scrie la *aprobare*, nu la salvarea
  ciornei. De hotărât la începutul etapei 3, cu test pe server.
- **Fișierul clientului** poate avea formule, foi ascunse, celule îmbinate
  peste coloana unde scriem. Coloanele noi merg după ultima coloană folosită
  pe toată foaia, nu doar pe rândurile de poziții.

## De întrebat din nou (Adrian, scurt, cu exemplul pe foaie)

- C1–C4, de mai sus.
- **„buc” fără piesă**: „În cerere scrie «izolație elastomerică 19 mm, 750
  buc», fără cot sau teu. 750 de ce: tuburi de 2 m, metri, coturi?”
- **Distribuitorul**: „Distribuitorul de abur din Oferta 284 a costat 2.296,70
  €. Cum l-ați calculat? Aplicația face suprafața × prețul pe m² × 2,47; e bine
  și la alte echipamente?”
- **Tubulatura pe m² cu fitingurile incluse** (SRU, 25.740 m²): „Prețul pe m²
  e același, sau puneți ceva în plus pentru coturi?”
- **NISAL** = Oferta 118 / 27.04.2026, NISAL SRL, XXXLutz + Momax Balotești:
  „spiro ø250 și ø315 au ieșit cu 0,13 € peste formula voastră; formula e bună?”
- Conlit: aceeași grosime (60) la toate clasele EI?
- Din C, D și I, doar ★: saltele sau cochilii peste 3 țoli (22), materialele
  mărunte (25), garanția și avansul (32), câte facturi pe comandă, numărul
  ofertei fără serie („284”, nu „RAD284”).
