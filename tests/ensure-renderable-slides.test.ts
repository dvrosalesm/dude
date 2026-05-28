import { ensureRenderableSlide } from "../packages/presentation-editor/src/lib/presentation-editor/ensure-renderable-slides.js";

describe("ensureRenderableSlide", () => {
  const dims = { width: 12192000, height: 6858000 };

  it("promotes HTML in slide.content to a full-slide html shape", () => {
    const slide = ensureRenderableSlide(
      {
        index: 0,
        content:
          '<section style="background:#000"><h1>Meteor</h1></section>',
        shapes: [],
      },
      dims,
    );

    expect(slide.shapes).toHaveLength(1);
    expect(slide.shapes?.[0]?.type).toBe("html");
    expect(slide.shapes?.[0]?.htmlContent).toContain("Meteor");
  });

  it("drops empty html shapes", () => {
    const slide = ensureRenderableSlide(
      {
        index: 1,
        content: "",
        shapes: [{ type: "html", htmlContent: "", shapeIndex: 0, transform: { x: 0, y: 0, cx: 1, cy: 1 } }],
      },
      dims,
    );

    expect(slide.shapes).toHaveLength(0);
  });
});
