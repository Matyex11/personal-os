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

import { updateCheckIn, upsertCheckIn } from "@/modules/checkins/service";

const userId = "11111111-1111-4111-8111-111111111111";
const checkInId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const checkedOn = "2026-11-24";

type UpsertScript = {
  /** First select (before insert/update). */
  existingId: string | null;
  /** After 23505: row discovered for recovery. */
  recoveryId: string | null;
  selectCalls: number;
  updatePayloads: unknown[];
  updateFilters: Array<Record<string, string>>;
  insertPayloads: unknown[];
  insertError: { code?: string; message?: string } | null;
  updateResult: { data: Record<string, unknown> | null; error: { message?: string } | null };
  insertResultData: Record<string, unknown> | null;
  recoverySelectError: { message?: string } | null;
  recoveryUpdateError: { message?: string } | null;
};

type UpdateScript = {
  updatePayloads: unknown[];
  filters: Array<Record<string, string>>;
  result: { data: Record<string, unknown> | null; error: { message?: string } | null };
};

function row(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: checkInId,
    user_id: userId,
    chapter_id: null,
    checked_on: checkedOn,
    mood: 4,
    energy: 3,
    focus: 5,
    body: null,
    prompt_set_key: "v1_simple",
    created_at: "2026-11-24T10:00:00.000Z",
    updated_at: "2026-11-24T10:00:00.000Z",
    ...overrides,
  };
}

function mockUpsertClient(script: UpsertScript) {
  return {
    from(table: string) {
      expect(table).toBe("check_ins");
      return {
        select() {
          const api: Record<string, unknown> = {};
          api.eq = () => api;
          api.maybeSingle = async () => {
            script.selectCalls += 1;
            if (script.selectCalls === 1) {
              return {
                data: script.existingId ? { id: script.existingId } : null,
                error: null,
              };
            }
            // Recovery / second select
            if (script.recoverySelectError) {
              return { data: null, error: script.recoverySelectError };
            }
            return {
              data: script.recoveryId ? { id: script.recoveryId } : null,
              error: null,
            };
          };
          return api;
        },
        update(payload: unknown) {
          script.updatePayloads.push(payload);
          const filters: Record<string, string> = {};
          const api: Record<string, unknown> = {};
          api.eq = (col: string, value: string) => {
            filters[col] = value;
            return api;
          };
          api.select = () => api;
          api.single = async () => {
            script.updateFilters.push({ ...filters });
            if (script.recoveryUpdateError && script.selectCalls > 1) {
              return { data: null, error: script.recoveryUpdateError };
            }
            return script.updateResult;
          };
          return api;
        },
        insert(payload: unknown) {
          script.insertPayloads.push(payload);
          const api: Record<string, unknown> = {};
          api.select = () => api;
          api.single = async () => {
            if (script.insertError) {
              return { data: null, error: script.insertError };
            }
            return { data: script.insertResultData, error: null };
          };
          return api;
        },
      };
    },
  };
}

function mockUpdateClient(script: UpdateScript) {
  return {
    from(table: string) {
      expect(table).toBe("check_ins");
      return {
        update(payload: unknown) {
          script.updatePayloads.push(payload);
          const filters: Record<string, string> = {};
          const api: Record<string, unknown> = {};
          api.eq = (col: string, value: string) => {
            filters[col] = value;
            return api;
          };
          api.select = () => api;
          api.maybeSingle = async () => {
            script.filters.push({ ...filters });
            return script.result;
          };
          return api;
        },
      };
    },
  };
}

beforeEach(() => {
  requireUser.mockReset();
  createClient.mockReset();
  requireUser.mockResolvedValue({ id: userId });
});

