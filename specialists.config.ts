import { defineSpecialistHost } from "@dude/sdk";
import dataAnalyst from "@dude/specialist-data-analyst/server";
import documentEditor from "@dude/specialist-document-editor/server";
import documentWriter from "@dude/specialist-document-writer/server";
import prospect from "@dude/specialist-prospect/server";
import designBranding from "@dude/specialist-design-branding/server";

/** Canonical server host config — single source of truth for API, tool-host, and agent spawn.
 *  Browser code must use `specialists.config.client.ts` (index exports only, no Node gateway). */
export default defineSpecialistHost({
  specialists: [
    dataAnalyst,
    documentEditor,
    documentWriter,
    prospect,
    designBranding,
  ],
});
