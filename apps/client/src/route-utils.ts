import { useEffect, useState } from "react";
import type { SpecialistId } from "./types";

export type RouteSection = "assistant" | "specialists" | "preferences";

export interface ChatRoute {
  section: RouteSection;
  specialistId?: SpecialistId;
  workspaceId?: string;
  subpath: string[];
}

const FILE_ROUTE_PARAM = "dudeRoute";
const ROUTE_SECTIONS = new Set(["assistant", "specialists", "preferences"]);
const SPECIALIST_IDS = new Set([
  "main-assistant",
  "data-analyst",
  "document-writer",
  "presentation-editor",
  "design-branding",
  "prospect",
]);

export function isHashRouting() {
  return typeof window !== "undefined" && window.location.protocol === "file:";
}

export function readRoutePath() {
  if (typeof window === "undefined") return "/chat";
  if (isHashRouting()) {
    const queryRoute = new URLSearchParams(window.location.search).get(
      FILE_ROUTE_PARAM,
    );
    if (queryRoute) return queryRoute;
    return window.location.hash.replace(/^#/, "") || "/chat";
  }
  return window.location.pathname || "/chat";
}

export function normalizePath(path: string) {
  const cleanedPath = path.split(/[?#]/)[0];
  if (!cleanedPath || cleanedPath === "/" || cleanedPath.endsWith("/index.html")) {
    return "/chat";
  }
  return cleanedPath.startsWith("/") ? cleanedPath : `/${cleanedPath}`;
}

export function navigateTo(path: string, replace = false) {
  const nextPath = normalizePath(path);

  if (isHashRouting()) {
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set(FILE_ROUTE_PARAM, nextPath);
    nextUrl.hash = "";
    if (replace) {
      window.history.replaceState({}, "", nextUrl);
      window.dispatchEvent(new PopStateEvent("popstate"));
      return;
    }
    window.history.pushState({}, "", nextUrl);
    window.dispatchEvent(new PopStateEvent("popstate"));
    return;
  }

  if (replace) {
    window.history.replaceState({}, "", nextPath);
  } else {
    window.history.pushState({}, "", nextPath);
  }
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export function useRoutePath() {
  const [path, setPath] = useState(() => normalizePath(readRoutePath()));

  useEffect(() => {
    function syncPath() {
      setPath(normalizePath(readRoutePath()));
    }

    window.addEventListener("popstate", syncPath);
    window.addEventListener("hashchange", syncPath);
    syncPath();

    return () => {
      window.removeEventListener("popstate", syncPath);
      window.removeEventListener("hashchange", syncPath);
    };
  }, []);

  useEffect(() => {
    const rawPath = readRoutePath();
    if (!rawPath || rawPath === "/" || rawPath.endsWith("/index.html")) {
      navigateTo("/chat", true);
    }
  }, [path]);

  return path;
}

export function parseRoute(path: string): ChatRoute {
  const segments = normalizePath(path).split("/").filter(Boolean);
  let cursor = 0;

  if (segments[cursor] === "chat") {
    cursor += 1;
  }

  // Legacy: /chat/:orgId/... — skip org segment
  if (
    segments[cursor] &&
    !ROUTE_SECTIONS.has(segments[cursor]) &&
    !SPECIALIST_IDS.has(segments[cursor])
  ) {
    cursor += 1;
  }

  const maybeSection = segments[cursor];
  const section = ROUTE_SECTIONS.has(maybeSection)
    ? (maybeSection as RouteSection)
    : "assistant";
  cursor += section === "assistant" && maybeSection !== "assistant" ? 0 : 1;

  const maybeSpecialistId = segments[cursor];
  const specialistId = SPECIALIST_IDS.has(maybeSpecialistId ?? "")
    ? (maybeSpecialistId as SpecialistId)
    : undefined;
  if (specialistId) cursor += 1;

  const workspaceId = specialistId ? segments[cursor] : undefined;
  if (workspaceId) cursor += 1;

  return {
    section,
    specialistId,
    workspaceId,
    subpath: segments.slice(cursor),
  };
}

export function getCurrentParams() {
  const route = parseRoute(readRoutePath());
  return {
    specialistId: route.specialistId,
    workspaceId: route.workspaceId,
    assessmentId:
      route.subpath[0] === "assessment" ? route.subpath[1] : undefined,
  };
}

export function specialistPath(specialistId: SpecialistId, workspaceId?: string) {
  return workspaceId
    ? `/chat/specialists/${specialistId}/${workspaceId}`
    : `/chat/specialists/${specialistId}`;
}
