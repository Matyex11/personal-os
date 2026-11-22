import { z } from "zod";
import { isoDateSchema, uuidSchema } from "@/lib/validation/common";
import type { EligibleRecoveryTarget } from "@/modules/habits/recovery-targets";

/** Bounded page size for recovery-target selector (not history). */
export const RECOVERY_TARGETS_PAGE_SIZE = 50;

export const listRecoveryTargetsInputSchema = z.object({
  habitId: uuidSchema,
  cursor: z.string().trim().min(1).max(128).optional().nullable(),
});

export type ListRecoveryTargetsInput = z.infer<typeof listRecoveryTargetsInputSchema>;

export type RecoveryTargetsPage = {
  items: EligibleRecoveryTarget[];
  nextCursor: string | null;
  exhausted: boolean;
};

/**
 * Opaque cursor = last-seen primary `logged_on`.
 * Stable because `habit_logs_primary_unique (habit_id, logged_on)` applies to
 * non-recovery rows (missed/partial included) — no migration required.
 */
export function encodeRecoveryTargetCursor(loggedOn: string): string {
  isoDateSchema.parse(loggedOn);
  return Buffer.from(`v1:${loggedOn}`, "utf8").toString("base64url");
}

export function decodeRecoveryTargetCursor(cursor: string): string {
  let raw: string;
  try {
    raw = Buffer.from(cursor, "base64url").toString("utf8");
  } catch {
    throw new Error("invalid_cursor");
  }
  if (!raw.startsWith("v1:")) {
    throw new Error("invalid_cursor");
  }
  const loggedOn = raw.slice(3);
  isoDateSchema.parse(loggedOn);
  return loggedOn;
}

/** Drop ids that already have a recovery link. */
export function excludeAlreadyRecoveredTargets<T extends { id: string }>(
  candidates: readonly T[],
  recoveredOriginalIds: ReadonlySet<string>,
): T[] {
  if (recoveredOriginalIds.size === 0) return [...candidates];
  return candidates.filter((row) => !recoveredOriginalIds.has(row.id));
}

/**
 * Pure pager over a newest-first eligible list (already filtered + sorted).
 * Mirrors server: `logged_on < cursor`, limit pageSize, nextCursor from last item.
 */
export function pageEligibleRecoveryTargets(
  eligibleNewestFirst: readonly EligibleRecoveryTarget[],
  options: { cursor?: string | null; pageSize?: number } = {},
): RecoveryTargetsPage {
  const pageSize = options.pageSize ?? RECOVERY_TARGETS_PAGE_SIZE;
  let slice = [...eligibleNewestFirst];

  if (options.cursor) {
    const loggedOn = decodeRecoveryTargetCursor(options.cursor);
    slice = slice.filter((row) => row.logged_on < loggedOn);
  }

  const page = slice.slice(0, pageSize);
  const hasMore = slice.length > pageSize;
  const last = page[page.length - 1];
  return {
    items: page,
    nextCursor: hasMore && last ? encodeRecoveryTargetCursor(last.logged_on) : null,
    exhausted: !hasMore,
  };
}

/** Build PostgREST `in` list for `.not('id', 'in', …)` — empty means skip filter. */
export function formatPostgrestInList(ids: readonly string[]): string | null {
  if (ids.length === 0) return null;
  for (const id of ids) {
    uuidSchema.parse(id);
  }
  return `(${ids.join(",")})`;
}
