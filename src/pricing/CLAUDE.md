# Motorul de prețuri

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

- Lista de manoperă separată (structură diferită: tarif plat, nu matrice).
- Închiderile de goluri la foc: preț **aditiv** (gol după suprafață + bandă WRAP
  + colier PROMASTOP). Datele sunt în `data/price-lists/goluri_foc.json`, dar
  motorul nu le folosește încă.
- Coeficienți (înălțime, urgență, weekend) peste prețul de bază.
- Versionarea listelor de prețuri și snapshot-ul pe linia de deviz.
