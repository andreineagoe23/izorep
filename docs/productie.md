# Producție

> Cum va ajunge aplicația la oamenii din firmă. Nu se încarcă în contextul
> modelului — e referință pentru oameni. Contextul de cod stă în `.claude/`.

## Pentru cine e

O firmă mică de izolații: oameni de birou, oameni pe șantier și o contabilă.
Nu au IT și nu vor să învețe unelte noi. Tot ce urmează e măsurat după asta:
**cât mai puțini pași, cât mai puține lucruri de ținut minte.**

## Cum o folosesc

- **Un link.** Se deschide din browser, pe calculator. Nimic de instalat.
  O folosesc cei de la birou (tehnicul, patronul, contabila).
- **Șantierul nu folosește aplicația.** Oamenii de acolo scriu în carnet, ca
  azi, și trimit poze. Tehnicul le pune în ecranul „Măsurători”, verifică ce a
  citit aplicația de pe poză și le trimite spre ofertă sau în situația de
  lucrări a șantierului.
- **Un cont pentru fiecare om**, cu emailul și parola lui (ales de Andrei pe
  21 octombrie 2026: linkul pe email cerea un furnizor de email). Contul comun
  de birou nu merge: nu se mai știe cine a schimbat un preț. Conturile le
  facem noi, cu `npm run om`; parola uitată se resetează tot așa.
- **Rolurile** (cine vede ce) se stabilesc mai târziu, cu firma.

## Legătura cu Saga

Saga rămâne cum e: contabila ține acolo contabilitatea, stocul oficial și
trimite facturile la ANAF.

Saga C nu se poate lega direct de alte programe, dar știe să importe fișiere
XML (*Diverse → Import → Import din fișiere*). Deci aplicația pregătește
fișierul, iar contabila apasă **Import** în Saga. Factura apare completată, nu
o mai scrie de mână.

De aflat de la contabilă, când ajungem acolo: ce versiune de Saga folosește și
o factură exportată din Saga, ca să vedem formatul.

## Unde stă și cine plătește

- Conturile (găzduire, bază de date, domeniu) sunt **pe numele firmei**; noi
  avem acces de colaborator. Dacă ne oprim, aplicația și datele rămân ale lor.
- **Backup automat**, verificat din când în când că se poate restaura.
- O singură instalare pentru toți, ca să nu fie nimic de întreținut la firmă.

## Ordinea

Ofertarea merge prima: e construită și verificată pe oferte reale, iar o ofertă
e citită de un om înainte să plece la client. Stocul și facturarea vin după,
pentru că acolo o greșeală ajunge la ANAF.

## Pentru noi, la instalare

Aplicația se conectează la bază cu un rol dedicat, `NOBYPASSRLS`, niciodată cu
cel de administrator. Cu rolul greșit, separarea datelor între firme nu mai
funcționează și niciun test nu semnalează. Detalii în `.claude/backend.md` și
în migrarea 0002.
