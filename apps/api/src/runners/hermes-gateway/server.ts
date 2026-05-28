/**
 * Hermes runner adapter — Tool Host catalog + OpenRouter ReAct loop.
 * Uses the same specialist tools as Pi via HTTP.
 */

import { startAdapterServer } from "../../lib/runners/adapter-http.js";
import { createToolHostChatHandler } from "../../lib/runners/tool-host-chat-handler.js";

const port = parseInt(process.env.GATEWAY_PORT || "8080", 10);

startAdapterServer({
  runnerId: "hermes",
  port,
  modelLabel: process.env.MODEL_ID || "hermes",
  onChat: createToolHostChatHandler("hermes"),
});
