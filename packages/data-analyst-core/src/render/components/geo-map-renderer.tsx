"use client";

import { useEffect, useRef, useState } from "react";
import { geoMercator, geoPath } from "d3-geo";
import { scaleSequential } from "d3-scale";
import {
  interpolateBlues,
  interpolateOranges,
  interpolateGreens,
  interpolateReds,
  interpolatePurples,
  interpolateGreys,
  interpolateViridis,
} from "d3-scale-chromatic";
import { piecewise, interpolateRgb } from "d3-interpolate";
import type { GeoPermissibleObjects } from "d3-geo";

type GeoMapProps = {
  mapLevel: "world" | "adm1" | "adm2";
  countryIso?: string;
  data: Array<{ location: string; value: number }>;
  valueLabel?: string;
  locationLabel?: string;
  colorScheme?: string;
  colors?: string[];
};

type GeoBoundariesIndexEntry = {
  boundaryName: string;
  boundaryISO: string;
  gjDownloadURL?: string;
  simplifiedGeometryGeoJSON?: string;
};

type GeoFeature = GeoJSON.Feature<GeoJSON.Geometry, Record<string, unknown>> & {
  _value: number | null;
  _label: string;
};

// Module-level caches so we don't refetch across re-renders
const geoBoundariesCache: Record<string, GeoBoundariesIndexEntry[] | null> = {};
const geoBoundariesLoading: Record<
  string,
  Promise<GeoBoundariesIndexEntry[] | null>
> = {};
const geoJsonCache: Record<string, Record<string, unknown> | null> = {};

/**
 * Reverse the winding order of all rings in a GeoJSON geometry.
 * geoBoundaries data uses the OPPOSITE winding convention to what d3-geo
 * expects (RFC 7946). Without reversing, d3-geo interprets every polygon as
 * covering the entire globe minus the intended area, producing a solid blue
 * rectangle instead of the country shapes.
 */
function fixWinding(geometry: GeoJSON.Geometry): GeoJSON.Geometry {
  if (geometry.type === "Polygon") {
    return {
      ...geometry,
      coordinates: geometry.coordinates.map((ring) => [...ring].reverse()),
    };
  }
  if (geometry.type === "MultiPolygon") {
    return {
      ...geometry,
      coordinates: geometry.coordinates.map((polygon) =>
        polygon.map((ring) => [...ring].reverse()),
      ),
    };
  }
  return geometry;
}

function normalizeGeoLabel(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const next = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
  return next || null;
}

async function loadGeoBoundariesIndex(
  level: "ADM1" | "ADM2",
): Promise<GeoBoundariesIndexEntry[] | null> {
  if (geoBoundariesCache[level]) return geoBoundariesCache[level];
  if (geoBoundariesLoading[level]) return geoBoundariesLoading[level];

  geoBoundariesLoading[level] = (async () => {
    void level;
    return null;
  })();

  return geoBoundariesLoading[level];
}

/** Fetch GeoJSON via our server-side proxy (avoids CORS with GitHub). */
async function fetchGeoJson(
  geoJsonUrl: string,
): Promise<Record<string, unknown> | null> {
  if (geoJsonCache[geoJsonUrl]) return geoJsonCache[geoJsonUrl];
  try {
    const response = await fetch(geoJsonUrl);
    if (!response.ok) {
      console.error("[GeoMapRenderer] proxy fetch failed:", response.status);
      return null;
    }
    const data = await response.json();
    console.log(
      "[GeoMapRenderer] GeoJSON fetched. type:",
      data?.type,
      "features:",
      Array.isArray(data?.features) ? data.features.length : "N/A",
    );
    geoJsonCache[geoJsonUrl] = data;
    return data;
  } catch (err) {
    console.error("[GeoMapRenderer] GeoJSON fetch error:", err);
    return null;
  }
}

function getColorInterpolator(scheme: string) {
  switch (scheme) {
    case "oranges": return interpolateOranges;
    case "greens": return interpolateGreens;
    case "reds": return interpolateReds;
    case "purples": return interpolatePurples;
    case "greys": case "grays": return interpolateGreys;
    case "viridis": return interpolateViridis;
    default: return interpolateBlues;
  }
}

