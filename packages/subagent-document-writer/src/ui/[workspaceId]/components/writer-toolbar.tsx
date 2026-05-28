"use client";

import { useState, useCallback } from "react";
import type { Editor } from "@tiptap/react";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code,
  Link2,
  Heading1,
  Heading2,
  Heading3,
  Pilcrow,
  CodeSquare,
  Quote,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Table2,
  ImageIcon,
  Sparkles,
  Minus,
  Unlink,
  PanelLeft,
} from "lucide-react";
import { Button } from "@dude/ui/components/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@dude/ui/components/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@dude/ui/components/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@dude/ui/components/select";
import { Separator } from "@dude/ui/components/separator";
import { Input } from "@dude/ui/components/input";
import { InsertTableDialog } from "@dude/presentation-editor/components/insert-table-dialog";
import { InsertImageDialog } from "@dude/presentation-editor/components/insert-image-dialog";
import { InsertAiImageDialog } from "@dude/presentation-editor/components/insert-ai-image-dialog";

type WriterToolbarProps = {
  editor: Editor;
  showChat: boolean;
  onToggleChat: () => void;
};

type ToolbarButtonProps = {
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
  active?: boolean;
  onClick: () => void;
  disabled?: boolean;
};

function ToolbarButton({
  icon,
  label,
  shortcut,
  active,
  onClick,
  disabled,
}: ToolbarButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClick}
          disabled={disabled}
          className={`h-8 w-8 p-0 ${active ? "bg-muted" : ""}`}
        >
          {icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>
          {label}
          {shortcut && (
            <span className="ml-2 text-muted-foreground">{shortcut}</span>
          )}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}

