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
export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  nitro: {
    preset: "static",
    output: {
      dir: "dist",
      publicDir: "dist",
    },
  },
});
