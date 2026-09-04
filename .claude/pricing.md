# Motorul de prețuri

> Context pentru `src/pricing/`.

Cod determinist, fără AI, fără I/O în afară de citirea JSON-urilor din
`data/price-lists/`. Dacă ceva de aici devine nedeterminist, e un bug.

## Regula de tarifare, în cinci pași

1. DN → diametru exterior real (`dn-table.ts`).
2. Primul strat: potrivire pe rândul din listă. Regula **diferă după notație**:
   - `tip: "DN"` → cel mai apropiat rând. Rândurile listei *sunt* seria standard
     de țeavă de oțel (21,3→22 · 42,4→42 · 88,9→89 · 168,3→169).
   - `tip: "exterior"` → rotunjire **în sus**. Mufa de izolație trebuie să încapă
     peste țeavă; un rând sub diametrul real nu e opțiune fizică.
3. Straturile următoare: cel mai apropiat rând față de diametrul geometric.
   Geometricul pornește de la **rândul** primului strat și crește cu `2 × grosime`.
4. Căutare pe coloana de grosime. Lipsa celulei → `PozitieNetarifata`.
5. Rotunjire la 2 zecimale **pe fiecare strat**, apoi însumare, apoi
   multiplicatorul de formă.

La egalitate între două rânduri se alege rândul **superior**. Nu e arbitrar:
vezi cazul DN80 compus, unde ø195 cade exact între 190 și 200.

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

## Ce lipsește

- **Destinația.** Listele firmei sunt de trei feluri — rezidențiale,
  industriale, rafinărie. Motorul vede **doar rezidențialele**: `lists.ts`
  importă static `data/price-lists/*.json`. Industrialele sunt extrase în
  `data/price-lists/industrial/` și încărcate în bază cu destinația lor, dar
  nimic din `src/pricing/` nu le atinge; rafinăria nu a venit. Nu se pot pune
  ca un coeficient peste rezidențial: raportul diferă pe sistem și pe grosime
  (vata ×1,25; elastomerul ×1,25 la 9/13/19 mm și ×1,20 la 25/32 mm). Ce
  lipsește ca să intre în motor e regula după care se alege destinația
  (întrebarea 12 din `stare.md`).
- **Tabla de inox** — sistem întreg care nu există în tipul `Sistem`. ETL-ul îl
  extrage (`data/price-lists/industrial/tabla_inox.json`, 192 de celule) și e
  în bază, dar motorul nu-l poate cere: `SistemMatrice` nu-l conține, deci
  `lista()` nu-l întoarce. Apare doar pe industrial. E jachetare, indexată ca
  tabla de aluminiu pe diametrul exterior al izolației: ø80–ø710, grosimi
  0,4 / 0,5 / 0,6 mm.
- **Seriile de diametre pe material.** `dn-table.ts` are un singur tabel, cel
  de oțel, și îl aplică tuturor. Datele pentru cupru, PP-R, PE-HD, PE-Xa, PVC
  și spiro sunt în `data/referinte/conversii-tevi.json` și în bază, dar motorul
  nu le citește: o poziție DN15 de cupru se caută pe rândul 22 în loc de 18.
- Lista de manoperă separată (structură diferită: tarif plat, nu matrice).
- Coeficienți (înălțime, urgență, weekend) peste prețul de bază.
- Versionarea listelor de prețuri și snapshot-ul pe linia de deviz.
