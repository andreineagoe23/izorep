import { defineConfig } from "vite";
import { pluginModel } from "./scripts/vite-plugin-model.js";

// base = numele repo-ului: GitHub Pages serveste din /izorep/
export default defineConfig({
  root: "web",
  base: process.env["VITE_BASE"] ?? "/izorep/",
  build: { outDir: "../dist-web", emptyOutDir: true },
  plugins: [pluginModel()],
});
