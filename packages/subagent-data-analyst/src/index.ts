import { defineSubagent } from "@dude/sdk";
import { BarChart3 } from "lucide-react";
import { registerApiRoutes } from "./api/routes.js";
import ListPage from "./ui/page";
import WorkspacePage from "./ui/[workspaceId]/page";

/** Client-safe plugin export (no Node gateway manifest). */
export default defineSubagent({
  id: "data-analyst",
  path: "data-analyst",
  manifest: {
    gatewayLabel: "Data Analyst",
    gatewayDescription: "SQL queries, Python analysis, charts, and reports on uploaded data.",
    delegable: true,
    badges: ["SQL","Charts","CSV/XLSX"],
  },
  ui: {
    icon: BarChart3,
    ListPage,
    WorkspacePage,
  },
  api: registerApiRoutes,
  local: {
    summary: {
      id: "data-analyst",
      name: "Data Analyst",
      handle: "DATA",
      scope: "Analyze uploaded datasets with SQL, charts, and reports.",
      status: "ready",
    },
  },
});
