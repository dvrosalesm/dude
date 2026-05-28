/** Shared HTML slide rules — used by Pi's generate_slide tool and native runners (Codex, etc.). */

export function emuToPixels(emu: number): number {
  return Math.round(emu / 914400 * 96);
}

export function buildSlideSystemPrompt(
  designDoc?: string,
  dims?: { width: number; height: number },
  referenceBlock?: string,
): string {
  const pxWidth = dims ? emuToPixels(dims.width) : 1280;
  const pxHeight = dims ? emuToPixels(dims.height) : 720;

  const basePrompt = `You are a presentation slide designer. Generate clean, modern HTML slides.

Canvas dimensions: ${pxWidth}px × ${pxHeight}px (aspect ratio ${pxWidth}:${pxHeight}).

## Required HTML Structure
Output a COMPLETE HTML document with this structure:
\`\`\`
<!DOCTYPE html><html><head><meta charset="utf-8"/><style>
*{margin:0;box-sizing:border-box}
html,body{height:100%;overflow:hidden}
body{min-height:100vh;overflow:hidden;...your styles...}
</style></head><body>
<!-- all content must fit within the viewport — no overflow -->
</body></html>
\`\`\`

## Rules
- Output ONLY the HTML, no markdown code blocks wrapping it
- CRITICAL: body MUST have \`min-height:100vh\` and \`overflow:hidden\`
- Use cqmin for font sizes, flex/grid for layout, CSS custom properties
- Fill the entire canvas — no white gaps

## Font sizing minimums
- Body: ≥ 2.4cqmin · Title: ≥ 7cqmin (16:9) · Hero: ≥ 11cqmin
- Never below 1.6cqmin — cut content instead of shrinking type`;

  const referenceSuffix = referenceBlock ? `\n\n${referenceBlock}` : "";

  if (designDoc) {
    return `${basePrompt}\n\n## DESIGN SYSTEM\n${designDoc}${referenceSuffix}`;
  }

  return `${basePrompt}\n\n## Default theme\n:root { --bg: #0a0a0a; --text: #fafafa; --accent: #22d3ee; }${referenceSuffix}`;
}

export function isDocumentEditorSpecialist(specialistId: string): boolean {
  const id = specialistId.toLowerCase();
  return id === "document-editor" || id.includes("presentation");
}

/** Instructions for Codex/Cursor/Hermes — agent writes HTML, tools only persist/read. */
export function buildPresentationNativeRunnerAppendix(toolNames: string): string {
  return (
    `\n\n<dude_presentation_workflow>\n` +
    `YOU generate slide HTML in this conversation. There is NO generate_slide tool — that is intentional.\n` +
    `Tools are for read/save/edit only: ${toolNames}\n\n` +
    `Workflow per slide:\n` +
    `1. manage_design action=read — load design system (or action=save with markdown you wrote)\n` +
    `2. read_slide slideIndices=all — inspect deck (note slide count N)\n` +
    `3. YOU write complete HTML (see rules below)\n` +
    `4. edit_presentation — one call per slide when possible\n\n` +
    `Adding a NEW slide (keep every existing slide):\n` +
    `- insertSlide with afterSlideIndex=N-1 where N=current slide count (appends at end)\n` +
    `- then addHtmlContent on slideIndex=N for the new slide\n` +
    `- NEVER deleteSlide / deleteSlides unless the user explicitly asked to remove slides\n\n` +
    `Editing an existing slide:\n` +
    `- addHtmlContent on that slideIndex only — do not insertSlide or deleteSlide\n` +
    `5. finish_turn when done\n\n` +
    `${buildSlideSystemPrompt()}\n` +
    `</dude_presentation_workflow>`
  );
}
