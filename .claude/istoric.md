# Istoricul sesiunilor

> **Citește asta întâi, la începutul fiecărei sesiuni**, înainte de orice cod.
> La proiect lucrează doi oameni, fiecare cu agentul lui, pe calculatoare
> diferite. Fișierul ăsta e predarea dintre sesiuni: ce s-a făcut, ce n-a fost
> verificat și ce are de făcut cel care urmează.

## Regula

1. **La început:** citești intrarea de sus (cea mai nouă) și faci întâi ce
   scrie la „Pentru cine urmează”. Dacă ceva de acolo nu se mai potrivește cu
   repo-ul (`git log`, `git status`), crezi repo-ul și notezi diferența.
2. **La sfârșit**, înainte de ultimul commit al sesiunii: adaugi o intrare
   nouă **sus**, pe tiparul de mai jos, și o comiți odată cu munca. O sesiune
   fără intrare e o sesiune pe care celălalt o reface.
3. Intrarea e scurtă: ce e nou, nu tot ce se știe. Detaliile stau în
   `.claude/stare.md` (starea proiectului) și în `docs/plan-ux.md` (planul în
   lucru); aici doar trimiți la ele.
4. Scrii separat ce ai **verificat** de ce ai **scris fără să poți verifica**
   (și de ce: fără Docker, fără fișierele clienților, fără cheie de model).
5. Intrările vechi nu se rescriu. Când fișierul trece de vreo zece intrări,
   cele mai vechi se șterg: rămân în `git log`.

Tiparul unei intrări:

```
## <data> · <cine> · ramura <ramura>
Calculatorul: ce are și ce nu (Docker, fișierele clienților, cheia de model).
### Făcut            (cu commit-urile)
### Verificat        (cum și unde)
### Neverificat      (și de ce)
### Pentru cine urmează   (în ordine, primul lucru primul)
### De hotărât de oameni  (ce nu decide agentul singur)
```

---

## 26 noiembrie 2026 (seara târziu) · Andrei (neagoeandrei23) · `main`

Calculatorul: Docker (`izorep_e1` pentru teste, **`izorep_full`** făcută de la zero pentru testul complet,
contul `test-complet@izorep.invalid`), fișierele clienților, modelul oprit. Cerut: ramurile vechi șterse și
„testează tot software-ul la maxim”.

### Făcut

| Commit | Ce |
|---|---|
| (ramuri) | șterse `plan-simplificare`, `main-backup`, `cloud-design`, `ux-lucrare`; `docs/plan-simplificare.md` rămâne în `4838e1a` |
| `07acca6` | 4 greșeli găsite de test: „Clientul a acceptat” blocat de rândurile rămase; necesarul rectangular; **virgula în casetele de numere (2,97 → 297)**; banii pe Comenzi |
| (ultimul) | oracolul ca test permanent (`scripts/oracol/`, `tests/oracol/`, `tests/oracol.test.ts`); `stare.md`, aici |

### Verificat

- **845 de teste**, typecheck, build. Tabelul întreg: `.claude/stare.md`, „testul complet”.
- Oracolul independent: 86 / 86. Fluxul cap-coadă în browser pe ISORAD (cerere → închidere), totalurile egale
  cu oracolul în ofertă, fișierul clientului, situație. 188 de ecrane fără erori și fără derulare laterală.
  Serverul: 401 / 403 / 423 și antetele. Text periculos din fișier: neexecutat.

### Neverificat

- Modelul real (costă), Excel / LibreOffice, pozele citite de model, Render parcurs cu mâna.

### Pentru cine urmează

1. Push pe `main` (deci Render) pentru reparații, mai ales virgula în prețuri: pe Render orice preț scris cu
   virgulă într-o factură intra de 100 de ori mai mare.
2. O trecere pe Render cu mâna; fișierul clientului deschis în Excel.
3. Restul planului, când vin documentele firmei (Etapa 3, Conlit, N4).

### De hotărât de oameni

- Un rulaj al importului cu modelul real pe cele două cereri-oracol (puțini tokeni), ca să vedem și calea cu model.

## 26 noiembrie 2026 (după-amiază, noaptea) · Andrei (neagoeandrei23) · `main` (pe GitHub și pe Render)

Calculatorul: ca în intrarea de dedesubt. Andrei: „continuă planul cu tot ce poți face”. Fiecare
etapă pe ramura ei, verificată, unită fast-forward pe `main`; ramurile șterse. La sfârșit, cerut de
Andrei: tot urcat pe `main`, deci **Render are Etapele 1, 2, 4, 5, 6 și 7**.

### Făcut

| Commit | Ce |
|---|---|
| `1320c44` | Etapa 5: „Descarcă în fișierul clientului” (`web/oferta-client.ts`, JSZip, direct în XML-ul foii) |
| `191f937` | Etapa 6: întrebările pentru client pe fila Cerere (email și Excel), în „Urmează” și pe Acasă |
| `deeb7af` | Etapa 4 fără Conlit: ± % pe rând; +20 % foc pe industrial ca bifă, oprită pe cererile noi |
| `b5103d3` | Etapa 7: obiectivul la descărcare, „Lăsate afară” în propoziție, titlul fără cifră, UM din piesă |

