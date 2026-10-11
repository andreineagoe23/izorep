# Planul pentru ecranul de import: orice cerere, aceeași ofertă

> Pentru noi (Andrei, Adrian). Pornește de la ce a cerut Andrei pe 11 octombrie
> 2026: cererile clienților n-au un șablon și nu vor avea, dar oferta noastră
> poate avea unul, iar după fiecare import Excelul trebuie să arate la fel.
> Cifrele de mai jos sunt măsurate pe fișierele din `../attachments/clienti/`
> și pe codul de pe ramura `faza-4`.

> **Starea, 11 octombrie 2026 (seara):** pașii 0–3 sunt făcuți, pe ramura
> `import-sablon` (detalii în `.claude/stare.md`). Rămân pasul 4 („Cum am citit
> foaia”) și pasul 5 (curățenia). Abateri de la plan, fiecare cu motivul:
> coloana „Cod” apare doar când clientul are coduri (Matari n-are, 118.1 n-o
> are); numerotarea e doar pe pozițiile „Gata”, ca planul de șantier (118.1 a
> numerotat 1–53 exact pozițiile cu preț); pe ecran pozițiile sunt rânduri-card
> pe aceeași grilă, nu un tabel cu coloane fixe (încap la 390 px fără derulare);
> pozițiile adăugate de mână apar la capitolul „Alte lucrări”.

## Ideea, într-un paragraf

Nu putem schimba ce trimite clientul. Putem schimba ce vedem noi după import:
în loc să lucrăm pe foaia clientului, care arată de fiecare dată altfel,
lucrăm pe **oferta firmei**, care arată mereu la fel. Importul devine
traducerea oricărei cereri în același tabel. Ce vezi pe ecran e exact ce
descarci, iar fișierul clientului rămâne doar ca referință („de unde a venit
rândul ăsta?”).

```
  cererea clientului (orice formă)          oferta firmei (o singură formă)
  ┌──────────────────────────────┐          ┌──────────────────────────────────┐
  │ 12 coloane, 7 foi, zone,     │  import  │ Nr · Cod · Denumire · UM ·       │
  │ coduri, texte în germană,    │ ───────► │ Cantitate · Preț unitar · Valoare│
  │ prețuri de 5 lei de completat│          │ pe capitole, cu total și notă    │
  └──────────────────────────────┘          └──────────────────────────────────┘
        rămâne ca referință                   se vede, se verifică, se descarcă
```

## 1. Ce primim: 12 cereri, 12 forme

| Fișier | Foi (cu poziții) | Coloane | Antetul pe rândul | Rânduri cu text | Poziții | Ce are special |
|---|---|---|---|---|---|---|
| Book15 | 1 (1) | 12 | 1 | 412 | 16 | descriere de două ori (engleză, română), rânduri „Same - Ø125” |
| CET Constanța | 13 (0) | 19 | 7–11 | 1.385 | 0 → 20 | lista de țevi a instalatorului; izolația e în altă specificație |
| Flower City | 2 (2) | 18 | 5 | 24 | 9 | cantitate pe unitate × număr de unități; `#REF!` |
| Spital | 7 (3) | 5 | 6 | 258 | 157 | 7 foi cu același antet; descrieri pe mai multe rânduri |
| SRU Craiova | 1 (1) | 9 | 2 | 76 | 48 | trei coloane de cantitate; „idem DN20” |
| TRANSAVIA abur | 1 (1) | 5 | — | 99 | 99 | fără antet; cod „IZOLATII” pe fiecare rând |
| TRANSAVIA inox | 1 (1) | 16 | — | 74 | 72 | cantitățile pe 11 coloane de zone; tipul în text („- COT”) |
| Oferta 118 NISAL | 2 (2) | 8 | 14 / 2 | 86 | 58 | coduri de articol, texte în germană și română |
| Oferta 118.1 Matari | 1 (1) | 8 | 14 | 84 | 65 | 4 secțiuni (EI30, EI60…), coloana „dimensiune gol” |
| Oferta 284 | 1 (1) | 6 | 15 | 120 | 99 | e chiar oferta noastră, recitită |
| Anexa 2024 | 1 (0) | 6 | 15 | 21 | 0 | manoperă, tabele pe sistem |

