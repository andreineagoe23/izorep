# Izorep

ERP pentru o firmă de izolații termice (SC RADOIA ISOLIRUNG SRL + R&F ISORAD
SYSTEM SRL). Faza curentă: **motor de prețuri + import oferte de la clienți**.

## Ce face aplicația

Clientul trimite o listă de cantități în Excel, în formatul lui. Aplicația o
citește, identifică pozițiile de izolație, le tarifează din listele de prețuri
ale firmei și produce oferta. Mai departe: contract, situație de lucrări, stoc,
facturare.

Fluxul de business complet:
```
cerere client (Excel/poză) → deviz → ofertă → contract → lucrare
  → raportare teren → situație de lucrări → confirmare client → factură
```

## Cinci reguli care nu se încalcă

1. **Calculele financiare sunt deterministe.** Prețurile, totalurile, TVA-ul și
   cantitățile se calculează în cod, cu teste. Un LLM citește, propune și
   sumarizează — nu calculează niciodată un număr care ajunge pe o factură.

2. **Poziția fără preț se marchează, nu se ghicește.** Matricile de prețuri sunt
   rare: combinațiile care nu se execută sunt goale. Gol = „nu se ofertează",
   nu „preț zero". Vezi `PozitieNetarifata`.

3. **Documentele sunt imutabile.** O ofertă emisă nu se editează; se corectează
   prin versiune nouă. Prețul se **copiază** în linia de deviz (snapshot), nu se
   referențiază — altfel o ofertă de acum doi ani nu mai e reproductibilă.

4. **Rotunjirea se face pe fiecare strat, la 2 zecimale, nu la final.** Schimbă
   totalul cu bani reali. Vezi `bani()` în `src/pricing/engine.ts`.

5. **Bani niciodată în float.** În JSON-ul de prețuri valorile au 6 zecimale
   pentru fidelitate față de sursă; la ieșire trec prin `bani()`. Când apare
   baza de date: `numeric`, nu `double precision`.

## Structura

```
data/price-lists/    listele rezidențiale — cele pe care rulează motorul
data/price-lists/industrial/   listele industriale — deocamdată doar în bază
data/referinte/      seriile de diametre pe material, secțiuni rectangulare
scripts/             ETL one-off Excel → JSON (Python, .xls vechi)
src/pricing/         motorul de prețuri — determinist, testat pe oferte reale
src/import/          pipeline L0–L4 de citire a Excel-urilor de la clienți
tests/               suita de referință: reproduce oferte istorice la bănuț
```

## Comenzi

```bash
npm test                                      # suita de referință a motorului
npm run typecheck
npm run import -- <fisier.xlsx>               # import cu model
npm run import -- <fisier.xlsx> --fara-model  # doar stratul determinist
python scripts/extract_price_lists.py ../attachments   # regenerează prețurile
python scripts/extract_conversii.py ../attachments     # regenerează seriile de țevi
```

## Context de domeniu

- **DN vs diametru exterior.** Clienții ofertează în DN, listele de prețuri sunt
  indexate pe diametru exterior real. `src/pricing/dn-table.ts` face conversia.
  La conductele de **plastic** (PPR, PP, PEHD, PEX) dimensiunea nominală *este*
  diametrul exterior — confuzia asta e sursa nr. 1 de tarifare greșită.
- **Poziții compuse.** O poziție poate avea mai multe straturi (elastomer + vată
  + tablă). Diametrul crește cu `2 × grosime` la fiecare strat.
- **Elemente speciale.** Coturile, teurile, flanșele nu au preț propriu: se
  tarifează ca multiplu al prețului pe ml de la acel diametru, pe benzi de
  diametru. Tabelul e **valoare implicită**, nu regulă rigidă — ofertele reale
  conțin abateri negociate, care trebuie permise dar marcate vizibil.
- **Monedă.** Prețurile sunt în EUR fără TVA; plata se face în lei la cursul BNR
  din ziua facturării. Fiecare document va trebui să păstreze valoarea în euro,
  cursul folosit și valoarea în lei.

## Ce e încă nedecis

Întrebări deschise către firmă, care schimbă arhitectura (nu doar implementarea):

- Cine ține stocul oficial — aplicația sau Saga? Determină tot modulul de stoc.
- Cine emite factura și cine o trimite în SPV?
- La ø90 și ø160 ofertele istorice tarifează inconsecvent. Vezi blocul
  „abateri cunoscute" din `tests/pricing.test.ts`.
- Există listă de prețuri pentru elastomer peste ø219? Oferta 118 conține ø250
  și ø315, care nu sunt în nicio listă primită.
- Lista de manoperă (2,20 / 2,30 / 3,00 €/ml) e scrisă undeva sau se negociază
  de fiecare dată? Are structură diferită de matricea completă: tarif plat pe
  sistem + grosime, nu matrice ø × grosime.

## Stil

- Comentariile explică **de ce**, nu ce. Regulile de business ciudate se
  documentează cu exemplul real din care provin.
- Cod și commit-uri în engleză pentru identificatori tehnici uzuali, restul în
  română fără diacritice (identificatorii nu poartă diacritice).
- Fără trailere de atribuire în commit-uri.
