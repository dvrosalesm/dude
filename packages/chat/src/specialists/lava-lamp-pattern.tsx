const LAVA_PALETTES = [
  { bg: "#ffffff", blobs: ["#e9d5ff", "#fbcfe8", "#c7d2fe", "#f0abfc"] },
  { bg: "#ffffff", blobs: ["#bfdbfe", "#a5f3fc", "#ddd6fe", "#99f6e4"] },
  { bg: "#ffffff", blobs: ["#fed7aa", "#fde68a", "#fecaca", "#fef08a"] },
  { bg: "#ffffff", blobs: ["#a7f3d0", "#6ee7b7", "#a5f3fc", "#d9f99d"] },
  { bg: "#ffffff", blobs: ["#fbcfe8", "#fecdd3", "#e9d5ff", "#fda4af"] },
  { bg: "#ffffff", blobs: ["#c7d2fe", "#a5b4fc", "#c4b5fd", "#ddd6fe"] },
  { bg: "#ffffff", blobs: ["#fde68a", "#fcd34d", "#bef264", "#fef08a"] },
  { bg: "#ffffff", blobs: ["#99f6e4", "#a5f3fc", "#67e8f9", "#5eead4"] },
];

function lightenHex(hex: string, amount: number) {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  const toHex = (c: number) => mix(c).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function paletteFromTint(tint: string) {
  return {
    bg: "#ffffff",
    blobs: [
      lightenHex(tint, 0.3),
      lightenHex(tint, 0.5),
      lightenHex(tint, 0.7),
      lightenHex(tint, 0.85),
    ],
  };
}

function seededRandom(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(31, h) + seed.charCodeAt(i) | 0;
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
    h = Math.imul(h ^ (h >>> 13), 0x45d9f3b);
    h = (h ^ (h >>> 16)) >>> 0;
    return h / 0x100000000;
  };
}

export function LavaLampPattern({ id, className, tint }: { id: string; className?: string; tint?: string }) {
  const rand = seededRandom(id);
  const palette = tint
    ? paletteFromTint(tint)
    : LAVA_PALETTES[Math.floor(rand() * LAVA_PALETTES.length)];

  const baseFill = [
    {
      cx: 25 + rand() * 30,
      cy: 50,
      rx: 60 + rand() * 20,
      ry: 60 + rand() * 20,
      fill: palette.blobs[0],
      opacity: 1,
    },
    {
      cx: 55 + rand() * 30,
      cy: 50,
      rx: 60 + rand() * 20,
      ry: 60 + rand() * 20,
      fill: palette.blobs[1],
      opacity: 1,
    },
  ];

  const blobCount = 3 + Math.floor(rand() * 3);
  const blobs: Array<{ cx: number; cy: number; rx: number; ry: number; fill: string; opacity: number }> = [];

  for (let i = 0; i < blobCount; i++) {
    blobs.push({
      cx: 10 + rand() * 80,
      cy: 10 + rand() * 80,
      rx: 14 + rand() * 24,
      ry: 14 + rand() * 24,
      fill: palette.blobs[Math.floor(rand() * palette.blobs.length)],
      opacity: 0.95,
    });
  }

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid slice"
      className={className ?? "absolute inset-0 w-full h-full rounded-t-xl"}
    >
      <defs>
        <filter id={`lava-${id}`}>
          <feGaussianBlur in="SourceGraphic" stdDeviation="7" result="blur" />
          <feColorMatrix
            in="blur"
            type="matrix"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7"
            result="goo"
          />
        </filter>
      </defs>
      <rect width="100" height="100" fill={palette.bg} />
      <g filter={`url(#lava-${id})`} opacity="0.3">
        {baseFill.map((b, i) => (
          <ellipse
            key={`base-${i}`}
            cx={b.cx}
            cy={b.cy}
            rx={b.rx}
            ry={b.ry}
            fill={b.fill}
            opacity={b.opacity}
          />
        ))}
        {blobs.map((b, i) => (
          <ellipse
            key={i}
            cx={b.cx}
            cy={b.cy}
            rx={b.rx}
            ry={b.ry}
            fill={b.fill}
            opacity={b.opacity}
          />
        ))}
      </g>
    </svg>
  );
}