Antetul e pe alt rând în fiecare fișier, sau lipsește. Pozițiile sunt pe o
foaie sau pe șapte. Cantitatea e o coloană, trei, sau unsprezece. Asta nu se
poate uniformiza la intrare; motorul de import o rezolvă deja (L0–L4 din
`.claude/import.md`). Ce nu e uniform azi e **ce vedem după**.

## 2. Ce trimite firma: ofertele semnate au un cadru comun

Cele patru oferte semnate din `attachments/clienti/` (284, 118, 118.1, anexa
2024) au același cadru:

- titlul „OFERTA LUCRARI IZOLATII TERMICE”, numărul și data, „In atentia”,
  „Beneficiar”, „Obiectiv”;
- un tabel cu: cod sau număr, denumire, UM, cantitate, preț unitar în euro,
  preț total;
- totalul fără TVA; la 284 și discountul și totalul general;
- nota: „Prețurile sunt exprimate în Euro și nu conțin TVA. Plata se face în
  Lei la cursul BNR din ziua facturării. Plata lucrărilor se face pe baza
  cantităților real executate și aprobate în situații de lucrări.”;
- localitatea, data și firma emitentă.

Ce variază între ele e tot ce vine de la client, și firma îl păstrează:

| Ce | Unde | Ce a făcut firma |
|---|---|---|
| Codul clientului | 118: „01.82.02.01A”; 284: „IZOLATII” | l-a copiat pe fiecare rând |
| Textul clientului | 118: germană + română | le-a copiat pe amândouă |
| Specificația izolației | 284: „Caseta izolatie armaturi cu flanse DN100 ~~din tabla aluminiu si vata minerala~~” | a rescris finalul, **cu roșu**: „vata minerala gr. 50 mm si protectie cu tabla de aluminiu” |
| Secțiunile | 118.1: „Treceri prin pereti rezistenti la foc EI30 / EI60 …”; anexa: un tabel pe sistem | le-a păstrat ca titluri de capitol |
| Coloane de lucrare | 118.1: „dimensiune gol”, „suprafata” | le-a păstrat, fiindcă prețul golului depinde de ele |

Concluzia: **șablonul există deja în ofertele firmei**. E cadrul de mai sus,
cu codul și textul clientului în el, cu specificația noastră adăugată (cu roșu,
ca în 284) și cu capitolele clientului. Nu inventăm un format nou.

## 3. Ce face ecranul azi și unde doare

Azi importul are trei pași: ① fișierul, ② verificarea, ③ oferta. La pasul 2,
vederea implicită e **foaia clientului 1:1** (aceleași coloane și numere de
rând), cu trei coloane ale noastre lipite la dreapta: „Am înțeles · preț” și
„Stare”. Pe telefon, carduri. La pasul 3, un formular (antetul, ajustarea,
discountul, materialele, șantierul) și „Descarcă oferta”, care scrie un Excel
în forma Ofertei 284, pe trei foi: Ofertă, De validat, Netarifate.

Ce nu merge, în ordinea importanței:

1. **Fiecare import arată altfel.** 12 fișiere, 12 tabele pe ecran. Omul
   reînvață de fiecare dată unde e cantitatea și unde e prețul nostru.
   Coloanele clientului ocupă locul: cele 11 zone de la TRANSAVIA inox, cele
   trei cantități de la SRU, prețurile de „5 lei” de completat de la CET. Ce
   contează pentru noi stă la coadă, în coloane înguste, iar foaia încape pe
   ecran doar cu procente calculate pe fiecare fișier (`grilaFoaie`).
2. **Ce vezi nu e ce descarci.** Pe ecran e tabelul clientului; în Excel e alt
   tabel, cu șase coloane, pe care omul îl vede abia după descărcare.
3. **Valoarea și decizia sunt în alt pas.** Totalul, ajustarea, discountul și
   „Creează șantierul” sunt la pasul 3, departe de poziții. Ca să vezi cât
   mută un „Confirmă” valoarea ofertei, schimbi pasul.
