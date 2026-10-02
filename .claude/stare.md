# Stare curentă

> Unde am ajuns, ce s-a decis și ce urmează. Actualizează la fiecare etapă.
> Ultima actualizare: 2 octombrie 2026.

## 2 octombrie 2026: audit, necesarul legat de ofertă

Munca din 29 septembrie era necommit-uită (linkul arăta versiunea de dinainte
de apel): intrată pe `main` în trei commit-uri, Pages la zi. Reparat apoi
necesarul: se calculează doar din pozițiile ofertei, „În ofertă” e cu
ajustarea și discountul, piesele fără regulă de material se văd în Depozit
(„+ N buc.”, „de stabilit”). Detalii în `ui.md`, „Depozit și stoc”.

Tot pe 2 octombrie: demo-ul din `docs/demo-firma.md` rulat cap-coadă pe link
(Playwright), toate cifrele ies; cheia OpenAI merge (pozele Ecoterm: 39 / 50
exacte, 47 s). Pozele din carnet vin în două momente (Andrei): înainte de
ofertă și în timpul lucrării — logica de potrivire pe planul de șantier e în
`src/lucrari/potrivire.ts` (`santier.md`); ecranul: pagina „Șantier” devine
„Măsurători”, cu „Pentru ofertă” / „Pentru situație de lucrări” (`ui.md`).
Foaia pentru întâlnirea de luni, 5 octombrie: `docs/intrebari-firma.md`
(tipărită ca `../Intrebari RADOIA 5 octombrie.pdf`, cu loc de răspuns); ce
facem cu fiecare răspuns: `docs/dupa-intalnire.md`. **384 de teste.**

## Unde am rămas (29 septembrie 2026, după apelul cu firma)

Andrei a vorbit cu cineva de la firmă și a trimis notițele, plus trei poze
(`~/Downloads/preturi1–3.jpeg`): tabelul DN → ISO și notițele scrise de mână
din care fuseseră transcrise `tabel-conversie-tevi.docx` și regula „peste
listă”. Tot ce era în poze era deja în sistem; o singură corectură: bifele
firmei sunt pe **DN și ISO**, cu „?” pe Toli (docx-ul transcris spunea „Toli
și ISO”). Codul folosea deja DN → ISO.

**Fluxul firmei**, cum l-au spus: import cerere → verificarea prețurilor →
oferta la client → **șantierul din ofertă** (plan de șantier) → materialele
cumpărate / depozit / stoc pe șantier → **situații de lucrări, cu istoric**.

| Ce au spus | Ce s-a făcut |
|---|---|
| Până la 3 țoli se comandă tuburi (elastomer, cochilie), pe diametru și grosime | necesarul: tub pe ø și grosime, în ml, până la ø90 |
| Peste 3 țoli, plăci pe m²: (0,114 + 2 × 0,03) × 3,14 = 0,5463 → 0,55; × 100 m = 55 m² | `m2PeMetru` cu 3,14, rotunjit la 2 zecimale; plăcile pe grosime, fără ø; testul e exemplul lor |
| Coturi / teuri: 1 m = 3 la ø114–140, 2 la ø159–168, „119–123” 1 la 1 | `piesePeMetru`; „119–123” citit ca 219+ (de confirmat) |
| Lista include manopera; necesarul să nu lase marfă pe stoc | rezerva de 5–10 % nu mai e implicită (0) |
| Tehnicul poate crește tot cu 10 % | „Ajustare prețuri (%)” în pasul „Oferta”, pe fiecare preț unitar |
| Închiderile la foc pe industrial = rezidențial + 20 %, pe total | rând separat în ofertă; închiderile nu mai stau „De verificat” pe industrial |
| Șantierul se face din ofertă | „Creează șantierul” în pasul „Oferta”: plan (pozițiile ofertei, înghețate) + necesar pe depozitul șantierului |
| Situații de lucrări, cu istoric | ecranul Lucrări: situație nouă, cumulat, „Tot restul”, Excel, se șterge doar ultima |
| Depozitul = cantitate și valoare: cost de achiziție față de ofertă | preț de achiziție pe intrare, în euro; cost față de „în ofertă” pe fiecare necesar |
| Coturi „119–123 → 1 la 1” (Andrei a confirmat că așa s-a spus) | nicio țeavă nu are ø între 119 și 123 → citit 219–323, de confirmat (`tevi.md`) |

**De reținut, fără cod încă** (cerut de Andrei, 29 septembrie 2026):

- **Cursul: BNR + 1–2 %.** Firma pune la valoarea stocului „cursul valutar
  +1–2 % în euro”. Nu avem încă cursul în aplicație, deci prețul de achiziție
  se scrie direct în euro. Când vine cursul (facturare, etapa E), costul în lei
  trecut în euro primește marja asta (de aflat: 1 sau 2 %).
- **Rafinăria: momentan nu lucrăm pe ea.** Rămâne ca loc pregătit (tipul
  `Destinatie`, segmentul gol din „Liste de prețuri”), fără buton la import și
  fără întrebare către firmă acum. Se reia când vine lista.

Verificat: TRANSAVIA în browser dă 94.575,06 € (+10 % → 104.031,67 €);
șantierul cu discount 3 % = 91.737,81 €, adică Oferta 284, iar o situație cu tot
executat dă exact atât (test). Matari pe industrial: 15.230,45 € (12.692,04 +
2.538,41). Lucrări, Depozit, Tablou, pasul „Oferta”: 5 lățimi × 2 teme, zero
derulare. **377 de teste.** Detalii în `tevi.md` (materialul), `pricing.md`
(ajustarea, focul pe industrial), `ui.md` (ecranele).

## Mai devreme, 29 septembrie 2026

**Șantier: notițele din carnet** (detalii în `santier.md`). Decis cu Andrei: șantierul
nu folosește aplicația, scrie în carnet și trimite poze; aplicația nu va fi
PWA; o folosesc tehnicul și patronul, pe web; rolurile se stabilesc mai târziu.
Ecranul nou citește pozele cu modelul, omul confirmă pagină cu pagină lângă
poză, iar rândurile trec prin import ca o listă de client. Modelul pentru poze
e `gpt-5.5-2026-04-23`, snapshot datat, ales pe 4 × 4 rulări: 39–45 de rânduri
exacte din 50, față de 28 cu gpt-4.1. Referința e transcrisă de noi. **De cerut firmei:**
oferta Ecoterm făcută din cele 4 pagini și confirmarea notației (ROB, „preț
dublu”, „× 2”).

**Testele, curățate (29 septembrie 2026): 630 → 363.** Regula, cerută de
Andrei: rămân testele care păzesc banii (prețurile față de ofertele semnate,
nicio poziție greșită „Gata” pe tăcute, importul cap-coadă, registrul ofertei),
cheia OpenAI și izolarea datelor. Au plecat testele pe marcaj și texte de
ecran, pe preferințe din browser și pe detalii de formă: aplicația nu e gata,
iar aspectul se verifică în browser. Familiile „un test pe poziție” (Matari
53, Oferta 118 48, coduri de cauză, cot/teu Oferta 284, combinațiile Șantier)
sunt acum un test pe ofertă, care la eșec listează toate pozițiile greșite:
aceeași acoperire, alt număr.

## 28 septembrie 2026, seara

Produsul e pregătit pentru demo-ul lui Adrian la firmă: scenariul e în
`docs/demo-firma.md`, întrebările în `docs/intrebari-firma.md`. Totul e pe
`main` (**363 de teste**, build verde, publicat pe Pages).

- **Calculele de import, verificate linie cu linie** față de ofertele semnate,
  cu model și fără: TRANSAVIA 98 / 98 prețuri și 99 / 99 cantități, Oferta
  27.04.2026 48 exacte (cele 9 diferite, toate „De verificat”), Matari 53 / 53;
  DN → ø → rând exact pe 209 linii. Cu prețul pus de mână pe distribuitor,
  cererea TRANSAVIA dă **94.575,06 € = Oferta 284**, la ban.
- **Datele demo sunt cele din ofertele semnate** (erau dublate la 118 / 118.1),
  cu perechea TRANSAVIA și cu un test care le leagă de fișiere.
- **Depozit și stoc, prototip:** necesarul de materiale din oferta importată,
  registrul de mișcări, „de comandat”; datele stau în browser.
- **Două roluri provizorii: Birou și Contabilitate** (erau cinci; Șantierul,
  scos pe 29 septembrie: nu folosește aplicația). Amândouă văd tot; rolurile se
  stabilesc cu firma. `docs/productie.md` e rescris simplu: un link, cont pe
  email, Saga rămâne cum e, contabila importă un fișier.
- **Importul, trecut prin ochii omului de la birou:** fișier stricat / PDF /
  .xls primesc un mesaj în română cu ce să facă (nu eroarea JSZip în engleză);
  un Excel fără poziții se oprește la pasul 1 cu explicație; lângă „Descarcă
  oferta” scrie câte poziții lipsesc din ea.
- **Modelul rămâne `gpt-4.1-2025-04-14`.** Bugul din 28 septembrie era de
  arhitectură, nu de calitate; un model nou se alege abia când ofertele semnate
  pe spital / Book15 / Transavia inox dau răspunsul corect de comparat.

Detaliile fiecărei zile sunt în secțiunile datate de mai jos; ce urmează, la
„Ce urmează”.

## Contextul proiectului

Client: **SC RADOIA ISOLIRUNG SRL** (+ R&F ISORAD SYSTEM SRL), firmă de izolații
termice pentru instalații — conducte și tubulatură în clădiri mari, hale,
rafinării. Echipa de dezvoltare: **Andrei Neagoe** și **Adrian Popescu**.

Problema de rezolvat: clienții trimit liste de cantități în Excel, fiecare în
alt format, iar tarifarea se face manual, linie cu linie — 300+ linii pe
proiect, câteva ore, cu greșeli invizibile.

Materialul sursă stă în `../attachments/` și **nu e commit-uit** — conține
prețurile reale ale firmei. E grupat pe ce înseamnă, nu plat: `preturi/` pe
segment (rezidențiale / industriale / rafinărie) plus listele marcate „NUUUU"
de firmă, și `clienti/` pentru listele de cantități și ofertele trimise pe ele.
Inventarul complet, cu ce lipsește din fiecare segment și cu numele
cu care au venit fișierele (redenumite pe 13 septembrie 2026: scurte, fără
spații — `clienti/cerere-de-oferta-transavia-abur.xlsx`), e în
`../attachments/README.md`. ETL-ul caută fișierele după nume, recursiv, deci
gruparea nu-l afectează.

