# Șantier: notițele din carnet

> Context pentru `src/santier/`, `src/lucrari/potrivire.ts`, `web/ecrane/santier.ts`
> (pagina „Măsurători”), `web/santier-vizual.ts` și `scripts/compara-poze.ts`.

## De ce există

Oamenii de pe șantier **nu folosesc aplicația** (decis pe 29 septembrie 2026).
Măsoară, scriu de mână într-un carnet și trimit poze. Omul de la birou transcria
totul de mână. Exemplele reale: `../attachments/santier/santier1–4.jpeg`, patru
pagini de măsurători pentru o ofertă Ecoterm (stație de epurare).

Regula e aceeași ca la import: **modelul propune, omul confirmă.**

## Drumul

```
poze → modelul citește termenii → codul îi adună pe rânduri
     → omul compară cu poza, corectează, „Am verificat pagina”
     → registru .xlsx → importul, ca un fișier de client → oferta
```

- **Modelul nu adună.** Dă câte un termen pentru fiecare cantitate scrisă
  (`6 CT`, `14 ml`, `× 2` ca multiplicator), cu diametrul și straturile liniei
  lui. Suma o face `agrega.ts`. O adunare greșită a modelului ar arăta exact ca
  o cifră citită corect, iar omul n-ar avea cum s-o prindă. Așa vede
  „(40 + 1) × 2” lângă rândul de pe poză.
- **Nicio a doua cale de preț.** `spre-cerere.ts` scrie rândurile în forma pe
  care stratul determinist al importului o citește complet („… - COT” ca în
  Oferta 284, fiindcă regex-ul de formă nu prinde „Cot”). Registrul trece prin
  `proceseazaRegistru` ca orice listă de client. `tests/santier.test.ts` ține
  asta adevărat pentru fiecare element × straturi și pentru toată referința
  Ecoterm: 50 de rânduri, toate cu preț, toate `sursa: "regex"`.
- **Preț dublu.** Pe foaie scrie „(preț dublu)” la unii robineți și reductoare.
  Omul îl vede și îl poate bifa sau scoate în editor. La import, poziția
  primește **preț pus de mână = 2 × prețul din listă**, deci cardul arată și ce
  dădea lista. Interpretarea e a noastră, de confirmat cu firma.
- **O pagină intră în ofertă doar verificată.** „Am verificat pagina” e oprit
  cât există rânduri nesigure (cifră scrisă peste alta, citire ghicită) sau
  incomplete (fără diametru, fără cantitate, fără niciun strat).
- Pe Pages ruta `/api/poza` lipsește, deci ecranul trece pe **scris de mână**:
  poza alături, „Adaugă rând”. Aceeași verificare, același drum spre ofertă.
- **O poză care nu se citește** are „Citește din nou” și „Scriu de mână”. Un
  apel are 180 s și o singură reîncercare: în comparație, o pagină blocată la
  OpenAI a ținut 20 de minute cu reîncercările implicite.
- **Nimic nu se redesenează peste omul care scrie.** O citire care se termină,
  sau o poză nouă, redesenează doar pagina ei. O citire pornită înainte ca omul
  să plece pe alt ecran se termină pe ecranul deschis acum (`redeseneaza`, la
  nivel de modul), nu pe cel vechi.
- După „Trimite la ofertă” paginile se golesc, ca lista să nu plece de două
  ori; sus rămâne numele fișierului trimis.

## Notația din carnet

Citirea noastră, de confirmat cu firma (legenda e și în
`../attachments/README.md`):

| Pe foaie | Înseamnă |
|---|---|
| `ø60 (v.50 + Al)` | țeavă ø60, vată minerală 50 mm + tablă aluminiu |
| `(doar Al)` | fără vată, doar tablă; în antetul zonei, pentru toată zona |
| `ml`, `CT`, `Teu`, `ROB`, `flanșă`, `reductor 320 → 250` | metri liniari, cot, teu, robinet, flanșă, reducție (pe diametrul mare) |
| `× 2` lângă un grup încadrat | fiecare termen din grup, de două ori |
| `(preț dublu)` | vezi mai sus |

## Care model citește pozele

`npm run compara-poze -- <model> … [--repetari N]`. Răspunsul corect e
`tests/fixtures-santier-ecoterm.json`, transcris de noi și **neconfirmat de
firmă**. Rândurile pe care nu le-am putut citi sigur sunt marcate `nesigur`.
Scorul se dă pe rânduri (diametru, straturi, element, preț dublu, cantitate
totală): o cantitate aproape bună e tot greșită. Se raportează separat pe
rândurile sigure, fiindcă acolo o diferență e sigur greșeala modelului.

Prima rulare, 29 septembrie 2026, pe 4 pagini, 50 de rânduri (35 sigure):

