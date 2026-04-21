/**
 * Global app header component.
 *
 * Displays the "Beat Muser" app title and the current project name
 * when a project is open. Clicking the title navigates back to the
 * project list (with unsaved changes confirmation stubbed as @todo).
 */

import { Box, Flex, Heading, Link } from "@radix-ui/themes";
import { useMatches, useNavigate } from "react-router";
import type { Project } from "../project-store/types";

/**
 * Returns the project data from the current route matches, if any.
 */
function useCurrentProject(): Project | null {
  const matches = useMatches();
  for (const match of matches) {
    const data = match.data as Project | undefined;
    if (data && "displayName" in data && "slug" in data) {
      return data;
    }
  }
  return null;
}

export function AppHeader() {
  const navigate = useNavigate();
  const project = useCurrentProject();

  return (
    <Box px="4" py="2" style={{ borderBottom: "1px solid var(--gray-5)" }}>
      <Flex align="center" gap="2">
        <Link
          onClick={(e) => {
            e.preventDefault();
            // @todo: Check for unsaved changes and confirm before navigating
            // If there are unsaved changes, show a confirmation dialog.
            // If the user confirms, navigate to home. Otherwise, do nothing.
            void navigate("/");
          }}
          href="/"
          style={{ textDecoration: "none", cursor: "pointer" }}
        >
          <Heading size="4" style={{ margin: 0 }}>
            Beat Muser
          </Heading>
        </Link>
        {project && (
          <>
            <Heading size="4" color="gray" style={{ margin: 0 }}>
              /
            </Heading>
            <Heading size="4" style={{ margin: 0 }}>
              {project.displayName}
            </Heading>
          </>
        )}
      </Flex>
    </Box>
  );
}
