# Stare curentă

> Unde am ajuns, ce s-a decis și ce urmează. Actualizează la fiecare etapă.
> Ultima actualizare: 3 septembrie 2026.

## Contextul proiectului

Client: **SC RADOIA ISOLIRUNG SRL** (+ R&F ISORAD SYSTEM SRL), firmă de izolații
termice pentru instalații — conducte și tubulatură în clădiri mari, hale,
rafinării. Echipa de dezvoltare: **Andrei Neagoe** și **Adrian Popescu**.

Problema de rezolvat: clienții trimit liste de cantități în Excel, fiecare în
alt format, iar tarifarea se face manual, linie cu linie — 300+ linii pe
proiect, câteva ore, cu greșeli invizibile.

Materialul sursă (17 fișiere Excel primite de la firmă) stă în `../attachments/`
și **nu e commit-uit** — conține prețurile reale ale firmei.

## Ce e construit

**Motorul de prețuri** (`src/pricing/`) — determinist, fără AI, izomorf
(rulează identic în Node și în browser). 130 de teste care reproduc poziții
reale facturate din Oferta 118 / 27.04.2026, inclusiv poziții compuse din trei
straturi și totalurile pe linie, plus toate cele 53 de poziții din oferta 118.1
de închideri goluri la foc (12.692,04 €, exact totalul semnat).

**Pipeline-ul de import** (`src/import/`) — L0 parsare fizică, L2a extragere
deterministă (~55% din linii), L2b completare cu OpenAI prin structured outputs
pe reziduu, L3 tarifare. Rulat pe lista reală a unui spital: 191 poziții
detectate, 63% tarifate automat. Rulează identic din CLI și din aplicație, când
aceasta e pornită local (`npm run dev`): pe `Izolatii Transavia.xlsx` ambele dau
72 poziții, 39 tarifate, 6.039,90 €. Pe `Oferta 27.04.2026 Matari.xlsx`
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

**Guardrails pe stratul cu model** (`src/import/valideaza.ts`) — verificare
deterministă a ceea ce iese din model, față de textul sursă: numere care nu
apar în linie, DN inexistent, grosime pe care sistemul ăla nu o ofertează,
formă care contrazice unitatea de măsură. Un avertisment anulează încrederea
raportată de model și trimite poziția la validare umană. Modelul e pinuit pe
**snapshot datat**, iar `tests/golden/` ține ieșirea lui reală pe fișiere de
client, ca deriva să se vadă. Detaliile în `import.md`.

**Aplicația** (`web/`) — 7 ecrane: tablou de bord, lucrări, cereri și oferte,
calcul deviz, import Excel, clienți, liste de prețuri. Datele sunt reale,
extrase din fișierele firmei. Paleta și tipografia respectă WCAG AA; detaliile
în `ui.md`.

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

**Motorul nu extrapolează.** Peste ultimul rând din listă aruncă
`PozitieNetarifata`. Ofertele reale conțin ø250 și ø315 pentru elastomer, unde
lista se oprește la ø219 — acolo prețul a fost stabilit manual.

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
un obiect per linie, cu același index"; pe `Oferta 27.04.2026.xlsx` au plecat
43 de linii și s-au întors 35. Liniile lipsă nu apăreau nicăieri în raport, deci
un fișier ciuntit arăta ca un fișier cu mai puține poziții. Acum se numără
(`modelFaraRaspuns`).

**Tabelul de conversie DN, primit de la firmă, confirmă exact ce era în cod.**
Coloana ISO coincide valoare cu valoare cu `DN_TO_OD` pe tot intervalul
DN10–DN400 — dedus din listele de cantități, validat independent de sursă.
Restul notițelor (cupru/inox pe altă serie, tubulaturi rectangulare, formula
pentru diametre peste ultimul rând) stau în `tevi.md`, cu întrebările deschise.

**Lista de manoperă are altă structură** decât matricea completă: tarif plat pe
sistem și grosime (2,20 / 2,30 / 3,00 €/ml), nu matrice ø × grosime. Nu e o
coloană a aceleiași linii, e o listă separată.

## Întrebări deschise către firmă

Astea blochează arhitectura, nu doar implementarea:

1. **Cine ține stocul oficial — aplicația sau Saga?** Determină tot modulul de
   stoc și cine răspunde pentru SAF-T.