### Verificat

- `npm run typecheck`, **837 de teste**, nimic sărit; `npm run build:server`.
- Etapa 5: pe toate cele 13 fișiere de client + 2 exemple, arhiva neatinsă octet cu octet, celulele
  clientului identice, deschise cu ExcelJS și openpyxl; din browser TRANSAVIA → 94.575,06 €.
- În browser (1440 / 390 / 1920 px, ambele teme): fiecare etapă, cu cifre (detaliile în `stare.md`).
- După push: CI verde pe `main`, iar pagina de pe Render servește același script ca build-ul local.

### Neverificat

- **Fișierul clientului în Excel sau LibreOffice**: n-avem niciunul pe calculator. De deschis o dată
  înainte de primul trimis la un client.
- Nimic cu modelul real.
- Pe Render, nimic parcurs cu mâna după publicare (doar că pagina e cea nouă și răspunde).

### Pentru cine urmează

1. Andrei sau Adrian: pe Render, o dată, fluxul nou: Cerere nouă pe ISORAD, întrebările, „± %”,
   „Descarcă în fișierul clientului”, iar fișierul descărcat deschis în Excel.
2. Adrian: C1–C4 și fișierele din Etapa 0; lista Conlit (Etapa 4) și situația + recepția (Etapa 3).
3. Etapa 3, când vin documentele firmei; apoi N4 și lista Conlit, când vin fișierele lor.

### De hotărât de oameni

- Bifa de foc pornește **oprită** pe cererile noi (planul, C2). Dacă firma confirmă +20 %, se pune pornită.
- Numărul din fața numelui fișierului („118 Nisal”) nu mai intră în titlu.
- Ramura `plan-simplificare` (și `main-backup`, `cloud-design`, `ux-lucrare`): de șters?

## 26 noiembrie 2026 · Andrei (neagoeandrei23) · ramurile `etapa-1-import`, `etapa-2-firme`

Calculatorul: Docker (Postgres pe 5433, baza `izorep_e1`), fișierele clienților, serverul
pornit fără cheie de model (8830, `build:server`, `TENANT_ID` dat: testele lasă tenanți
temporari cât rulează). De la Adrian nu venise nimic nou (`git fetch`).

### Făcut

| Commit | Ce |
|---|---|
| `d1fa294` (pe `etapa-1-import`) | „Treceri prin planșee … la foc” sunt închideri de gol (exemplul 2, D07–D08); test în `audit-15-noiembrie` |
| (pe `etapa-2-firme`) | Etapa 2: lucrările pe firme. Filele RADOIA · ISORAD la Lucrări și Clienți, firma la Cerere nouă (implicit ultima), pe Acasă și pe pagina lucrării. Fără migrare. Teste: `tests/lucrari-firme.test.ts` |

### Verificat

- `npm run typecheck` curat, **815 teste**, nimic sărit; `npm run build:server` trece.
- Etapa 1 în browser: exemplul 2 pe toate filele, la 390 / 1440 / 1920 px, ambele teme (zero
  derulare, zero erori); comparat rând cu rând cu `cheie-de-verificare.xlsx` (diferențele sunt
  cele voite din 23 noiembrie, plus D07–D08 reparate). TRANSAVIA: 98 „Gata” + distribuitorul,
  „E bine” → **94.575,06 €**.
- Etapa 2 în browser: ISORAD → „Cerere nouă” (ISORAD bifat) → exemplul 1 → lucrarea la
  ISORAD; pe Ofertă schimbată pe RADOIA trece la RADOIA și înapoi; Acasă are firma pe rând;
  390 / 1440 / 1920 px, ambele teme, zero derulare laterală, zero erori.
- A/B pe toate fișierele (3.706 rânduri): s-au mișcat doar D07–D08 din exemplul 2.

### Neverificat

- Clienți cu clienți reali pe file: pe `izorep_e1` nu e nicio ofertă descărcată (filele arată 0 / 0).
- Pozele din carnet pe o cerere nouă ISORAD (drumul e același, `deschideSesiune`, dar nevăzut).
- Nimic cu modelul real.

### Pentru cine urmează

1. Adrian: C1–C4 și fișierele din Etapa 0 (neschimbat).
2. Unirea pe `main` (deci Render) a ambelor ramuri, `etapa-1-import` apoi `etapa-2-firme`
   (fast-forward), când zice Andrei.
3. Etapa 3 cere situația și recepția firmei; până vin, Etapa 4 (± % pe poziție; lista Conlit
   cere lista lor) sau Etapa 6 (întrebările pentru client), care nu așteaptă nimic.

### De hotărât de oameni

- Lucrările fără firmă scrisă stau la RADOIA (nu o filă „Fără firmă”).
- D06 (țeava fără material la gol) rămâne „Gata”: materialul nu intră în preț.

## 23 noiembrie 2026 · Andrei (neagoeandrei23) · ramura `etapa-1-import`

Calculatorul: Docker (Postgres pe 5433, baza `izorep_e1`), fișierele clienților,
cheie de model nefolosită (serverul pornit fără ea). Adrian a fost la firmă pe
16 noiembrie; notițele lui și răspunsurile pe `intrebari-firma-3.md` sunt în
`docs/plan-dupa-demo.md`, cu planul pe șapte etape. Aici: Etapele 0 și 1.

