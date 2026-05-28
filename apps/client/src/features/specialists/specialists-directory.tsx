import { ChevronRight } from "lucide-react";
import { navigateTo, specialistPath } from "../../route-utils";
import type { SpecialistSummary } from "../../types";
import { getSpecialistIcon, isKnownSpecialist } from "../shell/specialist-icons";

export function SpecialistsDirectory({
  specialists,
}: {
  specialists: SpecialistSummary[];
}) {
  const visibleSpecialists = specialists.filter(isKnownSpecialist);

  return (
    <section className="dude-dream-bg h-full overflow-y-auto text-[var(--dude-pearl)]">
      <div className="px-6 py-8">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-[34px] font-semibold leading-[1.07] tracking-tight">
            Specialist workspaces
          </h1>
          <button
            type="button"
            onClick={() => navigateTo("/chat")}
            className="rounded-lg px-3 py-2 text-sm text-[var(--dude-fog)] transition-colors hover:bg-white/8 hover:text-[var(--dude-pearl)]"
          >
            Back to assistant
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-6 pb-8">
        <div className="space-y-2">
          {visibleSpecialists.map((specialist) => {
            const Icon = getSpecialistIcon(specialist.id);
            const href = specialistPath(specialist.id);
            return (
              <a
                key={specialist.id}
                href={href}
                onClick={(event) => {
                  event.preventDefault();
                  navigateTo(href);
                }}
                className="grid min-h-24 grid-cols-[36px_minmax(0,1fr)_24px] items-center gap-4 py-5 text-[var(--dude-pearl)] transition-colors hover:bg-white/6"
              >
                <Icon className="h-5 w-5 text-[var(--dude-accent)]" />
                <span className="min-w-0">
                  <span className="block text-[21px] font-semibold leading-[1.22]">
                    {specialist.name}
                  </span>
                  <span className="mt-1 block truncate text-sm text-[var(--dude-fog)]">
                    {specialist.scope}
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 text-[var(--dude-fog)]" />
              </a>
            );
          })}
        </div>
      </div>
    </section>
  );
}
