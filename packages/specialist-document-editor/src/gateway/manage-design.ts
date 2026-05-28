/**
 * Manage Design Tool
 *
 * Allows the agent to create, read, and update a design.md document
 * that captures the visual direction for the presentation.
 * GLM uses this to maintain consistency across all slides.
 */

import { Type } from "@sinclair/typebox";
import { isNativeRunner } from "@dude/sdk/runner";
import { config } from "@dude/sdk/gateway-runtime";
import { internalPost } from "@dude/sdk/gateway-runtime";
import type { ToolDefinition } from "@dude/sdk/gateway";
import { isApiError, openRouterChat, toolError, toolText, wsPath } from "@dude/sdk/gateway-runtime";

const DESIGN_MODEL = "minimax/minimax-m2.7";

function isNativeRunnerEnv(): boolean {
  return isNativeRunner(process.env.RUNNER_ID);
}

const DESIGN_SYSTEM_PROMPT = `You are a presentation design-system architect. Your job is to create and maintain a design.md document — a complete, actionable design system that an HTML slide generator can follow precisely.

The design document MUST include ALL of the following sections:

## 1. CSS Custom Properties
Define a complete set of CSS variables. Example format:
\`\`\`
--color-bg: #0a0a0a;
--color-surface: #141414;
--color-primary: #22d3ee;
--color-text: #fafafa;
--color-text-muted: #a1a1aa;
--color-accent: #a78bfa;
--color-border: #27272a;
--font-heading: 'system-ui', sans-serif;
--font-body: 'system-ui', sans-serif;
--font-size-hero: 12cqmin;     /* giant cover/hero — a single word or phrase */
--font-size-title: 8cqmin;     /* slide title, one line */
--font-size-heading: 5cqmin;   /* section / card heading */
--font-size-subheading: 3.6cqmin;
--font-size-body: 2.6cqmin;    /* primary body copy — readable from a projector */
--font-size-caption: 1.8cqmin; /* minimum legible text */
--font-weight-bold: 700;
--font-weight-normal: 400;
--spacing-xs: 1cqmin;
--spacing-sm: 2cqmin;
--spacing-md: 4cqmin;
--spacing-lg: 6cqmin;
--spacing-xl: 8cqmin;
--radius: 1cqmin;
\`\`\`
Use cqmin units for all sizing so slides scale with the container.

## Font-size guardrails — NON-NEGOTIABLE
Slides are read from across a room or on a phone held at arm's length. Underscale type is the #1 failure mode. Enforce these minimums:

- **Body copy: ≥ 2.4cqmin** (never smaller). Default to 2.6–3cqmin.
- **Caption / metadata / footer: ≥ 1.6cqmin**. Reserve this tier only for non-essential text (page numbers, disclaimers, source lines).
- **Heading: ≥ 4.5cqmin**. Card/section headings belong here.
- **Slide title: ≥ 7cqmin** for a horizontal (16:9) deck; **≥ 9cqmin** for vertical (9:16).
- **Hero number / giant headline: ≥ 11cqmin** on horizontal, **≥ 14cqmin** on vertical.
- Do not go below these floors to "fit more content" — cut the content instead.
- If a layout is ever tempted to set font-size below 1.6cqmin, the layout is wrong — split the slide.

## 2. Slide Layouts
Define 4-6 reusable slide layout patterns with their CSS structure:
- **Title Slide**: centered title + subtitle, decorative accent
- **Content Slide**: heading + body text / bullet points
- **Two-Column**: split layout for comparisons or image + text
- **Section Divider**: large statement, minimal elements
- **Data/Metrics**: cards or grid for numbers and stats
- **Image Feature**: full or partial image with overlaid text

For each layout, describe the CSS grid/flexbox structure, padding, and alignment.

## 3. Component Styles
Specify exact styles for reusable elements:
- **Headings** (h1-h3): size, weight, color, letter-spacing, text-transform
- **Body Text**: size, line-height, color, max-width
- **Lists**: bullet style, spacing, indent
- **Cards**: background, border, padding, border-radius, shadow
- **Badges/Tags**: background, padding, border-radius, font-size
- **Dividers/Lines**: color, thickness, style
- **Accent Bar**: position, size, color (used for visual anchoring)

## 4. Background & Decorative Elements
- Slide background color or gradient
- Subtle patterns (dot grids, mesh gradients, grain overlays)
- Corner or edge accents, decorative lines
- How to vary backgrounds across slide types

## 5. Color Usage Rules
- When to use primary vs accent vs surface colors
- Text color on different backgrounds (contrast rules)
- How to use color for emphasis and hierarchy

## 6. Spacing & Rhythm
- Standard slide padding (top, bottom, left, right)
- Spacing between heading and body
- List item spacing
- Card grid gap

## 7. Required HTML Structure
CRITICAL: Every slide MUST follow this structure to fill the entire canvas:
\`\`\`
<!DOCTYPE html><html><head><meta charset="utf-8"/><style>
*{margin:0;box-sizing:border-box}
html,body{height:100%}
body{
  font-family: var(--font-body);
  background: var(--color-bg);
  color: var(--color-text);
  min-height: 100vh;           /* REQUIRED: fills entire slide */
  padding: var(--spacing-lg);  /* your slide padding */
  display: flex;               /* use flexbox or grid */
  flex-direction: column;
}
</style></head><body>
<!-- content here -->
</body></html>
\`\`\`
The body MUST have \`min-height: 100vh\` to fill the entire slide. Use flexbox or grid for layout.

## 8. 3D Model Slides (When user asks for "3D")
IMPORTANT: "3D" means REAL 3D model files rendered with model-viewer — NOT CSS perspective/transform tricks!

Use Google's model-viewer with actual .glb/.gltf files:
\`\`\`
<script type="module" src="https://ajax.googleapis.com/ajax/libs/model-viewer/4.0.0/model-viewer.min.js"></script>
<model-viewer src="https://modelviewer.dev/shared-assets/models/Astronaut.glb" auto-rotate camera-controls shadow-intensity="1" style="width:100%;height:60vh"></model-viewer>
\`\`\`

Style guidelines for 3D slides:
- Background: solid dark colors (#0a0a0a, #1a1a2e) that don't compete with the model
- Model size: 50-70% of slide height
- Layout: centered model with title above, or split layout with model on one side
- Attributes: auto-rotate, camera-controls, shadow-intensity="1", exposure="0.8-1.2"

Free model URLs: https://modelviewer.dev/shared-assets/models/ has Astronaut.glb, RobotExpressive.glb, etc.

Output ONLY the markdown content, no outer code blocks. Be specific with values — the generator needs exact numbers, not vague directions. Every value should use cqmin units for responsive sizing.`;

