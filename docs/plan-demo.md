# Planul până la demo: luni, 19 octombrie 2026

> Pentru noi (Andrei, Adrian). Scris luni, 12 octombrie 2026.
>
> **Luni, 19:** demo la firmă, pe Render, de pe laptopul lui Adrian. În
> aceeași întâlnire, firma confirmă sau corectează ce am hotărât singuri și ne
> spune ce nu merge.
>
> **Până atunci:** terminăm tot ce se poate termina **fără să întrebăm firma
> nimic**. Ce depinde de un răspuns al lor nu se începe; se pune pe fișa de
> luni, cu varianta noastră deja scrisă, ca ei doar să confirme sau să
> corecteze.
>
> Deploy-ul are detaliile lui în `docs/plan-deploy.md`.

## Ce înseamnă „gata” duminică seara

1. **Pe Render**, cu parola comună, merge tot fluxul firmei, de la cerere la
   închiderea șantierului: cerere → ofertă → șantier → comandă → recepție →
   situații → consum → închidere → tablou.
2. **Pe server, nimic nu e scris în cod.** Ce se vede vine din bază.
3. **Aplicația pornește în starea de demo** și se pune la loc cu o comandă.
4. **Ofertele semnate ies 1:1:** TRANSAVIA 94.575,06 €, Matari 12.692,04 €,
   NISAL ca înainte. Sunt verificate pe Render, nu doar local.
5. **Conturile sunt gata, dar oprite.** Le pornim când firma începe să lucreze
   cu date reale; la demo rămâne parola comună.
6. **Linkul public de pe Pages e oprit.**
7. **Pentru luni sunt gata:** firul demo-ului, fișa de întrebări și foaia pe
   care notăm ce nu merge.

## Ce intră și ce nu

| Facem acum (fără firmă) | Rămâne pentru luni (le întrebăm) | Așteaptă hârtii de la ei |
|---|---|---|
| Deploy pe Render, securizat | Regulile hotărâte de noi din date (fișa de luni) | Situația de lucrări în formatul lor |
| Ecranele doar din bază | Consumul pe zone (S40): îl vor? | Oferta Ecoterm (ROB, „preț dublu”, „× 2”) |
| Starea de demo și resetarea ei | Ce adresă de email trimite linkurile | Comanda reală TRANSAVIA |
| Conturile (cod gata, oprite) | Pragul de 7 zile la comenzi | Lista Isoline, poze din timpul lucrării |
| Munca din Măsurători nu se mai pierde la reîncărcare | PVC pe industrial | Versiunea de Saga și o factură exportată |
| Verificarea cap-coadă pe Render | | |
| Curățarea testelor (fără să pierdem ofertele semnate) | | |
| Firul demo-ului, fișa de luni | | |

În afara listei, nu se face nimic nou până la demo: rafinărie, Saga,
facturare, roluri noi, aplicație pe telefon.

## Cele patru direcții

Patru bucăți de lucru, aproape independente; pot merge în paralel, câte un
agent pe fiecare (`agenti-paraleli`: baza și portul fiecăruia).

### 1. Deploy și securitate

Pașii A–D din `plan-deploy.md`, cu variantele recomandate acolo:

- `render.yaml`;
- conexiuni separate pentru migrări și pentru aplicație;
- parola rolului `izorep_app` din variabilă;
- parola comună pe site;
- baza Postgres 18 în Frankfurt, cu verificarea `CREATE ROLE`;
- seed-ul;
- Pages oprit;
- backup încercat o dată;
- cheia OpenAI cu limită de cheltuieli; `IZOREP_CONCURENTA=1`.

**Gata când:** `tests/db.test.ts` trece pe baza Render; Adrian intră cu parola
de pe laptopul lui; importul TRANSAVIA dă 94.575,06 €; o poză din carnet se
citește fără să fie tăiată de Render; o restaurare de ieri deschide oferta de
ieri; `andreineagoe23.github.io/izorep` dă 404.

### 2. Datele: doar din bază, plus starea de demo

