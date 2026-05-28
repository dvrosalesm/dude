"use client";

import { useState, useCallback, useRef } from "react";
import type { Editor } from "@tiptap/react";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Link2,
  Unlink,
  AlignLeft,
  AlignCenter,
  AlignRight,
  ImageIcon,
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
import { Input } from "@dude/ui/components/input";

type MiniToolbarProps = {
  editor: Editor;
};

function Btn({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClick}
          className={`h-7 w-7 p-0 ${active ? "bg-muted" : ""}`}
        >
          {icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <p className="text-xs">{label}</p>
      </TooltipContent>
    </Tooltip>
  );
}

export function MiniToolbar({ editor }: MiniToolbarProps) {
  const [linkUrl, setLinkUrl] = useState("");
  const [linkOpen, setLinkOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleLinkOpen = useCallback(() => {
    setLinkUrl(editor.getAttributes("link").href ?? "");
    setLinkOpen(true);
  }, [editor]);

  const handleLinkApply = useCallback(() => {
    if (!linkUrl.trim()) {
      editor.chain().focus().unsetLink().run();
    } else {
      editor.chain().focus().setLink({ href: linkUrl.trim() }).run();
    }
    setLinkOpen(false);
    setLinkUrl("");
  }, [editor, linkUrl]);

  const handleImage = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !file.type.startsWith("image/")) return;
      e.target.value = "";

      const reader = new FileReader();
      reader.onload = () => {
        const src = reader.result as string;
        editor.chain().focus().setImage({ src }).run();
      };
      reader.readAsDataURL(file);
    },
    [editor],
  );

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex items-center gap-0.5 border-b px-1.5 py-1 bg-muted/30">
        <Btn
          icon={<Bold className="h-3.5 w-3.5" />}
          label="Bold"
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        />
        <Btn
          icon={<Italic className="h-3.5 w-3.5" />}
          label="Italic"
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        />
        <Btn
          icon={<Underline className="h-3.5 w-3.5" />}
          label="Underline"
          active={editor.isActive("underline")}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        />
        <Btn
          icon={<Strikethrough className="h-3.5 w-3.5" />}
          label="Strikethrough"
          active={editor.isActive("strike")}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        />

        <div className="w-px h-4 bg-border mx-0.5" />

        {/* Link */}
        <Popover open={linkOpen} onOpenChange={setLinkOpen}>
          <PopoverTrigger asChild>
            <span>
              <Btn
                icon={<Link2 className="h-3.5 w-3.5" />}
                label="Link"
                active={editor.isActive("link")}
                onClick={handleLinkOpen}
              />
            </span>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-2" align="start">
            <div className="flex gap-1.5">
              <Input
                placeholder="https://..."
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleLinkApply();
                  }
                }}
                className="h-7 text-xs"
                autoFocus
              />
              <Button size="sm" className="h-7 text-xs px-2" onClick={handleLinkApply}>
                OK
              </Button>
              {editor.isActive("link") && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0"
                  onClick={() => {
                    editor.chain().focus().unsetLink().run();
                    setLinkOpen(false);
                  }}
                >
                  <Unlink className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </PopoverContent>
        </Popover>

        <div className="w-px h-4 bg-border mx-0.5" />

        {/* Alignment */}
        <Btn
          icon={<AlignLeft className="h-3.5 w-3.5" />}
          label="Left"
          active={editor.isActive({ textAlign: "left" })}
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
        />
        <Btn
          icon={<AlignCenter className="h-3.5 w-3.5" />}
          label="Center"
          active={editor.isActive({ textAlign: "center" })}
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
        />
        <Btn
          icon={<AlignRight className="h-3.5 w-3.5" />}
          label="Right"
          active={editor.isActive({ textAlign: "right" })}
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
        />

        <div className="w-px h-4 bg-border mx-0.5" />

        {/* Image */}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImage}
        />
        <Btn
          icon={<ImageIcon className="h-3.5 w-3.5" />}
          label="Insert image"
          onClick={() => fileRef.current?.click()}
        />
      </div>
    </TooltipProvider>
  );
}
