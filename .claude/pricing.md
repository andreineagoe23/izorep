# Motorul de prețuri

> Context pentru `src/pricing/`.

Cod determinist, fără AI, fără I/O în afară de citirea JSON-urilor din
`data/price-lists/`. Dacă ceva de aici devine nedeterminist, e un bug.

## Regula de tarifare

1. DN → diametru exterior real (`dn-table.ts`).
2. **Primul strat** — cel de pe țeavă. Regula e de **serie, nu de notație**:
   - pe seria de oțel → **cel mai apropiat rând**. Rândurile listei *sunt* seria
     standard (21,3→22 · 42,4→42 · 88,9→89 · 168,3→169). Se aplică lui
     `tip: "DN"` și lui `tip: "interior"` când valoarea cade pe seria de oțel
     (`peSeriaDeOtel`, toleranță `TOLERANTA_SERIE_OTEL = 0,8 mm`).
   - altfel → rotunjire **în sus**. Mufa de izolație trebuie să încapă peste
     țeavă; un rând sub diametrul real nu e opțiune fizică.
3. **Straturile următoare.** Geometricul pornește de la **rândul** primului
   strat și crește cu `2 × grosime`. Rândul se alege după **material**:
   - `tabla` / `tabla_inox` → **în sus**. Jacheta se croiește pe șantier la
     măsura imediat superioară.
   - orice altceva (izolație peste izolație) → cel mai apropiat rând.
     Manșoanele vin în diametre de alezaj fixe.
4. **Multiplicatorul de formă se aplică PE STRAT, nu pe sumă.** Un strat al
   cărui sistem n-are coeficient pentru forma cerută pe banda lui contribuie cu
   **geometria** (rândul și grosimea) dar **nu cu prețul** — și atunci nici nu i
   se caută celula. Dacă niciun strat nu rămâne, `PozitieNetarifata`, niciodată 0.
5. Grosimea unui strat exclus **rămâne obligatoriu una ofertată de sistemul
   lui**. Nu-i trebuie celula `rând|grosime` — aia e informație de tarifare, și
   tocmai am hotărât că nu-l tarifăm — dar grosimea decide geometria straturilor
   de deasupra, deci trebuie să fie reală.
6. Căutare pe coloana de grosime. Lipsa celulei → `PozitieNetarifata`.
7. Rotunjire la 2 zecimale **pe fiecare strat**, apoi însumare.

La egalitate între două rânduri se alege rândul **superior**. Nu e arbitrar:
vezi cazul DN80 compus, unde ø195 cade exact între 190 și 200.

**Peste ultimul rând** există o toleranță de `0,5 mm` (`TOLERANTA_CAPAT_LISTA`):
rândurile sunt seria rotunjită la milimetru întreg, deci atâta poate fi eroarea
de rotunjire. DN200 (ø219,1) cădea la 0,1 mm peste ultimul rând al elastomerului
(219) — adică exact DN200 — și ieșea „peste maximul listei". DN250 (ø273, la
54 mm peste) rămâne refuzat: 54 nu e eroare de rotunjire.

### De unde vin regulile 2–5

Oferta 284 (Transavia, abur, semnată), 30 de linii distincte vată + tablă.
Cele patru combinații de potrivire pe rând:

| primul strat / jachetă | exacte |
|---|---|
| în sus / în sus | 15 / 30 |
| în sus / cel mai apropiat (regula veche pe `interior`) | 12 / 30 |
| **cel mai apropiat / în sus** | **18 / 30** |
| cel mai apropiat / cel mai apropiat | 15 / 30 |

Zece linii sunt refuzate în toate patru, deci 18/20 dintre cele tarifabile.
Regula 4 le recuperează pe nouă din acele zece: coturile și teurile de vată sub
ø76, unde banda 18–60 are `cot_teu_reductie: null`, ies **exact** prețul tablei
la rândul geometric — 9 din 9, la bănuț. După toate regulile de mai sus,
**13 din 13** linii verificate direct față de ofertă ies exact.

Regula 4 a fost **dedusă din date** și **confirmată de firmă pe 11 septembrie
2026**. Poziția păstrează `note` cu proveniența, dar nu mai e oprită la
validare — vezi „Notele de pe poziție", mai jos.

