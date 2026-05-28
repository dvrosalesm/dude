import {
  formatDreamSummary,
  shouldShowDreamSummary,
} from "@dude/chat/lib/chat/markdown-summary";
import { flattenStageMarkdown } from "@dude/chat/lib/chat/flatten-stage-markdown";

describe("formatDreamSummary", () => {
  it("removes image boilerplate and keeps the prompt", () => {
    const input =
      "Here's the image you requested.\n\n*A realistic shark swimming underwater.*";
    expect(formatDreamSummary(input)).toBe(
      "*A realistic shark swimming underwater.*",
    );
  });

  it("returns original text when nothing would remain", () => {
    const input = "Here's the image you requested.";
    expect(formatDreamSummary(input)).toBe(input);
  });
});

describe("shouldShowDreamSummary", () => {
  it("hides boilerplate-only image captions", () => {
    expect(
      shouldShowDreamSummary("Here's the image you requested.", true),
    ).toBe(false);
  });

  it("shows prompt text after boilerplate is stripped", () => {
    expect(
      shouldShowDreamSummary(
        "Here's the image you requested.\n\n*A shark in blue water.*",
        true,
      ),
    ).toBe(true);
  });
});

describe("flattenStageMarkdown", () => {
  it("strips CRLF bullet lines", () => {
    const input =
      "Available specialists:\r\n\r\n- **Browser**: open/test\r\n- **Documents**: create docs";
    expect(flattenStageMarkdown(input)).toBe(
      "Available specialists:\n\n**Browser**: open/test\n\n**Documents**: create docs",
    );
  });
});
