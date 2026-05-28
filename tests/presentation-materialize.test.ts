import { materializePresentationEdits } from "../apps/api/src/lib/presentation-materialize.js";

describe("presentation-materialize", () => {
  const baseContent = {
    slides: [
      {
        index: 0,
        uid: "slide-1",
        content: "",
        shapes: [],
      },
    ],
    slideDimensions: { width: 12192000, height: 6858000 },
  };

  it("applies only the new batch incrementally and clears the queue", () => {
    const result = materializePresentationEdits(
      {
        documentContent: baseContent,
        documentEdits: [
          {
            id: "stale-1",
            edits: [{ action: "insertSlide", afterSlideIndex: 0, content: "old" }],
          },
        ],
      },
      {
        edits: [
          {
            action: "addHtmlContent",
            slideIndex: 0,
            htmlContent: "<html><body><h1>Hello</h1></body></html>",
            label: "Title",
          },
        ],
      },
    );

    expect(result.documentEdits).toEqual([]);
    expect(result.hasDocument).toBe(true);
    const slides = (result.documentContent as { slides: Array<{ shapes: unknown[] }> }).slides;
    expect(slides).toHaveLength(1);
    expect(slides[0].shapes.some((s: { type?: string }) => s.type === "html")).toBe(true);
  });

  it("does not replay stale queued batches (no duplicate slides)", () => {
    const withOneSlide = materializePresentationEdits(
      { documentContent: baseContent, documentEdits: [] },
      {
        edits: [
          { action: "insertSlide", afterSlideIndex: 0, content: "" },
          {
            action: "addHtmlContent",
            slideIndex: 1,
            htmlContent: "<html><body>Slide 2</body></html>",
            label: "Two",
          },
        ],
      },
    );

    const again = materializePresentationEdits(withOneSlide, {
      edits: [
        {
          action: "addHtmlContent",
          slideIndex: 0,
          htmlContent: "<html><body>Slide 1</body></html>",
          label: "One",
        },
      ],
    });

    expect((again.documentContent as { slides: unknown[] }).slides).toHaveLength(2);
    expect(again.documentEdits).toEqual([]);
  });

  it("returns config unchanged when there are no edits", () => {
    const input = { documentContent: { slides: [] } };
    expect(
      materializePresentationEdits(input, { edits: [] }),
    ).toEqual({ ...input, documentEdits: [] });
  });
});
