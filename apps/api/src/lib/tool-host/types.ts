import type { TObject } from "@sinclair/typebox";

/**
 * A tool definition that can be registered with pi.registerTool().
 * Each tool file exports a function returning one of these.
 */
export interface ToolDefinition {
  name: string;
  label: string;
  description: string;
  parameters: TObject;
  execute: (toolCallId: string, params: any) => Promise<{
    content: Array<{ type: string; text: string }>;
    details: Record<string, unknown>;
  }>;
}

/**
 * A subagent setup function — receives the pi context and registers its tools.
 */
export type SubagentSetup = (pi: PiContext) => void;

/**
 * Minimal interface for the pi extension context.
 */
export interface PiContext {
  registerTool(tool: ToolDefinition): void;
}

// ---------------------------------------------------------------------------
// Declarative subagent configuration
// ---------------------------------------------------------------------------

/** Base tool IDs available to all subagents. */
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

/**
 * Declarative subagent configuration.
 * Instead of imperative setup(pi) functions, subagents declare what they need.
 */
export interface SubagentDeclaration {
  /** Which shared base tools this subagent gets. */
  baseTools: BaseToolId[];
  /** Custom tool factory functions for specialist-specific behavior. */
  customTools: (() => ToolDefinition)[];
  /** Which workspace collections this subagent can write to (for documentation). */
  collections: string[];
  /**
   * Absolute filesystem paths to skill directories Pi SDK should load for this
   * subagent. Each entry is a directory that either contains a SKILL.md
   * (treated as one skill) or has subdirectories with SKILL.md files. Pi
   * appends a discovery XML block to the system prompt; the agent expands
   * each skill's body into context only when it invokes it.
   *
   * Resolve paths with `resolveGatewaySkillPaths` from `@dude/sdk/gateway-runtime`
   * relative to each subagent's `gateway/` directory — never hard-code absolutes.
   */
  skillPaths?: string[];
}
