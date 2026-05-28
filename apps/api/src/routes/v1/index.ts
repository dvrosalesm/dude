import { Elysia } from "elysia";
import { gatewayHealthRoutes } from "./health.js";
import { instanceRoutes } from "./instances.js";
import { runnerRoutes } from "./runners.js";
import { proxyRoutes } from "./proxy.js";
import {
  localhostOnly,
  internalDbContext,
  handleRouteError,
  withInternalRequestDb,
} from "./middleware.js";
import * as internal from "./internal-handlers.js";
import * as assistantInternal from "./assistant-internal-handlers.js";
import * as toolHost from "./tool-host-handlers.js";
import * as agentDispatch from "./agent-dispatch-handlers.js";
import * as uiInput from "./ui-input-handlers.js";

const { getToolHostCatalog, postToolHostExecute } = toolHost;
const { getAgentCatalog, postAgentDispatch } = agentDispatch;

function wrap<T extends (...args: never[]) => Promise<unknown>>(
  fn: T,
  ...args: Parameters<T>
) {
  return fn(...args);
}

export const v1Routes = new Elysia({ prefix: "/v1" })
  .use(gatewayHealthRoutes)
  .use(runnerRoutes)
  .use(instanceRoutes)
  .use(proxyRoutes)
  .group("/internal", (app) =>
    app
      .use(localhostOnly)
      .use(internalDbContext)
      .get("/tool-host/catalog", async ({ request, set }) => {
        try {
          return await getToolHostCatalog(request);
        } catch (error) {
          return handleRouteError(error, set);
        }
      })
      .post("/tool-host/execute", async ({ request, set }) => {
        try {
          return await postToolHostExecute(request);
        } catch (error) {
          return handleRouteError(error, set);
        }
      })
      .get("/agent/catalog", async ({ request, set }) => {
        try {
          return await getAgentCatalog(request);
        } catch (error) {
          return handleRouteError(error, set);
        }
      })
      .post("/agent/dispatch", async ({ request, set }) => {
        try {
          return await postAgentDispatch(request);
        } catch (error) {
          return handleRouteError(error, set);
        }
      })
      .post("/workspace/:workspaceId/save-messages", async ({ params, body, request, set }) => {
        try {
          return await withInternalRequestDb(request, () =>
            internal.saveMessages(
              params.workspaceId,
              body as Record<string, unknown>,
            ),
          );
        } catch (error) {
          return handleRouteError(error, set);
        }
      })
      .post("/workspace/:workspaceId/charge-tool", async ({ params, body, request, set }) => {
        try {
          return await withInternalRequestDb(request, () =>
            internal.chargeTool(
              params.workspaceId,
              body as Record<string, unknown>,
            ),
          );
        } catch (error) {
          return handleRouteError(error, set);
        }
      })
      .get("/workspace/:workspaceId/config", async ({ params, request, set }) => {
        try {
          return await withInternalRequestDb(request, () =>
            internal.getConfig(params.workspaceId),
          );
        } catch (error) {
          return handleRouteError(error, set);
        }
      })
      .post("/workspace/:workspaceId/collection", async ({ params, body, request, set }) => {
        try {
          return await withInternalRequestDb(request, () =>
            internal.saveCollection(
              params.workspaceId,
              body as Record<string, unknown>,
            ),
          );
        } catch (error) {
          return handleRouteError(error, set);
        }
      })
      .get(
        "/workspace/:workspaceId/collection/:collection",
        async ({ params, request, set }) => {
          try {
            return await withInternalRequestDb(request, () =>
              internal.readCollection(params.workspaceId, params.collection),
            );
          } catch (error) {
            return handleRouteError(error, set);
          }
        },
      )
      .post("/workspace/:workspaceId/ui-input/wait", async ({ params, body, set }) => {
        try {
          return await wrap(
            uiInput.waitForWorkspaceUiInput,
            params.workspaceId,
            body as Record<string, unknown>,
          );
        } catch (error) {
          return handleRouteError(error, set);
        }
      })
      .group("/assistant", (assistantApp) =>
        assistantApp
          .get("/subagent-workspaces", async ({ query, set }) => {
            try {
              return await wrap(
                assistantInternal.listWorkspaces,
                query.subagentId as string | undefined,
              );
            } catch (error) {
              return handleRouteError(error, set);
            }
          })
          .post("/subagent-workspaces", async ({ body, set }) => {
            try {
              return await wrap(
                assistantInternal.createWorkspace,
                body as Record<string, unknown>,
              );
            } catch (error) {
              return handleRouteError(error, set);
            }
          })
          .get("/memories", async ({ set }) => {
            try {
              return await wrap(assistantInternal.getMemories);
            } catch (error) {
              return handleRouteError(error, set);
            }
          })
          .post("/memories", async ({ body, set }) => {
            try {
              return await wrap(
                assistantInternal.saveMemory,
                body as Record<string, unknown>,
              );
            } catch (error) {
              return handleRouteError(error, set);
            }
          })
          .post("/subagent-run", async ({ body, set }) => {
            try {
              return await wrap(
                assistantInternal.runSubagent,
                body as Record<string, unknown>,
              );
            } catch (error) {
              return handleRouteError(error, set);
            }
          })
          .get("/runtime-settings", async ({ set }) => {
            try {
              return await wrap(assistantInternal.getRuntimeSettings);
            } catch (error) {
              return handleRouteError(error, set);
            }
          })
          .post("/runtime-settings", async ({ body, set }) => {
            try {
              return await wrap(
                assistantInternal.putRuntimeSettings,
                body as Record<string, unknown>,
              );
            } catch (error) {
              return handleRouteError(error, set);
            }
          })
          .post("/project-hub", async ({ body, set }) => {
            try {
              return await wrap(
                assistantInternal.getProjectHub,
                body as Record<string, unknown>,
              );
            } catch (error) {
              return handleRouteError(error, set);
            }
          }),
      ),
  );
