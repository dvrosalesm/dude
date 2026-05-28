import path from "node:path";
import { fileURLToPath } from "node:url";
import type { SubagentDeclaration } from "@dude/sdk/gateway";
import { resolveGatewaySkillPaths } from "@dude/sdk/gateway-runtime";
import { createUpdateLandingPageTool } from "./update-landing-page.js";
import { createSaveLandingPageTool } from "./save-landing-page.js";
import { createPublishLandingPageTool } from "./publish-landing-page.js";
import { createReadLandingPageTool } from "./read-landing-page.js";
import { createEditLandingPageTool } from "./edit-landing-page.js";
import { createAppendLandingPageSectionTool } from "./append-landing-page-section.js";
import { createUpdateFormFieldsTool } from "./update-form-fields.js";
import { createUpdateAttributionsTool } from "./update-attributions.js";

const gatewayDir = path.dirname(fileURLToPath(import.meta.url));

/**
 * Prospect subagent — landing page builder and lead capture.
 *
 * Custom tools handle R2 operations (HTML storage) and form-field metadata.
 * workspace_save handles other JSONB collections (e.g. leads).
 */
export const declaration: SubagentDeclaration = {
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
  customTools: [
    createUpdateLandingPageTool,
    createSaveLandingPageTool,
    createReadLandingPageTool,
    createEditLandingPageTool,
    createAppendLandingPageSectionTool,
    createUpdateFormFieldsTool,
    createUpdateAttributionsTool,
    createPublishLandingPageTool,
  ],
  collections: ["landingPages", "leads"],
  skillPaths: resolveGatewaySkillPaths(gatewayDir, [
    "landing-page-design",
    "landing-page-copywriter",
    "copywriting",
    "google-fonts",
  ]),
};
