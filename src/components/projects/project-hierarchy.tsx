import {
  updateMilestoneStatusAction,
  updateProjectStatusAction,
  updateTaskStatusAction,
} from "@/app/actions/domain";
import { StatusForm } from "@/components/projects/status-form";
import { EmptyState } from "@/components/states/empty-state";
import type { ProjectsWorkspaceGating } from "@/modules/modules/gating";
import type {
  HierarchyRelationshipConflict,
  ProjectHierarchy,
} from "@/modules/projects/relationships";

const PROJECT_STATUSES = [
  { value: "active" },
  { value: "paused" },
  { value: "done" },
  { value: "dropped" },
];

const MILESTONE_STATUSES = [
  { value: "pending" },
  { value: "hit" },
  { value: "missed" },
  { value: "cancelled" },
];

const TASK_STATUSES = [
  { value: "todo" },
  { value: "doing" },
  { value: "done" },
  { value: "cancelled" },
];

type ProjectHierarchyViewProps = {
  tree: ProjectHierarchy;
  gating: Pick<
    ProjectsWorkspaceGating,
    "canManageProjectStatus" | "canManageMilestoneStatus" | "canManageTaskStatus"
  >;
};

function projectLabel(ref: { id: string; title: string } | null): string {
  if (!ref) return "none";
  return `${ref.title} (${ref.id.slice(0, 8)}…)`;
}

function ReadOnlyNote({ label }: { label: string }) {
  return (
    <p className="text-xs text-muted-foreground">
      {label} module inactive — status is read-only. Record kept for relationship context.
    </p>
  );
}

function TaskRow({
  task,
  canManage,
}: {
  task: ProjectHierarchy["inboxTasks"][number];
  canManage: boolean;
}) {
  return (
    <li className="space-y-2 border-b border-border/50 py-2 last:border-0">
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <span>
          {task.title}{" "}
          <span className="text-muted-foreground">· {task.status}</span>
          {task.due_on ? (
            <span className="text-muted-foreground"> · due {task.due_on}</span>
          ) : null}
        </span>
      </div>
      {canManage ? (
        <StatusForm
          action={updateTaskStatusAction}
          hiddenName="taskId"
          hiddenValue={task.id}
          currentStatus={task.status}
          options={TASK_STATUSES}
          submitLabel="Set task"
        />
      ) : (
        <ReadOnlyNote label="Tasks" />
      )}
    </li>
  );
}

