import { defineSubagentHost } from "@dude/sdk";
import dataAnalyst from "@dude/subagent-data-analyst";
import documentEditor from "@dude/subagent-document-editor";
import documentWriter from "@dude/subagent-document-writer";
import designBranding from "@dude/subagent-design-branding";

/** Browser-safe host config — imports each subagent's `index.ts` only (no `/server` gateway manifests).
 *  Server code must use `subagents.config.ts` at the repo root. */
export default defineSubagentHost({
  subagents: [
    dataAnalyst,
    documentEditor,
    documentWriter,
    designBranding,
  ],
});