- **Ecranele scrise în cod trec pe bază.**
  - Tabloul: valoarea ofertată, lucrările de închis, cererile neofertate, toate
    din ofertele și șantierele din bază.
  - Clienți: din ofertele salvate (beneficiarul de pe antet), cu ofertele și
    șantierele lor.
  - Cereri și oferte, Lucrări: fără listele din `web/date/seed.ts`.

  `seed.ts` rămâne doar pentru teste și pentru linkul demo, care dispare
  oricum. **Gata când:** pe o bază goală, niciun ecran nu arată ceva ce nu e în
  bază.
- **Starea de demo**, cu `npm run demo -- <baza>`, rulat din laptopul nostru,
  unde sunt fișierele clienților. Scrie prin aceleași funcții ca serverul.
  Întâi golește datele firmei (nu listele de prețuri), deci e și resetarea.
  Conținutul:
  - Oferta 284 (TRANSAVIA), Matari și NISAL, salvate ca oferte;
  - șantierul TRANSAVIA: comandă trimisă și recepționată din avizul ISOLINE,
    o situație cu consumul ei, o comandă nevenită de peste 7 zile (alertă pe
    tablou);
  - un șantier închis, cu costul față de ofertă;
  - stoc de pornire în central și o bucată de tablă pusă deoparte în atelier.

  **Gata când:** rulat de două ori pe Render, dă aceeași stare, iar tabloul
  arată ce scrie în firul demo-ului.

### 3. Aplicația, terminată acolo unde nu depinde de firmă

- **Conturile**, puse la loc din `d6d2ab0`:
  - intrarea cu link pe email;
  - un cont pe om;
  - „cine a făcut” pe oferte, mișcări și situații (`creat_de` există deja în
    bază).

  Se pornesc cu o variabilă: fără ea rămâne parola comună. Emailul pleacă prin
  `SMTP_URL`, care se completează după ce aflăm adresa firmei. **Gata când:**
  testele de intrare trec, iar cu variabila pornită, pe Render, un link primit
  pe email deschide aplicația.
- **Măsurătorile nu se pierd la reîncărcare.** Paginile în lucru (poza și
  rândurile) se țin în browser până pleacă, ca importul. **Gata când:** la
  jumătatea unei pagini, după reîncărcare, totul e acolo.
- **Asperitățile găsite la parcurgerea din direcția 4**, reparate pe loc.
- **CI:** acțiunile GitHub trecute pe versiunile fără avertisment (Node 20).

### 4. Verificarea, apoi pregătirea pentru luni

- **Parcurgerea cap-coadă pe Render**, cu Playwright: scenariul complet de
  mai jos, la 1440 și 390 px, în ambele teme, cu modelul adevărat pe o poză și
  pe un aviz. Ce se strică trece la direcția 3.
- **Ofertele semnate, verificate pe Render**, nu doar în teste: Oferta 284,
  118, 118.1, linie cu linie, din fișierul descărcat.
- **Curățarea testelor.** Comasăm ce se verifică de mai multe ori și scoatem
  ce a rămas din etape vechi. Nu se atinge nimic din ce ține reproducerea
  ofertelor semnate și „gata când”-urile fazelor. Lista se vede înainte de
  ștergere. Merge pe ramura ei și intră doar dacă e gata până sâmbătă.
- **Firul demo-ului** (`demo-firma.md`, rescris), cam 25 de minute. Fiecare
  pas spune ce apeși, ce trebuie să apară și cifra de verificat:
  1. tabloul: ce vede patronul dimineața;
  2. cererea TRANSAVIA → verificare → oferta, 94.575,06 €, Excelul descărcat;
  3. poze din carnet → rânduri citite → oferta din poze;
  4. șantierul din ofertă → necesarul → comanda la furnizor → recepția din
     poza avizului;
  5. atelierul și drumul materialului;
  6. situația din poze → consumul scris singur → pierderea pe șantier;
  7. inventarul cu motiv, stocul de pornire;
  8. închiderea șantierului → costul materialului față de ofertă → tabloul.
