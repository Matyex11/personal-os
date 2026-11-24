import { beforeEach, describe, expect, it, vi } from "vitest";

const requireUser = vi.fn();
const createClient = vi.fn();

vi.mock("@/lib/auth/require-user", () => ({
  requireUser: () => requireUser(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => createClient(),
}));

vi.mock("@/modules/habits/service", () => ({
  getProfileTimeZone: vi.fn(async () => "Europe/Bucharest"),
}));

vi.mock("@/lib/dates/calendar", async () => {
  const actual = await vi.importActual<typeof import("@/lib/dates/calendar")>(
    "@/lib/dates/calendar",
  );
  return {
    ...actual,
    todayInTimeZone: () => "2026-11-24",
  };
});

import {
  completeReview,
  getOrCreateWeeklyReview,
  reopenReview,
  updateDraftReview,
} from "@/modules/reviews/service";

const userId = "11111111-1111-4111-8111-111111111111";
const reviewId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function reviewRow(overrides: Record<string, unknown> = {}) {
  return {
    id: reviewId,
    user_id: userId,
    chapter_id: null,
    period_kind: "weekly",
    period_start: "2026-11-23",
    period_end: "2026-11-29",
    status: "draft",
    answers: {},
    narrative: null,
    completed_at: null,
    created_at: "2026-11-24T10:00:00.000Z",
    updated_at: "2026-11-24T10:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  requireUser.mockReset();
  createClient.mockReset();
  requireUser.mockResolvedValue({ id: userId });
});

describe("getOrCreateWeeklyReview", () => {
  it("returns existing week row without inserting", async () => {
    const existing = reviewRow();
    createClient.mockResolvedValue({
      from() {
        return {
          select() {
            const api: Record<string, unknown> = {};
            api.eq = () => api;
            api.maybeSingle = async () => ({ data: existing, error: null });
            return api;
          },
        };
      },
    });

    const result = await getOrCreateWeeklyReview({});
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.created).toBe(false);
      expect(result.data.periodStart).toBe("2026-11-23");
      expect(result.data.review.id).toBe(reviewId);
    }
  });

  it("on insert 23505 reselects the winner once (clear conflict path)", async () => {
    let selectCalls = 0;
    createClient.mockResolvedValue({
      from() {
        return {
          select() {
            const api: Record<string, unknown> = {};
            api.eq = () => api;
            api.maybeSingle = async () => {
              selectCalls += 1;
              if (selectCalls === 1) return { data: null, error: null };
              return { data: reviewRow(), error: null };
            };
            return api;
          },
          insert() {
            const api: Record<string, unknown> = {};
            api.select = () => api;
            api.single = async () => ({
              data: null,
              error: { code: "23505", message: "duplicate key" },
            });
            return api;
          },
        };
      },
    });

    const result = await getOrCreateWeeklyReview({});
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.created).toBe(false);
      expect(result.data.review.id).toBe(reviewId);
    }
    expect(selectCalls).toBe(2);
  });
});

describe("updateDraftReview", () => {
  it("rejects updates when status is completed", async () => {
    createClient.mockResolvedValue({
      from() {
        return {
          select() {
            const api: Record<string, unknown> = {};
            api.eq = () => api;
            api.maybeSingle = async () => ({
              data: reviewRow({ status: "completed", completed_at: "2026-11-24T12:00:00.000Z" }),
              error: null,
            });
            return api;
          },
        };
      },
    });

    const result = await updateDraftReview({
      id: reviewId,
      answers: { wentWell: "nope" },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/read-only/i);
  });
});

describe("completeReview and reopenReview", () => {
  it("completes a draft and sets completed_at", async () => {
    createClient.mockResolvedValue({
      from() {
        return {
          select() {
            const api: Record<string, unknown> = {};
            api.eq = () => api;
            api.maybeSingle = async () => ({ data: reviewRow(), error: null });
            return api;
          },
          update(payload: Record<string, unknown>) {
            expect(payload.status).toBe("completed");
            expect(payload.completed_at).toBeTruthy();
            const filters: Record<string, string> = {};
            const api: Record<string, unknown> = {};
            api.eq = (col: string, value: string) => {
              filters[col] = value;
              return api;
            };
            api.select = () => api;
            api.maybeSingle = async () => {
              expect(filters).toMatchObject({
                id: reviewId,
                user_id: userId,
                status: "draft",
              });
              return {
                data: reviewRow({
                  status: "completed",
                  completed_at: payload.completed_at,
                }),
                error: null,
              };
            };
            return api;
          },
        };
      },
    });

    const result = await completeReview({ id: reviewId });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.status).toBe("completed");
      expect(result.data.completedAt).toBeTruthy();
    }
  });

  it("reopens a completed review to draft with null completed_at", async () => {
    createClient.mockResolvedValue({
      from() {
        return {
          select() {
            const api: Record<string, unknown> = {};
            api.eq = () => api;
            api.maybeSingle = async () => ({
              data: reviewRow({
                status: "completed",
                completed_at: "2026-11-24T12:00:00.000Z",
              }),
              error: null,
            });
            return api;
          },
          update(payload: Record<string, unknown>) {
            expect(payload.status).toBe("draft");
            expect(payload.completed_at).toBeNull();
            const api: Record<string, unknown> = {};
            api.eq = () => api;
            api.select = () => api;
            api.maybeSingle = async () => ({
              data: reviewRow({ status: "draft", completed_at: null }),
              error: null,
            });
            return api;
          },
        };
      },
    });

    const result = await reopenReview({ id: reviewId });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.status).toBe("draft");
      expect(result.data.completedAt).toBeNull();
    }
  });
});
