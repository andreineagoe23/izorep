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

Verificat linie cu linie față de ofertele pe care firma le-a semnat deja:

```
  cererea TRANSAVIA importata  vs  Oferta 284 semnata
    preturi calculate             98 / 98 exacte, 0 diferite
    total (fara echipamentul
    la comanda)                   92.278,36 EUR  = semnat
  Oferta 27.04.2026 (NISAL)       48 de preturi exacte; cele diferite sunt marcate
  Oferta Matari (goluri la foc)   53 / 53, total 12.692,04 EUR = semnat
```

Ce nu se poate calcula sigur nu iese „gata”: merge la „De verificat” sau
„Fără preț”, cu motivul scris.

## Motorul de prețuri

Reprodus din listele de prețuri ale firmei și verificat pe oferte reale trimise
clienților, pe poziții facturate efectiv — inclusiv poziții compuse din trei
straturi:

```
DN80: elastomer 13mm + vată minerală 40mm + tablă
  11,20 (ø89) + 12,20 (ø114) + 20,95 (ø200) = 44,35 EUR/ml   ← exact ca în ofertă
```

Ce am găsit rulând motorul pe ofertele istorice: trei poziții tarifate
inconsecvent manual (ø90, ø160, și rotunjirea la stratul de jachetă). Sunt
documentate în `tests/pricing.test.ts`, blocul „abateri cunoscute".

## Demo în browser

<https://andreineagoe23.github.io/izorep/>

Rulează **integral în browser** — niciun fișier nu pleacă de pe calculatorul tău
și nu există backend.

Pe Pages, ecranul de import rulează doar stratul determinist. Cu serverul
(`npm start`, cheia în `.env`), după intrare pornește și stratul cu model, pentru
import și pentru pozele din carnet: rutele stau pe server, deci cheia API nu
ajunge niciodată în pagină.

Ecrane livrate: tablou de bord, lucrări, cereri și oferte, calcul deviz, import
Excel, clienți, liste de prețuri. Modulele nelivrate stau într-o listă pliată
sub meniu — harta întregului sistem rămâne vizibilă, fără să umple navigația
zilnică cu destinații goale.

**Datele sunt reale**, extrase din fișierele primite de la firmă: clienți
(NISAL, Spital Regina Maria, Transavia, Flower City), obiective, persoane de
contact, numere de ofertă și valorile însumate din ofertele efective. Codurile
fiscale și telefoanele sunt lăsate goale — nu inventăm identificatori pentru
firme reale.

Stratul cu model nu e în browser: ar cere o cheie API, iar o cheie pusă într-o
pagină statică e publică. Pentru pipeline-ul complet, rulează local
`npm run import`.

## Pornire locală

Node 22+ și Docker.

```bash
npm install
cp .env.example .env      # OPENAI_API_KEY, opțional
npm run db:up             # Postgres în Docker, port 5433
npm run db:migrate
npm run db:seed           # o singură dată
```

Apoi, zilnic:

```bash
npm start                 # bază + migrări + interfață
npm run dev               # doar interfața, fără Docker
```

→ <http://localhost:5173/izorep/>

**Interfața nu depinde de bază.** Motorul și parsarea Excel rulează în browser,
cu listele importate static — poți lucra pe UI fără Docker. Cu cheia în `.env`,
`npm run dev` pornește în plus ruta `/api/extrage` pentru liniile pe care
regulile nu le rezolvă și `/api/poza` pentru notițele de șantier; fără ele,
importul cade curat pe stratul determinist, iar pozele se transcriu de mână.

**Server HTTP nu există încă.** E construit stratul de bază — schemă, migrări,
izolare între tenanți, repository de prețuri. Interfața și baza nu comunică
deocamdată. Când apare serverul, intră în `docker-compose.yml` și `npm start`
îl ridică odată cu restul.

### Comenzi

