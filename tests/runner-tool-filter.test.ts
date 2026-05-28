import {
  filterToolsForRunner,
  HOSTED_LLM_TOOL_NAMES,
  isNativeRunner,
  registerAgentRunnerManifest,
} from "@dude/sdk/runner";

describe("runner-tool-filter", () => {
  const tools = [
    { name: "read_slide" },
    { name: "edit_presentation" },
    { name: "generate_slide" },
    { name: "manage_design" },
  ];

  it("identifies native runners from manifest harnessKind", () => {
    expect(isNativeRunner("codex")).toBe(true);
    expect(isNativeRunner("cursor")).toBe(true);
    expect(isNativeRunner("hermes")).toBe(true);
    expect(isNativeRunner("pi")).toBe(false);
    expect(isNativeRunner(undefined)).toBe(false);
  });

  it("treats custom native runners as native when registered", () => {
    registerAgentRunnerManifest({
      id: "custom-native",
      label: "Custom",
      description: "",
      availability: "experimental",
      harnessKind: "native",
    });
    expect(isNativeRunner("custom-native")).toBe(true);
  });

  it("excludes hosted LLM tools for native runners", () => {
    const filtered = filterToolsForRunner(tools, "codex");
    expect(filtered.map((t) => t.name)).toEqual([
      "read_slide",
      "edit_presentation",
      "manage_design",
    ]);
    expect(HOSTED_LLM_TOOL_NAMES.has("generate_slide")).toBe(true);
  });

  it("keeps hosted LLM tools for pi", () => {
    expect(filterToolsForRunner(tools, "pi")).toHaveLength(4);
  });
});
