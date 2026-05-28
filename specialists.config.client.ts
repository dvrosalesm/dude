import { defineSpecialistHost } from "@dude/sdk";
import dataAnalyst from "@dude/specialist-data-analyst";
import documentEditor from "@dude/specialist-document-editor";
import documentWriter from "@dude/specialist-document-writer";
import prospect from "@dude/specialist-prospect";
import designBranding from "@dude/specialist-design-branding";

/** Browser-safe host config — imports each specialist's `index.ts` only (no `/server` gateway manifests).
 *  Server code must use `specialists.config.ts` at the repo root. */
export default defineSpecialistHost({
  specialists: [
    dataAnalyst,
    documentEditor,
    documentWriter,
    prospect,
    designBranding,
  ],
});
