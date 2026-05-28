import {
  buildRuntimeSecrets,
  resolveToolHostApiKey,
} from "../apps/api/src/lib/runtime-config.js";

describe("runtime secrets", () => {
  const originalOpenRouter = process.env.OPEN_ROUTER_API_KEY;

  afterEach(() => {
    if (originalOpenRouter === undefined) delete process.env.OPEN_ROUTER_API_KEY;
    else process.env.OPEN_ROUTER_API_KEY = originalOpenRouter;
  });

  it("uses OpenRouter credentials for tool host when runner provider is openai-codex", () => {
    const key = resolveToolHostApiKey(
      { kind: "openai-codex", model: "gpt-5.4" },
      { openrouter: "sk-or-test-key" },
    );
    expect(key).toBe("sk-or-test-key");
  });

  it("buildRuntimeSecrets prefers OpenRouter key for Codex harness configs", () => {
    const secrets = buildRuntimeSecrets({
      runner: "codex",
      provider: { kind: "openai-codex", model: "gpt-5.4" },
      credentials: { openrouter: "sk-or-from-settings" },
      systemPrompt: "",
      tools: [],
    });

    expect(secrets.apiKey).toBe("sk-or-from-settings");
  });

  it("falls back to OPEN_ROUTER_API_KEY env when credentials are empty", () => {
    process.env.OPEN_ROUTER_API_KEY = "sk-or-from-env";
    const secrets = buildRuntimeSecrets({
      runner: "codex",
      provider: { kind: "openai-codex", model: "gpt-5.4" },
      credentials: {},
      systemPrompt: "",
      tools: [],
    });

    expect(secrets.apiKey).toBe("sk-or-from-env");
  });
});
