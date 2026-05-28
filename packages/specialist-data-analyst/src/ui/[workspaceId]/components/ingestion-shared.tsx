"use client";

import { ALL_STEPS, type IngestStep } from "../hooks/use-data-ingestion";
import type { IngestSourceKind } from "../utils";

export function stepIndex(step: IngestStep) {
  return ALL_STEPS.indexOf(step);
}

export function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(
    units.length - 1,
    Math.floor(Math.log(bytes) / Math.log(1024)),
  );
  const value = bytes / Math.pow(1024, exponent);
  return `${value.toFixed(value < 10 && exponent > 0 ? 2 : 0)} ${units[exponent]}`;
}

export function sourceExtension(source: IngestSourceKind) {
  return source === "csv" ? ".csv" : ".xlsx";
}
