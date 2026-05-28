import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

loadDotenv({ path: path.join(repoRoot, ".env.local") });
loadDotenv({ path: path.join(repoRoot, ".env") });
