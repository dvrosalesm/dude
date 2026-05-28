import type { JSONContent } from "@tiptap/react";
import type { DocumentBlock } from "@dude/subagent-document-writer/types";

function generateBlockId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ── Helpers ──────────────────────────────────────────────────────────

function textNode(text: string): JSONContent {
  return { type: "text", text };
}

function extractText(node: JSONContent): string {
  if (node.type === "text") return node.text ?? "";
  if (!node.content) return "";
  return node.content.map(extractText).join("");
}

// ── Inline HTML serialization ────────────────────────────────────────

const MARK_TO_TAG: Record<string, { open: string; close: string }> = {
  bold: { open: "<strong>", close: "</strong>" },
  italic: { open: "<em>", close: "</em>" },
  underline: { open: "<u>", close: "</u>" },
  strike: { open: "<s>", close: "</s>" },
  code: { open: "<code>", close: "</code>" },
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Walk Tiptap inline content nodes and serialize to an HTML string. */
export function serializeInlineContent(nodes?: JSONContent[]): string {
  if (!nodes || nodes.length === 0) return "";

  return nodes
    .map((node) => {
      if (node.type === "hardBreak") return "<br>";

      if (node.type !== "text" || !node.text) return "";

      let html = escapeHtml(node.text);

      if (node.marks) {
        for (const mark of node.marks) {
          if (mark.type === "link" && mark.attrs?.href) {
            html = `<a href="${escapeHtml(mark.attrs.href)}">${html}</a>`;
          } else if (mark.type === "textStyle" && mark.attrs?.color) {
            html = `<span style="color:${escapeHtml(mark.attrs.color)}">${html}</span>`;
          } else if (mark.type === "highlight" && mark.attrs?.color) {
            html = `<mark style="background-color:${escapeHtml(mark.attrs.color)}">${html}</mark>`;
          } else if (mark.type === "highlight") {
            html = `<mark>${html}</mark>`;
          } else {
            const tag = MARK_TO_TAG[mark.type];
            if (tag) {
              html = `${tag.open}${html}${tag.close}`;
            }
          }
        }
      }

      return html;
    })
    .join("");
}

/** Parse an HTML string back into Tiptap inline content nodes with marks. */
export function parseInlineContent(html: string): JSONContent[] {
  if (!html) return [];

  // If the string contains no HTML tags, return plain text
  if (!/<[a-z][\s\S]*>/i.test(html)) {
    return [textNode(html)];
  }

  // SSR guard: DOMParser only available in browser
  if (typeof DOMParser === "undefined") {
    return [textNode(html.replace(/<[^>]*>/g, ""))];
  }

  const TAG_TO_MARK: Record<string, string> = {
    STRONG: "bold",
    B: "bold",
    EM: "italic",
    I: "italic",
    U: "underline",
    S: "strike",
    DEL: "strike",
    CODE: "code",
  };

  const result: JSONContent[] = [];

  function walk(node: Node, marks: JSONContent[]) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? "";
      if (!text) return;
      const textN: JSONContent = { type: "text", text };
      if (marks.length > 0) textN.marks = [...marks];
      result.push(textN);
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as Element;

    if (el.tagName === "BR") {
      result.push({ type: "hardBreak" });
      return;
    }

    const newMarks = [...marks];

    // Check for link
    if (el.tagName === "A") {
      const href = el.getAttribute("href");
      if (href) {
        newMarks.push({ type: "link", attrs: { href } });
      }
    }

    // Check for mark/highlight
    if (el.tagName === "MARK") {
      const bgColor = (el as HTMLElement).style?.backgroundColor;
      newMarks.push(bgColor
        ? { type: "highlight", attrs: { color: bgColor } }
        : { type: "highlight" });
    }

    // Check for span with style (text color, etc.)
    if (el.tagName === "SPAN") {
      const style = (el as HTMLElement).style;
      if (style?.color) {
        newMarks.push({ type: "textStyle", attrs: { color: style.color } });
      }
      if (style?.backgroundColor) {
        newMarks.push({ type: "highlight", attrs: { color: style.backgroundColor } });
      }
    }

    // Check for inline marks
    const markType = TAG_TO_MARK[el.tagName];
    if (markType) {
      newMarks.push({ type: markType });
    }

    for (const child of Array.from(el.childNodes)) {
      walk(child, newMarks);
    }
  }

  const doc = new DOMParser().parseFromString(html, "text/html");
  for (const child of Array.from(doc.body.childNodes)) {
    walk(child, []);
  }

  return result.length > 0 ? result : [textNode(html)];
}

function richParagraphNode(html: string): JSONContent {
  const content = parseInlineContent(html);
  return {
    type: "paragraph",
    content: content.length > 0 ? content : undefined,
  };
}

function blockText(content: unknown): string {
  return typeof content === "string" ? content : "";
}

// ── blocksToTiptapDoc ────────────────────────────────────────────────

