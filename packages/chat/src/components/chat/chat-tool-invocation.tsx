"use client";

import { BrailleSpinner } from "@dude/ui/components/braille-spinner";

interface ToolPartProps {
  toolPart: {
    type: string;
    toolCallId: string;
    toolName?: string;
    state: string;
    input? : JsonValue;
    output? : JsonValue;
    errorText?: string;
  };
}

function getToolName(part: ToolPartProps["toolPart"]): string {
  if (part.type === "dynamic-tool") return part.toolName || "unknown";
  if (part.type.startsWith("tool-")) return part.type.slice(5);
  return "unknown";
}

export function ChatToolInvocation({ toolPart }: ToolPartProps) {
  const toolName = getToolName(toolPart);
  const { state, input, output } = toolPart;

  const isLoading = state === "input-streaming" || state === "input-available";
  const hasOutput = state === "output-available";
  const hasError = state === "output-error";

  // webSearch tool
  if (toolName === "webSearch") {
    if (isLoading) {
      return (
        <div className="flex items-center gap-2 p-3 bg-muted rounded-lg my-2">
          <BrailleSpinner className="text-sm" />
          <span className="text-sm text-muted-foreground">
            {input?.statusText || "Searching the web..."}
          </span>
        </div>
      );
    }
    if (hasOutput && output && typeof output === "string") {
      if (output.startsWith("Error")) {
        return (
          <div className="p-3 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 rounded-lg my-2 text-sm">
            {output}
          </div>
        );
      }
      // Extract source links from the result
      const sourcesMatch = output.match(/\*\*Sources:\*\*\s*([\s\S]+?)(?=\n\n|$)/);
      if (sourcesMatch) {
        const sourceLinks: { label: string; url: string }[] = [];
        const linkRe = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;
        let m;
        while ((m = linkRe.exec(sourcesMatch[1])) !== null) {
          sourceLinks.push({ label: m[1], url: m[2] });
        }
        if (sourceLinks.length > 0) {
          return (
            <div className="my-1.5 py-2 px-3 rounded-lg bg-muted/40 border border-border/40 text-sm">
              <span className="text-muted-foreground font-medium mr-2">Sources:</span>
              {sourceLinks.map((s, i) => (
                <span key={i}>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    {s.label}
                  </a>
                  {i < sourceLinks.length - 1 && (
                    <span className="text-muted-foreground mx-1.5">&bull;</span>
                  )}
                </span>
              ))}
            </div>
          );
        }
      }
      return null;
    }
    if (hasError) {
      return (
        <div className="p-3 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 rounded-lg my-2 text-sm">
          {toolPart.errorText || "Search failed"}
        </div>
      );
    }
  }

  // generateImage tool
  if (toolName === "generateImage") {
    if (isLoading) {
      return (
        <div className="flex items-center gap-2 p-3 bg-muted rounded-lg my-2">
          <BrailleSpinner className="text-sm" />
          <span className="text-sm text-muted-foreground">
            {input?.statusText || "Generating image..."}
          </span>
        </div>
      );
    }
    if (hasOutput && output && typeof output === "string") {
      if (output.startsWith("Error")) {
        return (
          <div className="p-3 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 rounded-lg my-2 text-sm">
            {output}
          </div>
        );
      }
      if (output.startsWith("http")) {
        return (
          <div className="my-2">
            <a href={output} target="_blank" rel="noopener noreferrer">
              <img
                src={output}
                alt="Generated image"
                className="rounded-lg max-w-full hover:opacity-90 transition-opacity"
                style={{ maxWidth: "400px", maxHeight: "400px", objectFit: "contain" }}
              />
            </a>
          </div>
        );
      }
    }
  }

  // interpretImage tool
  if (toolName === "interpretImage") {
    if (isLoading) {
      return (
        <div className="flex items-center gap-2 p-3 bg-muted rounded-lg my-2">
          <BrailleSpinner className="text-sm" />
          <span className="text-sm text-muted-foreground">
            {input?.statusText || "Analyzing image..."}
          </span>
        </div>
      );
    }
    // Result is incorporated into the assistant text, no separate rendering needed
    return null;
  }

  // ragLookup tool
  if (toolName === "ragLookup") {
    if (isLoading) {
      return (
        <div className="flex items-center gap-2 p-3 bg-muted rounded-lg my-2">
          <BrailleSpinner className="text-sm" />
          <span className="text-sm text-muted-foreground">Searching documents...</span>
        </div>
      );
    }
    return null;
  }

  // Generic tool - show loading only
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-3 bg-muted rounded-lg my-2">
        <BrailleSpinner className="text-sm" />
        <span className="text-sm text-muted-foreground">Processing...</span>
      </div>
    );
  }

  return null;
}
