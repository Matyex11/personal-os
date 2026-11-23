import { describe, expect, it } from "vitest";
import { selectAttentionTasks } from "@/modules/dashboard/attention-tasks";

describe("selectAttentionTasks", () => {
  const todayOn = "2026-11-23";
  const projects = [
    { id: "p1", title: "App" },
    { id: "p2", title: "Ops" },
  ];
  const milestones = [{ id: "m1", title: "Ship" }];

  it("includes overdue and due within 7 days, sorted overdue first", () => {
    const rows = selectAttentionTasks({
      todayOn,
      projects,
      milestones,
      tasks: [
        {
          id: "t-soon",
          title: "Soon",
          status: "todo",
          due_on: "2026-11-28",
          project_id: "p1",
          milestone_id: "m1",
        },
        {
          id: "t-overdue",
          title: "Overdue",
          status: "doing",
          due_on: "2026-11-20",
          project_id: "p2",
          milestone_id: null,
        },
        {
          id: "t-horizon",
          title: "Horizon",
          status: "todo",
          due_on: "2026-11-30",
          project_id: null,
          milestone_id: null,
        },
      ],
    });

    expect(rows.map((r) => r.id)).toEqual(["t-overdue", "t-soon", "t-horizon"]);
    expect(rows[0]?.overdue).toBe(true);
    expect(rows[1]?.overdue).toBe(false);
    expect(rows[0]?.projectTitle).toBe("Ops");
    expect(rows[1]?.projectTitle).toBe("App");
    expect(rows[1]?.milestoneTitle).toBe("Ship");
  });

  it("excludes done, cancelled, undated, and beyond horizon", () => {
    const rows = selectAttentionTasks({
      todayOn,
      projects,
      milestones,
      tasks: [
        {
          id: "done",
          title: "Done",
          status: "done",
          due_on: "2026-11-20",
          project_id: null,
          milestone_id: null,
        },
        {
          id: "cancelled",
          title: "Cancelled",
          status: "cancelled",
          due_on: "2026-11-20",
          project_id: null,
          milestone_id: null,
        },
        {
          id: "undated",
          title: "Undated",
          status: "todo",
          due_on: null,
          project_id: null,
          milestone_id: null,
        },
        {
          id: "far",
          title: "Far",
          status: "todo",
          due_on: "2026-12-01",
          project_id: null,
          milestone_id: null,
        },
      ],
    });
    expect(rows).toEqual([]);
  });

  it("includes due exactly today and exactly today+7", () => {
    const rows = selectAttentionTasks({
      todayOn,
      projects: [],
      milestones: [],
      tasks: [
        {
          id: "today",
          title: "Today",
          status: "todo",
          due_on: "2026-11-23",
          project_id: null,
          milestone_id: null,
        },
        {
          id: "plus7",
          title: "Plus7",
          status: "doing",
          due_on: "2026-11-30",
          project_id: null,
          milestone_id: null,
        },
      ],
    });
    expect(rows.map((r) => r.id)).toEqual(["today", "plus7"]);
    expect(rows.every((r) => !r.overdue)).toBe(true);
  });
});