function MilestoneBlock({
  milestone,
  canManageMilestone,
  canManageTask,
}: {
  milestone: ProjectHierarchy["standaloneMilestones"][number];
  canManageMilestone: boolean;
  canManageTask: boolean;
}) {
  return (
    <div className="space-y-2 rounded-md border border-border/60 p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <span className="font-medium">
          Milestone · {milestone.title}{" "}
          <span className="font-normal text-muted-foreground">
            · {milestone.status}
            {milestone.target_on ? ` · target ${milestone.target_on}` : ""}
            {milestone.achieved_on ? ` · achieved ${milestone.achieved_on}` : ""}
          </span>
        </span>
      </div>
      {canManageMilestone ? (
        <StatusForm
          action={updateMilestoneStatusAction}
          hiddenName="milestoneId"
          hiddenValue={milestone.id}
          currentStatus={milestone.status}
          options={MILESTONE_STATUSES}
          submitLabel="Set milestone"
        />
      ) : (
        <ReadOnlyNote label="Milestones" />
      )}
      {milestone.tasks.length === 0 ? (
        <p className="text-sm text-muted-foreground">No tasks on this milestone.</p>
      ) : (
        <ul className="ml-2 space-y-1">
          {milestone.tasks.map((task) => (
            <TaskRow key={task.id} task={task} canManage={canManageTask} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ConflictItem({
  conflict,
  canManageTask,
}: {
  conflict: HierarchyRelationshipConflict;
  canManageTask: boolean;
}) {
  const { task, reason, milestone, taskProject, milestoneProject } = conflict;
  const reasonLabel =
    reason === "unresolved_milestone"
      ? "Unresolved milestone reference"
      : "Project / milestone mismatch";

  return (
    <li className="space-y-2 border border-dashed border-destructive/40 bg-destructive/5 p-3">
      <p className="text-sm font-medium">{task.title}</p>
      <p className="text-xs uppercase tracking-wide text-destructive">{reasonLabel}</p>
      <dl className="grid gap-1 text-sm text-muted-foreground">
        <div>
          <dt className="inline font-medium text-foreground">Task status: </dt>
          <dd className="inline">{task.status}</dd>
        </div>
        <div>
          <dt className="inline font-medium text-foreground">Task project_id: </dt>
          <dd className="inline">{projectLabel(taskProject)}</dd>
        </div>
        <div>
          <dt className="inline font-medium text-foreground">Milestone: </dt>
          <dd className="inline">
            {milestone
              ? `${milestone.title} (${milestone.id.slice(0, 8)}…)`
              : `missing (${task.milestone_id?.slice(0, 8) ?? "?"}…)`}
          </dd>
        </div>
        <div>
          <dt className="inline font-medium text-foreground">Milestone project_id: </dt>
          <dd className="inline">{projectLabel(milestoneProject)}</dd>
        </div>
      </dl>
      {canManageTask ? (
        <StatusForm
          action={updateTaskStatusAction}
          hiddenName="taskId"
          hiddenValue={task.id}
          currentStatus={task.status}
          options={TASK_STATUSES}
          submitLabel="Set task"
        />
      ) : (
        <ReadOnlyNote label="Tasks" />
      )}
    </li>
  );
}

export function ProjectHierarchyView({ tree, gating }: ProjectHierarchyViewProps) {
  const empty =
    tree.projects.length === 0 &&
    tree.standaloneMilestones.length === 0 &&
    tree.inboxTasks.length === 0 &&
    tree.relationshipConflicts.length === 0;

  if (empty) {
    return (
      <EmptyState
        title="Nothing here yet"
        description="Create a project, a standalone milestone, or an inbox task to get started."
      />
    );
  }

  return (
    <div className="space-y-8">
      {tree.relationshipConflicts.length > 0 ? (
        <section className="space-y-3 rounded-md border-2 border-dashed border-destructive/50 p-4">
          <h2 className="text-base font-semibold text-destructive">Relationship conflicts</h2>
          <p className="text-sm text-muted-foreground">
            These tasks are not nested under a project or milestone because their stored links
            disagree or point at a missing milestone. They are excluded from progress. No repair
            actions here — fix data separately.
          </p>
          <ul className="space-y-3">
            {tree.relationshipConflicts.map((conflict) => (
              <ConflictItem
                key={conflict.task.id}
                conflict={conflict}
                canManageTask={gating.canManageTaskStatus}
              />
            ))}
          </ul>
        </section>
      ) : null}

      {tree.projects.map((project) => (
        <section key={project.id} className="space-y-3">
          <div className="space-y-2 border-b border-border pb-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-base font-semibold">
                {project.title}{" "}
                <span className="font-normal text-muted-foreground">
                  · {project.status}
                  {project.target_date ? ` · target ${project.target_date}` : ""}
                </span>
              </h2>
              <p className="text-sm text-muted-foreground">
                Progress {project.taskDone}/{project.taskTotal} tasks done
              </p>
            </div>
            {gating.canManageProjectStatus ? (
              <StatusForm
                action={updateProjectStatusAction}
                hiddenName="projectId"
                hiddenValue={project.id}
                currentStatus={project.status}
                options={PROJECT_STATUSES}
                submitLabel="Set project"
              />
            ) : (
              <ReadOnlyNote label="Projects" />
            )}
          </div>

          {project.milestones.length === 0 && project.directTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No milestones or tasks under this project yet.
            </p>
          ) : null}

          <div className="space-y-3">
            {project.milestones.map((milestone) => (
              <MilestoneBlock
                key={milestone.id}
                milestone={milestone}
                canManageMilestone={gating.canManageMilestoneStatus}
                canManageTask={gating.canManageTaskStatus}
              />
            ))}
          </div>

          {project.directTasks.length > 0 ? (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">
                Project tasks (no milestone)
              </h3>
              <ul>
                {project.directTasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    canManage={gating.canManageTaskStatus}
                  />
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ))}

      {tree.standaloneMilestones.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-base font-semibold">Standalone milestones</h2>
          {tree.standaloneMilestones.map((milestone) => (
            <MilestoneBlock
              key={milestone.id}
              milestone={milestone}
              canManageMilestone={gating.canManageMilestoneStatus}
              canManageTask={gating.canManageTaskStatus}
            />
          ))}
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-base font-semibold">Inbox</h2>
        <p className="text-sm text-muted-foreground">
          Tasks not linked to a project or milestone.
        </p>
        {tree.inboxTasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">Inbox is empty.</p>
        ) : (
          <ul>
            {tree.inboxTasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                canManage={gating.canManageTaskStatus}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
