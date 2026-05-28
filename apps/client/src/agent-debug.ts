/**
 * Dev-only hooks for Cursor browser MCP / CDP probes.
 * See scripts/agent-harness/README.md
 */

import {
  navigateTo,
  parseRoute,
  readRoutePath,
  subagentPath,
  type SubagentId,
} from "./route-utils";

export type DudeAgentDebugSnapshot = {
  href: string;
  path: string;
  route: ReturnType<typeof parseRoute>;
  probes: {
    documentWriter: unknown;
  };
};

export function attachAgentDebugHooks(): void {
  if (!import.meta.env.DEV || typeof window === "undefined") return;

  const w = window as Window & {
    __DUDE_AGENT__?: {
      snapshot: () => DudeAgentDebugSnapshot;
      navigate: (path: string) => void;
      openSubagent: (
        subagentId: SubagentId,
        workspaceId?: string,
      ) => string;
      probes: {
        documentWriter: () => unknown;
      };
    };
    __DUDE_DW_DEBUG__?: { snapshot: () => unknown };
  };

  w.__DUDE_AGENT__ = {
    snapshot: () => ({
      href: window.location.href,
      path: readRoutePath(),
      route: parseRoute(readRoutePath()),
      probes: {
        documentWriter: w.__DUDE_DW_DEBUG__?.snapshot?.() ?? null,
      },
    }),
    navigate: (path) => navigateTo(path),
    openSubagent: (subagentId, workspaceId) => {
      const path = subagentPath(subagentId, workspaceId);
      navigateTo(path);
      return path;
    },
    probes: {
      documentWriter: () => w.__DUDE_DW_DEBUG__?.snapshot?.() ?? null,
    },
  };
}
