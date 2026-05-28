import type { ReportItem, ReportChartSpec, ReportArtifact, ToolResult } from "./types";
import { extractJsonSnippet, isNumericColumn, isDateColumn } from "@dude/data-analyst-core/render/utils";

export const DEFAULT_CHART_COLORS = [
  "#3b82f6",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
];

/** Parse the AI answer and return a json-render spec or fall back to legacy format. */
export function parseReportAnswer(answer: string): {
  title?: string;
  summary?: string;
  renderSpec: Record<string, unknown> | null;
  chart: ReportChartSpec | null;
  artifact: ReportArtifact | null;
} | null {
  const parsed = extractJsonSnippet(answer);
  if (!parsed || typeof parsed !== "object") return null;

  // New json-render spec format: has root + elements
  if (typeof parsed.root === "string" && parsed.elements && typeof parsed.elements === "object") {
    const elements = parsed.elements as StringKeyRecord;
    const rootEl = elements[parsed.root as string];
    const title = rootEl?.props?.title ?? undefined;
    const summary = rootEl?.props?.summary ?? undefined;
    return { title, summary, renderSpec: parsed, chart: null, artifact: null };
  }

  // Legacy format fallback: { title, summary, chart?, artifact? }
  const title = typeof parsed.title === "string" ? parsed.title : undefined;
  const summary =
    typeof parsed.summary === "string" ? parsed.summary : undefined;

  // Try to normalize legacy chart
  const rawChart = (parsed as StringKeyRecord).chart;
  let chart: ReportChartSpec | null = null;
  if (rawChart && typeof rawChart === "object") {
    const type = rawChart.type;
    if (
      (type === "bar" || type === "line" || type === "area" || type === "pie") &&
      Array.isArray(rawChart.data) &&
      typeof rawChart.xKey === "string" &&
      typeof rawChart.yKey === "string"
    ) {
      chart = {
        type,
        data: rawChart.data,
        xKey: rawChart.xKey,
        yKey: rawChart.yKey,
        series: Array.isArray(rawChart.series) ? rawChart.series : undefined,
      };
    }
  }

  // Try to normalize legacy artifact
  const rawArtifact = (parsed as StringKeyRecord).artifact;
  let artifact: ReportArtifact | null = null;
  if (rawArtifact?.type === "html" && typeof rawArtifact.content === "string") {
    artifact = { type: "html", content: rawArtifact.content };
  } else if (rawArtifact?.type === "vegaLite" && rawArtifact.spec) {
    artifact = { type: "vegaLite", spec: rawArtifact.spec };
  }

  return { title, summary, renderSpec: null, chart, artifact };
}

/** Infer col/row span from the visualization types inside a renderSpec. */
export function inferReportSpan(
  spec: Record<string, unknown> | null,
): { colSpan: number; rowSpan: number } {
  const defaultSpan = { colSpan: 2, rowSpan: 2 };
  if (!spec || typeof spec !== "object") return defaultSpan;
  const elements = spec.elements as
    | Record<string, { type?: string }>
    | undefined;
  if (!elements) return defaultSpan;
  const types = Object.values(elements).map((el) => el?.type);
  if (types.includes("GeoMap") || types.includes("VegaLiteChart")) {
    return { colSpan: 2, rowSpan: 3 };
  }
  if (types.includes("DataTable")) {
    return { colSpan: 2, rowSpan: 3 };
  }
  if (types.includes("HtmlBlock")) {
    return { colSpan: 2, rowSpan: 2 };
  }
  return defaultSpan;
}

/**
 * Detect if the user prompt is asking for a geographic map.
 * Returns the detected map level and country ISO if possible.
 */
