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
web/date/seed.ts      datele demo-ului
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
lor și nu manipulează meniul.

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

## Tema

Comutator cu trei stări în bara laterală: **Sistem** (implicit), **Deschis**,
**Închis**. Alegerea se ține în `localStorage` sub `izorep-tema`.

„Sistem" înseamnă absența atributului `data-tema`, nu o a treia paletă — așa
pagina răspunde la schimbarea temei din sistem cât timp e deschisă, fără cod.

Tema se aplică dintr-un script inline în `<head>`, înainte de primul paint. Pusă
în `main.ts`, pagina ar clipi o dată pe tema sistemului la fiecare încărcare.

Tema închisă e scrisă de două ori în CSS, cu aceleași valori: o dată sub
`@media (prefers-color-scheme: dark)` pentru cine n-a ales nimic, o dată sub
`:root[data-tema="dark"]` pentru alegerea explicită. CSS nu poate combina un
`@media` cu un selector de atribut într-o singură regulă — dacă modifici una,
modific-o și pe cealaltă.

## Meniul: șapte destinații, restul pliat

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
68px. Banda ține cele șapte destinații fără derulare, deci nu se pierde nimic.

Logica de preferință stă în `web/meniu-stare.ts`, cu depozit injectabil, ca să
fie testabilă în Node (`tests/meniu-stare.test.ts`). Ca la orice depozit din
browser, e best-effort: blocat, preferința se pierde, meniul merge.

## Rolul activ

Comutatorul din bara laterală schimbă ce se vede. `vedeCosturi()` din `nav.ts`
spune dacă rolul curent are voie să vadă valori și marje — doar patronul are.
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

## Fluxul de validare

Indicatorul „N de validat de om" spunea *câte* sunt, nu *unde*. Pe `Radoia.xlsx`
— 105 poziții pe 7 foi — găsirea lor însemna derulare manuală după marcajul
chihlimbariu. Deasupra grilei stau acum trei lucruri:

- **Lentilele**: `Toate` · `De validat (n)` · `Netarifate (n)`. Ascund rândurile
  care nu se potrivesc, dar **numărul din marginea stângă rămâne cel din
  Excel** — ancora 1:1 cu fișierul nu se pierde, rândurile lipsă se văd ca
  salturi în numerotare. Filtrul nu e o preferință persistentă: se resetează la
  fiecare fișier, fiindcă „de validat" înseamnă altceva de la un fișier la
  altul.
- **Contorul pe fila fiecărei foi**, ca să se vadă pe care foaie mai e treabă
  fără să fie deschise pe rând.
- **„Următoarea de validat"**, ciclic, cu derulare în vizor și focus pe primul
  control din coloanele extrase — poziția se corectează de la tastatură, fără
  mouse.

### Tipul ofertei: segmentul de preț

Deasupra zonei de încărcare stă comutatorul **Rezidențială / Industrială**.
Rafinăria nu are buton: n-are nicio listă, deci un buton ar promite un preț pe
care nimeni nu-l poate calcula.

- Schimbarea lui **nu** recitește fișierul și **nu** recheamă modelul — doar
  retarifează ce e extras, prin `reevalueaza`.
- Segmentul se salvează în `SesiuneImport.destinatie` și se reface la
  redeschidere, **înainte** de tarifare. Fără asta, un import lucrat pe
  industrial se redeschidea pe rezidențial, cu alte prețuri. Istoricul arată
  segmentul lângă valoare, când nu e rezidențial.
