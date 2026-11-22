import { describe, expect, it } from "vitest";
import {
  decodeRecoveryTargetCursor,
  encodeRecoveryTargetCursor,
  excludeAlreadyRecoveredTargets,
  formatPostgrestInList,
  pageEligibleRecoveryTargets,
  RECOVERY_TARGETS_PAGE_SIZE,
} from "@/modules/habits/recovery-eligibility";
import type { EligibleRecoveryTarget } from "@/modules/habits/recovery-targets";

function day(offset: number): string {
  const base = Date.UTC(2026, 0, 1 + offset);
  return new Date(base).toISOString().slice(0, 10);
}

/** 80 missed targets, newest first — beyond a 60-row history window. */
function buildEightyMissed(): EligibleRecoveryTarget[] {
  return Array.from({ length: 80 }, (_, index) => {
    const newestOffset = 79 - index;
    return {
      id: `00000000-0000-4000-8000-${String(newestOffset).padStart(12, "0")}`,
      logged_on: day(newestOffset),
      status: "missed" as const,
    };
  });
}

describe("recovery target cursor", () => {
  it("round-trips logged_on", () => {
    const cursor = encodeRecoveryTargetCursor("2026-03-15");
    expect(decodeRecoveryTargetCursor(cursor)).toBe("2026-03-15");
  });

  it("rejects malformed cursors", () => {
    expect(() => decodeRecoveryTargetCursor("not-valid")).toThrow();
  });
});

describe("excludeAlreadyRecoveredTargets", () => {
  it("removes originals that already have a recovery", () => {
    const rows = [
      { id: "a", logged_on: "2026-01-02", status: "missed" as const },
      { id: "b", logged_on: "2026-01-01", status: "partial" as const },
    ];
    expect(excludeAlreadyRecoveredTargets(rows, new Set(["a"]))).toEqual([
      { id: "b", logged_on: "2026-01-01", status: "partial" },
    ]);
  });
});

describe("pageEligibleRecoveryTargets", () => {
  it("reaches eligible rows older than a 60-row history window", () => {
    const eligible = buildEightyMissed();
    // History panel would only see the newest 60 primary logs; page 2 of
    // recovery targets still includes older missed days.
    const page1 = pageEligibleRecoveryTargets(eligible, { pageSize: 50 });
    expect(page1.items).toHaveLength(50);
    expect(page1.exhausted).toBe(false);
    expect(page1.nextCursor).toBeTruthy();

    const page2 = pageEligibleRecoveryTargets(eligible, {
      cursor: page1.nextCursor,
      pageSize: 50,
    });
    expect(page2.items.length).toBeGreaterThan(0);
    expect(page2.items.every((row) => row.logged_on < page1.items.at(-1)!.logged_on)).toBe(
      true,
    );
    const oldestOnPage2 = page2.items[page2.items.length - 1]!;
    expect(oldestOnPage2.logged_on).toBe(day(0));
    expect(page1.items.some((row) => row.logged_on === day(0))).toBe(false);
  });

  it("paginates without skip or duplicate across pages", () => {
    const eligible = buildEightyMissed();
    const pageSize = RECOVERY_TARGETS_PAGE_SIZE;
    const seen = new Set<string>();
    let cursor: string | null = null;
    let pages = 0;
    let exhausted = false;

    while (!exhausted) {
      const page = pageEligibleRecoveryTargets(eligible, { cursor, pageSize });
      for (const row of page.items) {
        expect(seen.has(row.id)).toBe(false);
        seen.add(row.id);
      }
      cursor = page.nextCursor;
      exhausted = page.exhausted;
      pages += 1;
      expect(pages).toBeLessThan(10);
    }

    expect(seen.size).toBe(80);
    expect(cursor).toBeNull();
  });

  it("returns empty exhausted page when nothing eligible", () => {
    const page = pageEligibleRecoveryTargets([]);
    expect(page).toEqual({ items: [], nextCursor: null, exhausted: true });
  });

  it("excludes already-recovered before paging so pages stay dense", () => {
    const raw = buildEightyMissed();
    const recovered = new Set(raw.slice(0, 10).map((row) => row.id));
    const eligible = excludeAlreadyRecoveredTargets(raw, recovered);
    expect(eligible).toHaveLength(70);

    const page1 = pageEligibleRecoveryTargets(eligible, { pageSize: 50 });
    expect(page1.items).toHaveLength(50);
    expect(page1.items.every((row) => !recovered.has(row.id))).toBe(true);

    const page2 = pageEligibleRecoveryTargets(eligible, {
      cursor: page1.nextCursor,
      pageSize: 50,
    });
    expect(page2.items).toHaveLength(20);
    expect(page2.exhausted).toBe(true);
    const all = [...page1.items, ...page2.items];
    expect(new Set(all.map((r) => r.id)).size).toBe(70);
  });
});

describe("formatPostgrestInList", () => {
  it("returns null for empty sets and formats uuids otherwise", () => {
    expect(formatPostgrestInList([])).toBeNull();
    const id = "11111111-1111-4111-8111-111111111111";
    expect(formatPostgrestInList([id])).toBe(`(${id})`);
  });
});
