import {
  BarChart3,
  BriefcaseBusiness,
  FileText,
  Palette,
  Presentation,
  Search,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { applyDudeTheme } from "@dude/ui/design-system";
import type { DudeTheme } from "../../preferences";
import type { SpecialistId, SpecialistSummary } from "../../types";

export const SPECIALIST_ICONS: Record<SpecialistId, LucideIcon> = {
  "main-assistant": Sparkles,
  "data-analyst": BarChart3,
  "document-writer": FileText,
  "presentation-editor": Presentation,
  "design-branding": Palette,
  prospect: Search,
  sales: BriefcaseBusiness,
};

export function applyTheme(theme: DudeTheme) {
  applyDudeTheme(theme);
}

export function isKnownSpecialist(
  specialist: SpecialistSummary,
): specialist is SpecialistSummary & { id: SpecialistId } {
  return specialist.id in SPECIALIST_ICONS;
}

export function getSpecialistIcon(specialistId: SpecialistId) {
  return SPECIALIST_ICONS[specialistId] ?? Sparkles;
}
