// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// IMPORTANT: do not enable TanStack's `spa.enabled` here.
// In the current TanStack/Nitro stack, SPA mode forcibly re-enables prerendering
// and crawls `/` even when `prerender.enabled` is false. That prerender step runs
// the Cloudflare/edge React stream in Node during production builds and crashes.
export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
    prerender: {
      enabled: false,
      crawlLinks: false,
      autoStaticPathsDiscovery: false,
      routes: [],
    },
  },
});
