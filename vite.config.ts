// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// NOTE: Inside Lovable's hosted build, the nitro preset/output are forced to Cloudflare
// (this override is ignored). When running `npm run build` LOCALLY (e.g. to deploy to
// Hostinger), the "static" preset produces a plain `dist/` folder containing an
// `index.html` + hashed assets, suitable for Apache/Nginx shared hosting.
//
// SPA-only export : le site est déjà `ssr: false` (racine + `_authenticated`), donc on
// désactive le crawler Nitro et on force un unique fallback `/` -> `index.html`.
// Sans ces options, Rollup se plaint que l'input HTML n'est pas valide en SSR et Nitro
// renvoie 404 en tentant de préredre des routes protégées.
export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
    spa: {
      enabled: true,
    },
  },
  nitro: {
    preset: "static",
    output: {
      dir: "dist",
      publicDir: "dist",
    },
    prerender: {
      crawlLinks: false,
      failOnError: false,
      routes: ["/"],
      ignore: ["/api", "/_authenticated"],
    },
  },
});
