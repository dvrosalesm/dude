import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

describe("load-env", () => {
  it("resolves the monorepo root (not apps/api)", () => {
    const repoRoot = resolve(__dirname, "..");
    const pkgPath = join(repoRoot, "package.json");
    expect(existsSync(pkgPath)).toBe(true);
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { name?: string };
    expect(pkg.name).toBe("dude");

    const apiOnlyRoot = resolve(repoRoot, "apps/api");
    expect(existsSync(join(apiOnlyRoot, "package.json"))).toBe(true);
    expect(existsSync(join(apiOnlyRoot, ".env.local"))).toBe(false);
  });
});
