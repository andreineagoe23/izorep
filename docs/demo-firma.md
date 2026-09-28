# Demo la RADOIA: ce arătăm și în ce ordine

> Pentru Adrian, la întâlnirea cu firma. Întrebările de lăsat firmei sunt în
> `docs/intrebari-firma.md`.

**Unde:** <https://andreineagoe23.github.io/izorep/>. Merge din browser, fără
instalare. Pe link, importul folosește doar regulile, fără AI, și dă exact
aceleași cifre ca mai jos.

**Fișierul pentru demo:** `cerere-de-oferta-transavia-abur.xlsx`, din
`attachments/clienti/`. E cererea lor TRANSAVIA, pentru care au semnat Oferta
284. Nu e în repo (conține prețurile firmei), așa că trebuie adus pe laptop.

**Înainte de întâlnire:** deschide linkul o dată. Dacă ai mai încercat
aplicația în același browser, șterge importurile vechi (Import Excel →
„Șterge”) și datele din „Depozit și stoc”, ca demo-ul să pornească curat.

## Firul demo-ului (~15 minute)

1. **Tablou de bord → Cereri și oferte.** Ofertele lor, cu valorile lor exacte:
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
   rândurile ofertei lor și foile „De validat” și „Netarifate”.
6. **Materiale necesare**, în același pas: vata și tabla pe fiecare diametru, în
   metri și m², plus piesele. Adaosul pentru coturi (5–10 %, din registrul lor)
   se alege. → „Trimite la depozit”.
7. **Depozit și stoc:**
   - necesarul TRANSAVIA apare cu „de comandat”;
   - „Încarcă date de exemplu”: unele materiale devin „acoperit”, restul rămân de comandat;
   - o intrare nouă (de exemplu, o factură de furnizor), apoi „Anulează”: mișcarea nu se șterge, apare mișcarea inversă.
8. **Calcul deviz:** o poziție la mână, cu tipul ofertei. Exemplul „nu se
   ofertează” arată că un gol din listă nu devine preț zero.

## Ce e real și ce e prototip

| Real, verificat pe ofertele lor | Prototip |
|---|---|
| Prețurile din import: 98 din 98 exacte față de Oferta 284; Oferta 118 și Matari la fel | Depozitul: datele stau doar în browserul în care au fost introduse |
| Totalul și registrul Excel al ofertei | Datele de exemplu din stoc, marcate „exemplu” |
| Necesarul de materiale (geometrie din pozițiile tarifate) | Lucrările, clienții și documentele: citite din fișiere, nu salvate în bază |

## Cifre de știut

- Oferta 284: 99 de poziții. Toate prețurile calculate sunt exacte față de oferta semnată (98 din 98); singura poziție fără preț e distribuitorul.
- Oferta 27.04.2026 (NISAL): 48 de prețuri exacte. Cele 9 diferite ies toate „De verificat”, niciunul „Gata”.
- Matari (goluri la foc): 53 din 53, total 12.692,04 € la ban.
- DN → ø → rândul din listă: 209 linii din cele 10 fișiere, toate corecte.