| Model | Exacte | Pe cele sigure | În plus | Timp |
|---|---|---|---|---|
| gpt-5.6-terra | 45 | 35 | 1 | 34 s |
| gpt-5.5-2026-04-23 | 43 | 33 | 5 | 57 s |
| gpt-5-2025-08-07 | 41 | 33 | 0 | 99 s |
| gpt-5.6-sol | 38 | 30 | 9 | 45 s |
| gpt-5.2-2025-12-11 | 37 | 27 | 4 | 26 s |
| gpt-5.4-2026-03-05 | 35 | 26 | 2 | 23 s |
| o3, o4-mini, gpt-5-mini, gpt-5.1 | 30 | 22–25 | 5–11 | 26–286 s |
| **gpt-4.1-2025-04-14** (importul) | 28 | 22 | 6 | 14 s |
| gpt-5.6-luna | 27 | 23 | 15 | 34 s |
| gpt-4.1-mini | 25 | 18 | 8 | 16 s |
| gpt-4o-2024-11-20 | 18 | 16 | 8 | 14 s |
| gpt-5.4-mini | 16 | 14 | 15 | 10 s |

### Alegerea

Primele patru, rulate încă de trei ori (temperatura nu se poate fixa la
familia gpt-5, deci aceeași poză poate da alt răspuns):

| Model | Exacte (din 50), 4 rulări | Pe cele sigure (din 35) | În plus | Timp |
|---|---|---|---|---|
| **gpt-5.6-terra** | 45 · 44 · 42 · 44 | 35 · 34 · 34 · 34 | 1–5 | 34–41 s |
| gpt-5.5-2026-04-23 | 43 · 45 · 39 · 41 | 33 · 34 · 32 · 34 | 5–11 | 39–57 s, o dată 1.198 s |
| gpt-5-2025-08-07 | 41 · 39 · 32 · 39 | 33 · 31 · 24 · 30 | 0–4 | 75–99 s |
| gpt-5.2-2025-12-11 | 37 · 29 · 32 · 30 | 27 · 19 · 22 · 22 | 4–11 | 25–27 s |

**Implicit: `gpt-5.5-2026-04-23`** (`MODEL_POZE_IMPLICIT`), schimbabil din
`.env` cu `IZOREP_MODEL_POZE`. Ales cu Andrei pe 29 septembrie 2026: snapshot
datat, ca la import. `gpt-5.6-terra` a ieșit puțin mai bine și mai stabil, dar
n-are snapshot, deci OpenAI îl poate muta fără nicio urmă în repo. Costul
alegerii: mai multe rânduri în plus de scos (5–11 pe 4 pagini, față de 1–5).
Când `gpt-5.6-terra` primește snapshot, se rerulează comparația.

**Cu patru pagini, clasamentul e o indicație, nu o dovadă.** Referința e a
noastră, nu a firmei. Cu oferta Ecoterm semnată (cerută), rândurile nesigure
se lămuresc și scorul devine măsurătoare.

Ce greșesc modelele, în ordinea frecvenței: sar peste rândurile de continuare
(„+ 4 CT + 10 ml + 2 CT” sub linia cu ø60), citesc „CT” și „ROB” ca altă piesă
când zona e „(doar Al)”, pierd `× 2` pe o parte din grup.

**Temperatura.** La import regula e `temperature: 0`, iar familia gpt-5 nu o
acceptă. Aici nu se poate respecta: cele mai bune modele pe poze sunt toate din
familia gpt-5. Compensarea e verificarea umană obligatorie pe fiecare pagină,
plus repetările de mai sus, care arată cât variază un model de la o rulare la
alta.

## Ce nu face încă

- Pe server, paginile verificate se păstrează cu poza lor când pleacă (spre
  ofertă, situație sau comandă: `/api/masuratori`, tabelul `masuratoare`). Ce
  e încă în lucru pe ecran se pierde la reîncărcare. Pe linkul demo pozele nu
  se păstrează deloc.
- Situațiile de lucrări există din 29 septembrie 2026 (ecranul Lucrări), dar
  cantitățile executate se scriu de mână.

## Două momente pentru poze (2 octombrie 2026)

Andrei: pozele din carnet vin **înainte de ofertă** (la clienții din
apropiere firma măsoară și oferta finală se face din poze, ca Ecoterm) sau
**în timpul lucrării** (ce s-a executat, pentru situație). Citirea și
verificarea sunt aceleași; diferă doar unde pleacă rândurile.

Al doilea drum: `src/lucrari/potrivire.ts`. Rândurile confirmate trec prin
același import ca oferta (`executatDinMasuratori`), deci primesc aceleași
straturi pe aceleași rânduri din listă; `amprenta` (`src/lucrari/amprenta.ts`)
le compară cu pozițiile planului: formă + material, grosime și rândul din
listă pe fiecare strat, plus „preț dublu”. Notația nu contează (DN50 în
cerere = ø60 în carnet). Același material pe mai multe poziții: decide zona,
altfel omul (`deAles`); ce nu e în plan rămâne la om (`nepotrivite`). Planul
ține amprenta și zona din 2 octombrie 2026; planurile mai vechi nu se pot
potrivi (`planVechi`) și se refac din ofertă cât n-au situații. Testul
Ecoterm: oferta din poze, apoi aceleași poze ca executat tot → situația dă
exact valoarea ofertei. Ecranul: pagina „Măsurători”, cu „Pentru ofertă” /
„Pentru situație” (3 octombrie 2026, `ui.md`). Nu avem încă poze reale din
timpul lucrării: cerute firmei.