| Comandă | Ce face |
|---|---|
| `npm start` | bază + migrări + interfață |
| `npm run dev` | doar interfața |
| `npm test` | 363 de teste (cele de bază cer Postgres; fără fișierele firmei, cele pe oferte reale verifică doar forma) |
| `npm run typecheck` | |
| `npm run build:web` | build static în `dist-web/` |
| `npm run db:up` / `db:down` | pornește / oprește Postgres |
| `npm run db:migrate` | aplică migrările |
| `npm run db:seed` | repopulează baza locală |
| `npm run db:reset` | șterge tot și reface |
| `npm run db:generate` | migrare nouă din `schema.ts` |
| `npm run db:psql` | consolă SQL |
| `npm run import -- <fisier.xlsx>` | import complet |
| `npm run import -- <fisier> --fara-model` | doar stratul determinist |
| `npm run golden -- <fisier.xlsx>` | înregistrează ieșirea modelului pe un fișier |
| `npm run golden -- --verifica` | re-cheamă modelul și caută deriva |
| `npm run compara-poze -- <model> … [--repetari N]` | compară modelele pe pozele de șantier (`../attachments/santier/`) |
| `npm run mapare -- <fisier.xlsx>` | înregistrează rolurile de coloană ale foilor |
| `npm run mapare -- --lista` | ce mapări sunt în cache |

Regenerarea listelor de prețuri și a seriilor de țevi din Excel (Python cu
`openpyxl` și `xlrd`):

```bash
python scripts/extract_price_lists.py ../attachments
python scripts/extract_conversii.py ../attachments
```

### De știut

- Portul bazei e **5433**, nu 5432.
- Aplicația se conectează cu `izorep_app`, nu cu proprietarul schemei:
  superuserii ocolesc row-level security, deci cu rolul greșit izolarea între
  tenanți n-ar funcționa **și testele ar trece fals**.
- Nu există `/backend` și `/frontend` separate fiindcă `src/pricing/` și
  `src/import/` sunt izomorfe — același cod în Node și în browser. Într-un
  split n-ar avea unde să stea fără duplicare, iar regulile de bani nu au voie
  să existe în două locuri. `tests/structura.test.ts` ține granița.

## Structură

| Cale | Ce e |
|---|---|
| `data/price-lists/` | listele rezidențiale, extrase din Excel-urile firmei |
| `data/price-lists/industrial/` | listele industriale — în motor când oferta e marcată industrială, și în bază |
| `data/referinte/` | seriile de diametre pe material, secțiuni de tubulatură |
| `src/pricing/` | motorul de prețuri — determinist, testat |
| `src/import/` | pipeline de import Excel de la clienți |
| `src/db/` | schemă, migrări, repository — **doar Node** |
| `scripts/` | ETL one-off Excel → JSON |
| `web/` | UI-ul (Vite, fără framework) |
| `tests/` | suita de referință pe oferte reale |
| `.claude/` | context de domeniu pe module |
| `docs/` | operare: infrastructură, backup, producție |

Detaliile de arhitectură și regulile de domeniu sunt în fișierele `CLAUDE.md`
din rădăcină și din fiecare modul.

## Lucrul în echipă

Echipa: **Andrei Neagoe**, **Adrian Popescu**.

- Branch per task, PR către `main`. `main` rămâne mereu verde.
- CI rulează la fiecare PR: typecheck + suita de teste a motorului de prețuri.
- Modificările în `data/price-lists/` sunt semnalate explicit în PR — schimbă
  prețurile din toate ofertele viitoare, deci vrem să fie o decizie conștientă.
- Fără trailere de atribuire în commit-uri (verificat în CI).

Împărțirea naturală a modulelor, ca să nu vă călcați pe cod:
`src/pricing/` (motor + liste) vs `src/import/` (parsare + extragere).

## Stadiu

Făcut: motor de prețuri (rezidențial și industrial), import Excel cu reguli +
model + memorie, ecranul de verificare în trei pași, registrul de ofertă `.xlsx`
în formatul firmei, reproducerea ofertelor semnate ca teste.

Urmează: vezi „Ce urmează” în `.claude/stare.md` — seria de cupru, modelul pe
cererile fără ofertă pereche, perechi noi de la firmă, apoi PDF, exportul în
șablonul clientului și modulele de contract, stoc și facturare.
