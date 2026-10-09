import { defineConfig } from "vite";
import { pluginModel } from "./scripts/vite-plugin-model.js";

// base = numele repo-ului: GitHub Pages serveste din /izorep/
export default defineConfig({
  root: "web",
  base: process.env["VITE_BASE"] ?? "/izorep/",
  build: { outDir: "../dist-web", emptyOutDir: true },
  plugins: [pluginModel()],
  // Datele comune: serverul (`npm run server`) asculta pe 8787. Rutele modelului
  // (/api/extrage, /api/poza) raman ale pluginului, in procesul lui vite.
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:8787",
        bypass: (req) => (/^\/api\/(extrage|poza)\b/.test(req.url ?? "") ? req.url : undefined),
      },
    },
  },
});
