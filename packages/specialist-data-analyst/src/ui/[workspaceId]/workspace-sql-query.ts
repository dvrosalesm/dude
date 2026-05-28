import { callWorkspaceAction } from "@dude/workspaces";
import type { QueryResult, RunQuery } from "@dude/data-analyst-core/render/query-context";
import type { SpecialistId } from "@dude/client-types";

export function createWorkspaceSqlQuery(
  specialistId: SpecialistId,
  workspaceId: string,
): RunQuery {
  return async (sql) => {
    const result = (await callWorkspaceAction(specialistId, workspaceId, "query", {
      method: "POST",
      body: { query: sql },
    })) as QueryResult;
    return result;
  };
}
