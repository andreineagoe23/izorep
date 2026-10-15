import { micsoreaza, rutaModel, stareModel, type StareModel } from "../imagine.js";
import { agrega, type RandSantier } from "../../src/santier/agrega.js";
import { RaspunsPoza, type Element, type Izolatie, type Jacheta } from "../../src/santier/schema.js";
import { spreCerere } from "../../src/santier/spre-cerere.js";
import { registruCerere } from "../../src/santier/registru.js";
import type { Destinatie } from "../../src/pricing/lists.js";
import { preda, predaSituatie } from "../predare.js";
import { citesteDepozit, citestePlanuri, modDate, puneComanda, salveazaMasuratori } from "../date.js";
import {
  cardComparatie, cardIncarca, cardPagina, cardTrimite, type ListaClient, type PaginaSantier, type SantierAles, type Scop,
} from "../santier-vizual.js";
import { incarca as incarcaImport, listeaza as listeazaImporturi } from "../date.js";
import { stocLocal } from "../stoc-local.js";
import type { Comparatie } from "../../src/lucrari/comparatie.js";
import type { Ecran } from "./tip.js";
import { citesteLucru, paginaRefacuta, scrieLucru } from "../masuratori-local.js";

/**
 * Măsurători: pozele carnetului -> randuri confirmate -> oferta sau situatia.
 *
 * Pozele vin in doua momente (Andrei, 2 octombrie 2026): inainte de oferta
 * (la clientii din apropiere firma masoara, iar oferta se face din poze) si in
 * timpul lucrarii (ce s-a executat). Citirea si verificarea sunt aceleasi; la
 * final randurile pleaca fie la import, ca o cerere, fie pe planul unui santier,
 * ca situatie noua (`src/lucrari/potrivire.ts`).
 *
 * Santierul nu foloseste aplicatia: scrie pe foaie si trimite poze. Omul de la
 * birou le incarca aici, modelul propune randurile (cand ruta exista: pe
 * server, dupa intrare; nu pe linkul de pe Pages), iar el le compara cu poza
 * si confirma pagina. Din
 * paginile verificate iese un registru `.xlsx` care trece prin import exact ca
 * o lista de la client — deci aceeasi tarifare, aceeasi verificare, aceeasi
 * oferta. Nicio a doua cale de pret.
 *
 * Starea sta la nivel de modul: plecat pe alt ecran si intors, munca e tot
 * acolo. Din 14 octombrie 2026 (R4) supravietuieste si reincarcarii: pozele si
 * randurile stau in IndexedDB pana pleaca (`web/masuratori-local.ts`).
 */
const RUTA_POZA = rutaModel("poza");
/** Cate pagini se citesc deodata. Fiecare apel dureaza secunde; doua tin progresul vizibil. */
const CONCURENTA = 2;

let pagini: PaginaSantier[] = [];
/** Pozele, pastrate ca „Citește din nou" sa aiba ce trimite. */
const fisiere = new Map<string, File>();
/** Numele ultimei liste trimise la import, ca omul sa stie ca a plecat. */
let trimisa = "";
/**
 * Redesenarea ecranului DESCHIS acum. O citire porneste pe un ecran si se poate
 * termina dupa ce omul a plecat si s-a intors: ea cheama ce e aici, nu
 * functia ecranului pe care a pornit, care nu mai e in pagina.
 */
let redeseneaza: (id?: string) => void = () => {};
let destinatie: Destinatie = "rezidential";
let scop: Scop = "oferta";
/** Santierul ales pentru „Pentru situatie”. */
let planAles = "";
/** Potrivirea ruleaza importul: cat dureaza, butonul e oprit. */
let lucreaza = false;
let titlu = "";
let editeaza: string | null = null;
let eroare = "";
let urmator = 0;
/** Importul din istoric cu care se compara masuratorile, si rezultatul. */
let comparaCu = "";
let comparatie: { lista: string; c: Comparatie } | null = null;
/** Ce a ieșit la „Fă ciornele comenzii” când n-a fost nimic de comandat. */
let mesajComanda = "";

/** Lucrul din IndexedDB se reface o singura data, la prima deschidere dupa incarcarea paginii. */
let refacut = false;
let ceasSalvare: ReturnType<typeof setTimeout> | undefined;

