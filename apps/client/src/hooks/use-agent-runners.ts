import { useEffect, useState } from "react";
import type { AgentRunnerManifest } from "@dude/sdk/runner";
import {
  listAvailableAgentRunners,
  syncAgentRunnersFromApi,
} from "../runtime/agent-runners";

export function useAgentRunners(): AgentRunnerManifest[] {
  const [runners, setRunners] = useState(() => listAvailableAgentRunners());

  useEffect(() => {
    let active = true;

    void syncAgentRunnersFromApi().then(() => {
      if (active) {
        setRunners(listAvailableAgentRunners());
      }
    });

    return () => {
      active = false;
    };
  }, []);

  return runners;
}
