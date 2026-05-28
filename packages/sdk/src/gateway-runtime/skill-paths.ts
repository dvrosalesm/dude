import path from "node:path";

/** Resolve absolute paths to vendored skill packs under a gateway directory. */
export function resolveGatewaySkillPaths(
  gatewayDir: string,
  names: string[],
): string[] {
  return names.map((name) => path.join(gatewayDir, "skills", name));
}
