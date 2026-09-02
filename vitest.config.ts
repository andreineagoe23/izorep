import { defineConfig } from "vitest/config";

// Config separat de vite.config.ts: acela are root-ul in web/ pentru build-ul
// paginii, iar vitest ar cauta testele acolo.
export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
  },
});
