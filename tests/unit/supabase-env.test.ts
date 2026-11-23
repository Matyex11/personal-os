import { afterEach, describe, expect, it, vi } from "vitest";
import { getSupabasePublishableKey, getSupabaseUrl } from "@/lib/supabase/env";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getSupabaseUrl", () => {
  it("returns NEXT_PUBLIC_SUPABASE_URL when set", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    expect(getSupabaseUrl()).toBe("https://example.supabase.co");
  });

  it("throws when NEXT_PUBLIC_SUPABASE_URL is missing", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    expect(() => getSupabaseUrl()).toThrow(
      "Missing required environment variable NEXT_PUBLIC_SUPABASE_URL",
    );
  });
});

describe("getSupabasePublishableKey", () => {
  it("returns NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY when set", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
    expect(getSupabasePublishableKey()).toBe("sb_publishable_test");
  });

  it("throws when NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is missing", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
    expect(() => getSupabasePublishableKey()).toThrow(
      "Missing required environment variable NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    );
  });
});

describe("static public env access", () => {
  it("reads URL and publishable key via direct process.env property access", async () => {
    const { readFile } = await import("node:fs/promises");
    const { join } = await import("node:path");
    const source = await readFile(
      join(process.cwd(), "src/lib/supabase/env.ts"),
      "utf8",
    );

    expect(source).toContain("process.env.NEXT_PUBLIC_SUPABASE_URL");
    expect(source).toContain("process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
    expect(source).not.toMatch(/process\.env\s*\[/);
  });
});
