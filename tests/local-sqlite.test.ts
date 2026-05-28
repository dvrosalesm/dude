import os from "node:os";
import path from "node:path";

describe("local-sqlite db path resolution", () => {
  const originalDudeDbPath = process.env.DUDE_DB_PATH;

  afterEach(() => {
    if (originalDudeDbPath === undefined) delete process.env.DUDE_DB_PATH;
    else process.env.DUDE_DB_PATH = originalDudeDbPath;
    delete process.env.DB_LOCAL_PATH;
    jest.resetModules();
  });

  it("defaults to ~/.dude/dude-local.sqlite", async () => {
    delete process.env.DUDE_DB_PATH;
    delete process.env.DB_LOCAL_PATH;

    const { getLocalDbPath } = await import(
      "../apps/api/src/lib/local-sqlite.js"
    );

    expect(getLocalDbPath()).toBe(
      path.join(os.homedir(), ".dude", "dude-local.sqlite"),
    );
  });

  it("honors DUDE_DB_PATH test override", async () => {
    process.env.DUDE_DB_PATH = "/tmp/dude-test.sqlite";

    const { getLocalDbPath } = await import(
      "../apps/api/src/lib/local-sqlite.js"
    );

    expect(getLocalDbPath()).toBe("/tmp/dude-test.sqlite");
  });
});
