"use client";

import { useCallback } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import { Image } from "@tiptap/extension-image";
import { Label } from "@dude/ui/components/label";
import { Input } from "@dude/ui/components/input";
import { Separator } from "@dude/ui/components/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@dude/ui/components/select";
import { useDocumentWriterStore } from "@dude/specialist-document-writer/store";
import { MiniToolbar } from "./mini-toolbar";

type LayoutTabProps = {
  onSave: (updates: Record<string, unknown>) => void;
};

type MarginPreset = "normal" | "narrow" | "wide" | "none" | "custom";

const MARGIN_PRESETS: Record<Exclude<MarginPreset, "custom">, { top: string; right: string; bottom: string; left: string }> = {
  normal: { top: "1", right: "1", bottom: "1", left: "1" },
  narrow: { top: "0.5", right: "0.5", bottom: "0.5", left: "0.5" },
  wide: { top: "1", right: "1.5", bottom: "1", left: "1.5" },
  none: { top: "0", right: "0", bottom: "0", left: "0" },
};

const MINI_EXTENSIONS = [
  StarterKit.configure({
    heading: false,
    codeBlock: false,
    blockquote: false,
    bulletList: false,
    orderedList: false,
    horizontalRule: false,
  }),
  Underline,
  Link.configure({
    openOnClick: false,
    HTMLAttributes: { class: "text-primary underline" },
  }),
  TextAlign.configure({ types: ["paragraph"] }),
  Image,
];

function useMiniEditor(
  initialContent: string,
  placeholder: string,
  onChange: (html: string) => void,
) {
  return useEditor({
    immediatelyRender: false,
    extensions: [
      ...MINI_EXTENSIONS,
      Placeholder.configure({ placeholder }),
    ],
    content: initialContent || "<p></p>",
    onUpdate: ({ editor: ed }) => {
      const html = ed.getHTML();
      onChange(html === "<p></p>" ? "" : html);
    },
    editorProps: {
      attributes: {
        class:
          "tiptap prose prose-sm max-w-none focus:outline-none min-h-[60px] px-3 py-2 text-sm bg-card",
      },
    },
  });
}

export function LayoutTab({ onSave }: LayoutTabProps) {
  const pageLayout = useDocumentWriterStore((s) => s.pageLayout);
  const setPageLayout = useDocumentWriterStore((s) => s.setPageLayout);

  const saveLayout = useCallback(
    (updates: Record<string, string>) => {
      setPageLayout(updates);
      const next = { ...useDocumentWriterStore.getState().pageLayout, ...updates };
      onSave({ pageLayout: next });
    },
    [setPageLayout, onSave],
  );

  const headerEditor = useMiniEditor(
    pageLayout.headerHtml,
    "Type header content... (appears on every page)",
    (html) => saveLayout({ headerHtml: html }),
  );

  const footerEditor = useMiniEditor(
    pageLayout.footerHtml,
    "Type footer content... (appears on every page)",
    (html) => saveLayout({ footerHtml: html }),
  );

  const handlePresetChange = useCallback(
    (preset: MarginPreset) => {
      if (preset === "custom") {
        saveLayout({ marginPreset: "custom" });
        return;
      }
      const values = MARGIN_PRESETS[preset];
      saveLayout({
        marginPreset: preset,
        marginTop: values.top,
        marginRight: values.right,
        marginBottom: values.bottom,
        marginLeft: values.left,
      });
    },
    [saveLayout],
  );

  const handleMarginInput = useCallback(
    (key: string, value: string) => {
      saveLayout({ [key]: value, marginPreset: "custom" });
    },
    [saveLayout],
  );

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="mx-auto max-w-2xl space-y-8">
        {/* Header */}
        <section className="space-y-3">
          <div>
            <h3 className="text-sm font-medium">
              {"Page Header"}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {"Content shown at the top of every printed/PDF page. You can add text, images, and formatting."}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            {headerEditor && <MiniToolbar editor={headerEditor} />}
            <EditorContent editor={headerEditor} />
          </div>
        </section>

        <Separator />

        {/* Footer */}
        <section className="space-y-3">
          <div>
            <h3 className="text-sm font-medium">
              {"Page Footer"}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {"Content shown at the bottom of every printed/PDF page. You can add text, images, and formatting."}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            {footerEditor && <MiniToolbar editor={footerEditor} />}
            <EditorContent editor={footerEditor} />
          </div>
        </section>

        <Separator />

        {/* Margins */}
        <section className="space-y-3">
          <div>
            <h3 className="text-sm font-medium">
              {"Page Margins"}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {"Set the margins for printed/PDF output."}
            </p>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">
              {"Preset"}
            </Label>
            <Select
              value={pageLayout.marginPreset}
              onValueChange={(v) => handlePresetChange(v as MarginPreset)}
            >
              <SelectTrigger className="mt-1 bg-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="normal">{"Normal (1\")"}</SelectItem>
                <SelectItem value="narrow">{"Narrow (0.5\")"}</SelectItem>
                <SelectItem value="wide">{"Wide (1.5\" sides)"}</SelectItem>
                <SelectItem value="none">{"None"}</SelectItem>
                <SelectItem value="custom">{"Custom"}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">
                {"Top (in)"}
              </Label>
              <Input
                type="number"
                min="0"
                max="3"
                step="0.25"
                value={pageLayout.marginTop}
                onChange={(e) => handleMarginInput("marginTop", e.target.value)}
                className="mt-1 h-8 text-sm bg-card"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">
                {"Bottom (in)"}
              </Label>
              <Input
                type="number"
                min="0"
                max="3"
                step="0.25"
                value={pageLayout.marginBottom}
                onChange={(e) => handleMarginInput("marginBottom", e.target.value)}
                className="mt-1 h-8 text-sm bg-card"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">
                {"Left (in)"}
              </Label>
              <Input
                type="number"
                min="0"
                max="3"
                step="0.25"
                value={pageLayout.marginLeft}
                onChange={(e) => handleMarginInput("marginLeft", e.target.value)}
                className="mt-1 h-8 text-sm bg-card"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">
                {"Right (in)"}
              </Label>
              <Input
                type="number"
                min="0"
                max="3"
                step="0.25"
                value={pageLayout.marginRight}
                onChange={(e) => handleMarginInput("marginRight", e.target.value)}
                className="mt-1 h-8 text-sm bg-card"
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
