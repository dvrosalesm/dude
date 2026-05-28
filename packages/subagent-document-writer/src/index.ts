import { defineSubagent } from "@dude/sdk";
import { PenLine } from "lucide-react";
import { registerApiRoutes } from "./api/routes.js";
import ListPage from "./ui/page";
import WorkspacePage from "./ui/[workspaceId]/page";

/** Client-safe plugin export (no Node gateway manifest). */
export default defineSubagent({
  id: "document-writer",
  path: "document-writer",
  manifest: {
    gatewayLabel: "Document Writer",
    gatewayDescription: "Draft, proofread, and export professional documents.",
    delegable: true,
    badges: ["Draft","Proofread","Export"],
  },
  ui: {
    icon: PenLine,
    ListPage,
    WorkspacePage,
  },
  api: registerApiRoutes,
  local: {
    summary: {
      id: "document-writer",
      name: "Document Writer",
      handle: "DOCS",
      scope: "Draft, proofread, and export professional documents.",
      status: "ready",
    },
  },
});