## Ce e construit

**Motorul de prețuri** (`src/pricing/`) — determinist, fără AI, izomorf
(rulează identic în Node și în browser). Reproduce pozițiile reale facturate din
Oferta 118 / 27.04.2026, inclusiv cele compuse din trei straturi și totalurile
pe linie, plus toate cele 53 de poziții din oferta 118.1 de închideri goluri la
foc (12.692,04 €, exact totalul semnat). Din 7 septembrie 2026 reproduce și
Oferta 284: **13 din 13** linii verificate direct, la bănuț. Regulile complete
sunt în `pricing.md`; ce s-a schimbat atunci — regula de serie, jacheta în sus,
multiplicatorii pe strat, toleranța de capăt de listă — e mai jos, la „Ce am
descoperit".

**`tabla_inox` e sistem de sine stătător** (7 septembrie 2026). Înainte,
promptul mapa explicit inoxul pe `tabla`, adică pe lista de **aluminiu**. E
singurul sistem fără listă rezidențială, deci `lista("tabla_inox")` întoarce
lista industrială — nu ca alegere de segment, ci fiindcă e singura care există.
Poziția primește `note` că amestecă destinații. Întrebarea 15 rămâne.

**Pipeline-ul de import** (`src/import/`) — L0 parsare fizică, L2a extragere
deterministă (~55% din linii), L2b completare cu OpenAI prin structured outputs
pe reziduu, L3 tarifare. Rulat pe lista reală a unui spital: 191 poziții
detectate, 63% tarifate automat. Rulează identic din CLI și din aplicație, când
aceasta e pornită local (`npm run dev`): pe `cerere-de-oferta-transavia-inox.xlsx` ambele dau
72 poziții, 39 tarifate, 6.034,70 €. Pe `oferta-118-1-matari-goluri-foc.xlsx`
(închideri goluri la foc): 53 de poziții, 100% tarifate determinist, fără niciun
apel la model.

**L1 — rolurile coloanelor** (`src/import/mapare.ts`) — modelul propune maparea
pe blocul de antet, un apel per layout, iar un validator determinist o acceptă
sau o respinge după conținutul coloanelor. Pe fișierele reale: 8 mapări
acceptate, 2 respinse. Cantitățile față de oferta semnată au trecut de la
**0/56 corecte la 56/56** — euristica veche citea prețul unitar drept cantitate.

**L4 — memoria de șabloane** (`src/import/memorie.ts`) — ce a corectat omul o
dată nu se mai întreabă. Se memorează rolul și harta sloturilor, nu valorile;
se învață doar din corecția umană, niciodată din ce a zis modelul.

**Deduplicarea reziduului** (`src/import/sabloane.ts`) — un reprezentant per
șablon pleacă la model, restul se deduc: −54% linii trimise (697 → 321), cu
rezultate identice pe golden files.

