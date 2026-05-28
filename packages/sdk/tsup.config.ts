import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    gateway: "src/gateway.ts",
    client: "src/client.ts",
    api: "src/api.ts",
    runner: "src/runner/index.ts",
    "gateway-runtime": "src/gateway-runtime/index.ts",
  },
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  external: ["elysia", "react", "react/jsx-runtime"],
});