### Făcut

| Commit | Ce |
|---|---|
| `9b0ed22` | `docs/plan-dupa-demo.md`; `.claude/stare.md` tăiat la ultimele intrări (2.295 → ~300 de linii; restul în `git show d82af7e:.claude/stare.md`) |
| `74ca6d7` | Etapa 1: ce lipsește din cerere se întreabă clientul. Tabla fără material, grosimea de la alt diametru sau din tabelul uzual, golul nescris: „Fără preț”. Distribuitorul × 2,47 și două grosimi pe același ø: „De verificat”. Elastomer peste 32 mm fără extrapolare. Tubulatura rectangulară în metri: 2 × (A + B + 2g). „din tablă zincată,” a tubulaturii. Cuvintele confirmate și literele lipsă. Conlit 60 mm. Demontarea ca poziție cu preț de mână. Fără UM și patul de cabluri: „De verificat”. Cantitatea 0. Pe ecran, „Alege tabla”; materialul sau tabla neales rămâne „Fără preț” și când omul schimbă doar grosimea (era bugul 3 din predarea de mai jos) |

Teste noi: `tests/demo-16-noiembrie.test.ts`. Testele vechi schimbate cu motiv,
în comentariile lor (`audit-15-noiembrie`, `nucleu`, `fara-pret`, `oferte-semnate`,
`document-oferta`, `explica`).

### Verificat

- `npm run typecheck` curat, **810 teste**, nimic sărit (`IZOREP_DB=izorep_e1`),
  `npm run build:server` trece.
- A/B pe toate fișierele (3.708 rânduri): tabelul din `.claude/stare.md`, 23 noiembrie.
- În browser (`build:server`, 8830, modelul oprit), exemplul 1 încărcat ca lucrare
  nouă: „Alege tabla” pe cele 3 rânduri, aleasă → rândul trece „Gata”; 1440 și
  390 px, zero erori, zero derulare laterală pe toate cele cinci file (o etichetă
  lungă de motiv o scotea în lateral la 390 px: reparat).

### Neverificat

- Nimic cu modelul real: un rând pe care regulile îl lasă „Fără preț” (grosime,
  tablă) pleacă la model; ce face modelul cu el e la fel de nevăzut ca înainte.
- În browser: doar fila Cerere a exemplului 1, tema deschisă. Nu: tema închisă,
  1920 px, „E bine” pe distribuitor, demontarea cu prețul pus de mână.
- Importurile salvate înainte de azi, unde omul alesese deja materialul unui rând
  „Lipsește materialul”: marcajul vechi a rămas pe ele, deci redevin „Fără preț”
  până se alege din nou. Pe Render nu e încă nimic real.

### Pentru cine urmează

1. Adrian: C1–C4 din `docs/plan-dupa-demo.md` (grosimile uzuale, +20 % foc
   industrial, discountul de 3 %, PVC pe industrial) și fișierele din Etapa 0.
2. Unirea `etapa-1-import` pe `main`, după o privire în browser pe exemplul 2 și
   pe TRANSAVIA („E bine” pe distribuitor → 94.575,06).
3. Etapa 2 (lucrările pe firme) sau Etapa 3 (situațiile), după `docs/plan-dupa-demo.md`.
4. N4 (dimensiunile în coloana 2), când vine fișierul.

### De hotărât de oameni

- Distribuitorul „De verificat” în loc de „Gata” (un clic în plus pe TRANSAVIA).
- C1: dacă firma chiar nu are grosimi uzuale, butonul „Pune grosimea uzuală” pleacă.

## 15 noiembrie 2026 (noaptea) · Andrei (neagoeandrei23) · `main`

Calculatorul: Docker (Postgres pe 5433), fișierele clienților, cheie de model
nefolosită (rutele modelului blocate în probe). Trei agenți, fiecare pe ramura
lui (`fix-acasa`, `fix-preturi`, `fix-ux`), uniți pe `main`. Prezentarea la
firmă e pe 16 noiembrie dimineața.

### Făcut

