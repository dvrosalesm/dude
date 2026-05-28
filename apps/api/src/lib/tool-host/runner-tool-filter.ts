import { isNativeRunner } from "@dude/sdk/runner";

export {
  HOSTED_LLM_TOOL_NAMES,
  filterToolsForRunner,
  isNativeRunner,
} from "@dude/sdk/runner";

export function isNativeRunnerEnv(): boolean {
  return isNativeRunner(process.env.RUNNER_ID);
}
