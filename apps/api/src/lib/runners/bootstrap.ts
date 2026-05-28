import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import runnerHost from "../../../../../runners.config.js";
import {
  createServerRunnerFromRegistration,
  registerServerRunner,
} from "./index.js";

const repoRoot = resolve(
  fileURLToPath(new URL("../../../../../", import.meta.url)),
);

function resolveRunnerEntry(serverEntry: string): string {
  return resolve(repoRoot, serverEntry);
}

export function loadCustomRunners(): void {
  for (const registration of runnerHost.runners ?? []) {
    registerServerRunner(
      createServerRunnerFromRegistration(registration, resolveRunnerEntry),
      registration.manifest,
    );
  }
}
