import {
  extractUserFacingMessage,
  USER_MESSAGE_MARKER,
} from "../packages/gateway-shared/src/user-facing-message";
import { buildSendMessageInput } from "../packages/workspaces/src/gateway-payload";

describe("extractUserFacingMessage", () => {
  it("returns text after the user message marker", () => {
    const payload = [
      "Document is empty — no blocks yet.",
      "",
      "--- TEMPLATE ---",
      "blank",
      "--- END TEMPLATE ---",
      "",
      "--- CONTEXTDOCUMENTS ---",
      "[]",
      "--- END CONTEXTDOCUMENTS ---",
      "",
      "--- USER MESSAGE ---",
      "write a draft quitting letter",
    ].join("\n");

    expect(extractUserFacingMessage(payload)).toBe(
      "write a draft quitting letter",
    );
  });

  it("returns plain text unchanged", () => {
    expect(extractUserFacingMessage("hello there")).toBe("hello there");
  });
});

describe("buildSendMessageInput", () => {
  it("keeps displayContent separate from augmented agent content", () => {
    const input = buildSendMessageInput("document-writer", "ws-1", {
      message: "write a draft quitting letter",
      documentContext: "Document is empty — no blocks yet.",
      template: "blank",
      contextDocuments: [],
    });

    expect(input.displayContent).toBe("write a draft quitting letter");
    expect(input.content).toContain("Document is empty — no blocks yet.");
    expect(input.content).toContain(USER_MESSAGE_MARKER);
    expect(input.content).toContain("write a draft quitting letter");
    expect(input.content).not.toContain("--- TEMPLATE ---");
    expect(input.content).not.toContain("--- CONTEXTDOCUMENTS ---");
  });
});
