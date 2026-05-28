/**
 * Central registry of workspace collections.
 *
 * Adding a new collection:
 * 1. Add an entry here
 * 2. Update the subagent's system prompt to describe the collection schema
 * That's it — no new tools, no new endpoints.
 */

export interface CollectionSpec {
  /** 'singleton' = one object, 'array' = list of items with id */
  type: 'singleton' | 'array';
  /** Max items for array collections (oldest trimmed). Default 100. */
  maxItems?: number;
  /** Human-readable description (for docs/debugging). */
  description: string;
}

export const COLLECTION_REGISTRY: Record<string, CollectionSpec> = {
  // Marketing subagent
  brandResearch: {
    type: 'singleton',
    description: 'Brand identity analysis (summary, tone, audience, competitors)',
  },
  researchRuns: {
    type: 'array',
    maxItems: 25,
    description: 'Market research reports',
  },
  campaigns: {
    type: 'array',
    maxItems: 20,
    description: 'Campaign folders grouping related posts',
  },
  plans: {
    type: 'array',
    maxItems: 500,
    description: 'Social media post plans/drafts',
  },

  // Sales subagent (reuses `researchRuns` from marketing when needed —
  // collection names are workspace-scoped, so sharing keys across subagents is fine)
  leads: {
    type: 'array',
    maxItems: 500,
    description: 'Captured leads',
  },
  icp: {
    type: 'singleton',
    description:
      'Ideal Customer Profile (description, industries[], roles[], companySizes[], geographies[])',
  },
  pipelineStages: {
    type: 'array',
    maxItems: 50,
    description: 'Customizable lead pipeline stages ({ id, name, order, terminal? })',
  },

  // Social analytics
  socialProfiles: {
    type: 'array',
    maxItems: 50,
    description: 'Social media profile analytics snapshots',
  },

  // Presentation editor
  documentEdits: {
    type: 'array',
    maxItems: 500,
    description: 'Queued presentation edit commands applied server-side',
  },
  documentWriterEdits: {
    type: 'array',
    maxItems: 500,
    description: 'Queued document-writer edit commands applied into documentContent',
  },
  designDoc: {
    type: 'singleton',
    description: "Presentation-wide design system (markdown). Stored as { markdown: '...', updatedAt }.",
  },

  // Design subagent (canvas-first)
  canvasSnapshot: {
    type: 'singleton',
    description: 'React Flow canvas snapshot ({ nodes, edges, viewport }) — the sole render source for the design subagent.',
  },
  brandBook: {
    type: 'array',
    maxItems: 50,
    description: 'Brand book sections (title, content markdown, tags)',
  },
  palettes: {
    type: 'array',
    maxItems: 50,
    description: 'Brand color palettes ({ name, colors: [{ hex, name?, role? }] })',
  },
  typography: {
    type: 'array',
    maxItems: 50,
    description: 'Typography pairings (display + body faces, sample text)',
  },
  logos: {
    type: 'array',
    maxItems: 50,
    description: 'Logo concept artifacts (name, brief, imageUrl, rationale)',
  },
  reviews: {
    type: 'array',
    maxItems: 50,
    description: 'Design review notes and feedback',
  },
  tokensExports: {
    type: 'array',
    maxItems: 50,
    description: 'Design token export bundles (CSS, JSON, etc.)',
  },

  // Shared / generic
  accounts: {
    type: 'array',
    maxItems: 100,
    description: 'Connected social accounts',
  },

  // Main assistant (GT) — per-user project session linking subagent workspaces
  gtSession: {
    type: 'singleton',
    description:
      'Active GT project session. Maps subagentId → { workspaceId, workspaceName, lastInvokedAt } so the GT agent remembers which workspaces belong to the current multi-subagent project.',
  },
};
