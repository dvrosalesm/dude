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
 * A specialist setup function — receives the pi context and registers its tools.
 */
export type SpecialistSetup = (pi: PiContext) => void;

/**
 * Minimal interface for the pi extension context.
 */
export interface PiContext {
  registerTool(tool: ToolDefinition): void;
}

// ---------------------------------------------------------------------------
// Declarative specialist configuration
// ---------------------------------------------------------------------------

/** Base tool IDs available to all specialists. */
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

/**
 * Declarative specialist configuration.
 * Instead of imperative setup(pi) functions, specialists declare what they need.
 */
export interface SpecialistDeclaration {
  /** Which shared base tools this specialist gets. */
  baseTools: BaseToolId[];
  /** Custom tool factory functions for specialist-specific behavior. */
  customTools: (() => ToolDefinition)[];
  /** Which workspace collections this specialist can write to (for documentation). */
  collections: string[];
  /**
   * Absolute filesystem paths to skill directories Pi SDK should load for this
   * specialist. Each entry is a directory that either contains a SKILL.md
   * (treated as one skill) or has subdirectories with SKILL.md files. Pi
   * appends a discovery XML block to the system prompt; the agent expands
   * each skill's body into context only when it invokes it.
   *
   * Resolve paths with `resolveGatewaySkillPaths` from `@dude/sdk/gateway-runtime`
   * relative to each specialist's `gateway/` directory — never hard-code absolutes.
   */
  skillPaths?: string[];
}
