# Sesiunea de cloud: bug-uri și UI/UX

> Pentru sesiunea Claude din cloud, care vede doar repo-ul de pe GitHub.
> Scris marți, 13 octombrie 2026, de pe laptopul lui Andrei.
>
> Citește întâi `CLAUDE.md` (încarcă `.claude/*.md`), apoi `docs/plan-demo.md`
> și `docs/plan-pana-la-render.md`, pentru unde suntem: R0–R3 sunt făcute, demo-ul
> la firmă e **luni, 19 octombrie**.

## Ce faci aici

Bug-uri și UI/UX, pe ecranele aplicației. **Nu** reguli de preț sau de import.

De ce așa: în cloud lipsesc `../attachments/`, adică fișierele clienților,
ofertele semnate și evidența de cumpărări. Fără ele nu se poate verifica nicio
schimbare de tarifare sau de citire a cererilor. Testele care le folosesc se
sar vizibil (`cuClienti` în `tests/conditii.ts`), deci un CI verde nu dovedește
că Oferta 284 mai iese 94.575,06 €. Andrei le rulează local înainte de unire.

## Ce nu atingi

- `src/pricing/`, `src/import/`, `data/price-lists/`, `data/referinte/`, testele
  care reproduc ofertele semnate (`oferte-semnate`, `pricing`, `document-oferta`,
  `golden`, `fara-pret`, …). Dacă un bug de UI pare să vină de acolo, scrie-l
  la „Pentru Andrei” (mai jos), nu-l repara.
- **Așezarea ecranului de import.** Rămâne foaia clientului ca în Excel, cu cei
  trei pași. Un ecran de import nou a fost respins pe 11 octombrie. Reparațiile
  mici (aliniere, texte, o eroare) se pot face; o reproiectare, nu. Orice
  schimbare de așezare pe un ecran pe care îl folosește firma începe cu o
  machetă arătată lui Andrei.
- Conturile, rolurile, Saga, facturarea, rafinăria, aplicația pe telefon: nu
  intră până la demo.
- `render.yaml`, `scripts/ca-pe-render.sh`, `scripts/demo.ts`, migrările din
  `src/db/migrari/`: sunt verificate pe proba ca pe Render, local.

## Cum lucrezi

- **Pe o ramură** (de ex. `cloud-ui`), cu un PR spre `main`. **Nu unești în
  `main`**: Render va publica singur fiecare push pe `main`, iar sâmbătă, 17
  seara, `main` se îngheață. Unește Andrei, după ce rulează local testele cu
  fișierele clienților.
- Commit-uri cu subiect scurt, în română fără diacritice, ca restul
  istoricului. **Fără** `Co-Authored-By` sau alt trailer de atribuire: CI-ul
  (`fara-atribuire.yml`) le respinge.
- Nu întrebi firma nimic și nici pe Adrian. Ce se poate hotărî din cod și din
  documentele din `docs/` se hotărăște, cu motivul scris în commit sau în
  `.claude/stare.md`.
- La sfârșit actualizează `.claude/stare.md` (o secțiune datată, scurtă) și
  `.claude/ui.md`, dacă s-a schimbat ceva de ecran.

## Cum verifici fără datele firmei

1. `npm ci`, `npm run typecheck`, `npx vitest run`. Fără Postgres, testele de
   bază se sar; dacă poți, pornește un Postgres 18 (`docker compose up -d`, sau
   pachetul de sistem pe portul 5433, utilizator și parolă `izorep`), apoi
   `npm run db:migrate && npm run db:seed` și rulează cu `IZOREP_CERE_BAZA=1`.
2. **Ecranele, pe server** (dacă ai Postgres): `npm run build:server`, apoi
   `PORT=8799 npm run server`. Baza după seed e goală: datele le faci din
   ecrane. Pentru o cerere, scrie un `.xlsx` mic cu ExcelJS: antet `Nr. |
   Denumire | UM | Cantitate`, rânduri ca „Izolatie vata minerala 50 mm cu
   tabla aluminiu DN100 | ml | 20”. Starea de demo (`npm run demo`) nu
   merge fără fișierele clienților.
3. **Ecranele, fără server:** `npm run build:web`, apoi servește `dist-web` static
   sub `/izorep/` (de ex. copiat în `x/izorep/` și `python3 -m http.server`).
   Datele stau în browser, iar exemplele din `web/date/seed.ts` apar. **Atenție:**
   `vite preview` trimite `/api` la serverul local, dacă există unul.
