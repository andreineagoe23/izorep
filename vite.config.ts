import { defineConfig } from "vite";

// base = numele repo-ului: GitHub Pages serveste din /izorep/
export default defineConfig({
  root: "web",
  base: process.env["VITE_BASE"] ?? "/izorep/",
  build: { outDir: "../dist-web", emptyOutDir: true },
});
