import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/lib/auth/safe-next-path";

describe("safeNextPath", () => {
  it("allows same-origin relative paths", () => {
    expect(safeNextPath("/")).toBe("/");
    expect(safeNextPath("/habits")).toBe("/habits");
    expect(safeNextPath("/settings?tab=profile")).toBe("/settings?tab=profile");
    expect(safeNextPath("/chapters#current")).toBe("/chapters#current");
  });

  it("rejects absolute and external destinations", () => {
    expect(safeNextPath("https://evil.example/phish")).toBe("/");
    expect(safeNextPath("http://evil.example")).toBe("/");
    expect(safeNextPath("evil.example/path")).toBe("/");
  });

  it("rejects protocol-relative destinations", () => {
    expect(safeNextPath("//evil.example")).toBe("/");
    expect(safeNextPath("//evil.example/path")).toBe("/");
  });

  it("rejects backslash and embedded scheme tricks", () => {
    expect(safeNextPath("/\\evil.example")).toBe("/");
    expect(safeNextPath("/redirect?to=https://evil.example")).toBe("/");
  });

  it("falls back for empty or nullish input", () => {
    expect(safeNextPath(null)).toBe("/");
    expect(safeNextPath(undefined)).toBe("/");
    expect(safeNextPath("")).toBe("/");
  });
});
