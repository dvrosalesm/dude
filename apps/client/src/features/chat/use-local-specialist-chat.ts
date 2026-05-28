import { useCallback, useEffect, useState } from "react";
import { useSpecialistChat } from "@dude/chat/specialists/hooks/use-specialist-chat";
import { browserChatRuntime, SPECIALISTS } from "../../local-chat-runtime";
import type { SpecialistId } from "../../types";
import { toSpecialistMessage } from "./chat-message-utils";
import type { SpecialistMessage } from "@dude/chat/specialists/types";

export function useLocalSpecialistChat({
  specialistId,
  workspaceId,
  assistantName,
}: {
  specialistId: SpecialistId;
  workspaceId?: string;
  assistantName?: string;
}) {
  const [messages, setMessages] = useState<SpecialistMessage[]>([]);
  const [messagesLoaded, setMessagesLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;
    browserChatRuntime
      .listMessages(specialistId, workspaceId)
      .then((nextMessages) => {
        if (mounted) {
          setMessages(nextMessages.map(toSpecialistMessage));
          setMessagesLoaded(true);
        }
      });
    return () => {
      mounted = false;
    };
  }, [specialistId, workspaceId]);

  const sendTurn = useCallback<
    NonNullable<Parameters<typeof useSpecialistChat>[0]["sendTurn"]>
  >(
    async (input) => {
      const result = await browserChatRuntime.sendMessage({
        specialistId,
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
        messages: [
          toSpecialistMessage(result.userMessage),
          toSpecialistMessage(result.assistantMessage),
        ],
      };
    },
    [specialistId, workspaceId],
  );

  const chat = useSpecialistChat({
    specialistId,
    workspaceId,
    messages,
    setMessages,
    messagesLoaded,
    sendTurn,
    enableStop: false,
    wakingUpLabel: `${assistantName ?? "Dude"} is getting ready...`,
    placeholder:
      specialistId === "main-assistant"
        ? "write here"
        : `Message ${SPECIALISTS.find((item) => item.id === specialistId)?.name ?? "specialist"}`,
    clearThread: async () => {
      const nextMessages = await browserChatRuntime.clearThread(
        specialistId,
        workspaceId,
      );
      return nextMessages.map(toSpecialistMessage);
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
