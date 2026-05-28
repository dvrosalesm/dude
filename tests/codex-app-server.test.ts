import {
  resolveCodexSandboxPolicy,
} from "../apps/api/src/lib/runners/codex-app-server";

describe("resolveCodexSandboxPolicy", () => {
  const env = process.env;

  beforeEach(() => {
    process.env = { ...env };
    delete process.env.CODEX_SANDBOX;
    delete process.env.CODEX_NETWORK_ACCESS;
  });

  afterAll(() => {
    process.env = env;
  });

  it("defaults to workspaceWrite with network access for localhost dispatch", () => {
    expect(resolveCodexSandboxPolicy("/tmp/project")).toEqual({
      type: "workspaceWrite",
      networkAccess: true,
      writableRoots: ["/tmp/project"],
    });
  });

  it("keeps legacy workspace-write mode network-off unless explicitly enabled", () => {
    process.env.CODEX_SANDBOX = "workspace-write";
    expect(resolveCodexSandboxPolicy()).toEqual({
      type: "workspaceWrite",
      networkAccess: false,
    });

    process.env.CODEX_NETWORK_ACCESS = "true";
    expect(resolveCodexSandboxPolicy()).toEqual({
      type: "workspaceWrite",
      networkAccess: true,
    });
  });

  it("supports danger-full-access override", () => {
    process.env.CODEX_SANDBOX = "danger-full-access";
    expect(resolveCodexSandboxPolicy()).toEqual({ type: "dangerFullAccess" });
  });
});
