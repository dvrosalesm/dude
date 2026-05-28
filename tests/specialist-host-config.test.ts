import fs from "node:fs";
import path from "node:path";

const root = path.join(__dirname, "..");

function readConfig(name: string) {
  return fs.readFileSync(path.join(root, name), "utf8");
}

describe("specialist host config", () => {
  it("server config registers all five specialists", () => {
    const src = readConfig("specialists.config.ts");
    expect(src).not.toContain("@dude/specialist-hr-specialist/server");
    expect((src.match(/@dude\/specialist-/g) ?? []).length).toBe(5);
  });

  it("client config matches server specialist count", () => {
    const server = readConfig("specialists.config.ts");
    const client = readConfig("specialists.config.client.ts");
    const serverCount = (server.match(/@dude\/specialist-/g) ?? []).length;
    const clientCount = (client.match(/@dude\/specialist-/g) ?? []).length;
    expect(serverCount).toBe(clientCount);
  });

  it("does not keep duplicate host configs or legacy pi-gateway folder", () => {
    expect(fs.existsSync(path.join(root, "apps/api/src/specialists.ts"))).toBe(
      false,
    );
    expect(
      fs.existsSync(path.join(root, "apps/api/src/pi-gateway")),
    ).toBe(false);
  });

  it("api loads root specialists.config.ts via lazy host-config helper", () => {
    const appSrc = fs.readFileSync(
      path.join(root, "apps/api/src/app.ts"),
      "utf8",
    );
    const loaderSrc = fs.readFileSync(
      path.join(root, "apps/api/src/lib/specialist-host-config.ts"),
      "utf8",
    );
    expect(appSrc).toContain("getSpecialistHostConfig");
    expect(loaderSrc).toContain("specialists.config.ts");
    expect(appSrc).not.toContain("./specialists.js");
  });
});