/** Scrie lucrul in browser, amanat: o citire, o corectura si un clic vin unul dupa altul. */
function salveazaLucru(): void {
  clearTimeout(ceasSalvare);
  ceasSalvare = setTimeout(() => {
    void scrieLucru({
      scop, destinatie, planAles, titlu,
      pagini: pagini.flatMap((p) => {
        const poza = fisiere.get(p.id);
        return poza ? [{
          id: p.id, nume: p.nume, poza, stare: p.stare, eroare: p.eroare, randuri: p.randuri, note: p.note,
          verificata: p.verificata, faraModel: p.faraModel,
        }] : [];
      }),
    });
  }, 300);
}

/** Paginile lasate la jumatate inainte de reincarcare, cu pozele lor. */
async function refaLucrul(): Promise<void> {
  if (refacut || pagini.length > 0) { refacut = true; return; }
  refacut = true;
  const l = await citesteLucru();
  if (!l || l.pagini.length === 0) return;
  ({ scop, destinatie, planAles, titlu } = l);
  pagini = l.pagini.map((p) => {
    const f = new File([p.poza], p.nume, { type: p.poza.type });
    fisiere.set(p.id, f);
    return paginaRefacuta(p, URL.createObjectURL(f));
  });
}

const idNou = (): string => `${Date.now().toString(36)}-${(urmator++).toString(36)}`;

async function modelDisponibil(): Promise<StareModel> {
  return stareModel("poza");
}

/** Id-urile randurilor unice pe pagina, ca editarea sa stie ce rand e. */
const cuId = (randuri: RandSantier[]): RandSantier[] => randuri.map((r) => ({ ...r, id: idNou() }));

const randGol = (zona: string): RandSantier => ({
  id: idNou(), zona, diametru_valoare: null, diametru_tip: "exterior", izolatie: "vata_minerala", grosime_mm: 50,
  jacheta: "aluminiu", element: "ml", pret_dublu: false, cantitate: 0, termeni: [], nesigur: false,
});

