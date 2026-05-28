import { Extension } from "@tiptap/core";
import type { Editor } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import {
  fetchWriterAutocomplete,
  type WriterAutocompleteRequest,
} from "./fetch-writer-autocomplete";

export const agentWriterAutocompleteKey = new PluginKey("agentWriterAutocomplete");

export type AgentAutocompleteOptions = {
  workspaceId: string;
  title: string;
  enabled: () => boolean;
  debounceMs: number;
  minPrefixLength: number;
};

type PluginMeta =
  | { type: "set"; suggestion: string; pos: number }
  | { type: "clear" };

function isInCodeBlock(editor: Editor): boolean {
  const { $from } = editor.state.selection;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    if ($from.node(depth).type.name === "codeBlock") return true;
  }
  return false;
}

function getTextContext(editor: Editor): {
  prefix: string;
  suffix: string;
  pos: number;
} | null {
  const { state } = editor;
  const { from, to } = state.selection;
  if (from !== to) return null;

  const $from = state.doc.resolve(from);
  if (!$from.parent.isTextblock) return null;

  const offset = $from.parentOffset;
  const prefix = $from.parent.textBetween(0, offset, undefined, "\ufffc");
  const suffix = $from.parent.textBetween(
    offset,
    $from.parent.content.size,
    undefined,
    "\ufffc",
  );

  return { prefix, suffix, pos: from };
}

export const AgentWriterAutocompleteExtension =
  Extension.create<AgentAutocompleteOptions>({
    name: "agentWriterAutocomplete",

    addOptions() {
      return {
        workspaceId: "",
        title: "",
        enabled: () => false,
        debounceMs: 500,
        minPrefixLength: 8,
      };
    },

    addProseMirrorPlugins() {
      const options = this.options;
      const editor = this.editor;
      let debounceTimer: ReturnType<typeof setTimeout> | null = null;
      let abortController: AbortController | null = null;
      let requestGeneration = 0;

      const clearPending = () => {
        if (debounceTimer) {
          clearTimeout(debounceTimer);
          debounceTimer = null;
        }
        abortController?.abort();
        abortController = null;
      };

      const dispatchMeta = (view: Editor["view"], meta: PluginMeta) => {
        const tr = view.state.tr.setMeta(agentWriterAutocompleteKey, meta);
        view.dispatch(tr);
      };

      const scheduleFetch = () => {
        clearPending();
        if (!options.enabled() || !options.workspaceId) {
          dispatchMeta(editor.view, { type: "clear" });
          return;
        }
        if (isInCodeBlock(editor)) {
          dispatchMeta(editor.view, { type: "clear" });
          return;
        }

        const ctx = getTextContext(editor);
        if (!ctx || ctx.prefix.trim().length < options.minPrefixLength) {
          dispatchMeta(editor.view, { type: "clear" });
          return;
        }

        debounceTimer = setTimeout(() => {
          debounceTimer = null;
          const latest = getTextContext(editor);
          if (!latest || latest.pos !== ctx.pos) return;
          if (!options.enabled()) return;

          abortController?.abort();
          abortController = new AbortController();
          const generation = ++requestGeneration;

          const payload: WriterAutocompleteRequest = {
            workspaceId: options.workspaceId,
            prefix: latest.prefix,
            suffix: latest.suffix,
            title: options.title,
            documentExcerpt: editor.getText({ blockSeparator: "\n" }).slice(-2500),
            signal: abortController.signal,
          };

          void fetchWriterAutocomplete(payload).then(({ completion }) => {
            if (generation !== requestGeneration) return;
            if (!completion || !options.enabled()) {
              dispatchMeta(editor.view, { type: "clear" });
              return;
            }
            const current = getTextContext(editor);
            if (!current || current.pos !== ctx.pos) return;
            if (current.prefix !== latest.prefix) return;
            dispatchMeta(editor.view, {
              type: "set",
              suggestion: completion,
              pos: ctx.pos,
            });
          });
        }, options.debounceMs);
      };

      return [
        new Plugin({
          key: agentWriterAutocompleteKey,
          state: {
            init() {
              return {
                decorations: DecorationSet.empty,
                suggestion: null as string | null,
                pos: null as number | null,
              };
            },
            apply(tr, value, _oldState, newState) {
              const meta = tr.getMeta(agentWriterAutocompleteKey) as PluginMeta | undefined;
              let { suggestion, pos } = value;

              if (meta?.type === "clear") {
                suggestion = null;
                pos = null;
              } else if (meta?.type === "set") {
                suggestion = meta.suggestion;
                pos = meta.pos;
              } else if (tr.docChanged && suggestion !== null) {
                suggestion = null;
                pos = null;
              }

              if (!suggestion || pos === null) {
                return {
                  suggestion: null,
                  pos: null,
                  decorations: DecorationSet.empty,
                };
              }

              if (newState.selection.from !== pos) {
                return {
                  suggestion: null,
                  pos: null,
                  decorations: DecorationSet.empty,
                };
              }

              const widget = Decoration.widget(
                pos,
                () => {
                  const span = document.createElement("span");
                  span.className = "writer-autocomplete-ghost";
                  span.textContent = suggestion;
                  span.setAttribute("aria-hidden", "true");
                  return span;
                },
                { side: 1 },
              );

              return {
                suggestion,
                pos,
                decorations: DecorationSet.create(newState.doc, [widget]),
              };
            },
          },
          props: {
            decorations(state) {
              return agentWriterAutocompleteKey.getState(state)?.decorations ?? null;
            },
            handleKeyDown(view, event) {
              const pluginState = agentWriterAutocompleteKey.getState(view.state);
              const suggestion = pluginState?.suggestion;
              const pos = pluginState?.pos;
              if (!suggestion || pos === null) return false;

              if (event.key === "Tab") {
                event.preventDefault();
                requestGeneration += 1;
                clearPending();
                const tr = view.state.tr.insertText(suggestion, pos);
                tr.setMeta(agentWriterAutocompleteKey, { type: "clear" });
                view.dispatch(tr);
                return true;
              }

              if (event.key === "Escape") {
                event.preventDefault();
                requestGeneration += 1;
                clearPending();
                dispatchMeta(view, { type: "clear" });
                return true;
              }

              return false;
            },
          },
          view() {
            return {
              update(view, prevState) {
                if (
                  view.state.doc.eq(prevState.doc) &&
                  view.state.selection.eq(prevState.selection)
                ) {
                  return;
                }
                scheduleFetch();
              },
              destroy() {
                clearPending();
              },
            };
          },
        }),
      ];
    },
  });
