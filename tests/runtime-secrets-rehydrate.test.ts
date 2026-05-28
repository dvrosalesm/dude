import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("runtime secrets rehydrate", () => {
  const workspaceId = "ws-rehydrate-test";
  let workDir = "";

  beforeEach(() => {
    workDir = join(tmpdir(), "pimono", workspaceId);
    mkdirSync(workDir, { recursive: true });
    writeFileSync(
      join(workDir, ".dude-agent-spawn.json"),
      JSON.stringify({
        command: "npx",
        args: ["tsx", "server.ts"],
        cwd: workDir,
        env: {
          API_KEY: "sk-test-rehydrate",
          MODEL_PROVIDER: "openrouter",
          MODEL_ID: "test/model",
        },
      }),
      "utf8",
    );
  });

  afterEach(() => {
    rmSync(workDir, { recursive: true, force: true });
  });

  it("rehydrates API_KEY from .dude-agent-spawn.json after store was cleared", async () => {
    const { clearWorkspaceRuntimeSecrets, getWorkspaceRuntimeSecrets } =
      await import("../apps/api/src/lib/runtime-secrets-store.js");
    const { rehydrateRuntimeSecretsFromSpawnFile } = await import(
      "../apps/api/src/lib/runtime-secrets-rehydrate.js"
    );

    clearWorkspaceRuntimeSecrets(workspaceId);
    expect(getWorkspaceRuntimeSecrets(workspaceId)).toBeUndefined();

    const secrets = rehydrateRuntimeSecretsFromSpawnFile(workspaceId, "local");
    expect(secrets?.apiKey).toBe("sk-test-rehydrate");
    expect(getWorkspaceRuntimeSecrets(workspaceId)?.apiKey).toBe(
      "sk-test-rehydrate",
    );
  });
});
