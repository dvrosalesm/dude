jest.mock("../apps/api/src/lib/agent-dispatch/index.js", () => ({
  buildAgentCatalog: jest.fn(async () => ({
    tools: [],
    session: {},
    collections: [],
    skillPaths: [],
  })),
  dispatchAgentAction: jest.fn(async () => ({
    content: [{ type: "text", text: "ok" }],
    details: {},
  })),
}));

jest.mock("../apps/api/src/routes/v1/middleware.js", () => ({
  withInternalRequestDb: async (_request: Request, fn: () => Promise<Response>) =>
    fn(),
}));

jest.mock("../apps/api/src/lib/tool-host/index.js", () => ({
  parseToolHostSessionFromHeaders: (headers: Headers) => {
    const workspaceId = headers.get("x-workspace-id")?.trim();
    const subagentId = headers.get("x-subagent-id")?.trim();
    if (!workspaceId || !subagentId) return null;
    return {
      workspaceId,
      subagentId,
      organizationId: headers.get("x-organization-id")?.trim() || "local",
      runner: headers.get("x-runner-id")?.trim() || "pi",
    };
  },
  toolHostEnvExtrasFromHeaders: () => ({}),
}));

import { getAgentCatalog, postAgentDispatch } from "../apps/api/src/routes/v1/agent-dispatch-handlers.js";

function localSessionHeaders(extra: Record<string, string> = {}) {
  return new Headers({
    "x-workspace-id": "ws-test",
    "x-subagent-id": "document-editor",
    "x-organization-id": "local",
    "x-runner-id": "codex",
    "x-dude-manifest-version": "1",
    ...extra,
  });
}

describe("agent dispatch handlers", () => {
  it("rejects local catalog requests without x-db-local-path", async () => {
    const response = await getAgentCatalog(
      new Request("http://localhost/v1/internal/agent/catalog", {
        headers: localSessionHeaders(),
      }),
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("x-db-local-path");
  });

  it("rejects local dispatch without x-db-local-path", async () => {
    const response = await postAgentDispatch(
      new Request("http://localhost/v1/internal/agent/dispatch", {
        method: "POST",
        headers: localSessionHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ action: "read_slide", payload: {} }),
      }),
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("x-db-local-path");
  });

  it("accepts dispatch when db path header is present", async () => {
    const response = await postAgentDispatch(
      new Request("http://localhost/v1/internal/agent/dispatch", {
        method: "POST",
        headers: localSessionHeaders({
          "Content-Type": "application/json",
          "x-db-local-path": "/tmp/electron/dude-local.sqlite",
        }),
        body: JSON.stringify({
          action: "read_slide",
          payload: { slideIndex: 0 },
        }),
      }),
    );

    expect(response.status).toBe(200);
  });
});
