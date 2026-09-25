# Backend

> Context pentru `src/db/`.

Postgres 18 + Drizzle. Local în Docker, aceeași versiune majoră ca în
producție — singura constrângere care contează la migrare.

## Cele două axe de separare

Nu sunt același lucru, iar confuzia dintre ele e cea mai scumpă greșeală
posibilă aici:

- **`tenant`** — firma-client căreia îi vinzi aplicația. Graniță **dură**: doi
  tenanți nu văd nimic unul de la celălalt, niciodată.
- **`firma`** — entitatea juridică emitentă din interiorul unui tenant. RADOIA
  ISOLIRUNG și R&F ISORAD SYSTEM sunt două firme ale **aceluiași** tenant:
  împart clienți, liste de prețuri, oameni. Graniță **moale**, doar pentru
  serii de documente și antet.

Azi există un singur tenant. Coloana e pe fiecare tabel de la prima migrare
fiindcă adăugată peste treizeci de tabele pline ar însemna backfill plus
vânătoare după fiecare interogare care a uitat-o.

## Izolarea e în bază, nu în cod

Row-level security pe fiecare tabel cu `tenant_id`. Aplicația **nu scrie**
`where tenant_id = ?` — un singur `where` uitat ar trimite prețurile unui
client la concurentul lui.

Contextul se pune per tranzacție, prin `caTenant(db, tenantId, ...)`:

```ts
const clienti = await caTenant(db, tenantId, (tx) => tx.select().from(client));
```

`set_config(..., true)` e **local tranzacției**. Într-un pool, fără al treilea
argument valoarea ar rămâne lipită de conexiune, iar cererea următoare — a
altui utilizator — ar moșteni tenantul precedent.

### Trei lucruri descoperite testând, nu citind

1. **Superuserii ocolesc RLS**, inclusiv cu `FORCE ROW LEVEL SECURITY`.
   Utilizatorul creat de imaginea Docker e superuser, deci toate testele de
   izolare treceau fals. Aplicația se conectează cu `izorep_app`
   (`NOBYPASSRLS`); migrările rulează cu proprietarul. Vezi migrarea 0002.
   **Aceeași capcană în producție:** dacă aplicația folosește rolul
   administrativ al furnizorului, RLS e decorativ.
2. **`ENABLE` singur nu ajunge** — proprietarul tabelei ocolește politicile.
   Trebuie `FORCE`. Migrarea 0001.
3. **`current_setting(..., true)` întoarce șirul gol, nu `NULL`**, după ce a
   fost setat o dată și tranzacția s-a încheiat. Fără `nullif(..., '')`,
   prima interogare de după crapă cu `invalid input syntax for type uuid: ""`.
   Migrarea 0003.

Verificarea corectă nu e „am scris politici", ci **„testul de izolare pică
atunci când ar trebui să pice"**. `tests/db.test.ts` rulează pe Postgres real;
un mock n-ar putea demonstra nimic din ce contează aici.

## Listele de prețuri: document JSONB, nu celule

`lista_preturi` ține metadatele ca coloane (cine, ce sistem, de când, ce
status) și conținutul ca `jsonb`. Deliberat:

- lista e **imutабilă după activare** — modificarea creează versiune nouă. Un
  document versionat e exact ce e.
- motorul încarcă întotdeauna lista **întreagă**; nicio interogare nu cere o
  singură celulă.
- forma JSON e deja contractul testat (`ListaPreturi`, `ListaGoluriFoc`), cu
  130 de teste în spate.

Imutabilitatea e impusă de **trigger**, nu de aplicație: o migrare de date sau
o conexiune de `psql` ocolesc aplicația, dar nu ocolesc un trigger. Index unic
parțial garantează o singură listă activă per sistem **și destinație** per
tenant.

### Destinația e în `where`, nu în `order by`

Din 4 septembrie 2026 baza ține două liste active pe același sistem:
rezidențială și industrială. Interogarea inițială filtra doar pe sistem și
status, cu `order by valabil_de_la desc limit 1` — deci ar fi ales-o pe cea
industrială, fiindcă e mai recentă. Aceleași fișiere de client, alte prețuri,
nimic care să se aprindă: vata industrială e ×1,25.

