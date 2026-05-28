#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const force = process.argv.includes("--force");

const SUBAGENTS = [
  {
    pkg: "subagent-data-analyst",
    id: "data-analyst",
    routePath: "data-analyst",
    label: "Data Analyst",
    handle: "DATA",
    scope: "Analyze uploaded datasets with SQL, charts, and reports.",
    icon: "BarChart3",
    gatewayDescription:
      "SQL queries, Python analysis, charts, and reports on uploaded data.",
    badges: ["SQL", "Charts", "CSV/XLSX"],
    gateway: {
      baseTools: [
        "web_search",
        "web_scrape",
        "search_in_website",
        "workspace_read",
        "read_subagent_artifact",
        "save_memory",
        "list_memories",
      ],
      collections: [],
    },
  },
  {
    pkg: "subagent-document-editor",
    id: "document-editor",
    routePath: "presentation-editor",
    label: "Presentation Editor",
    handle: "DECK",
    scope: "Create and edit slide presentations.",
    icon: "FileText",
    gatewayDescription: "Create and edit slide presentations (PPTX).",
    badges: ["PPTX", "XLSX", "DOCX"],
    gateway: {
      baseTools: [
        "web_search",
        "web_scrape",
        "workspace_read",
        "read_subagent_artifact",
        "save_memory",
        "list_memories",
      ],
      collections: [],
      skillDir: "document-editor",
      skillNames: [
        "baoyu-slide-deck",
        "pptx-generator",
        "presentation-design",
        "giving-presentations",
        "pitch-deck",
      ],
    },
  },
  {
    pkg: "subagent-document-writer",
    id: "document-writer",
    routePath: "document-writer",
    label: "Document Writer",
    handle: "DOCS",
    scope: "Draft, proofread, and export professional documents.",
    icon: "PenLine",
    gatewayDescription: "Draft, proofread, and export professional documents.",
    badges: ["Draft", "Proofread", "Export"],
    gateway: {
      baseTools: [
        "web_search",
        "web_scrape",
        "search_in_website",
        "workspace_read",
        "read_subagent_artifact",
        "save_memory",
        "list_memories",
      ],
      collections: [],
    },
  },
  {
    pkg: "subagent-prospect",
    id: "prospect",
    routePath: "prospect",
    label: "Prospect",
    handle: "LEADS",
    scope: "Landing pages, lead capture, and outreach.",
    icon: "Target",
    gatewayDescription: "Landing pages, lead capture, and outreach.",
    badges: ["Landing Pages", "Lead Capture", "Forms"],
    gateway: {
      baseTools: [
        "web_search",
        "web_scrape",
        "search_in_website",
        "workspace_read",
        "workspace_save",
        "read_subagent_artifact",
        "save_memory",
        "list_memories",
      ],
      collections: ["landingPages", "leads"],
      skillDir: "prospect",
      skillNames: [
        "landing-page-design",
        "landing-page-copywriter",
        "copywriting",
        "google-fonts",
      ],
    },
  },
  {
    pkg: "subagent-design-branding",
    id: "design-branding",
    routePath: "design-branding",
    label: "Design & Branding",
    handle: "BRAND",
    scope: "Brand book, palettes, logos, and visual canvas work.",
    icon: "Palette",
    gatewayDescription:
      "Brand book, palettes, logo concepts, mood images, and image generation/editing on a visual canvas.",
    badges: ["Brand", "Mockups", "Logos"],
    gateway: {
      baseTools: [
        "web_search",
        "web_scrape",
        "search_in_website",
        "workspace_read",
        "workspace_save",
        "read_subagent_artifact",
        "save_memory",
        "list_memories",
      ],
      collections: [
        "brandBook",
        "palettes",
        "typography",
        "logos",
        "reviews",
        "tokensExports",
        "canvasSnapshot",
      ],
    },
  },
];

