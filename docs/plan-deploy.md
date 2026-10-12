# Planul de deploy: un link pentru Adrian, apoi pentru firmă

> Pentru noi (Andrei, Adrian). Scris pe 12 octombrie 2026. Problema de azi:
> Adrian nu poate face demo la firmă, fiindcă aplicația pornește doar cu Docker
> pe laptop. Cerut: ceva securizat și, de preferat, o singură platformă pentru
> pagină, server și bază. Cifrele de preț sunt din octombrie 2026 și se
> verifică pe pagina furnizorului înainte de plată.

## Pe scurt

- **Render**, regiunea Frankfurt: serverul nostru (care servește și pagina) și
  Postgres 18, în același loc. Deploy singur la fiecare push pe `main`.
  Aproximativ **13 $ pe lună**.
- **Securizat în doi pași:** pentru demo, o parolă comună pe tot site-ul;
  înainte de date reale, intrarea cu link pe email înapoi (codul există în git).
- **Linkul de pe GitHub Pages trebuie oprit.** E public și are în el datele
  firmei (mai jos).

## Ce avem azi, din cod

- Un singur proces Node (Hono) servește și pagina (`npm run build:server`), și
  `/api`. Nu e nevoie de o platformă pentru frontend și alta pentru backend.
- Postgres 18, cu RLS pe firmă. Aplicația intră cu rolul `izorep_app`
  (`NOBYPASSRLS`), migrările cu proprietarul (migrarea 0002).
- Modelul (OpenAI) e chemat doar de server. Cheia stă în mediul serverului.
- Pozele, avizele și facturile stau în bază (`bytea`), până la 15 MB pe cerere.
  Citirea unei poze poate dura până la 3 minute.
- **Fără conturi** din 10 octombrie. De aceea serverul ascultă doar pe
  127.0.0.1: pus în internet așa, oricine ar vedea prețurile firmei și ar folosi
  cheia OpenAI.
- **Linkul demo de pe Pages e public.** `andreineagoe23.github.io/izorep`
  răspunde fără nicio parolă. Faptul că repo-ul e privat nu schimbă asta:
  GitHub Pages servește public și dintr-un repo privat. În pachetul paginii
  sunt listele de prețuri ale firmei, prețurile de achiziție (K-Flex, ultimele
  facturi), documentele și ofertele lor din `seed`.

## De ce Render

| | Render | De ce nu |
|---|---|---|
| Pagină + server + bază într-un loc | da | — |
| Postgres 18, ca local | da (13–18 la creare, 18 implicit) | — |
| Europa | Frankfurt | — |
| Backup | restaurare la orice moment din ultimele 3 zile (Hobby) sau 7 (Pro), plus export zilnic păstrat 7 zile | — |
| Cereri de 15 MB, răspunsuri de 3 minute | da: server obișnuit, nu funcții | — |
| **Vercel** | — | funcții serverless: cererea are cel mult 4,5 MB, iar avizele și pozele au până la 15 MB. Baza ar fi la alt furnizor |
| **Cloudflare** | — | n-are Postgres: baza ar sta în altă parte |
| **Railway** | — | merge la fel, dar backup-ul și regiunea UE sunt mai puțin clare. Rezervă, dacă Render nu ne lasă rolul aplicației |
| **Fly.io** | — | mai mult de administrat |

Cost, după sursele găsite (de confirmat pe render.com/pricing):

| Ce | Pe lună |
|---|---|
| Serverul, Starter (512 MB, mereu pornit) | 7 $ |
| Postgres, cel mai mic plan plătit | ~6 $ |
| Spațiul bazei | 0,30 $ / GB |
| Workspace Hobby (o persoană) | 0 |
| **Total** | **~13 $** |

Planul gratuit nu ajunge: serverul doarme după 15 minute (primul clic durează
cât o pornire), iar baza gratuită n-are backup.

## Securitatea, în doi pași

**Pasul 1, pentru demo (zile).** O parolă comună pe tot site-ul: Basic Auth în
server, citită din variabila `IZOREP_PAROLA`; fără ea, serverul nu pornește pe
Render. Cam 20 de linii, cu test. HTTPS e de la Render. În bază doar date de
test (TRANSAVIA, Matari), nimic real de la firmă. E destul pentru demo, nu și
pentru lucru: cu o parolă comună nu se știe cine a schimbat un preț
(`productie.md`).

**Pasul 2, înainte de date reale.** Intrarea cu link pe email se pune la loc:
codul e în `d6d2ab0` (`src/server/intrare.ts`, `email.ts`), scos în `ad8c50c`,
iar tabelele `utilizator`, `sesiune`, `token_intrare` sunt încă în bază. Un cont
pe om, fără parole. Emailul pleacă prin SMTP-ul adresei de email a firmei
(`SMTP_URL`), deci fără încă un furnizor. Rolurile rămân cele două de azi.
Parola comună de la pasul 1 dispare.

