import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  site: "https://umitaltintas.github.io",
  base: "/fuzzy-history-search",
  vite: {
    plugins: [tailwindcss()],
  },
});
