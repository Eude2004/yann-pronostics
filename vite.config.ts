// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Mode SPA "shell-only" : TanStack Start génère un `index.html` unique
// (aucun prerender de route côté serveur) et laisse le routeur client
// hydrater toutes les pages. Compatible avec l'hébergement Lovable
// (Cloudflare) et exportable statiquement via `.htaccess` sur Hostinger.
export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
    // NB: on n'active PAS `spa.enabled` ni `prerender` — sur l'infra Lovable
    // (Cloudflare Workers) le layout de sortie n'est pas compatible avec la
    // preview node du prerender-crawler, ce qui provoque
    // « Cannot find module dist/server/server.js » lors du build.
    // Le site reste 100 % SPA côté client (ssr:false sur __root et
    // _authenticated) donc aucun contenu n'est réellement rendu côté serveur.
  },
});
