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

import { updateProfileSettings } from "@/modules/profile/service";

const userId = "11111111-1111-4111-8111-111111111111";
const otherUserId = "99999999-9999-4999-8999-999999999999";

type Profile = {
  id: string;
  display_name: string | null;
  timezone: string;
  base_currency: string;
};

type Script = {
  updateFilters: Array<Record<string, string>>;
  updatePayloads: unknown[];
  updateData: Profile | null;
  updateError: { message?: string } | null;
  insertPayloads: unknown[];
  insertData: Profile | null;
  insertError: { message?: string } | null;
  tablesTouched: string[];
};

function mockClient(script: Script) {
  return {
    from(table: string) {
      script.tablesTouched.push(table);
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
            script.updateFilters.push({ ...filters });
            return {
              data: script.updateError ? null : script.updateData,
              error: script.updateError,
            };
          };
          return api;
        },
        insert(payload: unknown) {
          script.insertPayloads.push(payload);
          return {
            select: () => ({
              maybeSingle: async () => ({
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

const validInput = {
  displayName: "Alex",
  timezone: "Europe/Bucharest",
  baseCurrency: "RON",
};

describe("updateProfileSettings", () => {
  beforeEach(() => {
    requireUser.mockReset();
    createClient.mockReset();
  });

  it("rejects unauthenticated callers", async () => {
    requireUser.mockRejectedValue(new AppError("unauthorized", "Sign in required."));
    const result = await updateProfileSettings(validInput);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toBe("Sign in required.");
    expect(createClient).not.toHaveBeenCalled();
  });

  it("updates only the session user's profile id", async () => {
    requireUser.mockResolvedValue({ id: userId, email: "a@example.com" });
    const saved: Profile = {
      id: userId,
      display_name: "Alex",
      timezone: "Europe/Bucharest",
      base_currency: "RON",
    };
    const script: Script = {
      updateFilters: [],
      updatePayloads: [],
      updateData: saved,
      updateError: null,
      insertPayloads: [],
      insertData: null,
      insertError: null,
      tablesTouched: [],
    };
    createClient.mockResolvedValue(mockClient(script));

    const result = await updateProfileSettings(validInput);
    expect(result.ok).toBe(true);
    expect(script.updateFilters).toEqual([{ id: userId }]);
    expect(script.insertPayloads).toHaveLength(0);
    expect(script.tablesTouched).toEqual(["profiles"]);
    // Never uses a client-supplied foreign id.
    expect(JSON.stringify(script)).not.toContain(otherUserId);
  });

  it("ignores any client-supplied profile id field", async () => {
    requireUser.mockResolvedValue({ id: userId, email: "a@example.com" });
    const saved: Profile = {
      id: userId,
      display_name: "Alex",
      timezone: "UTC",
      base_currency: "EUR",
    };
    const script: Script = {
      updateFilters: [],
      updatePayloads: [],
      updateData: saved,
      updateError: null,
      insertPayloads: [],
      insertData: null,
      insertError: null,
      tablesTouched: [],
    };
    createClient.mockResolvedValue(mockClient(script));

    const result = await updateProfileSettings({
      ...validInput,
      id: otherUserId,
      profileId: otherUserId,
      timezone: "UTC",
      baseCurrency: "EUR",
    });
    expect(result.ok).toBe(true);
    expect(script.updateFilters).toEqual([{ id: userId }]);
    expect(script.updateFilters[0]?.id).not.toBe(otherUserId);
  });

  it("inserts when the profile row is missing", async () => {
    requireUser.mockResolvedValue({ id: userId, email: "a@example.com" });
    const created: Profile = {
      id: userId,
      display_name: null,
      timezone: "Europe/Bucharest",
      base_currency: "RON",
    };
    const script: Script = {
      updateFilters: [],
      updatePayloads: [],
      updateData: null,
      updateError: null,
      insertPayloads: [],
      insertData: created,
      insertError: null,
      tablesTouched: [],
    };
    createClient.mockResolvedValue(mockClient(script));

    const result = await updateProfileSettings({
      displayName: "   ",
      timezone: "Europe/Bucharest",
      baseCurrency: "RON",
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.id).toBe(userId);
    expect(script.insertPayloads).toHaveLength(1);
    expect(script.insertPayloads[0]).toMatchObject({
      id: userId,
      display_name: null,
      timezone: "Europe/Bucharest",
      base_currency: "RON",
    });
  });

  it("returns a safe message when persistence fails", async () => {
    requireUser.mockResolvedValue({ id: userId, email: "a@example.com" });
    const script: Script = {
      updateFilters: [],
      updatePayloads: [],
      updateData: null,
      updateError: { message: "permission denied for table profiles detail=secret" },
      insertPayloads: [],
      insertData: null,
      insertError: null,
      tablesTouched: [],
    };
    createClient.mockResolvedValue(mockClient(script));

    const result = await updateProfileSettings(validInput);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toBe("Could not save profile settings.");
      expect(result.message).not.toContain("permission denied");
      expect(result.message).not.toContain("secret");
    }
  });

  it("returns a safe message when insert after missing row fails", async () => {
    requireUser.mockResolvedValue({ id: userId, email: "a@example.com" });
    const script: Script = {
      updateFilters: [],
      updatePayloads: [],
      updateData: null,
      updateError: null,
      insertPayloads: [],
      insertData: null,
      insertError: { message: "duplicate key internal" },
      tablesTouched: [],
    };
    createClient.mockResolvedValue(mockClient(script));

    const result = await updateProfileSettings(validInput);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toBe("Could not create profile settings.");
      expect(result.message).not.toContain("duplicate");
    }
  });

  it("rejects invalid input before writing", async () => {
    requireUser.mockResolvedValue({ id: userId, email: "a@example.com" });

    const result = await updateProfileSettings({
      displayName: "A",
      timezone: "Not/Real",
      baseCurrency: "RON",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toMatch(/IANA|time zone/i);
    }
    expect(createClient).not.toHaveBeenCalled();
  });

  it("does not touch habit/chapter/task tables", async () => {
    requireUser.mockResolvedValue({ id: userId, email: "a@example.com" });
    const saved: Profile = {
      id: userId,
      display_name: "Alex",
      timezone: "Europe/London",
      base_currency: "GBP",
    };
    const script: Script = {
      updateFilters: [],
      updatePayloads: [],
      updateData: saved,
      updateError: null,
      insertPayloads: [],
      insertData: null,
      insertError: null,
      tablesTouched: [],
    };
    createClient.mockResolvedValue(mockClient(script));

    await updateProfileSettings({
      displayName: "Alex",
      timezone: "Europe/London",
      baseCurrency: "GBP",
    });
    expect(script.tablesTouched).toEqual(["profiles"]);
  });
});
