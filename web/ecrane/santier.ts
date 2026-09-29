import { agrega, type RandSantier } from "../../src/santier/agrega.js";
import { RaspunsPoza, type Element, type Izolatie, type Jacheta } from "../../src/santier/schema.js";
import { spreCerere } from "../../src/santier/spre-cerere.js";
import { registruCerere } from "../../src/santier/registru.js";
import type { Destinatie } from "../../src/pricing/lists.js";
import { preda } from "../predare.js";
import { cardIncarca, cardPagina, cardTrimite, type PaginaSantier } from "../santier-vizual.js";
import type { Ecran } from "./tip.js";

/**
 * Notițe de șantier: pozele carnetului -> randuri confirmate -> importul.
 *
 * Santierul nu foloseste aplicatia: scrie pe foaie si trimite poze. Omul de la
 * birou le incarca aici, modelul propune randurile (cand ruta exista, doar pe
 * serverul de dezvoltare), iar el le compara cu poza si confirma pagina. Din
 * paginile verificate iese un registru `.xlsx` care trece prin import exact ca
 * o lista de la client — deci aceeasi tarifare, aceeasi verificare, aceeasi
 * oferta. Nicio a doua cale de pret.
 *
 * Starea sta la nivel de modul: plecat pe alt ecran si intors, munca e tot
 * acolo. La reincarcarea paginii se pierde — pozele nu se pastreaza in browser.
 */
const RUTA_POZA = location.pathname.replace(/[^/]*$/, "") + "api/poza";
/** Cate pagini se citesc deodata. Fiecare apel dureaza secunde; doua tin progresul vizibil. */
const CONCURENTA = 2;
/** Latura maxima trimisa modelului. API-ul oricum reduce la 2048; mai mult e doar upload. */
const LATURA = 2048;

let pagini: PaginaSantier[] = [];
let destinatie: Destinatie = "rezidential";
let titlu = "";
let editeaza: string | null = null;
let eroare = "";
let urmator = 0;

const idNou = (): string => `${Date.now().toString(36)}-${(urmator++).toString(36)}`;

async function micsoreaza(f: File): Promise<string> {
  const bmp = await createImageBitmap(f, { imageOrientation: "from-image" });
  const k = Math.min(1, LATURA / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * k);
  c.height = Math.round(bmp.height * k);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  return c.toDataURL("image/jpeg", 0.85);
}

async function modelDisponibil(): Promise<boolean> {
  try {
    const r = await fetch(RUTA_POZA, { signal: AbortSignal.timeout(3000) });
    if (!r.ok) return false;
    return Boolean(((await r.json()) as { disponibil?: boolean }).disponibil);
  } catch {
    return false;
  }
}

/** Id-urile randurilor unice pe pagina, ca editarea sa stie ce rand e. */
const cuId = (randuri: RandSantier[]): RandSantier[] => randuri.map((r) => ({ ...r, id: idNou() }));

const randGol = (zona: string): RandSantier => ({
  id: idNou(), zona, diametru_valoare: null, diametru_tip: "exterior", izolatie: "vata_minerala", grosime_mm: 50,
  jacheta: "aluminiu", element: "ml", pret_dublu: false, cantitate: 0, termeni: [], nesigur: false,
});

export const ecran: Ecran = {
  id: "santier",
  titlu: "Notițe de șantier",
  subtitlu: "Pozele cu măsurătorile din carnet: rândurile citite din poză, verificate de tine, ajung în ofertă prin import.",

  async render(root) {
    root.innerHTML = `<div class="imp sant">
      <div id="sant-incarca"></div>
      <div id="sant-pagini" class="imp-pagina"></div>
      <div id="sant-trimite"></div>
    </div>`;
    const gazda = root.querySelector<HTMLElement>(".sant")!;
    const cuModel = await modelDisponibil();

    const deseneaza = (): void => {
      gazda.querySelector("#sant-incarca")!.innerHTML = cardIncarca({ destinatie, eroare });
      gazda.querySelector("#sant-pagini")!.innerHTML = pagini
        .map((p, i) => cardPagina(p, i + 1, { editeaza, destinatie })).join("");
      gazda.querySelector("#sant-trimite")!.innerHTML = cardTrimite({ pagini, titlu });
      legaDrop();
    };

    const pagina = (id: string | undefined): PaginaSantier | undefined => pagini.find((p) => p.id === id);

    async function citeste(p: PaginaSantier, f: File): Promise<void> {
      if (!cuModel) {
        p.stare = "gata";
        p.faraModel = true;
        return;
      }
      try {
        const imagine = await micsoreaza(f);
        const r = await fetch(RUTA_POZA, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imagine }), signal: AbortSignal.timeout(300_000),
        });
        const corp = (await r.json()) as { termeni?: unknown; note?: unknown; eroare?: string };
        if (!r.ok) throw new Error(corp.eroare ?? `HTTP ${r.status}`);
        // Ce vine de la server trece prin aceeasi schema inca o data.
        const citit = RaspunsPoza.parse({ termeni: corp.termeni, note: corp.note });
        p.randuri = cuId(agrega(citit.termeni));
        p.note = citit.note;
        p.stare = "gata";
      } catch (e) {
        console.error(e);
        p.stare = "eroare";
        p.eroare = "Poza nu s-a putut citi. Încearcă din nou, sau scoate pagina și scrie rândurile de mână.";
      }
    }

    async function adaugaPoze(fisiere: File[]): Promise<void> {
      eroare = "";
      const imagini = fisiere.filter((f) => f.type.startsWith("image/"));
      if (imagini.length < fisiere.length) {
        eroare = "Unele fișiere nu sunt poze și n-au fost adăugate. Aici merg doar poze (JPG, PNG).";
      }
      const noi = imagini.map((f) => ({
        f,
        p: {
          id: idNou(), nume: f.name, url: URL.createObjectURL(f), stare: "citeste" as const, eroare: "",
          randuri: [], note: [], verificata: false, faraModel: false,
        } satisfies PaginaSantier as PaginaSantier,
      }));
      pagini.push(...noi.map((x) => x.p));
      deseneaza();
      let i = 0;
      const lucrator = async (): Promise<void> => {
        for (let j = i++; j < noi.length; j = i++) {
          await citeste(noi[j]!.p, noi[j]!.f);
          deseneaza();
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
    });

    gazda.addEventListener("input", (e) => {
      const t = e.target as HTMLInputElement;
      if (t.name === "titlu" && t.closest("#trimite")) titlu = t.value;
    });

    gazda.addEventListener("click", (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-act]");
      if (!b) return;
      const p = pagina(b.dataset["pag"]);
      const r = p?.randuri.find((x) => x.id === b.dataset["rand"]);
      switch (b.dataset["act"]) {
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
          if (p) { URL.revokeObjectURL(p.url); pagini = pagini.filter((x) => x !== p); }
          break;
        default:
          return;
      }
      deseneaza();
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
      deseneaza();
    });

    async function trimite(): Promise<void> {
      if (pagini.some((p) => !p.verificata)) return;
      const linii = spreCerere(pagini.flatMap((p) => p.randuri));
      if (linii.length === 0) return;
      const nume = titlu.trim() || "Măsurători de șantier";
      const buf = await registruCerere(linii, nume);
      const fisier = new File([buf], `${nume.replace(/[\\/:*?"<>|]+/g, " ").trim()} - masuratori santier.xlsx`, {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      preda({ fisier, destinatie, pretDublu: true });
      location.hash = "#/import";
    }

    deseneaza();
  },
};
