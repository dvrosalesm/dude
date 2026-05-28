import fs from "node:fs";
import path from "node:path";

const root = path.join(__dirname, "..");

function readConfig(name: string) {
  return fs.readFileSync(path.join(root, name), "utf8");
}

describe("subagent host config", () => {
  it("server config registers all five subagents", () => {
    const src = readConfig("subagents.config.ts");
    expect(src).not.toContain("@dude/subagent-hr-specialist/server");
    expect((src.match(/@dude\/subagent-/g) ?? []).length).toBe(5);
  });

  it("client config matches server subagent count", () => {
    const server = readConfig("subagents.config.ts");
    const client = readConfig("subagents.config.client.ts");
    const serverCount = (server.match(/@dude\/subagent-/g) ?? []).length;
    const clientCount = (client.match(/@dude\/subagent-/g) ?? []).length;
    expect(serverCount).toBe(clientCount);
  });

  it("does not keep duplicate host configs or legacy pi-gateway folder", () => {
    expect(fs.existsSync(path.join(root, "apps/api/src/subagents.ts"))).toBe(
      false,
    );
    expect(
      fs.existsSync(path.join(root, "apps/api/src/pi-gateway")),
    ).toBe(false);
  });

  it("api loads root subagents.config.ts via lazy host-config helper", () => {
    const appSrc = fs.readFileSync(
      path.join(root, "apps/api/src/app.ts"),
      "utf8",
    );
    const loaderSrc = fs.readFileSync(
      path.join(root, "apps/api/src/lib/subagent-host-config.ts"),
      "utf8",
    );
    expect(appSrc).toContain("getSubagentHostConfig");
    expect(loaderSrc).toContain("subagents.config.ts");
    expect(appSrc).not.toContain("./subagents.js");
  });
});
