import type {
  LocalChatMessage,
  LocalSubagentWorkspace,
  LocalStoredFile,
  SendLocalMessageInput,
  SubagentId,
  SubagentSummary,
} from "../types";
import { SUBAGENTS } from "./subagent-list";

export interface StoredState {
  threads: Record<string, LocalChatMessage[]>;
  workspaces: Record<string, LocalSubagentWorkspace>;
  files: Record<string, LocalStoredFile>;
}

export const STORAGE_KEY = "dude.local-chat.v1";

export function threadKey(subagentId: SubagentId, workspaceId?: string) {
  return `${subagentId}:${workspaceId ?? "default"}`;
}

export function createId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function bootMessage(): LocalChatMessage {
  return {
    id: createId("msg"),
    role: "assistant",
    subagentId: "main-assistant",
    createdAt: new Date().toISOString(),
    content:
      `Hey, I'm Dude. Bring me a task and I can route it to the right local subagent: data, decks, writing, design, prospecting, sales, or HR.`,
  };
}

export function emptyState(): StoredState {
  return {
    threads: {},
    workspaces: {},
    files: {},
  };
}

export function normalizeStoredState(state: Partial<StoredState> | null | undefined) {
  const normalized: StoredState = {
    threads: state?.threads ?? {},
    workspaces: state?.workspaces ?? {},
    files: state?.files ?? {},
  };
  normalized.workspaces = Object.fromEntries(
    Object.entries(normalized.workspaces).filter(
      ([, workspace]) => String(workspace.subagentId) !== "canvas",
    ),
  );
  for (const workspace of Object.values(normalized.workspaces)) {
    workspace.configurations = normalizeWorkspaceConfig(
      workspace.subagentId,
      workspace.configurations ?? {},
    );
  }
  return normalized;
}

export function normalizeWorkspaceConfig(
  subagentId: SubagentId,
  config: Record<string, unknown>,
) {
  if (subagentId !== "prospect") return config;

  const legacyLandingPage = config.landingPage;
  const landingPages = Array.isArray(config.landingPages)
    ? config.landingPages
    : legacyLandingPage && typeof legacyLandingPage === "object"
      ? [legacyLandingPage]
      : [];

  return {
    ...config,
    landingPages,
    leads: Array.isArray(config.leads) ? config.leads : [],
    pageViews: Array.isArray(config.pageViews) ? config.pageViews : [],
    landingPage: undefined,
  };
}

export async function readState(): Promise<StoredState> {
  if (typeof window !== "undefined" && window.dudeDesktop?.localData) {
    try {
      const sqliteState = normalizeStoredState(
        await window.dudeDesktop.localData.readState(),
      );
      if (
        Object.keys(sqliteState.workspaces).length === 0 &&
        window.localStorage
      ) {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const migrated = normalizeStoredState(JSON.parse(raw) as StoredState);
          if (Object.keys(migrated.workspaces).length > 0) {
            await window.dudeDesktop.localData.writeState(migrated);
            return migrated;
          }
        }
      }
      return sqliteState;
    } catch {
      return emptyState();
    }
  }

  if (typeof window === "undefined") {
    return emptyState();
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as StoredState;
      return normalizeStoredState(parsed);
    }
  } catch {
    // Fall back to a clean local state.
  }

  return emptyState();
}

export async function writeState(state: StoredState) {
  if (typeof window !== "undefined" && window.dudeDesktop?.localData) {
    await window.dudeDesktop.localData.writeState(state);
    return;
  }
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function getThread(
  state: StoredState,
  subagentId: SubagentId,
  workspaceId?: string,
) {
  const key = threadKey(subagentId, workspaceId);
  if (!state.threads[key]) {
    state.threads[key] =
      subagentId === "main-assistant"
        ? [bootMessage()]
        : [
            {
              ...bootMessage(),
              subagentId,
              content: `${subagentName(subagentId)} is ready in the local workspace.`,
            },
          ];
  }
  return state.threads[key];
}

export function subagentName(subagentId: SubagentId) {
  if (subagentId === "main-assistant") return "Dude";
  return SUBAGENTS.find((subagent) => subagent.id === subagentId)?.name ?? "Subagent";
}

export function defaultWorkspaceName(subagentId: SubagentId) {
  switch (subagentId) {
    case "presentation-editor":
      return "Untitled deck";
    case "document-writer":
      return "Untitled document";
    case "design-branding":
      return "Untitled canvas";
    case "data-analyst":
      return "Untitled analysis";
    case "prospect":
      return "Untitled prospect run";
    default:
      return "Untitled workspace";
  }
}

export function defaultWorkspaceConfig(subagentId: SubagentId) {
  switch (subagentId) {
    case "presentation-editor":
      return {
        documentType: "pptx",
        outline: ["Opening", "Problem", "Approach", "Next steps"],
        slides: [],
      };
    case "document-writer":
      return {
        template: "blank",
        documentContent: {
          title: "Untitled document",
          blocks: [],
        },
      };
    case "design-branding":
      return {
        canvasSnapshot: { nodes: [], edges: [] },
        palettes: [],
        typography: [],
      };
    case "data-analyst":
      return {
        datasets: [],
        reports: [],
      };
    case "prospect":
      return {
        leads: [],
        landingPages: [],
        pageViews: [],
      };
    default:
      return {};
  }
}

export function workspaceSort(
  a: LocalSubagentWorkspace,
  b: LocalSubagentWorkspace,
) {
  return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
}

export function inferSubagent(message: string): SubagentSummary | undefined {
  const text = message.toLowerCase();
  if (/\b(csv|spreadsheet|chart|dashboard|sql|dataset|report)\b/.test(text)) {
    return SUBAGENTS.find((subagent) => subagent.id === "data-analyst");
  }
  if (/\b(deck|slide|presentation|keynote|ppt)\b/.test(text)) {
    return SUBAGENTS.find((subagent) => subagent.id === "presentation-editor");
  }
  if (/\b(copy|doc|document|memo|brief|draft|write)\b/.test(text)) {
    return SUBAGENTS.find((subagent) => subagent.id === "document-writer");
  }
  if (/\b(brand|logo|visual|design|identity)\b/.test(text)) {
    return SUBAGENTS.find((subagent) => subagent.id === "design-branding");
  }
  if (/\b(lead|prospect|research|company list)\b/.test(text)) {
    return SUBAGENTS.find((subagent) => subagent.id === "prospect");
  }
  return undefined;
}

export function createAssistantReply(input: SendLocalMessageInput): string {
  const selected =
    input.subagentId === "main-assistant"
      ? inferSubagent(input.content)
      : SUBAGENTS.find((subagent) => subagent.id === input.subagentId);

  if (input.subagentId !== "main-assistant") {
    return `${subagentName(input.subagentId)} received it. I will keep this workspace local and prepare the next action around: "${input.content.slice(0, 120)}"`;
  }

  if (selected) {
    return `I can route this to ${selected.name}. In the local app, that means opening a ${selected.handle} workspace, keeping the source files on-device, and only asking for the API key needed for that run.`;
  }

  return "Got it. I can turn that into a local subagent run, save the transcript here, and keep the cloud boundary limited to whatever model provider you choose.";
}