**Capcana SPIRO, făcută vizibilă** (7 septembrie 2026) — tubulatura spiro scrisă
`DN` se tarifa pe seria de țeavă de oțel: `DN125` ieșea **13,74 €/ml** (rândul
140) în loc de 11,36 (rândul 125), adică **+21%, tăcut**. Inversarea era ce o
făcea periculoasă: cazurile sigure dădeau eroare și se vedeau (ø160, ø250, ø315
nu există în tabelul de oțel), iar cele periculoase treceau neobservate, tocmai
fiindcă 125 și 200 există și se convertesc „cu succes". Cauza: `valideazaExtragere`
nu se aplică liniilor `sursa: "regex"`, iar SPIRO e prins chiar de `RE_DN`, deci
pe calea deterministă nu trecea pe la niciun validator.
`notatieContraziceMaterialul` rulează acum **indiferent de sursă** (excepție
`"om"`) și aprinde 16 linii pe cele 10 fișiere. **Nu schimbă niciun preț** —
poziția e marcată și merge la om. Pe 11 septembrie 2026 firma a răspuns („la spiro
este doar diametru exterior"), deci extragerea citește SPIRO direct ca exterior;
ø160 rămâne marcat, dar pentru rotunjire (întrebarea 3), nu pentru notație.

**Guardrails pe stratul cu model** (`src/import/valideaza.ts`) — verificare
deterministă a ceea ce iese din model, față de textul sursă: numere care nu
apar în linie, DN inexistent, grosime pe care sistemul ăla nu o ofertează,
formă care contrazice unitatea de măsură. Un avertisment anulează încrederea
raportată de model și trimite poziția la validare umană. Modelul e pinuit pe
**snapshot datat**, iar `tests/golden/` ține ieșirea lui reală pe fișiere de
client, ca deriva să se vadă. Detaliile în `import.md`.

**Ieșirea ofertei** (`web/oferta.ts`, `web/descarca.ts`) — din 7 septembrie 2026
importul nu se mai oprește în grilă. Butonul „Generează oferta" produce un
registru `.xlsx` cu trei foi: `Ofertă` (doar pozițiile cu preț **și** nemarcate,
în layoutul ofertei 284 reale), `De validat` și `Netarifate`, ultimele două cu
motivul scris pe fiecare rând. Verificat cap-coadă: `oferta-118-1-matari-goluri-foc.xlsx` importat determinist dă un registru cu 53 de poziții și total
**12.692,04 €**, adică exact totalul ofertei semnate. `web/oferta.ts` e pur,
fără DOM, deci se testează în Node ca motorul; `Blob` și `<a download>` stau
singure în `web/descarca.ts`. Detaliile în `ui.md`.

**Nicio poziție fără preț nu mai rămâne fără cauză.** `tarifeazaExtras` întorcea
`{}` când sistemul era cunoscut dar diametrul lipsea: fără preț, fără eroare,
fără cod și — dacă modelul raportase încredere peste prag — fără să fie nici
marcată. Se vedea exclusiv ca diferență între două contoare, iar pe `cerere-de-oferta-spital.xlsx`
însemna ~45 din 51 de poziții netarifate invizibile în blocul de cauze. Codul
`fara_diametru` acoperă cazul (tubulatură **rectangulară**, care chiar n-are ø,
ci A×B — conversia e în `tevi.md`, neimplementată). Un test exhaustiv peste toate
combinațiile de câmpuri garantează acum: **ori preț, ori cauză, niciodată
tăcere.**

**Cauzele netarifării, ca valori** (`CodNetarifare` în `src/pricing/types.ts`) —
`PozitieNetarifata` poartă un cod stabil lângă mesaj, iar ecranul grupează pe
el: „Ce blochează 130 de poziții — 64 niciun strat n-are coeficient pe banda lui
(întrebarea 9), 43 grosime care nu există în listă, 15 diametru peste maximul
listei (întrebarea 4), 8 DN inexistent în seria de oțel (întrebarea 10)".
Mesajele nu s-au schimbat: textul rămâne pentru citit, codul e ce se poate
număra. Fiecare click filtrează grila prin lentila existentă.

**Istoricul importurilor** (`web/istoric.ts`) — ultimele 10 importuri în
IndexedDB: fișierul, extragerile și corecțiile omului, nu grila (aceeași parsare
pe aceiași bytes o reface). Reîncărcarea paginii nu mai pierde munca, iar
redeschiderea unui import vechi **nu cheamă modelul din nou**. Detaliile în
`ui.md`.

**Aplicația** (`web/`) — 9 ecrane: tablou de bord, lucrări, cereri și oferte,
calcul deviz, import Excel, șantier (pozele din carnet), depozit și stoc
(prototip), clienți, liste de prețuri. Datele sunt reale,
extrase din fișierele firmei. Paleta și tipografia respectă WCAG AA; detaliile
în `ui.md`. Bara laterală se pliază la o bandă de pictograme pe ecran larg
(preferință reținută) și glisează ca sertar pe ecran îngust.

**Baza de date** (`src/db/`) — Postgres 18 local în Docker, Drizzle, migrări
commit-uite. Izolarea între tenanți e impusă de bază prin row-level security,
nu de `where`-uri în cod; listele de prețuri sunt documente versionate,
imutabile după activare, cu trigger care refuză editarea. Catalogul din bază e
verificat că e identic cu cel din fișiere — cât timp testul ăla trece, cele
130 de teste ale motorului se aplică și prețurilor din bază. Detaliile în
`backend.md`.

**Infrastructură** — CI (typecheck + teste + semnalarea modificărilor de
prețuri), verificare care respinge trailerele de atribuire AI, deploy automat
pe GitHub Pages: <https://andreineagoe23.github.io/izorep/>

## Decizii luate

**Motorul nu extrapolează tăcut.** Până pe 25 septembrie 2026, peste ultimul
rând din listă arunca `PozitieNetarifata`. De atunci aplică formula scrisă a
firmei pe mp, dar poziția iese **marcată** (`peste_lista`): pe Oferta 27.04.2026
formula dă exact DN250 / 19 mm, iar SPIRO ø250 / ø315 au fost semnate cu 0,13 €
peste ea. La fel golul din matrice: se deduce doar din rândul imediat următor,
tot marcat. Fără preț pe mp (PVC peste ø710), poziția rămâne refuzată.

**RAG-ul a fost respins pentru citirea Excel-urilor.** Datele sunt deja
localizate în celule; problema e mapare, nu regăsire. Chunking-ul rupe rândul
de antet, iar embeddings-urile confundă DN80 cu DN100. Soluția e extragere cu
schemă închisă (5 câmpuri, domenii enumerate) plus memorie per client.
Detalii în `import.md`.

**Stratul cu model rulează local, nu pe Pages.** Cu `npm run dev` și cheia în
`.env`, ecranul de import face pipeline-ul complet: ruta `/api/extrage` din
`scripts/vite-plugin-model.ts` există doar pe serverul de dezvoltare, deci cheia
nu ajunge în pagină și nu poate ajunge într-un build. Pe Pages ruta lipsește și
ecranul cade curat pe stratul determinist.

**Ce iese din model se verifică determinist, nu se crede pe cuvânt.** Zod
validează forma răspunsului, nu sensul lui: `diametru_valoare: 76` trece
perfect și când în linie scria `Di60`, cu încredere raportată 0,95. Regulile de
plauzibilitate stau în cod, cu teste, nu în prompt — o regulă din prompt e o
rugăminte, una din cod e o verificare. Aplicarea e în `extrageCuModel`, singurul
punct prin care trec toate căile.

**Modelul e pinuit pe snapshot datat, nu pe alias.** `gpt-4.1` e mutat de
OpenAI pe alt model fără ca nimic din repo să se schimbe — aceleași fișiere,
alte prețuri, zero urme în `git log`. Implicitul din cod e
`gpt-4.1-2025-04-14`, iar golden files spun când răspunsul începe să difere.

**Nu inventăm identificatori pentru firme reale.** CUI-urile și telefoanele din
`web/date/seed.ts` sunt `null` și se afișează „—". Un CUI plauzibil dar greșit
costă mai mult într-un demo decât o casetă goală.

**Meniul conține doar ecrane care există.** Modulele nelivrate stau într-un
`<details>` pliat sub meniu. Harta sistemului rămâne vizibilă pentru client, dar
nu mai ocupă jumătate din navigația zilnică.

**Cererile și ofertele sunt un singur ecran.** Sunt același obiect în stadii
diferite ale aceluiași flux; două ecrane separate ascundeau exact lanțul
cerere → ofertă → contract → situație.

**Culoarea de acțiune e separată de culorile de stare.** Accentul e albastru,
starea rămâne verde/chihlimbar/roșu, iar roșul înseamnă doar eroare. Accentul
maro anterior era, pentru un daltonist, aceeași culoare cu avertizarea. Neutrele
sunt reci în ambele teme: sub accent albastru, un fundal cald arăta maro în
tema închisă și se bătea cu albastrul.

**Tema se alege din aplicație**, cu un comutator Sistem / Deschis / Închis
salvat în `localStorage`. Înainte, tema urma orbește sistemul și nu se putea
schimba din interfață.

## Prețurile pe destinație (4 septembrie 2026)

> Istoric. Din 12 septembrie 2026 motorul tarifează și pe industrial, cu
> segmentul ales de om la import — vezi „10–13 septembrie 2026", mai jos.

Firma a spus că listele sunt de **trei feluri**: rezidențiale, industriale,
rafinărie — prima axă din `liste-preturi.md`. Am primit primele două;
**rafinăria nu a venit încă**.

- **Rezidențiale** — cele 5 pe care le aveam deja. Zip-ul nou e identic ca
  conținut; `L.pret elastomer` diferă doar la nivel de bytes (re-salvat pe
  4 iunie 2026), celulă cu celulă aceleași valori. Nu e o listă nouă.
- **Industriale** — 4 fișiere noi: vată minerală, elastomer, tablă aluminiu și
  **tablă inox**, sistem pe care motorul nu-l are deloc. Inoxul e jachetare, ca
  aluminiul: ø80–ø710 din 10 în 10, grosimi 0,4 / 0,5 / 0,6 mm, 192 de celule
  pline (aluminiul are 63, rare). Lipsesc PVC și închiderile goluri la foc.
- **Rafinărie** — nimic.

**Industrialul nu e un coeficient peste rezidențial**, deci nu se poate ține ca
multiplicator: vata e ×1,25 constant, elastomerul e ×1,25 la 9/13/19 mm dar
**×1,20** la 25/32 mm, iar tabla variază pe rând în jurul lui ×1,10–1,11.
Trebuie stocate ca liste proprii, versionate pe destinație.

**Motorul rămâne pe rezidențial. Baza le ține pe amândouă.**
`data/price-lists/*.json` — ce importă static `src/pricing/lists.ts` — e
neatins, verificat byte cu byte după regenerare. Industrialul stă separat, în
`data/price-lists/industrial/`, și intră în `lista_preturi` cu destinația lui.

Împărțirea e deliberată: motorul ar trebui să afle de undeva *care* destinație
se aplică unei lucrări, iar regula aia nu există încă (întrebarea 12). Un motor
care cunoaște două liste și nu știe să aleagă între ele e mai prost decât unul
care cunoaște una singură și o spune.

Riscul concret, prins cu test: cu două liste active pe același sistem,
interogarea veche — filtru pe sistem + status, `order by valabil_de_la desc` —
ar fi ales-o tăcut pe cea industrială, fiindcă e mai recentă. Vata industrială
e ×1,25, deci toate ofertele ar fi ieșit cu 25% mai mari fără nicio urmă.
`catalogDinBaza` cere acum destinația explicit. Detalii în `backend.md`.

Ce s-a mai adăugat în bază: **seriile de diametre pe material** (oțel, cupru,
PP-R, PE-HD, PE-Xa, PVC, spiro — 141 de rânduri) și cele 34 de secțiuni
standard de tubulatură rectangulară, din registrul de conversie ml → mp.
Sunt norme, deci tabele globale, fără `tenant_id` și fără RLS. Motorul încă nu
le folosește: azi `dn-table.ts` aplică tabelul de oțel tuturor materialelor,
deci o poziție DN15 de cupru se caută pe rândul 22 în loc de 18.

## Ce am descoperit din datele reale

**Regula de potrivire pe rând diferă după notația diametrului.** La DN de oțel
se caută rândul cel mai apropiat (rândurile listei *sunt* seria standard); la
diametru exterior (plastic, PEHD, SPIRO) se rotunjește în sus, pentru că mufa
de izolație trebuie să încapă peste țeavă. Regula asta singură repară 3 poziții
care ieșeau greșit.

**Diametrul geometric pornește de la rândul primului strat**, nu de la
diametrul real, și crește cu 2 × grosime. La egalitate între două rânduri se
alege rândul superior. Asta reproduce ambele poziții compuse din oferta 118.

**Închiderile goluri la foc au preț aditiv**, nu matrice: golul după suprafață,
plus banda WRAP, plus colierul. Pragurile sunt scrise „Goluri până la 0,05 mp",
deci limita superioară e inclusivă — se vede la golurile de 0,60 și 0,90 mp
exact. Clasa EI e etichetă de grupare, nu variabilă de preț: aceeași conductă
DN15 costă 23,05 € și la EI30, și la EI120.

**Banda WRAP are două liste, după materialul conductei.** La ø140 sunt 12,19 €
pe oțel și 65,67 € pe plastic, pentru că numărul de înfășurări diferă. Extragerea
le citea ca pe una singură și tăia tabelul de oțel după primul rând — deci ø140
oțel ar fi fost tarifat de cinci ori prețul real. Reparat în ETL, cu test.

**Trei abateri reale rămân**, documentate în blocul „abateri cunoscute" din
`tests/pricing.test.ts`: ø90 PEHD (0,55 €/ml diferență), ø160 tarifat diferit
ca țeavă PEHD față de tubulatură SPIRO în aceeași ofertă, și rotunjirea la
stratul de jachetă.

**Modelul nu întoarce toate liniile pe care le primește.** Contractul e „câte
un obiect per linie, cu același index"; pe `oferta-118-nisal.xlsx` au plecat
43 de linii și s-au întors 35. Liniile lipsă nu apăreau nicăieri în raport, deci
un fișier ciuntit arăta ca un fișier cu mai puține poziții. Acum se numără
(`modelFaraRaspuns`).

**Tabelul de conversie DN, primit de la firmă, confirmă exact ce era în cod.**
Coloana ISO coincide valoare cu valoare cu `DN_TO_OD` pe tot intervalul
DN10–DN400 — dedus din listele de cantități, validat independent de sursă.
Restul notițelor (cupru/inox pe altă serie, tubulaturi rectangulare, formula
pentru diametre peste ultimul rând) stau în `tevi.md`, cu întrebările deschise.

**Notele de la finalul ofertei erau citite ca poziții.** „Preturile se refera la
inchideri goluri la foc EI60", „nu sunt incluse colierele si banda wrap" conțin
exact cuvintele după care se recunoaște sistemul. Regula care le scoate e
fizică, nu semantică: un rând fără unitate de măsură **și** fără cantitate nu e
poziție. Pe cele 9 fișiere, 513 poziții devin 441, iar cele tarifate rămân 261.

**Lista de manoperă are altă structură** decât matricea completă: tarif plat pe
sistem și grosime (2,20 / 2,30 / 3,00 €/ml), nu matrice ø × grosime. Nu e o
coloană a aceleiași linii, e o listă separată.

**Lista de inox lipsea, dar lucrările de inox nu.** `cerere-de-oferta-transavia-inox.xlsx`
are **72 de rânduri** care spun „tabla de inox 304" — practic tot fișierul.
Neavând listă, `extract-llm.ts` mapa explicit inoxul pe `tabla`, adică pe lista
de aluminiu, iar cele 39 de poziții tarifate din el (6.039,90 €) au ieșit pe
lista greșită. Inoxul e mult mai scump: la ø90, 30,89 € (0,4 mm) față de
17,08 € (aluminiu 0,6 mm). Lista industrială de inox rezolvă asta — dar abia
după ce motorul capătă sistemul și regula de segment.

**Prima pereche cerere → ofertă pe aceleași rânduri.** `cerere-de-oferta-transavia-abur.xlsx` (99 rânduri) și
`oferta-284-transavia-abur.xlsx` sunt același proiect, întrebat și răspuns.
Până acum aveam ori cereri, ori oferte, niciodată perechea — deci nu se putea
măsura tarifarea fără să ghicim ce a fost întrebat.

**Lucrarea e industrială, dar a fost tarifată pe lista rezidențială.** Transavia
Alba-Iulia, abur, beneficiar Grup Energoinstal. Pe cele 30 de linii distincte
`Di<ø>, g<gr>` (vată + tablă de aluminiu), prețurile ofertei ies **exact** din
listele rezidențiale; pe cele industriale ar fi ieșit cu 25% mai mult. Deci
segmentul nu se deduce din tipul lucrării — cineva îl alege. Întrebarea 12.

**Regula de rând se confirmă pe straturi diferite: primul strat cel mai
apropiat, jacheta în sus.** Măsurat pe cele 30 de linii, cu cele patru
combinații posibile:

| primul strat / jachetă | potriviri exacte |
|---|---|
| în sus / în sus | 15 / 30 |
| în sus / cel mai apropiat (motorul de azi, pe `interior`) | 12 / 30 |
| **cel mai apropiat / în sus** | **18 / 30** |
| cel mai apropiat / cel mai apropiat | 15 / 30 |

Cifrele astea le înlocuiesc pe cele înregistrate inițial (23 / 21 / 27 / 24),
care erau greșite: măsurătoarea veche nu rula `multiplicator()` din motor, deci
nu contoriza ca eșec cele **10 linii pe care motorul le refuză în toate cele
patru combinații** — 3 la Di21 g40 (lista n-are celula `22|40`) și 7 coturi/teuri
de vată pe banda 18–60, unde coeficientul e `null`. Raportat doar la cele 20 de
linii pe care motorul dă vreun preț: 15 / 12 / **18** / 15. Ordinea e neschimbată.

Cele două linii care despart variantele sunt Di114 (geometric 214, între
rândurile 210 și 220 — oferta ia 220) și Di273 (geometric 393 — oferta ia 400).
Asta e exact „rotunjirea la stratul de jachetă" din blocul de abateri
cunoscute, acum cu dovadă independentă: **jacheta se rotunjește în sus**.

Diametrele sunt scrise `Di21, Di27, Di34, Di49, Di60, Di76, Di89, Di114, Di140,
Di169, Di273` — adică seria de țeavă de oțel rotunjită (21,3 · 26,9 · 33,7 ·
48,3 · 60,3 · 76,1 · 88,9 · 114,3 · 139,7 · 168,3). Notația spune „exterior",
dar rândurile *sunt* seria standard, deci se aplică regula de la `tip: "DN"`.
Motorul leagă azi regula de notație, nu de serie: pe fișierul ăsta ar rotunji
în sus și ar rata Di49, Di169 și Di273.

**Coturile și teurile de vată sub ø76 se facturează doar cu jacheta.** Banda
18–60 nu are coeficient de cot/teu în lista de prețuri (întrebarea 9), dar
oferta le tarifează: Di21 și Di27 = 17,78 €, Di34 = 18,12 €, Di49 = 18,48 €,
Di60 = 18,83 €. Fiecare e **exact** prețul tablei la rândul geometric
(ø110, ø110, ø120, ø130, ø140) — stratul de vată nu intră în preț.

**Nouă poziții din nouă**, nu cinci cum se scrisese prima dată: cot și teu la
Di21, Di27, Di34, Di60, plus cot la Di49 (teu nu există acolo). Cinci diametre,
două forme, exacte la bănuț pe o ofertă semnată.

Regula generalizează fără caz special: **un strat al cărui sistem n-are
coeficient pentru forma cerută pe banda lui contribuie cu geometria — rândul și
grosimea, pentru diametrul stratului următor — dar nu cu prețul.** La Di60 cot
vata iese, tabla intră cu ×1 → 18,83 €. La Di114 cot ambele au coeficient, deci
nimic nu se schimbă și abaterea de 76,43 față de 45,24 rămâne exact cum era.

Consecință care nu se vedea din formularea veche: la Di21 stratul de vată nu
mai e nici măcar căutat în matrice, deci lipsa celulei `22|40` nu mai blochează
poziția — Di21 cot și teu devin tarifabile la 17,78 €. Di21 **ml** rămâne
netarifat, corect: acolo vata are coeficient 1, deci e inclusă, deci celula
lipsă oprește poziția.

Intră în cod cu preț **plus notă de proveniență**, iar poziția trece obligatoriu
pe la om. Rămâne de confirmat cu firma (întrebarea 9).

**Două abateri rămân pe oferta asta.** Di114 cot și teu sunt 76,43 € în loc de
45,24 € (banda 76–114 spune ×1 pentru cot; raportul real e 1,689 — nu e niciun
coeficient din tabel). Iar Di21 la 40 mm pe metru liniar e 25,68 € față de
25,73 € calculat: lista noastră n-are ø22 la 40 mm, iar motorul cade pe ø28.

**Ce a intrat în cod pe 7 septembrie 2026.** Patru reguli, toate cu dovadă
măsurată, plus o a cincea care e o corecție a uneia dintre ele:

1. **Regula de serie, nu de notație** — `peSeriaDeOtel`, toleranță 0,8 mm.
   Pragul e ales pe date: maximul măsurat e 0,70 (Di49, Di169), iar ø90 e la
   1,1 de 88,9 și ø75 la 1,1 de 76,1, deci plasticul nu se confundă cu oțelul.
   Doar pe `interior`; pe `exterior` nu se schimbă nimic.
2. **Jacheta se rotunjește în sus** — după **material** (`tabla`, `tabla_inox`),
   nu după poziția în stivă. Prima variantă lega regula de „ultimul strat" și
   dădea același rezultat pe datele de azi, dar predicatul se rupe la prima
   poziție cu altă ordine. Motivul fizic e materialul: tabla se croiește pe
   șantier la măsura superioară, manșoanele vin în alezaje fixe și se ia cel mai
   apropiat — de-aia stratul de vată din mijloc la DN80 compus rămâne pe 114.
3. **Multiplicatorii se aplică pe strat**, iar straturile fără coeficient pe
   banda lor ies din preț păstrându-și geometria. Asta rezolvă cele 9 poziții
   de cot/teu sub ø76.
4. **Toleranță de 0,5 mm la capătul listei.** DN200 (ø219,1) cădea cu 0,1 mm
   peste ultimul rând al elastomerului, care e 219 — adică exact DN200.
5. **Corecție la 3, găsită de testul golden.** Excluzând stratul de vată din
   preț, îi dispărea și verificarea grosimii — iar `Di60, g48` (48 mm nu se
   ofertează la vată, în niciun segment) a început să se tarifeze la 19,45 €.
   Greșit: `geometric = rând + 2 × grosime`, deci grosimea stratului exclus
   decide rândul jachetei. Un strat scos din preț nu e un strat inexistent.
   Regula corectă: îi trebuie o grosime **ofertată de sistem**, nu îi trebuie
   celula `rând|grosime`. Separă exact `Di21 g40` (40 e ofertat, celula `22|40`
   lipsește → 17,78 €) de `Di60 g48` (48 nu e ofertat → rămâne netarifat).
   Fixtura golden avea dreptate; nu s-a re-înregistrat nimic.

**Inoxul nu se tarifează automat, și ăsta e răspunsul corect.** Lista de
aluminiu e **rară** — exact o grosime per diametru — deci grosimea jachetei e
implicită și poziția iese cu preț fără ca textul să spună ceva. Lista de inox e
**densă**: toate cele trei grosimi (0,4 / 0,5 / 0,6) la fiecare din cele 64 de
rânduri, 192 de celule pline. Textul clientului nu spune niciodată grosimea
jachetei — „tablă de inox 304", atât — deci `grosimeEfectiva` nu mai are ce
deduce și poziția iese „grosime nespecificată și ambiguă".

Deci cele 39 de poziții din `Izolatii Transavia` nu trec de la *preț greșit* la
*preț corect*, ci de la **preț greșit, tăcut** la **poziție marcată**. La rândul
140, aceeași poziție e 18,83 € pe aluminiu și 45,57 € pe inox 0,5 mm — de 2,4
ori. Un număr fals cu care semnezi o ofertă e mai scump decât o casetă goală.

Rezultă o întrebare nouă, îngustă și ușor de răspuns, care deblochează 72 de
rânduri dintr-un singur fișier: **care e grosimea implicită de tablă de inox?**
E acum partea concretă a întrebării 15.

**Golden files erau decalate față de prompt** (re-înregistrat pe 13 septembrie
2026; paragraful rămâne ca istoric). `tests/golden/` conține
ieșirea modelului de **dinainte** ca promptul să știe de `tabla_inox`: liniile
de inox din `Izolatii Transavia` sunt înregistrate cu `{"sistem": "tabla"}`,
adică pe lista de aluminiu. Testul trece — el rejoacă partea deterministă peste
ce e înregistrat — dar înregistrarea nu mai reprezintă ce ar răspunde modelul
azi. Re-înregistrarea costă un apel real:
`npm run golden -- ../attachments/clienti/cerere-de-oferta-transavia-inox.xlsx`.

**Efectul pe fișierele reale, doar pe stratul determinist** (`--fara-model`,
cele 10 fișiere din `attachments/clienti/`):

| | înainte | după |
|---|---|---|
| poziții de izolație | 505 | 505 |
| tarifate | 370 (73,3%) | **375 (74,3%)** |
| valoare | 700.130,82 € | 717.230,26 € |

Cifra mică e înșelătoare și merită spus de ce: pe calea deterministă nu se
construiesc `straturi_extra`, deci fiecare poziție e un singur strat. Regula 3
și `tabla_inox` lucrează numai pe poziții **compuse**, adică pe cele care trec
prin model. Acolo se vede efectul, iar dovada lor sunt testele unitare și
golden files, nu sweep-ul. Valoarea s-a schimbat și în minus pe unele fișiere
(Oferta 284: 24.052 → 23.788 €) — corect: regula de serie mută Di49 de pe
rândul 54 pe 48, care e mai ieftin și e cel din oferta semnată.

## Acoperirea față de ofertele semnate (actualizat 25 septembrie 2026)

Din cele 9 fișiere de client, **4 sunt oferte** cu rând de TOTAL — restul sunt
cereri, n-au cu ce fi comparate. Măsurat pe `--fara-model`, comparând registrul
generat cu totalul semnat. `tests/oferte-semnate.test.ts` ține cifrele ca
clichetă: dacă cresc, se actualizează; dacă scad, s-a stricat ceva — sau e o
scădere deliberată, explicată în `deCe`.

| Ofertă semnată | pe ofertă (7 sep → 13 sep → 15 sep → 25 sep) | generat | semnat | |
|---|---|---|---|---|
| Matari (goluri foc) | 53 → 53 → 53 → 53 | 12.692,04 | 12.692,04 | **100%** |
| Oferta 27.04.2026 | 29 → 39 → **41** → **45** | 156.805,03 | 170.519,39 | 92% |
| Oferta 284 Transavia | 61 → 85 → 85 → **85** | 75.611,04 | 94.575,06 | 80% |
| Anexa 1 / 06.12.2024 | 0 → 0 → 0 → 0 | 0,00 | 706,90 | **0%** |

Pe 25 septembrie, cifrele de mai sus se referă la foaia `Ofertă` fără nicio
confirmare. Oferta 284: 98 de prețuri calculate, toate exacte; 13 stau la „De
validat” (celula 22|40 dedusă) și ajung în ofertă cu un clic, iar singura
poziție fără preț e distribuitorul de abur. Vezi „Cererea TRANSAVIA
reprodusă”, mai jos.

Distincția care contează: **nu e o problemă de preț, e una de acoperire.**
Prețurile pe liniile care ies sunt comparate linie cu linie cu oferta semnată:

- **Oferta 284** — **83 din 85** de prețuri unitare exacte. Cele două diferite
  sunt `Di169, g50 - COT` cu UM `ml` în fișierul clientului: UM-ul decide forma,
  deci iese prețul pe ml (51,44), oferta are cotul (102,88). E fișierul, nu
  motorul. Restul de 13 netarifate sunt grosimi inexistente în listă. Din 25
  septembrie 2026 cele două coturi nu mai ies „Gata”: textul (COT) și UM-ul
  (`ml`) se contrazic și dau prețuri diferite, deci poziția merge la om.
- **Oferta 27.04.2026** — **43** de prețuri exacte (erau 20, apoi 37). Ce diferă
  e marcat: ø90 și ø160 (rotunjire, întrebarea 3), 3 peste maximul listei
  (întrebarea 4), grosimi inexistente. Rândurile 44–47 (DN20–DN40), care
  păreau o inconsecvență a ofertei, ies acum exact — vezi „15 septembrie 2026".
- **Anexa 1 — zero e răspunsul CORECT.** Vezi mai jos.

**Anexa 1 e o ofertă de MANOPERĂ, și forțarea acoperirii ar fi cea mai scumpă
greșeală posibilă.** Fișierul are altă formă: descrierea stă în antetul de
secțiune („1. Izolatii conducte PPR cu Armaflex gr. 9 mm - **manopera** :"), iar
rândurile de date sunt numai cifre — `1 | 22 | 2,3 | m | 20 | 46` — deci
`construiesteLinie` nu le vede ca linii (n-au text). Prețurile semnate sunt
2,20 / 2,30 / 3,00 €/ml, adică exact tariful plat de manoperă din
`liste-preturi.md`. Motorul are doar liste **material + manoperă**:

| poziție | motorul | semnat | raport |
|---|---|---|---|
| Armaflex g13 ø22 | 5,99 € | 2,30 € | **2,6×** |
| Armaflex g13 ø48 | 8,84 € | 2,30 € | **3,8×** |
| vată g30 ø28 | 6,86 € | 2,20 € | **3,1×** |

Aceeași capcană ca la SPIRO, dar de trei ori mai mare. `randuriManopera` din
`Statistici` recunoaște fișierul după marcajul „manoperă" din secțiuni și
aprinde o alertă în ecran și în CLI, ca zero-ul să spună **„n-avem lista"**, nu
să arate ca o foaie goală. Se aprinde pe exact un fișier din zece.

## 10–13 septembrie 2026: segmentul, răspunsurile firmei, reparații

**Răspunsurile firmei din 11 septembrie 2026**, intrate în cod de Adrian:

- **SPIRO** — „la spiro este doar diametru exterior". `extract-regex.ts` îl
  citește direct ca exterior (întrebarea 10).
- **Coturile și teurile de vată sub ø60** — regula e a firmei (întrebarea 9).
  Nota rămâne pe poziție, validarea obligatorie a căzut.
- **Grosimile uzuale** când clientul nu scrie grosimea: vată 20–100 mm după
  DN, elastomer 13/19/25 mm după ø. Tabelul dedus din Oferta 284 (40/50/60)
  era o **excepție** a clientului TRANSAVIA, nu regula. Detalii în `pricing.md`.

**Ce a mai intrat (Adrian, 10–12 septembrie 2026).** Ecranul de liste arată
listele pe segmente, inclusiv închiderile la foc. Motorul tarifează pe segmentul
ales la import (comutatorul „Tipul ofertei") prin `listaDe`, cu notă de
verificat unde segmentul n-are lista unui material. Extragerea deterministă vede
toate materialele de pe un rând (`straturi_extra`), iar liniile extrase pe
jumătate rămân poziții marcate, nu dispar. Grila are coloane de preț. Pe Oferta
284 prețurile exacte au urcat de la 0 la 83 din 85.

**Ce a găsit verificarea din 13 septembrie 2026 și s-a reparat.** A/B linie cu
linie pe cele 10 fișiere de client, comparație cu prețurile semnate, și un test
cap-coadă în browser (import → segment → grosimi → confirmare → registru →
reîncărcare):

| Problemă | Efect măsurat | Acum |
|---|---|---|
| Registrul scria „destinația rezidential" fix | ofertă industrială cu proveniență falsă | scrie segmentul ales |
| Segmentul nu se salva în istoric | import redeschis pe alt segment, alte prețuri | se salvează și se reface |
| „Completează grosimi" punea `sursa: "om"` | 24 de casete plecau în ofertă nevalidate | rămân de validat |
| Poziție confirmată, dar cu notă de verificat | confirmarea n-avea efect, nu ajungea în ofertă | confirmarea o eliberează |
| Grosimi propuse pe `Di34/Di49/Di89` | 30/50/100 mm în loc de 20/40/80 | pe seria de oțel |
| Elastomer DN50 / DN200 | 19 / 25 mm în loc de 13 / 19 | cu toleranța de capăt de rând |
| „Tablă zincată" = materialul tubulaturii (Book15) | jachetă adăugată, +90…250%, nemarcat | nu mai e jachetă |
| „Treceri prin pereți" la țevi (Radoia) | 58 de închideri de gol false | cere context de foc |
| `Ø1/2"`, `Dn 1 1/4"` | citite φ1 / DN1, 5,70 € pe toate | DN15…DN50, exacte |
| `PEHD D40x3.0` | 11 poziții fără diametru | exterior 40…250 |
| „13mm+40mm vata minerala" | DN80/DN100 compus netarifat | 44,35 / 57,82, exacte |
| ø90 / ø160 rotunjit în sus, tăcut | oferta semnată a luat și rândul de jos | preț + notă, întrebarea 3 |
| Închideri la foc pe industrial | preț rezidențial fără notă | notă, ca PVC |
| Grosime ambiguă → „întrebarea 15" | trimitea casetele de vată la o întrebare despre inox | 15 doar la inox |

Golden file-ul `izolatii-transavia.json` e **re-înregistrat** pe 13 septembrie
2026 cu promptul care știe de `tabla_inox`; decalajul de mai sus nu mai există.

## 15 septembrie 2026: DN lângă Ø, straturile în editor, descrierea după verificare

Verificare cerută de Andrei: conversia DN → φ, editarea cu mai multe straturi,
recalcularea după o descriere schimbată, și cererile față de oferte. A/B linie cu
linie pe cele 10 fișiere de client, comparație cu prețurile semnate și test
cap-coadă în browser, la 1440 și 390 px.

**Conversia DN → φ e corectă.** Pe cele 231 de linii DN din fișiere, fiecare DN
trece pe coloana ISO și pe rândul cel mai apropiat: DN15 → 22, DN20 → 28,
DN25 → 35, DN32 → 42, DN40 → 48, DN50 → 60, DN65 → 76, DN80 → 89, DN100 → 114,
DN125 → 140, DN150 → 168/169, DN200 → 219, DN250 → 273.

| Problemă | Efect măsurat | Acum |
|---|---|---|
| „DN20" în germană, „Ø20mm" în română (NISAL 44–47) | tarifat pe ISO: 5,99 / 6,15 / 8,29 / 8,45, nemarcat | Ø-ul care nu e DN-ul în tabelul de conversie câștigă: 5,79 / 5,99 / 6,15 / 8,29, ca oferta |
| `DN150din`, `Ø32mm`, `Ø50mm` lipite de text | fără diametru (Transavia inox r70, NISAL r76–77) | se citesc; NISAL r76–77 exacte |
| „tablă de inox 0,5 mm" în descriere | grosimea ignorată, inoxul rămânea fără preț | citită, doar din grosimile listei; „0.6 – 0.8 mm" rămâne a omului |
| DN citit de model lângă un Ø care nu-i corespunde | nemarcat | `diametru_contrazis`, la validare |
| Descriere schimbată după „Modifică" sau „Confirmă" | prețul rămânea pe textul vechi, „Gata" (45,24 €/ml după scoaterea tablei) | recitită, „De verificat", cu „Anulează" |
| Descriere schimbată pe o linie citită de model | extragerea veche se păstra | recitită determinist, marcată |
| Editorul: un material, diametru, grosime | jacheta nu se putea scoate sau adăuga, grosimea inoxului nu se putea pune | straturi cu material și grosime, formă, descriere, UM, cantitate, „Citește din descriere" |
| φ nu se vedea nicăieri la import (16 sep) | „DN100" și „Ø100" arătau la fel pe ecran, deși unul caută ø114,3 și celălalt ø100 | eticheta scrie „DN100 = ø114,3", iar fiecare strat își poartă rândul din listă |

**De unde regula DN / Ø.** Ø20 / 25 / 32 / 40 e seria de PP-R și PE-Xa din
`conversie-ml-mp-tevi-tubulaturi.xlsx`, nu DN20–DN40 pe vreo coloană a tabelului
(la DN20: ISO 26,9, DIN 25). La plastic firma nu convertește, rotunjește în sus —
iar `tests/pricing.test.ts` avea deja exact prețurile astea pentru ø20 / 25 / 32 /
40 cu elastomer 9 mm, din aceeași ofertă. Un Ø care *este* DN-ul în tabel
(`Dn 80 (88,9 x 4)`, `Ф 57 (Dn 2")` — 57 pe coloana DIN) nu schimbă nimic. Pe
Oferta 27.04.2026: **37 → 43** de prețuri exacte; restul fișierelor, aceleași
prețuri.

**Cererile față de ofertele semnate.** Singura pereche e Abur → Oferta 284. Pe
cerere: 52 de prețuri exacte, 2 diferite (cotul Di169 cu UM `ml`), 33 fără preț,
din care 24 fiindcă clientul n-a scris grosimea. Cu grosimea din oferta semnată
pusă din editor, 11 din 11 verificabile ies exact; 6 rămân fără preț (vată 40 mm
la DN15, întrebarea 18). „Pune grosimea uzuală" dă 3 exacte din 16 verificabile —
normal, la TRANSAVIA grosimile au fost la cererea clientului. Celelalte cereri
n-au ofertă pereche.

**Descrierea după verificare.** Fiecare extragere ține minte textul din care a
ieșit (`Rezolvare.text`). O linie `om` rămâne a omului cât timp textul e același;
schimbat, se recitește și intră în `descrieriSchimbate` (salvat în istoric), cu
motivul „Descrierea s-a schimbat după verificare". Cantitatea schimbată nu atinge
verificarea: nu e descriere.

## 25 septembrie 2026: audit, stratul cu model, foaia fără derulare

Audit cerut de Andrei: sunt corecte calculele de la import și își face
modelul treaba? Măsurat, nu citit: fiecare preț unitar calculat comparat cu
cel din oferta semnată (testele verificau până acum doar totaluri și
acoperire), plus simulări ale stratului cu model și `npm run golden --
--verifica` pe modelul real.

**Prețurile ies corect.** Pe stratul determinist: Oferta 284 — 83 din 85 de
prețuri unitare exacte; Oferta 27.04.2026 — 43 exacte, cele 4 diferite toate
marcate (ø90, ø160 SPIRO ×2, DTIP8); Matari — 53 din 53, total exact. Toate
pozițiile fără preț au cauză. Ce nu era în regulă stătea în jurul calculelor:

| Problemă | Efect măsurat | Acum |
|---|---|---|
| „Di169, g50 - COT” cu UM `ml` | 51,44 € „Gata”, oferta are 102,88 € (−50%, tăcut) | forma scrisă după liniuță bate UM-ul (ca firma, 2 din 2); o mențiune în trecere („inclusiv coturi”) care dă alt preț → `forma_contrazisa`, „De validat” |
| Modelul nu primea antetul de secțiune | pe Matari, 12 poziții își iau sistemul doar din el | secțiunea pleacă la model, doar pentru sistem; intră și în cheia de șablon (+1 linie trimisă pe 10 fișiere) |
| `sistem: null` de la model suprascria citirea parțială | acele 12 poziții ar fi dispărut din „Netarifate”, fără cauză | `null` nu mai șterge ce știa determinismul |
| Indecșii întorși de model nu se filtrau | un index străin suprascria o linie citită de reguli | doar indecșii trimiși; un index dublu se aruncă (`modelFaraRaspuns`) |
| La `temperature 0`, o rulare a pus `tabla_inox` ca strat pe țeavă la 14 casete Transavia, următoarea nu | jacheta pe primul rând mută toată geometria | `jachetaLaExterior` înainte de tarifare, plus regula în prompt |

A/B pe cele 10 fișiere pentru reparațiile de mai sus: nicio altă poziție nu
s-a mișcat. Golden: 35/35 pe Oferta 27.04.2026; pe Izolații Transavia modelul
citește acum „g48” fidel (48, nu null) pe 2 rânduri — fără efect de preț (48 nu
e grosime de vată), re-înregistrat sub numele nou al fișierului,
`cerere-de-oferta-transavia-inox.json` (cel vechi, `izolatii-transavia.json`,
a fost scos).

**Cererea TRANSAVIA reprodusă.** Cerută de Andrei: importul cererii Abur
trebuie să dea Oferta 284 semnată, rând cu rând. Prima măsurătoare: 64 exacte,
33 fără preț. Tot ce lipsea era de găsit în date:

| Ce lipsea | Dovada | Regula |
|---|---|---|
| Grosimea celor 24 de casete („… DN100 din tabla aluminiu si vata minerala”) | fiecare casetă are grosimea conductei de același diametru din aceeași cerere (DN100 ↔ Di114 g50 …), 11 diametre din 11 | `grosimiDeLaConducte`: aceeași listă, același material, o singură grosime pe diametru; altfel nimic |
| Vată 40 mm pe rândul 22 (golul e și în lista originală a firmei) | 25,68 și 47,41 dau amândouă vata 7,90 = 7,9522 × 6,8157 / 6,8569 | `celulaDedusa`: doar din rândul imediat următor, preț + „De validat” (o singură valoare dovedită, întrebarea 18) |
| „Di169, g50 - COT” cu UM `ml` | semnat ca cot, 102,88 (2 din 2) | forma scrisă după liniuță bate UM-ul (`formaExplicitaDinText`) |
| „tabla dealuminiu” | typo în cerere | „de” lipit e acceptat |
| Totalul, 1 ban peste | Excel-ul firmei adună 143,808, nu 143,81 | `valoareLinie` exactă, total rotunjit o dată |
| „IZOLATII | Caseta …” în Denumire | oferta are IZOLATII în coloana A | codul de rând merge în Identificare_Norma; grosimea nescrisă apare în denumire („, gr. 50 mm”) |

Acum: **98 de prețuri exacte din 98**, 0 diferite; după „Confirmă toate cele 13”,
registrul are rândurile ofertei semnate (Identificare, UM, cantitate, preț
unitar, total pe linie) și totalul 92.278,36 € = 94.575,06 − distribuitorul.
Distribuitorul de abur (2.296,70, `g100 D=500, L=4500, 10 racorduri`) nu iese
din nicio regulă de listă — echipament la comandă, rămâne al omului. Testul
„cererea TRANSAVIA importată reproduce Oferta 284 semnată” ține cifra.

**Oferta 27.04.2026 (NISAL).** Același exercițiu, pe oferta semnată: 43 → 48
de prețuri exacte, 41 → 45 de poziții pe ofertă.

| Ce | Dovada | Acum |
|---|---|---|
| Tubulatură rectangulară, UM „m²” | 79,73 = vată 50 pe mp + tablă pe mp; „m²” se citea „m” | tarifată pe mp (`tarifeazaPeMp`), exact |
| Elastomer „S=20mm” | 3 din 3 semnate cu prețul de 19 mm | 20 → 19 cu notă (`ECHIVALENTE`) |
| Peste ø219 | formula scrisă a firmei dă exact DN250 / 19 mm (23,13); SPIRO ø250 / ø315 semnate cu 0,13 € peste ea | formula firmei, marcată `peste_lista` |
| Canal de desfumare EI60 | semnat 48 €/m²; din vată pe mp ar fi ieșit 22,22 (−54%) | fără preț, `protectie_foc_tubulatura` (întrebarea 8); prinde și Book15 „fire-resistant” |
| „20 to 50mm” (Book15, 4.148 m²) | interval, nu grosime | grosime necompletată, a omului |
| ø90, ø160, DTIP8, țeava de inox Ø125 | ø160 semnat și în sus, și în jos, în aceeași ofertă | neschimbate, marcate (întrebarea 3) |

Celelalte cereri (Book15, Flower City, spital, Transavia inox) n-au ofertă
semnată pereche, deci n-au cu ce fi comparate linie cu linie. Pe ele s-a
verificat doar că nimic nu se tarifează tăcut greșit: tot ce e nou are preț
dovedit sau stă la „De validat”.

**Ecranul de import.** Meniul se pliază singur cât e un fișier deschis —
temporar, fără să schimbe preferința; redeschis de om, rămâne deschis. Foaia
ca în Excel încape pe lățimea ecranului: `table-layout: fixed`, coloanele goale
nu se desenează, descrierea cedează loc și se rupe pe rânduri, coloanele
noastre sunt două („Am înțeles · preț”, „Stare”) cu butoanele pe un rând. Sub
~1000 px de ecran de import pornește ca listă. Verificat cu Playwright: 10
fișiere × 5 lățimi (390–1920 px), zero derulare laterală, nicio eroare.

**Rămâne deschis din audit:** cuprul se convertește încă pe seria de oțel,
nemarcat (DN15 → rândul 22 în loc de 18) — azi nu apare în niciun fișier, dar
prima cerere cu cupru ar ieși greșit tăcut. Și confuzia între două numere care
apar amândouă în text („inox 304 Di89”) nu o prinde niciun validator.

## 25 septembrie 2026 (2): cererile fără ofertă, citite linie cu linie

Firma nu e disponibilă până săptămâna viitoare; scopul e un produs cât mai
corect până atunci, ca întrebările să fie puține. Pe cererile fără ofertă
semnată (spital, Book15, Flower City, Transavia inox) am citit fiecare poziție
„Gata” și am căutat prețuri care ies tăcut greșit. A/B pe cele 10 fișiere după
fiecare reparație: s-au mișcat doar rândurile de mai jos.

| Problemă | Efect măsurat | Acum |
|---|---|---|
| „tabla zincata de 0. 6 mm” (spațiu după punct), spital r137 | 83,19 €/mp „Gata” pe 2.564 mp (213 k€), cu tabla la 0,8; r136, identic cu „0.6”, era refuzat | citit 0,6, refuzat ca r136 (`fara_pret_pe_mp`) |
| Elastomer cu UM „buc.”, fără piesă, spital r26–28 | 750 buc. × preț pe ml, „Gata” | preț pe ml, „De verificat” (`um_bucata`) |
| „Di76, g48 - COT”, Transavia inox r30 | primea 50 mm de la conductă, încredere 0,99 (azi blocat de inox, după întrebarea 15 ar fi ieșit tăcut) | grosimea scrisă nu se completează |
| „țeavă din inox” | adăuga o jachetă de inox necerută | inoxul e jachetă doar lângă tablă / casetă / jacket |
| NISAL r83, livrare de țeavă de inox cu izolația „inclusiv” | din liste 14,68, semnat 20,09; nicio combinație nu dă 20,09 | refuzat, `livrare_teava` |
| Țeavă de cupru în DN | DN15 pe rândul 22, nemarcat | seria de cupru a firmei (DN15 → ø18), `serie_cupru` |
| Țeavă de inox în DN | ISO, nemarcat | ISO, `serie_inox` |
| Model: „inox 304 Di89” citit 304 | niciun validator | `diametru_nenotat`; 0 alarme pe 575 de linii citite de reguli |

Spitalul, pe stratul determinist: 1.454.100 → 1.240.778 € tarifat, 3 poziții
în plus la „De verificat”, una în plus fără preț. Celelalte fișiere: aceleași
prețuri; NISAL r83 rămâne fără preț, cu cauza corectă.

**Importul cu model** (pasul 2 din „Ce urmează”, gpt-4.1-2025-04-14,
`IZOREP_CONCURENTA=1` — cu 4 loturi în paralel contul lovește plafonul de
30.000 TPM). Pe spital modelul citește 81 de linii, pe Book15 2, pe Flower
City 0. Ce ieșea greșit „Gata”:

| Ce | Efect | Acum |
|---|---|---|
| Foile „țeavă … + izolație” (spital, 58 de rânduri): livrarea țevii cu fitinguri, susțineri și izolația inclusă | tarifate ca izolație, „Gata” | `livrare_teava`, fără preț (ca NISAL r83) |
| „izolație 20 mm protejată cu **folie** de aluminiu” | modelul adăuga tablă: 23,31 €/ml în loc de 6,23 | `strat_necitat` |
| Book15 r48, „jacketing 0.6 – 0.8 mm”, 1.850 m² | „Gata” pe 0,8 (110 k€) | `grosime_interval` |
| „Protecție mecanică … tablă zincată min 0,5 mm” (13 rânduri, 360 k€) | modelul citește 0,5 → fără preț; determinist 0,8 la „De verificat” | neschimbat; e întrebare (tabla zincată pe mp) |

Rejucat pe răspunsurile salvate ale modelului: pe spital, **zero** poziții
citite de model mai ies „Gata”. Cele trei avertismente noi, puse pe cele 617
poziții citite de reguli din cele 10 fișiere: 2 aprinderi, amândouă rândurile
cu interval din Book15.

Golden nou: `tests/golden/cerere-de-oferta-spital.json` (101 linii ale
modelului; niciuna cu preț „Gata”). `scripts/golden.ts` tarifa la înregistrare
fără textul rândului, iar testul rejoacă cu el: un golden proaspăt pica pe
regulile care depind de text. Acum amândouă îl folosesc.

**Prețul pus de mână.** Pozițiile fără regulă în liste (distribuitorul de
abur, livrarea țevii cu izolație, protecția la foc) n-aveau cum ajunge în
ofertă, deci registrul generat rămânea mereu sub cel semnat. Acum omul pune
prețul unitar în editor (vezi `ui.md`). Cererea TRANSAVIA importată, cu
distribuitorul la 2.296,70 și cele 13 celule deduse confirmate, dă **94.575,06
€ = Oferta 284**, la ban (test în `oferte-semnate.test.ts` și verificat în
browser).

## 28 septembrie 2026: casetele TRANSAVIA pe calea cu model

Raportat de Andrei din ecran (cu `npm run dev`, deci cu model): cererea Abur
ieșea 67 Gata / 32 De verificat / 0 Fără preț, cu „Citit nesigur din text” pe
casete cu prețul exact al Ofertei 284. Determinist ieșea 85 / 13 / 1.

| Problemă | Efect măsurat | Acum |
|---|---|---|
| Casetele fără grosime plecau la model, deși grosimea vine de la conducta de același DN (`grosimiDeLaConducte`) | modelul întorcea încredere 0,85 într-o rulare, mai mică în alta: toate 24 „Gata” sau toate „De verificat”, fără motiv | `completeazaDinConducte`: rămân ale regulilor, nu mai pleacă la model; două rulări cu model = determinist |
| Distribuitorul de abur, citit de model ca țeavă D=500 | 191,83 € „De verificat” (semnat 2.296,70, −92%); determinist „Lipsește diametrul” | `echipament`, fără preț, „preț de pus manual” |

2.296,70 = 17,5 × prețul pe ml la ø500 g100, dar 17,5 nu iese din nicio regulă
(L = 4,5 m, coeficientul de distribuitor 4,5, 10 racorduri) — o valoare,
nededusă. A/B pe cele 10 fișiere: s-a mișcat doar cauza distribuitorului.
Verificare linie cu linie, cu și fără model: TRANSAVIA 98 / 98 prețuri și
99 / 99 cantități; NISAL 48 exacte, cele 9 diferite toate „De verificat”
(întrebările 3–4); Matari 53 / 53; DN → ø → rând pe 209 linii, zero abateri.
Browser, cu model: 85 / 13 / 1, un apel (distribuitorul). 554 de teste.

## 28 septembrie 2026 (2): produsul pentru demo, prototipul de stoc

Adrian merge la firmă să arate ce e făcut; ținta a fost un produs corect și
coerent cu ce avem, plus primul ecran de stoc. Planul complet a fost aprobat de
Andrei; întrebări pentru firmă nu intră aici.

| Ce | Efect | Acum |
|---|---|---|
| Lucrările 118 / 118.1 în datele demo | 341.038,78 / 25.384,08 €: dublate față de ofertele semnate | 170.519,39 / 12.692,04, cu test pe fișiere (`tests/seed.test.ts`) |
| Anexa 5997 | 585,40 € din 10 rânduri | 706,90 din 16, emisă de R&F ISORAD |
| Perechea TRANSAVIA | lipsea; „d-transavia” era cererea de inox, cu dată inventată | cerere → Oferta 284 (Grup Energoinstal, 91.737,81 după discount) → lucrare; inoxul fără dată |
| „Poză cu foaia de măsurători … vision”, „categoria clientului decide lista” | funcții care nu există | scoase; textul descrie importul real |
| Calcul deviz | eticheta „SistemMatrice”, exemplul „netarifabilă” avea preț | „Material”, tip ofertă, exemplu chiar refuzat, notele de verificat marcate |
| Tabelele pe telefon | derulau lateral în interior pe aproape toate ecranele | rândul devine card (`tabel()`), zero derulare |

**Necesarul de materiale** (`src/stoc/necesar.ts`): strat cu strat, din
pozițiile cu preț, m²/ml = π × (φ + 2g) / 1000 (formula registrului firmei, π
întreg), piesele în bucăți, adaos ales pentru coturi și fitinguri (registrul:
5–10 %). Pe cererea TRANSAVIA: 21 de materiale, toată vata pe metru din ofertă
ajunge în necesar; doar distribuitorul rămâne fără.

**Registrul de stoc** (`src/stoc/registru.ts`): stocul e suma mișcărilor, o
greșeală se anulează cu mișcarea inversă, soldul negativ e marcat. Ecranul
„Depozit și stoc” și cardul „Materiale necesare” sunt în `ui.md`.

Verificat în browser, pe dev și pe build-ul de producție: fluxul demo cap-coadă
(import → 13 confirmate → distribuitor 2.296,70 → 94.575,06 € → ofertă
descărcată → necesar → depozit → exemple → intrare → anulare → reîncărcare →
tabloul de bord) și cele 8 ecrane × 5 lățimi × 2 teme × 2 roluri: 160 de
verificări, zero derulare, zero erori.

## Pentru întâlnirea cu firma (25 septembrie 2026)

Varianta scurtă, de dus la firmă: `docs/intrebari-firma.md`. Ordonate după
cât deblochează pe cele 10 fișiere. Tot restul s-a dedus din
date și e în cod, marcat unde dovada e subțire. Numerele din paranteză sunt cele
din lista completă de mai jos (codul le citează).

**Două documente, care închid mai multe întrebări deodată:**

- **D1. Oferte semnate pe cereri pe care le avem** — mai ales pe
  `cerere-de-oferta-transavia-inox.xlsx` (72 de poziții blocate), apoi spital,
  Book15, Flower City. Fiecare pereche devine un test ca TRANSAVIA și confirmă
  sau răstoarnă regulile deduse dintr-o singură ofertă (11, 15, 18). Ideal și
  două cereri de la același client, din proiecte diferite (11).
- **D2. Listele lipsă:** ~~rafinărie (13)~~ (amânată), manopera dacă e scrisă (5), PVC și
  închiderile la foc pe industrial (14).

**Șapte întrebări:**

1. **Tabla de inox: grosimea implicită, 0,4 / 0,5 / 0,6 mm?** (15) Clienții n-o
   scriu; lista are toate trei. 72 de poziții Transavia inox; la r140: 40,25 /
   45,57 / 50,89 €. Dacă vine D1, se citește din ofertă.
2. **Tabla zincată ca protecție mecanică, pe mp.** Spitalul cere „tablă zincată
   min 0,5 mm” (13 rânduri) și „0,6 mm” (6 rânduri), ~14.600 mp. Lista
   rezidențială are pe mp doar aluminiu 0,8 (59,51 €), industrialul și 0,6
   (45,00). Zincata se tarifează ca aluminiul? Ce preț pe mp la 0,6 pe
   rezidențial?
3. **„Țeavă + izolație” — livrarea țevii cu fitinguri, susțineri și izolația
   inclusă** (spital, 4 foi, 58 de rânduri; NISAL r83). O ofertați, sau doar
   izolația? NISAL r83 e semnat 20,09 €/m, iar vata 50 pe ø125 din listă dă
   14,68 — ce mai intră? Azi: fără preț, cu preț pus de mână.
4. **Protecția la foc a tubulaturii** (8) — EI60/120/180, torcret Parafoc
   20–40 mm (spital, 28 de rânduri; Book15, 2.233 mp). O ofertați? De unde
   48 €/m² la canalul EI60 din Oferta 27.04.2026?
5. **Diametrele între rânduri și peste listă** (3, 4), 19 poziții:
   a) la 1 mm peste un rând (ø90, ø160): rândul de jos sau de sus? În aceeași
   ofertă, țeava ø160 a luat 169 (14,37), iar SPIRO 160 a luat 159 (14,16);
   PEHD ø90 a luat 89.
   b) peste ø219: formula voastră cu 3,14 dă exact DN250 / 19 mm (23,13), dar
   SPIRO ø250 și ø315 cu 9 mm ies exact (16,36 și 20,30) doar cu π și φ + 20
   mm, adică 10 mm pe parte. Care e calculul?
6. **Confirmări da / nu** — reguli aplicate azi, cu poziția la „De validat”:
   - vata 40 mm pe DN15 = 7,90 €/ml, proporțional din rândul următor (18);
   - elastomer „20 mm” = prețul de 19 mm;
   - țeava de cupru în DN pe seria cuprului: DN15 → ø18 (tevi.md, 3); și
     țeava de inox?
   - UM „buc” pe izolație dreaptă (spital, 750 buc.): bucata e tubul de 2 m
     sau metrul?
   - un Ø scris lângă un DN care nu-i corespunde bate DN-ul (17);
   - elastomer „până la ø60 → 13 mm” include DN50 (16).
7. **Segmentul** (12): Oferta 284 e industrială, dar tarifată pe lista
   rezidențială. Se deduce din client sau din obiectiv, ori îl alege omul?

**Pentru etapele următoare** (nu blochează ofertarea): stocul — aplicația sau
Saga (1); cine emite și trimite factura în SPV (2); cele două firme (6);
cursul la facturare (7).

## Întrebări deschise către firmă

Astea blochează arhitectura, nu doar implementarea:

1. **Cine ține stocul oficial — aplicația sau Saga?** Determină tot modulul de
   stoc și cine răspunde pentru SAF-T.
2. Cine emite factura și cine o trimite în SPV?
3. La ø90 și ø160, care e regula corectă de rotunjire? (Rotunjirea la stratul
   de jachetă e acum lămurită de Oferta 284 — **în sus**. ø90 și ø160 rămân.)
   Până la răspuns, pozițiile la 1 mm peste un rând ies cu prețul „în sus" și
   **marcate** — pe cele 10 fișiere, 7 linii.
4. Există listă de prețuri pentru elastomer peste ø219? Nici lista industrială
   nu trece de ø219, deci întrebarea e acum pe amândouă segmentele. Din 25
   septembrie 2026 se aplică formula firmei pe mp, marcat: pe Oferta 27.04.2026
   dă exact DN250 / 19 mm, dar SPIRO ø250 / ø315 au fost semnate cu 0,13 € mai
   sus. Care e calculul exact?
5. Lista de manoperă e scrisă undeva sau se negociază de fiecare dată?
6. Cum se împart cele două firme (RADOIA ISOLIRUNG / R&F ISORAD SYSTEM)?
7. Care e regula de curs folosită azi la facturare — BNR din ziua anterioară,
   din ziua facturii, sau cursul din contract? (De verificat cu contabila.
   Până atunci `CURS_BNR` rămâne constantă: cursul contează abia la facturare.)
8. „Protecție la foc pentru tubulatură" (28 de rânduri în `cerere-de-oferta-spital.xlsx`) e o
   lucrare pe care o ofertați? Nu are listă de prețuri printre cele primite.
   Oferta 27.04.2026 are canalul de desfumare EI60 la 48 €/m² — de unde vine?
9. ~~**Coturile și teurile de vată minerală sub ø76.**~~ **Răspuns 11
   septembrie 2026: e regula firmei.** Prețul e tabla la rândul geometric, fără
   stratul de vată; nota de proveniență rămâne, validarea obligatorie a căzut.
10. ~~**SPIRO ø160.**~~ **Răspuns 11 septembrie 2026: la spiro nominalul e
    diametrul exterior.** Rotunjirea lui ø160 (159 sau 169) a trecut la
    întrebarea 3.
11. **Două liste de cantități de la același client, din proiecte diferite.**
   Cele 9 fișiere pe care le avem vin de la clienți diferiți, deci reutilizarea
   șabloanelor între proiecte — tot câștigul lui L4 — nu se poate măsura.
   Vezi `plan-l1-l4.md`.
12. **Cine alege segmentul de preț și după ce regulă?** Oferta 284 e o lucrare
   industrială (Transavia, abur) tarifată pe lista rezidențială. Dacă alegerea
   e a omului la deschiderea lucrării, e un câmp pe lucrare. Dacă se deduce din
   client sau din tipul obiectivului, e o regulă. **Din 12 septembrie 2026** omul
   alege segmentul la import; rămâne de aflat dacă se poate deduce și dacă
   trebuie scris pe lucrare, în bază.
13. ~~**Lista de prețuri pentru rafinărie.**~~ **Amânată, 29 septembrie 2026:**
   momentan lucrăm doar rezidențial și industrial; locul pentru rafinărie rămâne.
14. **PVC și închiderile goluri la foc pe industrial.** Nu au venit în pachetul
   industrial. **Răspuns pentru închideri, 29 septembrie 2026:** rezidențial +
   20 %, pe totalul lor. PVC-ul rămâne pe rezidențial, cu notă de verificat.
15. **Tabla de inox.** Două întrebări acum, prima fiind cea care blochează:
   - **Care e grosimea implicită — 0,4, 0,5 sau 0,6 mm?** Lista are toate trei
     la fiecare diametru, iar clienții nu scriu grosimea jachetei niciodată.
     Fără răspuns, toate cele 72 de rânduri de inox din `Izolatii Transavia`
     rămân marcate. La rândul 140 diferența e 40,25 / 45,57 / 50,89 €.
   - Se ofertează inox și pe **rezidențial**? Fiind singurul sistem fără listă
     rezidențială, prețul vine azi din cea industrială chiar când restul
     straturilor sunt rezidențiale; poziția poartă `note`, nu e tăcută.
   (Benzile de multiplicatori sunt confirmate identice cu ale aluminiului.)
16. **Elastomer „până la ø60 → 13 mm": intră și DN50 (ø60,3)?** Rândul 60 din
    listă e chiar DN50, deci codul îi propune 13 mm; la fel DN200 (ø219,1) →
    19 mm. E interpretarea noastră, aliniată cu toleranța motorului.
17. ~~**Oferta 27.04.2026, rândurile 44–47.**~~ **Lămurit din date, 15 septembrie
    2026:** descrierea română scrie Ø20 / 25 / 32 / 40 mm, adică seria de PP-R,
    nu DN-ul de oțel din coloana germană. Oferta a tarifat pe Ø, deci corect, iar
    codul face la fel. De confirmat doar că regula „Ø-ul scris bate DN-ul care
    nu-i corespunde" e a firmei.
18. **Grosimi care nu sunt în listă, dar au preț în oferta semnată.** Oferta 284,
    casetele de armături DN15 cu vată 40 mm: lista n-are celula 22|40, oferta are
    47,41 €. **Dedus din date, 25 septembrie 2026:** ambele poziții (ml și
    casetă) dau vata 7,90 = 7,9522 × 6,8157 / 6,8569, proporția rândului 28 la
    30 mm. Codul o aplică marcat; de confirmat că e regula firmei pentru golurile
    din listă.

## Ce urmează

**Pe import rămân doar lucruri mici:** fiecare pereche nouă cerere ↔ ofertă
semnată devine test, ca TRANSAVIA; comparația dintre modele se face abia când
există răspunsul corect; bara de filtre a fișierelor cu o singură foaie, adusă
la așezarea registrelor cu mai multe foi. Rafinăria și manopera — liste care
n-au venit (D2); rafinăria e amânată, nu scoasă.

**Făcut pe 28 septembrie 2026:** prototipul de stoc (etapa A de mai jos) și
lustruirea pentru demo. Mai departe, în ordine:

- **B. Fundația multi-utilizator.** Server HTTP, autentificare, rolurile pe
  server; oferta importată devine document imutabil în Postgres (versiuni,
  preț copiat, legat de `SesiuneImport`), lucrarea se creează din oferta
  acceptată. Gata când: TRANSAVIA salvată și redeschisă pe alt calculator dă
  94.575,06 € la ban.
- **C. Stocul real, în bază.** Tabele `articol`, `depozit`, `miscare` cu RLS pe
  tenant și firmă, trigger care refuză UPDATE / DELETE pe `miscare` (ca la
  `lista_preturi`), soldul ca view; `src/stoc/` rămâne logica comună. Necesarul
  devine rezervare pe lucrare.
- **D. Situații de lucrări.** ~~Prototipul~~ făcut pe 29 septembrie 2026
  (ecranul Lucrări, în browser). Rămâne: formatul situației al firmei (cerut),
  pozele din carnet ca sursă pentru cantitățile executate, consum real față de
  necesar, pe lucrare.
- **E. Contabilitate.** Facturi, curs BNR înghețat pe document, e-Factura,
  export spre Saga.

**Întrebări de stoc pentru firmă:**

1. Saga ține stocul oficial? Dacă da: aplicația ține stocul operativ și
   exportă. Dacă nu: emite NIR, bon de consum, avize numerotate și intră în
   SAF-T — mult mai mult.
2. Câte depozite; materialul stă și pe șantier sau în mașini; se urmărește pe
   lucrare?
3. Cine înregistrează mișcările (gestionar, șef de echipă) și cine aprobă?
4. Evaluarea stocului: cost mediu sau FIFO?
5. Cele două firme: stoc comun sau separat? (6)
6. Fișierele „calcul preț” (`nefolosite/`, marcate NUUUU) au costul de
   manoperă și de material pe ml, pe ø × grosime — baza pentru marjă și pentru
   valoarea consumului. Sunt actuale?

De cerut: exportul de stoc și nomenclatorul din Saga, 2–3 facturi de
furnizor, un bon de consum sau aviz, ultimul inventar, și forma de cumpărare
(m² pe rolă de vată la fiecare grosime, tuburile de elastomer, tabla în coli
sau rolă, accesoriile).

## Comenzi

```bash
npm test                                       # 384 de teste (motor, import, baza, ofertă, șantier)
npm run typecheck
npm run dev                                    # UI local, /izorep/
npm run import -- ../attachments/clienti/cerere-de-oferta-spital.xlsx   # pipeline complet
npm run import -- <fisier> --fara-model        # doar determinist
npm run golden -- <fisier.xlsx>                # inregistreaza iesirea modelului
npm run golden -- --verifica                   # cauta deriva modelului
npm run compara-poze -- gpt-5.5-2026-04-23 gpt-5.6-terra --repetari 3   # modelele pe pozele de santier
npm run mapare -- <fisier.xlsx>                # inregistreaza maparea de coloane
IZOREP_FARA_MAPARE=1 npm run import -- <fisier>  # masoara A/B fara L1
python scripts/extract_price_lists.py ../attachments   # regenerează prețurile
python scripts/extract_conversii.py ../attachments     # regenerează seriile de țevi
npm run db:up && npm run db:migrate && npm run db:seed  # baza locală
```
