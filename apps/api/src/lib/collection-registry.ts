/**
 * Central registry of workspace collections.
 *
 * Adding a new collection:
 * 1. Add an entry here
 * 2. Update the specialist's system prompt to describe the collection schema
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
  // Marketing specialist
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

  // Prospect specialist
  landingPages: {
    type: 'array',
    maxItems: 50,
    description: 'Landing page metadata (HTML stored separately on disk)',
  },
  leads: {
    type: 'array',
    maxItems: 500,
    description: 'Captured leads from landing pages',
  },

  // Sales specialist (also reuses `leads` above and `researchRuns` from marketing —
  // collection names are workspace-scoped, so sharing keys across specialists is fine)
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

  // Design specialist (canvas-first)
  canvasSnapshot: {
    type: 'singleton',
    description: 'React Flow canvas snapshot ({ nodes, edges, viewport }) — the sole render source for the design specialist.',
  },

  // Shared / generic
  accounts: {
    type: 'array',
    maxItems: 100,
    description: 'Connected social accounts',
  },

  // Main assistant (GT) — per-user project session linking specialist workspaces
  gtSession: {
    type: 'singleton',
    description:
      'Active GT project session. Maps specialistId → { workspaceId, workspaceName, lastInvokedAt } so the GT agent remembers which workspaces belong to the current multi-specialist project.',
  },
};
