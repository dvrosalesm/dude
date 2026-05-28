import { mergeGatewayConfigurationsFromInternal } from "../apps/client/src/runtime/gateway-workspace-config-merge";

describe("mergeGatewayConfigurationsFromInternal", () => {
  it("merges document-writer documentContent (blocks) from internal API", () => {
    const existing = {
      description: "",
      documentContent: { blocks: [], title: "" },
    };
    const internal = {
      documentContent: {
        title: "Smoke Test",
        blocks: [
          { id: "b1", type: "heading1", content: "Smoke Test" },
          { id: "b2", type: "paragraph", content: "Hello world." },
        ],
      },
    };

    const merged = mergeGatewayConfigurationsFromInternal(existing, internal);

    expect(merged.documentContent).toEqual(internal.documentContent);
    expect(merged.description).toBe("");
  });

  it("still merges presentation slides documentContent", () => {
    const existing = { outline: [] };
    const slides = [{ id: "s1", title: "Intro" }];
    const merged = mergeGatewayConfigurationsFromInternal(existing, {
      documentContent: { slides },
    });

    expect(merged.documentContent).toEqual({ slides });
    expect(merged.hasDocument).toBe(true);
    expect(merged.documentType).toBe("pptx");
  });

  it("merges presentation documentContent when slide count increases", () => {
    const existing = {
      hasDocument: true,
      documentContent: { slides: [{ index: 0, uid: "a", content: "One" }] },
    };
    const merged = mergeGatewayConfigurationsFromInternal(existing, {
      documentContent: {
        slides: [
          { index: 0, uid: "a", content: "One" },
          { index: 1, uid: "b", content: "Two" },
        ],
      },
    });
    expect((merged.documentContent as { slides: unknown[] }).slides).toHaveLength(2);
  });

  it("returns existing when internal has no recognized artifacts", () => {
    const existing = { documentContent: { blocks: [], title: "" } };
    const merged = mergeGatewayConfigurationsFromInternal(existing, {
      documentContent: { blocks: [], title: "" },
    });
    expect(merged).toBe(existing);
  });
});
