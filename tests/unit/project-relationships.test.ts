import { describe, expect, it } from "vitest";
import {
  buildProjectHierarchy,
  resolveTaskParents,
} from "@/modules/projects/relationships";
import {
  updateMilestoneStatusSchema,
  updateProjectStatusSchema,
  updateTaskStatusSchema,
} from "@/modules/projects/schemas";

function collectVisibleTaskIds(tree: ReturnType<typeof buildProjectHierarchy>): string[] {
  return [
    ...tree.projects.flatMap((project) => [
      ...project.directTasks.map((task) => task.id),
      ...project.milestones.flatMap((milestone) => milestone.tasks.map((task) => task.id)),
    ]),
    ...tree.standaloneMilestones.flatMap((milestone) =>
      milestone.tasks.map((task) => task.id),
    ),
    ...tree.inboxTasks.map((task) => task.id),
    ...tree.relationshipConflicts.map((conflict) => conflict.task.id),
  ];
}

describe("resolveTaskParents", () => {
  it("allows inbox tasks with no parents", () => {
    expect(resolveTaskParents({ milestone: null })).toEqual({
      ok: true,
      projectId: null,
      milestoneId: null,
    });
  });

  it("derives project from milestone when project omitted", () => {
    expect(
      resolveTaskParents({
        milestoneId: "m1",
        milestone: { id: "m1", project_id: "p1" },
      }),
    ).toEqual({ ok: true, projectId: "p1", milestoneId: "m1" });
  });

  it("accepts matching project + milestone", () => {
    expect(
      resolveTaskParents({
        projectId: "p1",
        milestoneId: "m1",
        milestone: { id: "m1", project_id: "p1" },
      }),
    ).toEqual({ ok: true, projectId: "p1", milestoneId: "m1" });
  });

  it("rejects inconsistent project + milestone", () => {
    const result = resolveTaskParents({
      projectId: "p1",
      milestoneId: "m1",
      milestone: { id: "m1", project_id: "p2" },
    });
    expect(result.ok).toBe(false);
  });

  it("rejects project with standalone milestone", () => {
    const result = resolveTaskParents({
      projectId: "p1",
      milestoneId: "m1",
      milestone: { id: "m1", project_id: null },
    });
    expect(result.ok).toBe(false);
  });

  it("rejects missing milestone row", () => {
    expect(
      resolveTaskParents({ milestoneId: "m1", milestone: null }).ok,
    ).toBe(false);
  });
});

