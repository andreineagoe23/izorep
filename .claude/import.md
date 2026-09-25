# Import Excel de la clienți

> Context pentru `src/import/`.

Problema: fiecare client trimite alt format și nu există template comun.
Măsurat pe cele 7 fișiere din `attachments/`: 5.659 celule, 958 descrieri
distincte, 349 linii ofertabile — dar doar **134 șabloane distincte**.

## De ce NU e o problemă de RAG

Datele sunt deja localizate exact, în celule. Nu trebuie *regăsite*, trebuie
*mapate*. Chunking-ul rupe rândul de antetul lui, embeddings-urile confundă
`DN80` cu `DN100` (aproape identice semantic, catastrofal diferite ca preț), și
nu poți scrie un test care să treacă sau să pice.

Ținta extragerii e mică și închisă — 5 câmpuri cu domenii enumerate
(`schema.ts`). Asta se rezolvă cu structured outputs, nu cu retrieval.

Singurul loc unde căutarea semantică ar ajuta: peste catalogul **propriu** de
~134 șabloane, ca să propună candidați pentru o linie nouă. Nu peste fișierul
clientului.

## Straturile

```
L0  parse-workbook.ts   parsare fizică. Zero interpretare.
L0b sectiuni.ts         contextul de secțiune (antetul de deasupra rândului)
L1  mapare.ts           roluri de coloană, un apel per layout, apoi din cache
L4  memorie.ts          șabloane învățate din corecțiile omului. Zero apeluri.
L2a extract-regex.ts    determinist. ~55% din linii.
L2a' sabloane.ts        deduplicare pe șablon: −54% linii trimise la model
L2b extract-llm.ts      model, DOAR pe reziduu. Structured outputs, temp 0.
L3  ../pricing/         tarifare deterministă
```

Ordinea de rulare nu e ordinea numerelor: memoria (L4) stă **înaintea**
modelului, fiindcă e mai ieftină și deterministă. Fiecare strat lasă mai
departe ce nu rezolvă, deci niciunul nu poate scădea acoperirea — doar costul.

**L4 e piesa care rezolvă de fapt „nu există template comun".** Nu ai nevoie de
format comun, ai nevoie de memorie per client. Cifra „90–95% la al doilea
proiect" rămâne **neverificată** — fișierele primite vin de la clienți diferiți.
Vezi `plan-l1-l4.md`.

## L1 — rolurile coloanelor

Rândul de antet nu era citit deloc. Cantitatea se ghicea: *„primul număr lipit
de unitatea de măsură"*. Măsurat pe oferta semnată, euristica aia dădea
**0 din 56 de cantități corecte** — citea prețul unitar (5,99) în loc de
cantitate (187 ml). Cu maparea: **56 din 56**. Testul stă în `tests/mapare.test.ts`,
pe o foaie reală salvată ca fixtură.

```bash
npm run mapare -- ../attachments/clienti/cerere-de-oferta-spital.xlsx   # înregistrează
npm run mapare -- --lista                      # ce e în cache
```

- **Un apel per LAYOUT**, nu per foaie: amprenta e antetul normalizat plus
  lățimea. `cerere-de-oferta-spital.xlsx` are 7 foi cu același antet — un apel. Al doilea fișier
  cu același layout — zero.
- **Modelul propune, `valideazaMapare` decide.** Verificarea nu se uită la
  etichete, ci la conținutul coloanelor pe rândurile de date: `cantitate` să fie
  majoritar numerică, `um` majoritar tokeni de unitate, `denumire` majoritar
  text, rolurile unice să fie unice. Pe cele 8 fișiere: **8 mapări acceptate,
  2 respinse** — `Izolatii Transavia` (pivot pe zone, modelul a dat `cantitate`
  pe 3 coloane) și `Anexa 1` (sub-antete repetate în date). Amândouă corect
  respinse; acolo rămâne euristica de azi.
- Textul liniei devine **denumire + denumire_alt + dimensiune + observații**,
  nu concatenarea tuturor celulelor. Nu doar denumirea: prima variantă lăsa
  `Oferta Matari` cu 0 poziții din 53 (dimensiunea golului e coloană separată)
  și `Book15` cu 2 din 5 (fișierul are descrierea de două ori, engleză și
  română, iar „vată minerală" apare doar în coloana română — de aceea există
  rolul `denumire_alt`).
