export const MAX_MARKETING_IDENTIFIER_LENGTH = 64;

export function normalizeMarketingIdentifier(
  value: unknown,
  options: { maxLength?: number } = {},
): string {
  const maxLength = options.maxLength ?? MAX_MARKETING_IDENTIFIER_LENGTH;
  if (typeof value !== "string") return "";
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength);
}
