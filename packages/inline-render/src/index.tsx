"use client";

import { defineRegistry } from "@json-render/react";
import { Renderer, JSONUIProvider } from "@json-render/react";
import { ChartColorsProvider } from "@dude/data-analyst-core/render/chart-colors-context";
import { dataAnalystCatalog } from "@dude/data-analyst-core/render/catalog";
import { RechartsChartRenderer } from "@dude/data-analyst-core/render/components/recharts-chart";
import { VegaLiteRenderer } from "@dude/data-analyst-core/render/components/vega-lite-renderer";
import { GeoMapRenderer } from "@dude/data-analyst-core/render/components/geo-map-renderer";
import { DataTableRenderer } from "@dude/data-analyst-core/render/components/data-table";
import { HtmlBlockRenderer } from "@dude/data-analyst-core/render/components/html-block";
import { WithQueryData } from "@dude/data-analyst-core/render/query-context";
import { DEFAULT_CHART_COLORS } from "@dude/data-analyst-core/report-utils";
import { cn } from "@dude/ui/design-system";

function buildChatRegistry(variant: "inline" | "stage") {
  const isStage = variant === "stage";
  const chartShell = isStage
    ? "min-h-[min(52vh,460px)] w-full flex-1"
    : "h-64 w-full";
  const vegaShell = isStage
    ? "min-h-[min(58vh,520px)] w-full flex-1"
    : "h-72 w-full";
  const mapShell = isStage
    ? "min-h-[min(58vh,520px)] w-full flex-1"
    : "h-72 w-full";
  const tableShell = isStage
    ? "max-h-[min(50vh,420px)] w-full overflow-auto"
    : "max-h-80 w-full overflow-auto";

  return defineRegistry(dataAnalystCatalog, {
    components: {
      ReportCard: ({ props, children }: JsonValue) => (
        <div className={isStage ? "space-y-3" : undefined}>
          {props.title && (
            <div
              className={cn(
                "font-semibold",
                isStage ? "text-lg tracking-tight" : "text-sm mb-1",
              )}
            >
              {props.title}
            </div>
          )}
          {props.summary && (
            <p
              className={cn(
                "text-muted-foreground",
                isStage ? "text-sm" : "text-xs mb-2",
              )}
            >
              {props.summary}
            </p>
          )}
          <div className={isStage ? "min-h-0 flex-1" : undefined}>{children}</div>
        </div>
      ),
      RechartsChart: ({ props }: JsonValue) => (
        <div className={chartShell}>
          <WithQueryData props={props}>
            {(resolved) => (
              <RechartsChartRenderer props={resolved as StringKeyRecord} />
            )}
          </WithQueryData>
        </div>
      ),
      VegaLiteChart: ({ props }: JsonValue) => (
        <div className={vegaShell}>
          <WithQueryData props={props}>
            {(resolved) => (
              <VegaLiteRenderer props={resolved as StringKeyRecord} />
            )}
          </WithQueryData>
        </div>
      ),
      GeoMap: ({ props }: JsonValue) => (
        <div className={mapShell}>
          <WithQueryData props={props}>
            {(resolved) => (
              <GeoMapRenderer props={resolved as StringKeyRecord} />
            )}
          </WithQueryData>
        </div>
      ),
      DataTable: ({ props }: JsonValue) => (
        <div className={tableShell}>
          <WithQueryData props={props}>
            {(resolved) => (
              <DataTableRenderer props={resolved as StringKeyRecord} />
            )}
          </WithQueryData>
        </div>
      ),
      HtmlBlock: ({ props }: JsonValue) => (
        <HtmlBlockRenderer props={props} />
      ),
    },
  } as StringKeyRecord);
}

const inlineRegistry = buildChatRegistry("inline");
const stageRegistry = buildChatRegistry("stage");

export default function InlineRenderSpec({
  spec,
  variant = "inline",
}: {
  spec: Record<string, unknown>;
  variant?: "inline" | "stage";
}) {
  const { registry } = variant === "stage" ? stageRegistry : inlineRegistry;

  return (
    <ChartColorsProvider colors={DEFAULT_CHART_COLORS}>
      <JSONUIProvider registry={registry}>
        <div
          className={cn(
            variant === "stage" &&
              "flex min-h-[min(55vh,480px)] w-full flex-col justify-center",
          )}
        >
          <Renderer spec={spec as StringKeyRecord} registry={registry} />
        </div>
      </JSONUIProvider>
    </ChartColorsProvider>
  );
}
