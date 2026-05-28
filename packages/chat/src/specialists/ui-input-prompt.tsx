"use client";

import { useState } from "react";
import { Button } from "@dude/ui/components/button";
import { cn } from "@dude/ui/design-system";

export type UiInputPromptRequest = {
  id: string;
  workspaceId?: string;
  kind: "confirm" | "question" | "choice";
  title: string;
  message: string;
  options?: Array<{ id: string; label: string }>;
  defaultOptionId?: string;
  placeholder?: string;
};

export function UiInputPrompt({
  request,
  onSubmit,
  onCancel,
  disabled = false,
}: {
  request: UiInputPromptRequest;
  onSubmit: (response: {
    action: "submit" | "cancel";
    confirmed?: boolean;
    value?: string;
    selectedOptionId?: string;
  }) => void | Promise<void>;
  onCancel?: () => void;
  disabled?: boolean;
}) {
  const [value, setValue] = useState("");
  const [selectedOptionId, setSelectedOptionId] = useState(
    request.defaultOptionId || request.options?.[0]?.id || "",
  );
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(payload: {
    action: "submit" | "cancel";
    confirmed?: boolean;
    value?: string;
    selectedOptionId?: string;
  }) {
    if (submitting || disabled) return;
    setSubmitting(true);
    try {
      await onSubmit(payload);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className={cn(
        "rounded-xl border border-[var(--dude-accent)]/35 bg-[var(--dude-accent-soft)]/40 p-4 shadow-sm",
        "space-y-3",
      )}
      role="region"
      aria-label={request.title}
    >
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{request.title}</p>
        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
          {request.message}
        </p>
      </div>

      {request.kind === "question" && (
        <textarea
          className="min-h-[88px] w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--dude-accent)]"
          placeholder={request.placeholder || "Type your answer…"}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          disabled={submitting || disabled}
        />
      )}

      {request.kind === "choice" && request.options?.length ? (
        <div className="flex flex-col gap-2">
          {request.options.map((option) => {
            const active = selectedOptionId === option.id;
            return (
              <button
                key={option.id}
                type="button"
                disabled={submitting || disabled}
                onClick={() => setSelectedOptionId(option.id)}
                className={cn(
                  "rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                  active
                    ? "border-[var(--dude-accent)] bg-background"
                    : "border-border bg-background/70 hover:bg-background",
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {request.kind === "confirm" ? (
          <>
            <Button
              type="button"
              size="sm"
              disabled={submitting || disabled}
              onClick={() => handleSubmit({ action: "submit", confirmed: true })}
            >
              Approve
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={submitting || disabled}
              onClick={() =>
                handleSubmit({ action: "submit", confirmed: false })
              }
            >
              Decline
            </Button>
          </>
        ) : (
          <Button
            type="button"
            size="sm"
            disabled={
              submitting ||
              disabled ||
              (request.kind === "question" && !value.trim()) ||
              (request.kind === "choice" && !selectedOptionId)
            }
            onClick={() =>
              handleSubmit({
                action: "submit",
                value: request.kind === "question" ? value.trim() : undefined,
                selectedOptionId:
                  request.kind === "choice" ? selectedOptionId : undefined,
              })
            }
          >
            Submit
          </Button>
        )}

        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={submitting || disabled}
          onClick={() => {
            onCancel?.();
            void handleSubmit({ action: "cancel" });
          }}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