- Registrul de ofertă scrie segmentul real în proveniență, iar formularul îl
  spune în sumar („ofertă industrială").

### Grila: prețuri și grosimi lipsă

După coloanele fișierului și cele extrase (sistem, ø, grosime) stau **P.U.** și
**Total**. O poziție fără preț arată „—" cu cauza în `title`; una cu note are
„*" lângă preț și notele în `title`.

Unde clientul n-a scris grosimea, coloana arată grosimea uzuală a firmei ca
placeholder. „Completează N grosimi lipsă" o pune pe toate liniile foii active,
dar **nu le confirmă**: rămân „de validat", cu notă, până le confirmă omul.
Propunerile stau în `SesiuneImport.grosimiPropuse`, separat de extrageri. O
corecție manuală pe rândul respectiv șterge propunerea: la grosime o înlocuiește
cu ce scrie omul; la sistem sau ø o golește, fiindcă era calculată pentru
valorile vechi.

### „Ce blochează N poziții" — cauze, nu simptome

Indicatoarele spuneau *câte* poziții n-au preț. Niciodată **de ce**: `eroare`
era text liber, iar lentila „Netarifate" dădea o listă, nu un diagnostic.
Măsurat pe cele 10 fișiere reale, cele 130 de poziții netarifate au **patru
cauze**, iar 64 din 130 sunt același răspuns neprimit de la firmă:

```
Ce blochează 130 de poziții
  64  niciun strat n-are coeficient pe banda lui   → întrebarea 9    [arată]
  43  grosime care nu există în listă                                [arată]
  15  diametru peste maximul listei                 → întrebarea 4   [arată]
   8  DN inexistent în seria de oțel                → întrebarea 10  [arată]
```

Diferența nu e cosmetică: omul care vede „130 netarifate" crede că are 130 de
probleme, când are patru, dintre care una jumătate — și pe care o rezolvă un
telefon, nu o zi de lucru.

Gruparea se sprijină pe `CodNetarifare`, un cod stabil pe care `PozitieNetarifata`
îl poartă alături de mesaj (`src/pricing/types.ts`). Mesajul rămâne proza citită
de om; codul e contractul pe care se numără. Harta `cod → { etichetă, întrebare }`
stă în `web/validare.ts`, lângă restul logicii de filtrare.

`[arată]` extinde lentila existentă: `Lentila` primește o variantă `{ cod }`, iar
`potrivit()` filtrează pe ea. Mecanismul de lentile, contoarele pe filă și
„Următoarea de validat" rămân neatinse. Blocul se recalculează pe **tot
registrul**, nu pe foaia activă — cauza nu ține de foaie, iar `Radoia.xlsx` are
șapte.

O poziție poate apărea la două cauze (SPIRO ø160 n-are preț **și** e marcată),
deci suma coloanei poate depăși numărul din titlu, care numără poziții
distincte. Titlul ar minți dacă ar aduna coloana.

### Ecranul nu explică, arată

Notele explicative de pe ecranul de import au fost **șterse** — erau ~250 de
cuvinte de proză permanentă, utile o dată și zgomot la fiecare fișier. Regulile
de business pe care le spuneau (unde stă cheia API, cum se citește grila, de ce
suma cauzelor poate depăși titlul, cum se tarifează golurile la foc) stau în
`.claude/`, unde le caută cine are nevoie de ele.

Ce a rămas pe ecran e **stare sau cifre**, nu explicație: ce foaie e goală, ce
import e redeschis, câte linii n-au plecat la model, și alerta de ofertă de
manoperă. Regula de fond: dacă un text nu se schimbă de la un fișier la altul,
n-are ce căuta în interfață.

### Ieșirea: registrul de ofertă

Până acum nu ieșea **nimic** din aplicație — importul se oprea într-o grilă, iar
munca de validare rămânea în browser. Butonul „Generează oferta" din bara de
validare deschide un formular de antet (firmă emitentă, număr, dată, beneficiar,
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
în Node. `tests/oferta.test.ts` verifică pe `Oferta 27.04.2026 Matari.xlsx` că
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

**Confirmarea în masă acționează pe exact ce e vizibil** sub filtrul curent, pe
foaia activă, iar butonul spune asta („Confirmă cele 12 poziții marcate din
foaia asta"). Un buton „confirmă tot" ar bifa și poziții pe care omul nu le-a
avut niciodată pe ecran.

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

## Ce rulează în browser și ce nu

Motorul de prețuri și extragerea deterministă rulează integral în browser:
listele de prețuri sunt importate static, iar parsarea Excel are o variantă
care pornește de la conținutul fișierului. Același cod rulează în teste.

Ecranul spune **cu ce model** lucrează — în bara de stare de sus și în textul de
progres, cât timp extrage. Nu e cosmetic: e singurul loc din aplicație unde
datele clientului pleacă la un terț, iar omul trebuie să vadă asta fără să caute.

Stratul cu model **nu** rulează în browser, dar ecranul de import îl folosește
când e disponibil: `scripts/vite-plugin-model.ts` expune `POST /api/extrage`
doar pe serverul de dezvoltare, iar ecranul întreabă ruta cu un GET înainte să
o folosească. Local, cu `npm run dev` și cheia în `.env`, importul rulează
pipeline-ul complet; pe Pages ruta lipsește și ecranul cade curat pe stratul
determinist. Cheia stă în procesul Node — nu ajunge în pagină și, pentru că
plugin-ul e `apply: "serve"`, nu poate ajunge nici într-un build.
