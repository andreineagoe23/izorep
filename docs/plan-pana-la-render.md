# Planul până avem acces la Render

> Pentru noi (Andrei, Adrian) și pentru agenții care lucrează pe direcții.
> Scris marți, 13 octombrie 2026.
>
> Completează `docs/plan-demo.md`, nu îl înlocuiește. Acolo e ce trebuie să
> fie gata duminică; aici e ordinea în care facem tot ce **nu** are nevoie de
> Render. Scopul: în ziua în care vine accesul, să rămână doar lista de la
> sfârșit, cam trei ore.

## Unde suntem

- Codul pentru Render e pe `main` (8ad1445): parola comună, două conexiuni la
  bază, `render.yaml`. 610 teste.
- Contul Render nu e încă. Orice „gata când” din `plan-demo.md` care spune
  „pe Render” se verifică întâi pe **proba ca pe Render** (mai jos), apoi încă
  o dată pe Render, cu aceeași comandă.
- Singurul risc cunoscut la primul deploy: proprietarul dat de Render n-are
  dreptul `CREATEROLE`, iar migrarea 0002 pică. Îl închidem acum (R1), ca
  primul deploy să meargă în ambele cazuri.

## Proba ca pe Render

E proba făcută pe 12 octombrie, transformată într-o comandă, ca s-o poată
rula oricine, după fiecare bucată de lucru:

- un Postgres 18 nou, separat de baza de dezvoltare;
- un proprietar fără drepturi depline, în două variante: **cu** și **fără**
  `CREATEROLE`;
- migrările și seed-ul, ca proprietar;
- serverul construit cu `build:server`, pornit cu `HOST=0.0.0.0` și
  `IZOREP_PAROLA`, pe portul 8799.

Tot ce scrie mai jos „pe probă” înseamnă asta. Pe Render se rulează aceleași
scripturi, doar cu adresa Render.

## Lucrările

Ordinea e ordinea în care le facem. Fiecare are un „gata când” care se poate
verifica fără Render.

### R0. Push și proba ca o comandă — făcut, 13 octombrie

- Push pe `main`. CI-ul de pe GitHub rulează suita cu baza obligatorie;
  trebuie să fie verde înainte de primul deploy (`autoDeployTrigger:
  checksPass`).
- `npm run ca-pe-render -- [--fara-createrole]`: pornește proba de mai sus și
  spune adresa și parola.

**Gata când:** CI verde pe `main`; o singură comandă dă serverul gata de
deschis, în ambele variante.

### R1. Primul deploy merge și fără `CREATEROLE` — făcut, 13 octombrie

Pe probă trec ambele variante. Proba fără `CREATEROLE` a găsit și un bug
vechi, reparat în 0013: trigger-ele scrise cu `NOT purjare_permisa(...)` nu
opreau proprietarul. Detalii în `plan-deploy.md`, pasul B.

Varianta de rezervă din `plan-deploy.md`, pasul B, făcută acum, nu la
deploy:

- **0002** creează `izorep_app` doar dacă proprietarul are voie. Altfel sare
  crearea rolului și drepturile date rolului, cu un mesaj în log. 0002 e deja
  aplicată pe bazele existente, deci schimbarea contează doar pe o bază nouă,
  adică pe Render.
- **`db:migrate`** nu mai pune parola rolului când rolul nu există.
- **Aplicația** intră cu `izorep_app` dacă rolul există. Altfel intră cu
  proprietarul și scrie asta în log. Nu e nimic de configurat.
- **Garda:** dacă utilizatorul cu care intră aplicația e superuser sau are
  `BYPASSRLS`, serverul refuză să pornească, oriunde ar asculta. Cu un astfel
  de utilizator, separarea firmelor e doar decor (vezi comentariul din 0002).
  Local aplicația intră oricum ca `izorep_app`, deci nu se schimbă nimic.

**Gata când:** pe proba fără `CREATEROLE`, migrările, seed-ul și suita trec,
inclusiv testul care pică dacă izolarea nu ține. Pe proba cu `CREATEROLE`
nimic nu se schimbă. Pornit cu un superuser pe `0.0.0.0`, serverul refuză.

### R2. Ecranele doar din bază — făcut, 13 octombrie

Verificat pe proba ca pe Render, cu baza goală după seed: cele 10 ecrane, la
1440 și 390 px, fără niciun nume de client. CI-ul pică dacă datele de exemplu
intră în pachetul pentru server.

