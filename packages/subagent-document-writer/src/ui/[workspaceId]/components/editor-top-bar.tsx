"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { ArrowLeft, Download, FileText, Pencil, Printer, Loader2, PanelRight } from "lucide-react";
import { Button } from "@dude/ui/components/button";
import { useIsEmbedded } from "@dude/subagent-params";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@dude/ui/components/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@dude/ui/components/dialog";
import { Input } from "@dude/ui/components/input";
import { useToast } from "@dude/ui/hooks/use-toast";
import { useDocumentWriterStore } from "@dude/subagent-document-writer/store";
import { exportDocumentWriter } from "@dude/workspaces";

type EditorTopBarProps = {
  workspaceName: string;
  showLayout: boolean;
  onToggleLayout: () => void;
  onBack: () => void;
  onRename?: (name: string) => void;
};

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function EditorTopBar({
  workspaceName,
  showLayout,
  onToggleLayout,
  onBack,
  onRename,
}: EditorTopBarProps) {
  const isEmbedded = useIsEmbedded();
  const { toast } = useToast();
  const [docxDialogOpen, setDocxDialogOpen] = useState(false);
  const [fileName, setFileName] = useState("");
  const [exporting, setExporting] = useState(false);

  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(workspaceName);
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renaming) {
      setDraft(workspaceName);
      setTimeout(() => renameInputRef.current?.select(), 0);
    }
  }, [renaming, workspaceName]);

  const commitRename = useCallback(() => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== workspaceName) {
      onRename?.(trimmed);
    }
    setRenaming(false);
  }, [draft, workspaceName, onRename]);

  const title = useDocumentWriterStore((s) => s.title);
  const blocks = useDocumentWriterStore((s) => s.blocks);
  const pageLayout = useDocumentWriterStore((s) => s.pageLayout);

  const handleExportPdf = useCallback(() => {
    const { headerHtml, footerHtml, marginTop, marginRight, marginBottom, marginLeft } = pageLayout;

    // Set document title so the PDF filename defaults to the doc title
    const originalTitle = document.title;
    document.title = title || "Document";

    // Use @page margin:0 to eliminate browser default headers/footers (URL, date, page number),
    // then simulate margins with padding on the print content wrapper.
    const style = document.createElement("style");
    style.id = "writer-print-margins";
    style.textContent = `
      @page {
        margin: 0;
      }
      @media print {
        body {
          margin: 0 !important;
          padding: 0 !important;
        }
        .writer-print-content {
          padding: ${marginTop}in ${marginRight}in ${marginBottom}in ${marginLeft}in !important;
          max-width: none !important;
        }
      }
    `;
    document.head.appendChild(style);

    if (headerHtml) {
      const header = document.createElement("div");
      header.id = "writer-print-header";
      header.innerHTML = headerHtml;
      document.body.appendChild(header);
    }

    if (footerHtml) {
      const footer = document.createElement("div");
      footer.id = "writer-print-footer";
      footer.innerHTML = footerHtml;
      document.body.appendChild(footer);
    }

    if (headerHtml || footerHtml) {
      const hfStyle = document.createElement("style");
      hfStyle.id = "writer-print-hf-style";
      hfStyle.textContent = `
        #writer-print-header, #writer-print-footer {
          display: none;
        }
        @media print {
          #writer-print-header {
            display: block !important;
            position: fixed;
            top: 0; left: 0; right: 0;
            padding: 0 0.15in;
            font-size: 10pt;
            font-family: Arial, sans-serif;
            color: #333;
            z-index: 99999;
          }
          #writer-print-footer {
            display: block !important;
            position: fixed;
            bottom: 0; left: 0; right: 0;
            padding: 0 0.15in;
            font-size: 10pt;
            font-family: Arial, sans-serif;
            color: #333;
            z-index: 99999;
          }
          #writer-print-header img,
          #writer-print-footer img {
            max-height: 40px;
            width: auto;
          }
        }
      `;
      document.head.appendChild(hfStyle);
    }

    setTimeout(() => {
      window.print();
      const cleanup = () => {
        document.title = originalTitle;
        document.getElementById("writer-print-margins")?.remove();
        document.getElementById("writer-print-header")?.remove();
        document.getElementById("writer-print-footer")?.remove();
        document.getElementById("writer-print-hf-style")?.remove();
        window.removeEventListener("afterprint", cleanup);
      };
      window.addEventListener("afterprint", cleanup);
    }, 100);
  }, [pageLayout, title]);

  const handleExportDocxClick = () => {
    const safeName =
      (title || "document").replace(/[^a-zA-Z0-9\s\-_]/g, "").trim() || "document";
    setFileName(`${safeName}.docx`);
    setDocxDialogOpen(true);
  };

  const handleExportDocx = async () => {
    setExporting(true);
    try {
      const data = await exportDocumentWriter({ title, blocks, filename: fileName, pageLayout });
      const blob = new Blob([data.text], { type: "text/plain" });
      const finalName = fileName.trim().endsWith(".docx")
        ? fileName.trim()
        : `${fileName.trim()}.docx`;
      downloadBlob(blob, finalName);
      setDocxDialogOpen(false);
    } catch (err) {
      toast({
        title: "Export error",
        description:
          err instanceof Error ? err.message : "Export failed",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <div className="relative flex items-center justify-center px-2 sm:px-4 py-2.5 shrink-0 bg-background print:hidden">
        {!isEmbedded && (
          <div className="absolute left-2 sm:left-4">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </div>
        )}
        <div className="text-center min-w-0 px-10 sm:px-28 w-full">
          {renaming ? (
            <input
              ref={renameInputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitRename();
                if (e.key === "Escape") setRenaming(false);
              }}
              className="text-sm font-medium text-foreground text-center bg-black/5 rounded-md px-2 py-0.5 outline-none w-full max-w-[12rem]"
            />
          ) : (
            <button
              type="button"
              onClick={() => onRename && setRenaming(true)}
              className="group inline-flex max-w-full items-center gap-1.5 text-sm font-medium text-foreground truncate sm:max-w-[250px]"
              title={workspaceName}
            >
              <span className="truncate">{workspaceName}</span>
              {onRename && (
                <Pencil className="h-3 w-3 shrink-0 text-muted-foreground/0 group-hover:text-muted-foreground transition-colors" />
              )}
            </button>
          )}
        </div>

        <div className="absolute right-2 sm:right-4 flex items-center gap-1 sm:gap-1.5">
          <Button
            variant={showLayout ? "secondary" : "ghost"}
            size="sm"
            onClick={onToggleLayout}
            className="gap-1.5 px-2 sm:px-3"
          >
            <PanelRight className="h-4 w-4" />
            <span className="hidden sm:inline text-sm">Layout</span>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="px-2 sm:px-3">
                <Download className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">{"Export"}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleExportDocxClick}>
                <FileText className="h-4 w-4 mr-2" />
                {"Download DOCX"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportPdf}>
                <Printer className="h-4 w-4 mr-2" />
                {"Print / Save as PDF"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Dialog open={docxDialogOpen} onOpenChange={setDocxDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{"Export as DOCX"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder={"File name"}
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && fileName.trim()) {
                  e.preventDefault();
                  void handleExportDocx();
                }
              }}
              className="bg-card"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setDocxDialogOpen(false)}>
              {"Cancel"}
            </Button>
            <Button
              type="button"
              disabled={!fileName.trim() || exporting}
              onClick={() => void handleExportDocx()}
            >
              {exporting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {"Exporting..."}
                </>
              ) : (
                "Download"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