4. **Capitolele se pierd.** Spitalul are 7 foi, NISAL 2, Matari 4 secțiuni;
   oferta generată e o listă plată. Ofertele semnate au capitole.
5. **Specificația noastră nu apare în denumire.** Oferta generată copiază
   textul clientului (și adaugă grosimea când lipsea), dar nu spune ce
   ofertăm, cum face 284 cu roșu. Clientul care a scris „din tablă aluminiu și
   vată minerală” nu află din ofertă că primește vată de 50 mm.
6. **Lipsește nota firmei, iar ce e intern pleacă la client.** Oferta
   generată n-are nota cu euro, TVA și cursul BNR, dar are pe foaia clientului
   „Cum a fost calculată oferta”: fișierul sursă, sesiunea de import, modelul.
7. **Patru intrări, patru drumuri.** Excelul clientului, pozele din carnet
   (Măsurători → registru → import), lista de țevi (izolația pe foaie →
   registru → import) și „Calcul deviz” (o poziție de mână, fără ofertă).
   Toate trei duc la aceeași ofertă, dar prin fișiere intermediare pe care
   omul le vede („… - masuratori santier.xlsx”).
8. **În cod**, ecranul are 1.100 de linii, iar oferta, planul de șantier și
   necesarul se calculează fiecare separat din liniile importului. Un al
   treilea loc care hotărăște ordinea sau capitolele ar fi un al treilea loc
   care poate greși.

## 4. Ce propun

### 4.1. Șablonul ofertei

Un singur document, pentru orice cerere:

```
                  OFERTA LUCRARI IZOLATII TERMICE
                       Nr. RAD 285 / 11.10.2026
În atenția d-lui …
Beneficiar : …
Obiectiv : …

Nr. │ Cod client   │ Denumire                                         │ UM │ Cantitate │ P.U. € │ Valoare €
────┼──────────────┼──────────────────────────────────────────────────┼────┼───────────┼────────┼──────────
    │ CAPITOLUL 1 · Treceri prin pereți rezistenți la foc EI30                                    │
1   │              │ Teava OL/OLZN DN15 · gol 130/130                 │ buc│        6  │  23,05 │   138,30
…   │              │                                     Total capitolul 1                       │ 1.234,56
    │ CAPITOLUL 2 · Izolatii                                                                      │
14  │ IZOLATII     │ Caseta izolatie armaturi cu flanse DN100         │ buc│        1  │ 121,67 │   121,67
    │              │ vata minerala gr. 50 mm si protectie cu tabla de aluminiu (roșu)            │
…
                                       TOTAL LUCRARI IZOLATII TERMICE (fara TVA)        94.575,06
                                       DISCOUNT 3 %                                      2.837,25
                                       TOTAL GENERAL (FARA TVA)                         91.737,81
Nota: Prețurile sunt exprimate în Euro și nu conțin TVA. Plata se face în Lei la cursul BNR
din ziua facturării. Plata lucrărilor se face pe baza cantităților real executate și aprobate
în situații de lucrări.
Păltiniș, 11.10.2026                                                  RADOIA ISOLIRUNG SRL
```

Regulile șablonului, fiecare cu dovada:

