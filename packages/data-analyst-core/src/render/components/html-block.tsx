"use client";

import { sanitizeArtifactHtml } from "../utils";

type HtmlBlockProps = {
  content: string;
};

function buildSrcDoc(content: string): string {
  const sanitized = sanitizeArtifactHtml(content);
  return `<!doctype html><html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><style>html,body{margin:0;padding:0;background:transparent;color:inherit;font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,sans-serif}*,*::before,*::after{box-sizing:border-box}</style></head><body>${sanitized}</body></html>`;
}

export function HtmlBlockRenderer({ props }: { props: HtmlBlockProps }) {
  const { content } = props;

  if (!content?.trim()) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        No content
      </div>
    );
  }

  return (
    <iframe
      title="HTML report"
      srcDoc={buildSrcDoc(content)}
      sandbox=""
      className="h-full w-full border-0 bg-transparent"
    />
  );
}
