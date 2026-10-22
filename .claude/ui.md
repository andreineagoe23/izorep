# UI

> Context pentru `web/`.

Aplicație pe ecrane, fără framework. Vite + TypeScript, rutare pe hash
(`#/clienti`) ca să funcționeze pe GitHub Pages fără server.

## Structura

```
web/index.html        shell: bară laterală + zonă de conținut
web/main.ts           router, meniu, bară laterală, comutator de temă și de rol
web/nav.ts            definiția meniului, modulele viitoare și rolurile
web/meniu-stare.ts    preferința de bară pliată (localStorage, best-effort)
web/icoane.ts         pictogramele meniului, pentru bara pliată
web/style.css         tot CSS-ul. Ecranele NU adaugă clase noi.
web/date/seed.ts      datele de exemplu, doar pe linkul demo (`exemple()`, web/date/exemple.ts)
web/date/firme.ts     cele două firme emitente, antetul ofertelor
web/ecrane/tip.ts     contractul de ecran + helperele de randare
web/ecrane/*.ts       câte un ecran per fișier
```

## Contractul de ecran

Fiecare ecran exportă un singur obiect:

```ts
export const ecran: Ecran = {
  id: "clienti",
  titlu: "Clienți",
  subtitlu: "opțional",
  render(root) { root.innerHTML = "…"; },
};
```

Router-ul îl încarcă leneș (`import()`), desenează titlul, apoi apelează
`render` cu un container gol. Ecranele nu ating nimic din afara containerului
lor și nu manipulează meniul. Un ecran care are nevoie de toată lățimea o
**cere** (`ceriSpatiu` din `web/meniu-stare.ts`), iar `main.ts` pliază bara —
temporar, fără să scrie preferința, doar la trecerea de la „nu cere” la
„cere” (dacă omul redeschide meniul, o redesenare nu i-l închide din nou) și
până la schimbarea ecranului. Importul o cere cât timp e un fișier deschis
(25 septembrie 2026).

Ecran nou: creezi fișierul în `web/ecrane/`, îl adaugi în `ECRANE` din `main.ts`
și pui itemul în `MENIU` din `nav.ts`.

## Poziția în pagină

La fiecare navigare, `navigheaza` derulează sus. Rutarea e pe hash, deci nu
există navigare reală care să miște scroll-ul: fără asta treci de pe lista de
lucrări derulată la jumătate pe tabloul de bord și aterizezi în mijlocul lui.

La refresh, browserul restaurează singur poziția, iar aici e greșit de două ori:
ecranul se redesenează de la zero, deci poziția veche nu mai corespunde
aceluiași conținut, și unele ecrane își randează conținutul după un `await`,
când restaurarea deja s-a întâmplat. De aceea `history.scrollRestoration` e pus
pe `"manual"` și treaba o face routerul.

Costul, asumat: și butonul de înapoi aduce sus, nu unde erai.

Focusul pe `#ecran` se mută cu `preventScroll: true` — altfel focusarea trage
pagina înapoi peste derularea de mai sus.

## Randare

Folosește helperele din `tip.ts` — `eur`, `nr`, `data`, `dataScurta`, `esc`,
`card`, `indicator`, `progres`, `stare`, `tabel`, `nota`, `atentionare`. Ele
produc exact marcajul pe care îl stilează `style.css`. Un ecran care își
inventează clase proprii arată diferit de restul aplicației și rupe temele
light/dark.

**Orice text care vine din date trece prin `esc()`** înainte să ajungă în
`innerHTML`. Descrierile din fișierele clienților conțin ghilimele, `<` și
caractere stricate din PDF-uri.

## Culoarea: brandul separat de stare

Paleta are un singur albastru pentru **acțiune** (link, buton activ, item de
meniu curent, bară de progres) și trei culori de **stare** — verde, chihlimbar,
roșu. Nu se amestecă: dacă albastrul ar fi și culoare de stare, utilizatorul nu
mai poate citi dintr-o privire ce e clicabil și ce e o avertizare. Accentul
vechi era maro, la o nuanță de chihlimbarul „atenție" și de roșul de eroare —
pentru un daltonist erau aceeași culoare.

**Neutrele sunt reci în ambele teme.** Prima variantă a păstrat neutrele calde
(maro) de dinainte sub accentul albastru: în temă deschisă abia se observa, dar
în temă închisă fundalul devenea maro, se bătea cu albastrul, iar chihlimbarul
de „atenție" arăta ca a treia culoare de brand. Un singur neutru rece ține cele
două teme împreună și lasă albastrul singura culoare de acțiune.

Chihlimbarul rămâne doar pe eticheta de stare. Bordura din stânga la
`atentionare()` e neutră: dacă și ea e colorată, tabloul de bord are trei dungi
portocalii care nu spun nimic în plus.

Roșul e rezervat **erorii reale** (o poziție care nu se poate tarifa). O ofertă
care așteaptă răspuns nu e o eroare: merge prin `atentionare()`, nu prin
`.alerta`.

Regulile pe care le respectă `style.css`:

- text normal ≥ 4,5:1 față de fundal, contururi de control ≥ 3:1 (WCAG AA)
- starea se citește din **text**, culoarea doar o întărește
- corp de literă 16px, minimul din tabele 13px — nimic sub atât
- `:focus-visible` vizibil pe orice fundal, inclusiv pe bara închisă la culoare
- tokenii sunt numiți după rol (`--accent`, `--linie-tare`), nu după culoare
- ambele teme sunt definite pe tokeni; un ecran nu scrie niciodată o culoare

## Datele pe server (9 octombrie 2026)

`web/date.ts` e singurul loc din care ecranele citesc și scriu date
(planuri, depozit, oferte, importuri). La pornire alege: server (`/api/stare`
răspunde) sau browser (linkul de pe Pages). Pe server, `navigheaza` ia datele
la fiecare schimbare de ecran, deci ce a scris un coleg se vede la următorul
clic.

- **Intrarea** (21 octombrie 2026, în locul ferestrei de parolă a
  browserului): pagina „Intră în cont” (emailul, parola cu ochiul în dreapta casetei, `web/parola-vizual.ts`, „Intră”; fără rândul „Ai uitat parola?”),
  pe tot ecranul, cu logo-urile RADOIA și ISORAD din oferte centrate pe o plăcuță albă și dedesubt doar titlul „Intră în cont” (`antetIntrare`; „IzoERP” și firma au plecat), fără bara laterală și fără antet (`data-intrare` pe `:root`;
  Andrei, 22 octombrie: bara cu tema și firma nu are ce căuta înainte de
  intrare), desenată de `main.ts` când `/api/stare` nu
  are om intrat; după intrare pagina se reîncarcă. Cu parola temporară,
  „Alege-ți parola” înainte de orice. Un 401 în timpul lucrului (sesiune
  expirată) aduce intrarea, cu motivul. În antet: numele omului (spre „Contul
  meu”) și „Ieși”; pe telefon fără curs. La Setări: „Cine a schimbat ce”
  (`ecrane/jurnal.ts`) și „Contul meu” (`ecrane/cont.ts`, schimbarea parolei).
  Cu serverul picat, pagina spune „Serverul nu răspunde”, fără meniu.
- **Adrese de detaliu:** pagina unui șantier e `#/lucrari/<id>` (routerul ia
  ecranul de dinainte de al doilea „/”): merge „Înapoi”, reîncărcarea și
  linkurile din „Necesită atenția ta”.
- **Mesajele serverului** stau deasupra ecranului (`#mesaje`): o scriere
  refuzată („Nu s-a salvat pe server: …”, cu „Am înțeles”) și cardul „Datele
  din acest browser” / „Mută datele pe server”. După un refuz ecranul se
  redesenează singur din datele de pe server (10 octombrie 2026): lista pe
  care o ținea era veche, iar ce lipsea din ea ar fi plecat ca ștergere.
- Pe server dispar „Încarcă date de exemplu” (mișcările nu se mai șterg) și
  notele „Prototip: … doar în acest browser”.
- „Descarcă oferta” salvează întâi (importul și versiunea ofertei), apoi
  descarcă; o eroare de salvare oprește descărcarea.

## Cereri și oferte (3 octombrie 2026)