| Regula | Dovada |
|---|---|
| Coloanele sunt mereu aceleași: Nr., Cod client, Denumire, UM, Cantitate, P.U., Valoare | cadrul comun al celor patru oferte semnate |
| O coloană în plus apare **după felul lucrării**, nu după client: „Dimensiune gol” și „Suprafață” doar când oferta are închideri de gol la foc | 118.1 Matari: prețul golului depinde de suprafață |
| Codul clientului rămâne pe rândul lui; fără cod, secțiunea; altfel gol | 118 și 284 (azi `codRand` și `norma` din `web/oferta.ts`) |
| Denumirea = textul clientului, apoi specificația noastră cu roșu: materialul, grosimea, protecția | 284, rândurile 16–124 |
| Capitolele = foile cu poziții și secțiunile clientului, în ordinea lui, cu total pe capitol. Antetul documentului („Obiectiv : …”) nu e capitol | 118.1 (secțiuni EI30 … EI180), anexa 2024 (un tabel pe sistem), spitalul (3 foi cu poziții). Azi, pe NISAL, secțiunea citită pentru 50 de poziții e chiar rândul „Obiectiv : XXXLutz…”, îmbinat ca un titlu: capitolul trebuie să sară peste antet (`antetDocument` îl recunoaște deja) |
| Cantitatea e totalul poziției; zonele (TRANSAVIA inox) nu sunt coloane în ofertă | 284: „TOTAL CANTITATE” |
| Totalul: suma valorilor exacte, rotunjită o dată; discountul ca valoare, apoi totalul general | `totalOferta`, 284 la ban |
| Nota și semnătura, ca în ofertele semnate | 118, 284 |
| Ce e intern (fișierul sursă, sesiunea, modelul, prețurile puse de mână, ce e „De verificat” și „Fără preț”) stă într-o foaie „Pentru noi”, nu pe foaia clientului | azi stă pe foaia „Ofertă” |

### 4.2. Ecranul: doi pași în loc de trei

```
  ① Fișierul   ──►   ② Oferta
```

Pasul 2 e **șablonul pe ecran**, în așezarea 70 / 30 pe care o folosim deja:

```
┌──────────────────────────────────────────────────────────┬──────────────────────────┐
│ cerere-de-oferta-transavia-abur.xlsx · Schimbă fișierul  │ Total ofertă             │
│                                                          │ 94.575,06 €              │
│ CAPITOLUL 1 · Izolatii                         99 poz.   │ Gata 99 · De verificat 0 │
│ ┌──┬───────────────────────────────┬───┬─────┬────┬────┐ │ · Fără preț 0            │
│ │1 │ Caseta izolatie armaturi …DN100│buc│   1 │121,67│ ✓ │ │ ─────────────────────── │
│ │  │ vată 50 mm + tablă aluminiu    │   │     │      │   │ │ Tip ofertă  [Rez.][Ind.]│
│ │2 │ …                              │   │     │      │   │ │ Ajustare prețuri  [ 0 %]│
│ └──┴───────────────────────────────┴───┴─────┴────┴────┘ │ Discount          [ 3 %]│
│                                                          │ Beneficiar, Obiectiv …   │
│ [+ Adaugă poziție]                                       │ [ Descarcă oferta ]      │
│                                                          │ [ Creează șantierul ]    │
│                                                          │ Materiale de comandat ▸  │
└──────────────────────────────────────────────────────────┴──────────────────────────┘
```

- **Tabelul e același pentru orice fișier.** Coloanele clientului nu mai sunt
  pe ecran. Denumirea are două rânduri: textul clientului (tăiat, cu „Tot
  textul”) și, dedesubt, ce am înțeles („vată 50 mm + tablă aluminiu ·
  DN100 = ø114,3”), pe care îl scriem și în Excel, cu roșu.
- **Starea e pe rând, cu acțiunea ei**, ca azi: Gata → nimic de făcut;
  De verificat → „Confirmă” sau „Modifică”; Fără preț → ce lipsește. Editorul
  de poziție rămâne cel de azi, deschis sub rând.
- **Filtrele sunt numerele din dreapta**: un clic pe „De verificat 3” arată
  doar cele trei. Confirmarea în masă rămâne doar sub filtru.
- **Panoul din dreapta ține tot ce era la pasul 3**: totalul (se schimbă la
  fiecare confirmare), tipul ofertei, ajustarea, discountul, antetul,
  „Descarcă oferta”, „Creează șantierul”, materialele. Pe telefon coboară sub
  tabel, cu totalul lipit sus.
- **Fișierul clientului e o referință, nu vederea principală.** Fiecare rând
  are „rândul 114 din foaia Izolatii”; clic → se deschide foaia clientului
  (grila de azi), cu rândul marcat. Corectura în celulă rămâne acolo.
- **Ce nu intră în ofertă nu dispare**: rândurile „De verificat” și „Fără
  preț” stau la locul lor în capitol, marcate, și nu intră în total până nu
  sunt rezolvate. Butonul „Descarcă oferta” spune câte rămân afară.

