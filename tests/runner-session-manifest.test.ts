import {
  isRunnerSessionManifest as isRunnerSessionManifestSdk,
  RUNNER_SESSION_MANIFEST_VERSION,
} from "@dude/sdk/runner";
import {
  isAgentDispatchShellCommand,
  parseDispatchActionFromCommand,
} from "../apps/api/src/lib/runners/codex-message-utils.js";

describe("runner session manifest", () => {
  const originalDbLocalPath = process.env.DB_LOCAL_PATH;
  const originalDudeDbPath = process.env.DUDE_DB_PATH;
  const originalDudeApiPort = process.env.DUDE_API_PORT;
  const originalGatewayInternalPort = process.env.GATEWAY_INTERNAL_PORT;

  afterEach(() => {
    if (originalDbLocalPath === undefined) delete process.env.DB_LOCAL_PATH;
    else process.env.DB_LOCAL_PATH = originalDbLocalPath;
    if (originalDudeDbPath === undefined) delete process.env.DUDE_DB_PATH;
    else process.env.DUDE_DB_PATH = originalDudeDbPath;
    if (originalDudeApiPort === undefined) delete process.env.DUDE_API_PORT;
    else process.env.DUDE_API_PORT = originalDudeApiPort;
    if (originalGatewayInternalPort === undefined) {
      delete process.env.GATEWAY_INTERNAL_PORT;
    } else {
      process.env.GATEWAY_INTERNAL_PORT = originalGatewayInternalPort;
    }
  });

  it("builds internal API URL from DUDE_API_PORT, not chat gateway port", async () => {
    process.env.DUDE_API_PORT = "8787";
    process.env.GATEWAY_INTERNAL_PORT = "42722";

    const { buildRunnerSessionManifest, resolveMainApiPort } = await import(
      "../apps/api/src/lib/runner-session-manifest.js"
    );

    expect(resolveMainApiPort()).toBe("8787");

    const manifest = buildRunnerSessionManifest({
      workspaceId: "ws-test",
      subagentId: "document-editor",
      organizationId: "local",
      runner: "codex",
      gatewayPort: 42722,
      manifestPath: "/tmp/work/.dude-runner-session.json",
    });

    expect(manifest.internalApi.baseUrl).toBe("http://127.0.0.1:8787");
    expect(manifest.gatewayPort).toBe(42722);
  });

  it("builds a versioned manifest with dispatch CLI and internal API", async () => {
    process.env.DUDE_DB_PATH = "/tmp/electron/dude-local.sqlite";
    process.env.DUDE_API_PORT = "8787";
    delete process.env.GATEWAY_INTERNAL_PORT;

    const {
      buildRunnerSessionManifest,
      isRunnerSessionManifest,
      sessionHeadersFromManifest,
    } = await import("../apps/api/src/lib/runner-session-manifest.js");

    const manifest = buildRunnerSessionManifest({
      workspaceId: "ws-presentation-editor-abc",
      subagentId: "document-editor",
      organizationId: "local",
      runner: "codex",
      gatewayPort: 42722,
      manifestPath: "/tmp/work/.dude-runner-session.json",
    });

    expect(manifest.version).toBe(RUNNER_SESSION_MANIFEST_VERSION);
    expect(manifest.workspaceId).toBe("ws-presentation-editor-abc");
    expect(manifest.subagentId).toBe("document-editor");
    expect(manifest.gatewayPort).toBe(42722);
    expect(manifest.internalApi.baseUrl).toBe("http://127.0.0.1:8787");
    expect(manifest.internalApi.dbPath).toBe("/tmp/electron/dude-local.sqlite");
    expect(manifest.dispatchCli).toContain("dude-dispatch-cli.ts");
    expect(manifest.dispatchCli).toContain("--manifest");
    expect(isRunnerSessionManifest(manifest)).toBe(true);
    expect(isRunnerSessionManifestSdk(manifest)).toBe(true);

    expect(sessionHeadersFromManifest(manifest)).toMatchObject({
      "x-workspace-id": "ws-presentation-editor-abc",
      "x-subagent-id": "document-editor",
      "x-organization-id": "local",
      "x-runner-id": "codex",
      "x-db-local-path": "/tmp/electron/dude-local.sqlite",
      "x-dude-manifest-version": "1",
      "x-dude-session-id": manifest.sessionId,
    });
  });
});

describe("codex dispatch command detection", () => {
  it("recognizes typed dispatch CLI commands", () => {
    const cmd =
      '/bin/zsh -lc "npx tsx /apps/api/src/lib/runners/dude-dispatch-cli.ts --manifest \'/tmp/.dude-runner-session.json\' read_slide \'{\\"slideIndex\\":0}\'"';

    expect(isAgentDispatchShellCommand(cmd)).toBe(true);
    expect(parseDispatchActionFromCommand(cmd)).toBe("read_slide");
  });

  it("still recognizes legacy curl dispatch for log filtering", () => {
    const cmd =
      '/bin/zsh -lc "curl -sS -X POST http://127.0.0.1:8787/v1/internal/agent/dispatch --data \'{\\"action\\":\\"finish_turn\\"}\'"';

    expect(isAgentDispatchShellCommand(cmd)).toBe(true);
    expect(parseDispatchActionFromCommand(cmd)).toBe("finish_turn");
  });
});
