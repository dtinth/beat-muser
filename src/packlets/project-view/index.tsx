import { useEffect } from "react";
import { useParams, useRouteError } from "react-router";
import { useToast } from "../toast";
import { ProjectLayout } from "../project-layout";
import { Toolbar } from "../toolbar";

export function ProjectViewPage() {
  const { slug: _slug } = useParams<{ slug: string }>();
  const error = useRouteError() as Error | undefined;
  const { showError } = useToast();

  useEffect(() => {
    if (error) {
      showError({
        title: "Failed to load project",
        description: error.message,
      });
    }
  }, [error, showError]);

  return <ProjectLayout toolbar={<Toolbar />} />;
}