Sus, **„Cererile importate”**: fiecare import din istoric (`web/istoric.ts`)
e un rând, cu oferta descărcată din el (`web/oferte-local.ts`, scrisă la
„Descarcă oferta”: număr, client, valoarea după ajustare, foc și discount) și
cu „Șantier făcut” când există un plan pe fișierul lui. „Deschide” pune importul
curent și duce la import; „Șterge” (a doua apăsare confirmă) șterge importul și
oferta lui, ca și „Șterge” din import. Dedesubt, **„Documentele firmei”**:
documentele reale din `web/date/seed.ts`, ca exemple, cu filtrele lor. Din 13
octombrie 2026, doar pe linkul demo: pe server ecranul arată numai ce e în bază.
Înainte pagina arăta doar exemplele, deci ce ștergea omul nu dispărea de
nicăieri (Andrei, 3 octombrie 2026). Cardul de explicații și cele trei note de
jos au plecat: erau pentru prezentare, nu pentru lucru.

## Antetul și bara (3 octombrie 2026)

Antetul din dreapta și numele firmei din bară au aceeași înălțime
(`--inaltime-antet`, 64 px), ca linia de sub ele să fie una singură. Antetul
ține doar butonul de meniu, cu text vizibil („Ascunde meniul” / „Arată
meniul”), nu doar pictogramă. „DEMO” și cursul au plecat: cursul era un număr
fix din cod, care arăta ca un curs de azi (din 21 octombrie 2026 cursul e
înapoi, live de la BNR, prin server: `arataCursul` în `main.ts`, doar
informativ). Comutatorul de rol e ascuns
(`hidden`): ambele roluri văd tot până se stabilesc rolurile cu firma. Rama de
focus de pe `#ecran` nu se mai desenează (focusul rămâne, pentru cititorul de
ecran). Textele ecranelor au fost rescrise fără jargon („snapshot”, „segment”,
„matrice rară”, „gestiune”) pentru oameni care nu sunt obișnuiți cu aplicații.

## Tema

Comutator cu trei stări în bara laterală: **Automat** (implicit, după
sistem), **Deschis**, **Închis**. Alegerea se ține în `localStorage` sub `izorep-tema`.

„Sistem" înseamnă absența atributului `data-tema`, nu o a treia paletă — așa
pagina răspunde la schimbarea temei din sistem cât timp e deschisă, fără cod.

Tema se aplică dintr-un script inline în `<head>`, înainte de primul paint. Pusă
în `main.ts`, pagina ar clipi o dată pe tema sistemului la fiecare încărcare.

Tema închisă e scrisă de două ori în CSS, cu aceleași valori: o dată sub
`@media (prefers-color-scheme: dark)` pentru cine n-a ales nimic, o dată sub
`:root[data-tema="dark"]` pentru alegerea explicită. CSS nu poate combina un
`@media` cu un selector de atribut într-o singură regulă — dacă modifici una,
modific-o și pe cealaltă.

## Meniul: pe flux, restul pliat

Din 15 octombrie 2026: Acasă, apoi grupurile Oferte, Șantiere, Materiale,
Setări, cu numele pe care le folosesc angajații („Lucrări” e „Șantiere”,
„Măsurători” e „Poze de pe șantier”). Titlul ecranului e numele din meniu.

`MENIU` din `nav.ts` conține doar ecrane care există. Modulele nelivrate stau în
`VIITOR`, într-un `<details>` sub meniu.

Varianta anterioară amesteca cele două în cinci grupuri, cu jumătate din itemi
gri și inactivi. Harta sistemului e utilă clientului — dar în navigația zilnică
ea costă atenție la fiecare privire. Pliată, spune același lucru o dată.

Cererile și ofertele sunt un singur ecran (`documente.ts`), cu filtru pe tip:
sunt **același obiect** în stadii diferite ale aceluiași flux — cerere → ofertă
→ contract (cu oferta ca anexă) → situație de lucrări. Două ecrane ascundeau
exact lanțul care trebuie văzut. Rutele vechi `#/cereri` și `#/oferte` sunt
redirectate în `ALIAS` din `main.ts`.

### Pliere și sertar

Un singur buton, în bara de sus (`#pliaza`), pentru două comportamente — pentru
că sunt aceeași intenție, „dă meniul la o parte":

- **peste 860px** bara se pliază la o bandă de 68px cu doar pictogramele, iar
  eticheta devine tooltip lângă item. Preferința se ține în `localStorage` sub
  `izorep-meniu` și se aplică dintr-un script inline în `<head>`, ca și tema:
  altfel bara ar apărea întinsă și s-ar plia sub ochii omului la fiecare
  încărcare. Comutatorul de temă și cel de rol dispar cât timp e pliată — nu
  încap în bandă și nu sunt navigație.
- **sub 860px** bara nu se pliază, ci glisează peste conținut ca sertar, cu
  fundal care o închide. Starea sertarului **nu** se reține: un sertar deschis
  la fiecare încărcare ar acoperi exact ecranul pentru care a venit omul.
  Închis, bara e și `visibility: hidden`, altfel linkurile ei rămân în ordinea
  de tabulare și focusul pleacă într-un panou din afara ecranului.

Varianta anterioară de mobil întindea meniul sub antet, ca un rând de chip-uri:
șapte destinații plus modulele viitoare împingeau conținutul în jos la fiecare
încărcare.

Sertarul se închide la navigare, la `Escape`, la click pe fundal și la click pe
un item — inclusiv pe ecranul curent, care nu schimbă hash-ul și deci nu trece
prin router. Focusul intră pe primul link la deschidere și se întoarce pe buton
la închidere.

Pictogramele (`web/icoane.ts`) există pentru bara pliată: fără etichetă, un item
trebuie să rămână recognoscibil. Sunt contur pe `currentColor`, `aria-hidden` —
eticheta o citește cititorul de ecran, nu desenul.

**Tooltipul e aceeași etichetă, mutată** — nu un al doilea element și nu
atributul `title`. Ascunsă cu `display: none`, eticheta ar dispărea și din
numele accesibil al linkului, iar pe bandă ar rămâne șapte linkuri fără nume;
`opacity` o scoate din ochi fără s-o scoată din arborele de accesibilitate.
`title` nativ ar veni după ~1s, n-ar apărea la navigarea cu tastatura și nu se
poate stiliza pe bara închisă la culoare — tooltipul CSS apare și pe
`:focus-visible`.

Cât e pliată, `#meniu` trece pe `overflow: visible`: `auto` ar tăia tooltipul la
68px. Banda ține cele opt destinații fără derulare, deci nu se pierde nimic.
Tot cât e pliată, bara are `z-index: 30` (14 octombrie 2026): cardurile de după
ea își fac propriul strat, iar tooltipul ieșea sub ele.

Logica de preferință stă în `web/meniu-stare.ts`, cu depozit injectabil. Ca la
orice depozit din browser, e best-effort: blocat, preferința se pierde, meniul
merge.

## Rolul activ

Comutatorul din bara laterală schimbă ce se vede. `vedeCosturi()` din `nav.ts`
spune dacă rolul curent are voie să vadă valori în bani. Azi sunt două roluri,
Birou și Contabilitate, amândouă cu acces la tot: rolurile se stabilesc cu
firma. Șantierul nu are rol, fiindcă nu folosește aplicația.
Ecranele care afișează bani trebuie să îl respecte.

În aplicația reală asta se verifică pe server; aici e doar demonstrația
modelului de permisiuni.

## Istoricul importurilor

Ecranul de import ține ultimele 10 importuri în **IndexedDB**, nu în
`localStorage`: acolo intră ~5 MB de text, iar un registru de la client are sute
de kB binari.

Se salvează **fișierul**, plus extragerile și corecțiile omului. **Nu grila**:
aceeași parsare pe aceiași bytes dă aceleași rânduri, deci grila se reface la
deschidere. Două consecințe care contează:

- reîncărcarea paginii nu pierde munca — importul curent se redeschide singur,
  și rămâne până când se încarcă alt fișier sau se șterge din istoric;
- redeschiderea unui import vechi **nu cheamă modelul din nou**, deci nu costă
  tokeni și nu poate da alt rezultat decât cel pe care l-a validat omul.

Corecțiile de celule se rețin separat de grilă (`foaie`, `rând`, `celulă`,
valoare) — altfel s-ar pierde odată cu grila refăcută. Salvarea e amânată cu
400 ms: `input` vine la fiecare tastă.

Tot ce ține de depozit e best-effort. În fereastră privată sau cu stocarea
blocată, fiecare apel eșuează tăcut și ecranul se poartă ca înainte. Istoricul e
o comoditate; documentele adevărate vor sta în bază.

