import type { LocalSpecialistWorkspace } from "@dude/client-types";

import {
  ensureUniqueIdentifiers,
  inferColumnType,
  normalizeIdentifier,
} from "@dude/data-analyst-core/column-utils";
import { parseCsv } from "./csv-parse";
import { getLocalTables } from "./query";
import { patchWorkspaceConfig } from "./shared";
import {
  forgetLocalUpload,
  getLocalUpload,
  localUploadUrl,
} from "./uploads";

export async function* ingestWorkspaceFile(
  workspace: LocalSpecialistWorkspace,
  body: Record<string, unknown>,
): AsyncGenerator<Record<string, unknown>, void, unknown> {
  const uploadKey = typeof body.uploadKey === "string" ? body.uploadKey : "";
  const upload = uploadKey ? await getLocalUpload(uploadKey) : null;
  const tableName = normalizeIdentifier(
    typeof body.tableName === "string" ? body.tableName : "local_table",
    "local_table",
  );
  const columnMappings =
    body.columnMappings && typeof body.columnMappings === "object"
      ? (body.columnMappings as Record<string, string>)
      : {};
  const delimiter = typeof body.delimiter === "string" ? body.delimiter : ",";
  const hasHeaderRow = body.hasHeaderRow !== false;
  const appendToExisting = Boolean(body.appendToExisting);

  try {
    yield { type: "progress", phase: "parsing", percent: 10 };
    const parsed = parseCsv(upload?.text ?? "", { delimiter, hasHeaderRow });
    const rawHeaders = parsed.headers.length ? parsed.headers : Object.values(columnMappings);
    const normalizedColumns = ensureUniqueIdentifiers(
      rawHeaders.map((header, index) =>
        normalizeIdentifier(columnMappings[header] ?? header, `column_${index + 1}`),
      ),
    );

    yield {
      type: "progress",
      phase: "inserting",
      percent: 45,
      current: 0,
      total: parsed.rows.length,
    };

    const currentTables = getLocalTables(workspace);
    const previousRows = appendToExisting ? currentTables[tableName] ?? [] : [];
    const rows = parsed.rows.map((row) =>
      Object.fromEntries(
        normalizedColumns.map((column, index) => [column, row[index] ?? ""]),
      ),
    );
    const nextRows = [...previousRows, ...rows];

    const sampleValues = normalizedColumns.map((_, index) =>
      parsed.rows.slice(0, 100).map((row) => row[index] ?? ""),
    );
    const existingSchema =
      workspace.configurations.schema && typeof workspace.configurations.schema === "object"
        ? (workspace.configurations.schema as Record<string, unknown>)
        : { tables: {} };
    const existingTables =
      existingSchema.tables && typeof existingSchema.tables === "object"
        ? (existingSchema.tables as Record<string, unknown>)
        : {};
    const updatedSchema = {
      ...existingSchema,
      tables: {
        ...existingTables,
        [tableName]: {
          columns: normalizedColumns.map((column, index) => ({
            name: column,
            type: inferColumnType(sampleValues[index] ?? []).type,
          })),
          rowCount: nextRows.length,
        },
      },
      updatedAt: new Date().toISOString(),
    };

    yield { type: "progress", phase: "uploading", percent: 90 };
    await patchWorkspaceConfig(workspace, {
      protected: false,
      datasets: [
        ...(Array.isArray(workspace.configurations.datasets)
          ? workspace.configurations.datasets
          : []),
        {
          id: `dataset-${Date.now()}`,
          name: upload?.fileName ?? tableName,
          fileId: upload?.id,
          fileUrl: upload ? localUploadUrl(upload.id) : undefined,
          tableName,
          rowCount: nextRows.length,
          importedAt: new Date().toISOString(),
        },
      ],
      localTables: {
        ...currentTables,
        [tableName]: nextRows,
      },
      schema: updatedSchema,
    });
    yield { type: "progress", phase: "uploading", percent: 100 };
    yield {
      type: "done",
      rowCount: rows.length,
      totalRowCount: nextRows.length,
      schema: updatedSchema,
    };
  } catch (error) {
    yield {
      type: "error",
      message: error instanceof Error ? error.message : "Local ingestion failed",
    };
  } finally {
    if (uploadKey) forgetLocalUpload(uploadKey);
  }
}