| Commit | Ce |
|---|---|
| `f13722f` | Acasă pe patru carduri (De terminat la birou · Așteaptă răspunsul clientului · Șantiere în lucru · Marfă și materiale), cu cifra în titlu. Oferta fără răspuns apare din prima zi („Notează răspunsul”; din 14 zile, eticheta „Întreabă clientul”); comenzile trimise la fel (din 7 zile, „Sună furnizorul”) |
| `a223a3f` | Situația începută se ține în browser (`web/situatie-local.ts`), revine la reîncărcare și apare pe Acasă cu „Continuă situația” |
| `b789856` | „protecție cu tablă” fără material: aluminiu, „De verificat” (`tabla_fara_material`); 16,00 → 38,51 € |
| `8aa4776` | „gr 19” citit ca grosime; 10,57 → 14,82 € |
| `2eba961` | Fără grosime și fără țeavă de același ø: tabelul firmei, „De verificat” (`grosime_fara_conducta`, `grosime_conducta_vecina`); 82,89 → 101,84 € |
| `003c945` | Izolația fără material („Casetă armături DN80”): „Fără preț” cu „Alege izolația” (`lipseste_materialul`), nu „Lăsate afară” |
| `a196f71` | `strat_necitat`: propoziția începe cu „Prețul e fără tablă: X €.” |
| `c5cf420`, `de6cf13` | Cererea unei lucrări cu șantier (pornit sau închis) nu mai cere verificare: ✓ pe filă, rânduri ca text, fără „E bine” |
| `40e74ba` | Filele lucrării pe un rând pe telefon |
| `7981a45`, `a08e62e`, `0eff6f9` | O singură listă cu regulile deschise; o singură ieșire („Renunță”) din „Comandă ce lipsește”; costul în cuvinte cât n-a venit nimic |
| `b4df356`, `0f8d3a8` | Import pe telefon: mesajul de jos lat, descrierea pe tot rândul la „Lăsate afară”; refuzul coloanelor spus limpede, file de 44 px |

Teste noi pe rândurile din `exemple-AI/`: `tests/audit-15-noiembrie.test.ts`.

### Verificat

- `npm run typecheck` curat, **787 de teste**, nimic sărit (`IZOREP_DB=izorep_ux`),
  `npm run build:server` trece, după unirea celor trei ramuri.
- Pe cele 76 de rânduri de probă, doar regulile: 57 corecte, **0 greșite „Gata”**
  (erau 3), 6 greșite dar marcate, 2 lăsate afară (erau 13), 10 „Fără preț”.
- A/B pe toate fișierele clienților, ambele tipuri de ofertă: s-a mișcat un
  singur rând, Transavia inox r70 (caseta DN150: 222,11 „Gata” → 296,86 „De
  verificat”, 100 mm din tabel în loc de 50 de la Di140). Ofertele semnate, neatinse.
- În browser, varianta unită (`build:server`, 8824), 1440 px deschis și 390 px
  închis: Acasă, NISAL închisă, exemplul 1 încărcat ca industrial (17 Gata, 8
  De verificat, 7 Fără preț, 2 Lăsate afară); zero derulare, zero erori.
- De agenți, fiecare pe baza lui: oferta nouă apare imediat pe Acasă, acceptarea
  o mută la șantiere, situația începută revine după reîncărcare; „Lăsate afară”
  pe NISAL, coloanele cu „schimbă”, fișierul dublu.

### Neverificat

- În browser: oferta veche de 14 zile, „De ales” din poze după reîncărcare,
  salvarea situației restaurate, „Schimb” / „E bine” pe o lucrare fără șantier
  după schimbarea de la `c5cf420` (doar codul o spune).
- Din import, tot nevăzute: 1920 px, 600–1200 px, cele două citiri, mesajul
  plafonului, exemplul 2, spitalul (58 lăsate afară).
- Nimic cu modelul real. Deploy-ul pe Render și baza plătită.

### Pentru cine urmează

1. Potrivirea aproximativă pe material („alumniu”, „minrală”, „vată min.”,
   „tb. Al”, „cauciuc”): rândurile apar acum cu motiv, dar fără prețul întreg.
2. Mărunte din audit, încă „Gata” sau afară: „Țeavă DN100” la treceri socotită
   oțel (D06), „Pat de cabluri” (D08), „Treceri prin planșee” (D07), rândul fără UM.
3. Pe un rând `lipseste_materialul`, grosimea scrisă singură îl tarifează ca
   vată minerală fără ca omul s-o fi ales.
4. „Clientul a acceptat” pică cu „Scrie întâi obiectivul…” dacă oferta a fost
   descărcată cu obiectivul gol: de cerut la descărcare.
5. Pe fila Cerere, propoziția de sus nu pomenește rândurile lăsate afară;
   titlul lucrării ia cifra din numele fișierului („1 Fabrica Demo Abur”); în
   oferta generată, UM gol la „Di60, g40 - ML” (exemplul 1).
6. `.claude/import.md`, `pricing.md`, `ui.md` și `stare.md` nu au regulile de azi.
7. Restul din intrarea de mai jos (Faza 7, `stare.md` de tăiat).

### De hotărât de oameni

- Două grosimi pe același ø → cea mai mare rămâne „Gata” (`grosime_propusa`),
  fără dovadă; mutată la „De verificat” schimbă cifrele pe fișierele clienților.
- Textele noi: „Notează răspunsul”, „Întreabă clientul”, „Sună furnizorul”.
- Situația începută e doar în browserul celui care a scris-o.

## 15 noiembrie 2026 (seara) · Adrian (popescuadi15) · ramura `ux-lucrare`

Calculatorul: **fără Docker**, fișierele clienților cu numele noi, cheia de
model folosită (două importuri din linia de comandă, 24 de rânduri la model).
**Nicio linie de cod schimbată.** Comis tot ce e mai jos; necomis a rămas
doar `docs/intrebari-firma-2.md` (ca înainte).

### Făcut

