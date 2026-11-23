import { PageHeader } from "@/components/layout/page-header";
import { DisabledModuleState } from "@/components/modules/disabled-module-state";
import { EmptyState } from "@/components/states/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProjectCreateForms } from "@/components/projects/project-create-forms";
import { ProjectHierarchyView } from "@/components/projects/project-hierarchy";
import { getSessionModuleGating } from "@/modules/modules/gating";
import { buildProjectHierarchy } from "@/modules/projects/relationships";
import {
  listMilestones,
  listProjects,
  listTasks,
} from "@/modules/projects/service";

export const metadata = {
  title: "Projects",
};

export default async function ProjectsPage() {
  const gating = await getSessionModuleGating();
  const workspace = gating.projects;

  if (gating.status === "ok" && !workspace.workspaceActive) {
    return (
      <div className="space-y-8">
        <PageHeader
          title="Projects"
          description="Projects, milestones, and tasks as separate linked entities — hierarchy, status tracking, and inbox."
        />
        <DisabledModuleState
          title="Projects workspace is inactive"
          description="Projects, milestones, and tasks are all turned off for the current chapter (or globally when no chapter is current). Activate at least one of those modules from Chapters to use this workspace. Existing records are kept — activation only controls availability."
        />
      </div>
    );
  }

  const projects = await listProjects();
  const milestones = await listMilestones();
  const tasks = await listTasks();

  const loadError =
    (!projects.ok && projects.message) ||
    (!milestones.ok && milestones.message) ||
    (!tasks.ok && tasks.message) ||
    null;

  const tree =
    projects.ok && milestones.ok && tasks.ok
      ? buildProjectHierarchy({
          projects: projects.data,
          milestones: milestones.data,
          tasks: tasks.data,
        })
      : null;

  const partialNotice =
    gating.status === "ok" &&
    workspace.workspaceActive &&
    !(workspace.projectsActive && workspace.milestonesActive && workspace.tasksActive);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Projects"
        description="Projects, milestones, and tasks as separate linked entities — hierarchy, status tracking, and inbox."
      />

      {partialNotice ? (
        <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          Some workspace modules are inactive. Existing linked records stay visible for context;
          creation and status changes are disabled for inactive entity types only.
        </p>
      ) : null}

      {loadError ? (
        <EmptyState title="Projects unavailable" description={loadError} />
      ) : tree ? (
        <Card>
          <CardHeader>
            <CardTitle>Workspace</CardTitle>
          </CardHeader>
          <CardContent>
            <ProjectHierarchyView tree={tree} gating={workspace} />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Create</CardTitle>
        </CardHeader>
        <CardContent>
          <ProjectCreateForms
            projects={projects.ok ? projects.data.map((p) => ({ id: p.id, title: p.title })) : []}
            milestones={
              milestones.ok
                ? milestones.data.map((m) => ({
                    id: m.id,
                    title: m.title,
                    project_id: m.project_id,
                  }))
                : []
            }
            gating={workspace}
          />
        </CardContent>
      </Card>
    </div>
  );
}
