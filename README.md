# Izorep

ERP pentru o firmă de izolații termice. Demo: **motor de prețuri + import
automat al listelor de cantități trimise de clienți**.

## Problema

Clienții trimit liste de cantități în Excel, fiecare în alt format. Tarifarea se
face azi manual, linie cu linie — 300+ linii pe proiect, câteva ore de muncă,
cu greșeli care nu se văd. Listele de prețuri sunt matrici diametru × grosime,
cu reguli de compunere pe straturi și multiplicatori pentru fitinguri.

## Ce face demo-ul

```
Excel de la client  →  parsare  →  extragere parametri  →  tarifare  →  raport
                       (fizică)     (regex + LLM)          (determinist)
```

Pe lista de cantități reală a unui spital (258 rânduri):

```
  pozitii de izolatie      191
    rezolvate determinist  105  (55.0%)
    rezolvate cu modelul    86  (45.0%)
  TARIFATE automat         121  (63.4%)
  de validat de om          21
  netarifate                70
```

## Motorul de prețuri

Reprodus din listele de prețuri ale firmei și verificat pe oferte reale trimise
clienților. **48 de teste, toate pe poziții facturate efectiv** — inclusiv
poziții compuse din trei straturi:

```
DN80: elastomer 13mm + vată minerală 40mm + tablă
  11,20 (ø89) + 12,20 (ø114) + 20,95 (ø200) = 44,35 EUR/ml   ← exact ca în ofertă
```

Ce am găsit rulând motorul pe ofertele istorice: trei poziții tarifate
inconsecvent manual (ø90, ø160, și rotunjirea la stratul de jachetă). Sunt
documentate în `tests/pricing.test.ts`, blocul „abateri cunoscute".

## Instalare

```bash
npm install
cp .env.example .env     # completează OPENAI_API_KEY
```

## Utilizare

```bash
npm test                                       # suita de referință
npm run import -- ../attachments/Radoia.xlsx   # import complet
npm run import -- <fisier> --fara-model        # doar stratul determinist
```

Regenerarea listelor de prețuri din Excel (necesită Python cu `openpyxl` și `xlrd`):

```bash
python scripts/extract_price_lists.py ../attachments
```

## Structură

| Cale | Ce e |
|---|---|
| `data/price-lists/` | listele de prețuri, extrase din Excel-urile firmei |
| `src/pricing/` | motorul de prețuri — determinist, testat |
| `src/import/` | pipeline de import Excel de la clienți |
| `scripts/` | ETL one-off Excel → JSON |
| `tests/` | suita de referință pe oferte reale |

Detaliile de arhitectură și regulile de domeniu sunt în fișierele `CLAUDE.md`
din rădăcină și din fiecare modul.

## Stadiu

Făcut: motor de prețuri, extragere parametri, pipeline de import, teste.

Urmează: mapare de coloane per client (L1), ecran de validare cu învățare (L4),
generare ofertă PDF, export în formatul Excel al clientului, apoi modulele de
contract, stoc și facturare.
