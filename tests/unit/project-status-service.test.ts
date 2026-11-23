import { beforeEach, describe, expect, it, vi } from "vitest";

const requireUser = vi.fn();
const createClient = vi.fn();
const getProfileTimeZone = vi.fn();

vi.mock("@/lib/auth/require-user", () => ({
  requireUser: () => requireUser(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => createClient(),
}));

vi.mock("@/modules/habits/service", () => ({
  getProfileTimeZone: () => getProfileTimeZone(),
}));

import {
  createTask,
  updateMilestoneStatus,
  updateProjectStatus,
  updateTaskStatus,
} from "@/modules/projects/service";

const userId = "11111111-1111-4111-8111-111111111111";
const projectId = "22222222-2222-4222-8222-222222222222";
const milestoneId = "33333333-3333-4333-8333-333333333333";
const taskId = "44444444-4444-4444-8444-444444444444";

describe("project status services", () => {
  beforeEach(() => {
    requireUser.mockReset();
    createClient.mockReset();
    getProfileTimeZone.mockReset();
    requireUser.mockResolvedValue({ id: userId, email: "a@example.com" });
    getProfileTimeZone.mockResolvedValue("Europe/Bucharest");
  });

  it("rejects project status update for non-owned project", async () => {
    createClient.mockResolvedValue({
      from() {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: null, error: null }),
              }),
            }),
          }),
        };
      },
    });
    const result = await updateProjectStatus({
      projectId,
      status: "done",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/not found/i);
  });

  it("sets and clears task completed_at with status", async () => {
    let stored: {
      status: string;
      completed_at: string | null;
    } = { status: "todo", completed_at: null };

    createClient.mockResolvedValue({
      from() {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: {
                    id: taskId,
                    user_id: userId,
                    project_id: null,
                    milestone_id: null,
                    title: "T",
                    notes: null,
                    status: stored.status,
                    due_on: null,
                    completed_at: stored.completed_at,
                  },
                  error: null,
                }),
              }),
            }),
          }),
          update: (patch: { status: string; completed_at: string | null }) => ({
            eq: () => ({
              eq: () => ({
                select: () => ({
                  maybeSingle: async () => {
                    stored = {
                      status: patch.status,
                      completed_at: patch.completed_at,
                    };
                    return {
                      data: {
                        id: taskId,
                        user_id: userId,
                        title: "T",
                        ...stored,
                        project_id: null,
                        milestone_id: null,
                        notes: null,
                        due_on: null,
                      },
                      error: null,
                    };
                  },
                }),
              }),
            }),
          }),
        };
      },
    });

    const done = await updateTaskStatus({ taskId, status: "done" });
    expect(done.ok).toBe(true);
    if (done.ok) {
      expect(done.data.status).toBe("done");
      expect(done.data.completed_at).toBeTruthy();
    }

    const reopen = await updateTaskStatus({ taskId, status: "todo" });
    expect(reopen.ok).toBe(true);
    if (reopen.ok) {
      expect(reopen.data.status).toBe("todo");
      expect(reopen.data.completed_at).toBeNull();
    }
  });

  it("sets and clears milestone achieved_on with hit transitions", async () => {
    let stored = {
      status: "pending",
      achieved_on: null as string | null,
    };

    createClient.mockResolvedValue({
      from() {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: {
                    id: milestoneId,
                    user_id: userId,
                    project_id: projectId,
                    title: "M",
                    description: null,
                    target_on: null,
                    status: stored.status,
                    achieved_on: stored.achieved_on,
                  },
                  error: null,
                }),
              }),
            }),
          }),
          update: (patch: { status: string; achieved_on: string | null }) => ({
            eq: () => ({
              eq: () => ({
                select: () => ({
                  maybeSingle: async () => {
                    stored = {
                      status: patch.status,
                      achieved_on: patch.achieved_on,
                    };
                    return {
                      data: {
                        id: milestoneId,
                        user_id: userId,
                        project_id: projectId,
                        title: "M",
                        description: null,
                        target_on: null,
                        ...stored,
                      },
                      error: null,
                    };
                  },
                }),
              }),
            }),
          }),
        };
      },
    });

    const hit = await updateMilestoneStatus({
      milestoneId,
      status: "hit",
    });
    expect(hit.ok).toBe(true);
    if (hit.ok) {
      expect(hit.data.status).toBe("hit");
      expect(hit.data.achieved_on).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }

    const leave = await updateMilestoneStatus({
      milestoneId,
      status: "missed",
    });
    expect(leave.ok).toBe(true);
    if (leave.ok) {
      expect(leave.data.status).toBe("missed");
      expect(leave.data.achieved_on).toBeNull();
    }
  });

  it("derives project from milestone on createTask and rejects bad ownership", async () => {
    createClient.mockResolvedValue({
      from(table: string) {
        if (table === "milestones") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: async () => ({
                    data: {
                      id: milestoneId,
                      user_id: userId,
                      project_id: projectId,
                      title: "M",
                      description: null,
                      status: "pending",
                      target_on: null,
                      achieved_on: null,
                    },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "tasks") {
          return {
            insert: (row: { project_id: string | null; milestone_id: string | null }) => ({
              select: () => ({
                single: async () => ({
                  data: {
                    id: taskId,
                    user_id: userId,
                    title: "Derived",
                    notes: null,
                    status: "todo",
                    due_on: null,
                    completed_at: null,
                    project_id: row.project_id,
                    milestone_id: row.milestone_id,
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        throw new Error(table);
      },
    });

    const result = await createTask({
      title: "Derived",
      milestoneId,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.project_id).toBe(projectId);
      expect(result.data.milestone_id).toBe(milestoneId);
    }
  });

  it("rejects createTask when milestone is not owned", async () => {
    createClient.mockResolvedValue({
      from() {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: null, error: null }),
              }),
            }),
          }),
        };
      },
    });
    const result = await createTask({
      title: "X",
      milestoneId,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/not found/i);
  });

  it("rejects createTask when project and milestone are inconsistent", async () => {
    const otherProjectId = "55555555-5555-4555-8555-555555555555";
    createClient.mockResolvedValue({
      from(table: string) {
        if (table === "milestones") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: async () => ({
                    data: {
                      id: milestoneId,
                      user_id: userId,
                      project_id: otherProjectId,
                      title: "M",
                      description: null,
                      status: "pending",
                      target_on: null,
                      achieved_on: null,
                    },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "projects") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: async () => ({
                    data: {
                      id: projectId,
                      user_id: userId,
                      title: "P",
                      description: null,
                      status: "active",
                      priority: null,
                      target_date: null,
                      chapter_id: null,
                    },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        throw new Error(`unexpected insert for ${table}`);
      },
    });

    const result = await createTask({
      title: "Bad link",
      projectId,
      milestoneId,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toMatch(/does not belong/i);
    }
  });
});
