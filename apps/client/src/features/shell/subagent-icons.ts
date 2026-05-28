import {
  BarChart3,
  BriefcaseBusiness,
  FileText,
  Palette,
  Presentation,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { applyDudeTheme } from "@dude/ui/design-system";
import type { DudeTheme } from "../../preferences";
import type { SubagentId, SubagentSummary } from "../../types";

export const SPECIALIST_ICONS: Record<SubagentId, LucideIcon> = {
  "main-assistant": Sparkles,
  "data-analyst": BarChart3,
  "document-writer": FileText,
  "presentation-editor": Presentation,
  "design-branding": Palette,
  sales: BriefcaseBusiness,
};

export function applyTheme(theme: DudeTheme) {
  applyDudeTheme(theme);
}

export function isKnownSubagent(
  subagent: SubagentSummary,
): subagent is SubagentSummary & { id: SubagentId } {
  return subagent.id in SPECIALIST_ICONS;
}

export function getSubagentIcon(subagentId: SubagentId) {
  return SPECIALIST_ICONS[subagentId] ?? Sparkles;
}