- Fără mapare în cache nu se schimbă nimic. `IZOREP_FARA_MAPARE=1` o dezactivează,
  pentru măsurători A/B.

Verificat pe toate fișierele, cu și fără mapare: **aceleași poziții, aceleași
prețuri unitare**, cantități corecte. Singura diferență de valoare totală vine
din cantitățile reparate.

## L4 — memoria de șabloane

Ce a corectat omul o dată nu se mai întreabă. Același mecanism ca deduplicarea,
dar peste importuri: se memorează **rolul și harta sloturilor**, iar numerele se
recitesc din fiecare linie nouă.

Se învață **doar de la om**, la corecția din ecranul de import. Dacă ar intra și
ce zice modelul, o extragere greșită s-ar propaga tăcut peste toate proiectele
următoare. Se învață doar pozițiile complete: un șablon cu jumătate de rol arată
că știe și dă valori pe jumătate.

Depozitul e o interfață (`StocSabloane`) cu două implementări — fișier
(`data/sabloane.json`, pentru CLI) și `localStorage` (demo). Când apare serverul,
a treia e o tabelă per tenant: o corecție a unui coleg trebuie să ajute pe toată
lumea.

Ce decide dacă se învață stă în `invataDinCorectie`, nu în ecran: în ecran ar fi
fost câteva linii într-un handler de `change`, adică exact codul pe care nu-l
acoperă nimic. Ecranul rămâne cu un singur apel.

**Netestat automat:** interacțiunea din browser — încărcarea fișierului,
editarea celulei, reimportul. Nu există driver de browser în proiect. Verificat
manual că modulele se încarcă în `vite dev` și că build-ul static trece.

## Contextul de secțiune

Multe poziții nu spun singure ce sunt. În oferta 118.1 linia e doar
`Teava OL/OLZN DN15 | 130/130`; faptul că e o închidere de gol la foc stă în
rândul de deasupra, `Teceri prin pereți rezistenți la foc EI30`. Fără legătura
asta ieșeau 0 poziții din 53.

Antetul se recunoaște **fizic, nu semantic**: e o celulă îmbinată peste mai
multe coloane, deci parserul o vede repetată identic pe rând, și nu are nici
unitate de măsură, nici cantitate. Regula nu depinde de ce scrie în ea.

Secțiunea dă **doar sistemul**, niciodată diametrul, grosimea sau dimensiunea
golului — altfel o poziție ar moșteni valorile alteia.

E o soluție îngustă, pentru un singur nivel de secțiune. L1 o înlocuiește cu
ceva care știe și ierarhii, și rânduri de continuare (`"Same - Ø125 mm"`).

## Stratul determinist nu există din motive de cost

La ~350 de linii pe proiect și 20 de proiecte pe lună, trecerea tuturor liniilor
prin model ar costa câțiva euro pe lună. Regex-ul există pentru **determinism și
testabilitate**: ce se poate rezolva determinist trebuie să aibă teste care pică
atunci când cineva strică regula.

## Unde rulează stratul cu model

CLI: `npm run import -- <fisier.xlsx>`.

În aplicație: `scripts/vite-plugin-model.ts` expune `POST /api/extrage` **doar pe
serverul de dezvoltare** (`apply: "serve"`). Ecranul de import întreabă întâi
ruta cu un GET; dacă răspunde, trimite acolo liniile reziduale și primește
înapoi parametrii extrași, apoi tarifează determinist în browser.

Ecranul împarte reziduul în loturi și le trimite în paralel, actualizând bara de
progres la fiecare lot întors. Un lot care cade nu invalidează importul: restul
liniilor rămân, iar raportul spune câte loturi au eșuat.

Latența e dominată de generarea răspunsului, nu de rețea. Măsurat pe
`oferta-118-1-matari-goluri-foc.xlsx` (84 de linii reziduale, înainte de contextul de
secțiune) cu gpt-4o: un lot de 25
de linii ia ~19s, deci varianta secvențială inițială ținea ecranul gol ~80s. În
loturi de 12, câte 4 deodată: **19–39s**, cu progres vizibil de la prima
secundă.