| Unde | Ce |
|---|---|
| `docs/audit-2026-11-15.md` | auditul cerut înaintea prezentării la firmă (16 noiembrie): import, prețuri, materiale, situații, cu rândul și locul din cod |
| `docs/intrebari-firma-3.md` | întrebările pentru firmă, refăcute (48, 18 cu ★); înlocuiește `intrebari-firma-2.md` |
| `exemple-AI/` (copie și în `../attachments/exemple-AI/`) | două lucrări de probă cap-coadă, cu date inventate: cerere cu lipsuri intenționate, oferta corectă, comandă, aviz și factură PDF, două situații, `cheie-de-verificare.xlsx`; ghidul e `CITESTE-INTAI.md`, scripturile în `_generator/`. E în repo, deci testele îl pot folosi și în CI |

### Verificat

- `npx vitest run`: 687 trec, 81 sărite (fără bază), 0 pică, din 768.
- Cele două cereri de probă prin `importaFisier`, fără model și cu modelul
  real: 76 de rânduri, fiecare comparat cu prețul corect. Cu model: 62 corecte,
  **3 greșite „Gata”**, 6 greșite dar marcate, **2 rămase afară**.

### Neverificat

- Nimic în browser, pe server sau în bază. Citirea PDF-urilor de probă cu
  modelul (aviz, factură). Situațiile și închiderea pe exemplele noi.

### Pentru cine urmează

1. Cele trei „Gata” greșite din audit, fiecare cu test pe rândul din
   `exemple-AI/`: „protecție cu tablă” fără material (16,00 în loc de 38,51 €),
   „gr 19” necitit și înlocuit cu 9 mm, grosimea luată de la țeava cea mai
   apropiată ieșită „Gata”.
2. „Casetă armături DN80” și „Izolare conductă DN65” ca poziții „Fără preț”,
   nu „Lăsate afară”.
3. Parcurgerea în browser rămasă din import, pe cele două exemple (trei foi,
   coloane necunoscute, „Lăsate afară”), apoi avizul și factura PDF.
4. Restul, în ordinea din audit.

### De hotărât de oameni

- Cele trei din intrarea de mai jos („E bine”, unirea pe `main`, tăierea
  `stare.md`): recomandările sunt la sfârșitul auditului.
- Răspunsurile firmei la `intrebari-firma-3.md`, mai ales 1–3 (ce se face când
  lipsesc tabla, grosimea sau materialul) și 22 (saltele sau cochilii).

## 15 noiembrie 2026 (după-amiază) · Andrei (neagoeandrei23) · ramura `ux-lucrare`

Calculatorul: Docker (Postgres pe 5433), fișierele clienților în
`../attachments/clienti`, cheie de model nefolosită (modelul simulat). Lucrat
cu doi agenți, amândoi cu raport. Parcurgerea importului a fost **scurtată la
jumătate** (limita de folosire): ce a rămas nevăzut e scris mai jos.
`ux-faza6-rest` e unită aici; totul e pe GitHub, neunit pe `main`.

### Făcut

| Commit | Ce |
|---|---|
| `7b365da` | „Urmează”: ciornele netrimise cer „Trimite comenzile” (pagina lucrării, lista, Acasă); înainte dispăreau din „De făcut” |
| `f83c1f0` | „Situație nouă”: căutarea ia ø, Ø, φ, Di, D ca același lucru („ø60” găsește „Di60”) |
| `9c34f26` | Faza 6, punctul 6: două diametre pe același rând merg la om (`douaDiametre`, cod `doua_diametre`) |
| `33d2ce3` | Faza 6, punctul 7: „Încearcă din nou” doar pe rândurile necitite (`necitite`, `recitesteNecitite`) |
| `890b9f4` | Faza 6, punctul 9: motivul ca propoziție, cu „E bine” (fostul „Confirmă”) și „Schimb” (`web/import/explica.ts`) |

După: `d93b8ba`. Tabelul CET „clasa de izolație pe sistem” (`260522 PEN Proposal
for Insulation construction EN.xlsx`, din `~/Downloads/radoia-fisiere`) lipsea
din `../attachments/clienti`, deși `README`-ul îl trecea: pus la loc ca
`cerere-de-oferta-cet-constanta-specificatie-izolatie.xlsx`, iar
`tests/lasate-afara.test.ts` îl numără (0). **Pe alt calculator trebuie copiat
de mână**, altfel testul ăsta pică. Restul din `radoia-fisiere` era deja în
`attachments` sau e email (nu se păstrează).

Curățat: worktree-urile `faza6` și `f6b`, legătura `.claude/worktrees/attachments`,
bazele `izorep_f6` și `izorep_f6b`, ramurile `ux-import` (și pe GitHub) și
`ux-faza6-rest`.

### Verificat

- `npm run typecheck` curat, **768 de teste**, nimic sărit (`IZOREP_DB=izorep_ux`),
  `npm run build:server` trece; migrările 0018 și 0019 aplicate pe `izorep_ux`.
- **Fazele 4 și 5**, cu Playwright pe `build:server` + `izorep_ux` (8813):
  pagina lucrării pe 3 lucrări × 5 file × 390 / 1440 / 1920 px × ambele teme;
  o lucrare nouă din TRANSAVIA până la „Totul e executat.” (94.575,06 €);
  Materiale („Schimbă regulile”, „Refă lista”, „Comandă ce lipsește”),
  „Situație nouă” („Tot restul”, ștergerea ultimei), situație și comandă din
  poze (citirea simulată), fiecare buton din „De făcut”, „Nimic de făcut acum.”
  Zero derulare laterală, nicio țintă sub 40 px, zero erori.
