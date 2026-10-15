import { esc } from "./ecrane/tip.js";

/**
 * Confirmarea ștergerii de tot (Andrei, 15 octombrie 2026): un panou sub
 * rândul ales, cu tot ce pleacă, rând cu rând (`rezumatStergere`). Două
 * verificări, ca să nu se șteargă din greșeală: „Șterge” deschide panoul, iar
 * „Șterge definitiv” merge doar după bifa „Am înțeles”.
 *
 * Doar marcajul și bifa. Ce face „Șterge definitiv” (`data-act`) hotărăște
 * ecranul, cu atributele din `date`.
 */
export function panouStergere(o: {
  /** Ce se șterge, cu numele lui: „cererea „X.xlsx””, „șantierul „Y””. */
  ce: string;
  linii: string[];
  date: Record<string, string>;
  /** Mesajul serverului, când a refuzat. */
  eroare?: string;
}): string {
  const date = Object.entries(o.date).map(([k, v]) => ` data-${k}="${esc(v)}"`).join("");
  const id = `sterge-${Object.values(o.date).join("-").replace(/[^\w-]/g, "")}`;
  return `<div class="sterge-panou" role="alertdialog" aria-labelledby="${id}-t" aria-describedby="${id}-l">
    <p class="sterge-titlu" id="${id}-t"><strong>Ești sigur că vrei să ștergi ${esc(o.ce)}?</strong></p>
    <p class="sterge-sub">Se vor șterge definitiv, fără drum înapoi:</p>
    <ul id="${id}-l">${o.linii.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>
    ${o.eroare ? `<p class="alerta" role="alert">${esc(o.eroare)}</p>` : ""}
    <label class="sterge-bifa"><input type="checkbox" data-act="sterge-bifa" /> Am înțeles: se șterg definitiv și nu se mai pot recupera</label>
    <div class="imp-formular-butoane">
      <button type="button" class="secundar sterge-definitiv" data-act="sterge-definitiv"${date} disabled>Șterge definitiv</button>
      <button type="button" class="secundar" data-act="sterge-renunta"${date}>Renunță</button>
    </div>
  </div>`;
}

/** Bifa pornește butonul „Șterge definitiv” de lângă ea. O dată pe rădăcina ecranului. */
export function legaPanouStergere(gazda: HTMLElement): void {
  gazda.addEventListener("change", (e) => {
    const bifa = e.target as HTMLInputElement;
    if (bifa.dataset?.["act"] !== "sterge-bifa") return;
    const b = bifa.closest(".sterge-panou")?.querySelector<HTMLButtonElement>('[data-act="sterge-definitiv"]');
    if (b) b.disabled = !bifa.checked;
  });
}
