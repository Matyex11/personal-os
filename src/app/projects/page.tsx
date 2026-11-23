import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/states/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProjectCreateForms } from "@/components/projects/project-create-forms";
import { ProjectHierarchyView } from "@/components/projects/project-hierarchy";
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

  return (
    <div className="space-y-8">
      <PageHeader
        title="Projects"
        description="Projects, milestones, and tasks as separate linked entities — hierarchy, status tracking, and inbox."
      />

      {loadError ? (
        <EmptyState title="Projects unavailable" description={loadError} />
      ) : tree ? (
        <Card>
          <CardHeader>
            <CardTitle>Workspace</CardTitle>
          </CardHeader>
          <CardContent>
            <ProjectHierarchyView tree={tree} />
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
          />
        </CardContent>
      </Card>
    </div>
  );
}
