import fs from "node:fs";
import path from "node:path";

describe("legacy src/ retirement", () => {
  it("does not keep a root src/ directory", () => {
    expect(fs.existsSync(path.join(__dirname, "../src"))).toBe(false);
  });

  it("does not keep Next.js client shims", () => {
    const clientSrc = path.join(__dirname, "../apps/client/src");
    expect(fs.existsSync(path.join(clientSrc, "next-link-shim.tsx"))).toBe(false);
    expect(fs.existsSync(path.join(clientSrc, "next-image-shim.tsx"))).toBe(false);
    expect(fs.existsSync(path.join(clientSrc, "next-dynamic-shim.tsx"))).toBe(false);
    expect(fs.existsSync(path.join(clientSrc, "next-navigation-shim.ts"))).toBe(false);
  });

  it("keeps global styles under apps/client", () => {
    expect(
      fs.existsSync(path.join(__dirname, "../apps/client/src/styles/globals.css")),
    ).toBe(true);
  });

  it("keeps agent blob under @dude/ui", () => {
    expect(
      fs.existsSync(path.join(__dirname, "../packages/ui/src/components/agent-blob.tsx")),
    ).toBe(true);
  });
});
