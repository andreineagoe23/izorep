# Stare curentă

> Unde am ajuns, ce s-a decis și ce urmează. Actualizează la fiecare etapă.
> Ultima actualizare: 2 septembrie 2026.

## Contextul proiectului

Client: **SC RADOIA ISOLIRUNG SRL** (+ R&F ISORAD SYSTEM SRL), firmă de izolații
termice pentru instalații — conducte și tubulatură în clădiri mari, hale,
rafinării. Echipa de dezvoltare: **Andrei Neagoe** și **Adrian Popescu**.

Problema de rezolvat: clienții trimit liste de cantități în Excel, fiecare în
alt format, iar tarifarea se face manual, linie cu linie — 300+ linii pe
proiect, câteva ore, cu greșeli invizibile.

Materialul sursă (17 fișiere Excel primite de la firmă) stă în `../attachments/`
și **nu e commit-uit** — conține prețurile reale ale firmei.

## Ce e construit

**Motorul de prețuri** (`src/pricing/`) — determinist, fără AI, izomorf
(rulează identic în Node și în browser). 48 de teste care reproduc poziții
reale facturate din Oferta 118 / 27.04.2026, inclusiv poziții compuse din trei
straturi și totalurile pe linie.

**Pipeline-ul de import** (`src/import/`) — L0 parsare fizică, L2a extragere
deterministă (~55% din linii), L2b completare cu OpenAI prin structured outputs
pe reziduu, L3 tarifare. Rulat pe lista reală a unui spital: 191 poziții
detectate, 63% tarifate automat.

**Aplicația** (`web/`) — 8 ecrane: tablou de bord, lucrări, clienți, cereri,
calcul deviz, oferte și contracte, liste de prețuri, import Excel. Datele sunt
reale, extrase din fișierele firmei.

**Infrastructură** — CI (typecheck + teste + semnalarea modificărilor de
prețuri), verificare care respinge trailerele de atribuire AI, deploy automat
pe GitHub Pages: <https://andreineagoe23.github.io/izorep/>

## Decizii luate

**Motorul nu extrapolează.** Peste ultimul rând din listă aruncă
`PozitieNetarifata`. Ofertele reale conțin ø250 și ø315 pentru elastomer, unde
lista se oprește la ø219 — acolo prețul a fost stabilit manual.

**RAG-ul a fost respins pentru citirea Excel-urilor.** Datele sunt deja
localizate în celule; problema e mapare, nu regăsire. Chunking-ul rupe rândul
de antet, iar embeddings-urile confundă DN80 cu DN100. Soluția e extragere cu
schemă închisă (5 câmpuri, domenii enumerate) plus memorie per client.
Detalii în `import.md`.

**Demo-ul de pe Pages rulează doar stratul determinist.** Stratul cu model ar
cere o cheie API, iar o cheie într-o pagină statică e publică.

**Nu inventăm identificatori pentru firme reale.** CUI-urile și telefoanele din
`web/date/seed.ts` sunt `null` și se afișează „—". Un CUI plauzibil dar greșit
costă mai mult într-un demo decât o casetă goală.

**Meniul arată tot sistemul**, cu modulele nelivrate marcate „urmează".

## Ce am descoperit din datele reale

**Regula de potrivire pe rând diferă după notația diametrului.** La DN de oțel
se caută rândul cel mai apropiat (rândurile listei *sunt* seria standard); la
diametru exterior (plastic, PEHD, SPIRO) se rotunjește în sus, pentru că mufa
de izolație trebuie să încapă peste țeavă. Regula asta singură repară 3 poziții
care ieșeau greșit.

**Diametrul geometric pornește de la rândul primului strat**, nu de la
diametrul real, și crește cu 2 × grosime. La egalitate între două rânduri se
alege rândul superior. Asta reproduce ambele poziții compuse din oferta 118.

**Trei abateri reale rămân**, documentate în blocul „abateri cunoscute" din
`tests/pricing.test.ts`: ø90 PEHD (0,55 €/ml diferență), ø160 tarifat diferit
ca țeavă PEHD față de tubulatură SPIRO în aceeași ofertă, și rotunjirea la
stratul de jachetă.

**Lista de manoperă are altă structură** decât matricea completă: tarif plat pe
sistem și grosime (2,20 / 2,30 / 3,00 €/ml), nu matrice ø × grosime. Nu e o
coloană a aceleiași linii, e o listă separată.

## Întrebări deschise către firmă

Astea blochează arhitectura, nu doar implementarea:

1. **Cine ține stocul oficial — aplicația sau Saga?** Determină tot modulul de
   stoc și cine răspunde pentru SAF-T.
2. Cine emite factura și cine o trimite în SPV?
3. La ø90 și ø160, care e regula corectă de rotunjire?
4. Există listă de prețuri pentru elastomer peste ø219?
5. Lista de manoperă e scrisă undeva sau se negociază de fiecare dată?
6. Cum se împart cele două firme (RADOIA ISOLIRUNG / R&F ISORAD SYSTEM)?

## Ce urmează

**L1 — maparea de coloane per client.** Rezolvă simultan două lucruri:
euristica de cantitate (azi ghicește coloana lângă unitatea de măsură) și
`Book15.xlsx`, unde din 412 rânduri ies doar 5 poziții, pentru că rândurile de
continuare `"Same - Ø125 mm"` își pierd descrierea părinte.

**L4 — ecranul de validare cu învățare.** Piesa care duce al doilea proiect de
la același client de la ~63% la 90%+: fiecare corecție umană se salvează ca
mapare text normalizat → articol. Măsurat pe fișierele reale, 349 de linii
ofertabile se reduc la 134 de șabloane distincte.

Apoi: generare ofertă PDF, export în șablonul Excel al clientului, și modulele
de contract, stoc și facturare.

## Comenzi

```bash
npm test                                       # 48 teste motor
npm run typecheck
npm run dev                                    # UI local
npm run import -- ../attachments/Radoia.xlsx   # pipeline complet
npm run import -- <fisier> --fara-model        # doar determinist
python scripts/extract_price_lists.py ../attachments   # regenerează prețurile
```