### Rotunjirea neconfirmată (ø90, ø160)

Rotunjirea **în sus** a primului strat reproduce 12 din 13 poziții de plastic,
dar ofertele semnate au două excepții exact acolo unde un rând stă **la 1 mm
dedesubt**: ø90 tarifat pe rândul 89, și ø160 tarifat pe 159 ca SPIRO și pe 169
ca PEHD, **în aceeași ofertă**. Motorul nu schimbă rândul — regula rămâne în
sus — dar `randInferiorNeconfirmat` pune pe poziție o notă de verificat
(`PRAG_ROTUNJIRE_NECONFIRMATA = 1 mm`). Prețul iese, poziția merge la „De
validat". La 2 mm (PPR 20 peste rândul 18) nu există nicio ofertă care să fi
coborât, deci nu se marchează. Întrebarea 3.

Pe cele 10 fișiere de client asta atinge 7 linii, toate la ø90 sau ø160.

## Notele de pe poziție

`RezultatTarifare` și `RezultatGolFoc` au două liste:

- **`note`** — explică prețul. Informative: regula de cot/teu confirmată,
  grosimea propusă, lista din care vine un strat.
- **`noteDeVerificat`** — subsetul care **cere ochi**: preț luat din lista
  altui segment decât cel ales, rotunjire neconfirmată, grosime propusă (nu
  scrisă de client). `nucleu.ts` trimite poziția la validare pentru ele.

O poziție confirmată de om (`sursa: "om"`) **nu** mai e marcată pentru o notă de
verificat: confirmarea e chiar răspunsul la notă. Până pe 13 septembrie 2026
confirmarea n-avea efect pe ele — poziția rămânea marcată și nu ajungea
niciodată pe foaia `Ofertă`.

## Închiderile goluri la foc: altă regulă

`src/pricing/goluri-foc.ts`, separat de motorul de matrice. Prețul e **aditiv**,
nu matrice ø × grosime:

```
preț = golul (după SUPRAFAȚA lui) + bandă WRAP + colier PROMASTOP
```

- **Suprafața** = lățime × înălțime, din coloana „dimensiune gol" (`130/130`).
  Diametrul conductei nu intră în prețul golului.
- **Pragurile** sunt scrise „Goluri până la 0,05 mp": limita superioară e
  **inclusivă**. Se vede în ofertă la 1000/600 = 0,60 mp exact și 1500/600 =
  0,90 mp exact, amândouă tarifate pe pragul cu acea limită.
- Peste 1 mp se trece la tarif pe mp (134,43 €/mp).
- **Banda WRAP are două tabele**, după materialul conductei: la ø140 sunt
  12,19 € pe oțel și 65,67 € pe plastic, pentru că numărul de înfășurări
  diferă (1 la oțel, 2–6 la plastic). De aceea `material_conducta` e
  obligatoriu, nu implicit.
- Căutarea benzii și a colierului e pe **diametru exact**. Prețul urmează
  numărul de înfășurări, care sare în trepte: între două trepte nu există o
  valoare intermediară, ci o decizie umană.
- **Clasa EI e etichetă de grupare, nu variabilă de preț.** Aceeași conductă
  DN15 costă 23,05 € și la EI30, și la EI120, în aceeași ofertă.
- `tarifeaza` refuză `goluri_foc` și spune ce să folosești. Tipul o spune
  înainte: `SistemMatrice` exclude `goluri_foc`, deci lista lui nici nu poate
  fi cerută prin `lista()` — are accesorul ei, `listaGoluriFoc()`.

Verificat pe Oferta 118.1 / 27.04.2026: **53 de poziții, total 12.692,04 €**,
identic cu oferta semnată. Vezi `tests/goluri-foc.test.ts`.

## Cum verifici că nu ai stricat nimic

`tests/pricing.test.ts` reproduce 48 de poziții reale din Oferta 118 /
27.04.2026 (NISAL SRL, XXXLutz+Momax Balotești), inclusiv totalurile pe linie.
**Dacă un test de acolo pică, motorul nu mai reproduce ofertele istorice și nu
se poate emite cu el.** Nu ajusta testul ca să treacă — află de ce s-a schimbat
rezultatul.