describe("buildProjectHierarchy", () => {
  it("nests without duplicating tasks and supports inbox + standalone", () => {
    const tree = buildProjectHierarchy({
      projects: [
        { id: "p1", title: "App", status: "active", target_date: null },
      ],
      milestones: [
        {
          id: "m1",
          title: "Ship",
          status: "pending",
          target_on: null,
          achieved_on: null,
          project_id: "p1",
        },
        {
          id: "m2",
          title: "Solo",
          status: "pending",
          target_on: null,
          achieved_on: null,
          project_id: null,
        },
      ],
      tasks: [
        {
          id: "t1",
          title: "Under milestone",
          status: "done",
          due_on: null,
          completed_at: "2026-01-01T00:00:00.000Z",
          project_id: "p1",
          milestone_id: "m1",
        },
        {
          id: "t2",
          title: "Direct",
          status: "todo",
          due_on: null,
          completed_at: null,
          project_id: "p1",
          milestone_id: null,
        },
        {
          id: "t3",
          title: "Inbox",
          status: "todo",
          due_on: null,
          completed_at: null,
          project_id: null,
          milestone_id: null,
        },
        {
          id: "t4",
          title: "On standalone",
          status: "doing",
          due_on: null,
          completed_at: null,
          project_id: null,
          milestone_id: "m2",
        },
      ],
    });

    expect(tree.projects[0]?.milestones[0]?.tasks.map((t) => t.id)).toEqual([
      "t1",
    ]);
    expect(tree.projects[0]?.directTasks.map((t) => t.id)).toEqual(["t2"]);
    expect(tree.projects[0]?.taskTotal).toBe(2);
    expect(tree.projects[0]?.taskDone).toBe(1);
    expect(tree.inboxTasks.map((t) => t.id)).toEqual(["t3"]);
    expect(tree.standaloneMilestones[0]?.tasks.map((t) => t.id)).toEqual([
      "t4",
    ]);
    expect(tree.relationshipConflicts).toEqual([]);

    const allIds = collectVisibleTaskIds(tree);
    expect(new Set(allIds).size).toBe(allIds.length);
    expect(allIds.sort()).toEqual(["t1", "t2", "t3", "t4"].sort());
  });

  it("quarantines mismatched project/milestone links and excludes them from progress", () => {
    const tree = buildProjectHierarchy({
      projects: [
        { id: "pA", title: "Alpha", status: "active", target_date: null },
        { id: "pB", title: "Beta", status: "active", target_date: null },
      ],
      milestones: [
        {
          id: "mB",
          title: "Beta mile",
          status: "pending",
          target_on: null,
          achieved_on: null,
          project_id: "pB",
        },
        {
          id: "mSolo",
          title: "Solo mile",
          status: "pending",
          target_on: null,
          achieved_on: null,
          project_id: null,
        },
        {
          id: "mA",
          title: "Alpha mile",
          status: "pending",
          target_on: null,
          achieved_on: null,
          project_id: "pA",
        },
      ],
      tasks: [
        {
          id: "conflict-ab",
          title: "Task A + milestone B",
          status: "done",
          due_on: null,
          completed_at: "2026-01-01T00:00:00.000Z",
          project_id: "pA",
          milestone_id: "mB",
        },
        {
          id: "conflict-a-solo",
          title: "Task A + standalone milestone",
          status: "todo",
          due_on: null,
          completed_at: null,
          project_id: "pA",
          milestone_id: "mSolo",
        },
        {
          id: "conflict-null-a",
          title: "Null project + milestone A",
          status: "doing",
          due_on: null,
          completed_at: null,
          project_id: null,
          milestone_id: "mA",
        },
        {
          id: "consistent",
          title: "Normal consistent",
          status: "done",
          due_on: null,
          completed_at: "2026-02-01T00:00:00.000Z",
          project_id: "pA",
          milestone_id: "mA",
        },
        {
          id: "direct",
          title: "Direct on A",
          status: "todo",
          due_on: null,
          completed_at: null,
          project_id: "pA",
          milestone_id: null,
        },
        {
          id: "inbox",
          title: "Inbox",
          status: "todo",
          due_on: null,
          completed_at: null,
          project_id: null,
          milestone_id: null,
        },
        {
          id: "unresolved",
          title: "Missing milestone",
          status: "todo",
          due_on: null,
          completed_at: null,
          project_id: "pA",
          milestone_id: "missing-mile",
        },
      ],
    });

    const conflictIds = tree.relationshipConflicts.map((c) => c.task.id).sort();
    expect(conflictIds).toEqual(
      ["conflict-a-solo", "conflict-ab", "conflict-null-a", "unresolved"].sort(),
    );

    const ab = tree.relationshipConflicts.find((c) => c.task.id === "conflict-ab");
    expect(ab?.reason).toBe("project_mismatch");
    expect(ab?.taskProject?.id).toBe("pA");
    expect(ab?.milestone?.id).toBe("mB");
    expect(ab?.milestoneProject?.id).toBe("pB");

    const solo = tree.relationshipConflicts.find((c) => c.task.id === "conflict-a-solo");
    expect(solo?.reason).toBe("project_mismatch");
    expect(solo?.milestoneProject).toBeNull();

    const nullA = tree.relationshipConflicts.find((c) => c.task.id === "conflict-null-a");
    expect(nullA?.reason).toBe("project_mismatch");
    expect(nullA?.taskProject).toBeNull();
    expect(nullA?.milestoneProject?.id).toBe("pA");

    const unresolved = tree.relationshipConflicts.find((c) => c.task.id === "unresolved");
    expect(unresolved?.reason).toBe("unresolved_milestone");
    expect(unresolved?.milestone).toBeNull();

    const projectA = tree.projects.find((p) => p.id === "pA");
    expect(projectA?.milestones[0]?.tasks.map((t) => t.id)).toEqual(["consistent"]);
    expect(projectA?.directTasks.map((t) => t.id)).toEqual(["direct"]);
    expect(projectA?.taskTotal).toBe(2);
    expect(projectA?.taskDone).toBe(1);

    const projectB = tree.projects.find((p) => p.id === "pB");
    expect(projectB?.milestones[0]?.tasks).toEqual([]);
    expect(projectB?.taskTotal).toBe(0);

    expect(tree.standaloneMilestones[0]?.tasks).toEqual([]);
    expect(tree.inboxTasks.map((t) => t.id)).toEqual(["inbox"]);

    const nestedIds = [
      ...tree.projects.flatMap((project) => [
        ...project.directTasks.map((task) => task.id),
        ...project.milestones.flatMap((milestone) => milestone.tasks.map((task) => task.id)),
      ]),
      ...tree.standaloneMilestones.flatMap((milestone) =>
        milestone.tasks.map((task) => task.id),
      ),
      ...tree.inboxTasks.map((task) => task.id),
    ];
    for (const id of conflictIds) {
      expect(nestedIds).not.toContain(id);
    }

    const allIds = collectVisibleTaskIds(tree);
    expect(new Set(allIds).size).toBe(allIds.length);
    expect(allIds.sort()).toEqual(
      [
        "conflict-ab",
        "conflict-a-solo",
        "conflict-null-a",
        "consistent",
        "direct",
        "inbox",
        "unresolved",
      ].sort(),
    );
  });
});

describe("status update schemas", () => {
  it("accepts valid statuses and rejects invalid ones", () => {
    expect(
      updateProjectStatusSchema.safeParse({
        projectId: "11111111-1111-4111-8111-111111111111",
        status: "paused",
      }).success,
    ).toBe(true);
    expect(
      updateProjectStatusSchema.safeParse({
        projectId: "11111111-1111-4111-8111-111111111111",
        status: "nope",
      }).success,
    ).toBe(false);
    expect(
      updateMilestoneStatusSchema.safeParse({
        milestoneId: "11111111-1111-4111-8111-111111111111",
        status: "hit",
      }).success,
    ).toBe(true);
    expect(
      updateTaskStatusSchema.safeParse({
        taskId: "11111111-1111-4111-8111-111111111111",
        status: "done",
      }).success,
    ).toBe(true);
    expect(
      updateTaskStatusSchema.safeParse({
        taskId: "11111111-1111-4111-8111-111111111111",
        status: "completed",
      }).success,
    ).toBe(false);
  });
});
