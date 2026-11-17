// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { loadEnv } from "vite";

import { productionConfigProblems } from "./src/config/build-check";

// Build de produção (VITE_ENVIRONMENT=production) exige os endereços do ambiente de produção.
// Sem essa variável, como no Lovable hoje, nada muda.
const problems = productionConfigProblems({
  ...loadEnv("production", process.cwd(), "VITE_"),
  ...process.env,
});
if (problems.length)
  throw new Error(`Configuração de produção incompleta: ${problems.join("; ")}. Ver .env.example.`);

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
