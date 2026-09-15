# Stare curentă

> Unde am ajuns, ce s-a decis și ce urmează. Actualizează la fiecare etapă.
> Ultima actualizare: 15 septembrie 2026.

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

## Acoperirea față de ofertele semnate (actualizat 15 septembrie 2026)

Din cele 9 fișiere de client, **4 sunt oferte** cu rând de TOTAL — restul sunt
cereri, n-au cu ce fi comparate. Măsurat pe `--fara-model`, comparând registrul
generat cu totalul semnat. `tests/oferte-semnate.test.ts` ține cifrele ca
clichetă: dacă cresc, se actualizează; dacă scad, s-a stricat ceva — sau e o
scădere deliberată, explicată în `deCe`.

| Ofertă semnată | pe ofertă (7 sep → 13 sep → 15 sep) | generat | semnat | |
|---|---|---|---|---|
| Matari (goluri foc) | 53 → 53 → 53 | 12.692,04 | 12.692,04 | **100%** |
| Oferta 27.04.2026 | 29 → 39 → **41** | 119.376,21 | 170.519,39 | 70% |
| Oferta 284 Transavia | 61 → 85 → 85 | 74.993,76 | 94.575,06 | 79% |
| Anexa 1 / 06.12.2024 | 0 → 0 → 0 | 0,00 | 706,90 | **0%** |

Distincția care contează: **nu e o problemă de preț, e una de acoperire.**
Prețurile pe liniile care ies sunt comparate linie cu linie cu oferta semnată:

- **Oferta 284** — **83 din 85** de prețuri unitare exacte. Cele două diferite
  sunt `Di169, g50 - COT` cu UM `ml` în fișierul clientului: UM-ul decide forma,
  deci iese prețul pe ml (51,44), oferta are cotul (102,88). E fișierul, nu
  motorul. Restul de 13 netarifate sunt grosimi inexistente în listă.
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
   nu trece de ø219, deci întrebarea e acum pe amândouă segmentele.
5. Lista de manoperă e scrisă undeva sau se negociază de fiecare dată?
6. Cum se împart cele două firme (RADOIA ISOLIRUNG / R&F ISORAD SYSTEM)?
7. Care e regula de curs folosită azi la facturare — BNR din ziua anterioară,
   din ziua facturii, sau cursul din contract? (De verificat cu contabila.
   Până atunci `CURS_BNR` rămâne constantă: cursul contează abia la facturare.)
8. „Protecție la foc pentru tubulatură" (28 de rânduri în `cerere-de-oferta-spital.xlsx`) e o
   lucrare pe care o ofertați? Nu are listă de prețuri printre cele primite.
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
13. **Lista de prețuri pentru rafinărie.** E al treilea segment anunțat și
   singurul care lipsește complet. Până vine, `data/price-lists/` rămâne pe
   rezidențial.
14. **PVC și închiderile goluri la foc pe industrial.** Nu au venit în pachetul
   industrial. Nu se ofertează pe industrial, sau se folosesc cele
   rezidențiale? Până la răspuns, pe o ofertă industrială se folosesc cele
   rezidențiale, cu notă de verificat pe poziție.
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
    47,41 €. Pe ce rând s-a tarifat? Pe oferta asta sunt 13 poziții netarifate
    din motivul ăsta.

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
`cerere-de-oferta-book15.xlsx`, unde din 412 rânduri ies doar 5 poziții, pentru că rândurile de
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
proiecte nu e măsurabilă (întrebarea 11 către firmă).

~~Export în formatul firmei~~ — făcut, vezi „Ieșirea ofertei". Ce rămâne:
generarea PDF cu print CSS, exportul în **șablonul clientului** (altceva decât
al firmei), anexa cu tabelele de multiplicatori pe care ofertele reale o poartă
la final, tabelele de ofertă în Postgres — azi registrul e artefact de client,
iar `SesiuneImport.id` scris în subsolul lui e singura legătură — și modulele de
contract, stoc și facturare.

## Comenzi

```bash
npm test                                       # 482 de teste (motor, import, baza, ofertă, editor)
npm run typecheck
npm run dev                                    # UI local, /izorep/
npm run import -- ../attachments/clienti/cerere-de-oferta-spital.xlsx   # pipeline complet
npm run import -- <fisier> --fara-model        # doar determinist
npm run golden -- <fisier.xlsx>                # inregistreaza iesirea modelului
npm run golden -- --verifica                   # cauta deriva modelului
npm run mapare -- <fisier.xlsx>                # inregistreaza maparea de coloane
IZOREP_FARA_MAPARE=1 npm run import -- <fisier>  # masoara A/B fara L1
python scripts/extract_price_lists.py ../attachments   # regenerează prețurile
python scripts/extract_conversii.py ../attachments     # regenerează seriile de țevi
npm run db:up && npm run db:migrate && npm run db:seed  # baza locală
```
