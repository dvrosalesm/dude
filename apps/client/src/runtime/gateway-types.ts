export type GatewayConversationMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  images?: string[];
  status: "completed" | "processing" | "error";
  error?: string;
  suggestions?: string[];
  traces?: {
    steps: string[];
    toolExecutions: Array<{
      tool: string;
      arguments: Record<string, unknown>;
      result: unknown;
    }>;
    durationMs: number;
  };
  progressMessages?: string[];
  pendingUserInput?: {
    id: string;
    workspaceId: string;
    kind: "confirm" | "question" | "choice";
    title: string;
    message: string;
    options?: Array<{ id: string; label: string }>;
    defaultOptionId?: string;
    placeholder?: string;
    createdAt: string;
  } | null;
  createdAt: string;
};

export type GatewayChatResponse = {
  sessionId: string;
  assistantMessageId?: string;
  messages: GatewayConversationMessage[];
};

type AppCapabilityRequest = {
  id?: string;
  action?: "list" | "find_skill" | "upsert" | "remove";
  kind?: "mcp_server" | "source_tool" | "skill";
  query?: string;
  config?: Record<string, unknown>;
};

type LocalSkillCatalogEntry = {
  name: string;
  source: string;
  sourceType: string;
};