export function blocksToTiptapDoc(
  blocks: DocumentBlock[],
  _title: string,
): JSONContent {
  const content: JSONContent[] = [];

  for (const block of blocks) {
    switch (block.type) {
      case "heading1":
      case "heading2":
      case "heading3": {
        const level = block.type === "heading1" ? 1 : block.type === "heading2" ? 2 : 3;
        const inlineContent = parseInlineContent(blockText(block.content));
        content.push({
          type: "heading",
          attrs: { level },
          content: inlineContent.length > 0 ? inlineContent : undefined,
        });
        break;
      }

      case "paragraph":
        content.push(richParagraphNode(blockText(block.content)));
        break;

      case "bulletList": {
        const items = blockText(block.content).split("\n").filter((l) => l !== "");
        content.push({
          type: "bulletList",
          content: items.length
            ? items.map((item) => ({
                type: "listItem",
                content: [richParagraphNode(item)],
              }))
            : [{ type: "listItem", content: [richParagraphNode("")] }],
        });
        break;
      }

      case "numberedList": {
        const items = blockText(block.content).split("\n").filter((l) => l !== "");
        content.push({
          type: "orderedList",
          content: items.length
            ? items.map((item) => ({
                type: "listItem",
                content: [richParagraphNode(item)],
              }))
            : [{ type: "listItem", content: [richParagraphNode("")] }],
        });
        break;
      }

      case "code":
        // Code blocks stay plain text — no inline HTML
        content.push({
          type: "codeBlock",
          content: blockText(block.content) ? [textNode(blockText(block.content))] : undefined,
        });
        break;

      case "quote":
        content.push({
          type: "blockquote",
          content: [richParagraphNode(blockText(block.content))],
        });
        break;

      case "callout": {
        const variant = (block.meta as { variant?: string })?.variant || "info";
        content.push({
          type: "blockquote",
          attrs: { class: `callout callout-${variant}` },
          content: [richParagraphNode(blockText(block.content))],
        });
        break;
      }

      case "divider":
        content.push({ type: "horizontalRule" });
        break;

      case "table": {
        const meta = block.meta as
          | { headers?: string[]; rows?: string[][] }
          | undefined;
        if (!meta) break;
        const tableContent: JSONContent[] = [];
        if (meta.headers) {
          tableContent.push({
            type: "tableRow",
            content: meta.headers.map((h) => ({
              type: "tableHeader",
              content: [richParagraphNode(h)],
            })),
          });
        }
        if (meta.rows) {
          for (const row of meta.rows) {
            tableContent.push({
              type: "tableRow",
              content: row.map((cell) => ({
                type: "tableCell",
                content: [richParagraphNode(cell)],
              })),
            });
          }
        }
        if (tableContent.length) {
          content.push({ type: "table", content: tableContent });
        }
        break;
      }

      case "image": {
        const meta = block.meta as { url?: string } | undefined;
        if (meta?.url) {
          content.push({
            type: "image",
            attrs: { src: meta.url },
          });
        }
        break;
      }
    }
  }

  // Return at least an empty paragraph so Tiptap has something to render
  if (content.length === 0) {
    content.push(richParagraphNode(""));
  }

  return { type: "doc", content };
}

// ── tiptapDocToBlocks ────────────────────────────────────────────────

function serializeNodeContent(node: JSONContent): string {
  return serializeInlineContent(node.content);
}

export function tiptapDocToBlocks(doc: JSONContent): {
  blocks: DocumentBlock[];
  title: string;
} {
  const blocks: DocumentBlock[] = [];
  const title = "";

  if (!doc.content) return { blocks, title };

  for (const node of doc.content) {
    switch (node.type) {
      case "heading": {
        const level = node.attrs?.level ?? 1;
        const type =
          level === 1 ? "heading1" : level === 2 ? "heading2" : "heading3";
        blocks.push({
          id: generateBlockId(),
          type,
          content: serializeNodeContent(node),
        });
        break;
      }

      case "paragraph":
        blocks.push({
          id: generateBlockId(),
          type: "paragraph",
          content: serializeNodeContent(node),
        });
        break;

      case "bulletList": {
        const items =
          node.content
            ?.map((li) => {
              // listItem > paragraph — serialize the paragraph's content
              const para = li.content?.find((c) => c.type === "paragraph");
              return para ? serializeInlineContent(para.content) : extractText(li);
            })
            .join("\n") ?? "";
        blocks.push({
          id: generateBlockId(),
          type: "bulletList",
          content: items,
        });
        break;
      }

      case "orderedList": {
        const items =
          node.content
            ?.map((li) => {
              const para = li.content?.find((c) => c.type === "paragraph");
              return para ? serializeInlineContent(para.content) : extractText(li);
            })
            .join("\n") ?? "";
        blocks.push({
          id: generateBlockId(),
          type: "numberedList",
          content: items,
        });
        break;
      }

      case "codeBlock":
        // Code blocks stay plain text
        blocks.push({
          id: generateBlockId(),
          type: "code",
          content: extractText(node),
        });
        break;

      case "blockquote": {
        // blockquote > paragraph — serialize the paragraph's content
        const para = node.content?.find((c) => c.type === "paragraph");
        blocks.push({
          id: generateBlockId(),
          type: "quote",
          content: para ? serializeInlineContent(para.content) : extractText(node),
        });
        break;
      }

      case "horizontalRule":
        blocks.push({
          id: generateBlockId(),
          type: "divider",
          content: "",
        });
        break;

      case "table": {
        const headers: string[] = [];
        const rows: string[][] = [];

        node.content?.forEach((row, rowIdx) => {
          const cells =
            row.content?.map((cell) => {
              const para = cell.content?.find((c) => c.type === "paragraph");
              return para ? serializeInlineContent(para.content) : extractText(cell);
            }) ?? [];
          // First row with tableHeader cells → headers
          if (
            rowIdx === 0 &&
            row.content?.some((c) => c.type === "tableHeader")
          ) {
            headers.push(...cells);
          } else {
            rows.push(cells);
          }
        });

        blocks.push({
          id: generateBlockId(),
          type: "table",
          content: "",
          meta: { headers, rows },
        });
        break;
      }

      case "image":
        blocks.push({
          id: generateBlockId(),
          type: "image",
          content: "",
          meta: { url: node.attrs?.src ?? "" },
        });
        break;
    }
  }

  return { blocks, title };
}
