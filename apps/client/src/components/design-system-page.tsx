import { Settings, PanelRightOpen, Sparkles } from "lucide-react";
import { Button } from "@dude/ui/components/button";
import { Input } from "@dude/ui/components/input";
import {
  COLOR_TOKENS,
  DESIGN_BANS,
  DESIGN_PRINCIPLES,
  FONT_STACKS,
  MOTION_TOKENS,
  RADIUS_TOKENS,
  SPACING_TOKENS,
  TYPOGRAPHY_TOKENS,
  chromeButtonClassName,
  cn,
  fieldInputClassName,
  pageTitleClassName,
  sectionHeadingClassName,
  stackBlockClassName,
  stackGroupClassName,
} from "@dude/ui/design-system";
import type { DudeTheme } from "../preferences";

function Swatch({ variable, name }: { variable: string; name: string }) {
  return (
    <div className={stackBlockClassName()}>
      <div
        className="mb-3 h-14 w-full rounded-lg bg-[var(--dude-surface-2)]"
        style={{ background: `var(${variable})` }}
      />
      <div className="text-sm font-medium text-[var(--dude-text)]">{name}</div>
      <code className="mt-1 block font-mono text-[11px] text-[var(--dude-muted)]">
        {variable}
      </code>
    </div>
  );
}

function DocSection({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("mb-12", className)}>
      <h3 className={sectionHeadingClassName()}>{title}</h3>
      {children}
    </section>
  );
}