export const ecran: Ecran = {
  id: "masuratori",
  titlu: "Poze de pe șantier",
  subtitlu: "Pozele din carnet, înainte de ofertă sau din timpul lucrării. Rândurile citite din poză, verificate de tine, " +
    "ajung în ofertă sau în situația de lucrări.",

  async render(root) {
    root.innerHTML = `<div class="imp sant">
      <div id="sant-incarca"></div>
      <div id="sant-pagini" class="imp-pagina"></div>
      <div id="sant-trimite"></div>
      <div id="sant-comparatie"></div>
    </div>`;
    const gazda = root.querySelector<HTMLElement>(".sant")!;
    let [model] = await Promise.all([modelDisponibil(), refaLucrul()]);
    /** Importurile din istoric: listele clientilor cu care se pot compara masuratorile. */
    let liste: ListaClient[] = [];
    try { liste = (await listeazaImporturi()).map((x) => ({ id: x.id, nume: x.nume })); } catch { liste = []; }

    const santiere = (): SantierAles[] => citestePlanuri().filter((p) => !p.inchis).map((p) => ({ id: p.id, denumire: p.denumire, client: p.client }));
    /** Pe situatie, tipul ofertei e al santierului, nu cel ales sus. */
    const destinatiaPaginii = (): Destinatie =>
      scop !== "oferta" ? ((citestePlanuri().find((p) => p.id === planAles)?.destinatie as Destinatie | undefined) ?? destinatie) : destinatie;
    const incarca = (): string => cardIncarca({ scop, destinatie, santiere: santiere(), planAles, eroare, trimisa, model });

    const deseneaza = (): void => {
      gazda.querySelector("#sant-incarca")!.innerHTML = incarca();
      gazda.querySelector("#sant-pagini")!.innerHTML = pagini
        .map((p, i) => `<div data-pagina="${p.id}">${cardPagina(p, i + 1, { editeaza, destinatie: destinatiaPaginii(), cuModel: model === "pornit" })}</div>`).join("");
      deseneazaTrimite();
      legaDrop();
      salveazaLucru();
    };
    const deseneazaTrimite = (): void => {
      gazda.querySelector("#sant-trimite")!.innerHTML = cardTrimite({
        pagini, titlu, scop, lucreaza, santier: santiere().find((x) => x.id === planAles) ?? null,
        ...(scop === "oferta" ? { liste, comparaCu } : {}),
        ...(scop === "comanda" && mesajComanda ? { mesaj: mesajComanda } : {}),
      });
      gazda.querySelector("#sant-comparatie")!.innerHTML =
        comparatie && scop === "oferta" && pagini.length > 0 ? cardComparatie(comparatie.c, comparatie.lista) : "";
    };
    /**
     * Doar pagina atinsa. O citire care se termina pe pagina 3 nu are voie sa
     * redeseneze pagina 1, unde omul poate avea o corectura nesalvata.
     */
    const deseneazaPagina = (id: string): void => {
      const i = pagini.findIndex((p) => p.id === id);
      const loc = gazda.querySelector(`[data-pagina="${CSS.escape(id)}"]`);
      if (i < 0 || !loc) return deseneaza();
      loc.innerHTML = cardPagina(pagini[i]!, i + 1, { editeaza, destinatie: destinatiaPaginii(), cuModel: model === "pornit" });
      deseneazaTrimite();
      salveazaLucru();
    };
    redeseneaza = (id) => (id ? deseneazaPagina(id) : deseneaza());

    const pagina = (id: string | undefined): PaginaSantier | undefined => pagini.find((p) => p.id === id);

    async function citeste(p: PaginaSantier, f: File): Promise<void> {
      if (model !== "pornit") {
        p.stare = "gata";
        p.faraModel = true;
        return;
      }
      try {
        const imagine = await micsoreaza(f);
        const r = await fetch(RUTA_POZA, {
          method: "POST", headers: { "Content-Type": "application/json", "X-Izorep": "1" },
          body: JSON.stringify({ imagine }), signal: AbortSignal.timeout(400_000),
        });
        const corp = (await r.json()) as { termeni?: unknown; note?: unknown; eroare?: string };
        if (!r.ok) throw new Error(corp.eroare ?? `HTTP ${r.status}`);
        // Ce vine de la server trece prin aceeasi schema inca o data.
        const citit = RaspunsPoza.parse({ termeni: corp.termeni, note: corp.note });
        p.randuri = cuId(agrega(citit.termeni));
        p.note = citit.note;
        p.stare = "gata";
        p.faraModel = false;
      } catch (e) {
        console.error(e);
        p.stare = "eroare";
        p.eroare = "Poza nu s-a putut citi.";
      }
    }

    async function adaugaPoze(alese: File[]): Promise<void> {
      eroare = "";
      trimisa = "";
      const imagini = alese.filter((f) => f.type.startsWith("image/"));
      if (imagini.length < alese.length) {
        eroare = "Unele fișiere nu sunt poze și n-au fost adăugate. Aici merg doar poze (JPG, PNG).";
      }
      const noi = imagini.map((f) => ({
        f,
        p: {
          id: idNou(), nume: f.name, url: URL.createObjectURL(f), stare: "citeste" as const, eroare: "",
          randuri: [], note: [], verificata: false, faraModel: false,
        } satisfies PaginaSantier as PaginaSantier,
      }));
      // Paginile noi se adauga la capat; cele existente nu se ating, ca o
      // corectura deschisa pe alta pagina sa nu se piarda.
      const inainte = pagini.length;
      // Modelul oprit se mai intreaba o data la fiecare poza noua: serverul
      // poate fi trezit intre timp, sau cheia pusa, fara reincarcarea paginii.
      if (model !== "pornit" && noi.length > 0) model = await modelDisponibil();
      pagini.push(...noi.map((x) => x.p));
      for (const { f, p } of noi) fisiere.set(p.id, f);
      salveazaLucru();
      gazda.querySelector("#sant-incarca")!.innerHTML = incarca();
      legaDrop();
      gazda.querySelector("#sant-pagini")!.insertAdjacentHTML("beforeend", noi.map(({ p }, k) =>
        `<div data-pagina="${p.id}">${cardPagina(p, inainte + k + 1, { editeaza, destinatie: destinatiaPaginii(), cuModel: model === "pornit" })}</div>`).join(""));
      deseneazaTrimite();
      let i = 0;
      const lucrator = async (): Promise<void> => {
        for (let j = i++; j < noi.length; j = i++) {
          await citeste(noi[j]!.p, noi[j]!.f);
          redeseneaza(noi[j]!.p.id);
        }
      };
      await Promise.all(Array.from({ length: Math.min(CONCURENTA, noi.length) }, lucrator));
    }

    function legaDrop(): void {
      const drop = gazda.querySelector<HTMLElement>("#drop");
      if (!drop) return;
      drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("peste"); });
      drop.addEventListener("dragleave", () => drop.classList.remove("peste"));
      drop.addEventListener("drop", (e) => {
        e.preventDefault();
        drop.classList.remove("peste");
        void adaugaPoze([...(e.dataTransfer?.files ?? [])]);
      });
    }

    gazda.addEventListener("change", (e) => {
      const t = e.target as HTMLInputElement;
      if (t.id === "poze" && t.files) void adaugaPoze([...t.files]);
      if (t.name === "segment") { destinatie = t.value as Destinatie; deseneaza(); }
      if (t.name === "scop") { scop = t.value as Scop; trimisa = ""; mesajComanda = ""; deseneaza(); }
      if (t.name === "plan") { planAles = t.value; deseneaza(); }
      if (t.name === "compara-cu") { comparaCu = t.value; comparatie = null; deseneazaTrimite(); }
    });

    gazda.addEventListener("input", (e) => {
      const t = e.target as HTMLInputElement;
      if (t.name === "titlu" && t.closest("#trimite")) { titlu = t.value; salveazaLucru(); }
    });

    gazda.addEventListener("click", (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-act]");
      if (!b) return;
      const p = pagina(b.dataset["pag"] ?? b.closest<HTMLElement>("[data-pagina]")?.dataset["pagina"]);
      const r = p?.randuri.find((x) => x.id === b.dataset["rand"]);
      // Corectura deschisa pe alta pagina se inchide si ea: se redeseneaza amandoua.
      const editataInainte = editeaza?.split(":")[0];
      switch (b.dataset["act"]) {
        case "compara":
          void compara();
          return;
        case "verifica-model":
          b.disabled = true;
          void modelDisponibil().then((m) => { model = m; deseneaza(); });
          return;
        case "reciteste": {
          const f = p && fisiere.get(p.id);
          if (!p || !f) return;
          p.stare = "citeste";
          p.eroare = "";
          redeseneaza(p.id);
          void citeste(p, f).then(() => redeseneaza(p.id));
          return;
        }
        case "de-mana":
          if (p) { p.stare = "gata"; p.faraModel = true; p.eroare = ""; }
          break;
        case "confirma":
          if (r) r.nesigur = false;
          break;
        case "modifica":
          if (p && r) editeaza = `${p.id}:${r.id}`;
          break;
        case "renunta":
          editeaza = null;
          break;
        case "scoate-rand":
          if (p) { p.randuri = p.randuri.filter((x) => x !== r); p.verificata = false; }
          break;
        case "adauga":
          if (p) {
            const nou = randGol(p.randuri.at(-1)?.zona ?? "Fără zonă");
            p.randuri.push(nou);
            p.verificata = false;
            editeaza = `${p.id}:${nou.id}`;
          }
          break;
        case "verificata":
          if (p) p.verificata = true;
          break;
        case "reverifica":
          if (p) p.verificata = false;
          break;
        case "scoate-pagina":
          if (p) { URL.revokeObjectURL(p.url); fisiere.delete(p.id); pagini = pagini.filter((x) => x !== p); }
          deseneaza();
          return;
        default:
          return;
      }
      if (!p) return deseneaza();
      deseneazaPagina(p.id);
      if (editataInainte && editataInainte !== p.id) deseneazaPagina(editataInainte);
      if (editeaza) gazda.querySelector<HTMLInputElement>(".sant-editor [name='cantitate']")?.focus();
    });

    gazda.addEventListener("submit", (e) => {
      e.preventDefault();
      const form = e.target as HTMLFormElement;
      if (form.id === "trimite") { void trimite(); return; }
      const p = pagina(form.dataset["pag"]);
      const r = p?.randuri.find((x) => x.id === form.dataset["rand"]);
      if (!p || !r) return;
      const d = new FormData(form);
      const nr = (k: string): number | null => {
        const v = String(d.get(k) ?? "").trim().replace(",", ".");
        return v === "" || !Number.isFinite(Number(v)) ? null : Number(v);
      };
      const izolatie = (String(d.get("izolatie") ?? "") || null) as Izolatie | null;
      Object.assign(r, {
        zona: String(d.get("zona") ?? "").trim() || "Fără zonă",
        diametru_tip: d.get("diametru_tip") === "DN" ? "DN" : "exterior",
        diametru_valoare: nr("diametru_valoare"),
        izolatie,
        grosime_mm: izolatie ? nr("grosime_mm") : null,
        jacheta: (String(d.get("jacheta") ?? "") || null) as Jacheta | null,
        element: String(d.get("element")) as Element,
        cantitate: nr("cantitate") ?? 0,
        pret_dublu: d.get("pret_dublu") === "on",
        // Corectat de om: nu mai e nimic nesigur la rand, iar pagina se reverifica.
        nesigur: false,
      } satisfies Partial<RandSantier>);
      p.verificata = false;
      editeaza = null;
      deseneazaPagina(p.id);
    });

    /** Paginile au plecat; ramase aici, s-ar putea trimite a doua oara. */
    function golesteDupaTrimitere(): void {
      for (const p of pagini) URL.revokeObjectURL(p.url);
      pagini = [];
      fisiere.clear();
      titlu = "";
      editeaza = null;
      comparatie = null;
      salveazaLucru();
    }

    /**
     * Lista clientului (un import din istoric, refacut fara model) fata de
     * randurile din pagini. Ca la situatie, randurile trec prin import pe tipul
     * ofertei ales sus, deci cad pe aceleasi randuri din lista ca cererea.
     */
    async function compara(): Promise<void> {
      if (!comparaCu || lucreaza) return;
      lucreaza = true;
      deseneazaTrimite();
      try {
        const s = await incarcaImport(comparaCu);
        if (!s) throw new Error("importul nu mai e in istoric");
        const [{ redeschideImport }, { executatDinMasuratori }, { comparaCuLista, randuriDinLista }] =
          await Promise.all([
            import("../../src/import/redeschide.js"), import("../../src/lucrari/potrivire.js"),
            import("../../src/lucrari/comparatie.js"),
          ]);
        // Memoria de sabloane a ecranului de import: lista iese cum a vazut-o omul acolo.
        const rez = await redeschideImport(s, {
          stoc: stocLocal(), destinatie,
          grosimiPropuse: new Map(s.grosimiPropuse ?? []),
          descrieriSchimbate: new Set(s.descrieriSchimbate ?? []),
          preturiManuale: new Map(s.preturiManuale ?? []),
        });
        const masurat = await executatDinMasuratori(pagini.flatMap((p) => p.randuri), destinatie);
        comparatie = { lista: s.nume, c: comparaCuLista(randuriDinLista(rez.linii), masurat) };
        eroare = "";
      } catch (e) {
        console.error(e);
        comparatie = null;
        eroare = "Lista clientului nu s-a putut compara. Încearcă din nou.";
      }
      lucreaza = false;
      deseneaza();
      gazda.querySelector("#comparatie")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    /**
     * Paginile verificate, cu poza lor, pastrate pe server cand pleaca (pe
     * linkul demo nu se pastreaza). O poza care nu se poate citi din nou nu
     * opreste trimiterea: randurile pleaca oricum.
     */
    async function pastreazaPagini(santierId?: string): Promise<void> {
      if (modDate() !== "server") return;
      const cuPoze = await Promise.all(pagini.map(async (p) => {
        try {
          const blob = await (await fetch(p.url)).blob();
          return { poza: await micsoreaza(new File([blob], p.nume, { type: blob.type })), randuri: p.randuri };
        } catch {
          return { randuri: p.randuri };
        }
      }));
      salveazaMasuratori(scop, santierId, cuPoze);
    }

    async function puneInSituatie(): Promise<void> {
      const plan = citestePlanuri().find((p) => p.id === planAles);
      if (!plan || lucreaza) return;
      lucreaza = true;
      deseneazaTrimite();
      try {
        // Importul (ExcelJS) se incarca abia acum, ca la citirea unui fisier.
        const { executatDinMasuratori, potriveste } = await import("../../src/lucrari/potrivire.js");
        const executat = await executatDinMasuratori(pagini.flatMap((p) => p.randuri), plan.destinatie as Destinatie);
        predaSituatie({ plan: plan.id, potrivire: potriveste(plan, executat), pagini: pagini.length });
        await pastreazaPagini(plan.id);
      } catch (e) {
        console.error(e);
        eroare = "Rândurile nu s-au putut pune pe șantier. Încearcă din nou.";
        lucreaza = false;
        deseneaza();
        return;
      }
      lucreaza = false;
      golesteDupaTrimitere();
      trimisa = `Ultimele măsurători au plecat în situația nouă de pe șantierul „${plan.denumire}”, în Șantiere.`;
      location.hash = "#/lucrari";
    }

    /**
     * Comanda etapei din masuratori (S2): materialul randurilor masurate, ca la
     * oferta, minus ce e acum pe santier si ce e comandat nesosit, rotunjit la
     * ambalaj. Ciornele pleaca in Comenzi; nimic nu se trimite singur.
     */
    async function faComanda(): Promise<void> {
      const plan = citestePlanuri().find((p) => p.id === planAles);
      if (!plan || lucreaza) return;
      lucreaza = true;
      mesajComanda = "";
      deseneazaTrimite();
      try {
        const [{ necesarDinMasuratori }, { ciorneDinRamas, deComandatSantier }, { pretPropus }] = await Promise.all([
          import("../../src/stoc/din-masuratori.js"), import("../../src/stoc/comenzi.js"), import("../../src/stoc/preturi-furnizori.js"),
        ]);
        const dep = citesteDepozit();
        const al = dep.necesare.find((n) => n.santier === plan.id);
        const nec = await necesarDinMasuratori(pagini.flatMap((p) => p.randuri), plan.destinatie as Destinatie, {
          ...(al?.pierderi ? { pierderi: al.pierderi } : {}), ...(al?.pragTub !== undefined ? { pragTub: al.pragTub } : {}),
          ...(al?.tuburiPeste ? { tuburiPeste: al.tuburiPeste } : {}),
        });
        const alte = dep.necesare.filter((n) => n.santier && n.santier !== plan.id).map((n) => ({ depozit: n.santier!, materiale: n.materiale }));
        const ramas = deComandatSantier(nec.materiale, dep.miscari, dep.comenzi ?? [], plan.id, dep.ambalaje, alte, "sold");
        const data = new Date().toLocaleDateString("ro-RO");
        const ciorne = ciorneDinRamas(ramas, {
          firma: plan.firma, santier: plan.id, spre: plan.id,
          nota: `Din măsurătorile de pe teren din ${data} (${pagini.length === 1 ? "o pagină" : `${pagini.length} pagini`}).`,
        }, idNou, new Date().toISOString(), (a, f) => pretPropus(a, f, dep.miscari));
        const fara = nec.faraNecesar.length;
        if (ciorne.length === 0) {
          lucreaza = false;
          mesajComanda = `Nimic de comandat: ce s-a măsurat e acoperit de ce e pe șantier sau deja comandat.${
            fara ? ` ${fara === 1 ? "Un rând n-a dat" : `${fara} rânduri n-au dat`} material (fără preț în liste).` : ""}`;
          deseneazaTrimite();
          return;
        }
        for (const c of ciorne) puneComanda(c);
        await pastreazaPagini(plan.id);
      } catch (e) {
        console.error(e);
        eroare = "Materialele nu s-au putut calcula. Încearcă din nou.";
        lucreaza = false;
        deseneaza();
        return;
      }
      lucreaza = false;
      golesteDupaTrimitere();
      trimisa = `Ultimele măsurători au făcut ciornele de comandă pentru „${plan.denumire}”, în Comenzi.`;
      location.hash = "#/comenzi";
    }

    async function trimite(): Promise<void> {
      if (pagini.some((p) => !p.verificata)) return;
      if (scop === "situatie") return puneInSituatie();
      if (scop === "comanda") return faComanda();
      const linii = spreCerere(pagini.flatMap((p) => p.randuri));
      if (linii.length === 0) return;
      const nume = titlu.trim() || "Măsurători de șantier";
      const buf = await registruCerere(linii, nume);
      const fisier = new File([buf], `${nume.replace(/[\\/:*?"<>|]+/g, " ").trim()} - masuratori santier.xlsx`, {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      preda({ fisier, destinatie, pretDublu: true });
      await pastreazaPagini();
      golesteDupaTrimitere();
      trimisa = `Ultima listă a plecat la import: ${fisier.name}. O găsești la „Cerere nouă”, în importurile recente.`;
      location.hash = "#/import";
    }

    deseneaza();
  },
};
