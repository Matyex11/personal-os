import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";

const requireUser = vi.fn();
const createClient = vi.fn();

vi.mock("@/lib/auth/require-user", () => ({
  requireUser: () => requireUser(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => createClient(),
}));

import { upsertModuleActivation } from "@/modules/modules/service";

const userId = "11111111-1111-4111-8111-111111111111";
const chapterId = "22222222-2222-4222-8222-222222222222";
const foreignChapterId = "33333333-3333-4333-8333-333333333333";
const activationId = "44444444-4444-4444-8444-444444444444";

type ActivationRow = {
  id: string;
  user_id: string;
  scope: "global" | "chapter";
  chapter_id: string | null;
  module_key: string;
  is_active: boolean;
  settings: Record<string, unknown>;
};

type Script = {
  tablesTouched: string[];
  chapterLookup: { data: { id: string } | null; error: { message?: string } | null };
  upsertCalls: unknown[];
  upsertResult: { data: ActivationRow | null; error: { message?: string } | null };
  existingResult: { data: { id: string } | null; error: { message?: string } | null };
  updateFilters: Array<Record<string, string>>;
  updatePayloads: unknown[];
  updateResult: { data: ActivationRow | null; error: { message?: string } | null };
  insertPayloads: unknown[];
  insertResult: { data: ActivationRow | null; error: { message?: string } | null };
  existingFilters: Array<Record<string, string | null>>;
};

function mockClient(script: Script) {
  return {
    from(table: string) {
      script.tablesTouched.push(table);

      if (table === "chapters") {
        const filters: Record<string, string> = {};
        const api: Record<string, unknown> = {};
        api.select = () => api;
        api.eq = (col: string, value: string) => {
          filters[col] = value;
          return api;
        };
        api.maybeSingle = async () => script.chapterLookup;
        return api;
      }

      // module_activations
      return {
        upsert(payload: unknown) {
          script.upsertCalls.push(payload);
          const api: Record<string, unknown> = {};
          api.select = () => api;
          api.single = async () => script.upsertResult;
          return api;
        },
        select() {
          const filters: Record<string, string | null> = {};
          const api: Record<string, unknown> = {};
          api.eq = (col: string, value: string) => {
            filters[col] = value;
            return api;
          };
          api.is = (col: string, value: null) => {
            filters[col] = value;
            return api;
          };
          api.maybeSingle = async () => {
            script.existingFilters.push({ ...filters });
            return script.existingResult;
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
            return script.updateResult;
          };
          return api;
        },
        insert(payload: unknown) {
          script.insertPayloads.push(payload);
          return {
            select: () => ({
              single: async () => script.insertResult,
            }),
          };
        },
      };
    },
  };
}

function baseScript(overrides: Partial<Script> = {}): Script {
  return {
    tablesTouched: [],
    chapterLookup: { data: { id: chapterId }, error: null },
    upsertCalls: [],
    upsertResult: { data: null, error: { message: "conflict" } },
    existingResult: { data: null, error: null },
    updateFilters: [],
    updatePayloads: [],
    updateResult: { data: null, error: null },
    insertPayloads: [],
    insertResult: { data: null, error: null },
    existingFilters: [],
    ...overrides,
  };
}

describe("upsertModuleActivation chapter overrides", () => {
  beforeEach(() => {
    requireUser.mockReset();
    createClient.mockReset();
  });

  it("rejects unauthenticated callers", async () => {
    requireUser.mockRejectedValue(new AppError("unauthorized", "Sign in required."));
    const result = await upsertModuleActivation({
      moduleKey: "habits",
      isActive: true,
      scope: "chapter",
      chapterId,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toBe("Sign in required.");
    expect(createClient).not.toHaveBeenCalled();
  });

  it("rejects chapter scope without chapterId", async () => {
    requireUser.mockResolvedValue({ id: userId, email: "a@example.com" });
    createClient.mockResolvedValue(mockClient(baseScript()));
    const result = await upsertModuleActivation({
      moduleKey: "habits",
      isActive: true,
      scope: "chapter",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toBe("Chapter scope requires chapterId.");
  });

  it("rejects missing / foreign chapter ids with a safe error", async () => {
    requireUser.mockResolvedValue({ id: userId, email: "a@example.com" });
    const script = baseScript({
      chapterLookup: { data: null, error: null },
    });
    createClient.mockResolvedValue(mockClient(script));

    const result = await upsertModuleActivation({
      moduleKey: "habits",
      isActive: true,
      scope: "chapter",
      chapterId: foreignChapterId,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toBe("Chapter not found.");
    expect(script.upsertCalls).toHaveLength(0);
    expect(script.tablesTouched).toEqual(["chapters"]);
  });

  it("writes chapter override with user_id from requireUser only", async () => {
    requireUser.mockResolvedValue({ id: userId, email: "a@example.com" });
    const saved: ActivationRow = {
      id: activationId,
      user_id: userId,
      scope: "chapter",
      chapter_id: chapterId,
      module_key: "habits",
      is_active: true,
      settings: {},
    };
    const script = baseScript({
      upsertResult: { data: saved, error: null },
    });
    createClient.mockResolvedValue(mockClient(script));

    const result = await upsertModuleActivation({
      moduleKey: "habits",
      isActive: true,
      scope: "chapter",
      chapterId,
      user_id: "99999999-9999-4999-8999-999999999999",
    } as Record<string, unknown>);
    expect(result.ok).toBe(true);
    expect(script.upsertCalls[0]).toMatchObject({
      user_id: userId,
      scope: "chapter",
      chapter_id: chapterId,
      module_key: "habits",
      is_active: true,
    });
    expect(script.tablesTouched).toContain("chapters");
    expect(script.tablesTouched).toContain("module_activations");
  });

  it("preserves global activation path without chapter ownership lookup", async () => {
    requireUser.mockResolvedValue({ id: userId, email: "a@example.com" });
    const saved: ActivationRow = {
      id: activationId,
      user_id: userId,
      scope: "global",
      chapter_id: null,
      module_key: "habits",
      is_active: false,
      settings: {},
    };
    const script = baseScript({
      upsertResult: { data: saved, error: null },
    });
    createClient.mockResolvedValue(mockClient(script));

    const result = await upsertModuleActivation({
      moduleKey: "habits",
      isActive: false,
      scope: "global",
    });
    expect(result.ok).toBe(true);
    expect(script.tablesTouched).toEqual(["module_activations"]);
    expect(script.upsertCalls[0]).toMatchObject({
      user_id: userId,
      scope: "global",
      chapter_id: null,
      is_active: false,
    });
  });

  it("falls back to update scoped by activation id and user id", async () => {
    requireUser.mockResolvedValue({ id: userId, email: "a@example.com" });
    const updated: ActivationRow = {
      id: activationId,
      user_id: userId,
      scope: "chapter",
      chapter_id: chapterId,
      module_key: "projects",
      is_active: false,
      settings: {},
    };
    const script = baseScript({
      upsertResult: { data: null, error: { message: "no unique or exclusion constraint" } },
      existingResult: { data: { id: activationId }, error: null },
      updateResult: { data: updated, error: null },
    });
    createClient.mockResolvedValue(mockClient(script));

    const result = await upsertModuleActivation({
      moduleKey: "projects",
      isActive: false,
      scope: "chapter",
      chapterId,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.is_active).toBe(false);
    expect(script.updateFilters).toEqual([{ id: activationId, user_id: userId }]);
    expect(script.existingFilters[0]).toMatchObject({
      user_id: userId,
      module_key: "projects",
      scope: "chapter",
      chapter_id: chapterId,
    });
    expect(script.insertPayloads).toHaveLength(0);
  });

  it("falls back to insert when no existing row after upsert conflict", async () => {
    requireUser.mockResolvedValue({ id: userId, email: "a@example.com" });
    const inserted: ActivationRow = {
      id: activationId,
      user_id: userId,
      scope: "chapter",
      chapter_id: chapterId,
      module_key: "tasks",
      is_active: true,
      settings: {},
    };
    const script = baseScript({
      upsertResult: { data: null, error: { message: "no unique or exclusion constraint" } },
      existingResult: { data: null, error: null },
      insertResult: { data: inserted, error: null },
    });
    createClient.mockResolvedValue(mockClient(script));

    const result = await upsertModuleActivation({
      moduleKey: "tasks",
      isActive: true,
      scope: "chapter",
      chapterId,
    });
    expect(result.ok).toBe(true);
    expect(script.insertPayloads[0]).toMatchObject({
      user_id: userId,
      scope: "chapter",
      chapter_id: chapterId,
      module_key: "tasks",
      is_active: true,
    });
  });

  it("surfaces fallback lookup errors safely", async () => {
    requireUser.mockResolvedValue({ id: userId, email: "a@example.com" });
    const script = baseScript({
      upsertResult: { data: null, error: { message: "no unique or exclusion constraint" } },
      existingResult: { data: null, error: { message: "db down" } },
    });
    createClient.mockResolvedValue(mockClient(script));

    const result = await upsertModuleActivation({
      moduleKey: "habits",
      isActive: true,
      scope: "chapter",
      chapterId,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toBe("Could not save module.");
  });

  it("surfaces fallback update errors safely", async () => {
    requireUser.mockResolvedValue({ id: userId, email: "a@example.com" });
    const script = baseScript({
      upsertResult: { data: null, error: { message: "conflict" } },
      existingResult: { data: { id: activationId }, error: null },
      updateResult: { data: null, error: { message: "db down" } },
    });
    createClient.mockResolvedValue(mockClient(script));

    const result = await upsertModuleActivation({
      moduleKey: "habits",
      isActive: false,
      scope: "chapter",
      chapterId,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toBe("Could not update module.");
  });

  it("surfaces fallback insert errors safely", async () => {
    requireUser.mockResolvedValue({ id: userId, email: "a@example.com" });
    const script = baseScript({
      upsertResult: { data: null, error: { message: "conflict" } },
      existingResult: { data: null, error: null },
      insertResult: { data: null, error: { message: "db down" } },
    });
    createClient.mockResolvedValue(mockClient(script));

    const result = await upsertModuleActivation({
      moduleKey: "habits",
      isActive: true,
      scope: "chapter",
      chapterId,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toBe("Could not save module.");
  });

  it("does not write a global row when saving a chapter override", async () => {
    requireUser.mockResolvedValue({ id: userId, email: "a@example.com" });
    const saved: ActivationRow = {
      id: activationId,
      user_id: userId,
      scope: "chapter",
      chapter_id: chapterId,
      module_key: "habits",
      is_active: true,
      settings: {},
    };
    const script = baseScript({
      upsertResult: { data: saved, error: null },
    });
    createClient.mockResolvedValue(mockClient(script));

    await upsertModuleActivation({
      moduleKey: "habits",
      isActive: true,
      scope: "chapter",
      chapterId,
    });

    expect(script.upsertCalls).toHaveLength(1);
    expect(script.upsertCalls[0]).toMatchObject({ scope: "chapter", chapter_id: chapterId });
    expect(script.upsertCalls.every((call) => (call as ActivationRow).scope !== "global")).toBe(
      true,
    );
  });
});
