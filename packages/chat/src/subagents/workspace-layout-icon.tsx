type Props = {
  subagentId?: string;
  className?: string;
  style?: React.CSSProperties;
};

const STROKE = "currentColor";

export const SPECIALIST_COLORS: Record<string, string> = {
  "data-analyst": "var(--dude-accent)",
  "document-writer": "var(--dude-accent)",
  "document-editor": "var(--dude-accent)",
  "design-branding": "var(--dude-accent)",
  "prospect-pipeline": "var(--dude-accent)",
  prospect: "var(--dude-accent)",
};

export function getSubagentColor(subagentId?: string) {
  return (subagentId && SPECIALIST_COLORS[subagentId]) || "var(--dude-muted)";
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 96 64"
      fill="none"
      stroke={STROKE}
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="4" y="6" width="88" height="52" rx="6" />
      {children}
    </svg>
  );
}

function SalesPipeline() {
  return (
    <svg
      viewBox="0 0 96 64"
      fill="none"
      stroke={STROKE}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Network paths (organic) */}
      <line x1="22" y1="32" x2="46" y2="14" />
      <line x1="46" y1="14" x2="58" y2="32" />
      <line x1="58" y1="32" x2="78" y2="46" />
      <line x1="58" y1="32" x2="84" y2="20" />
      <line x1="22" y1="32" x2="58" y2="32" />
      {/* People (varied sizes) */}
      <circle cx="22" cy="32" r="12" fill="white" />
      <circle cx="46" cy="14" r="7" fill="white" />
      <circle cx="78" cy="46" r="6" fill="white" />
      <circle cx="84" cy="20" r="5" fill="white" />
      {/* Highlighted person */}
      <circle cx="58" cy="32" r="8" fill={STROKE} stroke="none" />
      {/* ! next to highlighted (with white halo to mask lines) */}
      <text
        x="72"
        y="32"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="14"
        fontWeight="800"
        stroke="white"
        strokeWidth="3.5"
        fill="white"
      >
        !
      </text>
      <text
        x="72"
        y="32"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="14"
        fontWeight="800"
        fill={STROKE}
        stroke="none"
      >
        !
      </text>
    </svg>
  );
}

function DataDashboard() {
  return (
    <svg
      viewBox="0 0 96 64"
      fill="none"
      stroke={STROKE}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Scattered data points */}
      <circle cx="8" cy="14" r="1.8" />
      <circle cx="22" cy="20" r="1.8" />
      <circle cx="36" cy="14" r="1.8" />
      <circle cx="14" cy="32" r="1.8" />
      <circle cx="30" cy="36" r="1.8" />
      <circle cx="44" cy="24" r="1.8" />
      <circle cx="20" cy="48" r="1.8" />
      <circle cx="38" cy="50" r="1.8" />
      <circle cx="46" cy="44" r="1.8" />
      {/* Magnifying glass lens */}
      <circle cx="64" cy="26" r="14" />
      {/* Regular data points inside lens */}
      <circle cx="58" cy="20" r="1.8" />
      <circle cx="72" cy="32" r="1.8" />
      {/* Anomaly inside lens (filled badge with exclamation) */}
      <rect x="60" y="22" width="8" height="8" rx="1" fill={STROKE} stroke="none" />
      <line
        x1="64"
        y1="23.8"
        x2="64"
        y2="26.8"
        stroke="white"
        strokeWidth="1.4"
      />
      <circle cx="64" cy="28.4" r="0.7" fill="white" stroke="none" />
    </svg>
  );
}

function ProspectLanding() {
  return (
    <svg
      viewBox="0 0 96 64"
      fill="none"
      stroke={STROKE}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Three webpage thumbnails */}
      <rect x="6" y="14" width="22" height="28" rx="2" />
      <rect x="37" y="14" width="22" height="28" rx="2" />
      <rect x="68" y="14" width="22" height="28" rx="2" />
      {/* Cursor pointing at middle square */}
      <path
        d="M 50 24 L 50 40 L 54 37 L 57 43 L 59 42 L 56 36 L 60 36 Z"
        fill={STROKE}
        stroke="white"
        strokeWidth="1"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DesignPalette() {
  return (
    <svg
      viewBox="0 0 96 64"
      fill="none"
      stroke={STROKE}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="22" y="10" width="26" height="26" rx="1.5" fill="white" />
      <polygon points="62,10 42,36 76,36" fill="white" />
      <circle cx="48" cy="38" r="14" fill="white" />
    </svg>
  );
}

function DocumentLines() {
  return (
    <svg
      viewBox="0 0 96 64"
      fill="none"
      stroke={STROKE}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Date / address (top right) */}
      <line x1="64" y1="12" x2="84" y2="12" />
      {/* Salutation (top left) */}
      <line x1="12" y1="22" x2="36" y2="22" />
      {/* Body */}
      <line x1="12" y1="30" x2="84" y2="30" />
      <line x1="12" y1="36" x2="84" y2="36" />
      <line x1="12" y1="42" x2="72" y2="42" />
      {/* Signature (bottom right) */}
      <line x1="58" y1="52" x2="72" y2="52" />
      {/* Editing pencil */}
      <path d="M 74 52 L 76 50 L 88 38 L 90 40 L 78 52 Z" />
      <line x1="85" y1="41" x2="87" y2="43" />
    </svg>
  );
}

function PresentationSlide() {
  return (
    <svg
      viewBox="0 0 96 64"
      fill="none"
      stroke={STROKE}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Left peek slide (right half visible) */}
      <path d="M 2 14 L 18 14 Q 20 14 20 16 L 20 48 Q 20 50 18 50 L 2 50" />
      {/* Middle slide (full) */}
      <rect x="24" y="14" width="48" height="36" rx="2.5" />
      <text
        x="48"
        y="32"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="14"
        fontWeight="600"
        fill={STROKE}
        stroke="none"
      >
        ABC
      </text>
      {/* Right peek slide (left half visible) */}
      <path d="M 94 14 L 78 14 Q 76 14 76 16 L 76 48 Q 76 50 78 50 L 94 50" />
    </svg>
  );
}

function GenericPanels() {
  return (
    <Frame>
      <line x1="4" y1="20" x2="92" y2="20" />
      <line x1="26" y1="20" x2="26" y2="58" />
      <line x1="11" y1="28" x2="20" y2="28" />
      <line x1="11" y1="34" x2="20" y2="34" />
      <line x1="11" y1="40" x2="20" y2="40" />
      <line x1="32" y1="28" x2="84" y2="28" />
      <line x1="32" y1="34" x2="76" y2="34" />
      <line x1="32" y1="40" x2="80" y2="40" />
      <line x1="32" y1="46" x2="68" y2="46" />
    </Frame>
  );
}

export function WorkspaceLayoutIcon({ subagentId, className, style }: Props) {
  const cls = className ?? "w-20 h-14 text-foreground/70";
  let body: React.ReactNode;
  switch (subagentId) {
    case "prospect-pipeline":
      body = <SalesPipeline />;
      break;
    case "data-analyst":
      body = <DataDashboard />;
      break;
    case "prospect":
      body = <ProspectLanding />;
      break;
    case "design-branding":
      body = <DesignPalette />;
      break;
    case "document-writer":
      body = <DocumentLines />;
      break;
    case "document-editor":
      body = <PresentationSlide />;
      break;
    default:
      body = <GenericPanels />;
  }
  return <div className={cls} style={style}>{body}</div>;
}
