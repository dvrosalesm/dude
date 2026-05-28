"use client";

import {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  BookmarkPlus,
  Database,
  Pin,
  type LucideIcon,
} from "lucide-react";
import { BrailleSpinner } from "@dude/ui/components/braille-spinner";
import { UiInputPrompt, type UiInputPromptRequest } from "./ui-input-prompt";
import { ChatMarkdown } from "../components/chat/chat-markdown";
import {
  formatDreamSummary,
  shouldShowDreamSummary,
} from "../lib/chat/markdown-summary";
import {
  chatAttachmentPillClassName,
  chatPillClassName,
  chatWorkspaceEarlierTurnClassName,
  cn,
} from "@dude/ui/design-system";
import { extractJsonSnippet } from "@dude/data-analyst-core/render/utils";
import { friendlyToolLabel } from "@dude/gateway-shared/tool-labels";
import type { ExecutionTrace, SubagentMessage } from "./types";
import {
  isSubagentCall,
  parseActionSuggestion,
  SUBAGENT_META,
} from "./subagent-meta";
import { SubagentMessageBubble } from "./subagent-message-bubble";
import {
  groupMessageTurns,
  turnPreviewText,
  type MessageTurn,
} from "./main-assistant-workspace";
import { collectGeneratedImageUrls } from "./collect-message-images";
import { GeneratedImageGallery } from "./generated-image-card";
import { HtmlInCanvasShell } from "../components/chat/html-in-canvas-shell";
import {
  DreamAnswerStage,
  DreamThinkingStage,
} from "../components/chat/dream-stage-view";

const InlineRenderSpec = lazy(() => import("./inline-render-spec"));

function formatMessageContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (content && typeof content === "object" && "content" in content) {
    const inner = (content as { content?: unknown }).content;
    if (typeof inner === "string") return inner;
  }
  try {
    return JSON.stringify(content, null, 2);
  } catch {
    return String(content);
  }
}

function tryExtractRenderSpec(content: unknown): Record<string, unknown> | null {
  const text = formatMessageContent(content);
  const parsed = extractJsonSnippet(text);
  if (!parsed) return null;
  if (
    typeof parsed.root === "string" &&
    parsed.elements &&
    typeof parsed.elements === "object"
  ) {
    return parsed;
  }
  return null;
}

function liveStepLabel(traces: ExecutionTrace[] | undefined): string {
  if (!traces?.length) return "";
  const latest = traces[traces.length - 1];
  const execs = latest.toolExecutions ?? [];
  for (let i = execs.length - 1; i >= 0; i -= 1) {
    const exec = execs[i];
    const toolName =
      typeof exec?.tool === "string"
        ? exec.tool
        : typeof (exec as { name?: string })?.name === "string"
          ? (exec as { name: string }).name
          : "";
    if (toolName) {
      const args =
        exec.arguments && typeof exec.arguments === "object"
          ? (exec.arguments as Record<string, unknown>)
          : undefined;
      const { active, past } = friendlyToolLabel(toolName, args);
      return exec.result == null ? active : past;
    }
  }
  const steps = latest.steps ?? [];
  for (let i = steps.length - 1; i >= 0; i -= 1) {
    const step = steps[i];
    if (step && !step.includes('{"')) return step;
  }
  return "";
}

function userIntentText(turn: MessageTurn): string {
  const raw = turn.user?.message ?? turn.user?.answer;
  if (typeof raw === "string" && raw.trim()) {
    return raw.trim();
  }
  return turnPreviewText(turn);
}

function collectSuggestions(message: SubagentMessage): string[] {
  let allSuggestions = message.suggestions ?? [];
  if (!allSuggestions.length && message.executionTrace) {
    const wsToolExec = message.executionTrace.toolExecutions.find(
      (e) => e.tool === "list-subagent-workspaces" && e.result != null,
    );
    if (wsToolExec) {
      try {
        let data: StringKeyRecord | JsonValue[] | string = wsToolExec.result as
          | StringKeyRecord
          | JsonValue[]
          | string;
        if (typeof data === "string") data = JSON.parse(data);
        if (Array.isArray(data)) {
          const t = data.find((c: JsonValue) => c?.text);
          if (t?.text) data = JSON.parse(t.text);
        }
        if (Array.isArray(data?.suggestions)) {
          allSuggestions = data.suggestions;
        }
      } catch {
        /* ignore */
      }
    }
  }
  return allSuggestions;
}