export function WriterToolbar({ editor, showChat, onToggleChat }: WriterToolbarProps) {
  const [linkUrl, setLinkUrl] = useState("");
  const [linkOpen, setLinkOpen] = useState(false);
  const [tableOpen, setTableOpen] = useState(false);
  const [imageOpen, setImageOpen] = useState(false);
  const [aiImageOpen, setAiImageOpen] = useState(false);

  const getBlockType = useCallback((): string => {
    if (editor.isActive("heading", { level: 1 })) return "h1";
    if (editor.isActive("heading", { level: 2 })) return "h2";
    if (editor.isActive("heading", { level: 3 })) return "h3";
    if (editor.isActive("codeBlock")) return "code";
    if (editor.isActive("blockquote")) return "quote";
    return "paragraph";
  }, [editor]);

  const handleBlockTypeChange = useCallback(
    (value: string) => {
      switch (value) {
        case "paragraph":
          editor.chain().focus().setParagraph().run();
          break;
        case "h1":
          editor.chain().focus().toggleHeading({ level: 1 }).run();
          break;
        case "h2":
          editor.chain().focus().toggleHeading({ level: 2 }).run();
          break;
        case "h3":
          editor.chain().focus().toggleHeading({ level: 3 }).run();
          break;
        case "code":
          editor.chain().focus().toggleCodeBlock().run();
          break;
        case "quote":
          editor.chain().focus().toggleBlockquote().run();
          break;
      }
    },
    [editor],
  );

  const handleLinkApply = useCallback(() => {
    if (!linkUrl.trim()) {
      editor.chain().focus().unsetLink().run();
    } else {
      editor
        .chain()
        .focus()
        .setLink({ href: linkUrl.trim() })
        .run();
    }
    setLinkOpen(false);
    setLinkUrl("");
  }, [editor, linkUrl]);

  const handleLinkOpen = useCallback(() => {
    const existing = editor.getAttributes("link").href ?? "";
    setLinkUrl(existing);
    setLinkOpen(true);
  }, [editor]);

  const handleTableInsert = useCallback(
    (data: { headers: string[]; rows: string[][] }) => {
      const headerCells = data.headers.map((h) => ({
        type: "tableHeader" as const,
        content: [{ type: "paragraph" as const, content: h ? [{ type: "text" as const, text: h }] : undefined }],
      }));
      const bodyRows = data.rows.map((row) => ({
        type: "tableRow" as const,
        content: row.map((cell) => ({
          type: "tableCell" as const,
          content: [{ type: "paragraph" as const, content: cell ? [{ type: "text" as const, text: cell }] : undefined }],
        })),
      }));
      const tableNode = {
        type: "table" as const,
        content: [
          { type: "tableRow" as const, content: headerCells },
          ...bodyRows,
        ],
      };
      editor.chain().focus().insertContent(tableNode).run();
    },
    [editor],
  );

  const handleImageInsert = useCallback(
    (base64: string, contentType: string) => {
      const src = `data:${contentType};base64,${base64}`;
      editor.chain().focus().setImage({ src }).run();
    },
    [editor],
  );

  return (
    <TooltipProvider delayDuration={300}>
      <div className="sticky top-0 z-10 flex items-center gap-0.5 flex-wrap bg-background px-2 py-1 print:hidden">
        {/* Chat toggle */}
        <ToolbarButton
          icon={<PanelLeft className="h-4 w-4" />}
          label={showChat ? "Hide Chat" : "Show Chat"}
          active={showChat}
          onClick={onToggleChat}
        />

        <Separator orientation="vertical" className="mx-1 h-6" />

        {/* Block type dropdown */}
        <Select value={getBlockType()} onValueChange={handleBlockTypeChange}>
          <SelectTrigger className="h-8 w-[130px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="paragraph">
              <span className="flex items-center gap-2">
                <Pilcrow className="h-3.5 w-3.5" /> Paragraph
              </span>
            </SelectItem>
            <SelectItem value="h1">
              <span className="flex items-center gap-2">
                <Heading1 className="h-3.5 w-3.5" /> Heading 1
              </span>
            </SelectItem>
            <SelectItem value="h2">
              <span className="flex items-center gap-2">
                <Heading2 className="h-3.5 w-3.5" /> Heading 2
              </span>
            </SelectItem>
            <SelectItem value="h3">
              <span className="flex items-center gap-2">
                <Heading3 className="h-3.5 w-3.5" /> Heading 3
              </span>
            </SelectItem>
            <SelectItem value="code">
              <span className="flex items-center gap-2">
                <CodeSquare className="h-3.5 w-3.5" /> Code Block
              </span>
            </SelectItem>
            <SelectItem value="quote">
              <span className="flex items-center gap-2">
                <Quote className="h-3.5 w-3.5" /> Quote
              </span>
            </SelectItem>
          </SelectContent>
        </Select>

        <Separator orientation="vertical" className="mx-1 h-6" />

        {/* Text formatting */}
        <ToolbarButton
          icon={<Bold className="h-4 w-4" />}
          label="Bold"
          shortcut="Ctrl+B"
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        />
        <ToolbarButton
          icon={<Italic className="h-4 w-4" />}
          label="Italic"
          shortcut="Ctrl+I"
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        />
        <ToolbarButton
          icon={<Underline className="h-4 w-4" />}
          label="Underline"
          shortcut="Ctrl+U"
          active={editor.isActive("underline")}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        />
        <ToolbarButton
          icon={<Strikethrough className="h-4 w-4" />}
          label="Strikethrough"
          active={editor.isActive("strike")}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        />
        <ToolbarButton
          icon={<Code className="h-4 w-4" />}
          label="Inline Code"
          shortcut="Ctrl+E"
          active={editor.isActive("code")}
          onClick={() => editor.chain().focus().toggleCode().run()}
        />

        {/* Link */}
        <Popover open={linkOpen} onOpenChange={setLinkOpen}>
          <PopoverTrigger asChild>
            <span>
              <ToolbarButton
                icon={<Link2 className="h-4 w-4" />}
                label="Link"
                active={editor.isActive("link")}
                onClick={handleLinkOpen}
              />
            </span>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-3" align="start">
            <div className="flex gap-2">
              <Input
                placeholder="https://example.com"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleLinkApply();
                  }
                }}
                className="h-8 text-sm"
                autoFocus
              />
              <Button size="sm" className="h-8" onClick={handleLinkApply}>
                Apply
              </Button>
              {editor.isActive("link") && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0"
                  onClick={() => {
                    editor.chain().focus().unsetLink().run();
                    setLinkOpen(false);
                  }}
                >
                  <Unlink className="h-4 w-4" />
                </Button>
              )}
            </div>
          </PopoverContent>
        </Popover>

        <Separator orientation="vertical" className="mx-1 h-6" />

        {/* Lists */}
        <ToolbarButton
          icon={<List className="h-4 w-4" />}
          label="Bullet List"
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        />
        <ToolbarButton
          icon={<ListOrdered className="h-4 w-4" />}
          label="Numbered List"
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        />

        <Separator orientation="vertical" className="mx-1 h-6" />

        {/* Alignment */}
        <ToolbarButton
          icon={<AlignLeft className="h-4 w-4" />}
          label="Align Left"
          active={editor.isActive({ textAlign: "left" })}
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
        />
        <ToolbarButton
          icon={<AlignCenter className="h-4 w-4" />}
          label="Align Center"
          active={editor.isActive({ textAlign: "center" })}
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
        />
        <ToolbarButton
          icon={<AlignRight className="h-4 w-4" />}
          label="Align Right"
          active={editor.isActive({ textAlign: "right" })}
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
        />

        <Separator orientation="vertical" className="mx-1 h-6" />

        {/* Insert actions */}
        <ToolbarButton
          icon={<Table2 className="h-4 w-4" />}
          label="Insert Table"
          onClick={() => setTableOpen(true)}
        />
        <ToolbarButton
          icon={<ImageIcon className="h-4 w-4" />}
          label="Insert Image"
          onClick={() => setImageOpen(true)}
        />
        <ToolbarButton
          icon={<Sparkles className="h-4 w-4" />}
          label="AI Image"
          onClick={() => setAiImageOpen(true)}
        />
        <ToolbarButton
          icon={<Minus className="h-4 w-4" />}
          label="Horizontal Rule"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
        />
      </div>

      {/* Dialogs */}
      <InsertTableDialog
        open={tableOpen}
        onOpenChange={setTableOpen}
        onInsert={handleTableInsert}
      />
      <InsertImageDialog
        open={imageOpen}
        onOpenChange={setImageOpen}
        onInsert={handleImageInsert}
      />
      <InsertAiImageDialog
        open={aiImageOpen}
        onOpenChange={setAiImageOpen}
        onInsert={handleImageInsert}
      />
    </TooltipProvider>
  );
}
