import { defineSubagentHost } from "@dude/sdk";
import dataAnalyst from "@dude/subagent-data-analyst/server";
import documentEditor from "@dude/subagent-document-editor/server";
import documentWriter from "@dude/subagent-document-writer/server";
import designBranding from "@dude/subagent-design-branding/server";

/** Canonical server host config — single source of truth for API, tool-host, and agent spawn.
 *  Browser code must use `subagents.config.client.ts` (index exports only, no Node gateway). */
export default defineSubagentHost({
  subagents: [
    dataAnalyst,
    documentEditor,
    documentWriter,
    designBranding,
  ],
});
