/**
 * Strip external links from agent-authored landing page HTML.
 *
 * Allowed hrefs:
 *   - In-page anchors: href="#features". Left as-is — the iframe runs a
 *     click interceptor that smooth-scrolls to the target element. We
 *     don't rewrite to an absolute path because the iframe's
 *     <base href> would turn that into a full navigation.
 * Anything else (footer links, external icons, mailto:, tel:, javascript:,
 * cross-page links) gets rewritten to <span> so the visual layout survives
 * but the dead link disappears.
 *
 * Inline style/class attributes are preserved on the span. href, target,
 * and inline event handlers are dropped.
 */
export interface SanitizeOptions {
  allowedPageIds?: string[];
}

export function sanitizeLandingHtml(
  html: string,
  options: SanitizeOptions = {},
): string {
  if (!html) return html;
  void options;

  return html.replace(
    /<a\b([^>]*)>([\s\S]*?)<\/a>/gi,
    (match, rawAttrs: string, inner: string) => {
      const hrefMatch = rawAttrs.match(/\bhref\s*=\s*(["'])([^"']*)\1/i);
      const href = hrefMatch ? hrefMatch[2].trim() : "";

      if (href.startsWith("#")) return match;

      const cleaned = rawAttrs
        .replace(/\bhref\s*=\s*(["'])[^"']*\1/i, "")
        .replace(/\btarget\s*=\s*(["'])[^"']*\1/gi, "")
        .replace(/\bon\w+\s*=\s*(["'])[^"']*\1/gi, "")
        .replace(/\s+/g, " ")
        .trim();

      return cleaned ? `<span ${cleaned}>${inner}</span>` : `<span>${inner}</span>`;
    },
  );
}
