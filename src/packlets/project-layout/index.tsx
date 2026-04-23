/**
 * @packageDocumentation
 *
 * Fixed full-viewport layout shell for the editor. Composes a toolbar,
 * left/right sidebar panels, a central timeline area, and a status bar
 * via ReactNode props.
 *
 * When a prop is not provided, its corresponding section is excluded from
 * the layout entirely (no placeholder DOM nodes).
 */

import { Box, Flex } from "@radix-ui/themes";
import type { ReactNode } from "react";

interface ProjectLayoutProps {
  toolbar?: ReactNode;
  leftPanels?: ReactNode;
  timeline?: ReactNode;
  rightPanels?: ReactNode;
  statusBar?: ReactNode;
}

export function ProjectLayout({
  toolbar,
  leftPanels,
  timeline,
  rightPanels,
  statusBar,
}: ProjectLayoutProps) {
  return (
    <Flex
      direction="column"
      style={{
        width: "100%",
        height: "100%",
        overflow: "hidden",
      }}
    >
      {/* Toolbar */}
      {toolbar && <Box style={{ flexShrink: 0 }}>{toolbar}</Box>}

      {/* Main area */}
      <Flex style={{ flex: 1, overflow: "hidden" }}>
        {/* Left panels */}
        {leftPanels && (
          <Box
            style={{
              width: 256,
              borderRight: "1px solid var(--gray-5)",
              overflow: "auto",
              flexShrink: 0,
            }}
          >
            {leftPanels}
          </Box>
        )}

        {/* Note chart timeline */}
        {timeline && (
          <Box
            style={{
              flex: 1,
              overflow: "auto",
              padding: "8px 12px",
            }}
          >
            {timeline}
          </Box>
        )}

        {/* Right panels */}
        {rightPanels && (
          <Box
            style={{
              width: 256,
              borderLeft: "1px solid var(--gray-5)",
              padding: "8px 12px",
              overflow: "auto",
              flexShrink: 0,
            }}
          >
            {rightPanels}
          </Box>
        )}
      </Flex>

      {/* Status bar */}
      {statusBar && <Box style={{ flexShrink: 0 }}>{statusBar}</Box>}
    </Flex>
  );
}