Cheia stă în procesul Node al lui `vite dev` și nu ajunge niciodată în pagină.
`apply: "serve"` e mecanismul, nu o precauție: în `vite build` ruta nu există,
deci varianta de pe Pages rămâne pur deterministă — ecranul vede doar că ruta
lipsește și își schimbă mesajul. Middleware-ul răspunde doar cererilor de pe
loopback și plafonează la 400 de linii per import.

## Reguli pentru stratul cu model

- structured outputs cu schemă strictă; ieșirea trece prin Zod înainte de orice
- `temperature: 0` — altfel același import dă rezultate diferite
- primește doar liniile reziduale, în loturi de 12, câte 4 loturi în paralel
- **nu vede și nu calculează prețuri**
- scor de încredere pe linie; sub prag → validare umană obligatorie
- ieșirea trece prin `valideaza.ts` înainte să plece din `extrageCuModel`
- primește și **antetul de secțiune** al liniei, doar ca să afle sistemul; fără
  el, pe Oferta Matari 12 rânduri `Teava OL/OLZN DN15` (sistemul vine din
  „Treceri prin pereți rezistenți la foc”) ar fi ieșit `null`
- răspunsurile se leagă **doar** de indecșii trimiși în apelul respectiv; un
  index întors de două ori se aruncă (`modelFaraRaspuns`)
- un `sistem: null` de la model **nu șterge** o citire parțială care știa
  sistemul: linia rămâne, marcată, cu cauza ei
- jacheta (tablă, inox, PVC) e pusă mereu peste izolație înainte de tarifare
  (`jachetaLaExterior`): la `temperature 0` modelul a pus o dată, nu și a doua
  oară, `tabla_inox` ca strat principal pe 14 casete din Izolații Transavia

## Deduplicarea pe șablon

Liniile reziduale se repetă masiv **în același fișier**, înainte de orice
memorie între proiecte. Măsurat pe cele 9 fișiere de client: **697 de linii
reziduale → 321 de șabloane, −54%**. Pe `Izolatii Transavia` −72%, pe
`Book15` −67%.