Blocul „abateri cunoscute" e diferit: acolo motorul dă *intenționat* alt
rezultat decât oferta, pentru că oferta a fost tarifată inconsecvent manual.
Când firma confirmă regula corectă, cazul se mută în suita principală.

## Grosimea pe care clientul n-o scrie

`src/pricing/grosimi-uzuale.ts`. Sursa e **răspunsul firmei din 11 septembrie
2026**, nu o deducție din oferte — și distincția asta a costat o rescriere.

Prima variantă dedusese regula din perechea cerere → ofertă TRANSAVIA: pe 108
rânduri, fiecare diametru primea exact o grosime (40/50/60 mm), zero excepții,
iar propunerea reproducea 10 din 11 prețuri unitare din oferta semnată. Părea
o regulă. Era o **excepție**: firma a spus că acolo grosimile „au fost opționale
la cererea clientului". O regulă dedusă dintr-o singură ofertă poate fi exact
cazul particular.

Două tabele, după serviciu:

| ø | Vată minerală — apă caldă, agent termic, abur |
|---|---|
| ≤ 33,7 (DN15/20/25) | 20 mm |
| ≤ 42,4 (DN32) | 30 mm |
| ≤ 48,3 (DN40) | 40 mm |
| ≤ 60,3 (DN50) | 50 mm |
| ≤ 76,1 (DN65) | 60 mm |
| ≤ 88,9 (DN80) | 80 mm |
| peste (DN100+) | 100 mm, oricât de mare |

| ø | Elastomer — apă rece, agent de frig |
|---|---|
| ≤ 60 | 13 mm |
| ≤ 219 | 19 mm |
| ≤ 324 | 25 mm |

Firma a dat tabelul vatei pe DN; în cod e convertit în ø (coloana ISO), ca să
funcționeze și când clientul scrie direct diametrul exterior. Elastomerul a fost
dat direct în ø.

**9 mm și 32 mm nu se propun niciodată**, deși există în listă: 9 se folosește
„mai mult la pluviale", 32 „la sisteme de răcire, la ø-uri mai mari, depinde de
mediul înconjurător". Amândouă cer o informație care nu e pe rândul din Excel.
Peste ø324 elastomerul nu primește propunere deloc.

Alegerea se face după **sistemul liniei**, nu după un câmp separat de fluid:
materialul cerut de client spune deja în ce regim suntem. Când clientul nu scrie
nici materialul, alegerea rămâne a omului.

