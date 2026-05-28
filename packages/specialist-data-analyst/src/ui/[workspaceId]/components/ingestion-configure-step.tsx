"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, RefreshCw, Search, Wand2 } from "lucide-react";
import { Button } from "@dude/ui/components/button";
import { Input } from "@dude/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@dude/ui/components/select";
import { Switch } from "@dude/ui/components/switch";
import type { UseDataIngestionReturn } from "../hooks/use-data-ingestion";
import type { IngestIssue } from "../utils";
import { ColumnList } from "./ingestion-configure-columns";
import { PreviewTable } from "./ingestion-configure-preview";
import {
  AppendToggle,
  Field,
} from "./ingestion-configure-widgets";
import { FileMetaCard } from "./ingestion-upload-step";

export {
  AppendToggle,
  ColumnHeaderCell,
  Field,
  IssueFlag,
  typeBadgeClass,
} from "./ingestion-configure-widgets";
export { PreviewTable } from "./ingestion-configure-preview";
export { ColumnList } from "./ingestion-configure-columns";

export function ConfigureStep({
  ingestion,
}: {
  ingestion: UseDataIngestionReturn;
}) {
  const parsed = ingestion.parsedFile;
  const stats = ingestion.columnStats;
  const issues = ingestion.issues;
  const [columnSearch, setColumnSearch] = useState("");

  const issuesByHeader = useMemo(() => {
    const map = new Map<string, IngestIssue[]>();
    for (const issue of issues) {
      const existing = map.get(issue.header) ?? [];
      existing.push(issue);
      map.set(issue.header, existing);
    }
    return map;
  }, [issues]);

  const filteredStats = useMemo(() => {
    if (!columnSearch.trim()) return stats;
    const query = columnSearch.toLowerCase();
    return stats.filter(
      (stat) =>
        stat.header.toLowerCase().includes(query) ||
        (ingestion.columnMappings[stat.header] ?? "")
          .toLowerCase()
          .includes(query),
    );
  }, [stats, columnSearch, ingestion.columnMappings]);

  if (!parsed) return null;

  return (
    <div className="space-y-5">
      <FileMetaCard ingestion={ingestion} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label={"Table name"}>
          {ingestion.appendToExisting ? (
            <Select
              value={ingestion.tableName}
              onValueChange={ingestion.setTableName}
            >
              <SelectTrigger className="h-10 bg-card border border-border/50 shadow-sm rounded-lg">
                <SelectValue
                  placeholder={"Select a table"}
                />
              </SelectTrigger>
              <SelectContent>
                {ingestion.tableOptions.map((table) => (
                  <SelectItem key={table} value={table}>
                    {table}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              value={ingestion.tableName}
              onChange={(event) => ingestion.setTableName(event.target.value)}
              placeholder={"e.g. sales_q4"}
              className="h-10 bg-card border border-border/50 shadow-sm rounded-lg"
            />
          )}
        </Field>

        <Field
          label={"Delimiter"}
        >
          <Select
            value={ingestion.delimiter}
            disabled={ingestion.source !== "csv" || ingestion.reparsing}
            onValueChange={(value) =>
              void ingestion.handleDelimiterChange(value)
            }
          >
            <SelectTrigger className="h-10 bg-card border border-border/50 shadow-sm rounded-lg">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value=",">
                {"Comma \",\""}
              </SelectItem>
              <SelectItem value=";">
                {"Semicolon \";\""}
              </SelectItem>
              <SelectItem value={"\t"}>
                {"Tab"}
              </SelectItem>
              <SelectItem value="|">
                {"Pipe \"|\""}
              </SelectItem>
            </SelectContent>
          </Select>
        </Field>

        <Field
          label={"Encoding"}
        >
          <Select
            value={ingestion.encoding}
            disabled={ingestion.source !== "csv" || ingestion.reparsing}
            onValueChange={(value) => void ingestion.handleEncodingChange(value)}
          >
            <SelectTrigger className="h-10 bg-card border border-border/50 shadow-sm rounded-lg">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="UTF-8">UTF-8</SelectItem>
              <SelectItem value="UTF-16">UTF-16</SelectItem>
              <SelectItem value="ISO-8859-1">ISO-8859-1</SelectItem>
              <SelectItem value="Windows-1252">Windows-1252</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        <Field
          label={"Header row"}
        >
          <div className="flex h-10 items-center justify-between gap-3 rounded-lg border border-border/50 bg-card px-3 shadow-sm">
            <span className="text-xs text-muted-foreground">
              {"First row is header"}
            </span>
            <Switch
              checked={ingestion.hasHeaderRow}
              disabled={ingestion.reparsing}
              onCheckedChange={(value) =>
                void ingestion.handleHasHeaderRowChange(value)
              }
            />
          </div>
        </Field>
      </div>

      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">
            {"Preview"}{" "}
            <span className="text-xs font-normal text-muted-foreground">
              {`first ${Math.min(8, parsed.rows.length)} rows`}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={ingestion.handleAutoRenameSnakeCase}
          >
            <Wand2 className="mr-2 h-4 w-4" />
            {"Auto-rename snake_case"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void ingestion.handleReInferTypes()}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            {"Re-infer"}
          </Button>
        </div>
      </div>

      <PreviewTable
        headers={parsed.headers}
        rows={parsed.rows.slice(0, 8)}
        mappings={ingestion.columnMappings}
        stats={stats}
      />

      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">
          {"All columns"}{" "}
          <span className="ml-1 text-xs font-normal text-muted-foreground">
            {parsed.headers.length}
          </span>
        </p>
        <div className="flex items-center gap-3">
          {issues.length > 0 && (
            <span className="flex items-center gap-1 text-xs text-amber-600">
              <AlertTriangle className="h-3.5 w-3.5" />
              {issues.length + " issues"}
            </span>
          )}
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={columnSearch}
              onChange={(event) => setColumnSearch(event.target.value)}
              placeholder={"Search columns..."}
              className="h-8 w-[220px] pl-7 text-xs bg-card border border-border/50 shadow-sm rounded-lg"
            />
          </div>
        </div>
      </div>

      <ColumnList
        stats={filteredStats}
        mappings={ingestion.columnMappings}
        onMappingChange={ingestion.handleMappingChange}
        issuesByHeader={issuesByHeader}
      />

      <AppendToggle ingestion={ingestion} />
    </div>
  );
}
