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

import {
  getLatestPhysicalSnapshot,
  updatePhysicalMetric,
  upsertPhysicalMetric,
  upsertPhysicalMetricsForDay,
} from "@/modules/physical/service";

const userId = "11111111-1111-4111-8111-111111111111";
const metricId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const recordedOn = "2026-11-24";

type UpsertScript = {
  existingId: string | null;
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

function row(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: metricId,
    user_id: userId,
    recorded_on: recordedOn,
    metric_key: "weight_kg",
    value: 72.5,
    unit: "kg",
    notes: null,
    created_at: "2026-11-24T10:00:00.000Z",
    updated_at: "2026-11-24T10:00:00.000Z",
    ...overrides,
  };
}

function mockUpsertClient(script: UpsertScript) {
  return {
    from(table: string) {
      expect(table).toBe("physical_metrics");
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
            if (script.recoveryUpdateError) {
              return { data: null, error: script.recoveryUpdateError };
            }
            return script.updateResult;
          };
          api.maybeSingle = async () => {
            script.updateFilters.push({ ...filters });
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

beforeEach(() => {
  requireUser.mockReset();
  createClient.mockReset();
  requireUser.mockResolvedValue({ id: userId });
});

describe("upsertPhysicalMetric", () => {
  it("updates an existing (user, key, day) row and scopes by user_id", async () => {
    const script: UpsertScript = {
      existingId: metricId,
      recoveryId: null,
      selectCalls: 0,
      updatePayloads: [],
      updateFilters: [],
      insertPayloads: [],
      insertError: null,
      updateResult: { data: row({ value: 73 }), error: null },
      insertResultData: null,
      recoverySelectError: null,
      recoveryUpdateError: null,
    };
    createClient.mockResolvedValue(mockUpsertClient(script));

    const result = await upsertPhysicalMetric({
      recordedOn,
      metricKey: "weight_kg",
      value: 73,
    });

    expect(result.ok).toBe(true);
    expect(script.insertPayloads).toHaveLength(0);
    expect(script.updatePayloads).toHaveLength(1);
    expect(script.updateFilters[0]).toMatchObject({ id: metricId, user_id: userId });
    expect(script.updatePayloads[0]).toMatchObject({ value: 73, unit: "kg" });
    expect(script.updatePayloads[0]).not.toHaveProperty("notes");
  });

  it("inserts when missing and recovers once on 23505", async () => {
    const script: UpsertScript = {
      existingId: null,
      recoveryId: metricId,
      selectCalls: 0,
      updatePayloads: [],
      updateFilters: [],
      insertPayloads: [],
      insertError: { code: "23505", message: "duplicate" },
      updateResult: { data: row({ value: 71 }), error: null },
      insertResultData: null,
      recoverySelectError: null,
      recoveryUpdateError: null,
    };
    createClient.mockResolvedValue(mockUpsertClient(script));

    const result = await upsertPhysicalMetric({
      recordedOn,
      metricKey: "weight_kg",
      value: 71,
      notes: "race",
    });

    expect(result.ok).toBe(true);
    expect(script.insertPayloads).toHaveLength(1);
    expect(script.insertPayloads[0]).toMatchObject({
      user_id: userId,
      recorded_on: recordedOn,
      metric_key: "weight_kg",
      value: 71,
      unit: "kg",
      notes: "race",
    });
    expect(script.selectCalls).toBe(2);
    expect(script.updatePayloads).toHaveLength(1);
  });

  it("rejects out-of-range values before writing", async () => {
    createClient.mockResolvedValue({});
    const result = await upsertPhysicalMetric({
      recordedOn,
      metricKey: "steps",
      value: -1,
    });
    expect(result.ok).toBe(false);
    expect(createClient).not.toHaveBeenCalled();
  });
});

describe("upsertPhysicalMetricsForDay", () => {
  it("writes a subset of metrics for one day", async () => {
    const calls: string[] = [];
    createClient.mockResolvedValue({
      from(table: string) {
        expect(table).toBe("physical_metrics");
        return {
          select() {
            const api: Record<string, unknown> = {};
            api.eq = () => api;
            api.maybeSingle = async () => ({ data: null, error: null });
            return api;
          },
          insert(payload: { metric_key: string }) {
            calls.push(payload.metric_key);
            const api: Record<string, unknown> = {};
            api.select = () => api;
            api.single = async () => ({
              data: row({
                id: `${payload.metric_key}-id`,
                metric_key: payload.metric_key,
                unit: payload.metric_key === "steps" ? "count" : "kg",
                value: payload.metric_key === "steps" ? 1000 : 70,
              }),
              error: null,
            });
            return api;
          },
        };
      },
    });

    const result = await upsertPhysicalMetricsForDay({
      recordedOn,
      metrics: [
        { metricKey: "weight_kg", value: 70 },
        { metricKey: "steps", value: 1000 },
      ],
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toHaveLength(2);
    expect(calls).toEqual(["weight_kg", "steps"]);
  });
});

describe("getLatestPhysicalSnapshot", () => {
  it("loads latest row per metric key instead of a single shared LIMIT window", async () => {
    const keysQueried: string[] = [];
    createClient.mockResolvedValue({
      from(table: string) {
        if (table === "profiles") {
          return {
            select() {
              const api: Record<string, unknown> = {};
              api.eq = () => api;
              api.maybeSingle = async () => ({
                data: { timezone: "Europe/Bucharest" },
                error: null,
              });
              return api;
            },
          };
        }
        expect(table).toBe("physical_metrics");
        return {
          select(columns?: string) {
            const filters: Record<string, string> = {};
            const api: Record<string, unknown> = {
              eq(col: string, value: string) {
                filters[col] = value;
                return api;
              },
              order() {
                return api;
              },
              limit() {
                return api;
              },
              maybeSingle: async () => {
                keysQueried.push(filters.metric_key);
                return {
                  data: row({
                    metric_key: filters.metric_key,
                    value: 1,
                    unit: "kg",
                  }),
                  error: null,
                };
              },
              then(
                resolve: (value: { data: unknown; error: null }) => unknown,
              ) {
                // todayCount path: select("id").eq().eq() awaited as a thenable
                if (columns === "id") {
                  return Promise.resolve(
                    resolve({ data: [{ id: "today-1" }], error: null }),
                  );
                }
                return Promise.resolve(resolve({ data: null, error: null }));
              },
            };
            return api;
          },
        };
      },
    });

    const result = await getLatestPhysicalSnapshot();
    expect(result.ok).toBe(true);
    expect(keysQueried.sort()).toEqual(
      [
        "weight_kg",
        "sleep_hours",
        "steps",
        "resting_hr_bpm",
        "workout_minutes",
      ].sort(),
    );
    if (result.ok) {
      expect(result.data.todayCount).toBe(1);
      expect(result.data.latestByKey.weight_kg?.metric_key).toBe("weight_kg");
    }
  });
});

describe("updatePhysicalMetric", () => {
  it("updates by id + user_id + metric_key", async () => {
    const filters: Record<string, string> = {};
    createClient.mockResolvedValue({
      from(table: string) {
        expect(table).toBe("physical_metrics");
        return {
          update(payload: unknown) {
            expect(payload).toMatchObject({ value: 60, unit: "bpm" });
            const api: Record<string, unknown> = {};
            api.eq = (col: string, value: string) => {
              filters[col] = value;
              return api;
            };
            api.select = () => api;
            api.maybeSingle = async () => ({
              data: row({ metric_key: "resting_hr_bpm", value: 60, unit: "bpm" }),
              error: null,
            });
            return api;
          },
        };
      },
    });

    const result = await updatePhysicalMetric({
      id: metricId,
      metricKey: "resting_hr_bpm",
      value: 60,
    });

    expect(result.ok).toBe(true);
    expect(filters).toEqual({
      id: metricId,
      user_id: userId,
      metric_key: "resting_hr_bpm",
    });
  });

  it("returns not_found when no owned row matches", async () => {
    createClient.mockResolvedValue({
      from() {
        return {
          update() {
            const api: Record<string, unknown> = {};
            api.eq = () => api;
            api.select = () => api;
            api.maybeSingle = async () => ({ data: null, error: null });
            return api;
          },
        };
      },
    });

    const result = await updatePhysicalMetric({
      id: metricId,
      metricKey: "steps",
      value: 10,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message.toLowerCase()).toMatch(/not found/);
  });
});