Șablonul e textul normalizat cu numerele scoase, iar numerele rămân separat, pe
poziții („sloturi"):

```
"…inox 304 Di89, g50 - COT"
  tipar  "…inox # di#, g# - cot"
  numere [304, 89, 50]
```

Se trimite la model **un reprezentant per șablon**. Rolul lui — sistem, tip de
diametru, formă — se duce pe restul grupului; **valorile se recitesc din
sloturile fiecărei linii**. Un cache care ar copia și valorile ar tarifa `Di60`
cu prețul lui `Di89`.

Regula pe care se sprijină: rolul e stabil pe șablon. Măsurat pe cele 64 de
șabloane care apar de cel puțin două ori (302 linii), tripleta e identică între
instanțe în **100%** din cazuri.

**Când nu e sigur, nu se face.** Se refuză proiecția dacă valoarea întoarsă de
model nu apare printre numerele liniei (a dedus-o — `DN50` din `2''` — sau a
inventat-o), sau dacă sloturile care aveau aceeași valoare la reprezentant ajung
să difere pe linia țintă. Liniile astea pleacă la model într-o a doua trecere,
deci acoperirea nu scade — doar costul.

Verificat pe golden files, unde există răspunsul modelului pentru **fiecare**
linie: 27 de linii proiectate, 27 identice cu ce răspunsese modelul pentru ele.
Testul rulează în CI (`tests/golden.test.ts`).

Liniile venite pe drumul ăsta au `sursa: "sablon"` și trec prin aceleași
verificări de plauzibilitate ca cele din model — numerele lor vin din alt text
decât cel citit de model.

## Guardrails pe ieșirea modelului

Zod validează **forma** răspunsului. Nu validează **sensul** lui:
`diametru_valoare: 76` trece perfect și când în linie scria `Di60` — exact ce a
făcut `gpt-4.1-mini` pe `cerere-de-oferta-transavia-inox.xlsx`, cu încredere raportată 0,95.
Alt diametru înseamnă alt rând în matrice, deci alt preț, fără nimic care să se
aprindă.

`src/import/valideaza.ts` e stratul care se aprinde. Determinist, pur, testat:

| Cod | Ce prinde |
|---|---|
| `diametru_necitat` | numărul nu apare în textul sursă |
| `grosime_necitata` | idem, pe grosimi (inclusiv straturile suplimentare) |
| `gol_necitat` | idem, pe dimensiunile golului |
| `dn_necunoscut` | DN care nu există în tabelul de conversie |
| `grosime_in_afara_listei` | grosime pe care sistemul ăla nu o are ofertată |
| `forma_contrazice_um` | `forma: "ml"` pe un rând cu UM `buc` |
| `notatie_contrazice_materialul` | scrie `DN`, dar materialul din text dă diametrul exterior |
| `diametru_contrazis` | scrie `DN`, dar pe rând e un Ø care nu e DN-ul ăla în tabelul de conversie (ISO, DIN); rulează, ca rândul de mai sus, pe orice sursă |

Regula de citare vine din promptul propriu al stratului: *„nu inventa valori,
dacă un câmp nu apare în text pune null"*. Aici doar se verifică dacă a
respectat-o. O regulă scrisă în prompt e o rugăminte; una scrisă aici e o
verificare cu test.

**Conversiile legitime nu se raportează.** `Dn 2''` e o citare corectă a lui
DN50 deși cifra 50 nu apare nicăieri, iar `Rohr 88,9` e DN80. Validatorul
cunoaște tabelul de toli și pe cel ISO din `.claude/tevi.md`, tocmai ca să tacă
acolo. Un avertisment care se aprinde mereu nu mai e citit de nimeni.

Efectul unui avertisment: `incredere = 0`, motivul se scrie pe linie, poziția
merge obligatoriu la validare umană. Prețul **nu** se șterge — omul vede și
propunerea, și motivul pentru care nu e de încredere.

### Excepția: verificarea care rulează pe orice sursă

`notatie_contrazice_materialul` **nu** e un guardrail pe model, deși stă în
același fișier, și de aceea `nucleu.ts` îl cheamă separat. Restul verificărilor
nu se aplică liniilor `sursa: "regex"` — alea citesc direct din text și au
testele lor. Dar tocmai acolo era gaura: **SPIRO e prins chiar de `RE_DN` din
`extract-regex.ts`**, deci pe calea deterministă nu trecea pe la niciun
validator.

Ce lăsa să treacă, măsurat: `Wickelfalzrohr starr SPIRO DN 125` se tarifează pe
seria de oțel — DN125 → ø139,7 → rândul 140 → **13,74 €/ml**, în loc de rândul
125 → 11,36 €. **+21%, în tăcere.** Inversarea e ce face capcana periculoasă:
cazurile *sigure* dau eroare și se văd (ø160, ø250, ø315 nu există în tabelul de
oțel, deci `DiametruNecunoscut`), iar cele *periculoase* trec neobservate, exact
fiindcă 125 și 200 există în tabel și se convertesc „cu succes".

Verificarea nu e despre încrederea în model, e despre **textul sursă care spune
că notația minte** — deci rulează indiferent de sursă, cu o singură excepție:
`"om"`. Pe cele 10 fișiere reale aprindea **16 linii**. Nu schimbă niciun preț:
poziția primește avertisment, `incredere = 0` prin mecanismul existent, și merge
la om.

Din 11 septembrie 2026 regex-ul citește singur SPIRO ca diametru exterior
(răspunsul firmei), deci pe calea deterministă verificarea nu mai are ce prinde
la spiro. Rămâne utilă pe ieșirea modelului și pe țevile de plastic scrise cu
`DN`.

PVC-ul e deliberat în afara listei de materiale, deși e în `PLASTIC_IS_OD`: în
textele clienților „PVC" înseamnă aproape întotdeauna jacheta de PVC peste
izolație (sistemul `pvc` al motorului), nu țeavă de PVC — s-ar aprinde pe
poziții perfect corecte, iar un avertisment care se aprinde degeaba nu mai e
citit de nimeni.

Aplicarea restului stă în `extrageCuModel`, nu în pipeline: e singurul punct prin care
trec toate căile — CLI, ruta din `vite`, scriptul de comparare — deci un
apelant nou nu are cum să o sară. Pipeline-ul recalculează aceleași reguli
pentru forma structurată din raport; funcția e pură, a doua trecere nu costă.

**Ce nu prinde:** confuzia între două valori care apar amândouă în text. Aia
rămâne treaba omului de la validare.

### Ce știe promptul, și ce verifică codul în locul lui

Regula casei: *o regulă din prompt e o rugăminte, una din cod e o verificare*.
Fiecare adăugare la prompt de pe 7 septembrie 2026 are perechea ei deterministă:

| În prompt | Verificarea care îl ține de scurt |
|---|---|
| `tabla` e doar aluminiu/zincată; `tabla_inox` e sistem separat | `extract-regex.ts` recunoaște inoxul determinist, iar `MATRICE` din `valideaza.ts` îl include, deci `grosime_in_afara_listei` funcționează și pe el |
| grosimile de jachetare: aluminiu 0,6/0,8/1,0 · inox 0,4/0,5/0,6 | aceeași `grosime_in_afara_listei` |
| grosimea jachetei lipsește aproape mereu → `null`, nu se ghicește | `grosimeEfectiva` din motor o deduce doar când sistemul are **o singură** grosime la acel diametru; altfel „grosime nespecificată și ambiguă" |
| **NU SUBSTITUI** — dacă în text scrie `g48`, se întoarce 48, nu 50 | motorul refuză poziția (`g48` nu e grosime ofertată la vată) în loc să o tarifeze cu 50. Substituția e decizia omului |

Ultima e cea care contează cel mai mult și e cea mai contraintuitivă: un model
„serviabil" care rotunjește `g48` la `g50` produce un preț plauzibil și complet
fals, pe care nimeni nu-l mai prinde. Un model care întoarce fidel `48` produce
o poziție marcată, pe care o rezolvă omul într-o secundă.

Ordinea în `extract-regex.ts` contează: inoxul e căutat **după** elastomer și
vată minerală. Textul real din Transavia e „Izolații cu vată minerală și
protecție cu tablă de inox 304" — sistemul principal e vata, inoxul e strat
peste ea. Pus înaintea vatei, regex-ul ar clasifica greșit toată linia.

### Liniile pe care modelul nu le întoarce

Contractul e „câte un obiect per linie, cu același index". Modelul îl încalcă
în tăcere: pe `oferta-118-nisal.xlsx`, 43 de linii trimise, **35 întoarse**.
Liniile lipsă nu apăreau nicăieri în raport — nici ca poziții, nici ca erori —
deci un fișier ciuntit arăta exact ca un fișier cu mai puține poziții.
`RaportImport.modelFaraRaspuns` le numără.

## Golden files: deriva modelului

`OPENAI_MODEL` arată spre ceva care se poate schimba sub noi. Aliasul `gpt-4.1`
e mutat de OpenAI pe alt snapshot fără să se schimbe nimic în repo: același
fișier de la client, alte poziții, alte prețuri, zero urme în `git log`. De aceea
implicitul din cod e **snapshot datat** (`MODEL_IMPLICIT`), iar `.env.example`
la fel.

Pinul singur nu ajunge — cineva tot schimbă snapshot-ul cândva. Golden files
sunt măsurătoarea față de care se compară:

```bash
npm run golden -- ../attachments/clienti/cerere-de-oferta-transavia-inox.xlsx   # înregistrează
npm run golden -- --verifica                                # caută deriva
```

Fișierul înregistrat (`tests/golden/*.json`) ține textul liniilor, ce a răspuns
modelul, avertismentele și prețurile rezultate. Servește la două lucruri
diferite:

- **`tests/golden.test.ts`** rejoacă **offline** partea deterministă — validare
  + tarifare — peste ieșirea înregistrată. Rulează în CI, fără cheie și fără
  rețea. Pică atunci când o schimbare de-a *noastră* mută prețurile pe linii
  reale. `pricing.test.ts` acoperă pozițiile din ofertele semnate; asta acoperă
  drumul complet, cu tot cu ce înțelege modelul din text.
- **`--verifica`** re-cheamă modelul pe aceleași texte și compară câmpurile care
  intră în tarifare. Costă tokeni, se rulează manual, și e singurul lucru care
  poate spune „modelul răspunde altfel decât luna trecută". Nu spune cine are
  dreptate — spune unde diferă.

Se înregistrează doar textele și parametrii extrași. Prețurile firmei nu trec
niciodată prin model, deci nu au ce căuta nici în golden files.

## Bugetul de tokeni

Fiecare apel cară **~1.177 tokeni ficși** — system prompt (~735) plus schema
JSON (~442) — retrimiși integral la fiecare lot. Pe `cerere-de-oferta-spital.xlsx` pleacă 153 de
linii la model:

| Lot | Apeluri | Doar overhead |
|---|---|---|
| 12 | 13 | 15.300 tok |
| 25 | 7 | 8.200 tok |
| 40 | 4 | 4.700 tok |

De aceea lotul implicit e **25**, nu 12.

### Două limite, direcții opuse

- **Pe minut** (TPM/RPM) — vârf de moment → `IZOREP_CONCURENTA=1`
- **Pe zi** (TPD) — buget total → `IZOREP_LOT` mai **mare**, model cu plafon
  mai mare, sau `--fara-model`

Un lot mai mic ajută la prima și strică a doua. Mesajul din `LimitaDeRata` le
distinge, ca să nu tragi în direcția greșită.

### Alegerea modelului

Implicit: **`gpt-4.1-2025-04-14`** — snapshot datat, nu aliasul `gpt-4.1`.
Atenție: `OPENAI_MODEL` din `.env` **bate** implicitul
din cod, iar `.env` e gitignorat — un commit care schimbă implicitul nu atinge
fișierul nimănui. Verifici cu ce rulezi de fapt în antetul `npm run import` sau
în linia „Stratul cu model" de la `npm run dev`. Nu `gpt-4o` — pe contul firmei acela are 90.000 tokeni
pe zi, iar `cerere-de-oferta-spital.xlsx` consumă ~50.000, deci două fișiere și ziua s-a
terminat. `gpt-4.1` are 900.000 la aceeași limită pe minut.

**Familia `gpt-5` nu se poate folosi aici.** Respinge `temperature: 0` — acceptă
doar 1 — iar regula „temperature 0, altfel același import dă rezultate
diferite" nu e negociabilă. În plus arde tokeni de raționament: pentru un
răspuns de 6 tokeni, `gpt-5-nano` a consumat 338, `gpt-5-mini` 82,
`gpt-4.1-mini` 6.

`gpt-4.1-mini` are 2.000.000 pe zi și e tentant, dar măsurat:

| Fișier | Acord | Diferențe cu impact pe preț |
|---|---|---|
| `Izolatii Transavia` (18 reziduale) | 88,9% | **1** — a citit `Di60` ca 76 |
| `Oferta 27.04.2026` (35 reziduale) | 91,4% | 0 |

Un diametru greșit înseamnă rând greșit în matrice, deci preț greșit — și nu
se semnalează, fiindcă modelul e sigur pe el. Se poate trece pe mini, dar după
ce `npm run compara` dă zero diferențe cu impact, pe mai multe fișiere.

```bash
npm run compara -- <fisier.xlsx> gpt-4.1 gpt-4.1-mini
```

Compară doar câmpurile care intră în tarifare — `incredere` și `motiv` sunt
pentru omul care validează, nu pentru preț. Nu poate spune care model are
dreptate, doar unde diferă; de-aia tipărește linia sursă.

### Ce reduce consumul, în ordinea efectului

1. **Stratul determinist.** Fiecare linie rezolvată de L2a costă zero tokeni.
   `Oferta Matari` a trecut de la 0 la 53 de poziții deterministe și acum nu
   mai consumă nimic. L1 și L4 sunt răspunsul structural, nu o setare.
2. **Loturi mai mari** — mai puține retrimiteri ale promptului. Peste ~30 de
   linii pe lot acuratețea începe să scadă; 25 e verificat.
3. **Un model cu plafon mai mare.** Sarcina e extragere cu schemă închisă, cinci
   câmpuri cu domenii enumerate — nu raționament. Merită măsurat dacă un model
   mai mic o face la fel de bine: `OPENAI_MODEL` e deja configurabil, iar
   verificarea e ieftină — rulezi pe același fișier și compari cu ce dă stratul
   determinist pe liniile pe care le rezolvă amândouă.
4. **Text mai scurt per linie.** Se trimit până la 900 de caractere; util e
   rareori peste 200.
5. **`motiv` mai scurt.** E o propoziție per linie, în tokenii de ieșire.

Un lot căzut nu invalidează importul: restul liniilor rămân, iar raportul spune
câte loturi au eșuat. Clientul are `maxRetries: 4`, deci un 429 se reia cu
backoff înainte să devină `LimitaDeRata`.

## Notele de la finalul ofertei

Fiecare ofertă se termină cu note, semnături și titluri. Textul lor conține
exact cuvintele după care se recunoaște sistemul:

```
"Preturile se refera la inchideri goluri la foc EI60 si EI90 pentru conducte metalice"
"In pretul inchiderilor golurilor la foc nu sunt incluse colierele si banda wrap"
"1. Izolatii conducte PPR cu Armaflex gr. 9 mm - manopera :"
```

Toate trei ieșeau `goluri_foc` sau `elastomer`, intrau în raport ca poziții
netarifate și plecau la model degeaba.

Regula: **un rând fără unitate de măsură ȘI fără cantitate nu e poziție.**
Semnalul e fizic, nu semantic — cuvintele dintr-o notă sunt aceleași cu ale unei
poziții, măsura nu e. Măsurat pe cele 9 fișiere de client: scoate **35 de
rânduri, dintre care 0 erau tarifate**.

| Fișier | Poziții înainte | După | Tarifate |
|---|---|---|---|
| `Oferta pret inchideri goluri la foc` | 55 | 0 | 0 → 0 |
| `Anexa 1 la contract` | 5 | 0 | 0 → 0 |
| `Oferta Matari` | 73 | 65 | 53 → 53 |
| `Oferta 27.04.2026` | 59 | 58 | 30 → 30 |
| `Book15` | 9 | 7 | 1 → 1 |
| **total** | **513** | **441** | **261 → 261** |

Rândurile nu dispar din fișier: rămân în grilă și rămân antete de secțiune. Se
opresc doar din a fi poziții, și se numără (`faraMasura` în raport, „note și
titluri" pe ecran) — ca să se vadă dacă într-un fișier nou începe să cadă ceva
real acolo.

## Capcane găsite în fișierele reale

- **`cerere-de-oferta-book15.xlsx`** — rânduri de continuare `"Same - Ø125 mm"` care moștenesc
  descrierea de deasupra. Fără carry-forward pierzi specificația. Încă nerezolvat:
  de-asta ies doar 5 poziții din 412 rânduri.
- **`cerere-de-oferta-transavia-inox.xlsx`** — pivot pe 11 coloane de zone; tipul e codat în
  text: `"...Di89, g50 - COT"`.
- **`Flower City`** — `cantitate/unitate × nr. unități = total`, plus `#REF!`.
- **`cerere-de-oferta-spital.xlsx`** — descrieri multi-linie cu specificații complete într-o
  singură celulă; zona lipită de observații cu `/`.
- **`cerere-de-oferta-spital.xlsx` / închideri la foc** — „Protecție la foc EI 60 pentru
  tubulaturile din tablă zincată" e protecția *tubulaturii*, altă lucrare, fără
  listă de prețuri. Cu „rezistent la foc" sau „EI 60" ca semnal de sistem, 28 de
  rânduri de acolo intrau ca închideri de gol, iar dimensiunea tubulaturii
  rectangulare (`1000/500`) era citită drept dimensiune de gol. Semnalul cere
  noțiunea de **gol** sau de **trecere prin perete**.
- **`Oferta 27.04.2026`, tubulatură SPIRO** — „Wickelfalzrohr starr SPIRO
  DN 160". Clientul scrie `DN`, dar la spiro nominalul *este* diametrul
  exterior. **Firma a confirmat pe 11 septembrie 2026** („la spiro este doar
  diametru exterior"), deci `extract-regex.ts` o citește `exterior`. DN125 și
  DN200 ies exact. ø160 iese cu preț (14,37, rândul 169) dar **marcat**: oferta
  semnată are 14,16 (rândul 159), iar rotunjirea la 1 mm peste un rând e
  întrebarea 3 — vezi „Rotunjirea neconfirmată" în `pricing.md`.
- **`cerere-de-oferta-book15.xlsx`, tabla tubulaturii** — „izolat cu vată minerală de 30 mm ...
  realizat din tablă zincată la cald". Tabla e materialul tubulaturii, nu
  jacheta; citită ca jachetă, prețul urca de la 16,17 la 30,77–56,08 €/ml, fără
  marcă. `TABLA_E_TUBULATURA` o scoate („realizat din tablă", „made of ...
  sheet", „tubulaturile din tablă"), iar `TABLA_E_JACHETA` o păstrează când
  rândul spune și jacheta („protejată cu tablă", „protecție mecanică",
  „casetă", „jacketing").
- **`cerere-de-oferta-spital.xlsx`, țevile de instalații** — „inclusiv fitinguri, treceri prin
  pereți și planșee cu țeavă de protecție". „Treceri prin pereți" e închidere
  la foc **doar lângă foc** (`foc`, `EI xx`); fără regula asta, 58 de rânduri de
  altă meserie apăreau ca închideri de gol fără dimensiuni.
- **Țolii** — `Ø1/2"`, `Dn 1 1/4"`. Se citeau ca ø1 și DN1: pe `Oferta
  27.04.2026` șase poziții ieșeau toate la 5,70 €/ml. `RE_TOLI` cere prefixul
  (ø/DN) și ghilimeaua; `Dn 25 (1'')` rămâne DN25.
- **`PEHD D40x3.0`** — grosimea peretelui lipită de diametru nu lăsa granița de
  cuvânt: 11 poziții de pe `Oferta 27.04.2026` ieșeau „fără diametru".
- **DN lângă Ø, pe același rând** — `Oferta 27.04.2026`, rândurile 44–47:
  „Kautschuk, d=9mm, DN20 | … Dimensiuni: Ø20mm". Ø20 nu e DN20 pe nicio
  coloană a tabelului de conversie, e țeavă de plastic, iar oferta semnată a
  luat Ø-ul. `esteConversiaDN` decide: un Ø care *este* DN-ul (ISO sau DIN,
  ±1 mm) lasă DN-ul, altfel câștigă Ø-ul. Pe calea modelului, același conflict
  aprinde `diametru_contrazis`. Vezi `tevi.md`.
- **Numere lipite de text** — `DN150din tabla`, `Ø32mm`: fără graniță de cuvânt
  după cifre, diametrul nu se citea. `RE_DN` și `RE_OD` cer acum doar ca
  numărul să se termine.
- **Grosimea tablei** — „protecție cu tablă de inox 0,5 mm". Se citește doar
  zecimal și doar din grosimile listei (aluminiu 0,6 / 0,8 / 1,0, inox
  0,4 / 0,5 / 0,6); un întreg de lângă tablă e grosimea izolației, iar un
  interval („0.6 – 0.8 mm", Book15) rămâne decizia omului.
- **Grosimea înaintea materialului** — „DN80 elastomer 13mm+40mm vata
  minerala": vata n-are număr după nume. `grosimeLangaSistem` caută și imediat
  înainte, doar o grosime a acelui sistem (elastomerul și vata n-au grosimi
  comune). DN80 și DN100 compus ies acum 44,35 și 57,82 €, ca în oferta semnată.
- **Oferta 118** — ligaturi stricate (`sinte␣c`): textul e copiat dintr-un PDF.
- **Cantitatea** — primul număr de pe rând e aproape întotdeauna *numărul curent*
  al poziției, nu cantitatea. Euristica actuală o caută lângă unitatea de măsură;
  dispare când apare maparea de coloane (L1).
