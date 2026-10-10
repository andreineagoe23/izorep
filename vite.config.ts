import { defineConfig } from "vite";

// base = numele repo-ului: GitHub Pages serveste din /izorep/
export default defineConfig({
  root: "web",
  base: process.env["VITE_BASE"] ?? "/izorep/",
  build: { outDir: "../dist-web", emptyOutDir: true },
  // Tot `/api` e al serverului (`npm run server`, 8787), si rutele modelului
  // (src/server/model.ts): in dev, ca in productie, doar dupa intrare.
  server: { proxy: { "/api": { target: "http://localhost:8787" } } },
});
