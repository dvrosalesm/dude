"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Pencil, Play, Save, Check, Loader2 } from "lucide-react";
import { Button } from "@dude/ui/components/button";
import { DocumentExportMenu } from "@dude/presentation-editor/components/document-export-menu";
import { useDocumentEditorStore } from "@dude/presentation-editor/store";
import { useIsEmbedded } from "@dude/subagent-params";

type EditorTopBarProps = {
  workspaceName: string;
  documentName?: string;
  onBack: () => void;
  onRename?: (name: string) => void;
  onSave?: () => Promise<void>;
  hasUnsavedChanges?: boolean;
};

export function EditorTopBar({
  workspaceName,
  documentName,
  onBack,
  onRename,
  onSave,
  hasUnsavedChanges,
}: EditorTopBarProps) {
  const isEmbedded = useIsEmbedded();
  const presentationHtml = useDocumentEditorStore((s) => s.presentationHtml);
  const setShowPresentation = useDocumentEditorStore((s) => s.setShowPresentation);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(workspaceName);
  const inputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  void documentName;

  useEffect(() => {
    if (editing) {
      setDraft(workspaceName);
      setTimeout(() => inputRef.current?.select(), 0);
    }
  }, [editing, workspaceName]);

  const commitRename = useCallback(() => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== workspaceName) {
      onRename?.(trimmed);
    }
    setEditing(false);
  }, [draft, workspaceName, onRename]);

  return (
    <div className="relative flex items-center justify-center px-2 sm:px-4 py-2.5 shrink-0">
      {!isEmbedded && (
        <div className="absolute left-4">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </div>
      )}
      <div className="text-center min-w-0">
        {editing ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") setEditing(false);
            }}
            className="text-sm font-medium text-foreground text-center bg-black/5 rounded-md px-2 py-0.5 outline-none w-48"
          />
        ) : (
          <button
            type="button"
            onClick={() => onRename && setEditing(true)}
            className="group inline-flex items-center gap-1.5 text-sm font-medium text-foreground truncate max-w-[120px] sm:max-w-[250px]"
            title={workspaceName}
          >
            {workspaceName}
            {onRename && (
              <Pencil className="h-3 w-3 text-muted-foreground/0 group-hover:text-muted-foreground transition-colors" />
            )}
          </button>
        )}
      </div>
      <div className="absolute right-2 sm:right-4 flex items-center gap-1 sm:gap-1.5">
        {onSave && (
          <button
            type="button"
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              try {
                await onSave();
                setSaved(true);
                setTimeout(() => setSaved(false), 2000);
              } finally {
                setSaving(false);
              }
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
              saved
                ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                : hasUnsavedChanges
                  ? "bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100"
                  : "bg-muted text-muted-foreground border border-border/50 hover:bg-muted/80"
            }`}
            title="Save (Cmd+S)"
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : saved ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            <span className="hidden sm:inline">{saved ? "Saved" : saving ? "Saving..." : hasUnsavedChanges ? "Save" : "Saved"}</span>
          </button>
        )}
        <DocumentExportMenu />
        {presentationHtml && (
          <button
            type="button"
            onClick={() => setShowPresentation(true)}
            title={"Present"}
            className="relative inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white rounded-lg transition-all active:translate-y-[2px] active:shadow-none"
            style={{
              background: "linear-gradient(180deg, #4ade80 0%, #22c55e 100%)",
              boxShadow: "0 4px 0 0 #16a34a, 0 6px 12px rgba(22,163,74,0.3)",
            }}
          >
            <Play className="h-3.5 w-3.5 fill-white" />
            <span className="hidden sm:inline">Present</span>
          </button>
        )}
      </div>
    </div>
  );
}
