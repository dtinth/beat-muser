/**
 * @packageDocumentation
 *
 * IndexedDB persistence for project metadata (not file contents). Manages
 * the list of known projects with CRUD operations, slug generation, and
 * last-opened tracking.
 */

import { get, set } from "idb-keyval";
import { uuidv7 } from "uuidv7";
import type { Project, ProjectSource } from "./types";
import { slugify } from "./slugify";

const PROJECTS_KEY = "projects";

async function getAllProjects(): Promise<Project[]> {
  return (await get(PROJECTS_KEY)) ?? [];
}

async function saveProjects(projects: Project[]): Promise<void> {
  await set(PROJECTS_KEY, projects);
}

export async function listProjects(): Promise<Project[]> {
  const projects = await getAllProjects();
  return projects.toSorted(
    (a, b) => new Date(b.lastOpenedAt).getTime() - new Date(a.lastOpenedAt).getTime(),
  );
}

export async function addProject(displayName: string, source: ProjectSource): Promise<Project> {
  const projects = await getAllProjects();
  const baseSlug = slugify(displayName);

  let slug = baseSlug;
  let suffix = 1;
  while (projects.some((p) => p.slug === slug)) {
    slug = `${baseSlug}-${suffix}`;
    suffix++;
  }

  const now = new Date().toISOString();
  const project: Project = {
    id: uuidv7(),
    slug,
    displayName,
    source,
    createdAt: now,
    lastOpenedAt: now,
    lastUpdatedAt: now,
  };

  projects.push(project);
  await saveProjects(projects);
  return project;
}

export async function removeProject(slug: string): Promise<void> {
  const projects = await getAllProjects();
  await saveProjects(projects.filter((p) => p.slug !== slug));
}

export async function touchProject(slug: string): Promise<void> {
  const projects = await getAllProjects();
  const project = projects.find((p) => p.slug === slug);
  if (project) {
    project.lastOpenedAt = new Date().toISOString();
    await saveProjects(projects);
  }
}

export async function getProjectBySlug(slug: string): Promise<Project | undefined> {
  const projects = await getAllProjects();
  return projects.find((p) => p.slug === slug);
}

export const DEMO_SLUG = "__demo__";

export function createDemoProject(name: string): Project {
  const now = new Date().toISOString();
  return {
    id: uuidv7(),
    slug: DEMO_SLUG,
    displayName: name,
    source: { provider: "examples", name },
    createdAt: now,
    lastOpenedAt: now,
    lastUpdatedAt: now,
  };
}

export { createDemoProjectFile } from "./demo-project";
