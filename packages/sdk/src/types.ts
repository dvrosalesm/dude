import type { ComponentType } from "react";
import type { Elysia } from "elysia";

type AnyElysia = Elysia<any, any, any, any, any, any, any>;

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type BaseToolId =
  | "web_search"
  | "web_scrape"
  | "search_in_website"
  | "exa_search"
  | "workspace_read"
  | "workspace_save"
  | "read_subagent_artifact"
  | "save_memory"
  | "list_memories";

export interface ToolDefinition {
  name: string;
  label: string;
  description: string;
  parameters: unknown;
  execute: (
    toolCallId: string,
    params: Record<string, unknown>,
  ) => Promise<{
    content: Array<{ type: string; text: string }>;
    details: Record<string, unknown>;
  }>;
}

export interface SubagentDeclaration {
  baseTools: BaseToolId[];
  customTools: (() => ToolDefinition)[];
  collections: string[];
  skillPaths?: string[];
}

export interface SubagentSummary {
  id: string;
  name: string;
  handle: string;
  scope: string;
  status: "ready" | "draft";
}

export type LocalRouteHandler = (
  request: Request,
  params: Record<string, string>,
) => Promise<Response> | Response;

export type LocalRouteTable = Record<string, LocalRouteHandler>;

export interface SubagentManifest {
  gatewayLabel: string;
  gatewayDescription: string;
  delegable?: boolean;
  badges?: string[];
}

export interface SubagentUi {
  icon: ComponentType<{ className?: string }>;
  ListPage: ComponentType;
  WorkspacePage: ComponentType;
  nestedRoutes?: Record<string, ComponentType>;
}

export interface SubagentLocalConfig {
  summary: SubagentSummary;
  defaultWorkspaceConfig?: (config: JsonValue) => JsonValue;
}

export interface SubagentGatewayConfig {
  declaration: SubagentDeclaration;
  skillPaths?: string[];
}

export interface SubagentPlugin {
  id: string;
  path: string;
  manifest: SubagentManifest;
  ui: SubagentUi;
  api: (app: AnyElysia) => void;
  localHandlers?: LocalRouteTable;
  gateway?: SubagentGatewayConfig;
  local?: SubagentLocalConfig;
}

export interface SubagentHostConfig {
  subagents: SubagentPlugin[];
}

export interface ManageableSubagent {
  id: string;
  path: string;
  gatewayLabel: string;
  gatewayDescription: string;
  delegable?: boolean;
}

export interface ClientRouteDescriptor {
  path: string;
  subagentId: string;
  kind: "list" | "workspace" | "nested";
  nestedKey?: string;
  component: ComponentType;
}

export interface HomeGridDef {
  id: string;
  path: string;
  title: string;
  description: string;
  badges: string[];
}

export interface SubagentMeta {
  icon: ComponentType<{ className?: string }>;
  label: string;
  path: string;
}