describe("upsertCheckIn", () => {
  it("inserts when no row exists for the civil day", async () => {
    const script: UpsertScript = {
      existingId: null,
      recoveryId: null,
      selectCalls: 0,
      updatePayloads: [],
      updateFilters: [],
      insertPayloads: [],
      insertError: null,
      updateResult: { data: null, error: null },
      insertResultData: row(),
      recoverySelectError: null,
      recoveryUpdateError: null,
    };
    createClient.mockResolvedValue(mockUpsertClient(script));

    const result = await upsertCheckIn({
      checkedOn,
      mood: 4,
      energy: 3,
      focus: 5,
    });

    expect(result.ok).toBe(true);
    expect(script.insertPayloads).toHaveLength(1);
    expect(script.updatePayloads).toHaveLength(0);
    const payload = script.insertPayloads[0] as Record<string, unknown>;
    expect(payload.user_id).toBe(userId);
    expect(payload.checked_on).toBe(checkedOn);
    expect(payload.prompt_set_key).toBe("v1_simple");
  });

  it("updates the existing same-day row on ordinary duplicate submission", async () => {
    const script: UpsertScript = {
      existingId: checkInId,
      recoveryId: null,
      selectCalls: 0,
      updatePayloads: [],
      updateFilters: [],
      insertPayloads: [],
      insertError: null,
      updateResult: { data: row({ mood: 5, energy: 4, focus: 3, body: "edited" }), error: null },
      insertResultData: null,
      recoverySelectError: null,
      recoveryUpdateError: null,
    };
    createClient.mockResolvedValue(mockUpsertClient(script));

    const result = await upsertCheckIn({
      checkedOn,
      mood: 5,
      energy: 4,
      focus: 3,
      body: "edited",
    });

    expect(result.ok).toBe(true);
    expect(script.insertPayloads).toHaveLength(0);
    expect(script.selectCalls).toBe(1);
    expect(script.updateFilters[0]).toEqual({ id: checkInId, user_id: userId });
    const payload = script.updatePayloads[0] as Record<string, unknown>;
    expect(payload.mood).toBe(5);
    expect(payload.body).toBe("edited");
    expect(payload).not.toHaveProperty("checked_on");
  });

  it("recovers from concurrent insert unique violation (23505) with one reselect+update", async () => {
    const script: UpsertScript = {
      existingId: null,
      recoveryId: checkInId,
      selectCalls: 0,
      updatePayloads: [],
      updateFilters: [],
      insertPayloads: [],
      insertError: { code: "23505", message: "duplicate key value violates unique constraint" },
      updateResult: {
        data: row({ mood: 2, energy: 2, focus: 2, body: "loser wins via update" }),
        error: null,
      },
      insertResultData: null,
      recoverySelectError: null,
      recoveryUpdateError: null,
    };
    createClient.mockResolvedValue(mockUpsertClient(script));

    const result = await upsertCheckIn({
      checkedOn,
      mood: 2,
      energy: 2,
      focus: 2,
      body: "loser wins via update",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.mood).toBe(2);
      expect(result.data.body).toBe("loser wins via update");
    }
    expect(script.insertPayloads).toHaveLength(1);
    expect(script.selectCalls).toBe(2);
    expect(script.updatePayloads).toHaveLength(1);
    expect(script.updateFilters[0]).toEqual({ id: checkInId, user_id: userId });
  });

  it("returns deliberate conflict when 23505 recovery cannot find the winner row", async () => {
    const script: UpsertScript = {
      existingId: null,
      recoveryId: null,
      selectCalls: 0,
      updatePayloads: [],
      updateFilters: [],
      insertPayloads: [],
      insertError: { code: "23505", message: "duplicate key" },
      updateResult: { data: null, error: null },
      insertResultData: null,
      recoverySelectError: null,
      recoveryUpdateError: null,
    };
    createClient.mockResolvedValue(mockUpsertClient(script));

    const result = await upsertCheckIn({
      checkedOn,
      mood: 1,
      energy: 1,
      focus: 1,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toMatch(/already exists/i);
    }
    expect(script.updatePayloads).toHaveLength(0);
    expect(script.selectCalls).toBe(2);
  });

  it("rejects invalid scores before touching the client", async () => {
    createClient.mockResolvedValue(
      mockUpsertClient({
        existingId: null,
        recoveryId: null,
        selectCalls: 0,
        updatePayloads: [],
        updateFilters: [],
        insertPayloads: [],
        insertError: null,
        updateResult: { data: null, error: null },
        insertResultData: null,
        recoverySelectError: null,
        recoveryUpdateError: null,
      }),
    );
    const result = await upsertCheckIn({
      checkedOn,
      mood: 9,
      energy: 3,
      focus: 3,
    });
    expect(result.ok).toBe(false);
    expect(createClient).not.toHaveBeenCalled();
  });
});

describe("updateCheckIn", () => {
  it("scopes update by id and session user_id and never patches checked_on", async () => {
    const script: UpdateScript = {
      updatePayloads: [],
      filters: [],
      result: {
        data: row({ checked_on: "2026-11-20", mood: 2, energy: 2, focus: 2, body: "note" }),
        error: null,
      },
    };
    createClient.mockResolvedValue(mockUpdateClient(script));

    const result = await updateCheckIn({
      id: checkInId,
      mood: 2,
      energy: 2,
      focus: 2,
      body: "note",
    });

    expect(result.ok).toBe(true);
    expect(script.filters[0]).toEqual({ id: checkInId, user_id: userId });
    const payload = script.updatePayloads[0] as Record<string, unknown>;
    expect(payload.mood).toBe(2);
    expect(payload.body).toBe("note");
    expect(payload).not.toHaveProperty("checked_on");
    expect(payload).not.toHaveProperty("user_id");
    if (result.ok) expect(result.data.checked_on).toBe("2026-11-20");
  });

  it("returns not found when no owned row matches", async () => {
    createClient.mockResolvedValue(
      mockUpdateClient({
        updatePayloads: [],
        filters: [],
        result: { data: null, error: null },
      }),
    );
    const result = await updateCheckIn({
      id: checkInId,
      mood: 1,
      energy: 1,
      focus: 1,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/not found/i);
  });
});