2. Cine emite factura și cine o trimite în SPV?
3. La ø90 și ø160, care e regula corectă de rotunjire?
4. Există listă de prețuri pentru elastomer peste ø219?
5. Lista de manoperă e scrisă undeva sau se negociază de fiecare dată?
6. Cum se împart cele două firme (RADOIA ISOLIRUNG / R&F ISORAD SYSTEM)?
7. Care e regula de curs folosită azi la facturare — BNR din ziua anterioară,
   din ziua facturii, sau cursul din contract? (De verificat cu contabila.
   Până atunci `CURS_BNR` rămâne constantă: cursul contează abia la facturare.)
8. „Protecție la foc pentru tubulatură" (28 de rânduri în `Radoia.xlsx`) e o
   lucrare pe care o ofertați? Nu are listă de prețuri printre cele primite.
9. **Două liste de cantități de la același client, din proiecte diferite.**
   Cele 9 fișiere pe care le avem vin de la clienți diferiți, deci reutilizarea
   șabloanelor între proiecte — tot câștigul lui L4 — nu se poate măsura.
   Vezi `plan-l1-l4.md`.

## Ce urmează

Măsurătorile care fundamentează pașii de mai jos stau în **`plan-l1-l4.md`**:
rândurile de antet reale din fiecare fișier, vocabularul de roluri de coloană,
și stabilitatea șabloanelor.

**Deduplicarea reziduului pe șablon — prima, fiindcă e cea mai ieftină.**
Liniile trimise la model se repetă în același fișier: 697 de linii reziduale pe
toate fișierele înseamnă doar 318 șabloane, deci **−54% tokeni** fără nicio
memorie persistentă. Se poate face pentru că rolul e stabil pe șablon: măsurat
pe cele 64 de șabloane care apar de cel puțin două ori, tripleta
`(sistem, tip_diametru, formă)` e identică în 100% din cazuri. Se memorează
rolul, nu valorile — numerele se citesc per linie, din poziția lor în șablon.

**L1 — maparea de coloane per client.** Rezolvă simultan două lucruri:
euristica de cantitate (azi ghicește coloana lângă unitatea de măsură) și
`Book15.xlsx`, unde din 412 rânduri ies doar 5 poziții, pentru că rândurile de
continuare `"Same - Ø125 mm"` își pierd descrierea părinte.

Rândul de antet e găsibil fizic pe 14 din 15 foi, dar nu pe poziție fixă
(r1, r2, r5, r6, r9, r12, r14, r15). Cele două cazuri pe care regula fizică nu
le prinde — o foaie fără antet și una unde detectorul ia un rând de coduri —
sunt exact motivul pentru care modelul propune maparea, iar un validator
determinist o acceptă sau o respinge.

Contextul de secțiune (`sectiuni.ts`) rezolvă deja un nivel din problema asta:
antetul îmbinat de deasupra dă sistemul liniilor care tac despre ele însele.
L1 îl înlocuiește cu ceva care știe și ierarhii, și rânduri de continuare.

**L4 — ecranul de validare cu învățare.** Fiecare corecție umană se salvează ca
mapare `șablon → rol`. Cifra „90–95% la al doilea proiect" rămâne o ipoteză:
fișierele pe care le avem vin de la clienți diferiți, deci reutilizarea între
proiecte nu e măsurabilă (întrebarea 9 către firmă).

Apoi: generare ofertă PDF, export în șablonul Excel al clientului, și modulele
de contract, stoc și facturare.

## Comenzi

```bash
npm test                                       # 198 teste (motor, import, baza)
npm run typecheck
npm run dev                                    # UI local, /izorep/
npm run import -- ../attachments/Radoia.xlsx   # pipeline complet
npm run import -- <fisier> --fara-model        # doar determinist
npm run golden -- <fisier.xlsx>                # inregistreaza iesirea modelului
npm run golden -- --verifica                   # cauta deriva modelului
npm run mapare -- <fisier.xlsx>                # inregistreaza maparea de coloane
IZOREP_FARA_MAPARE=1 npm run import -- <fisier>  # masoara A/B fara L1
python scripts/extract_price_lists.py ../attachments   # regenerează prețurile
npm run db:up && npm run db:migrate && npm run db:seed  # baza locală
```
