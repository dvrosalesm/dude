import type { WorkspaceSchema, DetectedRelationship } from "../types";

/**
 * Detect potential JOIN relationships between tables based on column name
 * matching and type compatibility. Pure function — no SQL needed.
 */
export function detectRelationships(
  schema: WorkspaceSchema,
): DetectedRelationship[] {
  const tableNames = Object.keys(schema.tables);
  if (tableNames.length < 2) return [];

  const relationships: DetectedRelationship[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < tableNames.length; i++) {
    for (let j = i + 1; j < tableNames.length; j++) {
      const tableA = tableNames[i];
      const tableB = tableNames[j];
      const colsA = schema.tables[tableA].columns;
      const colsB = schema.tables[tableB].columns;

      for (const colA of colsA) {
        for (const colB of colsB) {
          const match = matchColumns(
            tableA,
            colA.name,
            colA.type,
            tableB,
            colB.name,
            colB.type,
          );
          if (!match) continue;

          const key = [tableA, colA.name, tableB, colB.name].sort().join("|");
          if (seen.has(key)) continue;
          seen.add(key);

          relationships.push({
            tableA,
            tableB,
            columnA: colA.name,
            columnB: colB.name,
            confidence: match,
          });
        }
      }
    }
  }

  // Sort by confidence
  const order: Record<string, number> = { high: 0, medium: 1, low: 2 };
  relationships.sort((a, b) => order[a.confidence] - order[b.confidence]);

  return relationships;
}

function matchColumns(
  tableA: string,
  colA: string,
  typeA: string,
  tableB: string,
  colB: string,
  typeB: string,
): "high" | "medium" | "low" | null {
  const a = colA.toLowerCase();
  const b = colB.toLowerCase();
  const tA = tableA.toLowerCase();
  const tB = tableB.toLowerCase();

  // Exact name match with id-like pattern → HIGH
  if (a === b && isIdLike(a)) {
    return "high";
  }

  // {other_table}_id pattern → HIGH
  if (a === `${tB}_id` || a === `${tB}id`) return "high";
  if (b === `${tA}_id` || b === `${tA}id`) return "high";

  // One is "id" and the other is "{table}_id" → HIGH
  if (a === "id" && (b === `${tA}_id` || b === `${tA}id`)) return "high";
  if (b === "id" && (a === `${tB}_id` || a === `${tB}id`)) return "high";

  // Exact name match with compatible types → MEDIUM
  if (a === b && typesCompatible(typeA, typeB)) {
    // Skip very generic names at medium level
    if (isGenericName(a)) return "low";
    return "medium";
  }

  // Similar suffix pattern (e.g., user_id and author_id both end in _id) → LOW
  if (
    a.endsWith("_id") &&
    b.endsWith("_id") &&
    typesCompatible(typeA, typeB)
  ) {
    return "low";
  }

  return null;
}

function isIdLike(name: string): boolean {
  return (
    name === "id" ||
    name.endsWith("_id") ||
    name.endsWith("id") ||
    name.endsWith("_key") ||
    name.endsWith("_code")
  );
}

function isGenericName(name: string): boolean {
  const generic = new Set([
    "name",
    "date",
    "type",
    "status",
    "value",
    "description",
    "created_at",
    "updated_at",
    "label",
    "title",
  ]);
  return generic.has(name);
}

function typesCompatible(a: string, b: string): boolean {
  const na = normalizeType(a);
  const nb = normalizeType(b);
  return na === nb;
}

function normalizeType(t: string): string {
  const lower = t.toLowerCase();
  if (
    lower.includes("int") ||
    lower.includes("numeric") ||
    lower.includes("real") ||
    lower.includes("float") ||
    lower.includes("double") ||
    lower.includes("decimal") ||
    lower.includes("number")
  ) {
    return "numeric";
  }
  if (lower.includes("date") || lower.includes("time")) {
    return "datetime";
  }
  return "text";
}
