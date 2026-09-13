# Listele de prețuri: axele, conversia, rotunjirea

> Sursă: regulile date de firmă pe 4 septembrie 2026, înainte de predarea
> listelor noi. Context pentru `src/pricing/lists.ts`, `engine.ts` și pentru
> ETL-ul din `scripts/extract_price_lists.py`.
>
> Tabelele de conversie stau în `tevi.md` și nu se repetă aici; documentul ăsta
> spune **ce trebuie să fie adevărat înainte** ca un preț să poată fi căutat, și
> **cum sunt organizate listele** care urmează să vină.

## Prețul depinde de trei lucruri

```
preț unitar = f(material, grosime, φ)
```

- **material** — sistemul: elastomer, vată minerală, tablă, PVC. Îl dă textul
  liniei, nu dimensiunea.
- **grosime** — în mm. Lipsește la PVC și, uneori, la tablă (unde există o
  singură grosime ofertată pe diametru, deci e implicită).
- **φ** — diametrul exterior real, în mm. **Singura formă în care se caută în
  listă.**

Ce **nu** intră în prețul unitar: cantitatea (înmulțește la final) și forma —
cot, teu, flanșă, manșetă — care aplică un multiplicator peste prețul pe metru
liniar, pe benzi de diametru.

## Nimic nu se caută în listă până nu e φ

Clienții scriu diametrul în trei notații, iar listele sunt indexate **doar pe
φ**. Conversia e obligatorie și se face înainte de orice căutare.

| Vine ca | Ce e | Conversie |
|---|---|---|
| **φ** | diametru exterior, în mm | niciuna |
| **DN** | diametru nominal | tabel, pe coloana ISO — vezi `tevi.md` |
| **țoli** (`2''`, `3/4"`) | diametru nominal, altă scriere | tabel, pe coloana Toli — vezi `tevi.md` |

Conversia **depinde de materialul țevii**, nu doar de cifră:

- **oțel negru și zincat** — coloana ISO. DN50 → φ60,3.
- **cupru / inox** — se dau în DN, dar au altă serie (ipoteză: coloana Metric,
  DN15 → φ18). Azi codul le trece prin tabelul de oțel, ceea ce e probabil
  greșit. Întrebarea 3 din `tevi.md`.
- **PPR, PEHD, PE-Xa, PVC** — vin direct în φ. Nu se convertesc.

### Starea codului

| Notație | În cod |
|---|---|
| φ | `tip: "exterior"` — merge |
| DN | `tip: "DN"` → `DN_TO_OD` — merge, DN8–DN400 |
| țoli | convertiți la DN **la extragere** (`TOLI_DN` din `dn-table.ts`), apoi `tip: "DN"` |

Țolii nu sunt o notație separată în motor: `1/2"` *este* DN15. Extragerea
deterministă îi citește când stau lângă prefixul lor și au ghilimea —
`Ø1/2"`, `Ø1 1/4"`, `Dn 2 1/2"` — ca `1/2` dintr-un `130/130` să nu devină DN15.
Lângă un DN scris (`Dn 50 (60,3x3,6 - 2'')`) câștigă DN-ul. Până pe 13
septembrie 2026 `Ø1/2"` se citea ca φ1 și ieșea pe primul rând al listei;
pe `Oferta 27.04.2026` cele șase poziții în țoli ies acum exact ca oferta
semnată.

Notația `"interior"` trece azi neschimbată prin conversie, adică e tratată ca
φ exterior. Pentru izolație contează exteriorul; un Di dat de client cere
adăugarea a `2 × grosimea peretelui țevii`, care nu e în linie. De confirmat.

## Rotunjirea: în sus, la rândul din listă

**Regula firmei:** dacă φ nu se regăsește în listă, se ia **rândul imediat
superior**. Niciodată cel inferior.

Exemplul dat, verificat pe lista reală de elastomer, ale cărei rânduri sunt
`15 · 18 · 22 · 28 · 35 · 42 · 48 · 54 · 60 · 64 · 76 · 89 · 114 · 125 · 133 · 140 · 159 · 169 · 219`:

```
φ20  →  rândurile vecine sunt 18 și 22  →  se ia 22
```

Motivul e fizic, nu comercial: mufa de izolație trebuie să încapă **peste**
țeavă. Un rând sub diametrul real nu e o opțiune care există în realitate.

Aceeași regulă se aplică și **straturilor următoare** la o poziție compusă:
diametrul geometric crește cu `2 × grosime` la fiecare strat, iar rândul se
caută pentru valoarea rezultată.

### Unde se lovește de ofertele semnate

Aplicată literal, peste tot, regula asta **schimbă prețul la cinci DN-uri
uzuale** față de ofertele pe care firma le-a semnat deja:

| DN | φ ISO | Rândul din ofertele reale | Rândul dat de „mereu în sus" |
|---|---|---|---|
| 32 | 42,4 | **42** | 48 |
| 40 | 48,3 | **48** | 54 |
| 50 | 60,3 | **60** | 64 |
| 65 | 76,1 | **76** | 89 |
| 100 | 114,3 | **114** | 125 |

Nu e o inconsecvență a firmei. Rândurile listei **sunt** seria ISO scrisă cu
numere rotunde: rândul `42` *înseamnă* țeava DN32, nu „42 mm exact". Când φ e
42,4, rândul 42 nu e o rotunjire în jos — e chiar țeava aia. Rotunjirea reală
apare abia când φ cade **între două țevi diferite**, ca în exemplul cu 20 între
18 și 22.

Restul DN-urilor nu fac diferență, pentru că acolo cele două reguli dau același
rând: DN15 (21,3 → 22), DN20 (26,9 → 28), DN25 (33,7 → 35 — chiar exemplul
firmei), DN80 (88,9 → 89), DN150 (168,3 → 169).

### Regula care le împacă

O singură regulă, fără ramificație după notație:

> Se ia primul rând **≥ φ**. Dacă însă există un rând care stă la cel mult
> **0,5 mm sub** φ, acela *este* țeava și el câștigă.

Pragul separă curat cele două situații, pe datele reale: abaterile „rândul e
chiar țeava asta" sunt toate ≤ 0,4 mm (42,4→42 · 48,3→48 · 60,3→60 · 76,1→76 ·
114,3→114), iar golurile adevărate dintre țevi sunt de ordinul milimetrilor
(20 e la 2,0 de rândul 18; 33,7 e la 5,7 de rândul 28).

**Nu e implementată.** Codul face azi altceva, cu același rezultat pe datele
istorice: `randPentruTeava` alege *rândul cel mai apropiat* când diametrul a
venit ca DN, și *în sus* când a venit ca φ. Diferența dintre cele două
formulări se vede doar la o țeavă de oțel dată direct în φ.

Înainte de a schimba ceva: cele **48 de poziții din oferta 118** reproduse în
`tests/pricing.test.ts` trebuie să treacă neatinse. Dacă pică, regula nouă nu
reproduce ofertele semnate și nu se poate emite cu ea.

## Peste ultimul rând din listă

Azi: `PozitieNetarifata` — motorul nu extrapolează, poziția se marchează pentru
om. Firma are însă o formulă pentru diametrele mai mari decât matricea, pe
suprafață (`mp/ml = (φ + 2 × grosime) / 1000 × π`, cu π = 3,14). E în `tevi.md`,
cu întrebarea dacă se automatizează sau rămâne decizie umană.

## Listele nu sunt una per sistem — sunt un cub

Structura de azi are **o listă per sistem**, `lista(sistem)`, patru fișiere în
`data/price-lists/`. Realitatea are trei axe:

```
sistem            × destinație        × conținut
elastomer           industrial          material + manoperă
vată minerală       rezidențial         doar manoperă
tablă               rafinărie
PVC
```

- **Destinația** — industrial, rezidențial, rafinărie. Aceeași țeavă, același
  material, alt preț: se schimbă cerințele, accesul, normele.
- **Conținutul** — lista dă *material + manoperă* sau *doar manoperă*.
  Fișierele de azi au deja câmpul `contine`, toate cu `"material + manopera"`,
  dar nimic nu îl citește: e metadată descriptivă, nu axă de căutare.

### Ce se schimbă

| Loc | Azi | Cu axele noi |
|---|---|---|
| `lists.ts` | `lista(sistem)` | `lista(sistem, destinatie, continut)` |
| `data/price-lists/` | 4 fișiere + goluri foc | până la 4 × 3 × 2 per sistem |
| `CerereTarifare` | sistem, φ, grosime, formă | plus destinație și conținut |
| baza de date | `lista_preturi` unică activă per sistem/tenant | indexul unic parțial se extinde pe toate trei |
| ecranul de import | — | destinația trebuie să vină de undeva: proiect, client, sau aleasă la import |

Atenție la o capcană de formă: lista de **manoperă** pe care o avem (2,20 /
2,30 / 3,00 €/ml) **nu e matrice φ × grosime**, ci tarif plat pe sistem și
grosime. Dacă „doar manoperă" arată așa peste tot, atunci pentru listele alea
φ-ul și toată rotunjirea de mai sus **nu se aplică deloc** — se caută doar pe
sistem și grosime. Asta ar face „conținut" nu o a treia dimensiune a aceleiași
matrice, ci **două forme diferite de listă**, fiecare cu motorul ei de căutare.
E prima verificare de făcut când vin fișierele.

## Ce a venit pe 4 septembrie 2026

Firma a trimis **rezidențialul și industrialul**. Rafinăria nu a venit.
Fișierele sunt în `../attachments/preturi/`, grupate pe destinație; inventarul
complet e în `../attachments/README.md`.