export function DesignSystemPage({ theme: _theme }: { theme: DudeTheme }) {
  return (
    <div className="max-w-4xl pb-8">
      <h2 className={pageTitleClassName()}>Design System</h2>
      <p className="-mt-4 mb-10 max-w-2xl text-sm leading-relaxed text-[var(--dude-muted)]">
        Bone white, Plus Jakarta Sans, flat layout — no cards, dividers, or pre-titles.
      </p>

      <DocSection title="Banned patterns">
        <div className={stackGroupClassName()}>
          {DESIGN_BANS.map((ban) => (
            <article key={ban.id} className={stackBlockClassName()}>
              <h4 className="text-sm font-semibold text-[var(--dude-text)]">{ban.rule}</h4>
              <p className="mt-2 text-sm leading-relaxed text-[var(--dude-muted)]">
                {ban.detail}
              </p>
            </article>
          ))}
        </div>
      </DocSection>

      <DocSection title="Principles">
        <div className="grid gap-6 sm:grid-cols-2">
          {DESIGN_PRINCIPLES.map((item) => (
            <article key={item.title} className={stackBlockClassName()}>
              <h4 className="text-sm font-semibold text-[var(--dude-text)]">
                {item.title}
              </h4>
              <p className="mt-2 text-sm leading-relaxed text-[var(--dude-muted)]">
                {item.body}
              </p>
            </article>
          ))}
        </div>
      </DocSection>

      <DocSection title="Colors">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {COLOR_TOKENS.map((token) => (
            <Swatch key={token.id} variable={token.variable} name={token.name} />
          ))}
        </div>
      </DocSection>

      <DocSection title="Typography">
        <div className="space-y-6">
          {TYPOGRAPHY_TOKENS.map((token) => (
            <div
              key={token.id}
              className="grid gap-2 py-2 sm:grid-cols-[140px_1fr]"
            >
              <div>
                <div className="text-xs font-medium text-[var(--dude-text)]">
                  {token.name}
                </div>
                <code className="mt-1 block font-mono text-[10px] text-[var(--dude-muted)]">
                  {token.className}
                </code>
              </div>
              <div>
                <p className={token.className}>{token.sample}</p>
                <p className="mt-1 text-xs text-[var(--dude-muted)]">{token.usage}</p>
              </div>
            </div>
          ))}
          <div className="grid gap-6 sm:grid-cols-2">
            <div className={stackBlockClassName()}>
              <p
                className="text-lg font-medium tracking-tight"
                style={{ fontFamily: FONT_STACKS.sans }}
              >
                Plus Jakarta Sans
              </p>
              <p className="mt-1 text-xs text-[var(--dude-muted)]">
                UI, chat, and settings copy.
              </p>
            </div>
            <div className={stackBlockClassName()}>
              <p className="text-sm" style={{ fontFamily: FONT_STACKS.mono }}>
                API keys · runner paths
              </p>
              <p className="mt-1 text-xs text-[var(--dude-muted)]">Mono stack for technical values.</p>
            </div>
          </div>
        </div>
      </DocSection>

      <DocSection title="Spacing">
        <div className="flex flex-wrap gap-6">
          {SPACING_TOKENS.map((token) => (
            <div key={token.id} className="text-center">
              <div
                className={cn(
                  "mx-auto mb-2 rounded-md bg-[var(--dude-accent-soft)]",
                  token.className,
                )}
              >
                <div className="h-6 w-6 bg-[var(--dude-accent)]" />
              </div>
              <div className="font-mono text-[11px] text-[var(--dude-muted)]">
                {token.pixels}px · {token.className}
              </div>
            </div>
          ))}
        </div>
      </DocSection>

      <DocSection title="Radius">
        <div className="flex flex-wrap gap-6">
          {RADIUS_TOKENS.map((token) => (
            <div key={token.id} className="text-center">
              <div
                className={cn(
                  "mb-2 h-14 w-14 bg-[var(--dude-surface-2)]",
                  token.className,
                )}
              />
              <div className="text-xs text-[var(--dude-text)]">{token.name}</div>
              <code className="font-mono text-[10px] text-[var(--dude-muted)]">
                {token.className}
              </code>
            </div>
          ))}
        </div>
      </DocSection>

      <DocSection title="Layout">
        <div className={stackGroupClassName()}>
          <div className="dude-dream-bg p-6">
            <p className="text-sm text-[var(--dude-text)]">
              App shell — subtle grid on{" "}
              <code className="font-mono text-xs">--dude-bg</code>. No border box.
            </p>
          </div>
          <div className={stackBlockClassName()}>
            <p className="text-sm text-[var(--dude-muted)]">
              Use <code className="font-mono text-xs">stackBlockClassName()</code> for
              grouped content — padding only, never a card frame.
            </p>
          </div>
        </div>
      </DocSection>

      <DocSection title="Components">
        <div className={stackGroupClassName()}>
          <div className="flex flex-wrap gap-2">
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Destructive</Button>
          </div>

          <input
            className={fieldInputClassName()}
            placeholder="fieldInputClassName()"
            defaultValue="openrouter / deepseek-v4"
          />

          <div className="relative p-8">
            <div className="pointer-events-none flex flex-col items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--dude-surface-2)]">
                <Sparkles className="h-5 w-5 text-[var(--dude-accent)]" />
              </div>
              <span className="text-base font-semibold">Assistant</span>
            </div>
            <div className="absolute right-4 top-4 flex gap-2">
              <button type="button" className={chromeButtonClassName()} aria-hidden>
                <PanelRightOpen className="h-4 w-4" />
              </button>
              <button type="button" className={chromeButtonClassName(true)} aria-hidden>
                <Settings className="h-5 w-5" />
              </button>
            </div>
          </div>

          <Input className="max-w-xs" placeholder="shadcn Input" />
        </div>
      </DocSection>

      <DocSection title="Motion">
        <ul className="space-y-4">
          {MOTION_TOKENS.map((token) => (
            <li key={token.id} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
              <span className="font-medium text-[var(--dude-text)]">{token.name}</span>
              <span className="font-mono text-xs text-[var(--dude-muted)]">
                {token.duration}
              </span>
              <span className="w-full text-xs text-[var(--dude-muted)] sm:w-auto">
                {token.usage}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-xs text-[var(--dude-muted)]">
          Prefer transform + opacity. Respect{" "}
          <code className="font-mono">prefers-reduced-motion</code>.
        </p>
      </DocSection>
    </div>
  );
}
