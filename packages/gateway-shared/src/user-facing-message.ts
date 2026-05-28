export const USER_MESSAGE_MARKER = "\n\n--- USER MESSAGE ---\n";

/** Strip specialist workspace context wrappers and return the user's typed text. */
export function extractUserFacingMessage(content: string): string {
  const markerIndex = content.lastIndexOf(USER_MESSAGE_MARKER);
  if (markerIndex >= 0) {
    return content.slice(markerIndex + USER_MESSAGE_MARKER.length).trim();
  }
  return content.trim();
}
