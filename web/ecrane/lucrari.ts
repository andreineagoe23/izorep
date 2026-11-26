/**
 * Lucrări (planul UX, Faza 2, 14 noiembrie 2026): lista lucrărilor pe stadii
 * și pagina unei lucrări, cu filele în ordinea fluxului.
 *
 * O lucrare e o cerere de la client plus, când există, oferta salvată din ea
 * și șantierul pornit din ofertă (`web/lucrare.ts`). Înainte erau cinci
 * locuri în meniu (Cerere nouă, Oferte și cereri, Șantiere, Măsurători,
 * Materiale), iar omul trebuia să știe singur în care intră și ce urmează.
 *
 * Adresele:
 * - `#/lucrari?stadiu=<stadiu>`: lista, pe fila stadiului;
 * - `#/lucrari/noua[/poze]`: o cerere nouă (fișierul sau pozele din carnet);
 * - `#/lucrari/<id>/<fila>`: pagina lucrării; `<id>` e al cererii, sau al
 *   șantierului la lucrările fără cerere. Adresele vechi ale unui șantier
 *   (`#/lucrari/<santier>/materiale`) duc la aceeași pagină.
 *
 * Filele paginii sunt butoane, nu linkuri: o situație sau o ofertă începută
 * nu se pierde la schimbarea filei; adresa se scrie cu `replaceState`.
 */
import { esc, eur, stare, tabel, titluEcran, type Ecran } from "./tip.js";
import { vedeCosturi } from "../nav.js";
import {
  ceSeVaSterge, citesteDepozit, citesteOferte, citestePlanuri, listeaza, stergeDeTot, type IntrareIstoric,
} from "../date.js";
import { legaPanouStergere, panouStergere } from "../confirmare.js";
import { ceriSpatiu } from "../meniu-stare.js";
import { FIRME, firmaDupa, tineFirma, ultimaFirma, type IdFirma } from "../date/firme.js";
import { stareLucrarii } from "../stare-lucrare.js";
import {
  FILE_LUCRARE, STADII, clientLucrare, firmaLucrare, gasesteLucrarea, lucrariDin, refuzata, stadiu, stareFile,
  titluLucrare, urmeaza, type FilaLucrare, type Lucrare, type Stadiu, type StareLucrare, type Urmeaza,
} from "../lucrare.js";
import type { ControlImport, ParteImport } from "./import.js";
import type { ControlSantier, FilaSantier } from "./santier-panou.js";

const TITLU = "Lucrări";
const SUBTITLU = "Fiecare cerere de la client, cu oferta și șantierul ei.";

/** Ce s-a șters de pe pagina unei lucrări, spus o dată pe listă. */
let mesajLista = "";

const adresaLucrare = (id: string, fila?: string): string =>
  `#/lucrari/${encodeURIComponent(id)}${fila ? `/${fila}` : ""}`;

/**
 * Sub titlu: clientul, oferta (număr și dată) și valoarea. Doar ce nu e deja
 * în titlu: o lucrare fără ofertă își ia titlul din client sau din fișier, iar
 * rândul ar fi repetat titlul paginii.
 */
function detaliiLucrare(l: Lucrare): string {
  const o = l.oferta;
  const client = clientLucrare(l);
  const parti = [
    firmaDupa(firmaLucrare(l))?.scurt ?? "",
    client !== titluLucrare(l) ? client : "",
    o ? [o.numar ? `oferta ${o.numar}` : "oferta fără număr", o.data].filter(Boolean).join(" din ") : l.plan?.oferta ? `oferta ${l.plan.oferta}` : "",
    o && vedeCosturi() ? eur(o.valoare) : "",
  ].filter(Boolean);
  return parti.join(" · ");
}

/* ------------------------------------------------------------------ lista */

