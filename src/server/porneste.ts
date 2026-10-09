/**
 * `npm run server` — serverul local, pe portul 8787. `vite dev` ii trimite
 * cererile `/api/*` (vite.config.ts). In productie acelasi proces serveste si
 * pagina construita (`dist-web`), cand exista.
 *
 * Variabile, toate cu implicit pentru local:
 *   DATABASE_URL   conexiunea, cu rolul izorep_app (NOBYPASSRLS), niciodata proprietarul
 *   PORT           8787
 *   URL_APLICATIE  adresa paginii, pentru linkul din email
 *   SMTP_URL       smtp://localhost:1025 (Mailpit)
 *   EMAIL_DE       expeditorul
 */
import { existsSync } from "node:fs";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { conecteaza } from "../db/client.js";
import { creeazaServer } from "./app.js";
import { trimitePeEmail } from "./email.js";

const port = Number(process.env["PORT"] ?? 8787);
const urlAplicatie = process.env["URL_APLICATIE"] ?? "http://localhost:5173/izorep/";
const { db } = conecteaza();

const app = creeazaServer({
  db,
  trimiteLink: trimitePeEmail(
    process.env["SMTP_URL"] ?? "smtp://localhost:1025",
    process.env["EMAIL_DE"] ?? "Izorep <izorep@localhost>",
  ),
  urlAplicatie,
  cookieSecure: urlAplicatie.startsWith("https://"),
});

if (existsSync("dist-web/index.html")) app.use("/*", serveStatic({ root: "./dist-web" }));

serve({ fetch: app.fetch, port }, () => {
  console.log(`Serverul Izorep pe http://localhost:${port} · aplicatia: ${urlAplicatie}`);
});
