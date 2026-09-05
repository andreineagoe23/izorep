# L1 și L4: măsurători și plan

> Cercetare făcută pe cele 9 fișiere de client din `../attachments/`
> (3 septembrie 2026). Cifrele de aici sunt măsurate, nu estimate — scripturile
> care le produc sunt one-off, dar reproductibile din `parse-workbook.ts` +
> `extract-regex.ts`.

## Ce s-a măsurat

```
15 foi de calcul · 1.109 rânduri cu text · 520 linii cu sistem detectabil
405 texte distincte (normalizate) → 222 șabloane (cu numerele mascate)
697 linii reziduale (ce pleacă azi la model) → 318 șabloane
```

## L1 — maparea de coloane

### Rândul de antet există și e găsibil fizic

`esteRandAntet` (deja în `parse-workbook.ts`) îl găsește pe **14 din 15 foi**.
Nu e pe poziție fixă — r1, r2, r5, r6, r9, r12, r14, r15 — deci se caută.

| Fișier | Foaie | Antet |
|---|---|---|
| `Book15` | E3 Mechanical | r1 |
| `Oferta 27.04.2026` | Ventilatie | r2 ❌ *fals* |
| `Flower City` | ITV-Casa A+B / C | r5 |
| `Radoia` | 7 foi, toate | r6 |
| `Oferta pret inchideri goluri` | Izolatie Termice | r12 |
| `Oferta 27.04.2026` | Termice+Sanitare | r14 |
| `Oferta Matari` | Matari | r14 |
| `Anexa 1 la contract` | Foaie1 | r15 |
| `Izolatii Transavia` | Sheet1 | **lipsă** |

Două cazuri pe care regula fizică nu le rezolvă și pe care **modelul trebuie să
le acopere**: foaia `Ventilatie`, unde detectorul prinde un rând de cod de
articol (`02.54.04 | Z | Wickelfalzrohre…`) în locul antetului real, și
`Izolatii Transavia`, unde datele încep direct de la primul rând, fără antet.

Concluzia pentru arhitectură: detecția fizică e un **candidat**, nu un răspuns.
Modelul primește primele ~15 rânduri și spune care e antetul și ce rol are
fiecare coloană; validatorul determinist confirmă sau respinge.

### Vocabularul de roluri e mic și se repetă

48 de etichete distincte pe toate fișierele, dar toate cad în 8 roluri:

| Rol | Etichete văzute |
|---|---|
| `nr` | Nr., Nr. Crt., Numar curent, Nr. Articol, No. |
| `denumire` | Denumire articol, Descriere articol, ITEM DESCRIPTION, DENUMIRE MATERIAL… |
| `um` | UM, U.M., Unitate de masura, UNIT |
| `cantitate` | Cantitate, Cantitate TOTAL, Cantitate / unitate, Cant. Quantity, QUANTITY |
| `pret_unitar` | P.U. euro/elem, Pret unitar [EUR], RATE, Pret Euro / buc |
| `pret_total` | Pret total euro, TOTAL [EUR], TOTAL (EURO) |
| `dimensiune` | Diametru ø, Dimensiune, dimensiune gol, suprafata |
| `ignora` | Observatii, COMMENTS, Model de referinta, SUPPLY, INSTALL, PRODUCER… |

`Flower City` are trei coloane de cantitate deodată — `Cantitate / unitate`,
`Nr. Unitati`, `Cantitate TOTAL` — deci rolul `cantitate` are nevoie de o
distincție între *cantitate pe unitate* și *cantitate totală*. Azi euristica
ghicește prima coloană numerică de lângă UM și poate lua factorul.

### Ce se construiește

1. Model, un apel per foaie, pe primele ~15 rânduri: `rand_antet`,
   `rand_start_date`, și rolul fiecărei coloane din enumerarea de mai sus.
2. **Validator determinist peste mapare**, în aceeași formă ca
   `valideaza.ts`: coloana `cantitate` trebuie să fie majoritar numerică pe
   restul foii, `um` majoritar tokeni din setul de UM, `denumire` majoritar
   text. Nu trece → maparea se respinge, se cade pe euristica de azi, foaia se
   marchează pentru om. Modelul propune, codul decide.
3. Cache pe **amprentă de antet** (etichetele normalizate + numărul de coloane)
   în `data/mapari/`. `Radoia.xlsx` are 7 foi cu antet identic: o mapare, șapte
   foi. A doua listă cu același layout — zero apeluri.

Efecte colaterale, toate măsurabile: dispare euristica de cantitate; textul
trimis la L2b scade de la ~900 la ~200 de caractere (doar coloana de denumire);
un apel per foaie în loc de 13 pe fișier.

## L4 — memoria de șabloane

### Șablonul: textul normalizat, cu numerele mascate

```
"Izolatii cu vata minerala si protectie cu tabla de inox 304 Di89, g50 - COT"
  → "izolatii cu vata minerala si protectie cu tabla de inox # di#, g# - cot"
```

520 de linii ofertabile → **222 de șabloane**. Primele 100 acoperă 75% din
linii, primele 50 acoperă 56%.

### Rolul e stabil pe șablon: 100%

Măsurat pe cele **64 de șabloane care apar de cel puțin două ori** (302 linii):
în **toate**, tripleta `(sistem, tip_diametru, formă)` extrasă determinist e
identică între instanțe. Zero excepții.

