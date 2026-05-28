jest.mock("../apps/api/src/lib/instances/turn-store.js", () => ({
  saveChatSession: jest.fn(),
  loadChatSession: jest.fn(() => null),
  listChatSessionsForWorkspace: jest.fn(() => []),
  deleteChatSessionsForWorkspace: jest.fn(),
  recoverStaleProcessingTurns: jest.fn(() => 0),
  ensureTurnStoreSchema: jest.fn(),
}));

jest.mock("../apps/api/src/lib/gateway-client.js", () => ({
  sendMessage: jest.fn(),
  pollAgentChatStateUntilDone: jest.fn(),
}));

jest.mock("../apps/api/src/lib/instance-manager.js", () => ({
  getInstance: jest.fn(),
  setInstanceChatActive: jest.fn(),
  touchInstanceById: jest.fn(),
}));

jest.mock("../apps/api/src/lib/ui-input-store.js", () => ({
  cancelUiInputForWorkspace: jest.fn(),
  getPendingUiInput: jest.fn(() => null),
  setUiInputRequestListener: jest.fn(),
}));

import { sendMessage } from "../apps/api/src/lib/gateway-client.js";
import { getInstance } from "../apps/api/src/lib/instance-manager.js";
import { executeChatTurnAndWait } from "../apps/api/src/lib/instances/chat-turn-orchestrator.js";

const mockSendMessage = sendMessage as jest.MockedFunction<typeof sendMessage>;
const mockGetInstance = getInstance as jest.MockedFunction<typeof getInstance>;

describe("executeChatTurnAndWait", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetInstance.mockReturnValue({
      id: "ws-1",
      specialistId: "data-analyst",
      organizationId: "org-1",
      runner: "pi",
      gatewayPort: 8080,
      gatewayHost: "127.0.0.1",
      status: "running",
      lastActivity: new Date().toISOString(),
    });
    mockSendMessage.mockResolvedValue({
      response: {
        type: "final",
        steps: [],
        answer: "Done",
      },
      usage: {
        inputTokens: 1,
        outputTokens: 2,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        totalCost: 0,
        model: "test",
      },
      rawContent: "Done",
    });
  });

  it("uses the shared gateway turn path and returns the final result", async () => {
    const turn = await executeChatTurnAndWait("ws-1", {
      message: "Analyze sales",
    });

    expect(mockSendMessage).toHaveBeenCalledWith(
      "127.0.0.1",
      8080,
      { message: "Analyze sales", history: undefined, images: undefined },
      expect.any(Function),
    );
    expect(turn.result.response.answer).toBe("Done");
    expect(turn.messages.at(-1)?.role).toBe("assistant");
    expect(turn.messages.at(-1)?.status).toBe("completed");
  });
});
