import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/states/empty-state";
import { ActionForm } from "@/components/forms/action-form";
import { Field } from "@/components/forms/field";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  createMilestoneAction,
  createProjectAction,
  createTaskAction,
} from "@/app/actions/domain";
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
  const firstProject = projects.ok ? projects.data[0] : undefined;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Projects"
        description="Projects, milestones, and tasks stay separate concepts with optional same-user links."
      />

      {!projects.ok ? (
        <EmptyState title="Projects unavailable" description={projects.message} />
      ) : projects.data.length === 0 ? (
        <EmptyState
          title="No projects yet"
          description="Create a project, then optional milestones and tasks. Requires applied DEV schema."
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Projects</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {projects.data.map((project) => (
                <div key={project.id}>
                  {project.title} · {project.status}
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Milestones</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {milestones.ok && milestones.data.length > 0 ? (
                milestones.data.map((milestone) => (
                  <div key={milestone.id}>
                    {milestone.title} · {milestone.status}
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground">None yet.</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Tasks</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {tasks.ok && tasks.data.length > 0 ? (
                tasks.data.map((task) => (
                  <div key={task.id}>
                    {task.title} · {task.status}
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground">None yet.</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>New project</CardTitle>
          </CardHeader>
          <CardContent>
            <ActionForm action={createProjectAction} submitLabel="Create project">
              <Field id="title" label="Title">
                <Input id="title" name="title" required />
              </Field>
            </ActionForm>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>New milestone</CardTitle>
          </CardHeader>
          <CardContent>
            <ActionForm action={createMilestoneAction} submitLabel="Create milestone">
              <Field id="mtitle" label="Title">
                <Input id="mtitle" name="title" required />
              </Field>
              {firstProject ? (
                <input type="hidden" name="projectId" value={firstProject.id} />
              ) : null}
            </ActionForm>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>New task</CardTitle>
          </CardHeader>
          <CardContent>
            <ActionForm action={createTaskAction} submitLabel="Create task">
              <Field id="ttitle" label="Title">
                <Input id="ttitle" name="title" required />
              </Field>
              {firstProject ? (
                <input type="hidden" name="projectId" value={firstProject.id} />
              ) : null}
            </ActionForm>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
