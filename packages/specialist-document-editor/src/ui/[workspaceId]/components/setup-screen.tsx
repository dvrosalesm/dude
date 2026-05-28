"use client";

import React, { useState } from "react";
import { ArrowLeft, ArrowRight, RectangleHorizontal, Sparkles } from "lucide-react";
import { Button } from "@dude/ui/components/button";
import { BrailleSpinner } from "@dude/ui/components/braille-spinner";
import { cn } from "@dude/ui/utils";
import type { DocumentType } from "@dude/presentation-editor/types";

type SetupAction = "create";
type SlideDimensions = { width: number; height: number };

const FORMAT_PRESETS = [
  { key: "presentation", label: "Presentation", ratio: "16:9", width: 12192000, height: 6858000 },
  { key: "portrait", label: "Portrait", ratio: "9:16", width: 6858000, height: 12192000 },
  { key: "square", label: "Square", ratio: "1:1", width: 9144000, height: 9144000 },
  { key: "tall-card", label: "Tall card", ratio: "4:5", width: 7315200, height: 9144000 },
];

type SetupScreenProps = {
  onStart: (params: {
    prompt: string;
    action: SetupAction;
    documentType?: DocumentType;
    slideDimensions?: SlideDimensions;
  }) => Promise<void>;
  loading: boolean;
  error?: string | null;
  onBack?: () => void;
};

export function SetupScreen({
  onStart,
  loading,
  error,
  onBack,
}: SetupScreenProps) {
  const [prompt, setPrompt] = useState("");
  const [selectedFormat, setSelectedFormat] = useState("presentation");

  async function handleSubmit(skipPrompt = false) {
    if (!skipPrompt && !prompt.trim()) return;
    if (loading) return;

    const preset = FORMAT_PRESETS.find((p) => p.key === selectedFormat) ?? FORMAT_PRESETS[0];
    await onStart({
      prompt: skipPrompt ? "" : prompt.trim(),
      action: "create",
      documentType: "pptx",
      slideDimensions: { width: preset.width, height: preset.height },
    });
  }

  return (
    <div className="relative flex h-full min-h-0 bg-muted px-4 py-6 sm:px-8 lg:px-12">
      {onBack && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute left-3 top-3 z-20 h-8 w-8"
          onClick={onBack}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
      )}

      <main className="mx-auto flex w-full max-w-3xl flex-col justify-center py-10">
        <header className="mb-7">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Create a presentation
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Set the slide dimensions and describe the first draft you want Dude to build.
          </p>
        </header>

        <div className="space-y-6 rounded-lg border border-border/60 bg-card p-5 shadow-sm sm:p-6">
          <section>
            <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              <RectangleHorizontal className="h-3.5 w-3.5" />
              Dimensions
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {FORMAT_PRESETS.map((preset) => {
                const active = selectedFormat === preset.key;
                const aspect = preset.width / preset.height;
                const thumbH = 22;
                const thumbW = Math.max(12, Math.round(thumbH * aspect));
                return (
                  <button
                    key={preset.key}
                    type="button"
                    onClick={() => setSelectedFormat(preset.key)}
                    className={cn(
                      "flex min-h-[92px] flex-col items-center justify-center gap-2 rounded-lg border px-3 py-3 text-center transition-colors",
                      active
                        ? "border-foreground/80 bg-muted text-foreground"
                        : "border-border/60 bg-background text-foreground hover:bg-muted/50",
                    )}
                  >
                    <div
                      className="rounded-[3px] border border-foreground/60"
                      style={{ width: thumbW, height: thumbH }}
                    />
                    <span className="text-xs font-medium leading-tight">{preset.label}</span>
                    <span className="text-[11px] leading-none text-muted-foreground">{preset.ratio}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <section>
            <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5" />
              Initial prompt
            </div>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={
                "Topic, audience, key sections, length...\n\n" +
                'e.g. "15-minute Series B pitch for a dev-tools startup, aimed at enterprise engineering buyers. Cover problem, product demo, traction, team, and ask."'
              }
              rows={9}
              className="block min-h-[220px] w-full resize-none rounded-lg border border-border/60 bg-background px-4 py-3 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/50 outline-none transition-colors focus:border-foreground/40"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  void handleSubmit();
                }
              }}
            />
          </section>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex flex-col gap-2 border-t border-border/50 pt-4 sm:flex-row">
            <Button
              onClick={() => void handleSubmit(true)}
              disabled={loading}
              variant="outline"
              className="h-10 flex-1 text-sm"
            >
              {loading && !prompt.trim() ? (
                <>
                  <BrailleSpinner className="text-sm" />
                  Creating...
                </>
              ) : (
                "Start blank"
              )}
            </Button>
            <Button
              onClick={() => void handleSubmit()}
              disabled={!prompt.trim() || loading}
              className="h-10 flex-1 gap-1.5 text-sm"
            >
              {loading && prompt.trim() ? (
                <>
                  <BrailleSpinner className="text-sm" />
                  Setting up...
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5" />
                  Build presentation
                  <ArrowRight className="h-3.5 w-3.5" />
                </>
              )}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