- **Importul**, pe `izorep_f6b` (8817), 1440 și 390 px, tema deschisă: „Gata”
  ca text pe TRANSAVIA (0 câmpuri; 7.065 și 27.781 px; clic, Enter, editare la
  tastă 121,67 → 132,98 €, „⋯”); punctele 6, 7, 9 și cele două citiri pe un
  fișier de probă cu modelul simulat (lot căzut → „2 rânduri n-au fost citite.”
  → „Încearcă din nou” le citește, corecturile rămân, și după reîncărcare).
- **După unire**, pe `izorep_ux`: Acasă, Lucrări, Matari și TRANSAVIA (Cerere,
  Materiale) la 1440 și 390 px, zero derulare, zero erori; pe Matari „E bine”
  duce 53 / 12 la 54 / 11, iar „Anulează” le pune la loc.

### Neverificat

- **În browser, din import** (au doar teste): „Lăsate afară” pe NISAL (3) și
  spital (58) cu „E izolație”; coloanele citite cu „schimbă” și alegerea
  refuzată; cardul fișierului încărcat a doua oară; bara unică a celor două
  citiri; importul la 1920 px și pe tema închisă; cardurile între 390 și
  1240 px; tabelul pozelor din carnet după „Gata” ca text; clicul pe „Schimb”;
  mesajul plafonului zilnic.
- Închiderea efectivă a unui șantier după Faza 4 (făcută ultima dată pe 14
  noiembrie); cele două citiri pe spital sau Book15 (doar pe fișierul de probă).
- Nimic cu modelul real.

### Pentru cine urmează

1. `IZOREP_DB=izorep_ux npm run db:migrate`, `npm test`: 768. Contul de probă
   de pe `izorep_ux`: `proba-agent@izorep.invalid` (parola nu e în repo:
   `npm run om -- --reseteaza`).
2. Parcurge în browser ce e la „Neverificat” din import; repară ce pică.
3. Mărunțișurile de UX găsite și nereparate (lista în `.claude/stare.md`, 15
   noiembrie): cele două liste de materiale cu „Schimbă regulile” deschis, cele
   două ieșiri din „Comandă ce lipsește”, „De ales” pierdut la reîncărcare,
   filele lucrării pe două rânduri pe telefon, NISAL închisă cu „De verificat 7”.
4. Unirea pe `main` și deploy-ul; apoi Faza 7 (proba cu un om).
5. Tabelul CET pe sistem (mai sus) poate propune singur izolația pe fiecare
   foaie la „izolația pe foaie” (azi omul o alege de mână): WSS elastomer la
   rece, OMS / HWS / ECS / DHCT vată cu tablă, GSS / UMS / CAS fără izolație.
6. `.claude/stare.md` are 2.300 de linii și se încarcă la fiecare sesiune și la
   fiecare agent (~100.000 de tokeni cu restul): de tăiat la ultimele intrări
   sau de scos din `CLAUDE.md`, cu acordul lui Andrei.

### De hotărât de oameni

- Unirea pe `main` acum, sau după parcurgerea rămasă a importului.
- Faza 6, punctul 5 (alt model, `npm run compara` pe toate fișierele): cere
  cheia reală și bani pe model.
- „Confirmă” a devenit „E bine”: dacă nu sună bine, se întoarce dintr-un loc.

## 15 noiembrie 2026 · Andrei (neagoeandrei23) · ramura `ux-lucrare`

Calculatorul: Docker (Postgres pe 5433), fișierele clienților cu numele noi în
`../attachments/clienti`, cheie de model nefolosită (modelul simulat în probe).
Lucrat cu trei agenți; doi au fost **opriți la jumătate** (limita de folosire),
deci o parte e comisă fără raport de verificare. `ux-import` e unită aici.

### Făcut

| Commit | Ce |
|---|---|
| `0d09563` | Numărul ofertei se propune și când pagina se deschide direct pe fila Ofertă |
| `374af11` | `web/santier-din.ts`: șantierul din ofertă, fără DOM, cu id-urile ca parametru; îl folosesc ecranul și `scripts/demo.ts` |
| `13d5a9f` | „Urmează”: cu tot executat, „Închide șantierul” vine înaintea comenzii (și în listă, și pe Acasă) |
| `c515c99` | Demo-ul salvează cererile cu pozițiile de verificat (Matari spunea altceva în listă decât pe pagină) |
| `b7890b2`, `d9afc4a`, `2a9f322`, `b007032` | Faza 4: „Comandă ce lipsește” ca modul comun, fila Materiale pe patru coloane, „Situație nouă” scurtă, ✓ pe Materiale când totul e adus sau executat, Măsurători doar din lucrare |
| `ca5264c` | Faza 5, comisă de mine din lucrul necomis al agentului oprit (`web/stare-lucrare.ts`, `tablou.ts`, `lucrare.ts`) |
| `55351e0`, `ff9fbc2`, `e9cb781`, `3bdaaf2` | Faza 6, punctele 1, 2, 3, 8: coloanele citite din aplicație și ținute pe firmă (migrarea **0018**), corecturile omului în bază (**0019**), fila „Lăsate afară · N” cu „E izolație”, același fișier a doua oară |
| `b7cebcc` | Bugul „g48 → Confirmă → Fără preț”: confirmarea păstrează prețul văzut (15 poziții reale îl aveau) |
| `8fc69cb` | Rândurile „Gata” ca text, deschise cu un clic (decis de Andrei: „fă ce crezi mai bine”) |
| `3463abd` | Faza 6, punctul 4: rândurile citite de model, de două ori; diferite merg la om |

