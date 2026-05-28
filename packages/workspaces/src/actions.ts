import type { SubagentId } from "@dude/client-types";

import {
  deleteWorkspaceById,
  getWorkspaceById,
  patchWorkspaceById,
} from "./crud";
import { LocalWorkspaceApiError } from "./errors";
import { ingestWorkspaceFile } from "./ingest";
import { queryLocalTables } from "./query";
import {
  chatRuntime,
  patchWorkspaceConfig,
  requireMatchingWorkspace,
  requireWorkspace,
  toUiMessage,
} from "./shared";
import {
  localUploadUrl,
  storeUploadFromBody,
  uploadBodyFromFile,
} from "./uploads";

export async function callWorkspaceAction(
  subagentId: SubagentId,
  workspaceId: string,
  actionPath: string,
  options: { method?: string; body?: Record<string, unknown> } = {},
) {
  const result = await handleSubagentWorkspaceAction(
    subagentId,
    workspaceId,
    actionPath,
    options.method ?? "POST",
    options.body ?? {},
  );
  if (
    result &&
    typeof result === "object" &&
    typeof (result as AsyncGenerator<unknown>)[Symbol.asyncIterator] === "function"
  ) {
    throw new LocalWorkspaceApiError("Use streamWorkspaceIngest for ingest actions", 400);
  }
  return result;
}

export async function postWorkspaceUploadUrl(
  subagentId: SubagentId,
  workspaceId: string,
  file: File,
) {
  const body = await uploadBodyFromFile(file);
  return storeUploadFromBody(
    body,
    `${subagentId}:${workspaceId}:upload-url`,
  ) as Promise<{
    uploadKey: string;
    key: string;
    uploadUrl: string;
    downloadUrl: string;
  }>;
}

export async function* streamWorkspaceIngest(
  subagentId: SubagentId,
  workspaceId: string,
  body: Record<string, unknown>,
): AsyncGenerator<Record<string, unknown>, void, unknown> {
  const workspace = await requireMatchingWorkspace(subagentId, workspaceId);
  yield* ingestWorkspaceFile(workspace, body);
}

