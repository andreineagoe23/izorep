# Stare curentă

> Unde am ajuns, ce s-a decis și ce urmează. Actualizează la fiecare etapă.
> Ultima actualizare: 4 septembrie 2026.

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
Inventarul complet, cu ce lipsește din fiecare segment, e în
`../attachments/README.md`. ETL-ul caută fișierele după nume, recursiv, deci
gruparea nu-l afectează.

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

**Istoricul importurilor** (`web/istoric.ts`) — ultimele 10 importuri în
IndexedDB: fișierul, extragerile și corecțiile omului, nu grila (aceeași parsare
pe aceiași bytes o reface). Reîncărcarea paginii nu mai pierde munca, iar
redeschiderea unui import vechi **nu cheamă modelul din nou**. Detaliile în
`ui.md`.

**Aplicația** (`web/`) — 7 ecrane: tablou de bord, lucrări, cereri și oferte,
calcul deviz, import Excel, clienți, liste de prețuri. Datele sunt reale,
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

## Prețurile pe destinație (4 septembrie 2026)

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
un obiect per linie, cu același index"; pe `Oferta 27.04.2026.xlsx` au plecat
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

**Lista de inox lipsea, dar lucrările de inox nu.** `Izolatii Transavia.xlsx`
are **72 de rânduri** care spun „tabla de inox 304" — practic tot fișierul.
Neavând listă, `extract-llm.ts` mapa explicit inoxul pe `tabla`, adică pe lista
de aluminiu, iar cele 39 de poziții tarifate din el (6.039,90 €) au ieșit pe
lista greșită. Inoxul e mult mai scump: la ø90, 30,89 € (0,4 mm) față de
17,08 € (aluminiu 0,6 mm). Lista industrială de inox rezolvă asta — dar abia
după ce motorul capătă sistemul și regula de segment.

**Prima pereche cerere → ofertă pe aceleași rânduri.** `Cerere oferta 2
Izolatii - Abur.xlsx` (99 rânduri) și `Oferta 284 Abur TRANSAVIA
27.05.2026 - tabla aluminiu.xlsx` sunt același proiect, întrebat și răspuns.
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
| în sus / în sus (motorul de azi) | 23 / 30 |
| în sus / cel mai apropiat | 21 / 30 |
| **cel mai apropiat / în sus** | **27 / 30** |
| cel mai apropiat / cel mai apropiat | 24 / 30 |

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
(ø110, ø110, ø120, ø130, ø140) — stratul de vată nu intră în preț. Cinci
poziții din cinci. De confirmat cu firma înainte să intre în cod.

**Două abateri rămân pe oferta asta.** Di114 cot și teu sunt 76,43 € în loc de
45,24 € (banda 76–114 spune ×1 pentru cot; raportul real e 1,689 — nu e niciun
coeficient din tabel). Iar Di21 la 40 mm pe metru liniar e 25,68 € față de
25,73 € calculat: lista noastră n-are ø22 la 40 mm, iar motorul cade pe ø28.

## Întrebări deschise către firmă

Astea blochează arhitectura, nu doar implementarea:

1. **Cine ține stocul oficial — aplicația sau Saga?** Determină tot modulul de
   stoc și cine răspunde pentru SAF-T.
2. Cine emite factura și cine o trimite în SPV?
3. La ø90 și ø160, care e regula corectă de rotunjire? (Rotunjirea la stratul
   de jachetă e acum lămurită de Oferta 284 — **în sus**. ø90 și ø160 rămân.)
4. Există listă de prețuri pentru elastomer peste ø219? Nici lista industrială
   nu trece de ø219, deci întrebarea e acum pe amândouă segmentele.
5. Lista de manoperă e scrisă undeva sau se negociază de fiecare dată?
6. Cum se împart cele două firme (RADOIA ISOLIRUNG / R&F ISORAD SYSTEM)?
7. Care e regula de curs folosită azi la facturare — BNR din ziua anterioară,
   din ziua facturii, sau cursul din contract? (De verificat cu contabila.
   Până atunci `CURS_BNR` rămâne constantă: cursul contează abia la facturare.)
8. „Protecție la foc pentru tubulatură" (28 de rânduri în `Radoia.xlsx`) e o
   lucrare pe care o ofertați? Nu are listă de prețuri printre cele primite.
9. **Coturile și teurile de vată minerală sub ø76.** Lista nu are coeficient de
   element special pe banda 18–60 (are doar manșeta, 0,25), deci 12 poziții
   reale din `Izolatii Transavia` rămân netarifate. Oferta 284 le tarifează
   totuși, iar pe cinci poziții din cinci prețul e **exact tabla la rândul
   geometric, fără stratul de vată**. Regula asta e corectă, sau au fost cinci
   decizii separate?
10. **SPIRO ø160.** Citit ca diametru exterior, motorul ar da 14,37 €/ml
    (rândul 169); oferta semnată are 14,16 (rândul 159), iar aceeași ofertă
    tarifează ø160 PEHD la 14,37. Până la răspuns, `DN 160` pe spiro rămâne
    **marcat, nu tarifat** — nu ghicim un preț pe care nu-l putem verifica.
11. **Două liste de cantități de la același client, din proiecte diferite.**
   Cele 9 fișiere pe care le avem vin de la clienți diferiți, deci reutilizarea
   șabloanelor între proiecte — tot câștigul lui L4 — nu se poate măsura.
   Vezi `plan-l1-l4.md`.
12. **Cine alege segmentul de preț și după ce regulă?** Oferta 284 e o lucrare
   industrială (Transavia, abur) tarifată pe lista rezidențială. Dacă alegerea
   e a omului la deschiderea lucrării, e un câmp pe lucrare. Dacă se deduce din
   client sau din tipul obiectivului, e o regulă. Fără răspuns, motorul nu
   poate ține două liste — nu știe pe care să o aplice.
13. **Lista de prețuri pentru rafinărie.** E al treilea segment anunțat și
   singurul care lipsește complet. Până vine, `data/price-lists/` rămâne pe
   rezidențial.
14. **PVC și închiderile goluri la foc pe industrial.** Nu au venit în pachetul
   industrial. Nu se ofertează pe industrial, sau se folosesc cele
   rezidențiale?
15. **Tabla de inox.** Sistem nou, doar pe industrial, fără corespondent
   rezidențial. Se ofertează și pe rezidențial? Are aceleași benzi de
   multiplicatori ca tabla de aluminiu (subsolul listei zice că da)?

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
npm test                                       # 237 teste (motor, import, baza)
npm run typecheck
npm run dev                                    # UI local, /izorep/
npm run import -- ../attachments/clienti/Radoia.xlsx   # pipeline complet
npm run import -- <fisier> --fara-model        # doar determinist
npm run golden -- <fisier.xlsx>                # inregistreaza iesirea modelului
npm run golden -- --verifica                   # cauta deriva modelului
npm run mapare -- <fisier.xlsx>                # inregistreaza maparea de coloane
IZOREP_FARA_MAPARE=1 npm run import -- <fisier>  # masoara A/B fara L1
python scripts/extract_price_lists.py ../attachments   # regenerează prețurile
python scripts/extract_conversii.py ../attachments     # regenerează seriile de țevi
npm run db:up && npm run db:migrate && npm run db:seed  # baza locală
```