Direcția 2 din `plan-demo.md`. În modul server, niciun ecran nu mai importă
`web/date/seed.ts`:

- **Tablou:** valoarea ofertată, lucrările de închis și cererile neofertate,
  din oferte, cereri și șantiere (`/api/date`, `/api/cereri`).
- **Clienți:** din beneficiarul de pe antetul ofertelor salvate, cu ofertele
  și șantierele fiecăruia.
- **Cereri și oferte (Documente):** doar ce e importat. Lista „Documentele
  firmei” dispare de pe server.
- **Lucrări:** doar șantierele din bază.

Pe o bază goală, ecranele spun ce e de făcut (de exemplu, „Importă o
cerere”), ca acum la Lucrări.

`seed.ts` rămâne doar pentru teste și pentru linkul de pe Pages, care se
oprește odată cu Render.

**Gata când:**
- pe proba, după seed (doar listele de prețuri), niciun ecran nu arată un
  client, o ofertă sau o sumă. Se verifică automat: o trecere prin toate
  ecranele caută TRANSAVIA, Matari, NISAL, 284 și 118 și nu le găsește;
- în pachetul construit cu `build:server` nu apare „TRANSAVIA”. Asta
  verifică și că datele firmei nu mai pleacă în pagină.

### R3. Starea de demo — miercuri

`npm run demo -- <adresa bazei>`, rulat de pe laptopul nostru, unde sunt
fișierele clienților. Conținutul e cel din `plan-demo.md`, direcția 2:

- Oferta 284 (TRANSAVIA), Matari și NISAL, salvate ca oferte;
- șantierul TRANSAVIA, cu:
  - o comandă trimisă și recepționată din avizul ISOLINE;
  - o situație cu consumul ei;
  - o comandă nevenită de peste 7 zile, care dă alerta de pe tablou;
- un șantier închis, cu costul față de ofertă;
- stocul de pornire în central și o bucată de tablă pusă deoparte în atelier;
- o pagină din carnet deja citită, pentru cazul în care modelul e lent la
  demo.

Cum lucrează:
- Scrie prin funcțiile din `src/server/repo.ts`, în contextul firmei, deci
  trece prin aceleași verificări ca serverul.
- Întâi golește datele firmei, fără listele de prețuri, deci e și resetarea.
  Golirea se face ca proprietar, cu `app.purjare` (0006), singura cale pe
  care trigger-ele lasă ștergerea în tabelele care nu se modifică.

**Gata când:**
- rulat de două ori pe probă, dă aceeași stare: aceleași rânduri, fără
  dubluri;
- tabloul arată cifrele care vor intra în firul demo-ului;
- importul TRANSAVIA dă 94.575,06 €.

### R4. Măsurătorile nu se pierd la reîncărcare — miercuri, în paralel

Paginile în lucru din Măsurători (poza și rândurile) se țin în browser, în
IndexedDB, ca istoricul importului (`web/istoric.ts`), până pleacă spre ofertă
sau situație. Doar pentru omul care lucrează, nu se împart cu alții.

**Gata când:** la jumătatea unei pagini, după reîncărcare, poza și rândurile
sunt acolo; după ce pagina pleacă, dispar din browser.

### R5. Conturile, gata dar oprite — joi

Direcția 3. Codul se ia din `d6d2ab0` (`src/server/intrare.ts`, `email.ts`,
`om.ts`) și din ce a scos `ad8c50c`:

- intrarea cu link pe email;
- un cont pe om;
- „cine a făcut” pe oferte, mișcări și situații (`creat_de` e deja în bază).

Se pornesc cu o variabilă, `IZOREP_CONTURI=1`; fără ea rămâne parola comună.
Emailul pleacă prin `SMTP_URL`. Până aflăm adresa firmei, local linkul se
scrie în log.

**Gata când:** testele de intrare trec. Local, cu variabila pornită, linkul din
log deschide aplicația, iar o ofertă salvată poartă numele omului. Fără
variabilă, totul e ca înainte.

### R6. CI fără avertismente — miercuri, în paralel

Acțiunile din `ci.yml` și `fara-atribuire.yml` trec pe versiunile care nu mai
rulează pe Node 20. `pages.yml` nu se atinge, pentru că se scoate la Render.

**Gata când:** CI-ul de pe `main` e verde și nu mai arată avertismentul.

### R7. Parcurgerea cap-coadă, pe probă — joi

Direcția 4, făcută din timp. Un script Playwright cu adresa ca parametru, ca
pe Render să rămână doar rularea lui:

