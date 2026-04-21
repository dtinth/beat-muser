import { useEffect } from "react";
import { Box, Heading } from "@radix-ui/themes";
import { useParams, useRouteError } from "react-router";
import { useToast } from "../toast";

export function ProjectViewPage() {
  const { slug } = useParams<{ slug: string }>();
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

  return (
    <Box p="4">
      <Heading size="6">{slug}</Heading>
    </Box>
  );
}