- **Fișa de luni** (`docs/intrebari-luni.md`), pentru confirmat sau corectat,
  cu varianta noastră scrisă lângă fiecare întrebare:
  - tabelul „Deciziile luate fără firmă” din `plan-implementare.md`;
  - regulile marcate „presupus”: 3 piese pe metru sub 3 țoli, o piesă peste
    ø273, 219–323 citit din „119–123”, elastomerul DN50 la 13 mm, celula
    dedusă 22|40, „Ø-ul scris bate DN-ul”;
  - ROB, „preț dublu”, „× 2”;
  - S40 (consumul pe zone), pragul de 7 zile, PVC pe industrial,
    valabilitatea listelor industriale, DN150 (165,1 sau 168,3);
  - adresa de email pentru conturi;
  - hârtiile care lipsesc.

  Fiecare întrebare are loc pentru răspuns. Scopul: o oră cu ei, nu trei.
- **Foaia „ce nu merge”**, completată în timpul demo-ului: ecran, ce s-a
  făcut, ce a ieșit, ce trebuia. Marți, 20, devine lista de lucru.

## Calendarul

| Zi | Dimineața | După-amiaza | Seara, gata când |
|---|---|---|---|
| **Luni, 12** | — | planurile în `main` | direcțiile pornite |
| **Marți, 13** | 1: codul pentru Render · 2: ecranele din bază | 1: baza și serverul pe Render · 3: conturile | Adrian intră pe Render; niciun ecran local nu mai arată date din cod |
| **Miercuri, 14** | 2: starea de demo · 3: conturile | 2: starea de demo pe Render · 3: Măsurătorile păstrate | starea de demo pe Render, resetabilă |
| **Joi, 15** | 4: parcurgerea pe Render | 3: reparațiile din parcurgere | scenariul trece o dată cap-coadă |
| **Vineri, 16** | 4: ofertele semnate pe Render, curățarea testelor | 4: firul demo-ului, fișa de luni | toate patru direcțiile închise |
| **Sâmbătă, 17** | repetiția 1 cu Adrian, pe laptopul lui | reparațiile din repetiție | **oprire: după asta nu mai intră nimic nou pe `main`** |
| **Duminică, 18** | repetiția 2, de la starea de demo, cronometrată | doar reparații care opresc demo-ul, fiecare cu parcurgerea refăcută | starea de demo pusă la loc |
| **Luni, 19** | **demo**, fișa de luni, foaia „ce nu merge” | — | — |

Ce rămâne în urmă joi seara se scoate din plan, nu se înghesuie: întâi
curățarea testelor, apoi Măsurătorile păstrate, apoi conturile. Deploy-ul,
datele din bază, starea de demo și parcurgerea nu se scot.

## Ce poate merge prost

| Risc | Ce facem |
|---|---|
| Render nu ne lasă să creăm rolul aplicației | Varianta de rezervă din `plan-deploy.md`, dovedită cu testul de izolare. Dacă nici asta: Railway, o zi în plus, din rezerva de joi |
| Modelul e lent sau ajunge la limita pe minut în demo | Importul merge și pe reguli, cu aceleași cifre la TRANSAVIA. În starea de demo e și o pagină din carnet deja citită |
| Parcurgerea de joi găsește mult | Ce nu se repară până vineri seara iese din firul demo-ului și intră pe foaia „ce nu merge”, scris de noi |
| Internetul la firmă | Hotspot de pe telefon; ecranele sunt verificate la 390 px |
| Un push de ultim moment strică demo-ul | Oprirea de sâmbătă seara. Render publică singur fiecare push pe `main` |

## Hotărâri pe care le iau așa, dacă nu spui altfel

1. Render, parola comună la demo, contul Render al nostru acum, Pages oprit
   când merge Render (`plan-deploy.md`).
2. Ecranele cu date scrise în cod: pe server le scoatem de tot, nu le
   etichetăm „exemplu”.
3. În starea de demo: TRANSAVIA, Matari și NISAL. Celelalte cereri (spital,
   SRU Craiova, CET) se importă pe loc, dacă e timp.
4. Conturile se fac acum, dar se pornesc doar după demo.