Asta validează structura cache-ului: se memorează **rolul, nu valorile**.
Numerele rămân citite per linie, din poziția lor în șablon — slotul `#` care a
dat diametrul la prima instanță îl dă la toate. Un cache care ar memora
valorile ar tarifa DN15 cu prețul lui DN100 la prima linie asemănătoare.

### Câștigul imediat: deduplicarea reziduului

Liniile reziduale se repetă masiv **în același fișier**, înainte de orice
memorie între proiecte:

| Fișier | Reziduale | Șabloane | Reducere |
|---|---|---|---|
| `Izolatii Transavia` | 18 | 5 | −72% |
| `Book15` | 318 | 102 | −68% |
| `Oferta pret inchideri goluri` | 55 | 26 | −53% |
| `Radoia` | 153 | 85 | −44% |
| `Oferta 27.04.2026` | 43 | 27 | −37% |
| `Oferta Matari` | 31 | 20 | −35% |
| **total** | **697** | **318** | **−54%** |

Se trimite un reprezentant per șablon, se aplică rolul întors tuturor
instanțelor, numerele se citesc din sloturi. **Jumătate din tokenii de azi
dispar fără nicio memorie persistentă** — și fără să scadă acoperirea, pentru că
rolul e stabil (măsurat mai sus).

Asta se poate face înaintea ecranului de validare și e independentă de el.

### Ce NU se poate încă susține cu date

Documentația spune „al doilea proiect de la același client: 90–95%". **Nu e
măsurabil cu fișierele pe care le avem.** Reutilizarea între fișiere e aproape
zero — 7 șabloane comune, doar între `Oferta Matari` și `Oferta pret inchideri
goluri la foc` — pentru că cele 9 fișiere vin de la **clienți diferiți**, nu de
la același client în două proiecte.

Deci: cifra rămâne o ipoteză rezonabilă (formatul și limbajul unui client sunt
stabile), dar neverificată. **De cerut firmei: două liste de cantități de la
același client, din proiecte diferite.** Fără ele, câștigul lui L4 între
proiecte nu se poate nici măsura, nici promite.

## Ce s-a construit din planul ăsta

1. ~~**Deduplicarea reziduului pe șablon**~~ — `src/import/sabloane.ts`. −54%
   linii trimise la model (697 → 321), verificată pe golden files: 27 de linii
   proiectate, 27 identice cu răspunsul modelului.
2. ~~**L1, maparea de coloane**~~ — `mapare.ts`, `mapare-llm.ts`,
   `cache-mapari.ts`, `npm run mapare`. Un apel per layout, validator
   determinist peste propunerea modelului, cache pe amprentă de antet.
   **8 mapări acceptate, 2 respinse** pe fișierele reale. Cantitățile față de
   oferta semnată: **0/56 înainte, 56/56 după**.
3. ~~**L4, memoria de șabloane**~~ — `memorie.ts` plus depozit pe disc
   (`stoc-sabloane.ts`) și în `localStorage` (`web/stoc-local.ts`). Se învață
   doar din corecția omului, în ecranul de import.
4. ~~**Cache-ul de mapări în browser**~~ — `mapari-statice.ts`. Indexul
   `data/mapari/index.json` se generează la fiecare `npm run mapare` și se
   importă static, ca listele de prețuri; un test compară indexul cu
   directorul, ca desincronizarea să nu treacă tăcut. Cele 8 mapări lucrează
   acum și în ecran, nu doar în CLI.
5. ~~**Ecranul de validare, partea de flux**~~ — filtre (toate / de validat /
   netarifate), contor de poziții marcate pe fila fiecărei foi, navigare
   ciclică prin rândurile marcate cu focus pe coloanele extrase, și confirmare
   în masă pe exact ce e vizibil sub filtrul curent, cu un nivel de anulare.
   Confirmarea pune `sursa: "om"` — nucleul nu mai re-extrage linia și nu o mai
   trece prin guardrails — dar **nu învață șabloane**: vezi `ui.md`.
6. ~~**Rândurile de continuare**~~ — `continuare.ts`. `"Same - Ø125 mm"`
   moștenește descrierea poziției de deasupra. Măsurat pe cele 10 fișiere de
   client: `Book15.xlsx` trece de la **5 la 24 de poziții** (1 → 6 tarifate),
   celelalte 9 rămân identice.

Pe drum s-au reparat și două lucruri care nu erau în planul ăsta, dar îl
blocau: corecția dintr-o celulă a grilei nu reintra în extragere (se vedea pe
ecran, prețul rămânea pe datele vechi — `editare.ts`), iar ecranul
reimplementa L2a–L4 în loc să treacă prin pipeline, de unde trei diferențe față
de CLI: guardrails care nu rulau acolo, liniile pe care modelul nu le întoarce
nenumărate, și plafonul de 400 aplicat per apel în loc de per import. Ambele
sunt acum într-un nucleu comun (`nucleu.ts`), cu o barieră în
`tests/structura.test.ts` care spune că ecranul nu-l mai poate ocoli.

Detaliile de proiectare și capcanele găsite pe drum stau în `import.md`.

## Ce urmează

- Few-shot din catalogul propriu, abia după ce memoria are volum. Singurul loc
  unde căutarea semantică își are rostul.
- Măsurarea reutilizării între proiecte — blocată de întrebarea 11 către firmă.