async function handleSubagentWorkspaceAction(
  subagentId: SubagentId,
  workspaceId: string,
  actionPath: string | undefined,
  method: string,
  body: Record<string, unknown> = {},
) {
  const workspace = await requireMatchingWorkspace(subagentId, workspaceId);
  const normalizedMethod = method.toUpperCase();

  if (!actionPath) {
    if (normalizedMethod === "GET") {
      return getWorkspaceById(workspaceId);
    }
    if (normalizedMethod === "PATCH") {
      return patchWorkspaceById(workspaceId, {
        name: typeof body.name === "string" ? body.name : undefined,
        status:
          body.status === "draft" || body.status === "active" ? body.status : undefined,
        configurations:
          typeof body.configurations === "object" && body.configurations
            ? (body.configurations as Record<string, unknown>)
            : undefined,
      });
    }
    if (normalizedMethod === "DELETE") {
      return deleteWorkspaceById(workspaceId);
    }
    throw new LocalWorkspaceApiError("Unsupported workspace method", 405);
  }

  const action = actionPath.split("/")[0];

  if (action === "settings") {
    if (normalizedMethod === "GET") {
      return {
        chartColors:
          workspace.configurations.chartColors ??
          ["var(--dude-accent)", "var(--dude-success)", "var(--dude-muted)", "var(--dude-danger)"],
      };
    }
    const next = await patchWorkspaceConfig(workspace, {
      chartColors: Array.isArray(body.chartColors) ? body.chartColors : undefined,
    });
    return { workspace: next };
  }

  if (action === "reports") {
    if (normalizedMethod === "GET") {
      return { reports: workspace.configurations.reports ?? [] };
    }
    const next = await patchWorkspaceConfig(workspace, {
      reports: Array.isArray(body.reports) ? body.reports : [],
    });
    return {
      workspace: next,
      reports: next.configurations.reports ?? [],
    };
  }

  if (action === "query") {
    const query = typeof body.query === "string" ? body.query : "";
    return queryLocalTables(workspace, query);
  }

  if (action === "upload-url") {
    return storeUploadFromBody(
      {
        fileName: typeof body.fileName === "string" ? body.fileName : "Local upload",
        fileType: typeof body.fileType === "string" ? body.fileType : "application/octet-stream",
        size: typeof body.size === "number" ? body.size : 0,
        text: typeof body.text === "string" ? body.text : undefined,
        bytesBase64: typeof body.bytesBase64 === "string" ? body.bytesBase64 : undefined,
        dataUrl: typeof body.dataUrl === "string" ? body.dataUrl : undefined,
      },
      `${workspace.subagentId}:${workspace.id}:upload-url`,
    );
  }

  if (action === "connections") {
    throw new LocalWorkspaceApiError(
      "Direct database connections are not available in local mode.",
      501,
    );
  }

  if (action === "ingest" || action === "ingest-file") {
    throw new LocalWorkspaceApiError("Use streamWorkspaceIngest for file ingestion", 400);
  }

  if (action === "upload") {
    const current = Array.isArray(workspace.configurations.cvFiles)
      ? workspace.configurations.cvFiles
      : [];
    const fileId = `file-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const fileName = typeof body.fileName === "string" ? body.fileName : "Local file";
    const fileType =
      typeof body.fileType === "string" ? body.fileType : "application/octet-stream";
    await storeUploadFromBody(
      {
        fileName,
        fileType,
        size: typeof body.size === "number" ? body.size : 0,
        text: typeof body.text === "string" ? body.text : undefined,
        bytesBase64: typeof body.bytesBase64 === "string" ? body.bytesBase64 : undefined,
        dataUrl: typeof body.dataUrl === "string" ? body.dataUrl : undefined,
      },
      `${workspace.subagentId}:${workspace.id}:upload`,
      fileId,
    );
    const file = {
      id: fileId,
      name: fileName,
      fileName,
      fileUrl: localUploadUrl(fileId),
      localFileId: fileId,
      mimeType: fileType,
      size: typeof body.size === "number" ? body.size : 0,
      uploadedAt: new Date().toISOString(),
    };
    const next = await patchWorkspaceConfig(workspace, {
      cvFiles: [...current, file],
    });
    return {
      workspace: next,
      files: next.configurations.cvFiles,
      cvFile: file,
    };
  }

  if (action === "edit-image") {
    if (body.operation === "enumerate-components") {
      return {
        components: [
          "the primary foreground subject",
          "the main background shape or scene",
          "the strongest supporting visual element",
        ],
      };
    }
    return {
      imageUrl: typeof body.imageUrl === "string" ? body.imageUrl : "",
      prompt: typeof body.prompt === "string" ? body.prompt : "",
      local: true,
    };
  }

  if (action === "assess") {
    const current = Array.isArray(workspace.configurations.assessments)
      ? workspace.configurations.assessments
      : [];
    const assessment = {
      id: `assessment-${Date.now()}`,
      candidateName: "Local candidate",
      status: "draft",
      createdAt: new Date().toISOString(),
      scores: [],
    };
    const next = await patchWorkspaceConfig(workspace, {
      assessments: [...current, assessment],
    });
    return {
      workspace: next,
      assessment,
      assessments: next.configurations.assessments,
    };
  }

  if (action === "export") {
    return {
      content: "local export\n",
      filename: `${workspace.name || "workspace"}.txt`,
      contentType: "text/plain",
    };
  }

  if (normalizedMethod === "GET") {
    return { workspace: await requireWorkspace(workspaceId) };
  }

  const next = await patchWorkspaceConfig(workspace, {
    ...(typeof body.configurations === "object" && body.configurations
      ? (body.configurations as Record<string, unknown>)
      : body),
  });
  return { ok: true, workspace: next };
}
