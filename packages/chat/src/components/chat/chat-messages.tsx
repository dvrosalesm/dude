"use client";

import { useEffect, useRef } from "react";
import type { UIMessage } from "ai";
import { AlertCircle } from "lucide-react";
import { BrailleSpinner } from "@dude/ui/components/braille-spinner";
import { ChatMessage } from "./chat-message";

interface ChatMessagesProps {
  messages: UIMessage[];
  status: string;
  isLoading?: boolean;
  modelName?: string;
  errorMessage?: string | null;
  /** See ChatMessage.operatorView */
  operatorView?: boolean;
}

export function ChatMessages({ messages, status, isLoading, modelName, errorMessage, operatorView }: ChatMessagesProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  const isStreaming = status === "streaming";

  return (
    <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 md:px-6" ref={scrollAreaRef}>
      <div className="flex flex-col gap-3 py-4">
        {messages.map((message, index) => {
          const isLastAssistant =
            message.role === "assistant" &&
            index === messages.length - 1;

          return (
            <ChatMessage
              key={message.id}
              message={message}
              isStreaming={isLastAssistant && isStreaming}
              modelName={modelName}
              operatorView={operatorView}
            />
          );
        })}
        {isLoading && status === "submitted" && (
          <div className="flex justify-start">
            <div
              className="bg-muted rounded-2xl rounded-bl-md px-4 py-3"
              role="status"
              aria-label="Typing"
            >
              <BrailleSpinner className="text-sm text-muted-foreground" />
            </div>
          </div>
        )}
        {errorMessage && (
          <div className="flex justify-start">
            <div className="flex items-start gap-2 bg-destructive/10 text-destructive border border-destructive/20 rounded-2xl rounded-bl-md px-4 py-3 max-w-[80%]">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span className="text-sm">{errorMessage}</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
