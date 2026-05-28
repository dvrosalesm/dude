"use client";

import { cn } from "@dude/ui/design-system";

export function GeneratedImageCard({
  src,
  alt = "Generated image",
  onClick,
  size = "stage",
}: {
  src: string;
  alt?: string;
  onClick?: (src: string) => void;
  size?: "stage" | "inline";
}) {
  const isStage = size === "stage";
  return (
    <div className="flex w-full justify-center py-1">
      <button
        type="button"
        onClick={() => onClick?.(src)}
        className={cn(
          "block overflow-hidden rounded-2xl border border-border/40 bg-[var(--dude-surface-2)] shadow-md transition-opacity hover:opacity-95",
          isStage ? "w-full max-w-2xl" : "w-full max-w-md",
        )}
      >
        <img
          src={src}
          alt={alt}
          className={cn(
            "mx-auto w-full object-contain",
            isStage ? "max-h-[min(60vh,520px)]" : "max-h-80",
          )}
        />
      </button>
    </div>
  );
}

export function GeneratedImageGallery({
  urls,
  onClick,
  size = "stage",
}: {
  urls: string[];
  onClick?: (src: string) => void;
  size?: "stage" | "inline";
}) {
  if (!urls.length) return null;
  return (
    <div
      className={cn(
        "flex w-full flex-col items-center gap-4",
        size === "stage" ? "py-2" : "py-1",
      )}
    >
      {urls.map((src, index) => (
        <GeneratedImageCard
          key={`${src}-${index}`}
          src={src}
          alt={`Generated image ${index + 1}`}
          onClick={onClick}
          size={size}
        />
      ))}
    </div>
  );
}