export async function generateDesignDoc(prompt: string, currentDesign?: string): Promise<string> {
  const userMessage = currentDesign
    ? `Current design document:\n\n${currentDesign}\n\n---\n\nUser request: ${prompt}`
    : prompt;

  const content = await openRouterChat({
    model: DESIGN_MODEL,
    messages: [
      { role: "system", content: DESIGN_SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
    maxTokens: 2000,
    temperature: 0.7,
  });

  return content
    .replace(/^```markdown?\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();
}

export function createManageDesignTool(): ToolDefinition {
  return {
    name: "manage_design",
    label: "Manage Design",
    description:
      "Create, read, update, or save the presentation's design system (design.md). " +
      "On Codex/Cursor/Hermes you write the markdown yourself and use action=save. " +
      "On Pi, create/update call a hosted model. " +
      "Use read before generating slides; save/create establishes visual consistency.",
    parameters: Type.Object({
      action: Type.Union(
        [
          Type.Literal("create"),
          Type.Literal("read"),
          Type.Literal("update"),
          Type.Literal("save"),
        ],
        {
          description:
            "create/update (Pi hosted LLM), read (load design.md), save (persist markdown you wrote)",
        },
      ),
      prompt: Type.Optional(
        Type.String({
          description:
            "For create/update (Pi only): describe the design direction or changes. Not needed for read/save.",
        }),
      ),
      markdown: Type.Optional(
        Type.String({
          description: "Full design.md markdown — required for save on native runners.",
        }),
      ),
    }),
    execute: async (_id: any, params: any) => {
      const { action, prompt, markdown } = params;

      if (!["create", "read", "update", "save"].includes(action)) {
        return toolError("Invalid action. Use create, read, update, or save.");
      }

      if (isNativeRunnerEnv() && (action === "create" || action === "update")) {
        return toolError(
          "create/update use a hosted LLM and are not available on this runner. " +
            "Write the design markdown yourself, then call manage_design with action=save and markdown.",
        );
      }

      try {
        // Read current design from workspace
        const readResult = await internalPost(wsPath("read"), {});
        const currentConfig = (readResult.configurations || {}) as Record<string, any>;
        // Back-compat: older workspaces may have a raw markdown string at configurations.designDoc;
        // new ones have { markdown, updatedAt }.
        const stored = currentConfig.designDoc;
        const currentDesign = typeof stored === "string"
          ? stored
          : (stored?.markdown as string | undefined);

        if (action === "read") {
          if (!currentDesign) {
            return toolText({
              success: true,
              hasDesign: false,
              message: isNativeRunnerEnv()
                ? "No design document yet. Write design.md markdown and call action=save."
                : "No design document exists yet. Use 'create' to establish design direction.",
            });
          }
          return toolText({
            success: true,
            hasDesign: true,
            designDoc: currentDesign,
          });
        }

        if (action === "save") {
          if (!markdown?.trim()) {
            return toolError("markdown is required for save");
          }
          const newDesign = markdown.trim();
          const saveResult = await internalPost(wsPath("collection"), {
            collection: "designDoc",
            data: { markdown: newDesign },
          });
          if (isApiError(saveResult)) {
            return toolText({
              success: false,
              error: `Failed to save design document: ${saveResult.error}`,
            });
          }
          return toolText({
            success: true,
            action: "save",
            message: "Design document saved.",
            designDoc: newDesign,
          });
        }

        if (action === "create" && !prompt) {
          return toolError("prompt is required for 'create' action");
        }

        if (action === "update" && !prompt) {
          return toolError("prompt is required for 'update' action");
        }

        if (action === "update" && !currentDesign) {
          return toolError("No design document exists to update. Use 'create' first.");
        }

        console.log(`[manage_design] ${action} design document...`);

        const newDesign = await generateDesignDoc(
          prompt!,
          action === "update" ? currentDesign : undefined
        );

        console.log(`[manage_design] Generated ${newDesign.length} chars of design doc`);

        // Save to workspace via collection API. The server requires `data` to be a JSON object
        // and only accepts collections registered in COLLECTION_REGISTRY (designDoc is a singleton
        // there). We wrap the markdown so it round-trips as { markdown, updatedAt }.
        const saveResult = await internalPost(wsPath("collection"), {
          collection: "designDoc",
          data: { markdown: newDesign },
        });

        if (isApiError(saveResult)) {
          console.error(`[manage_design] Failed to save: ${saveResult.error}`);
          return toolText({
            success: false,
            error: `Failed to save design document: ${saveResult.error}`,
          });
        }

        console.log(`[manage_design] Saved to workspace ${config.workspaceId}`);

        return toolText({
          success: true,
          action,
          message: action === "create"
            ? "Design document created. All future slides will follow this design."
            : "Design document updated. Future slides will reflect these changes.",
          designDoc: newDesign,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[manage_design] Error: ${message}`);
        return toolText({ success: false, error: message });
      }
    },
  };
}