function TurnStageCanvas({
  turn,
  isLive,
  sending,
  executionTraces,
  onImageClick,
  onSaveReport,
  onPinMessage,
  density = "stage",
  userPrompt,
}: {
  turn: MessageTurn;
  isLive: boolean;
  sending: boolean;
  executionTraces?: ExecutionTrace[];
  onImageClick?: (src: string) => void;
  onSaveReport?: (spec: Record<string, unknown>) => void;
  onPinMessage?: (messageId: string, pinned: boolean) => void;
  density?: "stage" | "history";
  /** Current user message — shown in small text above the answer. */
  userPrompt?: string;
}) {
  const isStage = density === "stage";
  const richBlocks: ReactNode[] = [];
  const textParts: string[] = [];
  let latestSpec: Record<string, unknown> | null = null;
  let latestSpecMessageId: string | undefined;
  let hasImages = false;

  for (const { message, index } of turn.replies) {
    const rawContent = message.answer ?? message.message;
    const renderSpec =
      message.role !== "user" ? tryExtractRenderSpec(rawContent) : null;

    if (renderSpec) {
      latestSpec = renderSpec;
      latestSpecMessageId = message.id;
      richBlocks.push(
        <Suspense
          key={`spec-${index}`}
          fallback={
            <div
              className={cn(
                "flex items-center justify-center text-sm text-muted-foreground",
                isStage ? "min-h-[40vh]" : "min-h-32 py-8",
              )}
            >
              Loading visualization…
            </div>
          }
        >
          <InlineRenderSpec
            spec={renderSpec}
            variant={isStage ? "stage" : "inline"}
          />
        </Suspense>,
      );
      continue;
    }

    const generatedImages = collectGeneratedImageUrls(message);
    if (generatedImages.length > 0) {
      hasImages = true;
      richBlocks.push(
        <GeneratedImageGallery
          key={`imgs-${index}`}
          urls={generatedImages}
          onClick={onImageClick}
          size={isStage ? "stage" : "inline"}
        />,
      );
    }

    if (message.executionTrace) {
      const specCalls = message.executionTrace.toolExecutions.filter((e) =>
        isSubagentCall(e.tool),
      );
      for (const [i, exec] of specCalls.entries()) {
        richBlocks.push(
          <div
            key={`spec-call-${index}-${i}`}
            className={cn("mx-auto w-full", isStage ? "max-w-3xl" : "max-w-2xl")}
          >
            <SubagentMessageBubble
              subagentId={exec.tool}
              task={String(exec.arguments?.message || "")}
              status="completed"
              result={exec.result}
              onImageClick={onImageClick}
            />
          </div>,
        );
      }
    }

    const text = formatMessageContent(rawContent);
    if (text.trim() && !tryExtractRenderSpec(rawContent)) {
      textParts.push(text.trim());
    }
  }

  if (isLive && sending && executionTraces?.length) {
    const liveSpecCalls = executionTraces.flatMap((trace) =>
      trace.toolExecutions.filter((e) => isSubagentCall(e.tool)),
    );
    for (const [i, exec] of liveSpecCalls.entries()) {
      richBlocks.push(
        <div
          key={`live-spec-${i}`}
          className={cn("mx-auto w-full", isStage ? "max-w-3xl" : "max-w-2xl")}
        >
          <SubagentMessageBubble
            subagentId={exec.tool}
            task={String(exec.arguments?.message || "")}
            status={exec.result != null ? "completed" : "working"}
            steps={executionTraces.flatMap((t) => t.steps)}
            result={exec.result}
            onImageClick={onImageClick}
          />
        </div>
      );
    }
  }

  const hasRich = richBlocks.length > 0;
  const summaryText = textParts.join("\n\n");
  const dreamSummaryText = hasImages ? formatDreamSummary(summaryText) : summaryText;
  const showDreamSummary = shouldShowDreamSummary(summaryText, hasImages);

  return (
    <div className={cn("flex flex-col gap-4", isStage && "min-h-0 flex-1")}>
      {isStage && userPrompt && (
        <p className="shrink-0 px-6 text-center text-xs leading-relaxed text-muted-foreground">
          {userPrompt}
        </p>
      )}
      <div
        className={cn(
          "flex flex-col gap-6",
          isStage ? "min-h-0 flex-1 justify-center py-2" : "py-2",
        )}
      >
        {hasRich ? (
          richBlocks
        ) : summaryText ? (
          <DreamAnswerStage
            revealing={isStage}
            className={cn(
              "mx-auto max-w-xl text-center",
              !isStage && "line-clamp-6 text-sm text-muted-foreground",
            )}
          >
            <ChatMarkdown
              content={summaryText}
              variant={isStage ? "dream" : "default"}
            />
          </DreamAnswerStage>
        ) : isLive && sending ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
            <BrailleSpinner className="text-2xl" />
            <p className="text-sm">
              {liveStepLabel(executionTraces) || "Working on it…"}
            </p>
          </div>
        ) : null}
      </div>

      {isStage && hasRich && showDreamSummary && (
        <DreamAnswerStage revealing className="chat-dream-summary shrink-0">
          <ChatMarkdown content={dreamSummaryText} variant="dream" />
        </DreamAnswerStage>
      )}

      {isStage && latestSpec && (onSaveReport || onPinMessage) && (
        <div className="flex shrink-0 flex-wrap justify-center gap-2">
          {onSaveReport && (
            <button
              type="button"
              onClick={() => onSaveReport(latestSpec!)}
              className={chatPillClassName()}
            >
              <BookmarkPlus className="h-3 w-3" />
              Save to reports
            </button>
          )}
          {onPinMessage && latestSpecMessageId && (
            <button
              type="button"
              onClick={() => onPinMessage(latestSpecMessageId!, true)}
              className={chatPillClassName()}
            >
              <Pin className="h-3 w-3" />
              Pin
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function PastTurnHistory({
  turn,
  onImageClick,
}: {
  turn: MessageTurn;
  onImageClick?: (src: string) => void;
}) {
  return (
    <section className="border-b border-transparent py-8">
      <p className={cn(chatWorkspaceEarlierTurnClassName(), "pointer-events-none mb-4 justify-center")}>
        <span className="line-clamp-2 text-center">{userIntentText(turn)}</span>
      </p>
      <TurnStageCanvas
        turn={turn}
        isLive={false}
        sending={false}
        onImageClick={onImageClick}
        density="history"
      />
    </section>
  );
}

export function MainAssistantStage({
  messages,
  sending,
  executionTraces,
  progressMessages,
  workspaceHome,
  onSend,
  onSuggestionAction,
  onImageClick,
  onSaveReport,
  onPinMessage,
  bottomRef,
  showWakingUp,
  wakingUpLabel,
  recovering,
  pendingUiInput,
  onRespondUiInput,
  projectHub,
}: {
  messages: SubagentMessage[];
  sending: boolean;
  executionTraces?: ExecutionTrace[];
  progressMessages?: string[];
  workspaceHome?: React.ReactNode;
  onSend: (messageOverride?: string) => void;
  onSuggestionAction?: (action: string, args: string[]) => void;
  onImageClick?: (src: string) => void;
  onSaveReport?: (spec: Record<string, unknown>) => void;
  onPinMessage?: (messageId: string, pinned: boolean) => void;
  bottomRef: React.RefObject<HTMLDivElement | null>;
  showWakingUp?: boolean;
  wakingUpLabel?: string;
  recovering?: boolean;
  pendingUiInput?: UiInputPromptRequest | null;
  onRespondUiInput?: (response: {
    action: "submit" | "cancel";
    confirmed?: boolean;
    value?: string;
    selectedOptionId?: string;
  }) => void | Promise<void>;
  projectHub?: ReactNode;
}) {
  const visibleMessages = messages.filter((m) => !m.hidden);
  const turns = useMemo(
    () => groupMessageTurns(visibleMessages),
    [visibleMessages],
  );

  const pastTurns = turns.length > 1 ? turns.slice(0, -1) : [];
  const currentTurn = turns.length > 0 ? turns[turns.length - 1] : null;
  const isThinking = Boolean(currentTurn) && sending && !showWakingUp;
  const isLive = Boolean(currentTurn) && (sending || showWakingUp);
  const [isRevealing, setIsRevealing] = useState(false);
  const wasSendingRef = useRef(false);
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (wasSendingRef.current && !sending && (currentTurn?.replies.length ?? 0) > 0) {
      setIsRevealing(true);
      const timer = window.setTimeout(() => setIsRevealing(false), 900);
      wasSendingRef.current = sending;
      return () => window.clearTimeout(timer);
    }
    wasSendingRef.current = sending;
    return undefined;
  }, [sending, currentTurn?.replies.length]);

  useEffect(() => {
    if (isThinking) {
      stageRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [isThinking]);

  useEffect(() => {
    if (!isThinking && !sending && (currentTurn?.replies.length ?? 0) > 0) {
      stageRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [isThinking, sending, currentTurn?.replies.length]);

  const latestSuggestions = useMemo(() => {
    if (!currentTurn || sending) return [];
    const lastReply = currentTurn.replies[currentTurn.replies.length - 1]?.message;
    return lastReply ? collectSuggestions(lastReply) : [];
  }, [currentTurn, sending]);

  if (turns.length === 0) {
    return (
      <>
        {projectHub && (
          <div className="mx-auto mb-4 w-full max-w-3xl shrink-0 px-1">
            {projectHub}
          </div>
        )}
        {!sending && workspaceHome && (
          <div className="flex min-h-[min(70dvh,640px)] w-full flex-col justify-center px-1">
            {workspaceHome}
          </div>
        )}
        {showWakingUp && (
          <HtmlInCanvasShell
            phase="thinking"
            contentClassName="flex min-h-[min(50dvh,480px)] flex-col items-center justify-center gap-3 py-16 text-muted-foreground"
          >
            <BrailleSpinner className="text-2xl" />
            <p className="text-sm">{wakingUpLabel || "Waking up…"}</p>
          </HtmlInCanvasShell>
        )}
        <div ref={bottomRef} />
      </>
    );
  }

  return (
    <div className="flex min-h-full flex-col">
      {projectHub && (
        <div className="mx-auto mb-4 w-full max-w-3xl shrink-0 px-1">
          {projectHub}
        </div>
      )}
      {pastTurns.length > 0 && (
        <div className="shrink-0">
          <div className="chat-stage-earlier sticky top-0 z-10">
            <p className="py-2.5 text-center text-[10px] font-medium uppercase tracking-widest text-muted-foreground/60">
              Earlier
            </p>
          </div>
          {pastTurns.map((turn, index) => (
            <PastTurnHistory
              key={`past-${index}-${turn.userIndex}`}
              turn={turn}
              onImageClick={onImageClick}
            />
          ))}
        </div>
      )}

      <div
        ref={stageRef}
        className={cn(
          "w-full shrink-0 scroll-mt-4 px-1 pb-2",
          !isThinking && "flex min-h-[calc(100dvh-13rem)] flex-col",
        )}
      >
        {isThinking ? (
          <HtmlInCanvasShell
            phase="thinking"
            contentClassName="flex min-h-[calc(100dvh-13rem)] flex-col items-center justify-center"
          >
            {currentTurn?.user && Array.isArray(currentTurn.user.images) && (
              <div className="mb-4 flex shrink-0 flex-wrap justify-center gap-1.5">
                {currentTurn.user.images.map((url, i) => (
                  <button
                    key={`think-img-${i}`}
                    type="button"
                    onClick={() => onImageClick?.(url)}
                    className={chatAttachmentPillClassName()}
                  >
                    <img src={url} alt="" className="h-6 w-6 rounded-full object-cover" />
                    Attachment
                  </button>
                ))}
              </div>
            )}
            <DreamThinkingStage
              question={userIntentText(currentTurn!)}
              statusLabel={
                recovering
                  ? "Reconnecting…"
                  : liveStepLabel(executionTraces) ||
                    progressMessages?.[progressMessages.length - 1] ||
                    "Thinking…"
              }
            />
            {progressMessages && progressMessages.length > 0 && (
              <div className="mt-6 flex w-full max-w-md flex-col gap-2">
                {progressMessages.map((update, index) => (
                  <div
                    key={`progress-${index}-${update.slice(0, 24)}`}
                    className="rounded-xl border border-border/60 bg-[var(--dude-surface-2)]/80 px-4 py-3 text-sm text-foreground shadow-sm backdrop-blur-sm"
                  >
                    {update}
                  </div>
                ))}
              </div>
            )}
            {pendingUiInput && onRespondUiInput && (
              <div className="mt-4 w-full max-w-3xl shrink-0">
                <UiInputPrompt
                  request={pendingUiInput}
                  onSubmit={onRespondUiInput}
                />
              </div>
            )}
          </HtmlInCanvasShell>
        ) : (
          <DreamAnswerStage
            revealing={isRevealing}
            className="flex min-h-0 flex-1 flex-col justify-center"
          >
            {currentTurn?.user && Array.isArray(currentTurn.user.images) && (
              <div className="mb-3 flex shrink-0 flex-wrap justify-center gap-1.5">
                {currentTurn.user.images.map((url, i) => (
                  <button
                    key={`user-img-${i}`}
                    type="button"
                    onClick={() => onImageClick?.(url)}
                    className={chatAttachmentPillClassName()}
                  >
                    <img src={url} alt="" className="h-6 w-6 rounded-full object-cover" />
                    Attachment
                  </button>
                ))}
              </div>
            )}

            <TurnStageCanvas
              turn={currentTurn!}
              isLive={isLive}
              sending={sending}
              executionTraces={executionTraces}
              onImageClick={onImageClick}
              onSaveReport={onSaveReport}
              onPinMessage={onPinMessage}
              density="stage"
            />

            {pendingUiInput && onRespondUiInput && (
              <div className="mt-4 w-full max-w-3xl shrink-0">
                <UiInputPrompt
                  request={pendingUiInput}
                  onSubmit={onRespondUiInput}
                />
              </div>
            )}

            {latestSuggestions.length > 0 && (
              <div className="mt-4 flex shrink-0 flex-wrap justify-center gap-2 pb-2">
                {latestSuggestions.map((suggestion) => {
                  const parsed = parseActionSuggestion(suggestion);
                  if (parsed) {
                    if (!onSuggestionAction) return null;
                    let ActionIcon: LucideIcon = Database;
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
            )}
          </DreamAnswerStage>
        )}
      </div>

      <div ref={bottomRef} />
    </div>
  );
}
