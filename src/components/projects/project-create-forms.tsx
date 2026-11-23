"use client";

import { useMemo, useState } from "react";
import { ActionForm } from "@/components/forms/action-form";
import { Field } from "@/components/forms/field";
import { Input } from "@/components/ui/input";
import {
  createMilestoneAction,
  createProjectAction,
  createTaskAction,
} from "@/app/actions/domain";

type ProjectOption = { id: string; title: string };
type MilestoneOption = { id: string; title: string; project_id: string | null };

type ProjectCreateFormsProps = {
  projects: ProjectOption[];
  milestones: MilestoneOption[];
};

const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm";

export function ProjectCreateForms({ projects, milestones }: ProjectCreateFormsProps) {
  const [taskProjectId, setTaskProjectId] = useState("");
  const filteredMilestones = useMemo(() => {
    if (!taskProjectId) {
      return milestones.filter((milestone) => !milestone.project_id);
    }
    return milestones.filter((milestone) => milestone.project_id === taskProjectId);
  }, [milestones, taskProjectId]);

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <section className="space-y-3">
        <h3 className="text-sm font-medium">New project</h3>
        <ActionForm action={createProjectAction} submitLabel="Create project">
          <Field id="ptitle" label="Title">
            <Input id="ptitle" name="title" required />
          </Field>
        </ActionForm>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-medium">New milestone</h3>
        <ActionForm action={createMilestoneAction} submitLabel="Create milestone">
          <Field id="mtitle" label="Title">
            <Input id="mtitle" name="title" required />
          </Field>
          <Field id="mproject" label="Project (optional)">
            <select id="mproject" name="projectId" defaultValue="" className={selectClass}>
              <option value="">Standalone (no project)</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.title}
                </option>
              ))}
            </select>
          </Field>
        </ActionForm>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-medium">New task</h3>
        <ActionForm action={createTaskAction} submitLabel="Create task">
          <Field id="ttitle" label="Title">
            <Input id="ttitle" name="title" required />
          </Field>
          <Field id="tproject" label="Project (optional)">
            <select
              id="tproject"
              name="projectId"
              value={taskProjectId}
              onChange={(event) => setTaskProjectId(event.target.value)}
              className={selectClass}
            >
              <option value="">Inbox / none</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.title}
                </option>
              ))}
            </select>
          </Field>
          <Field id="tmilestone" label="Milestone (optional)">
            <select id="tmilestone" name="milestoneId" defaultValue="" className={selectClass}>
              <option value="">None</option>
              {filteredMilestones.map((milestone) => (
                <option key={milestone.id} value={milestone.id}>
                  {milestone.title}
                  {!milestone.project_id ? " (standalone)" : ""}
                </option>
              ))}
            </select>
          </Field>
        </ActionForm>
      </section>
    </div>
  );
}
