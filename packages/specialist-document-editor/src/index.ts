import { defineSpecialist } from "@dude/sdk";
import { FileText } from "lucide-react";
import { registerApiRoutes } from "./api/routes.js";
import ListPage from "./ui/page";
import WorkspacePage from "./ui/[workspaceId]/page";

/** Client-safe plugin export (no Node gateway manifest). */
export default defineSpecialist({
  id: "document-editor",
  path: "presentation-editor",
  manifest: {
    gatewayLabel: "Presentation Editor",
    gatewayDescription: "Create and edit slide presentations (PPTX).",
    delegable: true,
    badges: ["PPTX","XLSX","DOCX"],
  },
  ui: {
    icon: FileText,
    ListPage,
    WorkspacePage,
  },
  api: registerApiRoutes,
  local: {
    summary: {
      id: "presentation-editor",
      name: "Presentation Editor",
      handle: "DECK",
      scope: "Create and edit slide presentations.",
      status: "ready",
    },
  },
});
