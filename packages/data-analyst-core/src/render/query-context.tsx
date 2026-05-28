"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
} from "react";

export type QueryResult = {
  columns: string[];
  rows: Array<Record<string, unknown>>;
};

export type RunQuery = (sql: string) => Promise<QueryResult>;

const QueryContext = createContext<RunQuery | null>(null);

export function QueryProvider({
  runQuery,
  children,
}: {
  runQuery: RunQuery;
  children: React.ReactNode;
}) {
  return (
    <QueryContext.Provider value={runQuery}>{children}</QueryContext.Provider>
  );
}

/**
 * Wrapper that resolves a `query` prop to `data` before rendering.
 * Falls back to static `data` if no query or no QueryProvider.
 */
export function WithQueryData({
  props,
  children,
}: {
  props: Record<string, unknown>;
  children: (resolvedProps: Record<string, unknown>) => React.ReactNode;
}) {
  const runQuery = useContext(QueryContext);
  const query = typeof props.query === "string" ? props.query : null;
  const [data, setData] = useState<Array<Record<string, unknown>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!query);
  const lastQueryRef = useRef<string | null>(null);

  useEffect(() => {
    if (!query || !runQuery) {
      setLoading(false);
      return;
    }
    if (query === lastQueryRef.current && data) return;
    lastQueryRef.current = query;

    let cancelled = false;
    setLoading(true);
    setError(null);

    runQuery(query)
      .then((result) => {
        if (cancelled) return;
        setData(result.rows);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Query failed");
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [query, runQuery, data]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
        Loading data...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-destructive">
        {error}
      </div>
    );
  }

  const resolvedProps = { ...props };
  if (query && data) {
    resolvedProps.data = data;
  }

  return <>{children(resolvedProps)}</>;
}
