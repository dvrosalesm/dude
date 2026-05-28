"use client";

import { createContext, useContext, type ReactNode } from "react";

const DEFAULT_CHART_COLORS = [
  "#3b82f6",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
];

const ChartColorsContext = createContext<string[]>(DEFAULT_CHART_COLORS);

export function ChartColorsProvider({
  colors,
  children,
}: {
  colors: string[];
  children: ReactNode;
}) {
  return (
    <ChartColorsContext.Provider
      value={colors?.length ? colors : DEFAULT_CHART_COLORS}
    >
      {children}
    </ChartColorsContext.Provider>
  );
}

export function useChartColors(): string[] {
  return useContext(ChartColorsContext);
}