`catalogDinBaza(db, la, destinatie)` cere destinația explicit, implicit
`"rezidential"` — singura pe care o reproduc cele 130 de teste ale motorului.
Regresia are testul ei în `tests/db.test.ts` („listele industriale nu se
strecoară peste cele rezidențiale").

Pachetul industrial e **incomplet**: n-au venit PVC-ul și închiderile goluri la
foc. Un catalog industrial cerut întreg aruncă `ListaLipsa` și spune care
sistem lipsește — nu completează tăcut din rezidențial. Diferența dintre
„n-avem listă" și „avem altă listă" trebuie să rămână vizibilă.

A doua axă din `liste-preturi.md` — `contine`, material+manoperă față de doar
manoperă — are coloană de la prima migrare, dar **nu e în cheia unică**:
listele de manoperă au altă formă (tarif plat pe sistem și grosime, nu matrice
ø × grosime), deci s-ar putea să nu fie același tip de document.

## Referințele nu sunt per tenant

`serie_diametre` și `sectiune_rectangulara` (migrarea 0004) nu au `tenant_id`
și nu au politici de RLS. Sunt **norme** — EN 10255, EN 10220, EN 1057,
EN ISO 15874, EN 12201, EN ISO 15875, EN ISO 1452, EN 1329/1401 — aceleași
pentru oricine. Un `tenant_id` acolo ar sugera că două firme pot avea serii
diferite pentru aceeași țeavă.

Ce rezolvă: DN nu e un diametru măsurabil, iar conversia diferă după material.
DN15 e ø21,3 la oțel, ø18 la cupru, ø20 la PP-R. `src/pricing/dn-table.ts`
aplică azi tabelul de oțel tuturor materialelor. Datele sunt în bază și în
`data/referinte/conversii-tevi.json`; motorul încă nu le folosește.

## Catalogul: două surse, aceeași formă

```
catalogDinFisiere()   src/pricing/lists.ts      teste, CLI, demo static
catalogDinBaza(db)    src/db/repo-preturi.ts    server, per tenant
```

Echivalența lor e verificată în `tests/db.test.ts`. Cât timp testul trece,
cele 130 de teste ale motorului se aplică automat și prețurilor din bază.
**Dacă pică, o migrare a stricat ceva și nicio ofertare de pe server nu mai e
de încredere.**

## Bani

Driverul `postgres` întoarce `numeric` ca **string**. Așa trebuie lăsat.
Momentul în care cineva face `Number(pret)` „ca să fie mai comod", principiul
5 din arhitectură — *bani niciodată în float* — e încălcat fără să se vadă.

## Comenzi

```bash
npm run db:up        # porneste Postgres local
npm run db:migrate   # aplica migrarile (ca proprietar)
npm run db:seed      # date reale ale firmei, in baza locala
npm run db:reset     # sterge tot si reface
npm run db:generate  # genereaza migrare din schema
npm run db:psql      # consola
```

Migrările sunt fișiere SQL commit-uite, citite de om înainte să ruleze.
`drizzle-kit push` nu se folosește în afara unui experiment local: într-o bază
cu date reale, o schimbare de schemă fără fișier de migrare e o schimbare pe
care nu o poți reproduce.

## Ce lipsește

- Server HTTP. Stratul de bază e independent de alegerea de framework.
- Autentificare, jurnal de audit, verificarea permisiunilor pe server.
- Restul tabelelor: cerere, deviz, ofertă, contract, lucrare, stoc, factură.
- Regula după care se alege destinația unei lucrări. Coloana există și e
  populată; în aplicație segmentul se alege manual la import, dar nu se
  deduce de nicăieri și nu se scrie încă pe o lucrare din bază (întrebarea 12).
- Motorul primește încă listele prin import static, nu ca argument. Pasul
  următor pentru ca serverul să tarifeze per tenant.
