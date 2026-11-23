import { beforeEach, describe, expect, it, vi } from "vitest";

const requireUser = vi.fn();
const createClient = vi.fn();

vi.mock("@/lib/auth/require-user", () => ({
  requireUser: () => requireUser(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => createClient(),
}));

import { makeChapterCurrent } from "@/modules/chapters/service";

const userId = "11111111-1111-4111-8111-111111111111";
const targetId = "22222222-2222-4222-8222-222222222222";
const previousId = "33333333-3333-4333-8333-333333333333";

type Chapter = {
  id: string;
  user_id: string;
  title: string;
  summary: string | null;
  status: "planned" | "active" | "closed";
  started_on: string;
  ended_on: string | null;
  is_current: boolean;
};

function baseActive(overrides: Partial<Chapter> = {}): Chapter {
  return {
    id: targetId,
    user_id: userId,
    title: "Target",
    summary: null,
    status: "active",
    started_on: "2026-01-01",
    ended_on: null,
    is_current: false,
    ...overrides,
  };
}

type Script = {
  loadTarget: Chapter | null;
  previousCurrentId: string | null;
  setError: { code: string } | null;
  setData: Chapter | null;
  currentAfterSetId: string | null;
  restoreCalls: Array<{ id: string }>;
};

function mockClient(script: Script) {
  let selectCall = 0;
  return {
    from(table: string) {
      if (table !== "chapters") throw new Error(`unexpected table ${table}`);
      return {
        select(columns: string) {
          selectCall += 1;
          const call = selectCall;
          const chain: Record<string, unknown> = {};
          const self = () => chain;
          chain.eq = self;
          chain.maybeSingle = async () => {
            if (call === 1 || columns === "*") {
              // First select("*") load target — but subsequent select("*") may reload
            }
            // Heuristic by call order used in makeChapterCurrent:
            // 1) loadOwnedChapter select *
            // 2) previous current select id
            // 3) current after set select id
            // optional 4) reload
            if (call === 1) {
              return { data: script.loadTarget, error: null };
            }
            if (call === 2) {
              return {
                data: script.previousCurrentId
                  ? { id: script.previousCurrentId }
                  : null,
                error: null,
              };
            }
            // after set / verify
            return {
              data: script.currentAfterSetId
                ? { id: script.currentAfterSetId }
                : null,
              error: null,
            };
          };
          chain.single = chain.maybeSingle;
          return chain;
        },
        update(payload: { is_current: boolean; status?: string }) {
          const filters: Record<string, string | boolean> = {};
          const api: Record<string, unknown> = {};
          api.eq = (col: string, value: string | boolean) => {
            filters[col] = value;
            return api;
          };
          api.select = () => api;
          api.maybeSingle = async () => {
            if (payload.is_current === true && filters.id === targetId) {
              return { data: script.setData, error: script.setError };
            }
            return { data: null, error: null };
          };
          // unset previous / restore
          api.then = (
            onfulfilled?: (value: unknown) => unknown,
            onrejected?: (reason: unknown) => unknown,
          ) => {
            if (
              payload.is_current === true &&
              filters.id === script.previousCurrentId
            ) {
              script.restoreCalls.push({ id: String(filters.id) });
            }
            return Promise.resolve({ data: null, error: null }).then(
              onfulfilled,
              onrejected,
            );
          };
          return api;
        },
      };
    },
  };
}

describe("makeChapterCurrent service", () => {
  beforeEach(() => {
    requireUser.mockReset();
    createClient.mockReset();
    requireUser.mockResolvedValue({ id: userId, email: "a@example.com" });
  });

  it("returns not found for a non-owned chapter", async () => {
    const script: Script = {
      loadTarget: null,
      previousCurrentId: null,
      setError: null,
      setData: null,
      currentAfterSetId: null,
      restoreCalls: [],
    };
    createClient.mockResolvedValue(mockClient(script));
    const result = await makeChapterCurrent({ chapterId: targetId });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/not found/i);
  });

  it("no-ops when already current", async () => {
    const row = baseActive({ is_current: true });
    const script: Script = {
      loadTarget: row,
      previousCurrentId: targetId,
      setError: null,
      setData: null,
      currentAfterSetId: targetId,
      restoreCalls: [],
    };
    createClient.mockResolvedValue(mockClient(script));
    const result = await makeChapterCurrent({ chapterId: targetId });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.is_current).toBe(true);
  });

  it("returns conflict on 23505 without false success when another chapter is current", async () => {
    const script: Script = {
      loadTarget: baseActive(),
      previousCurrentId: previousId,
      setError: { code: "23505" },
      setData: null,
      currentAfterSetId: previousId,
      restoreCalls: [],
    };
    createClient.mockResolvedValue(mockClient(script));
    const result = await makeChapterCurrent({ chapterId: targetId });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toMatch(/already current|could not make/i);
    }
    // Must not restore over concurrent success
    expect(script.restoreCalls).toHaveLength(0);
  });

  it("does not restore previous when concurrent current exists after failure", async () => {
    const otherId = "55555555-5555-4555-8555-555555555555";
    const script: Script = {
      loadTarget: baseActive(),
      previousCurrentId: previousId,
      setError: { code: "23505" },
      setData: null,
      currentAfterSetId: otherId,
      restoreCalls: [],
    };
    createClient.mockResolvedValue(mockClient(script));
    const result = await makeChapterCurrent({ chapterId: targetId });
    expect(result.ok).toBe(false);
    expect(script.restoreCalls).toHaveLength(0);
  });
});
