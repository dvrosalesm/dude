import { guardDataAnalystSql, workspaceTablePrefix } from "../packages/subagent-data-analyst/src/gateway/da-sql-guard.js";

describe("da-sql-guard", () => {
  const workspaceId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

  it("prefixes logical table names", () => {
    const prefix = workspaceTablePrefix(workspaceId);
    expect(prefix).toBe("da_a1b2c3d4e5f67890abcdef1234567890__");

    const rewritten = guardDataAnalystSql(
      "SELECT * FROM sales LIMIT 10",
      workspaceId,
    );
    expect(rewritten).toContain(`${prefix}sales`);
  });

  it("blocks application table access", () => {
    expect(() =>
      guardDataAnalystSql("SELECT * FROM workspaces", workspaceId),
    ).toThrow(/application table/i);
  });

  it("blocks attach database", () => {
    expect(() =>
      guardDataAnalystSql("ATTACH DATABASE 'x' AS y", workspaceId),
    ).toThrow(/not allowed/i);
  });
});
