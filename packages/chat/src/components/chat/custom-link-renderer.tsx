"use client";

import { ExternalLink } from "lucide-react";
import { ReactNode } from "react";

interface CustomLinkProps {
  href?: string;
  children?: ReactNode;
}

/**
 * Extracts domain from URL
 */
function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/**
 * Get favicon URL using Google's favicon service
 */
function getFaviconUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    return `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=16`;
  } catch {
    return "";
  }
}

/**
 * Custom link renderer for chat markdown
 * Renders links as styled badges with favicons
 */
export function CustomLinkRenderer({ href, children }: CustomLinkProps) {
  if (!href) {
    return <span>{children}</span>;
  }

  const domain = extractDomain(href);
  const faviconUrl = getFaviconUrl(href);
  const displayText = typeof children === 'string' ? children : domain;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 px-2 py-0.5 mx-0.5
                 bg-secondary/60 hover:bg-secondary 
                 border border-border/40 hover:border-border
                 rounded-md text-sm transition-all duration-150
                 text-foreground/80 hover:text-foreground
                 no-underline hover:no-underline"
    >
      {/* Favicon */}
      <img
        src={faviconUrl}
        alt=""
        className="w-3.5 h-3.5 rounded-sm flex-shrink-0"
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = 'none';
        }}
      />
      
      {/* Link text */}
      <span className="truncate max-w-[200px]">{displayText}</span>
      
      {/* External link icon */}
      <ExternalLink className="w-3 h-3 text-muted-foreground/60 flex-shrink-0" />
    </a>
  );
}

