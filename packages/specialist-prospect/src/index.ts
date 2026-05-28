import { defineSpecialist } from "@dude/sdk";
import { Target } from "lucide-react";
import { registerApiRoutes } from "./api/routes.js";
import ListPage from "./ui/page";
import WorkspacePage from "./ui/[workspaceId]/page";

/** Client-safe plugin export (no Node gateway manifest). */
export default defineSpecialist({
  id: "prospect",
  path: "prospect",
  manifest: {
    gatewayLabel: "Prospect",
    gatewayDescription: "Landing pages, lead capture, and outreach.",
    delegable: true,
    badges: ["Landing Pages","Lead Capture","Forms"],
  },
  ui: {
    icon: Target,
    ListPage,
    WorkspacePage,
  },
  api: registerApiRoutes,
  local: {
    summary: {
      id: "prospect",
      name: "Prospect",
      handle: "LEADS",
      scope: "Landing pages, lead capture, and outreach.",
      status: "ready",
    },
  },
});