**Pragurile se compară pe seria de oțel, cu toleranță.** Clienții scriu seria
rotunjită (`Di34`, `Di49`, `Di89`), iar pragurile vatei sunt chiar valorile ISO
(33,7 · 48,3 · 88,9): comparate direct, Di34 primea 30 mm în loc de 20, Di49 50
în loc de 40, Di89 100 în loc de 80. Diametrul se aduce întâi pe seria de oțel
(`TOLERANTA_SERIE_OTEL`), apoi pragul se compară cu `TOLERANTA_CAPAT_LISTA`:
pragurile elastomerului sunt **rânduri** din listă, iar rândul 60 e DN50
(ø60,3), rândul 219 e DN200 (ø219,1) — fără toleranță, DN50 primea 19 mm în loc
de 13 și DN200 25 în loc de 19. Interpretarea asta (DN50 = „până la ø60") e a
noastră, aliniată cu toleranța motorului; de confirmat la prima ofertă reală pe
elastomer DN50.

**Se propune, nu se aplică.** Ecranul o arată ca valoare-fantomă în coloana de
grosime și o scrie doar la un clic. Firma a cerut explicit să rămână
modificabilă manual, „unde e personalizat pentru client" — exact cazul TRANSAVIA.

**Nici clicul nu confirmă.** „Completează N grosimi lipsă" pune grosimile în
`OptiuniNucleu.grosimiPropuse`, nu în `rezolvate`: poziția primește preț și o
notă de verificat, și rămâne „de validat" până o confirmă omul. Prima variantă
punea `sursa: "om"` pe toată foaia — o confirmare în masă pe care butonul nu o
anunța; pe cererea Abur, 24 de casete plecau direct în ofertă.

## Reguli din ofertele semnate (25 septembrie 2026)

Fiecare dedusă din Oferta 284 sau Oferta 27.04.2026, cu dovada lângă ea în cod
și în `stare.md`. Unde dovada e o singură valoare, prețul iese **marcat**.

- **Celula lipsă din listă** (`celulaDedusa`): p(rând, g) = p(sus, g) ×
  p(rând, g0) / p(sus, g0), doar din rândul **imediat** următor și doar când
  amândouă au o grosime g0 < g. Vata 22|40 → 7,90, exact ca în ofertă (25,68 și
  47,41). Motiv `celula_dedusa`, de validat.
- **Peste ultimul rând** (`tarifeazaPesteLista`): formula firmei,
  (φ + 2g) / 1000 × **3,14** × prețul pe mp al grosimii, strat cu strat.
  Exact pe DN250 / 19 mm; SPIRO ø250 / ø315 au fost semnate cu 0,13 € peste.
  Motiv `peste_lista`, de validat. Fără preț pe mp (PVC) rămâne refuzat.
- **Pe suprafață, fără diametru** (`tarifeazaPeMp`): suma prețurilor pe mp ale
  straturilor. Tubulatura rectangulară, vată 50 + tablă = 79,73, exact.
- **Echivalențe de grosime** (`ECHIVALENTE` în `nucleu.ts`): elastomer 20 mm →
  19 mm (3 din 3). Doar perechi dovedite; vata g48 rămâne netarifată.
- **Grosimea de la conductă** (`grosimiDeLaConducte`): o poziție fără grosime
  ia grosimea conductei de același diametru și material din aceeași listă,
  dacă acolo e una singură (casetele TRANSAVIA, 24 din 24). Bate grosimea
  uzuală: e citită din fișierul clientului, nu propusă de noi.
- **Totalul documentului**: suma valorilor exacte preț × cantitate, rotunjită o
  singură dată (`valoareLinie`, `totalOferta`) — ca Excel-ul firmei, care are
  143,808 în celulă. Rotunjit pe linie, Oferta 284 ieșea cu un ban peste.
- **Protecția la foc a tubulaturii** nu se tarifează din listele de izolație
  (`protectie_foc_tubulatura`): canal EI60 semnat 48 €/m², vata pe mp ar da
  22,22.

## Ce lipsește

- **Rafinăria și regula de segment.** Din 12 septembrie 2026 `tarifeaza`
  primește `destinatie` (implicit `rezidential`) și caută fiecare strat prin
  `listaDe(sistem, destinatie)` în `PE_DESTINATIE`. Segmentul **îl alege omul**
  la import (comutatorul „Tipul ofertei"); motorul nu-l deduce — întrebarea 12
  rămâne, ca regulă după care s-ar putea deduce din client sau obiectiv.
  Unde segmentul ales n-are listă pentru un material, se ia singura care există
  și poziția primește notă de verificat: PVC și închiderile la foc pe
  industrial (întrebarea 14), tabla de inox pe rezidențial (întrebarea 15).
  Rafinăria nu a venit și nu are buton. Nu se pot pune ca un coeficient peste
  rezidențial: raportul diferă pe sistem și pe grosime (vata ×1,25;
  elastomerul ×1,25 la 9/13/19 mm și ×1,20 la 25/32 mm).
- ~~**Tabla de inox**~~ — e acum sistem de sine stătător. Rămâne o asimetrie
  deliberată: inoxul e **singurul sistem fără listă rezidențială**. Pe o ofertă
  rezidențială prețul lui vine din lista industrială, cu notă de verificat.
  Care e grosimea implicită a jachetei rămâne întrebarea 15.
- **Seriile de diametre pe material.** `dn-table.ts` are un singur tabel, cel
  de oțel, și îl aplică tuturor. Datele pentru cupru, PP-R, PE-HD, PE-Xa, PVC
  și spiro sunt în `data/referinte/conversii-tevi.json` și în bază, dar motorul
  nu le citește: o poziție DN15 de cupru se caută pe rândul 22 în loc de 18.
- Lista de manoperă separată (structură diferită: tarif plat, nu matrice).
- Coeficienți (înălțime, urgență, weekend) peste prețul de bază.
- Versionarea listelor de prețuri și snapshot-ul pe linia de deviz.
