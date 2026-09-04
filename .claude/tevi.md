# Țevi: conversii de diametru și tipuri

> Surse, amândouă în `../attachments/referinte/`:
> `Tabel_Conversie_Tevi.docx` (3 septembrie 2026) și
> `Conversie_ml_in_mp_tevi_si_tubulaturi.xlsx` (4 septembrie 2026).
> Context pentru `src/pricing/dn-table.ts` și pentru extragerea diametrului din
> `src/import/`.
>
> **Amândouă sunt transcrieri generate** (`python-docx`, respectiv `openpyxl`),
> nu fișiere scrise de firmă în Word sau Excel. Ce spun despre practica firmei
> se citește ca notiță transcrisă; ce conțin ca serii standard e verificabil
> independent, din norme.

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

**Pe straturile de deasupra, „în sus" e însă exact.** Oferta 284 (Transavia,
abur, 30 de linii distincte vată + tablă) despică cele patru combinații
posibile: primul strat pe rândul cel mai apropiat **și** jacheta rotunjită în
sus dă 27/30 potriviri exacte, față de 23/30 pentru regula de azi (în sus pe
ambele). Liniile care despart variantele sunt Di114 (geometric 214, între 210
și 220 — oferta ia 220) și Di273 (geometric 393 — oferta ia 400). Vezi
`stare.md`.

**Capcana de notație.** Aceeași ofertă scrie diametrele exterioare de oțel
rotunjite la întreg: `Di21, Di27, Di34, Di49, Di60, Di76, Di89, Di114, Di140,
Di169, Di273` — adică 21,3 · 26,9 · 33,7 · 48,3 · 60,3 · 76,1 · 88,9 · 114,3 ·
139,7 · 168,3. Notația spune „exterior", deci `randPentruTeava` rotunjește în
sus și ratează Di49 (ia 54 în loc de 48), Di169 (219 în loc de 168) și Di273.
Regula e legată azi de **notație**, dar ar trebui legată de **serie**: dacă
valoarea cade pe seria de oțel, se aplică „cel mai apropiat" indiferent cum a
fost scrisă.

## Suprafața: ml → mp

`Conversie_ml_in_mp_tevi_si_tubulaturi.xlsx` e un registru de calcul cu trei
foi — Țevi, Tubulatură circulară, Tubulatură rectangulară — plus o foaie de
instrucțiuni. Formulele:

```
țeavă / tub circular    m2/ml = π × (φ + 2 × izolație) / 1000
tubulatură rectangulară m2/ml = 2 × (A + B + 4 × izolație) / 1000
suprafață totală        m2    = m2/ml × lungime (ml)
```

**Rectangularul e nou** — până acum aveam doar „perimetru × lungime, cu
conversie, neimplementat". Formula e perimetrul desfășurat; nota din registru
spune explicit că e tabla necesară pe metru liniar, **fără falțuri și
adaosuri**, iar pentru manoperă se adaugă separat capetele și piesele speciale.
Pentru fitinguri și coturi, nota generală zice **+5–10% suprafață** — e o
regulă de suprafață, distinctă de multiplicatorii de preț din listele de
prețuri, care se aplică prețului pe ml.

**π e π, nu 3,14.** Celulele sunt calculate cu constanta întreagă: φ33,7 dă
0,105871672425976, adică `Math.PI × 33.7 / 1000` la ultima zecimală. Asta e
contra notiței din docx („3,14"). Registrul fiind o transcriere generată,
diferența poate fi a transcrierii, nu a firmei — dar pe ce avem scris, π
câștigă. Diferența e 0,05% pe suprafață.

### Seriile pe material — ce lipsea din cod

Registrul dă seria de diametre exterioare **per material**, nu doar pentru oțel:

| Material | Serie (DN → φ ext.) |
|---|---|
| Oțel negru / zincat | 6→10,2 · 8→13,5 · 10→17,2 · 15→21,3 · … · 150→**165,1** · 200→219,1 · … · 600→610 |
| Cupru (EN 1057) | 10→12 · 12→15 · 15→**18** · 20→**22** · 25→**28** · 32→**35** · 40→**42** · 50→**54** · 65→76,1 · 80→88,9 · 100→108 · 125→133 · 150→159 |
| PP-R | 16 · 20 · 25 · 32 · 40 · 50 · 63 · 75 · 90 · 110 · 125 · 160 |
| PE-HD / PE 100 | 20 … 630, cu 140, 180, 225, 280, 315, 355, 400, 450, 500 |
| PE-Xa | 16 · 17 · 20 · 25 · 32 · 40 · 50 · 63 |
| PVC-U presiune | 20 … 315 |
| PVC-U canalizare | 32 · 40 · 50 · 75 · 110 · 125 · 160 · 200 · 250 · 315 · 400 |
| Spiro (circular) | 80 … 1250, nominalul **este** diametrul exterior |

**Coloana de cupru confirmă ipoteza din întrebarea 3**: DN15→18, DN25→28,
DN32→35, DN50→54 — exact coloana Metric din docx. Codul aplică azi tabelul de
oțel tuturor materialelor, deci o poziție DN15 de cupru se tarifează pe rândul
22 în loc de 18.

**Conflict la DN150: 165,1 aici, 168,3 în docx și în `DN_TO_OD`.** Amândouă
sunt valori reale, din norme diferite — 165,1 e EN 10255 (țeavă filetabilă,
seria care se oprește la DN150), 168,3 e ISO 4200 / EN 10220. Registrul spune
în foaia de instrucțiuni „EN 10255", dar listează și DN200→219,1, care nu
există în EN 10255, deci amestecă cele două serii exact la granița lor.
**Pentru tarifare rămâne 168,3**: rândul din listele de prețuri e 168, iar
Oferta 284 îl folosește (Di169). Codul nu se atinge.

Diferențe mai mici, toate în favoarea codului: DN450 → 457 aici, 457,2 în docx;
DN600 → 610 aici, 609,6 în docx. Nou față de cod: **DN6 = 10,2**.

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
   aplică tuturor tabelul de oțel. **Lista de tablă de inox primită pe 4
   septembrie 2026 nu răspunde la asta**: e jachetare (protecție mecanică),
   indexată pe diametrul exterior al izolației, ø80–ø710 din 10 în 10, exact ca
   lista de aluminiu. Țeava de inox e altceva și rămâne fără conversie.
4. π: se folosește **3,14** (ca în notița firmei) sau `Math.PI`? Registrul de
   conversie ml → mp e calculat cu `Math.PI` — dar e o transcriere generată,
   deci contrazice notița fără să o închidă. De confirmat pe o ofertă reală
   tarifată pe suprafață.
5. **DN150: 165,1 sau 168,3?** Cele două documente ale firmei se contrazic
   (EN 10255 față de ISO 4200). Pentru tarifare contează 168,3 — rândul din
   listă e 168 — dar dacă suprafețele se calculează cu 165,1, un mp de la
   DN150 iese cu 2% mai mic.
