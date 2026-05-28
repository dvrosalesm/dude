import { callWorkspaceAction } from "@dude/workspaces";
import type { QueryResult, RunQuery } from "@dude/data-analyst-core/render/query-context";
import type { SubagentId } from "@dude/client-types";

export function createWorkspaceSqlQuery(
  subagentId: SubagentId,
  workspaceId: string,
): RunQuery {
  return async (sql) => {
    const result = (await callWorkspaceAction(subagentId, workspaceId, "query", {
      method: "POST",
      body: { query: sql },
    })) as QueryResult;
    return result;
  };
}