| Sistem | Rezidențial | Industrial | Rafinărie |
|---|---|---|---|
| Vată minerală | 106 celule | 105 celule | — |
| Elastomer | 88 | 87 | — |
| Tablă aluminiu | 63 | 63 | — |
| **Tablă inox** | nu există | **192** | — |
| PVC | 64 | **lipsă** | — |
| Închideri goluri la foc | praguri aditive | **lipsă** | — |

Răspunsurile la lista de mai jos, atât cât se pot citi din fișiere:

1. **Ce combinații există** — nu toate. Industrialul n-are PVC și n-are goluri
   la foc, dar are un sistem în plus, tabla de inox. „Doar manoperă" nu a venit
   pe niciuna dintre destinații.
2. **Forma** — identică: matrice φ × grosime, cu benzile de multiplicatori la
   subsol. Nu s-a schimbat nimic structural, deci ETL-ul rezidențial a mers pe
   industrial cu alți indici de rând, nu cu alt cod. O singură capcană: la
   tabla industrială coloana de 0,8 mm din primul bloc e **D**, nu C; citită cu
   indicii rezidențiali, tot blocul de 0,8 până la ø390 lipsea.
3. **Destinația schimbă și matricea, puțin.** Industrialul adaugă rândul ø108
   la vată și îi lipsește ø15 la elastomer. Elastomerul se oprește tot la
   **ø219** pe amândouă, deci întrebarea „există preț peste ø219?" rămâne.
4. **Multiplicatorii sunt aceiași** — subsolurile celor patru liste industriale
   sunt identice cu cele rezidențiale, inclusiv absența coeficientului de
   cot/teu pe banda 18–60 la vată.
5. **`per_mp` există peste tot**, plus unul nou: tabla industrială are și
   coloana de 0,6 mm (45,00 €/mp), pe care rezidențialul nu o are.
6. **Valabilitate** — nedeclarată în fișiere. În bază, industrialul e pus pe
   `2026-09-04` (data primirii), rezidențialul rămâne pe `2026-01-01`.
   **De confirmat cu firma.**
7. **Moneda** — EUR fără TVA peste tot.

**Industrialul nu e un coeficient peste rezidențial.** Vata e ×1,25 constant,
elastomerul ×1,25 la 9/13/19 mm dar **×1,20** la 25/32 mm, tabla variază pe
rând în jurul lui ×1,10–1,11. De aceea sunt documente separate, nu un câmp de
înmulțire.

### Unde stau

| | Rezidențial | Industrial |
|---|---|---|
| Fișiere | `data/price-lists/*.json` | `data/price-lists/industrial/*.json` |
| Motor | import static, `lists.ts`, implicit | import static, `lists.ts`, când oferta e marcată industrială la import |
| Bază | `lista_preturi`, destinație `rezidential` | idem, destinație `industrial` |

Din 12 septembrie 2026 motorul le vede pe amândouă prin `PE_DESTINATIE` /
`listaDe`, iar segmentul îl alege omul în ecranul de import. `catalogDinBaza`
cere destinația explicit, implicit rezidențial — vezi `backend.md`, „Destinația
e în `where`, nu în `order by`".

## Întrebări deschise

1. **„Mereu în sus" se aplică și țevilor de oțel date în DN?** Dacă da, cele
   cinci DN-uri din tabelul de mai sus se tarifează de acum altfel decât în
   ofertele semnate, iar suita de referință trebuie rescrisă cu acordul firmei.
   Dacă nu, regula cu pragul de 0,5 mm e cea corectă.
2. **De unde se știe destinația** unei cereri — din client, din proiect, sau se
   alege la import? Poate un singur fișier să conțină și poziții industriale, și
   rezidențiale?
3. **Care e destinația implicită**, când cererea nu spune?
4. **Se poate deduce materialul din „material + manoperă" minus „doar
   manoperă"?** Dacă da, o singură pereche de liste acoperă și cazul în care
   clientul dă materialul.
5. **Listele de manoperă din `../attachments/preturi/nefolosite/` sunt cele
   bune?** Fișierele lor sunt prefixate `NUUUU` — ceea ce pare a însemna „nu se
   folosesc". Pachetul din 4 septembrie nu a adus altele.
6. **Țolii vin vreodată singuri** pe linie, fără DN alături? De asta depinde
   dacă tabelul Toli e obligatoriu la extragere sau doar de siguranță.
7. **Ce e cu tabla de inox?** A venit doar pe industrial, fără corespondent
   rezidențial, deși `cerere-de-oferta-transavia-inox.xlsx` — 72 de rânduri de inox — e o
   lucrare pe care firma a ofertat-o deja. Se ofertează inox și pe rezidențial?
8. **PVC și goluri la foc pe industrial** — nu se ofertează acolo, sau se
   folosesc listele rezidențiale?
9. **De când sunt valabile listele industriale?** În bază sunt puse pe data
   primirii, 4 septembrie 2026, fiindcă fișierele nu spun.
