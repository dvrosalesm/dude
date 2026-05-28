import {
  resolveGatewaySubagentId,
  resolveToolHostWorkspaceId,
} from "../apps/api/src/lib/tool-host/resolve-subagent-id";

describe("resolveGatewaySubagentId", () => {
  it("maps presentation-editor route id to document-editor gateway id", () => {
    expect(resolveGatewaySubagentId("presentation-editor")).toBe(
      "document-editor",
    );
  });

  it("leaves canonical gateway ids unchanged", () => {
    expect(resolveGatewaySubagentId("document-editor")).toBe("document-editor");
    expect(resolveGatewaySubagentId("data-analyst")).toBe("data-analyst");
  });
});

describe("resolveToolHostWorkspaceId", () => {
  it("strips subagent instance prefix for tool-host workspace paths", () => {
    expect(
      resolveToolHostWorkspaceId(
        "document-editor:ws-presentation-editor-34878c0d-fa47-45e7-b7dd-cda2f4c8056f",
      ),
    ).toBe("ws-presentation-editor-34878c0d-fa47-45e7-b7dd-cda2f4c8056f");
  });

  it("leaves bare workspace ids unchanged", () => {
    expect(
      resolveToolHostWorkspaceId("ws-presentation-editor-abc"),
    ).toBe("ws-presentation-editor-abc");
  });
});
