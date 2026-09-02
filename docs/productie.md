# Producție

> Decizii de infrastructură și operare. Nu se încarcă în contextul modelului —
> e referință pentru oameni. Contextul de cod stă în `.claude/`.

## Constrângerea care decide restul

**Nu vrem administrare după predarea aplicației către client.**

De aici decurge logic: nu se livrează o instanță per client. Zece clienți ar
însemna zece servere de patch-uit, zece baze de restaurat, zece incidente. Iar
o firmă de izolații cu opt angajați n-are IT — sună dezvoltatorul oricum.

Deci: **o singură instanță, cu bază administrată**, plus infrastructură
administrată acolo unde e posibil.

## Conturile stau pe numele clientului

Hosting, bază de date, domeniu, stocare, expeditor de email — deschise și
plătite de firmă. Dezvoltatorii primesc acces de colaborator.

De ce, în ordinea greutății:

1. **Datele nu trec prin custodia dezvoltatorilor.** Firma e operator și
   deținător al infrastructurii.
2. **Predarea devine „îmi scot accesul"**, nu migrare de conturi.
3. **Dacă dezvoltarea se oprește, firma nu rămâne fără sistem.** Serverul e al
   ei, altcineva poate prelua.
4. Nu plătești tu infrastructura altcuiva.

Costul: firma deschide două-trei conturi. Cinci minute pentru ei.

## Forma infrastructurii

| Piesă | Alegere | De ce |
|---|---|---|
| Bază de date | Postgres **administrat**, în UE, cu PITR | Singura piesă care nu se administrează niciodată manual. Restul e înlocuibil; baza e afacerea. |
| Aplicație | host cu **containere**, nu serverless | Playwright pentru PDF cere runtime cu browser. În container e banal, în serverless e bătaie de cap. |
| Fișiere | stocare S3-compatibilă | Poze de șantier, PDF-uri, Excel-uri. Nu în bază. |
| Frontend | rămâne cel existent | Vanilla TS, 7 ecrane, fără framework. Next.js ar însemna rescrierea lor pentru beneficii (SEO, edge) pe care o aplicație internă nu le are. |

Versiunea majoră de Postgres din `docker-compose.yml` trebuie să fie aceeași
cu cea din producție. E singura constrângere de mediu care contează.

## Rolul de bază de date al aplicației

**Aplicația nu se conectează niciodată cu rolul administrativ.**

Superuserii și rolurile cu `BYPASSRLS` ocolesc row-level security complet,
chiar și cu `FORCE ROW LEVEL SECURITY`. Cu rolul greșit, toată izolarea între
tenanți e decorativă și nimic nu semnalează asta — testele trec.

- migrări → rol proprietar
- aplicație → rol dedicat, `NOBYPASSRLS`

Descoperit local, prin test. Vezi `.claude/backend.md` și migrarea 0002.

## Backup

**Un backup nerestaurat nu e backup.**

- exercițiu **lunar** de restaurare într-o bază separată, verificat că
  ofertele istorice ies identic
- copie la **alt furnizor** decât serverul. Dacă se blochează contul, altfel
  pierzi și serverul, și backup-urile
- retenție lungă. Corupția tăcută se descoperă după săptămâni; șapte zile nu
  ajung

## Poarta: ce trebuie să existe înainte ca un angajat să atingă sistemul

Listă de blocare, nu de dorințe. Cât timp una lipsește, se rulează **în
paralel** cu procesul actual, nu în locul lui.

1. **Autentificare cu conturi individuale.** Nu se construiesc parole proprii —
   SSO dacă firma are Microsoft 365 sau Google Workspace, altfel magic link.
   Contul comun de birou distruge exact jurnalul de audit pentru care se
   construiește sistemul.
2. **Permisiuni verificate pe server.** `web/nav.ts` notează deja că
   ascunderea unui buton nu e securitate.
3. **Jurnal de audit pe documentele financiare** — cine, când, de la ce
   valoare la ce valoare.
4. **Backup restaurat**, nu doar configurat.
5. **HTTPS pe domeniu propriu.**

## Ordinea modulelor în producție

Roadmap-ul inițial pune stocul primul. Pentru lansare, ofertarea merge înainte:

- stocul e **blocat** pe întrebarea „cine ține evidența oficială, aplicația sau
  Saga" — vezi `.claude/stare.md`
- stocul e modulul unde greșeala ajunge la **ANAF**; o ofertă e citită de un om
  înainte să plece la client
- motorul de ofertare e deja construit și dovedit pe oferte reale

## Integrarea cu Saga

**Saga C nu are API.** Integrarea e prin fișiere XML importate manual din
`Diverse → Import → Import din fișiere`.

Deci „puntea către Saga" înseamnă: aplicația generează XML-ul, contabila îl
descarcă și îl importă. Pasul manual trebuie proiectat ca fiind manual și
vizibil, nu ascuns ca și cum ar fi automat.

Saga rămâne evidența oficială cât timp întrebarea de mai sus n-are răspuns.

## Ce rămâne deschis

- Cine ține stocul oficial — aplicația sau Saga? Determină tot modulul de stoc.
- Cine emite factura și cine o trimite în SPV?
- Seriile și numerotarea facturilor rămân în Saga?

Întrebările complete, în `.claude/stare.md`.
