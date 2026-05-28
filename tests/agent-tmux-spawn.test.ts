import {
  buildAgentSpawnFile,
  buildTmuxSessionName,
  shellQuote,
} from "../apps/api/src/lib/agent-tmux-spawn";
import type { RunnerSpawnPlan } from "../apps/api/src/lib/runners/index";

describe("agent-tmux-spawn", () => {
  it("sanitizes workspace ids into unique tmux session names", () => {
    const name = buildTmuxSessionName(
      "document-editor:ws-presentation-editor-34878c0d-fa47-45e7-b7dd-cda2f4c8056f",
    );
    expect(name).toMatch(/^dude-agent-.+-[a-f0-9]{8}$/);
  });

  it("shell-quotes values with single quotes", () => {
    expect(shellQuote(`it's fine`)).toBe(`'it'\\''s fine'`);
  });

  it("builds spawn json without shell escaping issues", () => {
    const plan: RunnerSpawnPlan = {
      command: "npx",
      args: ["tsx", "server.ts"],
      cwd: "/tmp/work",
      env: {
        GATEWAY_PORT: "42721",
        SYSTEM_PROMPT: "Say 'hello'\nwith newline",
      },
    };

    const json = buildAgentSpawnFile(plan);
    const parsed = JSON.parse(json);
    expect(parsed.env.SYSTEM_PROMPT).toBe("Say 'hello'\nwith newline");
    expect(parsed.command).toBe("npx");
  });

});