async function deseneazaLista(root: HTMLElement): Promise<void> {
  titluEcran(TITLU, SUBTITLU);
  const dep = citesteDepozit();
  const toate = lucrariDin(await listeaza(), citesteOferte(), citestePlanuri())
    .map((l) => ({ l, firma: firmaLucrare(l), st: stadiu(l), u: urmeaza(stareLucrarii(l, dep)) }));
  // Firma (Etapa 2): din adresă; altfel ultima aleasă, dacă are lucrări; altfel prima care are.
  const dinAdresaFirma = firmaDupa(/[?&]firma=([\w-]+)/.exec(location.hash)?.[1])?.id;
  const areFirma = (f: IdFirma): boolean => toate.some((x) => x.firma === f);
  const ultima = ultimaFirma();
  const firma: IdFirma = dinAdresaFirma
    ?? (areFirma(ultima) ? ultima : FIRME.find((f) => areFirma(f.id))?.id ?? ultima);
  const aleFirmei = toate.filter((x) => x.firma === firma);
  const numar = (s: Stadiu): number => aleFirmei.filter((x) => x.st === s).length;
  const dinAdresa = /[?&]stadiu=([\w-]+)/.exec(location.hash)?.[1] as Stadiu | undefined;
  // Se deschide prima filă care are ceva; aleasă de om, rămâne (și la reîncărcare).
  const activ: Stadiu = STADII.some((s) => s.id === dinAdresa) ? dinAdresa!
    : STADII.find((s) => numar(s.id) > 0)?.id ?? "de-ofertat";
  const pe = aleFirmei.filter((x) => x.st === activ);
  const randuri = pe.map(({ l, u }) => {
    const o = l.oferta;
    const refuz = refuzata(l);
    return `<tr>
      <td><b>${esc(titluLucrare(l))}</b>${refuz ? ` ${stare("refuzată", "atentie")}` : ""}${
        l.plan?.inchis ? ` ${stare("închisă", "ok")}` : ""}${clientLucrare(l) && clientLucrare(l) !== titluLucrare(l)
        ? `<br><span class="hint">${esc(clientLucrare(l))}</span>` : ""}</td>
      <td>${o ? `${esc(o.numar || "fără număr")}${o.data ? `<br><span class="hint">${esc(o.data)}</span>` : ""}` : "—"}</td>
      ${vedeCosturi() ? `<td class="n">${o ? eur(o.valoare) : "—"}</td>` : ""}
      <td>${esc(u.text)}</td>
      <td class="fix"><a class="secundar" href="${adresaLucrare(l.id)}">Deschide</a></td>
    </tr>`;
  });
  // Fila firmei duce la prima filă de stadiu a ei (nu ține stadiul celeilalte firme).
  const filaFirma = (f: (typeof FIRME)[number]): string =>
    `<a href="#/lucrari?firma=${f.id}" class="fila" data-act="firma" data-firma="${f.id}"${f.id === firma ? ' aria-current="page"' : ""}>${
      esc(f.scurt)} <b>${toate.filter((x) => x.firma === f.id).length}</b></a>`;
  const fila = (s: { id: Stadiu; eticheta: string }): string =>
    `<a href="#/lucrari?firma=${firma}&amp;stadiu=${s.id}" class="fila"${s.id === activ ? ' aria-current="page"' : ""}>${esc(s.eticheta)} <b>${numar(s.id)}</b></a>`;
  const gol: Record<Stadiu, string> = {
    "de-ofertat": "Nicio cerere fără ofertă.",
    trimise: "Nicio ofertă care așteaptă răspunsul clientului.",
    "in-lucru": "Niciun șantier în lucru.",
    inchise: "Nicio lucrare închisă.",
  };
  root.innerHTML = `<div class="imp lucrari">
    <div class="lucrari-sus">
      <nav class="file file-firme" aria-label="Firma">${FIRME.map(filaFirma).join("")}</nav>
      <a class="primar" href="#/lucrari/noua?firma=${firma}">Cerere nouă</a>
    </div>
    ${mesajLista ? `<p class="hint" role="status" style="margin:0">${esc(mesajLista)}</p>` : ""}
    <nav class="file" aria-label="Stadiul lucrărilor">${STADII.map(fila).join("")}</nav>
    ${pe.length === 0 ? `<p class="hint" style="margin:0">${gol[activ]}</p>`
      : `<section class="imp-card">${tabel(
        ["Lucrarea", "Oferta", ...(vedeCosturi() ? ["Valoare"] : []), "Urmează", ""], randuri,
        ["", "", ...(vedeCosturi() ? ["n"] : []), "", ""],
      )}</section>`}
  </div>`;
  // Fila de firmă aleasă de om e și firma cu care pornește următoarea cerere.
  root.querySelector(".file-firme")?.addEventListener("click", (e) => {
    const a = (e.target as HTMLElement).closest<HTMLElement>("[data-firma]");
    if (a?.dataset["firma"]) tineFirma(a.dataset["firma"]);
  });
  mesajLista = "";
}

