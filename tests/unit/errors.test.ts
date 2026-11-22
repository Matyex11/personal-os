import { describe, expect, it } from "vitest";
import { AppError, toUserMessage } from "@/lib/errors";

describe("toUserMessage", () => {
  it("returns AppError messages intended for users", () => {
    expect(toUserMessage(new AppError("validation", "Title is required."))).toBe(
      "Title is required.",
    );
  });

  it("does not expose unexpected Error messages", () => {
    expect(toUserMessage(new Error("ECONNREFUSED 127.0.0.1:5432"))).toBe(
      "Something went wrong.",
    );
  });

  it("does not expose unknown thrown values", () => {
    expect(toUserMessage("secret stack dump")).toBe("Something went wrong.");
    expect(toUserMessage({ raw: true })).toBe("Something went wrong.");
  });
});