// ─── World map data (fetched once, cached) ──────────────────────────

const WORLD_TOPOJSON_URL =
  "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

let worldFeaturesCache: GeoFeature[] | null = null;
let worldFeaturesLoading: Promise<GeoFeature[]> | null = null;

/**
 * Convert TopoJSON arcs + object into GeoJSON features.
 * Minimal inline parser — avoids needing the topojson-client dependency.
 */
function topoToGeoFeatures(topo: JsonValue): Array<GeoJSON.Feature<GeoJSON.Geometry>> {
  const arcs: number[][][] = topo.arcs;
  const scale = topo.transform?.scale;
  const translate = topo.transform?.translate;

  function decodeArc(arcIdx: number): number[][] {
    const raw = arcs[arcIdx < 0 ? ~arcIdx : arcIdx];
    const coords: number[][] = [];
    let x = 0;
    let y = 0;
    for (const pt of raw) {
      x += pt[0];
      y += pt[1];
      coords.push([
        scale ? x * scale[0] + translate[0] : x,
        scale ? y * scale[1] + translate[1] : y,
      ]);
    }
    if (arcIdx < 0) coords.reverse();
    return coords;
  }

  function arcRing(indices: number[]): number[][] {
    const ring: number[][] = [];
    for (const idx of indices) {
      const coords = decodeArc(idx);
      // skip first point of subsequent arcs to avoid duplication
      ring.push(...(ring.length > 0 ? coords.slice(1) : coords));
    }
    return ring;
  }

  function buildGeometry(obj: JsonValue): GeoJSON.Geometry {
    if (obj.type === "Polygon") {
      return { type: "Polygon", coordinates: obj.arcs.map(arcRing) };
    }
    if (obj.type === "MultiPolygon") {
      return {
        type: "MultiPolygon",
        coordinates: obj.arcs.map((poly: number[][]) =>
          poly.map(arcRing),
        ),
      };
    }
    return obj;
  }

  const countries = topo.objects?.countries;
  if (!countries?.geometries) return [];

  return countries.geometries.map((geom: JsonValue) => ({
    type: "Feature" as const,
    id: geom.id,
    properties: geom.properties || {},
    geometry: buildGeometry(geom),
  }));
}

async function loadWorldFeatures(): Promise<GeoFeature[]> {
  if (worldFeaturesCache) return worldFeaturesCache;
  if (worldFeaturesLoading) return worldFeaturesLoading;

  worldFeaturesLoading = (async () => {
    const topoRes = await fetch(WORLD_TOPOJSON_URL);
    if (!topoRes.ok) throw new Error("Failed to fetch world map data");
    const topo = await topoRes.json();
    const rawFeatures = topoToGeoFeatures(topo);

    // The world-atlas TopoJSON already has `properties.name` on each feature
    const features: GeoFeature[] = rawFeatures.map((f) => {
      const name = String((f.properties as StringKeyRecord)?.name || f.id);
      return {
        ...f,
        properties: { ...f.properties, shapeName: name },
        _value: null,
        _label: name,
      } as GeoFeature;
    });

    worldFeaturesCache = features;
    worldFeaturesLoading = null;
    return features;
  })();

  return worldFeaturesLoading;
}

// ─── Admin map (D3 SVG rendered directly in React) ────────────────────

