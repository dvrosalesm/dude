export type WorkspaceMessage = {
  message: string;
  role: string;
  date?: string;
  images?: string[];
  steps?: string[];
  answer?: string;
  toolResults?: ToolResult[];
  /** Full execution trace from the agent loop (persisted per message). */
  executionTrace?: ExecutionTrace;
  /** Actionable suggestions the user can click to send as a new message. */
  suggestions?: string[];
};

export type { ChatImageAttachment } from "@dude/chat-types";

export type SqlQueryResult = {
  columns: string[];
  rows: Array<Record<string, unknown>>;
};

export type ToolResult =
  | {
    id: string;
    tool: "sql";
    result: SqlQueryResult;
  }
  | {
    id: string;
    tool: "javascript";
    result: unknown;
  }
  | {
    id: string;
    tool: string;
    error: string;
  };

export type ReportChartType = "bar" | "line" | "area" | "pie";

export type ReportChartSpec = {
  type: ReportChartType;
  data: Array<Record<string, unknown>>;
  xKey: string;
  yKey: string;
  series?: Array<{ key: string; label?: string }>;
};

export type HtmlReportArtifact = {
  type: "html";
  content: string;
};

export type VegaLiteReportArtifact = {
  type: "vegaLite";
  spec: Record<string, unknown>;
};

export type ReportArtifact = HtmlReportArtifact | VegaLiteReportArtifact;

export type ReportItem = {
  id: string;
  prompt: string;
  title: string;
  summary?: string;
  createdAt: string;
  chart: ReportChartSpec | null;
  artifact?: ReportArtifact | null;
  renderSpec?: Record<string, unknown> | null;
  pinned?: boolean;
  position?: number;
  size?: "s" | "m" | "l";
  colSpan?: number;
  rowSpan?: number;
  rawAnswer?: string;
  toolResults?: ToolResult[];
};

export type WorkspaceSchema = {
  tables: Record<
    string,
    {
      columns: Array<{
        name: string;
        type: string;
        format?: string;
      }>;
      rowCount: number;
    }
  >;
  updatedAt: string;
};

export type DebugEntry = {
  id: string;
  label: string;
  payload: unknown;
};

export type { ExecutionTrace } from "@dude/chat-types";

export type Workspace = {
  id: string;
  name: string;
  date?: string;
  storage?: string;
  configurations?: {
    protected?: boolean;
    schema?: WorkspaceSchema;
    directDatabase?: {
      activeConnectionId?: string | null;
      connections?: Array<{
        id: string;
        name: string;
        provider: "postgres";
        schema?: string;
        ssl?: boolean;
        readonly?: boolean;
        hasConnectionString?: boolean;
        createdAt?: string;
        updatedAt?: string;
      }>;
    };
  };
};

export type IngestPreview = {
  headers: string[];
  rows: Array<Array<string>>;
};

export type ParsedFile = {
  headers: string[];
  rows: Array<Array<string>>;
};

export type WorkspaceTab = "ingestion" | "chat" | "reports" | "data";

export type DataOverviewTable = {
  name: string;
  columns: Array<{ name: string; type: string; format?: string }>;
  rowCount: number;
  preview?: SqlQueryResult;
  filteredRowCount?: number | null;
};

export type DataOverview = {
  tables: DataOverviewTable[];
};

// --- Post-import proactive analysis types ---

export type QualityScanColumn = {
  column: string;
  nullCount: number;
  emptyCount: number;
  duplicateCount: number;
  totalRows: number;
};

export type QualityScanTable = {
  table: string;
  columns: QualityScanColumn[];
  totalRows: number;
};

export type QualityScanResult = {
  tables: QualityScanTable[];
  overallScore: number; // 0-100
};

export type DetectedRelationship = {
  tableA: string;
  tableB: string;
  columnA: string;
  columnB: string;
  confidence: "high" | "medium" | "low";
};

export type ColumnStats = {
  column: string;
  type: "numeric" | "text";
  min?: number;
  max?: number;
  avg?: number;
  median?: number;
  cardinality?: number;
  totalRows: number;
};