## Tabelele editabile (15 octombrie 2026)

`web/celula.ts`: `celulaNumar`, `celulaText` și `legaCelule` (comportamentul,
pe rădăcina ecranului). Din 18 octombrie 2026 (Andrei: tot ce se editează se
vede pe loc) celula se scrie la fiecare tastă și ecranul se redesenează sub
cursor (`pastreazaCursorul`: același câmp, textul exact, cursorul și derularea
la loc). O valoare pe jumătate („0”, gol) nu dă mesaj la tastă, ci la ieșirea
din celulă. Enter coboară pe rândul următor, Escape pune la loc ce era la
intrarea în celulă. Rândul la care scrii rămâne vizibil sub filtru până
schimbi filtrul (`randInLucru`). La fel, la tastă: pierderile din „Materiale
de comandat”, cifrele din jurul foii clientului (`actualizeazaInJur`) și
valoarea ciornei de comandă. Galben (`--schimbat`) = scris de
om, iar `title` spune ce era. O redesenare la apăsarea mouse-ului ar scoate
butonul de sub el înainte de clic: când celula pleacă la un clic, ecranul se
redesenează după el, doar dacă clicul n-a redesenat. Numărul se citește
românește („1.250” = 1250, „121,67”). Folosit în vederea „Ca în ofertă” a
importului și în tabelul necesarului; celula și unitatea stau pe un rând și pe
card (`.cel-cu-um`). ✕ e `.cel-scoate`, 44 px, fără roșu.

## Ștergerea de tot (15 octombrie 2026)

`web/confirmare.ts`: `panouStergere` (chenar de atenție sub rândul ales, „Ești
sigur că vrei să ștergi …?”, lista din `ceSeVaSterge`, bifa „Am înțeles”,
„Șterge definitiv” oprit până la bifă, „Renunță”) și `legaPanouStergere`.
Folosit în Oferte și cereri, în importurile recente și pe pagina șantierului
(„Șterge șantierul”, pliat; și pe șantierul închis). După ștergere, un rând
`role="status"` spune ce s-a șters.

## Importul în formatul ofertei (14 octombrie 2026)

Decis de Andrei: pe pagină și la export, aceeași formă pentru orice cerere. La
„Verificare”, vederea implicită e oferta (`web/import/oferta-vizual.ts`, din
`documentOferta`): antetul ofertei (cu „Completează datele ofertei” spre pasul
3), tabelul pe capitolele clientului cu subtotal, totalul cu discountul și
nota. Pe fiecare rând, sub denumire: „Completat de noi: …” (în Excel cu roșu),
„Excel: rândul N” și ce am înțeles; în dreapta starea și butonul care o
rezolvă; editorul se deschide sub rând. Sub 980 px de document, fiecare poziție
e un card cu aceleași câmpuri. Bara de deasupra: filtrele în stânga, „Mod de
afișare: Fișierul clientului / Ca în ofertă” în dreapta, o pereche de mărimea
tipului ofertei din antet (măsurat: 176 × 44, aceeași poziție). Lista de carduri
veche („Arată ca listă”) a ieșit.

**Tot pe 14 octombrie, după prima privire a lui Andrei:** vederea implicită e
„Fișierul clientului” (prima în pereche), grila de mai jos, cu taburile foilor.
Descrierea se vede întreagă, fără „Tot textul”: e primul lucru la care se uită
omul. Coloanele noastre au lățime fixă (rândul 44 px, „Am înțeles · preț” 230,
„Stare” 214, cât „Confirmă” și „Modifică” pe un rând), iar coloanele clientului
împart restul: „Stare” stă lipită de marginea din dreapta, iar verificarea ia
toată lățimea ecranului (`main:has(.imp-vedere)`). Descrierea primește cel mai
mult (al treilea sfert al lungimilor, între 40 și 90, mai puțin când foaia are
multe coloane), observațiile și celelalte texte cel mult 16: înainte, coloana
de observații era cât jumătate din descriere. Sub 1100 px de import, fiecare
rând din fișier devine card, cu numele coloanei deasupra fiecărei valori
(`data-eticheta`), descrierea pe toată lățimea, celulele goale ascunse.

**21 octombrie 2026 (Andrei: „UI-ul e îngrozitor”, apoi „prefer view-ul pe
coloane ca în Excel”):** pasul 2 are două taburi. **„Verificare”**
(`web/import/verificare-vizual.ts`) e un tabel: Rând, Descrierea clientului,
Izolație, Grosime, Protecție (cu grosimea tablei în aceeași listă), Diametru
(DN / Ø / Di + valoare), Piesă, UM, Cantitate, Preț unitar, Total, Stare; toate
casetele de 44 px pe linia rândului, cu „Confirmă” (doar la „De verificat”) și
✕ în coloana stării. Fără „Mai mult”, fără rândul de explicații. **Descrierea e
celula din fișierul clientului** (`scrieDescrierea` în `import.ts`, coloana ei
hotărâtă o dată pe foaie): la fiecare tastă rândul se recitește și se
retarifează (DN100 → DN50 schimbă diametrul, grosimea uzuală și prețul); un text
pe jumătate care nu mai e poziție nu se aplică până nu redevine una. Casetele
schimbate fac poziția a omului (`patchDinCamp`). Sub 1240 px de tabel rândul
devine card. **„Cum iese oferta”** (`exportPeEcran`): Excelul de acum, doar
citire, fără logo și fără filtre. Foaia clientului ca în Excel a ieșit.

**Tot pe 21, noaptea:** „Total” a ieșit din „Verificare” (e în „Cum iese
oferta”; descrierea avea 190 px la 1440). UM-ul e listă (`data-um`, ml / buc /
m² plus valoarea clientului) când rândul are celulă de UM, scrisă ca
descrierea (`scrieUm`). Straturile de izolație de sub jachetă stau sub primul,
în `.ver-straturi` (`strat0` / `stratg0` în `patchDinCamp`). Câmpul „În atenția
(cu d-lui sau d-nei)” se scrie în ofertă cum e scris.

## Ecranul de import: trei pași

Refăcut pe 13 septembrie 2026 pentru oamenii care îl folosesc — birou și
șantier, nu IT — după ce varianta cu grila 1:1 a fost găsită „prea încărcată".
Principiul: ce trebuie făcut se vede din așezare, nu dintr-un text explicativ.

```
① Fișierul        ② Verificare        ③ Oferta
```

- **Pasul 1 — Fișierul.** Tipul ofertei (Rezidențială / Industrială, radio
  adevărat) și un singur buton mare, „Alege fișierul Excel", care e și zona de
  drag&drop; pe ecranele doar tactile „sau trage-l aici" nu apare. Importurile
  recente stau alături pe ecran lat, dedesubt pe telefon, cu „Deschide" și
  „Șterge"; ștergerea cere a doua apăsare („Sigur ștergi?").
- **Pasul 2 — Verificare.** Fișierul (cu „Schimbă fișierul") și tipul ofertei,
  apoi patru filtre: Toate · Gata · De verificat · Fără preț. Grupurile sunt
  disjuncte și sunt exact foile registrului (`imparte`). Sub „De verificat" și
  „Fără preț" apare al doilea rând, pe motiv („Lipsește grosimea 24").
