import {
  commitPptxContent,
  getPptxContent,
  recordDocumentChange,
} from "./document-editor-store-bridge";
import type { PptxContent } from "@dude/presentation-editor/types";

export function getContent(): PptxContent | null {
  return getPptxContent();
}

export function commitContent(content: PptxContent) {
  commitPptxContent(content);
}

export { recordDocumentChange };
