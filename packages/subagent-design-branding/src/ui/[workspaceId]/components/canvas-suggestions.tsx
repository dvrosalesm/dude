"use client";

import { Layers, Palette, Sparkles, Target, Image as ImageIcon } from "lucide-react";

interface Suggestion {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  prompt: string;
}

const SUGGESTIONS: Suggestion[] = [
  {
    icon: Sparkles,
    label: "Start a brand",
    prompt:
      "Help me start a brand from scratch. Ask me 3 short questions about the business, audience, and vibe, then draft a brand brief on the canvas.",
  },
  {
    icon: Target,
    label: "Generate logo concepts",
    prompt:
      "Generate 4 distinct logo concepts. Ask me the brand name and one-line context first, then place each concept on the canvas with a short rationale.",
  },
  {
    icon: Palette,
    label: "Build a color palette",
    prompt:
      "Build a primary color palette plus neutrals and a semantic accent. Ask me the mood in 3 words first, then save it to the canvas with usage hints.",
  },
  {
    icon: Layers,
    label: "Mock a hero section",
    prompt:
      "Mock a website hero section. Ask me the product and tone, then generate 2 hero variants on the canvas inside labeled 16:9 frames.",
  },
  {
    icon: ImageIcon,
    label: "Create a mood board",
    prompt:
      "Create a mood board with 6 reference images. Ask me 3 mood words first, then place the images and 2-3 sticky notes on the canvas.",
  },
];

interface CanvasSuggestionsProps {
  onSelect: (prompt: string) => void;
  title: string;
  subtitle: string;
}

export function CanvasSuggestions({
  onSelect,
  title,
  subtitle,
}: CanvasSuggestionsProps) {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center px-6">
      <div className="pointer-events-auto flex w-full max-w-xl flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">
            {title}
          </h2>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {SUGGESTIONS.map((s) => {
            const Icon = s.icon;
            return (
              <button
                key={s.label}
                type="button"
                onClick={() => onSelect(s.prompt)}
                className="group flex items-center gap-2 rounded-full bg-[var(--dude-surface-2)] px-4 py-2 text-sm text-foreground transition hover:bg-[var(--dude-accent-soft)]"
              >
                <Icon className="h-3.5 w-3.5 text-muted-foreground transition group-hover:text-foreground" />
                <span>{s.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