Pasul 1 rămâne: tipul ofertei și fișierul, cu importurile recente. Între ei
apare un ecran doar **când trebuie**: lista de țevi fără izolație (izolația pe
foaie, făcută pe 11 octombrie) și, mai târziu, coloanele unei foi citite greșit
(4.4).

### 4.3. Toate intrările duc în același ecran

| Intrarea | Azi | Propus |
|---|---|---|
| Excelul clientului | pasul 2, foaia clientului | Oferta |
| Pozele din carnet (Măsurători → „Trimite la ofertă”) | registru `.xlsx` vizibil, apoi import | Oferta, direct; registrul rămâne doar intern |
| Lista de țevi (izolația pe foaie) | registru, apoi import | Oferta, direct |
| O poziție de mână („Calcul deviz”) | ecran separat, fără ofertă | „Adaugă poziție” în Ofertă (același editor); „Calcul deviz” rămâne pentru un preț rapid |

### 4.4. Coloanele, când citirea greșește (mai târziu)

Azi, când maparea coloanelor e respinsă (TRANSAVIA inox, anexa 2024) sau
ambiguă (SRU: trei cantități), importul cade pe euristică și omul nu poate
spune „cantitatea e coloana H”. Propun, după pașii de mai sus, un mic ecran
„Cum am citit foaia”: pe primele rânduri, câte un meniu pe coloană (Denumire,
Cantitate, UM, Cod, Nu contează). Alegerea se salvează ca mapare pe amprenta
antetului, ca cele din `data/mapari/`, deci al doilea fișier cu același antet
nu mai întreabă. Nu e urgent: pe cele 12 fișiere cantitățile ies corect din
cod.

## 5. Ce se schimbă în cod

Un singur model pentru ofertă, pur, testat în Node, din care se fac ecranul,
Excelul, planul de șantier și necesarul:

```ts
// web/document-oferta.ts (nou)
interface PozitieOferta {
  nr: number;                 // numerotarea din ofertă (azi și din planul de șantier)
  capitol: string;            // foaia sau secțiunea clientului
  cod: string | null;         // codRand / norma
  textClient: string;         // denumirea, fără cod
  specificatie: string | null; // „vata minerala gr. 50 mm si protectie cu tabla de aluminiu”
  um: string; cantitate: number; pretUnitar: number | null; valoare: number;
  stare: "gata" | "de_verificat" | "fara_pret"; motive: CodMotiv[];
  sursa: { foaie: string; rand: number };  // pentru „rândul 114 din foaia …”
  linie: number;              // indexul liniei importului (editorul lucrează pe ea)
  gol?: { dimensiune: string; suprafata: number };
}
interface DocumentOferta {
  antet: AntetOferta;
  capitole: { titlu: string; pozitii: PozitieOferta[]; subtotal: number }[];
  total: number; adaosFoc: number; discount: number; totalGeneral: number;
  coloaneGol: boolean;        // apare coloana „Dimensiune gol”
}
documentOferta(linii: LinieProcesata[], antet, optiuni): DocumentOferta
```

- `registruOferta` scrie `DocumentOferta`, nu liniile. Foile „De validat” și
  „Netarifate” devin foaia „Pentru noi”.
- `planDinOferta` și `necesarDinLinii` primesc aceeași numerotare din
  document (azi o refac fiecare, „a n-a poziție din linii”).
- `specificatie` se scrie din `extras` și din straturile tarifate, cu
  vocabularul din `web/import/text.ts`; testul o compară cu textul roșu din 284.
- Ecranul de import pierde pasul 3 și grila ca vedere principală; grila
  (`web/import/grila.ts`) rămâne pentru panoul „Fișierul clientului”.
- Nu se schimbă: motorul de prețuri, extragerea, regulile „Gata / De verificat”,
  memoria de șabloane, sesiunea salvată în istoric și pe server (documentul se
  reface din ea la deschidere), ofertele salvate deja (`CerereOferta`).

## 6. Pașii, fiecare cu „gata când”

