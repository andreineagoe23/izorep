# Demo la RADOIA: ce arătăm și în ce ordine

> Pentru Adrian, la întâlnirea cu firma. Întrebările de lăsat firmei sunt în
> `docs/intrebari-firma.md`.
>
> **Scris pentru întâlnirea din 7 octombrie 2026**, pe aplicația de atunci.
> Firul și cifrele de mai jos sunt cele de atunci. De atunci datele stau pe
> server, iar stocul are comenzi, recepții, consum, închiderea șantierului și
> inventar (fazele 3–8, `docs/plan-implementare.md`). Linkul de pe Pages a
> rămas demo, cu datele în browser.

**Unde:** <https://andreineagoe23.github.io/izorep/>. Merge din browser, fără
instalare. Pe link, importul folosește doar regulile, fără AI, și dă exact
aceleași cifre ca mai jos.

**Fișierul pentru demo:** `cerere-de-oferta-transavia-abur.xlsx`, din
`attachments/clienti/`. E cererea lor TRANSAVIA, pentru care au semnat Oferta
284. Nu e în repo (conține prețurile firmei), așa că trebuie adus pe laptop.

**Înainte de întâlnire:** deschide linkul într-o **fereastră privată (incognito)
din Chrome**: aplicația pornește goală, fără importurile, șantierele și stocul
încercate înainte. Nu închide fereastra în timpul demo-ului: ce faci în ea se
pierde la închidere. (În Safari, fereastra privată poate bloca salvarea.)

## Firul demo-ului (~15 minute)

1. **Tablou de bord → Cereri și oferte**, jos, la „Documentele firmei”. Ofertele lor, cu valorile lor exacte:
   - 118 = 170.519,39 €;
   - 118.1 = 12.692,04 €;
   - 5997 = 706,90 €, emisă de R&F ISORAD;
   - 284 = 91.737,81 €, după discountul de 3 %.

   Mesajul: datele sunt ale lor, citite din fișierele lor.
2. **Import Excel.** Tip ofertă: Rezidențială, cum a fost tarifată Oferta 284.
   Alege fișierul TRANSAVIA și arată ce iese:
   - 99 de poziții: 85 „Gata”, 13 „De verificat”, 1 „Fără preț”;
   - foaia se vede ca în Excel, cu ce a înțeles aplicația și prețul pe fiecare rând;
   - pe un rând deschis cu „Modifică”: „DN100 = ø114,3”, rândul din listă pe fiecare strat.
3. **„De verificat” → „Confirmă toate cele 13”.** Sunt vată 40 mm pe DN15.
   Combinația lipsește din listă, iar prețul (7,90 €/ml) e dedus din rândul
   următor. E exact prețul din oferta lor.
4. **„Fără preț” → distribuitorul de abur.** Aplicația nu inventează un preț
   pentru un echipament. „Modifică” → preț pus de mână 2.296,70 → „Salvează”.
5. **Pasul 3, Oferta:** **94.575,06 €**, exact totalul Ofertei 284. Scrie
   numărul 284, obiectivul, discount 3 → „Descarcă oferta”. Excel-ul generat are
   rândurile ofertei lor și foile „De validat” și „Netarifate”. Oferta apare și la
   „Cereri și oferte”, sus, pe rândul cererii; ce ștergi acolo dispare și din import.
6. **Ajustare prețuri**, în același pas: scrie 10 → toate prețurile cresc cu
   10 % (104.031,67 €); pune înapoi 0.
7. **Materiale de comandat**, în același pas: tuburi pe diametru până la 3 țoli,
   plăci pe m² peste (ø114 cu vată 30: 0,55 m² pe metru, regula lor), coturile
   peste 3 țoli trecute în m². → „Creează șantierul”: se deschide șantierul, cu
   valoarea 91.737,81 € (după discount).
