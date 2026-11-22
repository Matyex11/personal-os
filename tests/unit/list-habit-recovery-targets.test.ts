import { beforeEach, describe, expect, it, vi } from "vitest";

const requireUser = vi.fn();
const createClient = vi.fn();

vi.mock("@/lib/auth/require-user", () => ({
  requireUser: () => requireUser(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => createClient(),
}));

import { listHabitRecoveryTargets } from "@/modules/habits/service";

type Candidate = { id: string; logged_on: string; status: "missed" | "partial" };

function createThenableQuery(result: { data: unknown; error: null }) {
  const state = {
    ltValue: null as string | null,
    notIn: null as string | null,
    limit: 51,
  };

  const api: {
    eq: () => typeof api;
    in: () => typeof api;
    order: () => typeof api;
    limit: (n: number) => typeof api;
    lt: (col: string, value: string) => typeof api;
    not: (col: string, op: string, value: string) => typeof api;
    then: Promise<{ data: unknown; error: null }>["then"];
  } = {
    eq: () => api,
    in: () => api,
    order: () => api,
    limit: (n: number) => {
      state.limit = n;
      return api;
    },
    lt: (_col: string, value: string) => {
      state.ltValue = value;
      return api;
    },
    not: (_col: string, _op: string, value: string) => {
      state.notIn = value;
      return api;
    },
    then: (onfulfilled, onrejected) => {
      let rows = (result.data as Candidate[]) ?? [];
      if (state.ltValue) {
        rows = rows.filter((row) => row.logged_on < state.ltValue!);
      }
      if (state.notIn) {
        const ids = state.notIn.slice(1, -1).split(",").filter(Boolean);
        const blocked = new Set(ids);
        rows = rows.filter((row) => !blocked.has(row.id));
      }
      rows = rows.slice(0, state.limit);
      return Promise.resolve({ data: rows, error: null }).then(onfulfilled, onrejected);
    },
  };

  return api;
}

function mockClient(options: {
  habit: { id: string } | null;
  recoveries: Array<{ recovers_log_id: string | null }>;
  candidates: Candidate[];
}) {
  return {
    from(table: string) {
      if (table === "habits") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: options.habit, error: null }),
              }),
            }),
          }),
        };
      }

      return {
        select(columns: string) {
          if (columns === "recovers_log_id") {
            return {
              eq: () => ({
                eq: () => ({
                  eq: () => ({
                    not: async () => ({ data: options.recoveries, error: null }),
                  }),
                }),
              }),
            };
          }
          return createThenableQuery({ data: options.candidates, error: null });
        },
      };
    },
  };
}

describe("listHabitRecoveryTargets ownership", () => {
  const habitId = "33333333-3333-4333-8333-333333333333";
  const otherHabitCandidates: Candidate[] = [
    {
      id: "22222222-2222-4222-8222-222222222299",
      logged_on: "2026-01-01",
      status: "missed",
    },
  ];

  beforeEach(() => {
    requireUser.mockReset();
    createClient.mockReset();
    requireUser.mockResolvedValue({ id: "user-a", email: "a@example.com" });
  });

  it("denies access when habit is not owned by the session user", async () => {
    createClient.mockResolvedValue(
      mockClient({
        habit: null,
        recoveries: [],
        candidates: otherHabitCandidates,
      }),
    );

    const result = await listHabitRecoveryTargets({ habitId });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toMatch(/not found/i);
    }
  });

  it("excludes already-recovered and returns selector fields only", async () => {
    const kept: Candidate = {
      id: "22222222-2222-4222-8222-222222222201",
      logged_on: "2026-01-10",
      status: "missed",
    };
    const recovered: Candidate = {
      id: "22222222-2222-4222-8222-222222222202",
      logged_on: "2026-01-09",
      status: "partial",
    };

    createClient.mockResolvedValue(
      mockClient({
        habit: { id: habitId },
        recoveries: [{ recovers_log_id: recovered.id }],
        candidates: [kept, recovered],
      }),
    );

    const result = await listHabitRecoveryTargets({ habitId });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.items).toEqual([kept]);
      expect(result.data.exhausted).toBe(true);
      expect(Object.keys(result.data.items[0]!).sort()).toEqual([
        "id",
        "logged_on",
        "status",
      ]);
    }
  });
});
