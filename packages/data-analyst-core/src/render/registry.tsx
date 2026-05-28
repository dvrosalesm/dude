"use client";

import { defineRegistry } from "@json-render/react";
import { dataAnalystCatalog } from "./catalog";
import { RechartsChartRenderer } from "./components/recharts-chart";
import { VegaLiteRenderer } from "./components/vega-lite-renderer";
import { GeoMapRenderer } from "./components/geo-map-renderer";
import { DataTableRenderer } from "./components/data-table";
import { HtmlBlockRenderer } from "./components/html-block";
import { WithQueryData } from "./query-context";

export const { registry } = defineRegistry(dataAnalystCatalog, {
  components: {
    ReportCard: ({ props, children } : JsonValue) => (
      <div className="flex h-full flex-col">
        {props.title && (
          <div className="text-sm font-semibold mb-1">{props.title}</div>
        )}
        {props.summary && (
          <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
            {props.summary}
          </p>
        )}
        <div className="flex-1 min-h-0">{children}</div>
      </div>
    ),
    RechartsChart: ({ props } : JsonValue) => (
      <WithQueryData props={props}>
        {(resolved) => <RechartsChartRenderer props={resolved as StringKeyRecord} />}
      </WithQueryData>
    ),
    VegaLiteChart: ({ props } : JsonValue) => (
      <WithQueryData props={props}>
        {(resolved) => <VegaLiteRenderer props={resolved as StringKeyRecord} />}
      </WithQueryData>
    ),
    GeoMap: ({ props } : JsonValue) => (
      <WithQueryData props={props}>
        {(resolved) => <GeoMapRenderer props={resolved as StringKeyRecord} />}
      </WithQueryData>
    ),
    DataTable: ({ props } : JsonValue) => (
      <WithQueryData props={props}>
        {(resolved) => <DataTableRenderer props={resolved as StringKeyRecord} />}
      </WithQueryData>
    ),
    HtmlBlock: ({ props } : JsonValue) => <HtmlBlockRenderer props={props} />,
  },
} as StringKeyRecord);
