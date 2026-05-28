"use client";

import Link from "@dude/app-navigation/link";
import {
  chatAssistantBubbleClassName,
  chatAttachmentPillClassName,
  chatPillClassName,
  chatUserBubbleClassName,
  chatWorkspaceEarlierTurnClassName,
  chatWorkspacePromptClassName,
  chatWorkspaceResponseClassName,
  cn,
} from "@dude/ui/design-system";
import {
  BookmarkPlus,
  ChevronDown,
  ChevronRight,
  FileText,
  MousePointerClick,
  Pin,
  RotateCcw,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { BrailleSpinner } from "@dude/ui/components/braille-spinner";
import { ChatMarkdown } from "../../components/chat/chat-markdown";
import {
  SUBAGENT_META,
  extractImageUrl,
  extractSubagentAnswer,
  isSubagentCall,
  parseActionSuggestion,
} from "../subagent-meta";
import { SubagentMessageBubble } from "../subagent-message-bubble";
import {
  groupMessageTurns,
  turnPreviewText,
  type MessageTurn,
} from "../main-assistant-workspace";
import { UiInputPrompt, type UiInputPromptRequest } from "../ui-input-prompt";
import { lazy, Suspense, useEffect, useState } from "react";
import type { ExecutionTrace, SubagentMessage } from "../types";
import { InlineTrace } from "./inline-trace";
import {
  AttachedFilePill,
  attachmentIndexLabel,
  attachmentLabel,
  formatMessageContent,
  isImageAttachment,
  tryExtractRenderSpec,
} from "./helpers";
import { collectGeneratedImageUrls } from "../collect-message-images";
import { GeneratedImageGallery } from "../generated-image-card";
import { ChatImageThumb } from "./message-previews";

const InlineRenderSpec = lazy(() => import("../inline-render-spec"));

export function MessagesList({
  messages,
  sending,
  wakingUp,
  showWakingUp,
  wakingUpLabel,
  executionTraces,
  progressMessages,
  toolIcons,
  argPreview,
  onSend,
  onSaveReport,
  onPinMessage,
  onImageClick,
  onEditImage,
  onSuggestionAction,
  hasMoreMessages,
  onLoadMore,
  loadingMore,
  bottomRef,
  prependContent,
  recovering,
  historyLayout = "bubbles",
  workspaceHome,
  pendingUiInput,
  onRespondUiInput,
}: {
  messages: SubagentMessage[];
  sending: boolean;
  wakingUp?: boolean;
  showWakingUp: boolean;
  wakingUpLabel?: string;
  executionTraces?: ExecutionTrace[];
  progressMessages?: string[];
  toolIcons?: Record<string, LucideIcon>;
  argPreview?: (tool: string, args: Record<string, unknown>) => string;
  recovering?: boolean;
  onSend: (messageOverride?: string) => void;
  onSaveReport?: (spec: Record<string, unknown>) => void;
  onPinMessage?: (messageId: string, pinned: boolean) => void;
  onImageClick?: (src: string) => void;
  onEditImage?: (src: string) => void;
  onSuggestionAction?: (action: string, args: string[]) => void;
  hasMoreMessages?: boolean;
  onLoadMore?: () => void;
  loadingMore?: boolean;
  bottomRef: React.RefObject<HTMLDivElement | null>;
  prependContent?: React.ReactNode;
  historyLayout?: "bubbles" | "workspace";
  workspaceHome?: React.ReactNode;
  pendingUiInput?: UiInputPromptRequest | null;
  onRespondUiInput?: (response: {
    action: "submit" | "cancel";
    confirmed?: boolean;
    value?: string;
    selectedOptionId?: string;
  }) => void | Promise<void>;
}) {
  const visibleMessages = messages.filter((m) => !m.hidden);
  const isWorkspace = historyLayout === "workspace";
  const turns = isWorkspace ? groupMessageTurns(visibleMessages) : [];
  const [expandedTurns, setExpandedTurns] = useState<Set<number>>(() => new Set());

  useEffect(() => {
    if (!isWorkspace || turns.length === 0) return;
    setExpandedTurns((current) => {
      const next = new Set(current);
      next.add(turns.length - 1);
      return next;
    });
  }, [isWorkspace, turns.length]);

  type RenderItem =
    | { kind: "collapsed"; turnIndex: number; turn: MessageTurn }
    | {
        kind: "message";
        message: SubagentMessage;
        index: number;
        workspaceUserStyle?: "prompt" | "standard";
        turnGap?: boolean;
      };

  const renderItems: RenderItem[] = [];
  if (isWorkspace) {
    turns.forEach((turn, turnIndex) => {
      const isLatest = turnIndex === turns.length - 1;
      const isExpanded = isLatest || expandedTurns.has(turnIndex);

      if (!isExpanded) {
        renderItems.push({ kind: "collapsed", turnIndex, turn });
        return;
      }

      if (turn.user) {
        renderItems.push({
          kind: "message",
          message: turn.user,
          index: turn.userIndex,
          workspaceUserStyle: isLatest ? "prompt" : "standard",
          turnGap: turnIndex > 0,
        });
      }
      turn.replies.forEach(({ message, index }) => {
        renderItems.push({ kind: "message", message, index });
      });
    });
  }

  const itemsToRender: RenderItem[] = isWorkspace
    ? renderItems
    : visibleMessages.map((message, index) => ({
        kind: "message" as const,
        message,
        index,
      }));

  function expandTurn(turnIndex: number) {
    setExpandedTurns((current) => {
      const next = new Set(current);
      next.add(turnIndex);
      return next;
    });
  }

  return (
    <>
      {prependContent}

      {isWorkspace && visibleMessages.length === 0 && !sending && workspaceHome}

      {hasMoreMessages && onLoadMore && (
        <div className="flex justify-center py-2">
          <button
            type="button"
            onClick={onLoadMore}
            disabled={loadingMore}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            {loadingMore ? <BrailleSpinner className="text-xs" /> : "Load earlier messages"}
          </button>
        </div>
      )}

      {itemsToRender.map((item) => {
        if (item.kind === "collapsed") {
          return (
            <button
              key={`collapsed-${item.turnIndex}`}
              type="button"
              onClick={() => expandTurn(item.turnIndex)}
              className={chatWorkspaceEarlierTurnClassName()}
            >
              <ChevronRight className="h-3.5 w-3.5 shrink-0" />
              <span className="line-clamp-1">{turnPreviewText(item.turn)}</span>
            </button>
          );
        }

        const message = item.message;
        const index = item.index;
        const isUser = message.role === "user";
        const isImage = message.role === "image";
        const rawContent = message.answer ?? message.message;
        const renderSpec = !isUser && !isImage ? tryExtractRenderSpec(rawContent) : null;
        const isLatestUserPrompt =
          isWorkspace && isUser && item.workspaceUserStyle === "prompt";
        const attachmentRowClass = isWorkspace
          ? "mt-3 flex flex-wrap justify-center gap-1.5"
          : "mt-1.5 flex justify-end flex-wrap gap-1.5";
        const actionRowClass = isWorkspace
          ? "mt-3 flex flex-wrap items-center justify-center gap-2"
          : "mt-1.5 flex items-center gap-2";
        const suggestionRowClass = isWorkspace
          ? "mt-3 flex flex-wrap justify-center gap-2"
          : "mt-3 flex flex-wrap gap-2 max-w-[75%]";

        if (isImage) {
          return (
            <div
              key={`${message.role}-${index}`}
              className={cn(item.turnGap && "mt-12", "flex justify-center")}
            >
              <GeneratedImageGallery
                urls={[message.message]}
                onClick={onImageClick}
                size={isWorkspace ? "stage" : "inline"}
              />
            </div>
          );
        }

        const generatedImages = !isUser ? collectGeneratedImageUrls(message) : [];
        const imageCardSize = isWorkspace ? "stage" : "inline";

        return (
          <div
            key={`${message.role}-${index}`}
            className={cn(item.turnGap && "mt-12 pt-2")}
          >
            {isLatestUserPrompt ? (
              <p className={chatWorkspacePromptClassName()}>
                {formatMessageContent(rawContent)}
              </p>
            ) : (
              <>
                {!isUser && generatedImages.length > 0 && (
                  <GeneratedImageGallery
                    urls={generatedImages}
                    onClick={onImageClick}
                    size={imageCardSize}
                  />
                )}
                {(isUser || formatMessageContent(rawContent).trim() || renderSpec) && (
                  <div
                    className={`flex ${isWorkspace ? "justify-center" : isUser ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={
                        isUser
                          ? isWorkspace
                            ? cn(chatUserBubbleClassName(!!renderSpec), "mx-auto")
                            : chatUserBubbleClassName(!!renderSpec)
                          : isWorkspace
                            ? chatWorkspaceResponseClassName(!!message.pinned)
                            : chatAssistantBubbleClassName(!!renderSpec, !!message.pinned)
                      }
                    >
                      {renderSpec ? (
                        <Suspense fallback={<div className="text-xs text-muted-foreground">Loading visualization...</div>}>
                          <InlineRenderSpec spec={renderSpec} />
                        </Suspense>
                      ) : (
                        <ChatMarkdown content={formatMessageContent(rawContent)} />
                      )}
                    </div>
                  </div>
                )}
              </>
            )}

            {isUser && Array.isArray(message.images) && message.images.length > 0 && (
              <div className={attachmentRowClass}>
                {message.images.map((image, imageIndex) => {
                  const asImage = isImageAttachment(image);
                  const label =
                    message.images!.length === 1
                      ? attachmentLabel(image)
                      : attachmentIndexLabel(image, imageIndex, message.images!.length);
                  if (!asImage) {
                    return (
                      <AttachedFilePill
                        key={`${index}-img-ref-${imageIndex}`}
                        url={image}
                        label={label}
                      />
                    );
                  }
                  return (
                    <button
                      key={`${index}-img-ref-${imageIndex}`}
                      type="button"
                      onClick={() => onImageClick?.(image)}
                      className={chatAttachmentPillClassName()}
                      title="View attached image"
                    >
                      <img
                        src={image}
                        alt=""
                        className="h-6 w-6 rounded-full object-cover shrink-0"
                      />
                      <span>{label}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {isUser && Array.isArray(message.attachedRefs) && message.attachedRefs.length > 0 && (
              <div className={attachmentRowClass}>
                {message.attachedRefs.map((ref, refIndex) => (
                  <span
                    key={`${index}-ref-${refIndex}`}
                    className={chatAttachmentPillClassName()}
                  >
                    <MousePointerClick className="h-3 w-3 text-[var(--dude-accent)]" />
                    <span className="font-mono truncate max-w-[180px]">{ref.label}</span>
                  </span>
                ))}
              </div>
            )}

            {isUser && Array.isArray(message.files) && message.files.length > 0 && (
              <div className={attachmentRowClass}>
                {message.files.map((file, fileIndex) => {
                  const ext =
                    file.name?.split(".").pop()?.toUpperCase() ||
                    file.mimeType?.split("/")[1]?.toUpperCase() ||
                    "FILE";
                  return (
                    <span
                      key={`${index}-file-${fileIndex}`}
                      className={chatAttachmentPillClassName()}
                      title={file.name}
                    >
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--dude-accent-soft)] shrink-0">
                        <FileText className="h-3 w-3 text-muted-foreground" />
                      </span>
                      <span className="truncate max-w-[180px]">{file.name || "Document"}</span>
                      <span className="font-mono text-[9px] tracking-wider text-muted-foreground/70">
                        {ext}
                      </span>
                    </span>
                  );
                })}
              </div>
            )}

            {!isUser && (renderSpec || onPinMessage) && (
              <div className={actionRowClass}>
                {renderSpec && onSaveReport && (
                  <button
                    type="button"
                    onClick={() => onSaveReport(renderSpec)}
                    className={chatPillClassName()}
                  >
                    <BookmarkPlus className="h-3 w-3" />
                    Save to reports
                  </button>
                )}
                {onPinMessage && message.id && (
                  <button
                    type="button"
                    onClick={() => onPinMessage(message.id!, !message.pinned)}
                    className={chatPillClassName(!!message.pinned)}
                  >
                    <Pin className={`h-3 w-3 ${message.pinned ? "fill-current" : ""}`} />
                    {message.pinned ? "Pinned" : "Pin"}
                  </button>
                )}
              </div>
            )}

            {!isUser && message.executionTrace && (() => {
              const specCalls = (message.executionTrace!.toolExecutions ?? []).filter((e) => isSubagentCall(e.tool));
              return (
                <div className="mt-3 space-y-3">
                  {specCalls.map((exec, i) => (
                    <SubagentMessageBubble
                      key={`msg-spec-${index}-${i}`}
                      subagentId={exec.tool}
                      task={String(exec.arguments?.message || "")}
                      status="completed"
                      result={exec.result}
                      onImageClick={onImageClick}
                    />
                  ))}
                  <InlineTrace traces={[message.executionTrace!]} toolIcons={toolIcons} argPreview={argPreview} />
                </div>
              );
            })()}
            {!isUser && !message.executionTrace && Array.isArray(message.steps) && message.steps.length > 0 && (
              <div className="mt-2">
                <InlineTrace
                  traces={[{ id: `msg-trace-${index}`, timestamp: message.date || new Date().toISOString(), steps: message.steps, toolExecutions: [], durationMs: 0 }]}
                  toolIcons={toolIcons}
                  argPreview={argPreview}
                />
              </div>
            )}

            {!isUser && !sending && (() => {
              // Collect suggestions: from message.suggestions or from workspace tool results in traces
              let allSuggestions = message.suggestions || [];
              if (!allSuggestions.length && message.executionTrace) {
                const wsToolExec = (message.executionTrace.toolExecutions ?? []).find(
                  (e) => e.tool === "list-subagent-workspaces" && e.result != null,
                );
                if (wsToolExec) {
                  try {
                    let data: StringKeyRecord | JsonValue[] | string =
                      wsToolExec.result as StringKeyRecord | JsonValue[] | string;
                    if (typeof data === "string") data = JSON.parse(data);
                    if (Array.isArray(data)) {
                      const t = data.find((c: JsonValue) => c?.text);
                      if (t?.text) data = JSON.parse(t.text);
                    }
                    if (Array.isArray(data?.suggestions)) {
                      allSuggestions = data.suggestions;
                    }
                  } catch { /* ignore */ }
                }
              }
              if (!allSuggestions.length) return null;
              return (
                <div className={cn(suggestionRowClass, isWorkspace && "mx-auto w-full max-w-2xl")}>
                  {allSuggestions.map((suggestion: string) => {
                    // `action:<key>` suggestions render as side-effect
                    // buttons (open a modal, etc.) instead of sending the
                    // string back as a user message. Falls back to a
                    // normal pill when the host page hasn't wired a
                    // handler for action suggestions.
                    const parsed = parseActionSuggestion(suggestion);
                    if (parsed) {
                      // No handler wired on this surface (e.g. subagent
                      // pages don't expose UI side-effects from GT) —
                      // hide rather than send the raw `action:...` text
                      // back to the agent as a user message.
                      if (!onSuggestionAction) return null;
                      // Pick an icon hint per action key. open-subagent
                      // opts into the subagent's own icon and color so
                      // the pill reads as "open the X workspace".
                      let ActionIcon = Database;
                      let pillColor =
                        "bg-[var(--dude-accent-soft)] text-[var(--dude-accent)] hover:brightness-95";
                      if (parsed.action === "open-subagent") {
                        const specMeta = SUBAGENT_META[parsed.args[0] || ""];
                        if (specMeta) {
                          ActionIcon = specMeta.icon;
                          pillColor = `${specMeta.bg} ${specMeta.color} hover:brightness-95`;
                        }
                      }
                      return (
                        <button
                          key={`action-${parsed.action}-${suggestion}`}
                          type="button"
                          onClick={() => onSuggestionAction(parsed.action, parsed.args)}
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                            pillColor,
                          )}
                        >
                          <ActionIcon className="h-3.5 w-3.5" />
                          {parsed.label}
                        </button>
                      );
                    }
                    return (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => onSend(suggestion)}
                        className={chatPillClassName()}
                      >
                        {suggestion}
                      </button>
                    );
                  })}
                </div>
              );
            })()}

            {/* Retry button — shown on the last user message when no assistant reply followed */}
            {isUser && index === visibleMessages.length - 1 && !sending && (
              <div className={isWorkspace ? "mt-3 flex justify-center" : "mt-1.5 flex justify-end"}>
                <button
                  type="button"
                  onClick={() => onSend(typeof rawContent === "string" ? rawContent : "")}
                  className={chatPillClassName()}
                >
                  <RotateCcw className="h-3 w-3" />
                  Resend
                </button>
              </div>
            )}
          </div>
        );
      })}

      {showWakingUp && (
        <div className={cn("flex", isWorkspace ? "justify-center" : "justify-start")}>
          <div className={cn(
            isWorkspace ? chatWorkspaceResponseClassName() : chatAssistantBubbleClassName(),
            "flex items-center gap-2.5 px-4 py-3",
          )}>
            <BrailleSpinner className="text-sm text-primary" />
            <span className="text-muted-foreground">{wakingUpLabel || "Waking up your assistant..."}</span>
          </div>
        </div>
      )}

      {/* Live subagent delegations — rendered as the subagent's own
          chat bubbles so the user can see exactly which subagent is
          currently working and what it is producing. */}
      {(sending || wakingUp) && Array.isArray(executionTraces) && executionTraces.length > 0 && (() => {
        const liveSpecCalls = executionTraces.flatMap((trace) =>
          (trace.toolExecutions ?? []).filter((e) => isSubagentCall(e.tool)),
        );
        const liveSteps = executionTraces.flatMap((t) => t.steps ?? []);
        return (
        <>
          {liveSpecCalls.map((exec, i) => (
            <SubagentMessageBubble
              key={`live-spec-${i}`}
              subagentId={exec.tool}
              task={String(exec.arguments?.message || "")}
              status={exec.result != null ? "completed" : "working"}
              steps={liveSteps}
              result={exec.result}
              onImageClick={onImageClick}
            />
          ))}
          <InlineTrace
            traces={executionTraces}
            live
            progressMessages={progressMessages}
            toolIcons={toolIcons}
            argPreview={argPreview}
          />
        </>
        );
      })()}

      {(sending || wakingUp) && pendingUiInput && onRespondUiInput && (
        <div className={cn("flex", isWorkspace ? "justify-center w-full" : "justify-start")}>
          <div className={cn(isWorkspace ? "w-full max-w-3xl" : "max-w-xl w-full")}>
            <UiInputPrompt
              request={pendingUiInput}
              onSubmit={onRespondUiInput}
            />
          </div>
        </div>
      )}

      {sending && (!executionTraces || executionTraces.length === 0) && !showWakingUp && !pendingUiInput && (
        <div className={cn("flex", isWorkspace ? "justify-center" : "justify-start")}>
          <div className={cn(
            "rounded-2xl bg-[var(--dude-surface-2)] px-4 py-3 flex items-center gap-2",
            !isWorkspace && "rounded-bl-md",
          )} role="status" aria-label={recovering ? "Reconnecting" : "Typing"}>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-[typing-bounce_1.4s_ease-in-out_infinite]" />
              <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-[typing-bounce_1.4s_ease-in-out_0.2s_infinite]" />
              <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-[typing-bounce_1.4s_ease-in-out_0.4s_infinite]" />
            </div>
            {recovering && (
              <span className="text-xs text-muted-foreground">Working…</span>
            )}
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Input bar
// ---------------------------------------------------------------------------