- scenariul complet din `plan-demo.md`: cerere → ofertă → șantier → comandă →
  recepție → situații → consum → închidere → tablou;
- la 1440 și 390 px, în ambele teme;
- cu modelul adevărat pe o poză din carnet și pe un aviz.

Ce se strică se repară pe loc (direcția 3).

**Gata când:** scenariul trece o dată cap-coadă pe probă, pornind de la
starea de demo.

### R8. Ofertele semnate, din fișierul descărcat — vineri

Script care importă cererea, descarcă Excelul de pe server și îl compară linie
cu linie cu oferta semnată: Oferta 284, 118 și 118.1. Pornește de la
`scripts/golden.ts`; adresa e parametru.

**Gata când:** toate trei ies 1:1 pe probă: TRANSAVIA 94.575,06 €, Matari
12.692,04 €, NISAL ca înainte.

### R9. Hârtiile pentru luni — vineri

- **Firul demo-ului:** `demo-firma.md`, rescris pe starea de demo (R3), cu cei
  opt pași din `plan-demo.md`. Fiecare pas spune ce apeși, ce trebuie să
  apară și cifra de verificat.
- **Fișa de luni:** `docs/intrebari-luni.md`, cu varianta noastră scrisă lângă
  fiecare întrebare și loc pentru răspuns.
- **Foaia „ce nu merge”.**

**Gata când:** Adrian poate face demo-ul citind doar firul.

### R10. Curățarea testelor — vineri, dacă e timp

Ca în `plan-demo.md`: pe ramura ei, lista se vede înainte de ștergere, iar
reproducerea ofertelor semnate și „gata când”-urile fazelor nu se ating.
Prima care iese din plan dacă nu ajungem.

## Ziua în care vine accesul

Tot ce rămâne, în ordine. Cam trei ore, dacă R0–R8 sunt gata.

1. Contul Render, legat de GitHub. New → Blueprint → repo-ul `izorep`.
2. Valorile cerute: `IZOREP_PAROLA` și `OPENAI_API_KEY`. Cheia trebuie să aibă
   limită de cheltuieli pe contul OpenAI.
3. Primul deploy. În log scrie dacă aplicația intră cu `izorep_app` sau cu
   proprietarul (R1). Oricare variantă e bună.
4. `npm run db:seed`, din consola serviciului.
5. De pe laptop, cu adresa externă a bazei Render:
   - `tests/db.test.ts`, cu `IZOREP_CERE_BAZA=1`; trece și testul de izolare;
   - `npm run demo -- <adresa>` (R3).
6. Parcurgerea (R7) și ofertele semnate (R8), cu adresa Render. Aici se vede
   și dacă Render taie o poză din carnet.
7. Backup: o restaurare de ieri deschide oferta de ieri.
8. Pages oprit: se scoate `pages.yml` și se șterge site-ul. Gata când
   `andreineagoe23.github.io/izorep` dă 404.

## Calendarul

| Zi | Ce | Seara, gata când |
|---|---|---|
| **Marți, 13** | R0, R1; R2 pornit | CI verde; proba fără `CREATEROLE` trece |
| **Miercuri, 14** | R2, R3; în paralel R4, R6 | pe bază goală niciun ecran nu arată date din cod; starea de demo, rulată de două ori, dă același lucru |
| **Joi, 15** | R5, R7 | scenariul trece cap-coadă pe probă |
| **Vineri, 16** | R8, R9, R10 | ofertele semnate 1:1; firul și fișa gata |

Sâmbătă și duminică rămân ca în `plan-demo.md`: repetițiile și oprirea de
sâmbătă seara.

Dacă lucrăm cu agenți în paralel:
- fiecare are baza lui (`IZOREP_DB`) și portul lui, 8806–8809;
- niciunul nu adaugă o migrare, deci nu se ciocnesc la unire;
- R1 și R5 ating amândouă `src/server/porneste.ts` și `src/db/client.ts`, deci
  merg unul după altul, nu în paralel.

## Dacă accesul întârzie

- **Până joi seara:** nu se schimbă nimic. Tot de mai sus merge pe probă.
- **Vineri:** prima jumătate de zi e lista de mai sus; R9 se mută după-amiază.
- **Vineri seara, tot fără acces:** hotărâm atunci între Railway (o zi, din
  `plan-deploy.md`) și demo-ul de pe un laptop cu proba ca pe Render. Nu
  hotărâm acum.
