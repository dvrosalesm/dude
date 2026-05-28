import { defineCatalog } from "@json-render/core";
import { schema } from "@json-render/react";
import { z } from "zod";

export const dataAnalystCatalog = defineCatalog(schema, {
  components: {
    ReportCard: {
      props: z.object({
        title: z.string(),
        summary: z.string().optional(),
      }),
      slots: ["default"],
      description:
        "Root wrapper card for a report. Always use as the root element with one visualization child.",
    },
    RechartsChart: {
      props: z.object({
        chartType: z.enum(["bar", "line", "area", "pie"]),
        data: z.array(z.record(z.unknown())),
        xKey: z.string(),
        yKey: z.string(),
        series: z
          .array(
            z.object({
              key: z.string(),
              label: z.string().optional(),
            }),
          )
          .optional(),
      }),
      description:
        "Standard chart via recharts. Use for bar, line, area, and pie charts.",
    },
    VegaLiteChart: {
      props: z.object({
        spec: z.record(z.unknown()),
      }),
      description:
        "Advanced visualization via Vega-Lite v5 JSON spec. Use for scatter, heatmap, boxplot, trellis, layered charts, and any chart type not covered by RechartsChart.",
    },
    GeoMap: {
      props: z.object({
        mapLevel: z.enum(["world", "adm1", "adm2"]),
        countryIso: z.string().optional(),
        data: z.array(
          z.object({
            location: z.string(),
            value: z.number(),
          }),
        ),
        valueLabel: z.string().optional(),
        locationLabel: z.string().optional(),
        colorScheme: z.string().optional(),
        colors: z.array(z.string()).optional(),
      }),
      description:
        'Geographic choropleth map. Use mapLevel="world" for country-level maps. Use mapLevel="adm1" or "adm2" for subnational maps (requires countryIso as 3-letter ISO code). Data is an array of {location, value} pairs. Use colors for custom gradients.',
    },
    DataTable: {
      props: z.object({
        columns: z.array(
          z.object({
            key: z.string(),
            label: z.string().optional(),
            align: z.enum(["left", "center", "right"]).optional(),
          }),
        ),
        data: z.array(z.record(z.unknown())),
        striped: z.boolean().optional(),
      }),
      description:
        "Tabular data display with sortable columns. Use for rankings, listings, top-N items, detailed breakdowns, or any data best shown in rows and columns.",
    },
    HtmlBlock: {
      props: z.object({
        content: z.string(),
      }),
      description:
        "Bespoke visual design rendered as sanitized HTML/CSS/SVG in a sandboxed iframe. No script tags or remote resources allowed.",
    },
  },
});

// Re-export for backwards compatibility (client code can keep importing from here)
export { buildReportSystemPrompt } from "./catalog-prompt";
