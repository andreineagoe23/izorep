# Țevi: conversii de diametru și tipuri

> Sursă: tabel + notițe primite de la firmă (`Tabel_conversie_tevi.docx`,
> 3 septembrie 2026). Context pentru `src/pricing/dn-table.ts` și pentru
> extragerea diametrului din `src/import/`.

**DN nu este φ.** Clienții ofertează în DN, listele de prețuri sunt indexate pe
diametru exterior. Conversia e obligatorie și depinde de materialul țevii.

## Tabelul de conversie

Valabil **doar pentru țeavă zincată și țeavă neagră**. Coloanele bifate de firmă
ca fiind cele folosite la conversie: **Toli** și **ISO**.

| DN (mm) | Toli ✓ | DIN φ ext. (mm) | ISO (mm) ✓ | Metric (mm) |
|---|---|---|---|---|
| 10 | 1 3/8" | 14,0 | 17,2 | 12x1,0 |
| 15 | 1/2" | 20,0 | 21,3 | 18x1,5 |
| 20 | 3/4" | 25,0 | 26,9 | 23x1,5 |
| 25 | 1" | 30,0 | 33,7 | 28x1,5 |
| 32 | 1 1/4" | 38,0 | 42,4 | 35x1,5 |
| 40 | 1 1/2" | 44,5 | 48,3 | 43x1,5 |
| 50 | 2" | 57,0 | 60,3 | 54x2,0 |
| 65 | 2 1/2" | 76,1 | 76,1 | 69x2,0 |
| 80 | 3" | 88,9 | 88,9 | 84x2,0 |
| 100 | 4" | 108,0 | 114,3 | 104x2,0 |
| 125 | 5" | 133,0 | 139,7 | 129x2,0 |
| 150 | 6" | 159,0 | 168,3 | 154x2,0 |
| 200 | 8" | 216,0 | 219,1 | 204x2,0 |
| 250 | 10" | 267,0 | 273,0 | 254x2,0 |
| 300 | 12" | 318,0 | 323,9 | 304x2,0 |
| 350 | 14" | 368,0 | 355,6 | 354x2,0 |
| 400 | 16" | 419,0 | 406,4 | – |
| 450 | 18" | 459,0 | 457,2 | – |
| 500 | 20" | 521,0 | 508,0 | – |
| 600 | 24" | 622,0 | 609,6 | – |
| 700 | 28" | 720,0 | 711,2 | – |
| 800 | 32" | 820,0 | 812,8 | – |
| 900 | 36" | 920,0 | 914,4 | – |
| 1000 | 40" | 1020,0 | 1016,0 | – |

**Coloana ISO e cea din cod.** `DN_TO_OD` din `dn-table.ts` coincide cu ea pe
tot intervalul DN10–DN400, valoare cu valoare — tabelul primit confirmă
independent ce fusese dedus din listele de cantități ale clientului. Codul are
în plus DN8 = 13,5 (nu apare în tabel) și se oprește la DN400; rândurile
DN450–DN1000 sunt noi.

Valorile din tabel sunt **exacte**; rândurile listelor de prețuri sunt
rotunjite (33,7 → rândul 35). Vezi „Rotunjirea", mai jos.

## Ce țeavă unde

- **Neagră** — căldură, agent termic.
- **Zincată** — apă rece, agent de frig.
- **Cupru / inox** — se dau în DN, se convertesc în φ, dar **nu** după coloana
  ISO: seria lor e alta (ipoteză: coloana Metric — DN15 → ø18, DN25 → ø28,
  DN32 → ø35, DN50 → ø54, care e seria comercială de cupru).
- **PPR, PEHD, PE-Xa, PVC** — vin direct în φ, cu alte măsurători decât cele din
  tabel. Nu se convertesc; se rotunjesc **mereu în sus** la rândul din listă.

## Rotunjirea

Firma o descrie ca „se rotunjește mereu în sus până la valoarea din listă",
cu exemplul 33,7 → 35.

Pe DN de oțel regula nu ține pe tot intervalul: ofertele istorice au 42,4 → 42,
48,3 → 48, 60,3 → 60 și 114,3 → 114, adică **în jos**. Rândurile listei sunt
seria ISO rotunjită la cel mai apropiat întreg, deci regula care reproduce
ofertele e „rândul cel mai apropiat", nu „în sus". Codul face exact asta,
diferențiat pe notație (`randPentruTeava`): cel mai apropiat pentru `tip: "DN"`,
în sus pentru `tip: "exterior"` (plastic, tubulatură). Vezi `pricing.md`.

„În sus" e adevărat pentru φ dat direct; pentru DN e o aproximare a felului în
care oamenii citesc tabelul.

## Tubulaturi

- **Rectangulare** — mp sau ml, cu conversie (perimetru × lungime). Neimplementat.
- **Circulare** — sunt direct în lista de prețuri. Unde celula e goală, nu se
  ofertează.

## Peste ultimul rând din listă

Regula firmei pentru diametre mai mari decât matricea, pe suprafață:

```
mp/ml = (φ + 2 × grosime_material) / 1000 × π          (firma folosește 3,14)
preț  = mp × prețul pe mp corespunzător grosimii
```

Exemplu dat: elastomer φ324, grosime 9 mm → (324 + 18) / 1000 × 3,14 = 1,074 mp
per metru liniar.

Motorul **nu face asta azi**: peste ultimul rând aruncă `PozitieNetarifata`
(decizie din `stare.md` — „motorul nu extrapolează", pentru că în ofertele reale
ø250 și ø315 la elastomer fuseseră tarifate manual). Tabelele `per_mp` există
deja în `data/price-lists/*.json` pe grosime, deci regula e implementabilă.
De decis: rămâne poziția marcată pentru om, sau se calculează automat cu formula
de mai sus.

## Întrebări deschise

1. Coloana **DIN** (14,0 · 20,0 · 25,0 …) — ce țevi o folosesc? Tabelul spune
   că se convertește „în cele bifate" (Toli, ISO), deci DIN pare informativă.
2. **DN10 = 1 3/8"** e aproape sigur o scăpare de tastare pentru **3/8"**
   (17,2 mm = 3/8" în serie gaz). De confirmat înainte de a folosi coloana Toli
   la extragere.
3. Cupru/inox: coloana Metric e tabelul lor de conversie? Dacă da, o poziție
   DN15 de cupru trebuie tarifată pe rândul 18, nu pe 22 ca la oțel — azi codul
   aplică tuturor tabelul de oțel.
4. π: se folosește **3,14** (ca în notița firmei) sau `Math.PI`? Diferența e
   0,05% pe suprafață, dar schimbă ultima zecimală față de ofertele lor.
