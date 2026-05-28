"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CustomLinkRenderer } from "./custom-link-renderer";
import { flattenStageMarkdown } from "../../lib/chat/flatten-stage-markdown";

export {
  formatDreamSummary,
  shouldShowDreamSummary,
} from "../../lib/chat/markdown-summary";

interface ChatMarkdownProps {
  content: string;
  /** Stage layout: centered prose without list bullets/numbers. Dream: soft caption under visuals. */
  variant?: "default" | "stage" | "dream";
}

export function ChatMarkdown({ content, variant = "default" }: ChatMarkdownProps) {
  const isDream = variant === "dream";
  const isStage = variant === "stage" || isDream;
  const markdownContent = isStage ? flattenStageMarkdown(content) : content;

  const markdown = (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        a: ({ href, children }) => (
          <CustomLinkRenderer href={href}>{children}</CustomLinkRenderer>
        ),
        pre: ({ children }) => (
          <pre className="overflow-x-auto rounded-lg bg-muted p-3 my-2 text-sm">
            {children}
          </pre>
        ),
        code: ({ children, className }) => {
          const isInline = !className;
          if (isInline) {
            return (
              <code className="rounded bg-muted px-1.5 py-0.5 text-sm font-mono">
                {children}
              </code>
            );
          }
          return <code className={className}>{children}</code>;
        },
        hr: () => <hr className="my-4 border-border/60" />,
        table: ({ children }) => (
          <div className="my-2 overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">{children}</table>
          </div>
        ),
        thead: ({ children }) => (
          <thead className="bg-muted/50 border-b border-border">{children}</thead>
        ),
        th: ({ children }) => (
          <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">{children}</th>
        ),
        td: ({ children }) => (
          <td className="px-3 py-2 border-t border-border/50">{children}</td>
        ),
        ul: ({ children }) =>
          isStage ? (
            <div className="chat-markdown-list my-2 space-y-1.5">{children}</div>
          ) : (
            <ul className="my-1 list-disc space-y-0.5 pl-5">{children}</ul>
          ),
        ol: ({ children }) =>
          isStage ? (
            <div className="chat-markdown-list my-2 space-y-1.5">{children}</div>
          ) : (
            <ol className="my-1 list-decimal space-y-0.5 pl-5">{children}</ol>
          ),
        li: ({ children }) =>
          isStage ? (
            <div className="chat-markdown-list-item leading-relaxed">{children}</div>
          ) : (
            <li>{children}</li>
          ),
        p: ({ children }) => (
          <p
            className={
              isDream
                ? "my-1 leading-[1.75] tracking-[0.02em]"
                : isStage
                  ? "my-1.5 leading-relaxed"
                  : "my-1 leading-relaxed"
            }
          >
            {children}
          </p>
        ),
        em: ({ children }) =>
          isDream ? (
            <span className="dream-markdown-em">{children}</span>
          ) : (
            <em>{children}</em>
          ),
        strong: ({ children }) => (
          <strong className={isDream ? "font-medium text-foreground/80" : "font-semibold"}>
            {children}
          </strong>
        ),
        blockquote: ({ children }) =>
          isDream ? (
            <blockquote className="dream-markdown-quote">{children}</blockquote>
          ) : (
            <blockquote className="my-2 border-l-2 border-border/60 pl-3 text-muted-foreground">
              {children}
            </blockquote>
          ),
      }}
    >
      {markdownContent}
    </ReactMarkdown>
  );

  if (isDream) {
    return <div className="chat-markdown-dream">{markdown}</div>;
  }

  if (!isStage) return markdown;

  return <div className="chat-markdown-stage">{markdown}</div>;
}