/* ------------------------------------------------------- pagina lucrării */

/** Fila din adresă; numele vechi de pe pagina șantierului trec pe cele noi. */
function filaDin(s: string | undefined): FilaLucrare | "plan" | "sterge" | null {
  if (!s) return null;
  if (s === "inchide") return "inchidere";
  if (s === "plan" || s === "sterge") return s;
  return FILE_LUCRARE.some((f) => f.id === s) ? s as FilaLucrare : null;
}

async function deseneazaPagina(root: HTMLElement, idDinAdresa: string | null, segment: string | undefined): Promise<void> {
  let cereri: IntrareIstoric[] = await listeaza();
  /** Lucrarea de pe pagină; null = cerere nouă, încă fără fișier. */
  let l: Lucrare | null = null;
  const reface = (id: string): Lucrare | null => gasesteLucrarea(lucrariDin(cereri, citesteOferte(), citestePlanuri()), id) ?? null;
  if (idDinAdresa) {
    l = reface(idDinAdresa);
    if (!l) {
      titluEcran("Lucrarea nu mai există");
      root.innerHTML = `<div class="imp"><p class="alerta" role="alert">Lucrarea de la adresa asta nu mai există: poate a șters-o
        un coleg.</p><p><a href="#/lucrari">← Toate lucrările</a></p></div>`;
      return;
    }
  }

  let fila: FilaLucrare | "plan" | "sterge" = filaDin(segment) ?? (l ? urmeaza(stareLucrarii(l, citesteDepozit())).fila : "cerere");
  /** „Clientul a acceptat”: întrebarea de pe loc, apoi eroarea, dacă e. */
  let acceptare: { eroare: string } | null = null;
  let lucreaza = false;
  let eroareStergere = "";
  let imp: ControlImport | null = null;
  let sant: ControlSantier | null = null;
  let santPentru = "";

  root.innerHTML = `<div class="imp lucrare">
    <div id="luc-sus" class="file-panou"></div>
    <div id="luc-import" hidden></div>
    <div id="luc-santier" class="file-panou" hidden></div>
    <div id="luc-alt" class="file-panou" hidden></div>
  </div>`;
  const elSus = root.querySelector<HTMLElement>("#luc-sus")!;
  const elImport = root.querySelector<HTMLElement>("#luc-import")!;
  const elSantier = root.querySelector<HTMLElement>("#luc-santier")!;
  const elAlt = root.querySelector<HTMLElement>("#luc-alt")!;

  const stareAcum = (): StareLucrare | null => (l ? stareLucrarii(l, citesteDepozit()) : null);

  function scrieAdresa(): void {
    if (!l) return;
    history.replaceState(null, "", adresaLucrare(l.id, fila));
  }

  function meniu(lu: Lucrare): string {
    return `<div class="cel-meniu-loc">
      <button type="button" class="cel-meniu" data-act="meniu-lucrare" aria-haspopup="menu" aria-expanded="false"
        aria-label="Mai multe despre lucrare" title="Mai multe despre lucrare">⋯</button>
      <div class="meniu-rand" role="menu" hidden>
        ${lu.plan ? `<button type="button" role="menuitem" data-act="fila" data-fila="plan">Planul de șantier</button>` : ""}
        <button type="button" role="menuitem" data-act="fila" data-fila="sterge">Șterge lucrarea</button>
      </div>
    </div>`;
  }

  /** Butonul din „Urmează”; nu se desenează când doar ar duce pe fila deschisă deja. */
  function buton(b: Urmeaza["primar"], clasa: string): string {
    if (!b) return "";
    if (b.act === "fila" && b.fila === fila) return "";
    return `<button type="button" class="${clasa}" data-act="urmeaza" data-urm="${b.act}"${b.fila ? ` data-fila="${b.fila}"` : ""}>${esc(b.eticheta)}</button>`;
  }

  function randUrmeaza(s: StareLucrare): string {
    if (acceptare) {
      const titlu = l ? titluLucrare(l) : "";
      return `<section class="imp-card urmeaza" aria-live="polite">
        <p class="urmeaza-text">Pornești șantierul <b>${esc(titlu)}</b>? Se face planul din ofertă și lista de materiale,
          cu regulile obișnuite ale firmei.</p>
        <div class="mat-actiuni">
          <button type="button" class="primar" data-act="porneste"${lucreaza ? " disabled" : ""}>${lucreaza ? "Se pornește…" : "Da, pornește șantierul"}</button>
          <button type="button" class="secundar" data-act="renunta-acceptare">Renunță</button>
        </div>
        ${acceptare.eroare ? `<p class="alerta" role="alert">${esc(acceptare.eroare)}</p>` : ""}
      </section>`;
    }
    const u = urmeaza(s);
    // Pe fila Situații cu situația deschisă, „Situație nouă” n-are ce mai face.
    const primar = u.primar?.act === "situatie-noua" && fila === "situatii" && elSantier.querySelector("#situatie") ? undefined : u.primar;
    return `<section class="imp-card urmeaza">
      <p class="urmeaza-text"><span class="urmeaza-eticheta">Urmează</span> ${esc(u.text)}</p>
      <div class="mat-actiuni">${buton(primar, "primar")}${buton(u.alb, "secundar")}</div>
    </section>`;
  }

  function file(s: StareLucrare): string {
    const st = stareFile(s);
    return `<nav class="file file-lucrare" aria-label="Pașii lucrării">${FILE_LUCRARE.map((f) => {
      const x = st[f.id];
      return `<button type="button" class="fila" data-act="fila" data-fila="${f.id}"${f.id === fila ? ' aria-current="page"' : ""}${
        x.inchisa ? ` aria-disabled="true" title="${esc(x.inchisa)}"` : ""}>${
        x.gata && !x.inchisa ? `<span class="gata" aria-hidden="true">✓</span>` : ""}${esc(f.eticheta)}${
        x.gata && !x.inchisa ? `<span class="ascuns"> (gata)</span>` : ""}</button>`;
    }).join("")}</nav>`;
  }

  function deseneazaSus(): void {
    if (!l) {
      titluEcran("Cerere nouă", "Fișierul Excel de la client sau pozele din carnet. Aplicația citește pozițiile și le pune prețul.");
      elSus.innerHTML = `<p style="margin:0"><a class="legatura" href="#/lucrari">← Toate lucrările</a></p>`;
      return;
    }
    const s = stareAcum()!;
    titluEcran(titluLucrare(l));
    const detalii = `${refuzata(l) ? `${stare("refuzată", "atentie")} ` : ""}${l.plan?.inchis ? `${stare("închisă", "ok")} ` : ""}${
      esc(detaliiLucrare(l))}`.trim();
    const inapoi = `<a class="legatura" href="#/lucrari?firma=${firmaLucrare(l)}">← Toate lucrările</a>`;
    // Fără nimic de spus sub titlu, „⋯” urcă lângă „← Toate lucrările”: singur pe un rând lăsa un gol.
    elSus.innerHTML = `${detalii ? `<p style="margin:0">${inapoi}</p>` : ""}
      <header class="pagina-antet${detalii ? "" : " doar-inapoi"}">
        <div>${detalii ? `<p class="hint">${detalii}</p>` : inapoi}</div>
        <div class="mat-actiuni">${meniu(l)}</div>
      </header>
      ${randUrmeaza(s)}
      ${file(s)}`;
  }

  /** Lucrarea s-a schimbat (o salvare, oferta, șantierul): antetul, „Urmează” și filele, din nou. */
  function actualizeaza(): void {
    if (l) l = reface(l.id) ?? l;
    deseneazaSus();
  }

  async function arata(f: typeof fila, focus = false): Promise<void> {
    fila = f;
    scrieAdresa();
    deseneazaSus();
    const s = stareAcum();
    const st = s ? stareFile(s) : null;
    const inchisa = f !== "plan" && f !== "sterge" && st ? st[f].inchisa : undefined;
    elImport.hidden = elSantier.hidden = elAlt.hidden = true;
    if (focus) root.querySelector<HTMLElement>(`.file [data-fila="${f}"]`)?.focus();

    if (!l || ((f === "cerere" || f === "oferta") && !inchisa)) {
      elImport.hidden = false;
      const parte: ParteImport = !l ? "fisier" : f === "oferta" ? "oferta" : "verificare";
      if (imp) { imp.arata(parte); return; }
      const { montezaImport } = await import("./import.js");
      imp = await montezaImport(elImport, {
        ...(l?.cerere ? { cerere: l.cerere.id } : {}), parte,
        // Cerere nouă din fila unei firme: pornește pe firma ei.
        ...(!l ? { firma: /[?&]firma=([\w-]+)/.exec(location.hash)?.[1] ?? "" } : {}),
        laCerereNoua: (id) => void cerereNoua(id),
        laParte: (p) => { fila = p === "oferta" ? "oferta" : "cerere"; scrieAdresa(); deseneazaSus(); },
        laSchimbare: (r) => {
          if (!l?.cerere) return;
          // Lista de cereri ține ce s-a salvat: „Urmează” se schimbă fără o cerere nouă la server.
          cereri = cereri.map((c) => (c.id === l!.cerere!.id ? { ...c, deVerificat: r.deVerificat, antet: r.antet } : c));
          actualizeaza();
        },
        laOferta: () => { actualizeaza(); },
        areOferta: () => !!l?.oferta,
        santier: () => (l?.plan ? (l.plan.inchis ? "inchis" : "pornit") : null),
      });
      return;
    }
    // Pe celelalte file importul rămâne montat, ascuns: ce era scris acolo nu se pierde.
    ceriSpatiu(root, false);
    if (inchisa) {
      elAlt.hidden = false;
      elAlt.innerHTML = `<section class="imp-card"><p class="hint" style="margin:0">${esc(inchisa)}</p></section>`;
      return;
    }
    if (f === "sterge") {
      elAlt.hidden = false;
      elAlt.innerHTML = panouSterge();
      elAlt.querySelector<HTMLElement>('[data-act="sterge-bifa"]')?.focus();
      return;
    }
    if (!l?.plan) return;
    elSantier.hidden = false;
    // Aici fila e a șantierului: Cerere și Ofertă au plecat mai sus.
    const fs = f as FilaSantier;
    if (sant && santPentru === l.plan.id) { sant.arata(fs); return; }
    const { montezaSantier } = await import("./santier-panou.js");
    santPentru = l.plan.id;
    sant = montezaSantier(elSantier, {
      plan: l.plan.id, fila: fs, cerere: l.cerere?.id, laSchimbare: actualizeaza,
    });
  }

  function panouSterge(): string {
    if (!l) return "";
    const tinta = l.cerere ? { cerere: { id: l.cerere.id, nume: l.cerere.nume } } : { santier: l.plan!.id };
    return `<section class="imp-card"><h2>Șterge lucrarea</h2>${panouStergere({
      ce: `lucrarea „${titluLucrare(l)}”`, linii: ceSeVaSterge(tinta), date: { id: l.id },
      ...(eroareStergere ? { eroare: eroareStergere } : {}),
    })}</section>`;
  }

  /** Fișierul (sau pozele) a dat o cerere nouă: pagina devine a lucrării ei, fără o navigare nouă. */
  async function cerereNoua(id: string): Promise<void> {
    cereri = await listeaza();
    l = reface(id);
    if (!l) return;
    fila = "cerere";
    scrieAdresa();
    deseneazaSus();
  }

  async function porneste(): Promise<void> {
    if (!l?.cerere || lucreaza) return;
    lucreaza = true;
    deseneazaSus();
    const id = l.cerere.id;
    let r;
    if (imp) {
      await imp.salveazaAcum();
      r = imp.santier();
    } else {
      const { santierDinCerere } = await import("./import.js");
      r = await santierDinCerere(id);
    }
    lucreaza = false;
    if ("eroare" in r) {
      acceptare = { eroare: r.eroare };
      if (r.fila) { await arata(r.fila); return; }
      deseneazaSus();
      return;
    }
    acceptare = null;
    actualizeaza();
    await arata("materiale");
  }

  async function refuz(zi: string | null): Promise<void> {
    if (!l?.cerere) return;
    const id = l.cerere.id;
    if (imp) await imp.refuz(zi);
    else {
      const { refuzCerere } = await import("./import.js");
      const gresit = await refuzCerere(id, zi);
      if (gresit) { acceptare = null; deseneazaSus(); return; }
    }
    cereri = cereri.map((c) => {
      if (c.id !== id) return c;
      const { refuzat: _r, ...rest } = c.antet ?? {};
      return { ...c, antet: zi ? { ...rest, refuzat: zi } : rest };
    });
    actualizeaza();
  }

  legaPanouStergere(elAlt);
  root.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const m = (e.target as HTMLElement).closest<HTMLElement>("#luc-sus .meniu-rand:not([hidden])");
    if (!m) return;
    m.hidden = true;
    const b = m.parentElement?.querySelector<HTMLElement>(".cel-meniu");
    b?.setAttribute("aria-expanded", "false");
    b?.focus();
  });
  // Un clic oriunde în afara meniului îl închide; pe document, deci pleacă singur odată cu ecranul.
  const inchideMeniul = (e: MouseEvent): void => {
    if (!root.isConnected) { document.removeEventListener("click", inchideMeniul); return; }
    for (const m of elSus.querySelectorAll<HTMLElement>(".meniu-rand:not([hidden])")) {
      if (m.parentElement?.contains(e.target as Node)) continue;
      m.hidden = true;
      m.parentElement?.querySelector(".cel-meniu")?.setAttribute("aria-expanded", "false");
    }
  };
  document.addEventListener("click", inchideMeniul);

  elSus.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-act]");
    if (!b) return;
    switch (b.dataset["act"]) {
      case "meniu-lucrare": {
        const m = b.nextElementSibling as HTMLElement | null;
        if (!m) return;
        m.hidden = !m.hidden;
        b.setAttribute("aria-expanded", String(!m.hidden));
        if (!m.hidden) m.querySelector<HTMLButtonElement>("button")?.focus();
        return;
      }
      case "fila": eroareStergere = ""; void arata(b.dataset["fila"] as typeof fila, true); return;
      case "urmeaza": {
        const act = b.dataset["urm"];
        if (act === "fila") { void arata(b.dataset["fila"] as FilaLucrare); return; }
        if (act === "comenzi") { location.hash = "#/comenzi"; return; }
        if (act === "situatie-noua") { void arata("situatii").then(() => sant?.situatieNoua()); return; }
        if (act === "accepta") { acceptare = { eroare: "" }; deseneazaSus(); elSus.querySelector<HTMLElement>('[data-act="porneste"]')?.focus(); return; }
        if (act === "refuza") { void refuz(new Date().toISOString()); return; }
        if (act === "accepta-tarziu") {
          void refuz(null).then(() => {
            acceptare = { eroare: "" };
            deseneazaSus();
            elSus.querySelector<HTMLElement>('[data-act="porneste"]')?.focus();
          });
        }
        return;
      }
      case "porneste": void porneste(); return;
      case "renunta-acceptare": acceptare = null; deseneazaSus(); return;
    }
  });

  elAlt.addEventListener("click", (e) => {
    const b = (e.target as HTMLButtonElement).closest<HTMLButtonElement>("button[data-act]");
    if (!b || !l) return;
    if (b.dataset["act"] === "sterge-renunta") { void arata(urmeaza(stareAcum()!).fila); return; }
    if (b.dataset["act"] !== "sterge-definitiv") return;
    const lu = l;
    b.disabled = true;
    b.textContent = "Se șterge…";
    const tinta = lu.cerere ? { cerere: { id: lu.cerere.id, nume: lu.cerere.nume } } : { santier: lu.plan!.id };
    void stergeDeTot(tinta).then((gresit) => {
      if (gresit) { eroareStergere = `Nu s-a șters: ${gresit}`; void arata("sterge"); return; }
      mesajLista = `Am șters lucrarea „${titluLucrare(lu)}” și tot ce ținea de ea.`;
      location.hash = "#/lucrari";
    });
  });

  await arata(fila);
}

export const ecran: Ecran = {
  id: "lucrari",
  titlu: TITLU,
  subtitlu: SUBTITLU,
  async render(root) {
    const parti = location.hash.replace(/^#\/?/, "").split("?")[0]!.split("/");
    const id = decodeURIComponent(parti[1] ?? "");
    if (!id) return deseneazaLista(root);
    if (id === "noua") return deseneazaPagina(root, null, undefined);
    return deseneazaPagina(root, id, parti[2]);
  },
};
