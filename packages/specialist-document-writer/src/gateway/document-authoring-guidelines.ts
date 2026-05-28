export function isDocumentWriterSpecialist(specialistId: string): boolean {
  const id = specialistId.toLowerCase();
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
