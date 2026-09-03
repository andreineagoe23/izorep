# UI

> Context pentru `web/`.

Aplicație pe ecrane, fără framework. Vite + TypeScript, rutare pe hash
(`#/clienti`) ca să funcționeze pe GitHub Pages fără server.

## Structura

```
web/index.html        shell: bară laterală + zonă de conținut
web/main.ts           router, meniu, comutator de rol
web/nav.ts            definiția meniului, modulele viitoare și rolurile
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
