import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";

/** Monorepo root (`dude/`), not `apps/api/`. */
export const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

loadDotenv({ path: path.join(REPO_ROOT, ".env.local") });
loadDotenv({ path: path.join(REPO_ROOT, ".env") });
