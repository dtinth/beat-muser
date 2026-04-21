/**
 * Project layout with toolbar, panels, timeline, and status bar.
 *
 * Layout structure:
 * - Toolbar (top, full width)
 * - Main area (flex, fills remaining height):
 *   - Left panels (256px fixed width)
 *   - Note chart timeline (flex, fills remaining width)
 *   - Right panels (256px fixed width)
 * - Status bar (bottom, full width)
 */

import { Box, Flex, Text } from "@radix-ui/themes";
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
      <Box style={{ flexShrink: 0 }}>
        {toolbar ?? (
          <Text size="2" color="gray" style={{ padding: "8px 12px" }}>
            Toolbar
          </Text>
        )}
      </Box>

      {/* Main area */}
      <Flex style={{ flex: 1, overflow: "hidden" }}>
        {/* Left panels */}
        <Box
          style={{
            width: 256,
            borderRight: "1px solid var(--gray-5)",
            padding: "8px 12px",
            overflow: "auto",
            flexShrink: 0,
          }}
        >
          {leftPanels ?? (
            <Text size="2" color="gray">
              Left Panels
            </Text>
          )}
        </Box>

        {/* Note chart timeline */}
        <Box
          style={{
            flex: 1,
            overflow: "auto",
            padding: "8px 12px",
          }}
        >
          {timeline ?? (
            <Text size="2" color="gray">
              Note Chart Timeline
            </Text>
          )}
        </Box>

        {/* Right panels */}
        <Box
          style={{
            width: 256,
            borderLeft: "1px solid var(--gray-5)",
            padding: "8px 12px",
            overflow: "auto",
            flexShrink: 0,
          }}
        >
          {rightPanels ?? (
            <Text size="2" color="gray">
              Right Panels
            </Text>
          )}
        </Box>
      </Flex>

      {/* Status bar */}
      <Box style={{ flexShrink: 0 }}>
        {statusBar ?? (
          <Text size="1" color="gray" style={{ padding: "4px 12px" }}>
            Status Bar
          </Text>
        )}
      </Box>
    </Flex>
  );
}
