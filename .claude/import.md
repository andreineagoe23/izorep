# Import Excel de la clienți

> Context pentru `src/import/`.

Problema: fiecare client trimite alt format și nu există template comun.
Măsurat pe cele 7 fișiere din `attachments/`: 5.659 celule, 958 descrieri
distincte, 349 linii ofertabile — dar doar **134 șabloane distincte**.

## De ce NU e o problemă de RAG

Datele sunt deja localizate exact, în celule. Nu trebuie *regăsite*, trebuie
*mapate*. Chunking-ul rupe rândul de antetul lui, embeddings-urile confundă
`DN80` cu `DN100` (aproape identice semantic, catastrofal diferite ca preț), și
nu poți scrie un test care să treacă sau să pice.

Ținta extragerii e mică și închisă — 5 câmpuri cu domenii enumerate
(`schema.ts`). Asta se rezolvă cu structured outputs, nu cu retrieval.

Singurul loc unde căutarea semantică ar ajuta: peste catalogul **propriu** de
~134 șabloane, ca să propună candidați pentru o linie nouă. Nu peste fișierul
clientului.

## Straturile

```
L0  parse-workbook.ts   parsare fizică. Zero interpretare.
L1  (nescris)           mapare de coloane, o dată per client, apoi din cache
L2a extract-regex.ts    determinist. ~55% din linii.
L2b extract-llm.ts      model, DOAR pe reziduu. Structured outputs, temp 0.
L3  ../pricing/         tarifare deterministă
L4  (nescris)           ecran de validare + salvarea corecțiilor ca mapping
```

**L4 e piesa care rezolvă de fapt „nu există template comun".** Nu ai nevoie de
format comun, ai nevoie de memorie per client. Primul proiect de la un client
nou: ~60% automat. Al doilea, cu șabloanele deja mapate: 90–95%.

## Stratul determinist nu există din motive de cost

La ~350 de linii pe proiect și 20 de proiecte pe lună, trecerea tuturor liniilor
prin model ar costa câțiva euro pe lună. Regex-ul există pentru **determinism și
testabilitate**: ce se poate rezolva determinist trebuie să aibă teste care pică
atunci când cineva strică regula.

## Unde rulează stratul cu model

CLI: `npm run import -- <fisier.xlsx>`.

În aplicație: `scripts/vite-plugin-model.ts` expune `POST /api/extrage` **doar pe
serverul de dezvoltare** (`apply: "serve"`). Ecranul de import întreabă întâi
ruta cu un GET; dacă răspunde, trimite acolo liniile reziduale și primește
înapoi parametrii extrași, apoi tarifează determinist în browser.

Ecranul împarte reziduul în loturi și le trimite în paralel, actualizând bara de
progres la fiecare lot întors. Un lot care cade nu invalidează importul: restul
liniilor rămân, iar raportul spune câte loturi au eșuat.

Latența e dominată de generarea răspunsului, nu de rețea. Măsurat pe
`Oferta 27.04.2026 Matari.xlsx` (84 de linii reziduale) cu gpt-4o: un lot de 25
de linii ia ~19s, deci varianta secvențială inițială ținea ecranul gol ~80s. În
loturi de 12, câte 4 deodată: **19–39s**, cu progres vizibil de la prima
secundă.

Cheia stă în procesul Node al lui `vite dev` și nu ajunge niciodată în pagină.
`apply: "serve"` e mecanismul, nu o precauție: în `vite build` ruta nu există,
deci varianta de pe Pages rămâne pur deterministă — ecranul vede doar că ruta
lipsește și își schimbă mesajul. Middleware-ul răspunde doar cererilor de pe
loopback și plafonează la 400 de linii per import.

## Reguli pentru stratul cu model

- structured outputs cu schemă strictă; ieșirea trece prin Zod înainte de orice
- `temperature: 0` — altfel același import dă rezultate diferite
- primește doar liniile reziduale, în loturi de 12, câte 4 loturi în paralel
- **nu vede și nu calculează prețuri**
- scor de încredere pe linie; sub prag → validare umană obligatorie

## Capcane găsite în fișierele reale

- **`Book15.xlsx`** — rânduri de continuare `"Same - Ø125 mm"` care moștenesc
  descrierea de deasupra. Fără carry-forward pierzi specificația. Încă nerezolvat:
  de-asta ies doar 5 poziții din 412 rânduri.
- **`Izolatii Transavia.xlsx`** — pivot pe 11 coloane de zone; tipul e codat în
  text: `"...Di89, g50 - COT"`.
- **`Flower City`** — `cantitate/unitate × nr. unități = total`, plus `#REF!`.
- **`Radoia.xlsx`** — descrieri multi-linie cu specificații complete într-o
  singură celulă; zona lipită de observații cu `/`.
- **Oferta 118** — ligaturi stricate (`sinte␣c`): textul e copiat dintr-un PDF.
- **Cantitatea** — primul număr de pe rând e aproape întotdeauna *numărul curent*
  al poziției, nu cantitatea. Euristica actuală o caută lângă unitatea de măsură;
  dispare când apare maparea de coloane (L1).
