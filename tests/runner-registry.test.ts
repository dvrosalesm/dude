import {
  BUILTIN_RUNNER_IDS,
  createAgentRunnerRegistry,
  listAgentRunners,
  registerAgentRunnerManifest,
} from "@dude/sdk/runner";

describe("agent runner registry", () => {
  it("lists every builtin runner id including cursor", () => {
    const registry = createAgentRunnerRegistry();
    const ids = registry.list().map((runner) => runner.id);

    expect(BUILTIN_RUNNER_IDS).toEqual(["pi", "codex", "hermes", "cursor"]);
    expect(ids).toEqual(BUILTIN_RUNNER_IDS);
    expect(listAgentRunners().map((runner) => runner.id)).toEqual(
      BUILTIN_RUNNER_IDS,
    );
  });

  it("merges custom manifests into listAgentRunners", () => {
    registerAgentRunnerManifest({
      id: "acme",
      label: "Acme Runner",
      description: "Custom test runner",
      availability: "experimental",
      harnessKind: "native",
    });

    const ids = listAgentRunners().map((runner) => runner.id);
    expect(ids).toContain("acme");
  });
});