function AdminMapSvg({
  features,
  valueLabel,
  locationLabel,
  colorScheme,
  colors,
  applyWindingFix = true,
}: {
  features: GeoFeature[];
  valueLabel: string;
  locationLabel: string;
  colorScheme: string;
  colors?: string[];
  /** Fix winding order for geoBoundaries data. Set false for world-atlas data. */
  applyWindingFix?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [dims, setDims] = useState({ w: 0, h: 0 });
  const [showLabels, setShowLabels] = useState(false);
  const [labelSize, setLabelSize] = useState(9);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    label: string;
    value: number | null;
  } | null>(null);

  // Zoom & pan — use refs during interaction to avoid re-renders per frame
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const panRef = useRef(pan);
  const zoomRef = useRef(zoom);
  const dragRef = useRef<{ startX: number; startY: number; startPanX: number; startPanY: number } | null>(null);
  const mapGroupRef = useRef<SVGGElement>(null);

  // Keep refs in sync with state
  panRef.current = pan;
  zoomRef.current = zoom;

  // Observe container size
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    // Read initial size immediately
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      setDims({ w: rect.width, h: rect.height });
    }
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) setDims({ w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { w, h } = dims;

  // Wheel zoom — non-passive native listener so preventDefault stops page scroll
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const nextZoom = Math.min(Math.max(zoomRef.current * delta, 0.5), 20);
      zoomRef.current = nextZoom;
      const g = mapGroupRef.current;
      if (g) {
        const p = panRef.current;
        g.setAttribute("transform", `translate(${400 + p.x},${300 + p.y}) scale(${nextZoom}) translate(-400,-300)`);
      }
      setZoom(nextZoom);
    };
    svg.addEventListener("wheel", handler, { passive: false });
    return () => svg.removeEventListener("wheel", handler);
  }, [w]);

  // Build clean GeoJSON features for d3 — strip custom properties and
  // optionally fix winding order (geoBoundaries uses opposite convention to RFC 7946,
  // but world-atlas TopoJSON already has correct winding)
  const cleanFeatures: GeoJSON.Feature[] = features.map((f) => ({
    type: "Feature" as const,
    geometry: applyWindingFix ? fixWinding(f.geometry) : f.geometry,
    properties: f.properties || {},
  }));

  const fc: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features: cleanFeatures,
  };

  // Use fixed render size for projection math, then scale via viewBox
  const rw = 800;
  const rh = 600;

  // Projection fitted to data
  const projection = geoMercator().fitSize([rw * 0.82, rh * 0.88], fc);
  const [tx, ty] = projection.translate();
  projection.translate([tx + rw * 0.04, ty + rh * 0.03]);
  const pathGen = geoPath().projection(projection);

  // Debug: log projection info
  const scale = projection.scale();
  const translate = projection.translate();
  console.log("[AdminMapSvg] render dims:", { w, h }, "fixed:", { rw, rh });
  console.log("[AdminMapSvg] projection scale:", scale, "translate:", translate);
  console.log("[AdminMapSvg] features count:", features.length);

  // Debug: check first feature path
  if (features.length > 0) {
    const samplePath = pathGen(cleanFeatures[0]);
    console.log("[AdminMapSvg] first feature geometry type:", features[0].geometry?.type);
    console.log("[AdminMapSvg] first feature path length:", samplePath?.length ?? 0);
    console.log("[AdminMapSvg] first feature path prefix:", samplePath?.slice(0, 120));

    // Check all paths
    let emptyPaths = 0;
    let totalPathLen = 0;
    for (const cf of cleanFeatures) {
      const p = pathGen(cf);
      if (!p) emptyPaths++;
      else totalPathLen += p.length;
    }
    console.log("[AdminMapSvg] empty paths:", emptyPaths, "total path chars:", totalPathLen);
  }

  // Color scale
  const matchedValues = features
    .map((f) => f._value)
    .filter((v): v is number => v !== null);
  const vMin = matchedValues.length ? Math.min(...matchedValues) : 0;
  let vMax = matchedValues.length ? Math.max(...matchedValues) : 1;
  if (vMin === vMax) vMax = vMin + 1;

  // Build interpolator: custom colors array takes priority over preset scheme
  const interpFn = (() => {
    if (colors && colors.length >= 2) {
      // Custom gradient from AI-provided hex colors (low→high)
      return piecewise(interpolateRgb.gamma(2.2), colors) as (t: number) => string;
    }
    // Clamp preset to [0.25, 0.95] so low values are visible on white/gray bg
    const preset = getColorInterpolator(colorScheme);
    return (t: number) => preset(0.25 + t * 0.7);
  })();
  const colorScale = scaleSequential(interpFn).domain([vMin, vMax]);
  const noDataColor = "#e8e0d8"; // warm beige — distinct from white/gray bg

  // Legend — discrete swatches sampled from the exact same colorScale
  const legendSteps = 5;
  const legendSwatchSize = 14;
  const legendGap = 3;
  const legendSwatches = Array.from({ length: legendSteps }, (_, i) => {
    const val = vMin + (i / (legendSteps - 1)) * (vMax - vMin);
    return { value: Math.round(val * 100) / 100, color: colorScale(val) };
  }).reverse(); // high → low top to bottom
  const legendTotalH = legendSteps * (legendSwatchSize + legendGap) - legendGap;
  const legendX = rw - 80;
  const legendY = (rh - legendTotalH) / 2 - 16;

  // If container hasn't been measured yet, show placeholder that fills parent
  if (w === 0 || h === 0) {
    return (
      <div ref={containerRef} style={{ width: "100%", height: "100%", minHeight: 200 }}>
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          Preparing map...
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} style={{ width: "100%", height: "100%", position: "relative" }}>
      {/* Map controls — hidden in PDF/print */}
      <div
        className="print-hide"
        style={{
          position: "absolute",
          top: 4,
          left: 4,
          zIndex: 5,
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 11,
          fontWeight: 500,
          color: "#334155",
          userSelect: "none",
        }}
      >
        <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={showLabels}
            onChange={(e) => setShowLabels(e.target.checked)}
            style={{ accentColor: "#334155" }}
          />
          Labels
        </label>
        {showLabels && (
          <span style={{ display: "flex", alignItems: "center", gap: 2 }}>
            <button
              type="button"
              onClick={() => setLabelSize((s) => Math.max(5, s - 1))}
              style={{
                width: 18, height: 18, border: "1px solid #94a3b8", borderRadius: 3,
                background: "#f1f5f9", cursor: "pointer", fontSize: 12, lineHeight: 1,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
              title="Decrease label size"
            >
              −
            </button>
            <span style={{ minWidth: 16, textAlign: "center" }}>{labelSize}</span>
            <button
              type="button"
              onClick={() => setLabelSize((s) => Math.min(18, s + 1))}
              style={{
                width: 18, height: 18, border: "1px solid #94a3b8", borderRadius: 3,
                background: "#f1f5f9", cursor: "pointer", fontSize: 12, lineHeight: 1,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
              title="Increase label size"
            >
              +
            </button>
          </span>
        )}
        {zoom !== 1 && (
          <button
            type="button"
            onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
            style={{
              border: "1px solid #94a3b8",
              borderRadius: 3,
              background: "#f1f5f9",
              cursor: "pointer",
              fontSize: 10,
              fontWeight: 600,
              padding: "2px 6px",
              color: "#334155",
            }}
            title="Reset zoom"
          >
            Reset
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            const svg = svgRef.current;
            if (!svg) return;
            const serializer = new XMLSerializer();
            const source = serializer.serializeToString(svg);
            const blob = new Blob(
              ['<?xml version="1.0" encoding="UTF-8"?>\n', source],
              { type: "image/svg+xml;charset=utf-8" },
            );
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "map.svg";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }}
          style={{
            border: "1px solid #94a3b8",
            borderRadius: 3,
            background: "#f1f5f9",
            cursor: "pointer",
            fontSize: 10,
            fontWeight: 600,
            padding: "2px 6px",
            color: "#334155",
          }}
          title="Export map as SVG"
        >
          ⬇ SVG
        </button>
      </div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${rw} ${rh}`}
        preserveAspectRatio="xMidYMid meet"
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: "block", width: "100%", height: "100%", background: "transparent", cursor: "grab" }}
        onMouseDown={(e) => {
          if (e.button !== 0) return;
          e.currentTarget.style.cursor = "grabbing";
          const svg = e.currentTarget;
          const g = mapGroupRef.current;
          dragRef.current = { startX: e.clientX, startY: e.clientY, startPanX: panRef.current.x, startPanY: panRef.current.y };
          const onMove = (ev: MouseEvent) => {
            if (!dragRef.current || !g) return;
            const dx = ev.clientX - dragRef.current.startX;
            const dy = ev.clientY - dragRef.current.startY;
            // Scale mouse pixels to viewBox units: viewBox is rw×rh, rendered at dims w×h
            const scaleX = rw / (w || 1);
            const scaleY = rh / (h || 1);
            const panX = dragRef.current.startPanX + dx * scaleX;
            const panY = dragRef.current.startPanY + dy * scaleY;
            // Update DOM directly — no React re-render
            g.setAttribute("transform", `translate(${rw / 2 + panX},${rh / 2 + panY}) scale(${zoomRef.current}) translate(${-rw / 2},${-rh / 2})`);
            panRef.current = { x: panX, y: panY };
          };
          const onUp = () => {
            dragRef.current = null;
            svg.style.cursor = "grab";
            // Commit final pan to React state (single re-render)
            setPan({ ...panRef.current });
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
          };
          window.addEventListener("mousemove", onMove);
          window.addEventListener("mouseup", onUp);
        }}
      >
        <g ref={mapGroupRef} transform={`translate(${rw / 2 + pan.x},${rh / 2 + pan.y}) scale(${zoom}) translate(${-rw / 2},${-rh / 2})`}>
        {/* Map regions */}
        {features.map((f, i) => {
          const d = pathGen(cleanFeatures[i]) || "";
          const fill =
            f._value !== null ? colorScale(f._value) : noDataColor;
          return (
            <path
              key={i}
              d={d}
              fill={fill}
              stroke="#1e293b"
              strokeWidth={0.8}
              onMouseEnter={(e) =>
                setTooltip({
                  x: e.nativeEvent.offsetX,
                  y: e.nativeEvent.offsetY,
                  label: f._label,
                  value: f._value,
                })
              }
              onMouseMove={(e) =>
                setTooltip((prev) =>
                  prev
                    ? {
                        ...prev,
                        x: e.nativeEvent.offsetX,
                        y: e.nativeEvent.offsetY,
                      }
                    : null,
                )
              }
              onMouseLeave={() => setTooltip(null)}
              style={{ cursor: "pointer" }}
            />
          );
        })}

        {/* Inline labels at feature centroids */}
        {showLabels &&
          features.map((f, i) => {
            const centroid = pathGen.centroid(cleanFeatures[i]);
            if (!centroid || !isFinite(centroid[0]) || !isFinite(centroid[1])) return null;
            const [cx, cy] = centroid;
            const fill = f._value !== null ? colorScale(f._value) : noDataColor;
            // Pick text color: white on dark fills, dark on light fills
            const textColor = f._value !== null && (f._value - vMin) / (vMax - vMin) > 0.45
              ? "#f8fafc"
              : "#0f172a";
            return (
              <g key={`label-${i}`} transform={`translate(${cx},${cy})`} style={{ pointerEvents: "none" }}>
                <text
                  textAnchor="middle"
                  dy="-0.15em"
                  fontSize={labelSize}
                  fontWeight={700}
                  fill={textColor}
                  stroke={fill}
                  strokeWidth={labelSize * 0.28}
                  paintOrder="stroke"
                >
                  {f._label}
                </text>
                {f._value !== null && (
                  <text
                    textAnchor="middle"
                    dy="1.1em"
                    fontSize={labelSize - 1}
                    fontWeight={600}
                    fill={textColor}
                    stroke={fill}
                    strokeWidth={labelSize * 0.22}
                    paintOrder="stroke"
                  >
                    {f._value}
                  </text>
                )}
              </g>
            );
          })}

        </g>

        {/* Legend — discrete swatches (fixed position, not affected by zoom/pan) */}
        <g transform={`translate(${legendX},${legendY})`} fontSize={11} fill="#1e293b">
          <text x={0} y={0} fontWeight={700} fontSize={12}>
            {valueLabel}
          </text>
          {legendSwatches.map((s, i) => {
            const y = 10 + i * (legendSwatchSize + legendGap);
            return (
              <g key={i} transform={`translate(0,${y})`}>
                <rect
                  width={legendSwatchSize}
                  height={legendSwatchSize}
                  rx={2}
                  fill={s.color}
                  stroke="#334155"
                  strokeWidth={0.5}
                />
                <text x={legendSwatchSize + 5} y={legendSwatchSize - 3} fontWeight={600}>
                  {s.value}
                </text>
              </g>
            );
          })}
          {/* No-data swatch */}
          <g transform={`translate(0,${10 + legendSteps * (legendSwatchSize + legendGap) + 4})`}>
            <rect
              width={legendSwatchSize}
              height={legendSwatchSize}
              rx={2}
              fill={noDataColor}
              stroke="#334155"
              strokeWidth={0.5}
            />
            <text x={legendSwatchSize + 5} y={legendSwatchSize - 3} fontWeight={500} fontSize={10}>
              N/A
            </text>
          </g>
        </g>
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div
          style={{
            position: "absolute",
            left: tooltip.x + 14,
            top: tooltip.y - 32,
            pointerEvents: "none",
            background: "#0f172a",
            color: "#f8fafc",
            fontSize: 12,
            fontWeight: 500,
            padding: "6px 10px",
            borderRadius: 6,
            boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
            whiteSpace: "nowrap",
            zIndex: 10,
          }}
        >
          <strong>{tooltip.label}</strong>
          {tooltip.value !== null && (
            <span>
              {" "}
              &mdash; {valueLabel}: {tooltip.value}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────

export function GeoMapRenderer({ props }: { props: GeoMapProps }) {
  console.log("[GeoMapRenderer] received props:", JSON.stringify(props));
  const {
    mapLevel,
    countryIso,
    data,
    valueLabel = "Cantidad",
    locationLabel = mapLevel === "world" ? "País" : "Región",
    colorScheme = "oranges",
    colors,
  } = props;

  // Merged GeoJSON features (used for both world and admin maps)
  const [adminFeatures, setAdminFeatures] = useState<GeoFeature[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    setAdminFeatures(null);
    setLoading(true);
    setError(null);

    console.log("[GeoMapRenderer] effect running. mapLevel:", mapLevel, "countryIso:", countryIso, "data rows:", data?.length);

    async function resolve() {
      try {
        if (mapLevel === "world") {
          const worldFeatures = await loadWorldFeatures();
          if (cancelled) return;

          // Match user data to world features
          const dataMap = new Map<string, { location: string; value: number }>();
          for (const row of data) {
            const norm = normalizeGeoLabel(row.location);
            if (norm) dataMap.set(norm, row);
          }

          const merged: GeoFeature[] = worldFeatures.map((f) => {
            const norm = normalizeGeoLabel(f._label);
            const match = norm ? dataMap.get(norm) : undefined;
            return {
              ...f,
              _value: match ? match.value : null,
              _label: match ? match.location : f._label,
            };
          });

          console.log("[GeoMapRenderer] world features matched:", merged.filter((f) => f._value !== null).length, "/", merged.length);
          setAdminFeatures(merged);
          setLoading(false);
          return;
        }

        // Subnational map
        const level = mapLevel === "adm2" ? "ADM2" : "ADM1";
        console.log("[GeoMapRenderer] loading geoBoundaries index for level:", level);
        const index = await loadGeoBoundariesIndex(level);
        if (cancelled) return;

        console.log("[GeoMapRenderer] geoBoundaries index loaded. entries:", index?.length ?? 0);

        if (!index?.length) {
          setError("Could not load geographic boundaries index.");
          setLoading(false);
          return;
        }

        const iso = countryIso?.toUpperCase();
        if (!iso) {
          setError("Country ISO code is required for subnational maps.");
          setLoading(false);
          return;
        }

        const match = index.find((entry) => entry.boundaryISO === iso);
        const geoJsonUrl =
          match?.gjDownloadURL || match?.simplifiedGeometryGeoJSON || "";

        console.log("[GeoMapRenderer] ISO lookup:", iso, "match:", match?.boundaryName, "geoJsonUrl:", geoJsonUrl?.slice(0, 120));

        if (!match?.boundaryName || !geoJsonUrl) {
          setError(`No geographic boundaries found for ISO code: ${iso}`);
          setLoading(false);
          return;
        }

        // Fetch GeoJSON via our server-side proxy
        const geojson = await fetchGeoJson(geoJsonUrl);
        if (cancelled) return;

        if (!geojson || !Array.isArray((geojson as { features?: unknown }).features)) {
          console.error("[GeoMapRenderer] Invalid GeoJSON response:", geojson?.type);
          setError("Failed to load geographic boundaries data.");
          setLoading(false);
          return;
        }

        const rawFeatures = (geojson as { features: Array<Record<string, unknown>> }).features;
        console.log("[GeoMapRenderer] GeoJSON features extracted:", rawFeatures.length);

        // Debug: inspect first feature's structure
        if (rawFeatures.length > 0) {
          const f0 = rawFeatures[0];
          const geom = f0.geometry as Record<string, unknown> | undefined;
          console.log("[GeoMapRenderer] first feature keys:", Object.keys(f0));
          console.log("[GeoMapRenderer] first feature type:", f0.type);
          console.log("[GeoMapRenderer] first feature geometry type:", geom?.type);
          const coords = geom?.coordinates;
          if (Array.isArray(coords)) {
            console.log("[GeoMapRenderer] geometry coords depth0 length:", coords.length);
            if (Array.isArray(coords[0])) {
              console.log("[GeoMapRenderer] geometry coords depth1 length:", coords[0].length);
              if (Array.isArray(coords[0][0])) {
                console.log("[GeoMapRenderer] coords sample:", JSON.stringify(coords[0][0].slice(0, 2)));
              } else {
                console.log("[GeoMapRenderer] coords[0][0]:", coords[0][0]);
              }
            }
          }
          const props0 = f0.properties as Record<string, unknown> | undefined;
          if (props0) {
            console.log("[GeoMapRenderer] first feature property keys:", Object.keys(props0));
            console.log("[GeoMapRenderer] first feature shapeName:", props0.shapeName);
          }
        }

        // Build lookup map and merge data into features
        const dataMap = new Map<string, { location: string; value: number }>();
        for (const row of data) {
          const norm = normalizeGeoLabel(row.location);
          if (norm) dataMap.set(norm, row);
        }

        const merged: GeoFeature[] = rawFeatures.map((feature) => {
          const fprops = (feature.properties || {}) as Record<string, unknown>;
          const shapeName = String(
            fprops.shapeName || fprops.name || fprops.NAME_1 || fprops.NOMBRE ||
            fprops.departamento || fprops.provincia || fprops.state || fprops.region || "",
          );
          const norm = normalizeGeoLabel(shapeName);
          const row = norm ? dataMap.get(norm) : undefined;
          return {
            ...feature,
            type: "Feature" as const,
            geometry: feature.geometry as GeoJSON.Geometry,
            properties: fprops,
            _value: row ? row.value : null,
            _label: row ? row.location : shapeName,
          };
        });

        const matchedCount = merged.filter((f) => f._value !== null).length;
        console.log("[GeoMapRenderer] merged features:", merged.length, "matched:", matchedCount);
        console.log("[GeoMapRenderer] sample:", merged.slice(0, 3).map((f) => `${f._label}→${f._value}`).join(", "));

        setAdminFeatures(merged);
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        console.error("[GeoMapRenderer] error:", err);
        setError(
          err instanceof Error ? err.message : "Failed to resolve map data",
        );
        setLoading(false);
      }
    }

    void resolve();
    return () => {
      cancelled = true;
    };
  }, [mapLevel, countryIso, data, valueLabel, locationLabel, colorScheme]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent mr-2" />
        Loading map...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-destructive">
        {error}
      </div>
    );
  }

  // D3 SVG map (both world and admin)
  if (adminFeatures) {
    return (
      <AdminMapSvg
        features={adminFeatures}
        valueLabel={valueLabel}
        locationLabel={locationLabel}
        colorScheme={colorScheme}
        colors={colors}
        applyWindingFix={mapLevel !== "world"}
      />
    );
  }

  return (
    <div className="flex h-full items-center justify-center text-sm text-destructive">
      Failed to build map
    </div>
  );
}