export function detectMapIntent(prompt: string): {
  isMap: boolean;
  mapLevel: "world" | "adm1" | "adm2";
  countryIso?: string;
} | null {
  const text = prompt.toLowerCase();
  const isMap = /\b(mapa|map|choropleth|geograf|geo\b|cartograma|distribución\s+(por|de)\s+(departamento|estado|provincia|region|región|municipio|país|pais))/i.test(text);
  if (!isMap) return null;

  // Detect subnational intent
  const isSubnational = /\b(departamento|departamentos|depto|deptos|provincia|provincias|state|states|estado|estados|region|regiones|región|county|district|municipio|prefecture|governorate|oblast|canton|adm1|subnational)\b/i.test(text);
  const isAdm2 = /\b(municipio|municipios|county|counties|district|districts|adm2)\b/i.test(text);

  // Try to resolve country ISO from prompt
  const countryMap: Record<string, string> = {
    guatemala: "GTM", mexico: "MEX", méxico: "MEX", colombia: "COL",
    peru: "PER", perú: "PER", argentina: "ARG", chile: "CHL",
    brazil: "BRA", brasil: "BRA", ecuador: "ECU", bolivia: "BOL",
    honduras: "HND", "el salvador": "SLV", "costa rica": "CRI",
    panama: "PAN", panamá: "PAN", nicaragua: "NIC", paraguay: "PRY",
    uruguay: "URY", venezuela: "VEN", "dominican republic": "DOM",
    "republica dominicana": "DOM", "república dominicana": "DOM",
    "united states": "USA", "estados unidos": "USA", spain: "ESP",
    españa: "ESP",
  };

  let countryIso: string | undefined;
  // Check for explicit 3-letter ISO
  const explicitIso = text.match(/\b([A-Z]{3})\b/i);
  if (explicitIso) {
    countryIso = explicitIso[1].toUpperCase();
  }
  // Check for country names
  if (!countryIso) {
    for (const [name, iso] of Object.entries(countryMap)) {
      if (text.includes(name)) {
        countryIso = iso;
        break;
      }
    }
  }

  const mapLevel = isAdm2 ? "adm2" : isSubnational ? "adm1" : countryIso ? "adm1" : "world";
  return { isMap: true, mapLevel, countryIso };
}

/**
 * If the user asked for a map but the AI returned a non-GeoMap spec (e.g. bar chart),
 * convert the data to a GeoMap spec.
 */
export function enforceGeoMapIfNeeded(
  prompt: string,
  renderSpec: Record<string, unknown> | null,
): Record<string, unknown> | null {
  if (!renderSpec) return renderSpec;
  const elements = renderSpec.elements as StringKeyRecord | undefined;
  if (!elements) return renderSpec;

  // Check if it already contains a GeoMap
  const types = Object.values(elements).map((el) => el?.type);
  if (types.includes("GeoMap")) return renderSpec;

  // Check if the prompt is asking for a map
  const mapIntent = detectMapIntent(prompt);
  if (!mapIntent) return renderSpec;

  // Find the data from whatever chart the AI generated
  const vizEl = Object.values(elements).find(
    (el) => el?.type === "RechartsChart" || el?.type === "VegaLiteChart",
  );
  if (!vizEl?.props) return renderSpec;

  // Try to extract location/value data from RechartsChart props
  let geoData: Array<{ location: string; value: number }> | null = null;
  let valueLabel: string | undefined;
  let locationLabel: string | undefined;

  if (vizEl.type === "RechartsChart" && Array.isArray(vizEl.props.data)) {
    const { data, xKey, yKey } = vizEl.props;
    geoData = data
      .filter((row: JsonValue) => row[xKey] != null && row[yKey] != null)
      .map((row: JsonValue) => ({
        location: String(row[xKey]),
        value: Number(row[yKey]),
      }))
      .filter((row: { location: string; value: number }) => !isNaN(row.value));
    locationLabel = xKey;
    valueLabel = yKey;
  }

  if (!geoData?.length) return renderSpec;

  // Build a GeoMap spec to replace the chart
  const vizKey = Object.keys(elements).find(
    (k) => elements[k]?.type === "RechartsChart" || elements[k]?.type === "VegaLiteChart",
  );
  if (!vizKey) return renderSpec;

  return {
    ...renderSpec,
    elements: {
      ...elements,
      [vizKey]: {
        type: "GeoMap",
        props: {
          mapLevel: mapIntent.mapLevel,
          countryIso: mapIntent.countryIso,
          data: geoData,
          valueLabel: valueLabel ?? "Cantidad",
          locationLabel: locationLabel ?? (mapIntent.mapLevel === "world" ? "País" : "Región"),
          colorScheme: "blues",
        },
      },
    },
  };
}

