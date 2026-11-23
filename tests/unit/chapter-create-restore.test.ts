import { beforeEach, describe, expect, it, vi } from "vitest";

const requireUser = vi.fn();
const createClient = vi.fn();

vi.mock("@/lib/auth/require-user", () => ({
  requireUser: () => requireUser(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => createClient(),
}));

import { createChapter } from "@/modules/chapters/service";

const userId = "11111111-1111-4111-8111-111111111111";
const previousId = "33333333-3333-4333-8333-333333333333";
const otherId = "55555555-5555-4555-8555-555555555555";
const createdId = "22222222-2222-4222-8222-222222222222";

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

type SelectReply = { data: unknown; error: unknown };

type CreateScript = {
  /** Ordered replies for every `.select().…maybeSingle()` call */
  selects: SelectReply[];
  unsetData: { id: string } | null;
  unsetError?: { code?: string } | null;
  insertError: { code?: string; message?: string } | null;
  insertData: Chapter | null;
  restoreUpdateData: { id: string } | null;
  restoreUpdateError?: { code?: string; message?: string } | null;
  events: string[];
};

function mockCreateClient(script: CreateScript) {
  let selectIdx = 0;

  return {
    from(table: string) {
      if (table !== "chapters") throw new Error(`unexpected ${table}`);
      return {
        select() {
          const api: Record<string, unknown> = {};
          api.eq = () => api;
          api.maybeSingle = async () => {
            const reply = script.selects[selectIdx];
            selectIdx += 1;
            if (!reply) {
              throw new Error(`unexpected select #${selectIdx}`);
            }
            return reply;
          };
          return api;
        },
        update(payload: { is_current: boolean }) {
          const filters: Record<string, string | boolean> = {};
          const api: Record<string, unknown> = {};
          api.eq = (col: string, value: string | boolean) => {
            filters[col] = value;
            return api;
          };
          api.select = () => api;
          api.maybeSingle = async () => {
            if (payload.is_current === false) {
              script.events.push(`unset:${String(filters.id)}`);
              return {
                data: script.unsetData,
                error: script.unsetError ?? null,
              };
            }
            script.events.push(`restore:${String(filters.id)}`);
            return {
              data: script.restoreUpdateData,
              error: script.restoreUpdateError ?? null,
            };
          };
          return api;
        },
        insert(row: { is_current: boolean; status: string; title: string }) {
          script.events.push(
            `insert:current=${row.is_current}:status=${row.status}:title=${row.title}`,
          );
          return {
            select: () => ({
              single: async () => ({
                data: script.insertError ? null : script.insertData,
                error: script.insertError,
              }),
            }),
          };
        },
      };
    },
  };
}

const activeInput = {
  title: "Next",
  status: "active" as const,
  startedOn: "2026-03-01",
  isCurrent: true,
};

describe("createChapter restore-on-failed-insert", () => {
  beforeEach(() => {
    requireUser.mockReset();
    createClient.mockReset();
    requireUser.mockResolvedValue({ id: userId, email: "a@example.com" });
  });

  it("succeeds when previous current exists and insert succeeds", async () => {
    const created: Chapter = {
      id: createdId,
      user_id: userId,
      title: "Next",
      summary: null,
      status: "active",
      started_on: "2026-03-01",
      ended_on: null,
      is_current: true,
    };
    const script: CreateScript = {
      selects: [
        {
          data: { id: previousId, status: "active", is_current: true },
          error: null,
        },
      ],
      unsetData: { id: previousId },
      insertError: null,
      insertData: created,
      restoreUpdateData: null,
      events: [],
    };
    createClient.mockResolvedValue(mockCreateClient(script));
    const result = await createChapter(activeInput);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.id).toBe(createdId);
    expect(script.events).toContain(`unset:${previousId}`);
    expect(script.events.some((e) => e.startsWith("restore:"))).toBe(false);
  });

  it("restores previous when insert fails after unset", async () => {
    const script: CreateScript = {
      selects: [
        {
          data: { id: previousId, status: "active", is_current: true },
          error: null,
        },
        // restore probe: nobody current
        { data: null, error: null },
        // restore load previous
        {
          data: { id: previousId, status: "active", is_current: false },
          error: null,
        },
      ],
      unsetData: { id: previousId },
      insertError: { message: "insert failed" },
      insertData: null,
      restoreUpdateData: { id: previousId },
      events: [],
    };
    createClient.mockResolvedValue(mockCreateClient(script));
    const result = await createChapter(activeInput);
    expect(result.ok).toBe(false);
    expect(script.events).toContain(`restore:${previousId}`);
    if (!result.ok) {
      expect(result.message).toMatch(/could not create chapter/i);
      expect(result.message).not.toMatch(/may not have been restored/i);
    }
  });

  it("does not overwrite when another chapter became current", async () => {
    const script: CreateScript = {
      selects: [
        {
          data: { id: previousId, status: "active", is_current: true },
          error: null,
        },
        // restore probe: other is current
        { data: { id: otherId }, error: null },
        // post-skip who-is-current
        { data: { id: otherId }, error: null },
      ],
      unsetData: { id: previousId },
      insertError: { message: "insert failed" },
      insertData: null,
      restoreUpdateData: null,
      events: [],
    };
    createClient.mockResolvedValue(mockCreateClient(script));
    const result = await createChapter(activeInput);
    expect(result.ok).toBe(false);
    expect(script.events.some((e) => e.startsWith("restore:"))).toBe(false);
  });

  it("does not restore when previous was closed", async () => {
    const script: CreateScript = {
      selects: [
        {
          data: { id: previousId, status: "active", is_current: true },
          error: null,
        },
        { data: null, error: null },
        {
          data: { id: previousId, status: "closed", is_current: false },
          error: null,
        },
        // post-skip: still nobody current
        { data: null, error: null },
      ],
      unsetData: { id: previousId },
      insertError: { message: "insert failed" },
      insertData: null,
      restoreUpdateData: null,
      events: [],
    };
    createClient.mockResolvedValue(mockCreateClient(script));
    const result = await createChapter(activeInput);
    expect(result.ok).toBe(false);
    expect(script.events.some((e) => e.startsWith("restore:"))).toBe(false);
    if (!result.ok) {
      expect(result.message).toMatch(/could not be restored/i);
    }
  });

  it("reports failure when restore update fails", async () => {
    const script: CreateScript = {
      selects: [
        {
          data: { id: previousId, status: "active", is_current: true },
          error: null,
        },
        { data: null, error: null },
        {
          data: { id: previousId, status: "active", is_current: false },
          error: null,
        },
      ],
      unsetData: { id: previousId },
      insertError: { message: "insert failed" },
      insertData: null,
      restoreUpdateData: null,
      restoreUpdateError: { message: "update failed" },
      events: [],
    };
    createClient.mockResolvedValue(mockCreateClient(script));
    const result = await createChapter(activeInput);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toMatch(/may not have been restored|could not restore/i);
    }
  });

  it("does not unsafe-restore when current-state probe fails", async () => {
    const script: CreateScript = {
      selects: [
        {
          data: { id: previousId, status: "active", is_current: true },
          error: null,
        },
        { data: null, error: { message: "probe failed" } },
      ],
      unsetData: { id: previousId },
      insertError: { message: "insert failed" },
      insertData: null,
      restoreUpdateData: null,
      events: [],
    };
    createClient.mockResolvedValue(mockCreateClient(script));
    const result = await createChapter(activeInput);
    expect(result.ok).toBe(false);
    expect(script.events.some((e) => e.startsWith("restore:"))).toBe(false);
    if (!result.ok) {
      expect(result.message).toMatch(/may not have been restored|verify current/i);
    }
  });

  it("does not modify others when there is no previous current and insert fails", async () => {
    const script: CreateScript = {
      selects: [{ data: null, error: null }],
      unsetData: null,
      insertError: { message: "insert failed" },
      insertData: null,
      restoreUpdateData: null,
      events: [],
    };
    createClient.mockResolvedValue(mockCreateClient(script));
    const result = await createChapter(activeInput);
    expect(result.ok).toBe(false);
    expect(script.events.some((e) => e.startsWith("unset:"))).toBe(false);
    expect(script.events.some((e) => e.startsWith("restore:"))).toBe(false);
  });

  it("maps 23505 to a safe conflict without claiming success", async () => {
    const script: CreateScript = {
      selects: [
        {
          data: { id: previousId, status: "active", is_current: true },
          error: null,
        },
        { data: { id: otherId }, error: null },
        { data: { id: otherId }, error: null },
      ],
      unsetData: { id: previousId },
      insertError: { code: "23505" },
      insertData: null,
      restoreUpdateData: null,
      events: [],
    };
    createClient.mockResolvedValue(mockCreateClient(script));
    const result = await createChapter(activeInput);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toMatch(/already current/i);
    }
  });

  it("never triggers current switching for planned creates", async () => {
    const created: Chapter = {
      id: createdId,
      user_id: userId,
      title: "Soon",
      summary: null,
      status: "planned",
      started_on: "2026-04-01",
      ended_on: null,
      is_current: false,
    };
    const script: CreateScript = {
      selects: [],
      unsetData: { id: previousId },
      insertError: null,
      insertData: created,
      restoreUpdateData: null,
      events: [],
    };
    createClient.mockResolvedValue(mockCreateClient(script));
    const result = await createChapter({
      title: "Soon",
      status: "planned",
      startedOn: "2026-04-01",
      isCurrent: false,
    });
    expect(result.ok).toBe(true);
    expect(script.events.some((e) => e.startsWith("unset:"))).toBe(false);
    expect(script.events).toContain(
      "insert:current=false:status=planned:title=Soon",
    );
  });
});
