"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "@dude/app-navigation/router";
import { Button } from "@dude/ui/components/button";
import { Input } from "@dude/ui/components/input";
import { Badge } from "@dude/ui/components/badge";
import { Checkbox } from "@dude/ui/components/checkbox";
import { Label } from "@dude/ui/components/label";
import Link from "@dude/app-navigation/link";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { BrailleSpinner } from "@dude/ui/components/braille-spinner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@dude/ui/components/dialog";
import type { SubagentId } from "@dude/client-types";
import {
  createSubagentWorkspace,
  deleteWorkspaceById,
  listSubagentWorkspaces,
  type WorkspaceRecord,
} from "@dude/workspaces";
import { subagentListPath, subagentWorkspacePath } from "@dude/workspaces/routes";
import { LavaLampPattern } from "../subagents/lava-lamp-pattern";
import { WorkspaceLayoutIcon, getSubagentColor } from "../subagents/workspace-layout-icon";

interface SubagentWorkspaceListProps {
  subagentId: SubagentId;
  title: string;
  subtitle: string;
  emptyTitle: string;
  emptyDescription: string;
  supportsPassword?: boolean;
}

export function SubagentWorkspaceList({
  subagentId,
  title,
  subtitle,
  emptyTitle,
  emptyDescription,
  supportsPassword = false,
}: SubagentWorkspaceListProps) {
  const router = useRouter();
  const workspaceRoute = subagentListPath(subagentId);
  const [workspaces, setWorkspaces] = useState<WorkspaceRecord[]>([]);
  const [workspacesLoading, setWorkspacesLoading] = useState(false);
  const [workspacesError, setWorkspacesError] = useState<string | null>(null);
  const [createName, setCreateName] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [protectWorkspace, setProtectWorkspace] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadWorkspaces() {
      setWorkspacesLoading(true);
      setWorkspacesError(null);
      try {
        const workspaces = await listSubagentWorkspaces(subagentId);
        if (cancelled) return;
        setWorkspaces(workspaces);
      } catch (error) {
        if (!cancelled) {
          const message =
            error instanceof Error ? error.message : "Failed to load";
          setWorkspacesError(message);
        }
      } finally {
        if (!cancelled) {
          setWorkspacesLoading(false);
        }
      }
    }

    void loadWorkspaces();

    return () => {
      cancelled = true;
    };
  }, [subagentId]);

  const canCreateWorkspace = useMemo(() => {
    return (
      Boolean(createName.trim()) &&
      (!supportsPassword || !protectWorkspace || Boolean(createPassword.trim()))
    );
  }, [createName, createPassword, protectWorkspace, supportsPassword]);

  async function handleCreateWorkspace() {
    if (!canCreateWorkspace) return;
    setCreating(true);
    setCreateError(null);
    try {
      const configurations: Record<string, unknown> = {};
      if (supportsPassword) {
        configurations.password = protectWorkspace ? createPassword : "";
        configurations.protected = protectWorkspace;
      }
      const workspace = await createSubagentWorkspace(subagentId, {
        name: createName.trim(),
        ...(Object.keys(configurations).length ? { configurations } : {}),
      });
      setIsCreateOpen(false);
      router.push(subagentWorkspacePath(subagentId, workspace.id));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to create workspace";
      setCreateError(message);
    } finally {
      setCreating(false);
    }
  }

  async function handleDeleteWorkspace() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteWorkspaceById(deleteTarget.id);
      setWorkspaces((prev) => prev.filter((w) => w.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to delete workspace";
      setWorkspacesError(message);
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <div className="h-full min-h-0 overflow-auto bg-muted">
        <div className="w-full space-y-6">
          <div className="px-4 sm:px-8 pt-8 pb-2">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <Link
                  href="/chat"
                  className="flex items-center justify-center h-8 w-8 rounded-lg hover:bg-card text-muted-foreground hover:text-foreground transition-colors mt-1 shrink-0"
                  title={"Back to home"}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Link>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-bold text-foreground">
                      {title}
                    </h1>
                    <Badge variant="secondary" className="h-5 text-[10px] rounded-full">
                      {workspaces.length}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {subtitle}
                  </p>
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                className="shrink-0 mt-1 gap-1.5 rounded-xl"
                onClick={() => setIsCreateOpen(true)}
              >
                <Plus className="h-3.5 w-3.5" />
                <span className="hidden sm:inline text-xs">{"Create workspace"}</span>
              </Button>
            </div>
          </div>

          <div className="px-4 sm:px-8 pb-8">
            <section className="space-y-4">
              <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {"Workspaces"}
              </h2>
              {workspacesError && (
                <p className="text-sm text-destructive">{workspacesError}</p>
              )}
              {workspacesLoading && (
                <div className="flex items-center justify-center py-16">
                  <BrailleSpinner />
                </div>
              )}
              {!workspacesLoading && workspaces.length === 0 && (
                <div className="rounded-2xl bg-card/50 p-8 text-center">
                  <p className="text-sm font-medium text-foreground">
                    {emptyTitle}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {emptyDescription}
                  </p>
                </div>
              )}
              <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
                {workspaces.map((workspace) => (
                  <Link
                    key={String(workspace.id)}
                    href={subagentWorkspacePath(subagentId, workspace.id)}
                    className="block group"
                  >
                    <div className="rounded-2xl bg-card shadow-sm overflow-hidden">
                      <div className="relative h-24 overflow-hidden">
                        <LavaLampPattern id={String(workspace.id)} tint={getSubagentColor(subagentId)} />
                        <div className="absolute inset-0 z-[1] flex items-center justify-center pointer-events-none">
                          <WorkspaceLayoutIcon
                            subagentId={subagentId}
                            className="w-32 h-20"
                            style={{ color: getSubagentColor(subagentId) }}
                          />
                        </div>
                        <div className="absolute top-2 right-2 z-10 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            className="shrink-0 p-1.5 rounded-lg bg-black/30 backdrop-blur-sm text-white/80 hover:text-white hover:bg-black/50"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setDeleteTarget({
                                id: String(workspace.id),
                                name: String(workspace.name || ""),
                              });
                            }}
                            aria-label={"Delete"}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                      <div className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-semibold text-foreground truncate">
                            {workspace.name}
                          </span>
                        </div>
                        {(workspace.createdAt || workspace.updatedAt) && (
                          <div className="text-[11px] text-muted-foreground/60 mt-0.5">
                            <span className="shrink-0">
                              {new Date(
                                String(workspace.updatedAt || workspace.createdAt),
                              ).toLocaleDateString()}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>

      <Dialog
        open={isCreateOpen}
        onOpenChange={(open) => {
          setIsCreateOpen(open);
          if (open) {
            setCreateName("");
            setCreatePassword("");
            setProtectWorkspace(false);
            setCreateError(null);
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{"Create workspace"}</DialogTitle>
            <DialogDescription>
              {"Set a name to start a new workspace."}
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (!canCreateWorkspace || creating) return;
              void handleCreateWorkspace();
            }}
          >
            <div className="space-y-3">
              <Input
                autoFocus
                placeholder={"e.g. Q4 sales analysis"}
                value={createName}
                onChange={(event) => setCreateName(event.target.value)}
                className="h-10 bg-card border border-border/50 shadow-sm rounded-lg"
              />
              {supportsPassword && (
                <>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="protect-workspace"
                      checked={protectWorkspace}
                      onCheckedChange={(checked) => {
                        const next = Boolean(checked);
                        setProtectWorkspace(next);
                        if (!next) {
                          setCreatePassword("");
                        }
                      }}
                    />
                    <Label htmlFor="protect-workspace" className="text-sm">
                      {"Protect with password"}
                    </Label>
                  </div>
                  {protectWorkspace && (
                    <Input
                      placeholder={"Workspace password"}
                      type="password"
                      value={createPassword}
                      onChange={(event) => setCreatePassword(event.target.value)}
                      className="h-10 bg-card border border-border/50 shadow-sm rounded-lg"
                    />
                  )}
                </>
              )}
              {createError && (
                <p className="text-sm text-destructive">{createError}</p>
              )}
            </div>
            <DialogFooter className="mt-4">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsCreateOpen(false)}
              >
                {"Cancel"}
              </Button>
              <Button
                type="submit"
                disabled={!canCreateWorkspace || creating}
                className="rounded-xl"
              >
                {creating
                  ? "Loading..."
                  : "Create workspace"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{"Delete workspace"}</DialogTitle>
            <DialogDescription>
              {"Are you sure you want to delete this workspace? This action cannot be undone."}
            </DialogDescription>
          </DialogHeader>
          {deleteTarget && (
            <p className="text-sm font-medium truncate">{deleteTarget.name}</p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
            >
              {"Cancel"}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleting}
              onClick={handleDeleteWorkspace}
            >
              {deleting
                ? "Loading..."
                : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
