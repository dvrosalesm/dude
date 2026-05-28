import type {
  LocalMcpServerConfig,
  LocalSkillConfig,
  LocalSourceToolConfig,
} from "../../preferences";

export function createLocalConfigId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function newMcpServer(): LocalMcpServerConfig {
  return {
    id: createLocalConfigId("mcp"),
    name: "",
    transport: "http",
    url: "",
    env: {},
    enabled: true,
  };
}

export function newSourceTool(): LocalSourceToolConfig {
  return {
    id: createLocalConfigId("tool"),
    name: "",
    description: "",
    endpoint: "",
    enabled: true,
  };
}

export function newSkill(): LocalSkillConfig {
  return {
    id: createLocalConfigId("skill"),
    name: "",
    description: "",
    source: "registry",
    reference: "",
    trigger: "",
    instructions: "",
    config: {},
    enabled: true,
  };
}

export function splitArgs(value: string) {
  return value.split(/\s+/).map((item) => item.trim()).filter(Boolean);
}
