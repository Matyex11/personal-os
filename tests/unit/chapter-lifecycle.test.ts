import { describe, expect, it } from "vitest";
import {
  canActivateChapter,
  canCloseChapter,
  canMakeChapterCurrent,
  classifyMakeCurrentResult,
  shouldRestorePreviousCurrent,
  type ChapterLifecycleView,
} from "@/modules/chapters/lifecycle";

const planned: ChapterLifecycleView = {
  id: "11111111-1111-4111-8111-111111111111",
  status: "planned",
  started_on: "2026-01-01",
  ended_on: null,
  is_current: false,
};

const active: ChapterLifecycleView = {
  ...planned,
  id: "22222222-2222-4222-8222-222222222222",
  status: "active",
};

const current: ChapterLifecycleView = {
  ...active,
  id: "33333333-3333-4333-8333-333333333333",
  is_current: true,
};

const closed: ChapterLifecycleView = {
  ...planned,
  id: "44444444-4444-4444-8444-444444444444",
  status: "closed",
  ended_on: "2026-06-01",
  is_current: false,
};

describe("canActivateChapter", () => {
  it("allows planned → active", () => {
    expect(canActivateChapter(planned)).toEqual({ ok: true });
  });

  it("rejects closed reactivation", () => {
    const result = canActivateChapter(closed);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/reactivated/i);
  });

  it("rejects already-active", () => {
    expect(canActivateChapter(active).ok).toBe(false);
  });

  it("rejects missing chapter", () => {
    expect(canActivateChapter(null).ok).toBe(false);
  });
});

describe("canMakeChapterCurrent", () => {
  it("allows active non-current", () => {
    expect(canMakeChapterCurrent(active)).toEqual({ ok: true });
  });

  it("treats already-current as safe no-op", () => {
    expect(canMakeChapterCurrent(current)).toEqual({ ok: true });
  });

  it("rejects planned", () => {
    const result = canMakeChapterCurrent(planned);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/planned/i);
  });

  it("rejects closed", () => {
    expect(canMakeChapterCurrent(closed).ok).toBe(false);
  });
});

describe("canCloseChapter", () => {
  it("allows active with valid end ≥ start", () => {
    expect(canCloseChapter(active, "2026-02-01")).toEqual({ ok: true });
    expect(canCloseChapter(active, "2026-01-01")).toEqual({ ok: true });
  });

  it("rejects planned and closed", () => {
    expect(canCloseChapter(planned, "2026-02-01").ok).toBe(false);
    expect(canCloseChapter(closed, "2026-07-01").ok).toBe(false);
  });

  it("rejects invalid calendar dates and end before start", () => {
    expect(canCloseChapter(active, "2026-02-30").ok).toBe(false);
    expect(canCloseChapter(active, "2025-12-31").ok).toBe(false);
  });
});

describe("shouldRestorePreviousCurrent", () => {
  const previous = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const target = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const other = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

  it("restores only when previous exists and nobody is current", () => {
    expect(
      shouldRestorePreviousCurrent({
        previousCurrentId: previous,
        currentAfterFailureId: null,
        targetChapterId: target,
      }),
    ).toBe(true);
  });

  it("does not restore when a concurrent chapter is already current", () => {
    expect(
      shouldRestorePreviousCurrent({
        previousCurrentId: previous,
        currentAfterFailureId: other,
        targetChapterId: target,
      }),
    ).toBe(false);
  });

  it("does not restore when the target became current", () => {
    expect(
      shouldRestorePreviousCurrent({
        previousCurrentId: previous,
        currentAfterFailureId: target,
        targetChapterId: target,
      }),
    ).toBe(false);
  });

  it("does not restore when there was no previous current", () => {
    expect(
      shouldRestorePreviousCurrent({
        previousCurrentId: null,
        currentAfterFailureId: null,
        targetChapterId: target,
      }),
    ).toBe(false);
  });
});

describe("classifyMakeCurrentResult", () => {
  it("reports success only when the updated row is the target and current", () => {
    expect(
      classifyMakeCurrentResult({
        targetChapterId: active.id,
        updatedRow: { ...active, is_current: true },
        currentAfterAttemptId: active.id,
        uniqueViolation: false,
      }),
    ).toEqual({ kind: "success", chapterId: active.id });
  });

  it("does not report success on unique violation when another chapter is current", () => {
    const result = classifyMakeCurrentResult({
      targetChapterId: active.id,
      updatedRow: null,
      currentAfterAttemptId: current.id,
      uniqueViolation: true,
    });
    expect(result.kind).toBe("conflict");
  });

  it("treats target already current after race as already_current", () => {
    expect(
      classifyMakeCurrentResult({
        targetChapterId: active.id,
        updatedRow: null,
        currentAfterAttemptId: active.id,
        uniqueViolation: true,
      }),
    ).toEqual({ kind: "already_current", chapterId: active.id });
  });
});
