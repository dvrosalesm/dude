/**
 * Canonical friendly labels for tool invocations (API traces + client UI).
 */

export interface ToolLabel {
  /** Present-continuous form, shown while the call is in flight. */
  active: string;
  /** Past-tense form, shown once the call has resolved. */
  past: string;
}

const STATIC_LABELS: Record<string, ToolLabel> = {
  web_search: { active: "Browsing the internet…", past: "Browsed the internet" },
  exa_search: { active: "Searching the web…", past: "Searched the web" },
  google_search: { active: "Searching Google…", past: "Searched Google" },
  web_scrape: { active: "Reading a page…", past: "Read a page" },
  fetch_url: { active: "Fetching the page…", past: "Fetched the page" },
  workspace_read: { active: "Reading workspace data…", past: "Read workspace data" },
  workspace_save: { active: "Saving to workspace…", past: "Saved to workspace" },
  sql: { active: "Querying the database…", past: "Queried the database" },
  python: { active: "Running code…", past: "Ran code" },
  save_database: { active: "Saving to the database…", past: "Saved to the database" },
  current_datetime: { active: "Checking the time…", past: "Checked the time" },
  generate_image: { active: "Generating an image…", past: "Generated an image" },
  image_gen: { active: "Generating an image…", past: "Generated an image" },
  imagegen: { active: "Generating an image…", past: "Generated an image" },
  interpret_image: { active: "Looking at the image…", past: "Analyzed the image" },
  rag_lookup: { active: "Searching documents…", past: "Searched documents" },
  fetch_drive_data: { active: "Reading Google Drive…", past: "Read Google Drive" },
  store_record: { active: "Saving a record…", past: "Saved a record" },
  retrieve_records: { active: "Retrieving records…", past: "Retrieved records" },
  ui_request_input: { active: "Waiting for your input…", past: "Got your input" },
  send_progress: { active: "Sending an update…", past: "Sent an update" },
  finish_turn: { active: "Finishing up…", past: "Finished" },
  list_project_workspaces: {
    active: "Checking project workspaces…",
    past: "Checked project workspaces",
  },
  review_specialist_work: {
    active: "Reviewing specialist work…",
    past: "Reviewed specialist work",
  },
  publish_landing_page: {
    active: "Publishing the landing page…",
    past: "Published the landing page",
  },
  edit_landing_page: { active: "Editing the landing page…", past: "Edited the landing page" },
  update_landing_page: { active: "Updating the landing page…", past: "Updated the landing page" },
  edit_presentation: { active: "Editing the presentation…", past: "Edited the presentation" },
  edit_document: { active: "Editing the document…", past: "Edited the document" },
};

const ELLIPSIS = "…";

const trimArg = (value: unknown, max = 60): string => {
  const text = String(value ?? "").trim();
  if (text.length <= max) return text;
  return text.slice(0, max).trimEnd() + ELLIPSIS;
};

/** Active/past labels for a tool, optionally enriched with its arguments. */
export function friendlyToolLabel(
  tool: string,
  args?: Record<string, unknown>,
): ToolLabel {
  switch (tool) {
    case "web_search":
    case "exa_search":
    case "google_search": {
      const q = trimArg(args?.query);
      if (q) return { active: `Searching for "${q}"${ELLIPSIS}`, past: `Searched for "${q}"` };
      break;
    }
    case "web_scrape":
    case "fetch_url": {
      const url = trimArg(args?.url);
      if (url) return { active: `Reading ${url}${ELLIPSIS}`, past: `Read ${url}` };
      break;
    }
    case "workspace_save": {
      const collection = trimArg(args?.collection, 40);
      if (collection)
        return { active: `Saving to ${collection}${ELLIPSIS}`, past: `Saved to ${collection}` };
      break;
    }
    case "workspace_read": {
      const collection = trimArg(args?.collection, 40);
      if (collection)
        return { active: `Reading ${collection}${ELLIPSIS}`, past: `Read ${collection}` };
      break;
    }
    case "sql": {
      const q = trimArg(args?.query, 80);
      if (q) return { active: `Querying: ${q}`, past: `Queried: ${q}` };
      break;
    }
    case "edit_presentation":
    case "edit_document": {
      const edits = Array.isArray(args?.edits) ? (args!.edits as unknown[]).length : 0;
      const target = tool === "edit_document" ? "document" : "presentation";
      if (edits) {
        const noun = edits === 1 ? "change" : "changes";
        return {
          active: `Editing the ${target} (${edits} ${noun})${ELLIPSIS}`,
          past: `Edited the ${target} (${edits} ${noun})`,
        };
      }
      break;
    }
    case "generate_image":
    case "image_gen":
    case "imagegen": {
      const prompt = trimArg(args?.prompt ?? args?.description, 60);
      if (prompt)
        return { active: `Generating: ${prompt}${ELLIPSIS}`, past: `Generated: ${prompt}` };
      break;
    }
    case "rag_lookup": {
      const q = trimArg(args?.query, 60);
      if (q)
        return {
          active: `Searching documents for "${q}"${ELLIPSIS}`,
          past: `Searched documents for "${q}"`,
        };
      break;
    }
  }

  if (STATIC_LABELS[tool]) return STATIC_LABELS[tool];

  const human = tool ? tool.replace(/_/g, " ").toLowerCase() : "a tool";
  return {
    active: `Running ${human}${ELLIPSIS}`,
    past: `Used ${human}`,
  };
}

/** Just the friendly display name for a tool (no progress framing). */
export function friendlyToolName(tool: string): string {
  if (STATIC_LABELS[tool])
    return STATIC_LABELS[tool].past.replace(/^[A-Z]/, (c) => c.toLowerCase());
  return tool ? tool.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "Tool";
}

/** True if the step ends with an ellipsis — i.e. it represents an in-flight action. */
export function isActiveStep(step: string | undefined): boolean {
  if (!step) return false;
  return step.endsWith(ELLIPSIS) || step.endsWith("...");
}
