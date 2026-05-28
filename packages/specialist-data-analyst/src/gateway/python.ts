import { Type } from "@sinclair/typebox";
import { execFileSync } from "node:child_process";
import { config } from "@dude/sdk/gateway-runtime";
import type { ToolDefinition } from "@dude/sdk/gateway";
import { toolText } from "@dude/sdk/gateway-runtime";

/** Minimal env for Python subprocesses — no secrets. */
const PYTHON_ENV: Record<string, string> = {
  PATH: process.env.PATH || "/usr/local/bin:/usr/bin:/bin",
  HOME: process.env.HOME || "/root",
  LANG: process.env.LANG || "C.UTF-8",
};

export function executePython(
  code: string,
  input?: Record<string, unknown>,
): Record<string, unknown> {
  const payload = JSON.stringify({
    code,
    db_path: config.dbPath,
    input: input || {},
  });

  try {
    const stdout = execFileSync("python3", ["/app/python/runner.py"], {
      input: payload,
      timeout: 60_000,
      maxBuffer: 10 * 1024 * 1024,
      encoding: "utf-8",
      env: PYTHON_ENV,
    });
    return JSON.parse(stdout);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return { error: msg };
  }
}

export function createPythonTool(): ToolDefinition {
  return {
    name: "python",
    label: "Python Code",
    description:
      "Execute Python code in the local sandbox. " +
      "Pre-imported: pandas (pd), numpy (np), scipy, sklearn, statsmodels. " +
      "Available: sql(query), sql_execute(query), run_prediction(data, model, **opts), " +
      "auto_select_model(data, forecast_steps), interpolate, cluster, detect_anomalies, " +
      "correlation_matrix, moving_average, arima_forecast, auto_arima_forecast. " +
      "Assign results to `result` variable. Max code length 8000 chars.",
    parameters: Type.Object({
      code: Type.String({
        description: "Python code to execute. Assign output to `result`.",
      }),
      input: Type.Optional(
        Type.Record(Type.String(), Type.Unknown(), {
          description: "Optional dict available as `input` variable",
        }),
      ),
    }),
    execute: async (_toolCallId, params) => {
      return toolText(executePython(params.code, params.input));
    },
  };
}
