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
L0b sectiuni.ts         contextul de secțiune (antetul de deasupra rândului)
L1  (nescris)           mapare de coloane, o dată per client, apoi din cache
L2a extract-regex.ts    determinist. ~55% din linii.
L2b extract-llm.ts      model, DOAR pe reziduu. Structured outputs, temp 0.
L3  ../pricing/         tarifare deterministă
L4  (nescris)           ecran de validare + salvarea corecțiilor ca mapping
```

**L4 e piesa care rezolvă de fapt „nu există template comun".** Nu ai nevoie de
format comun, ai nevoie de memorie per client. Primul proiect de la un client
nou: ~60% automat. Al doilea, cu șabloanele deja mapate: 90–95%.

## Contextul de secțiune

Multe poziții nu spun singure ce sunt. În oferta 118.1 linia e doar
`Teava OL/OLZN DN15 | 130/130`; faptul că e o închidere de gol la foc stă în
rândul de deasupra, `Teceri prin pereți rezistenți la foc EI30`. Fără legătura
asta ieșeau 0 poziții din 53.

Antetul se recunoaște **fizic, nu semantic**: e o celulă îmbinată peste mai
multe coloane, deci parserul o vede repetată identic pe rând, și nu are nici
unitate de măsură, nici cantitate. Regula nu depinde de ce scrie în ea.

Secțiunea dă **doar sistemul**, niciodată diametrul, grosimea sau dimensiunea
golului — altfel o poziție ar moșteni valorile alteia.

E o soluție îngustă, pentru un singur nivel de secțiune. L1 o înlocuiește cu
ceva care știe și ierarhii, și rânduri de continuare (`"Same - Ø125 mm"`).

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

## Bugetul de tokeni

Fiecare apel cară **~1.177 tokeni ficși** — system prompt (~735) plus schema
JSON (~442) — retrimiși integral la fiecare lot. Pe `Radoia.xlsx` pleacă 153 de
linii la model:

| Lot | Apeluri | Doar overhead |
|---|---|---|
| 12 | 13 | 15.300 tok |
| 25 | 7 | 8.200 tok |
| 40 | 4 | 4.700 tok |

De aceea lotul implicit e **25**, nu 12.

### Două limite, direcții opuse

- **Pe minut** (TPM/RPM) — vârf de moment → `IZOREP_CONCURENTA=1`
- **Pe zi** (TPD) — buget total → `IZOREP_LOT` mai **mare**, model cu plafon
  mai mare, sau `--fara-model`

Un lot mai mic ajută la prima și strică a doua. Mesajul din `LimitaDeRata` le
distinge, ca să nu tragi în direcția greșită.

Pe `gpt-4o`, tier-ul de start dă 90.000 tokeni pe zi. Un fișier ca `Radoia.xlsx`
consumă ~50.000 — deci două fișiere pe zi și bugetul e terminat.

### Ce reduce consumul, în ordinea efectului

1. **Stratul determinist.** Fiecare linie rezolvată de L2a costă zero tokeni.
   `Oferta Matari` a trecut de la 0 la 53 de poziții deterministe și acum nu
   mai consumă nimic. L1 și L4 sunt răspunsul structural, nu o setare.
2. **Loturi mai mari** — mai puține retrimiteri ale promptului. Peste ~30 de
   linii pe lot acuratețea începe să scadă; 25 e verificat.
3. **Un model cu plafon mai mare.** Sarcina e extragere cu schemă închisă, cinci
   câmpuri cu domenii enumerate — nu raționament. Merită măsurat dacă un model
   mai mic o face la fel de bine: `OPENAI_MODEL` e deja configurabil, iar
   verificarea e ieftină — rulezi pe același fișier și compari cu ce dă stratul
   determinist pe liniile pe care le rezolvă amândouă.
4. **Text mai scurt per linie.** Se trimit până la 900 de caractere; util e
   rareori peste 200.
5. **`motiv` mai scurt.** E o propoziție per linie, în tokenii de ieșire.

Un lot căzut nu invalidează importul: restul liniilor rămân, iar raportul spune
câte loturi au eșuat. Clientul are `maxRetries: 4`, deci un 429 se reia cu
backoff înainte să devină `LimitaDeRata`.

## Capcane găsite în fișierele reale

- **`Book15.xlsx`** — rânduri de continuare `"Same - Ø125 mm"` care moștenesc
  descrierea de deasupra. Fără carry-forward pierzi specificația. Încă nerezolvat:
  de-asta ies doar 5 poziții din 412 rânduri.
- **`Izolatii Transavia.xlsx`** — pivot pe 11 coloane de zone; tipul e codat în
  text: `"...Di89, g50 - COT"`.
- **`Flower City`** — `cantitate/unitate × nr. unități = total`, plus `#REF!`.
- **`Radoia.xlsx`** — descrieri multi-linie cu specificații complete într-o
  singură celulă; zona lipită de observații cu `/`.
- **`Radoia.xlsx` / închideri la foc** — „Protecție la foc EI 60 pentru
  tubulaturile din tablă zincată" e protecția *tubulaturii*, altă lucrare, fără
  listă de prețuri. Cu „rezistent la foc" sau „EI 60" ca semnal de sistem, 28 de
  rânduri de acolo intrau ca închideri de gol, iar dimensiunea tubulaturii
  rectangulare (`1000/500`) era citită drept dimensiune de gol. Semnalul cere
  noțiunea de **gol** sau de **trecere prin perete**.
- **Oferta 118** — ligaturi stricate (`sinte␣c`): textul e copiat dintr-un PDF.
- **Cantitatea** — primul număr de pe rând e aproape întotdeauna *numărul curent*
  al poziției, nu cantitatea. Euristica actuală o caută lângă unitatea de măsură;
  dispare când apare maparea de coloane (L1).