### Verificat

- După unire, pe acest calculator: `npm run typecheck` curat, **750 de teste**
  trec, nimic sărit (`IZOREP_DB=izorep_ux`), `npm run build:server` trece.
- Fazele 2–3 **pe server** (`izorep_ux`, 8813), cu Playwright: Cerere nouă →
  ofertă (94.575,06 €; cu 3 %: 91.737,81 €) → refuz → acceptare → șantier →
  situație cu „Tot restul” → închidere făcută; reîncărcarea pe fiecare filă; al
  doilea browser; 390 și 1440 px, ambele teme, zero derulare, zero erori.
  `npm run demo` după: RAD284 91.737,81 €; RAD118 163.979,93 €; RAD118.1
  12.692,04 €.
- Faza 6, punctele 1, 2, 3, 8 și bugul g48: în browser pe `izorep_f6` (8816),
  cu modelul simulat, 390 și 1440 px, ambele teme.

### Neverificat

- **Fazele 4 și 5 în browser**: agentul a fost oprit înainte de raport. Faza 4
  e comisă de el (nu știm ce a apucat să parcurgă); Faza 5 era la „Acasă,
  apăsat fiecare buton”. Trec doar testele.
- **„Gata” ca text și cele două citiri**: comise de agentul oprit, fără raport;
  cifrele TRANSAVIA (câmpuri, înălțime) nemăsurate.
- **Totul unit, împreună, în browser**: după unirea `ux-import` n-a fost
  parcurs nimic.
- Dublura de fișier pe linkul demo (fără server); cifrele după „Schimbă
  regulile”; costul la închidere cu material venit de-adevăratelea.
- `.claude/stare.md` și „Unde am rămas” din plan nu au Fazele 5–6 și unirea.

### Pentru cine urmează

1. `IZOREP_DB=izorep_ux npm run db:migrate` (0018, 0019), `npm test`: 750.
2. Parcurge în browser, pe `build:server` + `izorep_ux`, ce e la „Neverificat”:
   fila Materiale și „Situație nouă” (Faza 4), Acasă (Faza 5), Verificarea cu
   „Gata” ca text (clic, editare la tastă, carduri sub 1240 px, tabelul
   pozelor), „Lăsate afară”, coloanele, fișierul dublu. Repară ce pică.
3. Restul Fazei 6: punctul 6 (două diametre pe rând, gard în `valideaza.ts`),
   9 (motivul cu butonul care îl rezolvă), 7 („Încearcă din nou” doar pe
   rândurile necitite). Principiul: „Gata” doar 100 % sigur, altfel „De
   verificat”.
4. `.claude/stare.md`, `ui.md`, „Unde am rămas”; apoi Faza 7 (proba cu un om).
5. Curățenie: worktree-ul `.claude/worktrees/faza6`, legătura
   `.claude/worktrees/attachments`, baza `izorep_f6`, ramura `ux-import`.

### De hotărât de oameni

- ~~Baza de pe Render~~: Andrei a cumpărat planul de 6 $ pe lună (15
  noiembrie), nu mai expiră. De verificat la primul deploy că serverul e legat
  de ea și că are datele (seed, contul firmei).
- ~~Două citiri~~: rămân pornite implicit (Andrei, 15 noiembrie: nimeni nu
  face 1.500 de rânduri pe zi).
- Unirea pe `main` (deploy pe Render) abia după parcurgerea de la pasul 2.

## 14 noiembrie 2026 · popescuadi15 · ramura `ux-lucrare`

Calculatorul: **fără Docker**, deci fără Postgres. Fișierele clienților sunt în
`../attachments/clienti` cu numele vechi („Cerere oferta 2 Izolatii -
Abur.xlsx”), nu cu cele pe care le caută testele. Fără cheie de model folosită.

### Făcut

Planul e `docs/plan-ux.md`; starea lui, la „Unde am rămas”.

| Commit | Ce |
|---|---|
| `c337617` | Faza 3, o parte: fila Ofertă pe două carduri („Cui trimitem”, „Prețul”), „Descarcă oferta” albastru doar până există o ofertă; pe fila Cerere tipul ofertei e text cu „schimbă”, iar „Mergi la ofertă” apare o singură dată, în „Urmează”. Reparații după parcurgerea Fazei 2: titlul nu se mai repetă sub „← Toate lucrările” (fără text, „⋯” urcă pe același rând), linia de sub cele cinci file e continuă, verificarea ia din nou toată lățimea (`main:has(.ver-tabel:not([hidden] *))`). Scos codul rămas fără ecran: „Importuri recente”, „Ce vezi”, `deschideLaIntrare` / `iaDeDeschis`, resturi din `web/date/seed.ts`. Test nou în `tests/server.test.ts` pentru `antet` și `deVerificat` în lista cererilor |
| `dc56de6` | `.claude/stare.md`, `.claude/ui.md`, „Unde am rămas” din `docs/plan-ux.md` |