- **Registrul cu mai multe foi** (25 septembrie 2026, `baraFoi`): foile stau
  ca taburi, ca jos în Excel, în locul butoanelor de stare. Starea devine un
  dropdown în dreapta („De verificat · 14"), lângă butonul „Arată ca listă".
  Se deschide prima foaie cu poziții. Fiecare tab poartă câte poziții cer
  atenție pe foaia lui — pe ecran e o singură foaie, iar ce e de făcut pe
  celelalte nu are voie să dispară din vedere. Numele foii nu se mai repetă pe
  carduri și deasupra tabelului: e deja în tab. Cu o singură foaie rămân
  butoanele de stare. Așezarea e o grilă ~70 / 30: taburile curg pe câte rânduri
  e nevoie în stânga, controalele stau în dreapta, aliniate cu primul rând; când
  30% nu mai ajunge pentru amândouă, butonul coboară sub dropdown. Sub 620 px de
  ecran de import, o singură coloană. Dropdown-ul și butonul sunt o pereche de
  aceeași mărime (`--imp-control`, 11rem × 44 px); săgeata dropdown-ului e
  desenată de noi, fiindcă cea nativă nu stătea la margine.
- **Antetul verificării și bara foilor sunt două carduri** pe aceeași grilă
  (`--imp-coloane`: ~70 / 30, cu coloana din dreapta niciodată mai îngustă
  decât o pereche de controale). Antetul: fișierul, cu data și „Schimbă
  fișierul” sub nume; în dreapta „Tip ofertă”, două butoane de mărimea
  perechii de dedesubt. Bara foilor: „Foile din fișier · cifra arată câte
  poziții cer atenție pe foaie” deasupra taburilor, „Arată pozițiile” deasupra
  dropdown-ului, „Mod de afișare” deasupra butonului. Butoanele din dreapta ale
  celor două carduri cad unul sub altul, la pixel. Pe ecranul de start tipul
  ofertei rămâne cu pastile.
- **În listă, fiecare poziție e un card**: textul clientului (tăiat la trei rânduri, cu
  „Tot textul"), rândul din Excel, cantitatea, ce am înțeles („Vată minerală
  50 mm · rândul 114", „+ Tablă aluminiu · rândul 220", „DN100 = ø114,3",
  „flanșă"), prețul, starea cu motivul în
  cuvinte simple, și acțiunea care o rezolvă:
  gata → „Modifică"; de verificat → „Confirmă"; fără preț, cu grosime uzuală →
  „Pune 100 mm". „Modifică" deschide corectura sub card: descrierea (celulele cu
  text ale rândului, cu „Citește din descriere"), material, diametru (DN / Ø /
  Di), grosime cu sugestiile listei, formă, **celelalte straturi** — fiecare cu
  material și grosime, cu „Adaugă strat" și „Scoate" — sau dimensiunile golului,
  plus cantitatea și UM-ul; „Nu e izolație" scoate rândul din listă. Grosimea
  tablei are sugestiile ei (aluminiu 0,6 / 0,8 / 1,0, inox 0,4 / 0,5 / 0,6):
  fără ele, o poziție de inox nu se putea tarifa din ecran. Sub diametru scrie
  în ce se traduce: „ø114,3 după tabelul de conversie · rândul 114 din listă".
- **Conversia se vede, nu se presupune** (16 septembrie 2026). Ecranul scria
  doar notația clientului, deci „DN100" și „Ø100" arătau la fel, deși unul
  caută ø114,3 și celălalt ø100 — alt rând, alt preț. Acum eticheta e
  „DN100 = ø114,3", iar fiecare strat își poartă rândul din listă pe care a
  căzut prețul lui. La Ø și Di nu se adaugă nimic: acolo cifra scrisă *e*
  diametrul căutat.
- **Corectura e un panou, nu un formular lipit de rând** (16 septembrie 2026).
  Câmpurile stau într-un singur flux care se așază după lățime — o coloană pe
  telefon, patru pe ecran lat — în loc de două coloane fixe, care lăsau
  „Material" singur în stânga cu un gol cât tot blocul de sub el. Celulele cu
  text își iau numele coloanei din antet, sau litera ei („Coloana B") când
  foaia n-are antet: două celule pe același rând arătau amândouă „Descriere".
- **Prețul pus de mână** (25 septembrie 2026): ultimul câmp din editor,
  „Preț unitar pus de mână (€)”, gol = prețul din listă. Pentru ce nu acoperă
  listele — distribuitorul de abur, livrarea țevii cu izolația inclusă,
  protecția la foc a tubulaturii — care altfel n-aveau niciun drum spre foaia
  `Ofertă`. Poziția trece „Gata”, cardul scrie „preț pus de mână”, iar nota
  păstrează ce dădea lista. Se ține separat de extragere
  (`OptiuniNucleu.preturiManuale`, salvat în istoric), deci doar prețul
  schimbat nu face din rând o corectură și nu învață șabloane. Registrul
  listează rândurile cu preț pus de mână în „Cum a fost calculată oferta”.
  Verificat în browser: cererea TRANSAVIA + distribuitorul la 2.296,70 +
  „Confirmă toate cele 13” dă în pasul 3 exact 94.575,06 €, totalul Ofertei
  284. Editorul, cu câmpul nou, fără derulare laterală la 390–1920 px, în
  ambele teme, în listă și în foaie. Tot atunci: în editorul deschis în foaie,
  `.tabelwrap select { min-width: 13ch }` împingea cifra diametrului sub
  „Grosime”; `min-width: 0` pe notația diametrului.
- **Acțiunile în masă apar doar sub filtrul lor**: „Pune grosimea uzuală la N
  poziții" (le trimite la „De verificat", nu le confirmă) și „Confirmă toate
  cele N". Nu există confirmare pe tot fișierul.
- **Orice acțiune se poate anula**: un mesaj jos, șapte secunde, cu „Anulează".
  Tiparul unei corecturi se învață (L4) abia după ce anularea nu mai e
  posibilă — învățat pe loc, memoria ar fi pus rândul înapoi cum îl corectase
  omul. Grosimea uzuală pusă cu un clic nu se învață deloc: n-a scris-o clientul.
- **Descrierea schimbată după verificare nu lasă prețul vechi** (15 septembrie
  2026). Până atunci o poziție confirmată sau corectată nu se mai recitea:
  scoasă tabla din descriere, rămânea „Gata" la 45,24 €/ml. Acum se recitește
  din textul nou, trece la „De verificat", iar mesajul oferă „Anulează", care
  pune înapoi și textul. În editor, „Salvează" cu descrierea schimbată și
  câmpurile neatinse recitește la fel; cu câmpurile atinse sau recitite, e
  corectura omului.
- **Vederea implicită e foaia ca în Excel** (`web/import/grila.ts`, cerută pe
  13 septembrie 2026): aceleași rânduri, coloane și numere de rând ca în
  fișier, cu celulele editabile. După coloanele clientului: ce am înțeles,
  prețul, starea și butonul care rezolvă rândul; corectura se deschide pe un
  rând sub poziție. Filtrele ascund rândurile fără să schimbe numerotarea.
  „Arată ca listă" trece pe carduri, mai ușor de citit pe telefon.
- **Antetul documentului** — rândurile de deasupra tabelului: titlul ofertei,
  numărul, beneficiarul — nu mai stă ca rânduri lipite una sub alta
  (`antetDocument`). Cea mai lungă linie scrisă cu majuscule e titlul;
  perechile „Etichetă : valoare", sau două celule pe rând, devin plăcuțe
  aliniate în grilă; restul, o linie de detalii.
- **„Detalii despre citire"**, pliat la final: foi cu coloane recunoscute,
  rânduri cu text, titluri, cât s-a citit din reguli, automat sau din corecturi.
- **Pasul 3 — Oferta**, deschis din pașii de sus (fără bară lipită jos: dubla
  butonul de pas și acoperea ultimul rând). Ce intră (valoare, poziții, tip) și ce rămâne afară, cu
  drum înapoi la verificare; datele ofertei pe două coloane; „Descarcă oferta".

Ecranul **nu mai spune cu ce model** citește rândurile nerecunoscute — cerut
explicit pe 13 septembrie 2026. Modelul rămâne scris în importul salvat
(`SesiuneImport.model`) și în proveniența registrului de ofertă.

### Așezarea, pe orice ecran

- **Un singur marcaj, gândit întâi pentru telefon.** Lățimile se decid pe
  lățimea ecranului de import (container queries), nu a ferestrei: cu bara
  laterală deschisă sau pliată, aceeași fereastră lasă loc foarte diferit.
  Praguri: 620 px (cardul pe două coloane, butoanele în dreapta, filtrele pe un
  rând) și 1000 px (cardul devine rând: text · înțeles · stare · preț · acțiuni).
- **Un singur spațiu între containere**, `--imp-gap` (16 px): între blocuri,
  între carduri și în interiorul lor. Un rând fără butoane nu se randează, ca
  să nu lase un gol mai mare decât celelalte.
- **Filtrele trec pe rândul următor**, nu se derulează lateral: un buton tăiat
  la margine nu spune că mai e ceva în dreapta. Pe telefon stau două câte două.
- Ținte de minimum 44 px; câmpuri de 16 px, ca iOS să nu mărească pagina la
  focus.
- **Foaia încape pe lățimea ecranului, fără derulare laterală** (25 septembrie
  2026). `table-layout: fixed`, cu lățimile din `<colgroup>` calculate de
  `grilaFoaie`: numărul rândului, „Am înțeles · preț” și „Stare” (cu butoanele
  pe un rând) au procente fixe; restul se împarte coloanelor clientului după
  mediana lungimii pe rândurile de poziție, iar descrierea e plafonată — ea se
  rupe pe rânduri, prețul și butoanele nu. Coloanele goale pe toată foaia nu se
  desenează (Flower City: 7 din 16). Sub 1000 px lățime de ecran de import,
  fișierul se deschide ca listă de carduri. Verificat cu Playwright pe cele 10
  fișiere de client la 390, 1024, 1280, 1440 și 1920 px: zero derulare laterală,
  butoanele pe un rând de la 1280 în sus.
- Verificat în browser la 360, 390, 768, 1024, 1440 și 1920 px, în temă
  deschisă și închisă: fără derulare orizontală, fără ținte sub 40 px, fără
  erori în pagină, fluxul complet până la registrul descărcat.

### Cuvintele

`web/import/text.ts` traduce codurile interne: niciun `grosime_ambigua`,
„sistem" sau „ø" fără unitate pe ecran. Motivele de verificare vin ca valori
(`motiveDeVerificat` pe rezultatul tarifării: segment diferit, rotunjire
neconfirmată, grosime propusă), nu citite din textul notelor. Registrul de
ofertă păstrează etichetele lungi din `web/validare.ts`, cu întrebările către
firmă.

Tot marcajul stă în funcții pure (`web/import/vizual.ts`). Aspectul se
verifică în browser; testele (`tests/ecrane.test.ts`) țin doar ce nu are voie
să se strice: textul clientului nu poate injecta HTML.

### Ieșirea: registrul de ofertă

Până acum nu ieșea **nimic** din aplicație — importul se oprea într-o grilă, iar
munca de validare rămânea în browser. Pasul 3, „Oferta", are un formular de antet (firmă emitentă, număr, dată, beneficiar,
obiectiv, persoană) și descarcă un `.xlsx` cu **trei foi**:

- **`Ofertă`** — doar pozițiile cu preț **și** nemarcate. Totalul e doar aici.
  Layoutul copiază oferta 284 reală.
- **`De validat`** — au preț, dar prețul e o propunere, cu motivul pe coloană.
- **`Netarifate`** — fără preț, cu **eticheta umană** a cauzei și cu întrebarea
  deschisă, nu cu textul brut al erorii.

Foaia 1 e ce se trimite. Foile 2–3 fac golurile **imposibil de ratat** — exact
opusul situației de dinainte, unde dispăreau din vedere.

`.xlsx`, nu PDF: toate cele patru oferte semnate din `attachments/clienti/` sunt
`.xlsx`, deci ăsta e formatul pe care firma îl trimite azi. ExcelJS e deja
dependență și rulează deja în browser la citire, iar scrierea trece prin același
`await import(...)`, deci cele ~940 kB rămân un chunk separat.

Împărțirea pe îndelete: `web/oferta.ts` e **pur, fără DOM** — primește linii,
întoarce un `ArrayBuffer` — exact ca motorul, și din același motiv: se testează
în Node. `tests/oferta.test.ts` verifică pe `oferta-118-1-matari-goluri-foc.xlsx` că
totalul iese **12.692,04 €**, adică exact totalul ofertei semnate. `Blob`,
`createObjectURL` și `<a download>` stau singure în `web/descarca.ts`, un singur
loc, ca să nu se împrăștie o secvență în care se uită ușor `revokeObjectURL`.

Registrul poate purta și **discount**, ca ofertele reale: `TOTAL LUCRARI`,
`DISCOUNT n %` (valoarea reducerii, nu procentul) și `TOTAL GENERAL`, structura
ofertei 284. Toate trei trec prin `bani()` — în fișierul semnat scrie
`2837.25189` și `91737.81111`, cinci zecimale într-un document trimis
clientului. Fără discount, registrul are un singur rând de total, ca înainte.

Registrul poartă, la subsolul foii 1, **cum a fost calculat**: data generării,
destinația listelor, snapshot-ul de model, fișierul sursă și `id`-ul sesiunii de
import. Regula 3 din `arhitectura.md` — prețul se copiază în document, nu se
referențiază — aplicată la ce avem: peste un an, întrebarea „de unde a ieșit
13,74 pe rândul ăla?" trebuie să aibă răspuns în fișierul însuși.

**Confirmarea acționează pe pozițiile cu preț și marcate care se văd** sub
filtrul curent, pe foaia activă, iar butonul spune asta („Confirmă cele 24 de
poziții de mai jos"). Apare doar sub un filtru: nu există „confirmă tot
fișierul", care ar bifa poziții pe care omul nu le-a avut pe ecran. O poziție
fără preț nu se confirmă — ar rămâne fără preț, doar fără marcaj.

**Confirmarea nu învață șabloane.** `invataDinCorectie` intră în memoria care
rezolvă importurile viitoare; o confirmare în masă spune doar „am văzut și e
bine", nu „ăsta e tiparul corect". Dacă ar învăța, un click pe 40 de linii ar
propaga tăcut 40 de tipare peste toate proiectele următoare — exact ce
interzice `memorie.ts`, unde se învață numai din corecția umană explicită,
linie cu linie.

**Are anulare, un nivel.** O acțiune în masă fără drum înapoi e o capcană: omul
confirmă foaia greșită și pe urmă nu mai poate deosebi liniile alea de restul —
toate arată la fel. Un nivel ajunge; instantaneul dispare la următoarea
confirmare sau la schimbarea fișierului.

Ce se întâmplă în spate: confirmarea pune `sursa: "om"` pe linie. Nucleul
tratează asta ca pe o corecție umană — nu o mai re-extrage niciodată în
`reevalueaza` și nu o mai trece prin guardrails, fiindcă `valideaza.ts` există
ca să verifice **modelul**, nu omul care se uită direct la fișierul sursă. Se
salvează de la sine în istoric: `SesiuneImport.extrase` ținea deja `sursa` per
linie, deci confirmarea supraviețuiește reîncărcării fără câmp nou.

Logica — ce intră într-un filtru, ce se confirmă, ce se anulează — stă în
`web/validare.ts`, nu în handlere: același motiv ca la `invataDinCorectie`, cod
riscant care fără test nu se verifică. Ecranul rămâne cu apeluri simple.

## Materiale: trei file (21 octombrie 2026)

Andrei: „nu înțeleg nimic din ce se întâmplă acolo, prea mult scris, prea
multe butoane, tabele”. „Necesar și depozit” avea, cu datele de demo, 16.000 px,
172 de butoane, 102 câmpuri și 10 carduri; „Comenzi la furnizori” era alt
ecran în meniu. Acum, în meniu, un singur „Materiale”, cu trei file
(`fileMateriale` din `web/stoc-vizual.ts`, linkuri, deci adresa și „Înapoi”
merg). Fiecare filă răspunde la o întrebare și are un buton albastru. Macheta
aprobată: canvasul „Plan: Materiale simplu”. Secțiunile despre „Depozit și
stoc” și „Comenzi” de mai jos sunt istoric: calculele și formularele lor au
rămas, s-a schimbat locul.

| Fila | Ruta, fișierul | Ce e pe ea |
|---|---|---|
| **De cumpărat** | `#/materiale` (`#/stoc` alias), `web/ecrane/stoc.ts` | Doar șantierele deschise. Pe fiecare: o propoziție („14 materiale: 13 lipsesc, 1 e comandat și vine.”), tabelul Material · Trebuie · Adus pe șantier · Stare („Lipsește 271,8 ml”, „Comandat, vine 630 m²”, „În ciornă, de trimis”, „Are tot”, „Îl dă clientul”), „Schimbă lista” și **„Comandă ce lipsește”**. Fără bani: costul și „În ofertă” sunt pe pagina șantierului (1.129 px, 2 butoane pe TRANSAVIA) |
| **Comenzi** | `#/comenzi`, `web/ecrane/comenzi.ts` | Trei grupuri: De trimis, Așteptăm marfa, „Primite și anulate · N” (strânse). Un rând pe comandă (furnizor · șantier, starea „trimisă acum 9 zile”, ce s-a cerut) cu „Detalii” și un buton: **„Trimite comanda”**, **„A venit marfa”** sau **„A venit factura”**. Recepția: documentul, numărul, data și cât a venit; seria, moneda, cursul, transportul și alt loc sub „Alte date de pe document” |
| **Depozit** | `#/depozit`, `web/ecrane/depozit.ts` | Pastilele locurilor (central, atelier, șantierele deschise cu material), tabelul Material · Cât e și **„Mută material”** (unde, apoi cât, pe rând). În atelier, tabla pusă deoparte cu „Trimite pe șantier” |

- **„Comandă ce lipsește”** ia întâi din alte locuri (`propuneriDinDepozit` în
  `src/stoc/comenzi.ts`: din fiecare loc cel mult cât mai lipsește, fără
  șantierele închise, unde trigger-ul refuză mutarea, și fără resturi sub
  0,05), fiecare cu bifă, apoi arată ciornele pe furnizorul obișnuit, cu „Alt
  furnizor” (prețurile se iau de la el). Ciornele se socotesc după mutările
  bifate. Butonul mută și face ciornele, apoi deschide Comenzi. Înainte,
  „Material care există deja” era un tabel separat, iar „Fă comenzile”
  comanda și ce era în depozit.
- **„Schimbă lista”** deschide ce era pe necesar: cantitatea scrisă ca în
  Excel, „Îl dă clientul”, ✕, șantierul legat, pierderile, materialul de mână,
  „Pune la loc lista calculată”, „Scoate toată lista”; „Gata” închide.
- **Mai multe** (`#/depozit/mai-multe`, câte o pagină `#/depozit/<ce>`, codul
  vechi neschimbat): Am numărat (inventarul), Trecut de mână (stoc de pornire,
  intrare fără comandă, consum, retur), Istoricul (jurnalul și drumul
  materialului), Pus deoparte în atelier, Cine răspunde de fiecare loc,
  Ambalaje. Routerul (`ruta` în `main.ts`) ia doar ce e înainte de al doilea
  „/”; itemul „Materiale” din meniu rămâne aprins pe toate filele (`IN_MENIU`).
- Funcțiile comune (locurile, șantierele deschise, rămas de comandat, cifrele
  de pe file) stau în `web/materiale.ts`.

Verificat cu Playwright pe `build:server`, cu datele `npm run demo` într-o bază
separată: 390 / 768 / 1280 / 1440 / 1920 px, ambele teme, toate filele și
paginile de sub „Mai multe”, zero derulare laterală, nicio țintă sub 40 px,
zero erori. Fluxul: Comandă ce lipsește (40 ml ø114 din central, Isoline și
Banda Tech schimbat pe STEELMET), Trimite comanda (emailul se vede), A venit
marfa (aviz, apoi „A venit factura”), Mută material (10 ml ø140 în central,
apoi „Lipsește 10 ml” și propunerea din central), Schimbă lista; totul rămâne
după reîncărcare.

## Depozit și stoc (prototip, 28 septembrie 2026)

**9 octombrie 2026, Faza 2.** Cardul „Materiale de comandat” din pasul
„Oferta” nu mai are rezervă: are „Tuburi până la” (3 țoli … toate în tuburi) și
pierderile la croit pe tablă, plăci și tuburi; coloanele sunt „Se comandă” (cu
kg la tablă), „Metri de țeavă” și „Din piese” (câte piese au intrat în metri,
câte pe regulă presupusă). Se redesenează doar cardul (`redeseneazaNecesar`, cu
gardă: înlocuit cât un câmp are focus, `change`-ul vine a doua oară). În
„Depozit și stoc”, pe necesar: „De comandat” rotunjit la ambalaj („16 × cutie,
192 m²; rămân 10,64 m² în depozit”) sau cu kg la tablă; pe fiecare rând „Îl dă
clientul” / „Îl cumpărăm noi”, iar rândurile adăugate de mână au „Scoate”; sub
tabel, „Adaugă material de mână” (pliat). Card nou „Ambalaje” (material,
ambalaj, cât conține). În „Mișcare nouă”, la intrare, „Marcă (opțional)”.

`web/ecrane/stoc.ts`, în meniu la „Zi de zi”. Logica e în `src/stoc/`, pură și
testată; datele stau în `localStorage` (`web/depozit-local.ts`), deci doar în
browserul care le-a introdus. Ecranul o spune.

- **Stocul e suma mișcărilor** (`solduri`): intrare, transfer, consum, retur,
  ajustare la inventar. Nicio mișcare nu se modifică sau șterge: „Anulează”
  adaugă mișcarea inversă, vizibilă în jurnal. Soldul negativ e marcat, nu
  blocat.
- **Necesarul vine din import.** Pasul „Oferta” are cardul „Materiale de
  comandat” (`cardNecesar` în `web/stoc-vizual.ts`), pe regulile firmei (mai
  jos). Rezerva se schimbă fără să redeseneze pasul, altfel s-ar pierde datele
  ofertei deja scrise. „Creează șantierul” îl salvează (unul pe fișier), pe
  depozitul șantierului nou.
- **De comandat** = necesar − stocul din depozitul central și din șantierul
  legat de necesar. Tabloul de bord îl arată la „Necesită atenția ta”.
- **Stocul pornește gol.** „Încarcă date de exemplu” pune intrări marcate
  „exemplu” (unele materiale acoperite complet, altele pe jumătate), cu banner
  și „Scoate datele de exemplu”, care nu atinge mișcările omului.
- Izolația pe țeavă se ține în ml, tabla, inoxul, PVC-ul și materialul pe
  suprafață în m².

**29 septembrie 2026, după apelul cu firma:**

- Cardul din pasul „Oferta” e „Materiale de comandat”, pe regulile firmei
  (tuburi până la 3 țoli, plăci pe m² peste, coturile în m²; `tevi.md`), cu
  „Se comandă” în unitatea articolului. Rezerva e 0 implicit. Butonul e
  „Creează șantierul”: planul + necesarul, pe depozitul șantierului nou,
  apoi deschide șantierul în Lucrări. Refăcut din același fișier, înlocuiește
  planul — doar cât nu are situații.
- Pasul „Oferta” are „Ajustare prețuri (%)”; suma de sus se schimbă la fiecare
  tastă, fără redesenare (s-ar pierde datele scrise), iar sub ea scrie ce
  include (ajustarea, +20 % pe foc).
- Depozitul: șantierele din oferte sunt depozite; intrarea de la furnizor are
  preț de achiziție, în euro (cursul nu e încă în aplicație). Fiecare necesar are „Cost achiziție” (media
  intrărilor cu preț) și „În ofertă” (valoarea stratului din listă, cu
  manoperă), plus ce rămâne pentru manoperă și profit.

**2 octombrie 2026:** necesarul se face doar din pozițiile care intră în ofertă
(aceleași linii ca planul de șantier), nu din tot importul: pozițiile „De
verificat” primeau materiale pentru lucrări care nu erau în plan. „În ofertă”
e cât plătește clientul: valoarea liniei, cu ajustarea tehnicului și
discountul, împărțită pe straturi după prețul lor din listă (TRANSAVIA, +10 %
și −3 %: 80.676,12 €, la un ban de totalul ofertei). Marja se socotește doar
pe materialele care au preț de achiziție. Piesele fără regulă de material
(flanșe, casete, coturi sub 3 țoli) apar sub necesar ca „+ N buc.” și nu intră
în „De comandat”; un rând care are doar piese e „de stabilit”, nu „acoperit”.

## Comenzi la furnizori (11 octombrie 2026)

`web/ecrane/comenzi.ts`, în meniu după „Depozit și stoc”. Logica în
`src/stoc/comenzi.ts`, datele prin operațiile din `web/date.ts` (`puneComanda`,
`trimiteComanda`, `receptioneaza`, `treceFactura` …), nu prin `scrieDepozit`.

- **Depozit și stoc**, pe fiecare necesar: „Adus pe șantier”, „Comandat,
  nesosit”, „Rămas de comandat” (la ambalaj întreg; „ca în evidența de
  cumpărări” când ambalajul e cel implicit). Dedesubt, „Material care există
  deja”: centralul și surplusul altor șantiere, cu „Mută … pe șantier”.
  „Fă comenzile pentru N materiale” face ciornele și deschide Comenzi.
- **Comenzi**: filtru Deschise / Toate (deschisă = are ceva de primit sau un
  aviz fără factură). Ciorna: cantitate pe linie (tabla și în kg), „Scoate”,
  furnizor, notă; „Trimite comanda”, „Salvează ciorna”, „Șterge ciorna”.
  Trimisă: textul de email (cu „Copiază textul”) și „Descarcă Excel”, apoi
  „Recepție” (aviz sau factură, serie, număr, dată, monedă, curs, transport,
  unde a ajuns, primit și preț pe linie; tabla la kg) și, pe fiecare aviz fără
  preț, „Trece factura”. Anularea cere a doua apăsare. Jos: comandă nouă de
  mână (cu motiv pe un șantier) și „Descarcă evidența”.
- Cardul „Materiale de comandat” din import: pierderi și la saltele, plus
  pastilele „Peste prag, comandă tot tuburi la ø114 · ø140 …”.
- `.imp-formular-butoane` are acum spațiu între butoane și se rupe pe rânduri;
  câmpurile numerice din tabele au 11ch.

Verificat cu Playwright: server și demo, 390 / 768 / 1440 / 1920 px, ambele
teme, zero derulare laterală.

**11 octombrie 2026, după-amiază.** Pe ciornă, coloana „Preț fără TVA”
(câmp + lei / €, sursa dedesubt: „lista K-Flex ST, 24.06.2026”, „factura … din
…”, „scris de mână”, sau cine are preț când furnizorul ales n-are) și
„Valoare așteptată” sub tabel; schimbarea furnizorului ia prețurile de la el.
La recepție și la „Trece factura”, sus, zona „Citește avizul / factura din
poză sau PDF” (`.imp-drop`, mai mică): completează formularul, iar sub ea scrie
ce s-a completat și ce nu e pe comandă; fișierul se atașează la înregistrare și
apare pe card („Atașate: avizul CS 20261262 · factura …”). Fără model pe server
zona doar atașează; pe linkul demo nu apare. Prețul așteptat stă ca placeholder
în câmpurile de preț, nu ca valoare. „Retur la furnizor” (pliat) pe comenzile
cu marfă primită; tabelul capătă coloana „Returnat”.

## Depozit și stoc: locurile, atelierul, drumul (Faza 5, 11 octombrie 2026)

Trei carduri noi, în ordinea ecranului: „Atelierul” (după „Stocul pe
depozite”: ce e pus deoparte pe șantier, cu „Trimite pe șantier”, și pliat
„Trimite material la atelier”), „Drumul materialului” (după „Mișcare nouă”:
material + șantier, tabelul pașilor) și „Locurile” (înaintea jurnalului: loc,
firmă, responsabil scris direct în tabel, salvat la `change`). „Mișcare nouă”
spune sub câmpuri când transferul e între firme. Jurnalul marchează „între
firme” și „pentru șantierul X” la tabla trecută în atelier.

## Depozit și stoc: pornirea, inventarul, evidența (Faza 8, 11 octombrie 2026)

- **„Mișcare nouă”** are tipul „Stoc de pornire: era deja în depozit” (implicit
  cât depozitul e gol): aceleași câmpuri ca intrarea, dar șantierele nu se pot
  alege (opțiunile lor se ascund), prețul gol înseamnă „ultimul preț cumpărat,
  din evidență”, iar dedesubt un rând spune ce e și că intră doar șantierele
  noi. „Ajustare la inventar” a ieșit din listă: o face cardul „Inventar”.
- **Cardul „Inventar”** (după „Stocul pe depozite”): locul numărat, tabelul
  Material · Ce arată aplicația · Ce ai numărat · Diferența (se schimbă la
  fiecare tastă, fără redesenare), „Alt material găsit la numărat”, motivul
  (listă cu „alt motiv…”, care deschide un câmp), „Cine a numărat”, „Trece
  inventarul”. După: un rând „Trecut” cu câte ajustări, câte la fel, câte
  nenumărate au rămas.
- **Jurnalul**: „Stoc de pornire” în loc de „Intrare de la furnizor”; la
  ajustări „motiv: …” și plusul pe cantitate.
- **„Locurile”**: pe fiecare șantier „Descarcă evidența” (`web/evidenta-santier.ts`).
- Pe server, locurile sunt doar centralul, atelierul și șantierele din oferte;
  șantierele din datele firmei rămân pe linkul demo.
- Starea goală a „Stocul pe depozite” trimite la stocul de pornire.

Verificat cu Playwright pe server și pe demo: 390 / 768 / 1440 / 1920 px,
ambele teme, zero derulare laterală, zero erori.

## Măsurători: „Pentru comanda de material” (11 octombrie 2026)

Al treilea scop, lângă ofertă și situație: alegi șantierul, încarci pozele,
le verifici, apoi „Fă ciornele comenzii”. Se deschide Comenzi, cu ciornele noi
(nota spune din ce măsurători vin). Dacă nimic nu trebuie comandat, mesajul o
spune sub buton, cu câte rânduri n-au dat material.

## Import: „Izolația pe foaie” (11 octombrie 2026)

Un fișier fără nicio poziție de izolație, dar cu liste de țevi (CET
Constanța), nu mai cade pe „nu are poziții”: pasul 1 arată câte un card pe
foaie (`web/import/izolatie-vizual.ts`), cu ce s-a găsit („4 țevi · 10 coturi,
teuri, reducții · 4 robineți și flanșe · 5 rânduri care nu se izolează”) și
alegerea izolației. Câmpurile apar doar când contează (fără izolație = un
singur câmp; temperatura doar la „la cald”, mm doar la „aceeași grosime”), fără
redesenare. „Fă lista de izolații” scrie registrul și îl importă ca pe orice
fișier; „Alt fișier” se întoarce la start. Bifele din `.imp-campuri` au
eticheta pe același rând și ținta de 44 px.

## Lucrări: șantierele din oferte (29 septembrie 2026)

`web/ecrane/lucrari.ts`; logica în `src/lucrari/situatii.ts`, datele în
`web/lucrari-local.ts` (browser, ca depozitul); Excel-ul în `web/situatie.ts`.

- Lista: șantierele din oferte (valoare, executat, câte situații), apoi
  lucrările-exemplu din datele firmei.
- Un șantier: cifrele sus (valoare ofertă, executat cumulat, situații,
  materiale de comandat), formularul de situație, istoricul, planul.
- Situația nouă: câte un câmp pe poziție, „Executat înainte” din situațiile
  precedente, totalul se schimbă la fiecare tastă. „Tot restul” completează
  pozițiile goale cu ce a rămas din ofertă. Peste cantitatea ofertată se poate,
  dar e marcat „peste ofertă”. Se șterge doar ultima situație.
- Pe telefon numărul poziției e lipit de denumire, ca textul să aibă lățimea.

## Lucrări: materialul pe șantier (Faza 6, 11 octombrie 2026)

Pierderea și consumul de mână stau în cardul „Materialul șantierului” al Fazei
7 (unite pe 12 octombrie 2026: erau două carduri cu necesar, venit și rămas
repetate). Marcajul Fazei 6 e în `web/consum-vizual.ts` (`randPierdere`,
`celulaPierdere`, `formularConsumMana`), logica în `src/stoc/consum.ts`: coloana
Pierdere (cantitate, procent, „peste 10 %”), deasupra tabelului pierderea pe tot
șantierul, după valoare, cu „peste prag” (fără situații: consumul se scrie
singur la fiecare situație), iar sub cost, pliat, „Notează consum de mână”
(material, cantitate, notă), din stocul șantierului. Șantierul închis nu-l mai
are.

Situația salvată și cea ștearsă trec prin `salveazaSituatie` /
`stergeUltimaSituatie` din `web/date.ts` (operații, nu diferența de stare): după
salvare, sus, ca informație (nu alertă), „Situația a scris consumul pe N
materiale”. „Materiale de comandat” din cifrele de sus e acum „rămas de
comandat”, ca în Depozit. În Tablou, la „Necesită atenția ta”: „Pe șantierul X
s-a consumat cu N % mai mult material decât arată situațiile (normal până la
10 %)”. În jurnalul din Depozit, consumul din situații n-are „Anulează”: se
anulează ștergând situația.

## Lucrări și tablou: închiderea șantierului (Faza 7, 11 octombrie 2026)

Marcajul în `web/inchidere-vizual.ts` și `web/rapoarte-vizual.ts` (pure,
testate); fără clase CSS noi.

- **Pagina șantierului**, după antet: cardul „Materialul șantierului” (S9):
  material, necesar, comandat, venit, pus, rămas, lipsește; dedesubt suma ca la
  situație: „Costul materialului, până acum”, cu procentul din „În ofertă”.
- După situații: „Închide șantierul” (pliat). Tabel: material, în registru,
  numărat (câmp, implicit cât e în registru), unde pleacă (select: depozitul
  central, atelierul, celelalte șantiere deschise; „Înapoi la <furnizor>” pentru
  cei care l-au adus; pierdut, furat, reciclat). Deasupra, „De știut”: tabla
  pusă deoparte în atelier pentru șantier și comenzile care n-au venit toate.
  Prima apăsare verifică și cere confirmarea („Sigur închizi șantierul?”), a
  doua închide; orice schimbare în formular cere din nou confirmarea. Pe
  telefon select-ul are `width:100%; min-width:0` în linie (altfel `min-width:
  13ch` din tabele îl scotea din rând).
- **Închis**: în locul cardului de material, „Șantier închis pe …”, cu
  „Materialul a costat X €”, procentul din ofertă, cât din cost e pierdere, și
  tabelul pe material (venit, pus, înapoi sau mutat, la furnizor, pierdut sau
  lipsă, cost). Dispar „Situație nouă”, ștergerea situației și a șantierului.
  În listă, șantierul are eticheta „închis”.
- **Tabloul**: „Necesită atenția ta” primește lipsa pe șantier și comenzile
  nevenite de 7 zile și pierderea peste 10 % a Fazei 6; carduri
  noi „Ultimele 7 zile pe șantiere” și „Șantiere închise”. Banii ascultă de
  `vedeCosturi()`.

## Măsurători: notițele din carnet (29 septembrie 2026)

`web/ecrane/santier.ts` (ruta `#/masuratori`; `#/santier` e alias), marcajul în
`web/santier-vizual.ts` (pur, testat). Detaliile de logică în `santier.md`.
Pagina se numea „Șantier”; redenumită pe 3 octombrie 2026, fiindcă pozele de
dinainte de ofertă nu au încă un șantier.

- **Pentru ce sunt măsurătorile** (3 octombrie 2026), primul control de sus:
  „Pentru ofertă” (alături, tipul ofertei) sau „Pentru situație de lucrări”
  (alături, șantierul). Cardul de jos e „Trimite la ofertă”, respectiv „Pune
  în situație”: rândurile se potrivesc pe planul șantierului
  (`src/lucrari/potrivire.ts`), iar Lucrări deschide situația nouă,
  completată, cu cardul „Din măsurători”: câte rânduri s-au pus (pozițiile au
  „din poze” sub cantitate), „De ales” cu un buton pe fiecare poziție posibilă
  („Poziția 22 · rămas 27 ml”, sau zona, când cererea are zone) și „Nu sunt în
  oferta șantierului”. Situația se salvează tot de om. Verificat cu
  Playwright pe TRANSAVIA, 390 / 768 / 1440 / 1920 px, ambele teme: zero
  derulare, zero erori; drumul spre ofertă neschimbat.

- **Lista clientului față de măsurători** (9 octombrie 2026, întrebarea tehnică
  1: firma măsoară și când clientul a trimis o listă). În cardul „Trimite la
  ofertă”, „Compară cu lista clientului (opțional)” alege un import din
  istoric; „Compară” îl reface fără model (`redeschideImport`) și pune sub
  carduri un tabel: poziție, în listă, măsurat, diferență, stare. Sus ce nu se
  potrivește (cantitate diferită, nu s-a măsurat, lipsește din listă), la final
  ce e la fel. Potrivirea e pe amprentă, ca la situații; cantitățile se adună pe
  zone; sub 1 % e rotunjire. Oferta se face tot din măsurători. Verificat cu
  Playwright pe TRANSAVIA + două rânduri scrise de mână, 390 / 768 / 1440 /
  1920 px, ambele teme: zero derulare, zero erori.
- Sus, tipul ofertei și „Alege pozele” (mai multe deodată, câte o poză pe
  pagină de carnet). Fiecare poză devine un card: poza în stânga (lipită sus
  cât derulezi, clic = mare în altă filă), rândurile citite în dreapta, pe
  zone. Sub 900 px de ecran, una sub alta.
- **21 octombrie 2026 (Andrei):** poza nu mai stă mare lângă rânduri: e o
  miniatură lângă titlul paginii („Mărește”), iar clicul o deschide în panoul
  `#sant-mare` (`<dialog>`), cu ✕ în colț, Escape sau clic lângă ea. Rândurile
  sunt un tabel ca „Verificare” de la import (`randEditabil` în
  `web/santier-vizual.ts`): diametru (ø / DN), piesă, izolație, grosime,
  protecție, cantitate, UM, preț dublu, stare; totul se scrie pe
  loc (`legaCelule`, alegerile la `change`), fără „Modifică” și fără editorul
  de sub zonă. Câmpul schimbat scoate rândul din „De verificat”; cantitatea
  diferită de ce s-a citit din poză e galbenă, cu citirea sub mouse. Coloana
  „Pe foaie” („6 + 4 + 2”) a ieșit: citirea scrisului de mână greșea des. Numele zonei se
  scrie pe loc. „Scoate” e ✕ (`.cel-scoate`). Tot pe 21, noaptea: „Scoate pagina” e ✕ în
  antetul paginii; cu rânduri, primul clic întreabă „Sigur scoți pagina?”
  (`deScos`), orice alt clic renunță. Sub 1000 px de tabel rândul
  devine card; cu pagini, ecranul cere toată lățimea. Paragrafele de mai jos
  despre rând și „Modifică” sunt istoric.
- Un rând: „ø60 · Coturi”, straturile pe rândul doi, cantitatea, „Pe foaie”
  (de unde vine suma: „(40 + 1) × 2”) și acțiunile. Doar rândurile care cer
  ochi au stare: „De verificat” (cifră greu de citit, cu „Confirmă”) sau „De
  completat” (lipsește diametrul, cantitatea sau orice strat).
- „Modifică” deschide corectura sub zonă: zonă, diametru (ø / DN), izolație și
  grosime, protecție, ce e, cantitate, preț dublu.
- „Am verificat pagina” e oprit cât mai sunt rânduri marcate. „Trimite la
  ofertă” e oprit cât mai e o pagină neverificată. Trimis, registrul pleacă la
  import (`web/predare.ts`), care îl procesează ca pe un fișier de client.
- Fără rută de model (Pages): pagina e goală, cu „Adaugă rând”, și aceeași
  verificare.

Verificat cu Playwright, cu răspunsurile modelului salvate: 390, 768, 1024,
1440 și 1920 px, ambele teme, cu și fără model. Zero derulare laterală, zero
tabele care derulează, fluxul până la pasul „Oferta”.

## Tabelele pe ecran îngust

`tabel()` din `tip.ts` pune pe fiecare celulă numele coloanei
(`data-eticheta`). Când containerul tabelului e mai îngust de 560 px (900 px la
tabelele cu 6+ coloane), rândul devine card: câmpurile curg câte două-trei pe
rând, cu numele coloanei deasupra valorii. Înainte, pe telefon aproape toate
tabelele derulau lateral în interior. Verificat cu Playwright pe cele 8 ecrane
× 390 / 768 / 1024 / 1440 / 1920 px × două teme × două roluri: zero derulare, de
pagină sau în tabel. Foaia de import (`grila.ts`) are markup propriu și nu e
atinsă.

## Ce rulează în browser și ce nu

Motorul de prețuri și extragerea deterministă rulează integral în browser:
listele de prețuri sunt importate static, iar parsarea Excel are o variantă
care pornește de la conținutul fișierului. Același cod rulează în teste.

Ecranul **nu** afișează modelul (cerut pe 13 septembrie 2026); importul salvat
și registrul de ofertă îl păstrează, pentru cine trebuie să afle de unde a
ieșit o poziție.

Stratul cu model **nu** rulează în browser, dar importul și Măsurătorile îl
folosesc când e disponibil: serverul (`src/server/model.ts`) expune
`/api/extrage` și `/api/poza`, iar ecranele întreabă ruta cu un GET
înainte s-o folosească (POST-ul poartă `X-Izorep`, ca orice scriere). Cu
`npm start` și cheia în `.env`, pipeline-ul e complet; pe Pages ruta lipsește
și ecranele cad curat pe stratul determinist, respectiv pe scris de mână.
Cheia stă în procesul serverului și nu ajunge în pagină.
