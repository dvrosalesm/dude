jest.mock("../apps/api/src/lib/tool-host/catalog", () => ({
  buildToolHostCatalog: jest.fn(),
}));

jest.mock("../apps/api/src/lib/tool-host/execute", () => ({
  executeHostedTool: jest.fn(
    async (
      _session: unknown,
      body: { tool: string; toolCallId: string; arguments: Record<string, unknown> },
    ) => ({
      content: [{ type: "text", text: `executed:${body.tool}` }],
      details: { routed: true },
    }),
  ),
}));

import { executeHostedTool } from "../apps/api/src/lib/tool-host/execute";
import { dispatchAgentAction } from "../apps/api/src/lib/agent-dispatch/index";
import { dispatchAgentRemote } from "../apps/api/src/lib/runners/tool-host-client";
import type { ToolHostSession } from "../apps/api/src/lib/tool-host/session";

const session: ToolHostSession = {
  workspaceId: "org:user",
  subagentId: "document-editor",
  organizationId: "org",
  runner: "codex",
};

describe("agent dispatch", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("routes action name to executeHostedTool as tool", async () => {
    const result = await dispatchAgentAction(session, {
      action: "edit_presentation",
      payload: { edits: [{ action: "insertSlide" }] },
      callId: "call-1",
    });

    expect(executeHostedTool).toHaveBeenCalledWith(
      session,
      {
        tool: "edit_presentation",
        toolCallId: "call-1",
        arguments: { edits: [{ action: "insertSlide" }] },
      },
      undefined,
    );
    expect(result.content[0]?.text).toBe("executed:edit_presentation");
  });

  it("requires action", async () => {
    await expect(dispatchAgentAction(session, { action: "  " })).rejects.toThrow(
      "action is required",
    );
  });
});

describe("dispatchAgentRemote client", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("POSTs action and payload to the dispatch route", async () => {
    global.fetch = jest.fn(async () =>
      Response.json({
        content: [{ type: "text", text: '{"ok":true}' }],
        details: {},
      }),
    ) as typeof fetch;

    const result = await dispatchAgentRemote(
      {
        workspaceId: "ws-1",
        subagentId: "document-editor",
        organizationId: "org-1",
        runner: "hermes",
        baseUrl: "http://127.0.0.1:8787",
      },
      {
        action: "read_slide",
        payload: { slideIndex: 0 },
        callId: "remote-1",
      },
    );

    expect(global.fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:8787/v1/internal/agent/dispatch",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          action: "read_slide",
          payload: { slideIndex: 0 },
          callId: "remote-1",
        }),
      }),
    );
    expect(result.content[0]?.text).toBe('{"ok":true}');
  });
});
