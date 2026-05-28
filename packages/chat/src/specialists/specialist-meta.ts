/**
 * Shared specialist metadata and helpers.
 * Built from installed specialist packages via @dude/sdk registry.
 */

import type { LucideIcon } from "lucide-react";
import type { SpecialistHostConfig } from "@dude/sdk";
import { createSpecialistRegistry } from "@dude/sdk";
import { getSpecialistMeta as buildMeta } from "@dude/sdk/client";

export interface SpecialistMeta {
  icon: LucideIcon;
  label: string;
  color: string;
  bg: string;
  path: string;
}

const SPECIALIST_COLOR = "text-[var(--dude-accent)]";
const SPECIALIST_BG = "bg-[var(--dude-surface-2)]";

let cachedMeta: Record<string, SpecialistMeta> | null = null;

export function initSpecialistMeta(hostConfig: SpecialistHostConfig) {
  const registry = createSpecialistRegistry(hostConfig);
  const baseMeta = buildMeta(registry);
  cachedMeta = Object.fromEntries(
    Object.entries(baseMeta).map(([id, meta]) => [
      id,
      {
        ...meta,
        color: SPECIALIST_COLOR,
        bg: SPECIALIST_BG,
      },
    ]),
  );
}

function getSpecialistMetaMap(): Record<string, SpecialistMeta> {
  if (!cachedMeta) {
    throw new Error(
      "[specialist-meta] Not initialized — call initSpecialistMeta() from main.tsx before render.",
    );
  }
  return cachedMeta;
}

export const SPECIALIST_META: Record<string, SpecialistMeta> = new Proxy(
  {} as Record<string, SpecialistMeta>,
  {
    get(_target, prop) {
      if (typeof prop === "string") {
        return getSpecialistMetaMap()[prop];
      }
      return undefined;
    },
    has(_target, prop) {
      return prop in getSpecialistMetaMap();
    },
    ownKeys() {
      return Reflect.ownKeys(getSpecialistMetaMap());
    },
    getOwnPropertyDescriptor(_target, prop) {
      const meta = getSpecialistMetaMap();
      if (typeof prop === "string" && prop in meta) {
        return {
          configurable: true,
          enumerable: true,
          value: meta[prop],
        };
      }
      return undefined;
    },
  },
);

export function isSpecialistCall(toolName: string): boolean {
  return toolName in getSpecialistMetaMap();
}

/**
 * Action-suggestion protocol: when the assistant emits a suggestion
 * starting with `action:`, the chat UI renders it as a side-effect button
 * (e.g. "Import data" → opens the data import wizard) instead of sending
 * the literal string back as a user message.
 */
export interface ParsedActionSuggestion {
  action: string;
  args: string[];
  label: string;
}

const ACTION_ARG_COUNTS: Record<string, number> = {
  "import-data": 0,
  "open-specialist": 2,
  "instruct-agent": 2,
  "review-agent": 2,
};

const DEFAULT_ACTION_LABELS: Record<string, string> = {
  "import-data": "Import data",
  "open-specialist": "Open",
  "instruct-agent": "Instruct",
  "review-agent": "Review",
};

export function parseActionSuggestion(raw: string): ParsedActionSuggestion | null {
  if (typeof raw !== "string") return null;
  if (!raw.startsWith("action:")) return null;
  const body = raw.slice("action:".length);
  if (!body) return null;
  const parts = body.split(":");
  const key = parts.shift()?.trim() || "";
  if (!key) return null;
  const expectedArgs = ACTION_ARG_COUNTS[key] ?? 0;
  if (parts.length < expectedArgs) {
    return null;
  }
  const args = parts.splice(0, expectedArgs).map((s) => s.trim());
  const providedLabel = parts.join(":").trim();
  const label = providedLabel || DEFAULT_ACTION_LABELS[key] || key;
  return { action: key, args, label };
}

export function extractImageUrl(result: unknown): string | null {
  if (!result) return null;
  let obj = result;
  if (typeof obj === "string") {
    try { obj = JSON.parse(obj); } catch { return null; }
  }
  if (typeof obj === "string") {
    try { obj = JSON.parse(obj); } catch { return null; }
  }
  if (obj && typeof obj === "object" && !Array.isArray(obj) && "imageUrl" in (obj as Record<string, unknown>)) {
    return (obj as Record<string, unknown>).imageUrl as string;
  }
  if (Array.isArray(obj)) {
    for (const item of obj) {
      if (item?.text) {
        try {
          const parsed = JSON.parse(item.text);
          if (parsed?.imageUrl) return parsed.imageUrl;
        } catch { /* ignore */ }
      }
      if (item?.imageUrl) return item.imageUrl;
    }
  }
  return null;
}

export function extractSpecialistAnswer(result: unknown): string | null {
  if (!result) return null;
  let obj = result;
  if (typeof obj === "string") {
    try { obj = JSON.parse(obj); } catch { return null; }
  }
  if (typeof obj === "string") {
    try { obj = JSON.parse(obj); } catch { return null; }
  }
  if (obj && typeof obj === "object" && !Array.isArray(obj) && "answer" in (obj as Record<string, unknown>)) {
    return (obj as Record<string, unknown>).answer as string;
  }
  if (Array.isArray(obj)) {
    for (const item of obj) {
      if (item?.text) {
        try {
          const parsed = JSON.parse(item.text);
          if (parsed?.answer) return parsed.answer;
        } catch { /* ignore */ }
      }
      if (item?.answer) return item.answer;
    }
  }
  return null;
}
