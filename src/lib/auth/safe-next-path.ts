/**
 * Validate post-auth `next` destinations.
 * Only same-origin relative paths are allowed; absolute, protocol-relative,
 * and other open-redirect shapes fall back to `/`.
 */
export function safeNextPath(raw: string | null | undefined): string {
  if (raw == null || raw === "") {
    return "/";
  }

  // Reject absolute URLs and anything that is not a path.
  if (!raw.startsWith("/")) {
    return "/";
  }

  // Protocol-relative: //evil.example
  if (raw.startsWith("//")) {
    return "/";
  }

  // Backslash tricks / mixed schemes
  if (raw.includes("\\") || raw.includes("://")) {
    return "/";
  }

  // Control characters
  if (/[\u0000-\u001f\u007f]/.test(raw)) {
    return "/";
  }

  return raw;
}
