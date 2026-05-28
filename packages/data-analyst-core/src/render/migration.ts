/**
 * Migration utility: converts old ReportItem format (with chart/artifact fields)
 * to json-render flat spec format.
 *
 * Non-destructive: old fields are preserved, `renderSpec` is added.
 */

import type {
  ReportArtifact,
  ReportChartSpec,
  ReportItem,
} from "@dude/data-analyst-core/workspace-types";

type FlatSpec = {
  root: string;
  elements: Record<string, { type: string; props: Record<string, unknown>; children?: string[] }>;
};

function chartToSpec(chart: ReportChartSpec, title?: string, summary?: string): FlatSpec {
  return {
    root: "card-1",
    elements: {
      "card-1": {
        type: "ReportCard",
        props: { title: title || "", summary },
        children: ["viz-1"],
      },
      "viz-1": {
        type: "RechartsChart",
        props: {
          chartType: chart.type,
          data: chart.data,
          xKey: chart.xKey,
          yKey: chart.yKey,
          series: chart.series,
        },
      },
    },
  };
}

function vegaLiteArtifactToSpec(
  spec: Record<string, unknown>,
  title?: string,
  summary?: string,
): FlatSpec {
  return {
    root: "card-1",
    elements: {
      "card-1": {
        type: "ReportCard",
        props: { title: title || "", summary },
        children: ["viz-1"],
      },
      "viz-1": {
        type: "VegaLiteChart",
        props: { spec },
      },
    },
  };
}

function htmlArtifactToSpec(
  content: string,
  title?: string,
  summary?: string,
): FlatSpec {
  return {
    root: "card-1",
    elements: {
      "card-1": {
        type: "ReportCard",
        props: { title: title || "", summary },
        children: ["viz-1"],
      },
      "viz-1": {
        type: "HtmlBlock",
        props: { content },
      },
    },
  };
}

function buildSpecFromLegacy(
  report: ReportItem,
): FlatSpec | null {
  const { chart, artifact, title, summary } = report;

  // Prefer artifact over chart
  if (artifact) {
    if (artifact.type === "vegaLite" && artifact.spec) {
      return vegaLiteArtifactToSpec(artifact.spec, title, summary);
    }
    if (artifact.type === "html" && artifact.content) {
      return htmlArtifactToSpec(artifact.content, title, summary);
    }
  }

  if (chart) {
    return chartToSpec(chart, title, summary);
  }

  return null;
}

/** Infer appropriate sizing based on visualization type. */
function inferSpan(spec: FlatSpec): { colSpan?: number; rowSpan?: number } {
  const types = Object.values(spec.elements).map((el) => el.type);
  if (types.includes("GeoMap") || types.includes("VegaLiteChart")) {
    return { colSpan: 2, rowSpan: 3 };
  }
  if (types.includes("DataTable")) {
    return { colSpan: 2, rowSpan: 3 };
  }
  if (types.includes("HtmlBlock")) {
    return { colSpan: 2, rowSpan: 2 };
  }
  return {};
}

/**
 * Migrate a single report: if it has no `renderSpec` but has legacy
 * `chart` or `artifact` fields, generate a `renderSpec`.
 * Also adjusts rowSpan if it's too small for the visualization type.
 */
export function migrateReport(report: ReportItem): ReportItem {
  // Already has a render spec
  if (report.renderSpec) return report;

  const spec = buildSpecFromLegacy(report);
  if (!spec) return report;

  const spanFix = inferSpan(spec);
  const needsRowFix =
    spanFix.rowSpan && (!report.rowSpan || report.rowSpan < spanFix.rowSpan);

  return {
    ...report,
    renderSpec: spec as unknown as Record<string, unknown>,
    ...(needsRowFix ? { rowSpan: spanFix.rowSpan } : {}),
  };
}

/**
 * Migrate an array of reports on load.
 */
export function migrateReports(reports: ReportItem[]): ReportItem[] {
  return reports.map(migrateReport);
}
