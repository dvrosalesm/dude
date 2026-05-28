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
  | "read_specialist_artifact"
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

export interface SpecialistDeclaration {
  baseTools: BaseToolId[];
  customTools: (() => ToolDefinition)[];
  collections: string[];
  skillPaths?: string[];
}

export interface SpecialistSummary {
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

export interface SpecialistManifest {
  gatewayLabel: string;
  gatewayDescription: string;
  delegable?: boolean;
  badges?: string[];
}

export interface SpecialistUi {
  icon: ComponentType<{ className?: string }>;
  ListPage: ComponentType;
  WorkspacePage: ComponentType;
  nestedRoutes?: Record<string, ComponentType>;
}

export interface SpecialistLocalConfig {
  summary: SpecialistSummary;
  defaultWorkspaceConfig?: (config: JsonValue) => JsonValue;
}

export interface SpecialistGatewayConfig {
  declaration: SpecialistDeclaration;
  skillPaths?: string[];
}

export interface SpecialistPlugin {
  id: string;
  path: string;
  manifest: SpecialistManifest;
  ui: SpecialistUi;
  api: (app: AnyElysia) => void;
  localHandlers?: LocalRouteTable;
  gateway?: SpecialistGatewayConfig;
  local?: SpecialistLocalConfig;
}

export interface SpecialistHostConfig {
  specialists: SpecialistPlugin[];
}

export interface ManageableSpecialist {
  id: string;
  path: string;
  gatewayLabel: string;
  gatewayDescription: string;
  delegable?: boolean;
}

export interface ClientRouteDescriptor {
  path: string;
  specialistId: string;
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

export interface SpecialistMeta {
  icon: ComponentType<{ className?: string }>;
  label: string;
  path: string;
}
