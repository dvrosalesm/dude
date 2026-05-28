import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

const eslintConfig = tseslint.config(
  {
    ignores: [
      "**/dist/**",
      ".next/**",
      "dist-workers/**",
      "node_modules/**",
      "coverage/**",
      "public/**",
      "data.sql",
      "db.sql",
      "schema.sql",
      "skills-lock.json",
      "tsconfig.tsbuildinfo",
      "next-env.d.ts",
      "documentation/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "no-undef": "off",
      "no-control-regex": "off",
      "no-useless-assignment": "off",
    },
  },
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "off",
    },
  },
  {
    files: ["**/*.{ts,tsx}"],
    plugins: {
      "react-hooks": reactHooks,
    },
  },
  {
    files: ["apps/**/*.{ts,tsx}", "packages/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/*", "@/"],
              message:
                "The legacy src/ alias was removed. Use @dude/* workspace packages instead.",
            },
            {
              group: ["next/*"],
              message:
                "Next.js shims were removed. Use @dude/app-navigation, react-router-dom, or plain React.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["apps/client/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/*", "@/"],
              message:
                "The legacy src/ alias was removed. Use @dude/* workspace packages instead.",
            },
            {
              group: ["next/*"],
              message:
                "Next.js shims were removed. Use @dude/app-navigation, react-router-dom, or plain React.",
            },
            {
              group: ["@dude/specialist-*/server", "@dude/specialist-*/server.js"],
              message:
                "Client code must not import specialist server entrypoints. Register plugins via specialists.config.client.ts (index exports only).",
            },
            {
              group: [
                "**/specialists.config.ts",
                "../../specialists.config",
                "../../../specialists.config",
              ],
              message:
                "Client code must import specialists.config.client.ts, not the server host config.",
            },
          ],
        },
      ],
    },
  },
);

export default eslintConfig;