/** Fallback: infer a chart spec from SQL tool results. Returns a renderSpec. */
export function buildFallbackRenderSpec(
  toolResults?: ToolResult[],
): Record<string, unknown> | null {
  const sqlResult = toolResults?.find(
    (result) => result.tool === "sql" && "result" in result,
  ) as Extract<ToolResult, { tool: "sql" }> | undefined;
  if (!sqlResult?.result) return null;
  const { columns, rows } = sqlResult.result;
  if (!rows?.length || !columns?.length) return null;
  const numericCols = columns.filter((column) =>
    isNumericColumn(column, rows),
  );
  if (!numericCols.length) return null;
  const nonNumericCols = columns.filter(
    (column) => !numericCols.includes(column),
  );
  const yKey = numericCols[0] ?? null;
  if (!yKey) return null;
  const data = rows.map((row) => ({ ...row }));
  let resolvedXKey = nonNumericCols[0] ?? null;
  let resolvedData = data;
  if (!resolvedXKey) {
    resolvedXKey = "index";
    resolvedData = data.map((row, index) => ({ ...row, index: index + 1 }));
  }
  let chartType: "bar" | "line" | "area" | "pie" = "bar";
  if (resolvedXKey && isDateColumn(resolvedXKey, resolvedData)) {
    chartType = "line";
  }
  if (nonNumericCols.length === 1 && numericCols.length === 1) {
    chartType = "pie";
  }
  const series =
    numericCols.length > 1
      ? numericCols.map((column) => ({ key: column }))
      : undefined;

  return {
    root: "card-1",
    elements: {
      "card-1": {
        type: "ReportCard",
        props: { title: "" },
        children: ["viz-1"],
      },
      "viz-1": {
        type: "RechartsChart",
        props: {
          chartType,
          data: resolvedData,
          xKey: resolvedXKey,
          yKey,
          series,
        },
      },
    },
  };
}

export function buildReportTitle(prompt: string, fallbackTitle: string) {
  const trimmed = prompt.replace(/\s+/g, " ").trim();
  if (!trimmed) return fallbackTitle;
  if (trimmed.length <= 56) return trimmed;
  return `${trimmed.slice(0, 56)}...`;
}

export function buildReportContext(report: ReportItem) {
  return {
    id: report.id,
    title: report.title,
    prompt: report.prompt,
    summary: report.summary,
    renderSpec: report.renderSpec,
    chart: report.chart,
    artifact: report.artifact,
    toolResults: report.toolResults,
    createdAt: report.createdAt,
  };
}

export function buildReportHistorySnapshot(
  systemPrompt: string,
  targetReport?: ReportItem | null,
) {
  const history = [{ role: "system", message: systemPrompt }];
  if (targetReport) {
    history.push({
      role: "system",
      message: `Report context: ${JSON.stringify(
        buildReportContext(targetReport),
      )}`,
    });
  }
  return history;
}

export function buildReportSlug(label: string) {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .trim();
}

export function resolveReportTarget(
  prompt: string,
  reports: ReportItem[],
  defaultSlugBase: string,
) {
  const trimmed = prompt.trim();
  if (!trimmed.startsWith("@")) {
    return { reportId: null, cleanedPrompt: trimmed };
  }
  const mentionMatch = trimmed.match(/^@([^\s]+)/);
  if (!mentionMatch) {
    return { reportId: null, cleanedPrompt: trimmed };
  }
  const mentionSlug = mentionMatch[1].toLowerCase();
  const matchingReport = reports.find((report) => {
    const slugBase =
      report.title ||
      report.prompt ||
      defaultSlugBase;
    return buildReportSlug(slugBase) === mentionSlug;
  });
  if (!matchingReport) {
    return { reportId: null, cleanedPrompt: trimmed };
  }
  const cleanedPrompt = trimmed
    .replace(new RegExp(`^@${mentionMatch[1]}\\b\\s*`, "i"), "")
    .trim();
  return { reportId: matchingReport.id, cleanedPrompt };
}