Tot de la pasul 1:

- cheia OpenAI doar în variabilele Render, cu o limită de cheltuieli pusă pe
  contul OpenAI;
- parola rolului `izorep_app` schimbată: migrarea 0002 o creează cu
  `'izorep_app'`, parolă scrisă în git (vezi pasul B, mai jos).

## Ce schimbăm în cod

Puțin; restul e configurare.

1. **`render.yaml`** în repo, ca toată configurarea să fie în git: serviciul web
   (Frankfurt, Starter, build `npm ci && npm run build:server`, înainte de
   pornire `npm run db:migrate`, pornire `npm run server`, verificarea pe
   `/api/stare`) și baza (Frankfurt, Postgres 18).
2. **Variabilele:** `HOST=0.0.0.0`; `PORT` îl dă Render; `DATABASE_URL` cu
   `izorep_app`; `DATABASE_URL_PROPRIETAR` pentru migrări (azi `migreaza.ts`
   citește tot `DATABASE_URL`: trebuie despărțite); `OPENAI_API_KEY`;
   `IZOREP_PAROLA`.
3. **Parola lui `izorep_app`** pusă din variabilă după migrări (`ALTER ROLE`),
   nu cea din 0002.
4. **Parola comună** (pasul 1 de securitate), cu test.
5. **Seed-ul** citește doar din `data/`, deci merge și pe Render
   (`npm run db:seed` o dată, din consola Render).

Ce **nu** e nevoie de schimbat: serverul servește deja pagina, `/api/stare` e
verificarea de viață, colația ro-RO de local nu contează (nicio ordonare de
text nu se face în bază).

## Pașii, fiecare cu „gata când”

**A. Oprim scurgerea de pe Pages.** Imediat ce merg B și C, scoatem publicarea
pe Pages (`pages.yml`) și ștergem site-ul. Până atunci, linkul să nu mai fie
trimis nimănui. Gata când: `andreineagoe23.github.io/izorep` dă 404.

**B. Baza.** Postgres 18 în Frankfurt. Primul lucru de verificat: utilizatorul
dat de Render poate face `CREATE ROLE`? Migrarea 0002 are nevoie de asta.
- Dacă da: migrările, parola nouă pentru `izorep_app`, seed-ul.
- Dacă nu: aplicația intră cu utilizatorul Render. Nu e superuser, iar
  tabelele au `FORCE ROW LEVEL SECURITY`, deci politicile se aplică și lui.

Gata când: `tests/db.test.ts`, rulat cu `DATABASE_URL` spre baza Render, trece,
inclusiv testul care pică dacă izolarea nu ține.

**C. Serverul.** Din `render.yaml`, legat de `main`. Gata când: Adrian
deschide linkul pe laptopul lui, fără Docker, intră cu parola, importă cererea
TRANSAVIA și ajunge la 94.575,06 €, citește o poză din carnet, creează
șantierul; după un push nou, datele sunt tot acolo.

**D. Backup încercat o dată.** Restaurare la un moment de ieri, pe o bază
nouă, nu peste cea bună. Gata când: oferta de ieri se deschide din baza
restaurată.

**E. Înainte de date reale:** conturile (pasul 2 de securitate), workspace-ul
pe numele firmei (`productie.md`: conturile sunt ale lor, noi colaboratori) și
Pro dacă vrem 7 zile de restaurare în loc de 3.

## Ce nu facem acum

Domeniu propriu (merge pe `*.onrender.com`), un al doilea mediu de test,
monitorizare, mai multe instanțe. Se adaugă când o cere folosirea, nu înainte.

## De hotărât (Andrei)

1. **Render**, sau altă platformă?
2. **Parola comună** pentru demo, până la conturi: da?
3. **Contul Render:** al nostru acum și mutat pe firmă la pasul E, sau al
   firmei de la început?
4. **Pages:** îl oprim imediat ce merge Render (recomandat), sau chiar acum?
   Adrian ar rămâne câteva zile fără link.
5. **Emailul firmei** pentru pasul 2: ce adresă și la ce furnizor (pentru
   SMTP).

## Surse

- Postgres 18 pe Render: render.com/changelog/postgresql-18-is-now-available-for-render-postgres-databases
- Versiuni și regiune la creare: render.com/docs/postgresql-creating-connecting
- Backup și restaurare: render.com/docs/postgresql-backups
- Prețuri (din surse terțe, de verificat): render.com/articles/how-much-does-cloud-application-hosting-cost-for-small-businesses, render.com/pricing
