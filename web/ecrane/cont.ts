/**
 * Contul meu (21 octombrie 2026): cine e intrat, schimbarea parolei și
 * ieșirea. Conturile noi și parolele uitate le face cine administrează
 * aplicația, cu `npm run om` (`src/server/om.ts`): aplicație mică, fără ecran
 * de administrare.
 */
import { esc, type Ecran } from "./tip.js";
import { eu, iesi, modDate, schimbaParola } from "../date.js";

export const ecran: Ecran = {
  id: "cont",
  titlu: "Contul meu",

  render(root) {
    const om = eu();
    if (modDate() !== "server" || !om) {
      root.innerHTML = `<section class="imp-card"><p class="hint" style="margin:0">Pe linkul demo nu există conturi: datele stau în acest browser.</p></section>`;
      return;
    }
    root.innerHTML = `<div class="imp intrare" style="margin:0;max-width:32rem">
      <section class="imp-card">
        <h2>${esc(om.nume)}</h2>
        <p class="hint" style="margin:0">${esc(om.email)}</p>
      </section>
      <section class="imp-card">
        <h2>Schimbă parola</h2>
        <form id="form-cont" novalidate>
          <label>Parola de acum<span class="parola"><input name="veche" type="password" autocomplete="current-password" required />
            <button type="button" class="secundar" data-arata-parola aria-pressed="false">Arată</button></span></label>
          <label>Parola nouă, de cel puțin 10 caractere<span class="parola"><input name="noua" type="password" autocomplete="new-password" minlength="10" required />
            <button type="button" class="secundar" data-arata-parola aria-pressed="false">Arată</button></span></label>
          <label>Parola nouă, încă o dată<input name="repeta" type="password" autocomplete="new-password" required /></label>
          <p class="alerta" role="alert" hidden></p>
          <p class="hint" role="status" hidden></p>
          <button type="submit" class="primar">Schimbă parola</button>
        </form>
        <p class="hint">După schimbare, ceilalți care au intrat cu contul tău (alt calculator, alt telefon) trebuie să intre din nou.</p>
      </section>
      <p><button type="button" class="secundar" id="iesi-cont">Ieși din cont</button></p>
    </div>`;
    const f = root.querySelector<HTMLFormElement>("#form-cont")!;
    f.addEventListener("click", (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-arata-parola]");
      const input = b?.parentElement?.querySelector<HTMLInputElement>("input");
      if (!b || !input) return;
      const arata = input.type === "password";
      input.type = arata ? "text" : "password";
      b.textContent = arata ? "Ascunde" : "Arată";
      b.setAttribute("aria-pressed", String(arata));
    });
    root.querySelector("#iesi-cont")!.addEventListener("click", () => void iesi().then(() => { location.hash = ""; location.reload(); }));
    f.addEventListener("submit", async (e) => {
      e.preventDefault();
      const d = new FormData(f);
      const alerta = f.querySelector<HTMLElement>(".alerta")!;
      const gata = f.querySelector<HTMLElement>('[role="status"]')!;
      alerta.hidden = gata.hidden = true;
      const noua = String(d.get("noua") ?? "");
      if (noua !== String(d.get("repeta") ?? "")) { alerta.textContent = "Cele două parole noi nu sunt la fel."; alerta.hidden = false; return; }
      const gresit = await schimbaParola(String(d.get("veche") ?? ""), noua);
      if (gresit) { alerta.textContent = gresit; alerta.hidden = false; return; }
      f.reset();
      gata.textContent = "Parola e schimbată.";
      gata.hidden = false;
    });
  },
};