Faza 2 (commit-urile `3fe4c69`, `ba1d742`, `3e82999`, de dinainte) era scrisă,
dar nevăzută în browser. Acum e parcursă, vezi mai jos.

### Verificat

Cu Playwright, pe `npx vite --port 5183`, **fără server, cu datele în browser**:

- Cerere nouă → fișierul TRANSAVIA → pagina lucrării → ofertă descărcată
  (94.575,06 €; cu 3 %: 91.737,81 €) → A refuzat → A acceptat până la urmă →
  Da, pornește șantierul → Materiale → Schimbă regulile → situație cu „Tot
  restul”. Fila Închidere doar deschisă, șantierul n-a fost închis.
- Reîncărcarea pe fiecare filă ține fila; rutele vechi (`#/cereri`, `#/oferte`,
  `#/documente`, `#/santiere`, `#/import`, `#/import/poze`, `#/setari`) duc unde
  trebuie; meniul se pliază pe Cerere și Ofertă și revine pe celelalte.
- 390 și 1440 px, ambele teme: zero derulare laterală, nicio țintă sub 40 px,
  nicio eroare de pagină (în consolă doar 500 de la `/api`, fără server).
- `npm run typecheck` curat, `npm run build:server` trece.
- `npm test`: 602 trec, 73 sărite, **31 pică**. Cele 31 picau la fel înainte de
  schimbări: „File not found” pe fișierele clienților, din cauza numelor vechi
  de pe acest calculator. Pe un calculator cu numele noi ar trebui să treacă.

### Neverificat

- **Tot ce atinge serverul și baza** (fără Docker): salvarea cererii și a
  ofertei pe server, refuzul citit din `lucru->'antet'`, conturile, lista
  cererilor de pe server. Testul nou din `tests/server.test.ts` („lista
  cererilor aduce din lucrul omului antetul (cu refuzul) și câte poziții sunt
  de verificat”) compilează, dar aici s-a sărit.
- **`npm run demo`** n-a fost rulat după Faza 2. `scripts/demo.ts` își ține
  propria funcție de creare a șantierului, paralelă cu `santierDin` din
  `web/ecrane/import.ts`; n-a fost atins.
- Tabelul pozelor din carnet la 1920 px: regula nouă de lățime îl prinde prin
  aceeași clasă, dar n-a fost văzut cu o poză încărcată.

### Pentru cine urmează

Ai Docker, deci întâi ce n-am putut face aici. Înainte de orice cod nou:

1. `npm ci`, apoi `npm test` cu baza pornită. Așteptat: nimic picat, testul nou
   de server rulat. Dacă pică ceva care nu ține de numele fișierelor, repară
   întâi.
2. Fă baza de probă `izorep_ux` (comenzile sunt în `docs/plan-ux.md`, „Cum
   verifici pe alt calculator”; nu folosi baza implicită `izorep` și nici
   porturile 8787 / 5173) și rulează `npm run demo` pe ea. Dacă crapă, e
   primul lucru de reparat.
3. Parcurge în browser, pe `build:server`, fluxul de la „Verificat” de mai sus,
   de data asta **pe server**: Cerere nouă → ofertă → refuz → acceptare →
   șantier → situație → închidere, plus reîncărcarea pe fiecare filă și un al
   doilea browser care vede aceleași date. Uită-te mai ales la trecerea de la
   `#/lucrari/noua` la pagina lucrării după fișier (`cerereNoua` în
   `web/ecrane/lucrari.ts`, depinde de salvarea cererii înainte) și la lista
   Lucrări după refuz (stadiul vine din `antet.refuzat`).
4. Abia apoi planul: ce a rămas din Faza 3, apoi Fazele 4–7 din
   `docs/plan-ux.md`, în ordine. Fiecare fază: scrisă, verificată în browser,
   comisă, trecută aici.

Lucruri cunoscute, neatinse: bugul „g48 → Confirmă → Fără preț”; cu tot
executat și nimic comandat, lucrarea spune „12 materiale de comandat”, iar
Acasă spune că șantierul se poate închide (e ordinea decisă pentru „Urmează”,
vezi „Decizii luate” în plan).

### De hotărât de oameni

- **Rândurile „Gata” ca text** (Faza 3): planul cere machetă văzută întâi; nu
  se implementează fără ea.
- **`scripts/demo.ts`**: se unifică cu `santierDin` (mutată într-un modul fără
  DOM, cu id-ul ca parametru) sau rămâne cu copia lui?
- **Ordinea din „Urmează”**: închiderea înaintea lui „de comandat” când totul e
  executat?
- **Baza de pe Render**: cea gratuită expira pe 14 noiembrie 2026, fără backup.
