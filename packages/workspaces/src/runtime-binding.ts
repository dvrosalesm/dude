import type { LocalChatRuntime } from "@dude/client-types";

let boundRuntime: LocalChatRuntime | null = null;

export function bindWorkspaceChatRuntime(runtime: LocalChatRuntime) {
  boundRuntime = runtime;
}

export function getWorkspaceChatRuntime(): LocalChatRuntime {
  if (!boundRuntime) {
    throw new Error(
      "[workspaces] Chat runtime is not ready yet. Import order bug — hostConfig must load before workspace calls.",
    );
  }
  return boundRuntime;
}

/** Lazy proxy so workspace modules never import `@dude/client-runtime` at load time. */
export const chatRuntime: LocalChatRuntime = new Proxy({} as LocalChatRuntime, {
  get(_target, prop) {
    const runtime = getWorkspaceChatRuntime() as Record<string | symbol, unknown>;
    const value = runtime[prop as keyof LocalChatRuntime];
    if (typeof value === "function") {
      return (value as (...args: unknown[]) => unknown).bind(runtime);
    }
    return value;
  },
});
