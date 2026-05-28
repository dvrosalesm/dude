import { shouldLogCodexRun } from "../apps/api/src/lib/runners/codex-run-logger";

describe("shouldLogCodexRun", () => {
  const env = process.env;

  beforeEach(() => {
    process.env = { ...env };
    delete process.env.DUDE_CODEX_LOG;
    delete process.env.TMUX;
  });

  afterAll(() => {
    process.env = env;
  });

  it("enables logging when DUDE_CODEX_LOG=1", () => {
    process.env.DUDE_CODEX_LOG = "1";
    expect(shouldLogCodexRun()).toBe(true);
  });

  it("disables logging when DUDE_CODEX_LOG=0", () => {
    process.env.DUDE_CODEX_LOG = "0";
    process.env.TMUX = "1";
    expect(shouldLogCodexRun()).toBe(false);
  });

  it("enables logging inside tmux", () => {
    process.env.TMUX = "/private/tmp/tmux-501/default,123,0";
    expect(shouldLogCodexRun()).toBe(true);
  });
});
