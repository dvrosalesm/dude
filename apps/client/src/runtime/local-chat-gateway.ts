"use client";

export {
  isDesktopApp,
  hasDesktopGateway,
  canUseGateway,
  gatewayRequest,
  appendMessagePair,
  appendUserMessageToThread,
  gatewaySubagentId,
  gatewayWorkspaceId,
} from "./gateway-desktop";
export { buildGatewayConfig } from "./gateway-prompts";
export {
  respondGatewayUiInput,
  sendGatewayMessage,
  createSuggestions,
  fetchProjectHubSnapshot,
} from "./gateway-chat";
export {
  syncGatewayMessagesToLocalThread,
  resumeGatewayTurnIfNeeded,
  subscribeGatewayTurn,
  getInflightGatewayTurn,
  abandonGatewayTurn,
} from "./gateway-pending-turns";
