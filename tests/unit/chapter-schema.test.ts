import { describe, expect, it } from "vitest";
import { createChapterSchema } from "@/modules/chapters/schemas";

describe("createChapterSchema lifecycle", () => {
  it("accepts a planned chapter without endedOn", () => {
    const result = createChapterSchema.safeParse({
      title: "Launch",
      status: "planned",
      startedOn: "2026-01-01",
      isCurrent: false,
    });
    expect(result.success).toBe(true);
  });

  it("rejects planned chapter with endedOn", () => {
    const result = createChapterSchema.safeParse({
      title: "Launch",
      status: "planned",
      startedOn: "2026-01-01",
      endedOn: "2026-02-01",
    });
    expect(result.success).toBe(false);
  });

  it("rejects active chapter with endedOn", () => {
    const result = createChapterSchema.safeParse({
      title: "Now",
      status: "active",
      startedOn: "2026-01-01",
      endedOn: "2026-02-01",
      isCurrent: true,
    });
    expect(result.success).toBe(false);
  });

  it("requires endedOn for closed chapters", () => {
    const missing = createChapterSchema.safeParse({
      title: "Past",
      status: "closed",
      startedOn: "2026-01-01",
    });
    expect(missing.success).toBe(false);

    const ok = createChapterSchema.safeParse({
      title: "Past",
      status: "closed",
      startedOn: "2026-01-01",
      endedOn: "2026-06-01",
    });
    expect(ok.success).toBe(true);
  });

  it("requires current chapters to be active", () => {
    const result = createChapterSchema.safeParse({
      title: "Wrong",
      status: "planned",
      startedOn: "2026-01-01",
      isCurrent: true,
    });
    expect(result.success).toBe(false);
  });
});