| Pas | Ce | Gata când | Mărime |
|---|---|---|---|
| 0 | `documentOferta` + teste pe ofertele semnate | TRANSAVIA: 99 de poziții, aceleași coduri, UM, cantități, P.U. și valori ca 284, total 94.575,06, cu discount 3 % 91.737,81; Matari: capitolele EI30 / EI60 / EI120 / EI180 (16, 12, 25, 12 poziții), 12.692,04 €; NISAL: două capitole (Termice+Sanitare, Ventilatie), codurile clientului; specificația de pe casetele 284 egală cu textul roșu | 2–3 zile |
| 1 | Excelul din document: capitole cu subtotal, specificația cu roșu, nota, semnătura, foaia „Pentru noi” | registrul recitit cu ExcelJS dă aceleași rânduri ca documentul; foaia clientului n-are nimic intern | 1–2 zile |
| 2 | Ecranul Oferta în locul pașilor 2 și 3; panoul din dreapta; „Fișierul clientului” ca panou | pe toate cele 12 fișiere ecranul are aceleași coloane; 390–1920 px, ambele teme, zero derulare laterală; TRANSAVIA de la fișier la Excel în 3 clicuri | 4–5 zile |
| 3 | Măsurătorile și izolația pe foaie direct în Ofertă; „Adaugă poziție” | carnetul Ecoterm ajunge în Ofertă fără fișier intermediar vizibil; o poziție adăugată de mână intră în total și în Excel | 2 zile |
| 4 | „Cum am citit foaia”: rolurile coloanelor, salvate pe amprentă | TRANSAVIA inox și anexa 2024 se pot citi cu coloanele alese de om; al doilea fișier cu același antet nu mai întreabă | 2–3 zile |
| 5 | Curățenie: codul pasului 3 și al grilei ca vedere principală | `import.ts` sub 700 de linii; testele de ecran pe marcaj | 1 zi |

Fiecare pas se poate opri și folosi: după pasul 1 Excelul e deja în șablon,
chiar dacă ecranul e cel vechi.

## 7. Ce poate merge prost

| Risc | Cum îl ținem |
|---|---|
| Omul pierde corectura direct în celula clientului | rămâne în panoul „Fișierul clientului”; editorul de poziție face restul |
| Un client vrea oferta în formatul lui (NISAL a primit coloanele lui) | codul și textul lui sunt în șablon; dacă cere strict fișierul lui, o ieșire în plus, mai târziu: „cererea completată”, cu prețurile noastre scrise în coloanele lui de preț (CET are deja „Price Unit”) |
| Capitolele clientului sunt prea multe sau goale | capitol fără poziții nu apare; o singură foaie fără secțiuni = fără titlu de capitol |
| Specificația cu roșu spune altceva decât textul clientului | exact asta face 284: roșul e ce ofertăm noi; omul îl vede pe ecran înainte de descărcare |
| Sesiunile vechi din istoric | documentul se reface din liniile salvate; nimic de migrat |

## 8. Decizii pe care le iau așa, dacă nu spui altfel

1. Șablonul e al firmei (cadrul ofertelor semnate), cu codul și textul
   clientului în el.
2. Pe ecran, oferta e vederea principală; fișierul clientului e referință.
3. Capitolele vin din foile și secțiunile clientului, în ordinea lui.
4. Excelul pentru client are doar pozițiile „Gata”; restul, în „Pentru noi”,
   iar butonul de descărcare spune câte rămân afară.
5. Doi pași în loc de trei; pasul 3 trece în panoul din dreapta.

## 9. Cum știm că e bine

- Aceleași coloane pe ecran pentru toate cele 12 fișiere (capturi Playwright,
  una lângă alta).
- TRANSAVIA: Excelul descărcat = Oferta 284, rând cu rând, inclusiv textul roșu
  de pe casete (test).
- Matari și NISAL: capitolele și codurile ca în ofertele semnate (test).
- De la fișier la Excel: 3 clicuri pe TRANSAVIA, fără schimbare de pas.
- Zero derulare laterală la 390, 768, 1024, 1440, 1920 px, în ambele teme.
