"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useChartColors } from "../chart-colors-context";

type RechartsChartProps = {
  chartType: "bar" | "line" | "area" | "pie";
  data: Array<Record<string, unknown>>;
  xKey: string;
  yKey: string;
  series?: Array<{ key: string; label?: string }>;
};

export function RechartsChartRenderer({ props }: { props: RechartsChartProps }) {
  const palette = useChartColors();
  const { chartType, data, xKey, yKey, series: seriesProp } = props;

  const series = seriesProp?.length
    ? seriesProp
    : [{ key: yKey, label: yKey }];

  const axisTickStyle = { fontSize: 11, fill: "currentColor" } as const;

  if (chartType === "pie") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey={yKey}
            nameKey={xKey}
            outerRadius="70%"
            innerRadius="40%"
            label
          >
            {data.map((_, index) => (
              <Cell
                key={`cell-${index}`}
                fill={palette[index % palette.length]}
              />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  const ChartComponent =
    chartType === "line"
      ? LineChart
      : chartType === "area"
        ? AreaChart
        : BarChart;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ChartComponent
        data={data}
        margin={{ top: 8, right: 8, bottom: 24, left: 8 }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey={xKey}
          tick={axisTickStyle}
          minTickGap={16}
          interval="preserveStartEnd"
        />
        <YAxis tick={axisTickStyle} width={40} />
        <Tooltip />
        <Legend />
        {chartType === "line" &&
          series.map((item, index) => (
            <Line
              key={item.key}
              type="monotone"
              dataKey={item.key}
              name={item.label || item.key}
              stroke={palette[index % palette.length]}
            />
          ))}
        {chartType === "area" &&
          series.map((item, index) => (
            <Area
              key={item.key}
              type="monotone"
              dataKey={item.key}
              name={item.label || item.key}
              stroke={palette[index % palette.length]}
              fill={palette[index % palette.length]}
              fillOpacity={0.2}
            />
          ))}
        {chartType === "bar" &&
          series.map((item, index) => (
            <Bar
              key={item.key}
              dataKey={item.key}
              name={item.label || item.key}
              fill={palette[index % palette.length]}
            />
          ))}
      </ChartComponent>
    </ResponsiveContainer>
  );
}
