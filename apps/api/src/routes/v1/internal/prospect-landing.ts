import { httpError } from "../../http-error.js";
import {
  saveLandingPageHtml,
  applyLandingPageEdits,
  getLandingPageHtml as readLandingPageHtml,
  saveLandingPageDraft,
} from "../../../lib/landing-page-storage.js";
import { getWorkspaceConfig, updateWorkspaceConfig } from "./workspace-config.js";

type LandingPageRecord = Record<string, unknown> & {
  id: string;
  fields?: unknown[];
  published?: boolean;
  updatedAt?: string;
  attributions?: string;
};

function landingPagesFromConfig(config: Record<string, unknown>): LandingPageRecord[] {
  const pages = config.landingPages;
  return Array.isArray(pages) ? (pages as LandingPageRecord[]) : [];
}

/**
 * POST /v1/internal/workspace/:workspaceId/landing-page-draft
 * Save partial HTML locally for live preview during generation.
 */
export async function saveDraft(
  workspaceId: string,
  body: Record<string, unknown>,
) {
  try {
    const html = body.html as string;
    if (!html) throw new Error("html is required");
    await saveLandingPageDraft(workspaceId, html);
    return { status: "saved" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save draft";
    throw httpError(message, 500);
  }
}

/**
 * POST /v1/internal/workspace/:workspaceId/landing-page
 * Create or update a landing page.
 */
export async function saveLandingPage(
  workspaceId: string,
  body: Record<string, unknown>,
) {
  try {
    const config = await getWorkspaceConfig(workspaceId);
    const pages = landingPagesFromConfig(config);
    const pageId = (body.id as string) || crypto.randomUUID();
    const existing = pages.findIndex((p) => p.id === pageId);

    if (body.html) {
      await saveLandingPageHtml(
        workspaceId,
        pageId,
        body.html as string,
        body.styles as string | undefined,
      );
    }

    const { html: _html, styles: _styles, ...metadata } = body;
    const page = {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      published: false,
      fields: [],
      ...metadata,
      id: pageId,
    };

    if (existing >= 0) {
      pages[existing] = {
        ...pages[existing],
        ...page,
        fields: pages[existing].fields || page.fields,
        published: pages[existing].published,
        updatedAt: new Date().toISOString(),
      };
    } else {
      pages.push(page);
    }

    config.landingPages = pages.slice(0, 50);
    await updateWorkspaceConfig(workspaceId, config);
    return { status: "saved", id: pageId };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save";
    throw httpError(message, 500);
  }
}

/**
 * POST /v1/internal/workspace/:workspaceId/landing-page-fields
 * Update form fields for a landing page.
 */
export async function saveLandingPageFields(
  workspaceId: string,
  body: Record<string, unknown>,
) {
  try {
    const config = await getWorkspaceConfig(workspaceId);
    const pages = landingPagesFromConfig(config);
    let pageId = body.landing_page_id as string | undefined;

    if (!pageId && pages.length === 1) {
      pageId = pages[0].id;
    }

    if (!pageId) {
      throw new Error(
        pages.length === 0
          ? "No landing pages exist in this workspace yet — create one with update_landing_page first."
          : `landing_page_id is required (workspace has ${pages.length} pages: ${pages.map((p) => p.id).join(", ")})`,
      );
    }

    const existing = pages.findIndex((p) => p.id === pageId);
    if (existing < 0) {
      throw new Error(
        `Landing page ${pageId} not found. Available IDs: ${pages.map((p) => p.id).join(", ") || "(none)"}`,
      );
    }

    const fields = Array.isArray(body.fields) ? body.fields : [];
    pages[existing].fields = fields;
    pages[existing].updatedAt = new Date().toISOString();

    config.landingPages = pages;
    await updateWorkspaceConfig(workspaceId, config);
    return {
      status: "saved",
      id: pageId,
      fieldCount: fields.length,
      fields: fields.map((f) => {
        const field = f as Record<string, unknown>;
        return {
          name: field.name,
          label: field.label,
          type: field.type,
          required: !!field.required,
        };
      }),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save";
    throw httpError(message, 500);
  }
}

/**
 * POST /v1/internal/workspace/:workspaceId/landing-page-attributions
 * Update the attributions text published at /capture/{id}/attributions.txt.
 */
export async function saveLandingPageAttributions(
  workspaceId: string,
  body: Record<string, unknown>,
) {
  try {
    const config = await getWorkspaceConfig(workspaceId);
    const pages = landingPagesFromConfig(config);
    const pageId = body.landing_page_id as string;
    const text = typeof body.text === "string" ? body.text : "";

    if (!pageId) {
      throw new Error("landing_page_id is required");
    }

    const existing = pages.findIndex((p) => p.id === pageId);
    if (existing < 0) {
      throw new Error(`Landing page ${pageId} not found`);
    }

    pages[existing].attributions = text;
    pages[existing].updatedAt = new Date().toISOString();

    config.landingPages = pages;
    await updateWorkspaceConfig(workspaceId, config);
    return { status: "saved", id: pageId };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save";
    throw httpError(message, 500);
  }
}

/**
 * POST /v1/internal/workspace/:workspaceId/landing-page-publish
 * Publish or unpublish a landing page.
 */
export async function publishLandingPage(
  workspaceId: string,
  body: Record<string, unknown>,
) {
  try {
    const config = await getWorkspaceConfig(workspaceId);
    const pages = landingPagesFromConfig(config);
    const pageId = body.landing_page_id as string;

    if (!pageId) {
      throw new Error("landing_page_id is required");
    }

    const existing = pages.findIndex((p) => p.id === pageId);
    if (existing < 0) {
      throw new Error(`Landing page ${pageId} not found`);
    }

    pages[existing].published = !!body.published;
    pages[existing].updatedAt = new Date().toISOString();

    config.landingPages = pages;
    await updateWorkspaceConfig(workspaceId, config);
    return {
      status: "saved",
      id: pageId,
      published: pages[existing].published,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save";
    throw httpError(message, 500);
  }
}

/**
 * GET /v1/internal/workspace/:workspaceId/landing-page-html/:pageId
 * Read the current HTML of a landing page from local disk.
 */
export async function getLandingPageHtml(workspaceId: string, pageId: string) {
  try {
    const html = await readLandingPageHtml(workspaceId, pageId);
    if (!html) {
      throw new Error(`Landing page ${pageId} not found in storage`);
    }
    return { html };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to read";
    throw httpError(message, 500);
  }
}

/**
 * POST /v1/internal/workspace/:workspaceId/landing-page-edit
 * Apply search/replace edits to a landing page's HTML on local disk.
 */
export async function editLandingPage(
  workspaceId: string,
  body: Record<string, unknown>,
) {
  try {
    const pageId = body.landing_page_id as string;
    const edits = body.edits as Array<{ old_text: string; new_text: string }>;

    if (!pageId) {
      throw new Error("landing_page_id is required");
    }
    if (!Array.isArray(edits) || edits.length === 0) {
      throw new Error("edits array is required");
    }

    const result = await applyLandingPageEdits(workspaceId, pageId, edits);

    const config = await getWorkspaceConfig(workspaceId);
    const pages = landingPagesFromConfig(config);
    const idx = pages.findIndex((p) => p.id === pageId);
    if (idx >= 0) {
      pages[idx].updatedAt = new Date().toISOString();
      config.landingPages = pages;
      await updateWorkspaceConfig(workspaceId, config);
    }

    return {
      status: "saved",
      id: pageId,
      applied: result.applied,
      failed: result.failed,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to edit";
    throw httpError(message, 500);
  }
}