8. **Situație de lucrări:** „Situație nouă”, câteva cantități (în limita
   ofertei), „Salvează”. Istoricul, cumulatul, „Descarcă” (Excel). „Tot restul”
   îl arătăm la final, după pasul 11.
9. **Depozit și stoc:**
   - necesarul TRANSAVIA apare cu „de comandat”;
   - „Încarcă date de exemplu”: unele materiale devin „acoperit”, restul rămân de comandat;
   - o intrare nouă cu preț de achiziție (de pe factură, în euro): apare costul
     lângă valoarea din ofertă;
   - „Anulează”: mișcarea nu se șterge, apare mișcarea inversă.
10. **Calcul deviz:** o poziție la mână, cu tipul ofertei. Exemplul „nu se
   ofertează” arată că un gol din listă nu devine preț zero.
11. **Măsurători:** pozele din carnet (cele 4 de la Ecoterm, din
   `attachments/santier/`). Sus, „Pentru ce sunt măsurătorile”: două drumuri.
   - **Pentru ofertă** (clienții din apropiere, unde măsurați voi): pe link,
     rândurile se scriu de mână lângă poză: „Adaugă rând”, „Am verificat
     pagina”, „Trimite la ofertă”, și ajung în import ca un Excel. Citirea
     automată a pozelor merge doar pe server, cu `npm start` și cheia: acolo
     cele 4 pagini se citesc în ~1 minut, iar omul confirmă pagină cu pagină.
   - **Pentru situație de lucrări** (ce s-a executat): alegi șantierul
     TRANSAVIA făcut la pasul 7, o poză, „Adaugă rând”: ø114, vată 50 mm, tablă
     aluminiu, metri, 10 → „Am verificat pagina” → „Pune în situație”. Se
     deschide Lucrări cu situația nouă. Același material e pe trei poziții, deci
     aplicația nu ghicește: arată pozițiile cu cât a mai rămas din fiecare
     („Poziția 22 · rămas … ml”) și alegi tu.
     Un rând care nu e în ofertă (de ex. ø500) apare separat, nu intră în bani.

   **Întrebările de pus:** avem oferta făcută din aceste 4 pagini? Și o poză
   din carnet făcută în timpul unei lucrări, cu situația făcută din ea?
12. **Încheierea șantierului:** în Lucrări, „Situație nouă” → „Tot restul” →
   „Salvează”: cumulatul ajunge exact la valoarea ofertei, 91.737,81 €.

## Ce e real și ce e prototip

Starea din 12 octombrie 2026.

| Real, verificat pe ofertele lor | Doar pe linkul demo |
|---|---|
| Prețurile din import: 98 din 98 exacte față de Oferta 284; Oferta 118 și Matari la fel | Datele (importuri, oferte, șantiere, stoc) stau doar în browserul în care au fost introduse; pe server stau în bază |
| Totalul și registrul Excel al ofertei | Datele de exemplu din stoc, marcate „exemplu” |
| Necesarul, comenzile, recepția, consumul din situații, închiderea șantierului, inventarul: pe server, în bază | Șantierul închis e oprit doar în formulare; pe server îl oprește și baza |
| Rândurile din poze, după „Am verificat pagina”, trec prin același import și aceleași prețuri | Citirea automată a pozelor: doar pe server; pe link se scriu de mână |

Încă nefăcute: clienții și documentele firmei din „Cereri și oferte” sunt
citite din fișierele lor, nu salvate în bază; conturile și rolurile.

## Cifre de știut

- Oferta 284: 99 de poziții. Toate prețurile calculate sunt exacte față de oferta semnată (98 din 98); singura poziție fără preț e distribuitorul.
- Oferta 27.04.2026 (NISAL): 48 de prețuri exacte. Cele 9 diferite ies toate „De verificat”, niciunul „Gata”.
- Matari (goluri la foc): 53 din 53, total 12.692,04 € la ban.
- DN → ø → rândul din listă: 209 linii din cele 10 fișiere, toate corecte.
