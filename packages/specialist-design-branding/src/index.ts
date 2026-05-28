import { defineSpecialist } from "@dude/sdk";
import { Palette } from "lucide-react";
import { registerApiRoutes } from "./api/routes.js";
import ListPage from "./ui/page";
import WorkspacePage from "./ui/[workspaceId]/page";

/** Client-safe plugin export (no Node gateway manifest). */
export default defineSpecialist({
  id: "design-branding",
  path: "design-branding",
  manifest: {
    gatewayLabel: "Design & Branding",
    gatewayDescription: "Brand book, palettes, logo concepts, mood images, and image generation/editing on a visual canvas.",
    delegable: true,
    badges: ["Brand","Mockups","Logos"],
  },
  ui: {
    icon: Palette,
    ListPage,
    WorkspacePage,
  },
  api: registerApiRoutes,
  local: {
    summary: {
      id: "design-branding",
      name: "Design & Branding",
      handle: "BRAND",
      scope: "Brand book, palettes, logos, and visual canvas work.",
      status: "ready",
    },
  },
});
