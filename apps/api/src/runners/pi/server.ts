/**
 * Pi runner adapter — Pi SDK loop + shared adapter-http surface.
 */

import { startAdapterServer } from "../../lib/runners/adapter-http.js";
import { runPiAgentTurnQueued } from "../../lib/runners/pi-agent-turn.js";
import { config } from "@dude/sdk/gateway-runtime";
import { executeSql } from "@dude/specialist-data-analyst/gateway/sql";

const port = parseInt(process.env.GATEWAY_PORT || "8080", 10);

startAdapterServer({
  runnerId: "pi",
  port,
  modelLabel: `${config.modelProvider}/${config.modelId}`,
  onQuery: (query) => executeSql(query),
  async onChat({ message, history, images, sendEvent }) {
    return runPiAgentTurnQueued({ message, history, images, sendEvent });
  },
});
