import { useCallback, useEffect, useState } from "react";
import { useSubagentChat } from "@dude/chat/subagents/hooks/use-subagent-chat";
import { browserChatRuntime, SUBAGENTS } from "../../local-chat-runtime";
import type { SubagentId } from "../../types";
import { toSubagentMessage } from "./chat-message-utils";
import type { SubagentMessage } from "@dude/chat/subagents/types";

export function useLocalSubagentChat({
  subagentId,
  workspaceId,
  assistantName,
}: {
  subagentId: SubagentId;
  workspaceId?: string;
  assistantName?: string;
}) {
  const [messages, setMessages] = useState<SubagentMessage[]>([]);
  const [messagesLoaded, setMessagesLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;
    browserChatRuntime
      .listMessages(subagentId, workspaceId)
      .then((nextMessages) => {
        if (mounted) {
          setMessages(nextMessages.map(toSubagentMessage));
          setMessagesLoaded(true);
        }
      });
    return () => {
      mounted = false;
    };
  }, [subagentId, workspaceId]);

  const sendTurn = useCallback<
    NonNullable<Parameters<typeof useSubagentChat>[0]["sendTurn"]>
  >(
    async (input) => {
      const result = await browserChatRuntime.sendMessage({
        subagentId,
        workspaceId,
        content: input.content,
        history: input.history,
        images: input.imageUrls,
        files: input.files,
        onProgress: input.onProgress,
      });
      return {
        answer: result.assistantMessage.content,
        suggestions: result.assistantMessage.suggestions,
        executionTrace: result.assistantMessage.executionTrace,
        images: result.assistantMessage.images?.map((url) => ({ url })),
        messages: [
          toSubagentMessage(result.userMessage),
          toSubagentMessage(result.assistantMessage),
        ],
      };
    },
    [subagentId, workspaceId],
  );

  const chat = useSubagentChat({
    subagentId,
    workspaceId,
    messages,
    setMessages,
    messagesLoaded,
    sendTurn,
    enableStop: false,
    wakingUpLabel: `${assistantName ?? "Dude"} is getting ready...`,
    placeholder:
      subagentId === "main-assistant"
        ? "write here"
        : `Message ${SUBAGENTS.find((item) => item.id === subagentId)?.name ?? "subagent"}`,
    clearThread: async () => {
      const nextMessages = await browserChatRuntime.clearThread(
        subagentId,
        workspaceId,
      );
      return nextMessages.map(toSubagentMessage);
    },
    respondUiInputTurn: async ({ workspaceId: wsId, requestId, response }) => {
      await browserChatRuntime.respondUiInput(wsId, requestId, response);
    },
    onPinMessage: (messageId, pinned) => {
      setMessages((current) =>
        current.map((message) =>
          message.id === messageId ? { ...message, pinned } : message,
        ),
      );
    },
  });

  return {
    chatProps: chat.chatProps,
    messages: chat.messages,
    setMessages: chat.setMessages,
    clear: chat.handleClearChat,
  };
}