4. Cu Playwright, pe fiecare ecran atins: **390 și 1440 px** (ideal și 768,
   1920), **ambele teme**:
   - zero derulare laterală (`scrollWidth > innerWidth`);
   - zero erori în consolă;
   - ținte de cel puțin 44 px.

## Cum vrea Andrei ecranele

- Simplu, pentru oameni de birou și de șantier, nu de IT. Cât mai puțini pași,
  cuvinte de zi cu zi, fără jargon („snapshot”, „segment”, „matrice”).
- **Fără derulare stânga–dreapta**, nicăieri.
- Carduri delimitate. Unde sunt controale, pe două coloane ~70 / 30: ce curge
  (taburi, liste) în stânga, controalele în dreapta.
- Controalele de pe aceeași coloană au **aceeași mărime** și se aliniază între
  carduri. Mărimile se măsoară în browser, nu se estimează.
- Un text scurt deasupra fiecărui control, care spune ce face.
- Butoanele pe un rând; când nu încape, cedează descrierea.
- Ecranele folosesc helperele din `web/ecrane/tip.ts` și clasele existente din
  `web/style.css`. Orice text din date trece prin `esc()`.
- Starea se citește din text, culoarea doar o întărește. Roșul înseamnă doar
  eroare.

## De lucru, în ordine

1. **R4, Măsurătorile nu se pierd la reîncărcare** (`docs/plan-pana-la-render.md`).
   - Paginile în lucru (poza și rândurile) se țin în IndexedDB, ca istoricul
     importului (`web/istoric.ts`), până pleacă spre ofertă, situație sau
     comandă. După aceea dispar din browser.
   - Ecranul e `web/ecrane/santier.ts`, marcajul în `web/santier-vizual.ts`.
   - Plus: o pagină din carnet „deja citită” pentru demo, ca rezervă dacă
     modelul e lent. Rândurile sunt în `tests/fixtures-santier-ecoterm.json`;
     propune cum se încarcă (de ex. un buton doar cât lista e goală) și
     scrie-o la „Pentru Andrei” înainte să o pui în ecran.
   - **Gata când:** la jumătatea unei pagini, după reîncărcare, poza și
     rândurile sunt acolo.
2. **R6, CI fără avertismentul de Node 20:** acțiunile din `ci.yml` și
   `fara-atribuire.yml` pe versiunile curente. `pages.yml` nu se atinge.
3. **Bug-uri văzute pe 13 octombrie, pe starea de demo:**
   - **Alertă pe șantier închis:** „Necesită atenția ta” arăta „Comanda la …
     pentru <șantier închis> … a venit doar în parte”. Pierderea nu mai
     alertează pe un șantier închis (`pierderiPestePrag` în
     `src/lucrari/rapoarte.ts`), dar comenzile da. Hotărăște: pe un șantier
     închis, comanda deschisă nu mai e alertă. Scrie testul.
   - **„Ultimele 7 zile pe șantiere”:** coloana „Material venit” arăta „—” pe
     TRANSAVIA, deși factura care înlocuiește avizul (storno + intrare cu preț)
     era în perioadă. Vezi dacă e corect (factura nu aduce material nou) sau
     bug. Dacă e corect, textul de sub titlu trebuie să o spună.
   - **Pagina șantierului din Lucrări e foarte lungă:** planul TRANSAVIA are 99
     de poziții sub situații. Propune (machetă în text) planul pliat sau
     paginat, fără să schimbi ce e deja sus.
4. **Trecerea prin ecrane, ca un om nou:** Tablou, Lucrări, Cereri și oferte,
   Calcul deviz, Măsurători, Depozit și stoc, Comenzi, Clienți, Liste de
   prețuri.
   - Pe fiecare: ce nu se înțelege, ce e aliniat greșit, ce derulează, ce
     eroare apare.
   - Repară ce e mic și clar.
   - Ce schimbă așezarea merge la „Pentru Andrei”, cu macheta.
   - Stările goale (baza goală după seed) contează: pe server, prima zi a
     firmei arată exact așa.

## Pentru Andrei

Lista de la sfârșit, în descrierea PR-ului:
- ce s-a reparat, cu ecranul și lățimea la care s-a verificat;
- ce ai propus și n-ai făcut (machetele);
- ce ai găsit în `src/pricing/` sau `src/import/` și n-ai atins;
- ce teste ar trebui rulate local, cu fișierele clienților.
