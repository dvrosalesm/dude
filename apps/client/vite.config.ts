import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(rootDir, "../..");

export default defineConfig({
  envDir: repoRoot,
  base: "./",
  publicDir: path.resolve(repoRoot, "public"),
  plugins: [react()],
  resolve: {
    alias: {
      "@dude/client-runtime": path.resolve(rootDir, "src/local-chat-runtime.ts"),
      "@dude/client-types": path.resolve(repoRoot, "packages/client-types/src/index.ts"),
    },
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    proxy: {
      "/v1": {
        target: "http://127.0.0.1:8787",
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: "127.0.0.1",
    port: 4173,
  },
  build: {
    outDir: path.resolve(repoRoot, "dist"),
    emptyOutDir: true,
  },
});
