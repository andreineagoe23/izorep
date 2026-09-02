# UI

> Context pentru `web/`.

Aplicație pe ecrane, fără framework. Vite + TypeScript, rutare pe hash
(`#/clienti`) ca să funcționeze pe GitHub Pages fără server.

## Structura

```
web/index.html        shell: bară laterală + zonă de conținut
web/main.ts           router, meniu, comutator de rol
web/nav.ts            definiția meniului și rolurile
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

Ecran nou: creezi fișierul în `web/ecrane/`, îl adaugi în `ECRANE` din
`main.ts` și pui `construit: true` pe itemul din `nav.ts`.

## Randare

Folosește helperele din `tip.ts` — `eur`, `nr`, `data`, `esc`, `card`,
`indicator`, `progres`, `stare`, `tabel`, `nota`. Ele produc exact marcajul pe
care îl stilează `style.css`. Un ecran care își inventează clase proprii arată
diferit de restul aplicației și rupe temele light/dark.

**Orice text care vine din date trece prin `esc()`** înainte să ajungă în
`innerHTML`. Descrierile din fișierele clienților conțin ghilimele, `<` și
caractere stricate din PDF-uri.

## Meniul arată tot sistemul, nu doar ce e construit

`nav.ts` conține toate modulele, cu `construit: false` pe cele nelivrate. Ele
apar în meniu, gri, cu eticheta „urmează". Clientul vede unde se ajunge, dar nu
dă click pe un ecran gol crezând că e stricat.

## Rolul activ

Comutatorul din bara laterală schimbă ce se vede. `vedeCosturi()` din `nav.ts`
spune dacă rolul curent are voie să vadă valori și marje — doar patronul are.
Ecranele care afișează bani trebuie să îl respecte.

În aplicația reală asta se verifică pe server; aici e doar demonstrația
modelului de permisiuni.

## Ce rulează în browser și ce nu

Motorul de prețuri și extragerea deterministă rulează integral în browser:
listele de prețuri sunt importate static, iar parsarea Excel are o variantă
care pornește de la conținutul fișierului. Același cod rulează în teste.

Stratul cu model **nu** e în browser: ar cere o cheie API, iar o cheie într-o
pagină statică e publică. Pipeline-ul complet rulează local, `npm run import`.