for (const spec of SUBAGENTS) {
  const pkgDir = path.join(root, "packages", spec.pkg);
  if (!force && fs.existsSync(pkgDir)) {
    console.log("Skip (exists)", `@dude/${spec.pkg}`, "— use --force to overwrite");
    continue;
  }
  fs.mkdirSync(pkgDir, { recursive: true });
  const pkgName = `@dude/${spec.pkg}`;

  fs.writeFileSync(
    path.join(pkgDir, "package.json"),
    JSON.stringify(
      {
        name: pkgName,
        version: "0.1.0",
        private: true,
        type: "module",
        exports: {
          ".": {
            types: "./src/index.ts",
            import: "./src/index.ts",
            default: "./src/index.ts",
          },
          "./server": {
            types: "./src/server.ts",
            import: "./src/server.ts",
            default: "./src/server.ts",
          },
          "./gateway": {
            types: "./src/gateway/manifest.ts",
            import: "./src/gateway/manifest.ts",
            default: "./src/gateway/manifest.ts",
          },
          "./gateway/*": {
            types: "./src/gateway/*.ts",
            import: "./src/gateway/*.ts",
            default: "./src/gateway/*.ts",
          },
        },
        dependencies: {
          "@dude/sdk": "*",
          hono: "^4.7.4",
          "lucide-react": "^0.474.0",
          react: "^19.0.0",
        },
      },
      null,
      2,
    ) + "\n",
  );

  if (spec.gateway) {
    const skillPathsBlock =
      spec.gateway.skillDir && spec.gateway.skillNames
        ? `
import path from "node:path";
import { fileURLToPath } from "node:url";

const gatewayDir = path.dirname(fileURLToPath(import.meta.url));
export const skillPaths = ${JSON.stringify(spec.gateway.skillNames)}.map((name) =>
  path.join(gatewayDir, "skills", ${JSON.stringify(spec.gateway.skillDir)}, name),
);
`
        : `
export const skillPaths: string[] = [];
`;

    fs.writeFileSync(
      path.join(pkgDir, "src/gateway/manifest.ts"),
      `${skillPathsBlock}
import type { SubagentGatewayConfig } from "@dude/sdk";

export const gatewayManifest: SubagentGatewayConfig = {
  declaration: {
    baseTools: ${JSON.stringify(spec.gateway.baseTools)},
    customTools: [],
    collections: ${JSON.stringify(spec.gateway.collections)},
    skillPaths,
  },
  skillPaths,
};
`,
    );

    fs.writeFileSync(
      path.join(pkgDir, "src/server.ts"),
      `import clientPlugin from "./index.js";
import { gatewayManifest } from "./gateway/manifest.js";

export { gatewayManifest } from "./gateway/manifest.js";

export default {
  ...clientPlugin,
  gateway: gatewayManifest,
};
`,
    );
  } else {
    fs.writeFileSync(
      path.join(pkgDir, "src/server.ts"),
      `export { default } from "./index.js";
`,
    );
  }

  fs.writeFileSync(
    path.join(pkgDir, "src/api/routes.ts"),
    `import type { Elysia } from "elysia";

export function registerApiRoutes(app: Elysia) {
  app.get("/", () => ({ subagent: ${JSON.stringify(spec.id)}, ok: true }));
  app.get("/health", () => ({ status: "ok" }));
}
`,
  );

  fs.writeFileSync(
    path.join(pkgDir, "src/index.ts"),
    `import { defineSubagent } from "@dude/sdk";
import { ${spec.icon} } from "lucide-react";
import { registerApiRoutes } from "./api/routes.js";
import ListPage from "./ui/page";
import WorkspacePage from "./ui/[workspaceId]/page";

/** Client-safe plugin export (no Node gateway manifest). */
export default defineSubagent({
  id: ${JSON.stringify(spec.id)},
  path: ${JSON.stringify(spec.routePath)},
  manifest: {
    gatewayLabel: ${JSON.stringify(spec.label)},
    gatewayDescription: ${JSON.stringify(spec.gatewayDescription)},
    delegable: ${spec.delegable === false ? "false" : "true"},
    badges: ${JSON.stringify(spec.badges ?? spec.badgeKeys ?? [])},
  },
  ui: {
    icon: ${spec.icon},
    ListPage,
    WorkspacePage,
  },
  api: registerApiRoutes,
  local: {
    summary: {
      id: ${JSON.stringify(spec.routePath)},
      name: ${JSON.stringify(spec.label)},
      handle: ${JSON.stringify(spec.handle)},
      scope: ${JSON.stringify(spec.scope)},
      status: "ready",
    },
  },
});
`,
  );

  console.log("Generated", pkgName);
}
