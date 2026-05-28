export function isDocumentWriterSpecialist(subagentId: string): boolean {
  const id = subagentId.toLowerCase();
  return id === "document-writer";
}

/** Instruct native runners to persist document changes via edit_document, not chat-only prose. */
export function buildDocumentWriterNativeRunnerAppendix(toolNames: string): string {
  return (
    `\n\n<dude_document_writer_workflow>\n` +
    `You are editing a structured document in the Dude Document Writer canvas.\n` +
    `The user sees the center editor — chat-only markdown does NOT update the document.\n` +
    `Available tools: ${toolNames}\n\n` +
    `Rules:\n` +
    `- For ANY request to write, draft, revise, or restructure the document, call **edit_document** with an \`edits\` array.\n` +
    `- Prefer **replaceAll** for new documents or full rewrites (include \`title\` and \`blocks\`).\n` +
    `- Use **addBlock**, **updateBlock**, **deleteBlock**, **setTitle** for smaller changes.\n` +
    `- Block types: heading1, heading2, heading3, paragraph, bulletList, numberedList, code, quote, callout, divider, image, table.\n` +
    `- Batch related edits into one edit_document call when possible; you may call it multiple times for long work.\n` +
    `- After edit_document succeeds, you may briefly summarize in finish_turn — do not paste the full document in chat instead of calling the tool.\n` +
    `- Use documentContext block ids from the user payload for updateBlock/deleteBlock targets.\n` +
    `</dude_document_writer_workflow>`
  );
}

export function buildDocumentWriterSystemPromptAppendix(): string {
  return (
    "\n\nWhen the user asks you to create or change the document, you MUST call the edit_document tool. " +
    "The canvas only updates from edit_document — not from assistant chat text alone."
  );
}

/** Inline editor autocomplete — finish_turn only; never edit the document. */
export function buildDocumentWriterAutocompleteAppendix(): string {
  return (
    "\n\n<dude_document_writer_autocomplete>\n" +
    "INLINE AUTOCOMPLETE MODE: The user is typing manually in the document editor.\n" +
    "Your ONLY job is to suggest the next few words or one short sentence to continue their text.\n\n" +
    "Rules:\n" +
    "- Call **finish_turn** with plain continuation text only (no markdown, no quotes wrapping the whole reply).\n" +
    "- Do NOT call edit_document or any other tool.\n" +
    "- Do NOT repeat text that already appears before the cursor.\n" +
    "- Match the document tone and language.\n" +
    "- Keep the suggestion brief (roughly one phrase to two sentences).\n" +
    "</dude_document_writer_autocomplete>"
  );
}

export function buildDocumentWriterAutocompleteUserMessage(input: {
  prefix: string;
  suffix?: string;
  title?: string;
  documentExcerpt?: string;
}): string {
  const titleLine = input.title?.trim()
    ? `Document title: ${input.title.trim()}\n`
    : "";
  const excerpt = (input.documentExcerpt ?? "").trim();
  const excerptBlock = excerpt
    ? `Recent document text:\n${excerpt.slice(-2500)}\n\n`
    : "";
  const suffixLine = input.suffix?.trim()
    ? `Text after cursor: ${input.suffix.trim()}\n`
    : "";

  return (
    `${titleLine}${excerptBlock}` +
    `Text before cursor (continue from the end):\n${input.prefix}\n` +
    suffixLine +
    "\nReply via finish_turn with ONLY the continuation."
  );
}
