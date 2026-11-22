export type AppErrorCode =
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "validation"
  | "conflict"
  | "unavailable"
  | "unknown";

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly details?: unknown;

  constructor(code: AppErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.details = details;
  }
}

const SAFE_FALLBACK = "Something went wrong.";

/**
 * Maps errors to user-visible copy.
 * Only `AppError` messages are considered intentional UX text.
 * Unexpected `Error` / unknown values must not leak internal exception details.
 */
export function toUserMessage(error: unknown): string {
  if (error instanceof AppError) {
    return error.message;
  }
  return SAFE_FALLBACK;
}
