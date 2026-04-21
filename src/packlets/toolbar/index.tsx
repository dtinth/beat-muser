/**
 * Ribbon-style toolbar component.
 *
 * Displays groups of toolbar buttons with labels below each group.
 * Layout: two rows — buttons on top, labels on bottom.
 * Groups are separated by vertical dividers.
 */

import { Box, Flex, Text, DropdownMenu } from "@radix-ui/themes";
import {
  MousePointer2,
  Pencil,
  Eraser,
  Hand,
  Undo2,
  Redo2,
  Save,
  Play,
  Pause,
  ZoomOut,
  ZoomIn,
  ChevronDown,
} from "lucide-react";
import type { ReactNode } from "react";

interface ToolbarGroupProps {
  label: string;
  children: ReactNode;
}

function ToolbarGroup({ label, children }: ToolbarGroupProps) {
  return (
    <Flex direction="column" align="center" gap="1" px="3">
      <Flex align="center" gap="1">
        {children}
      </Flex>
      <Text size="1" color="gray" weight="medium">
        {label}
      </Text>
    </Flex>
  );
}

interface ToolbarButtonProps {
  icon: ReactNode;
  label?: string;
  active?: boolean;
}

function ToolbarButton({ icon, label, active }: ToolbarButtonProps) {
  return (
    <Box
      role="button"
      tabIndex={0}
      title={label}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 32,
        height: 32,
        borderRadius: 4,
        border: "none",
        background: active ? "var(--accent-5)" : "transparent",
        color: active ? "var(--accent-11)" : "var(--gray-11)",
        cursor: "pointer",
        transition: "background 100ms, color 100ms",
      }}
      onMouseEnter={(e) => {
        if (!active) {
          (e.currentTarget as HTMLElement).style.background = "var(--gray-3)";
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          (e.currentTarget as HTMLElement).style.background = "transparent";
        }
      }}
    >
      {icon}
    </Box>
  );
}

function Divider() {
  return (
    <Box
      style={{
        width: 1,
        height: 40,
        background: "var(--gray-5)",
        margin: "0 4px",
        alignSelf: "center",
      }}
    />
  );
}

function TransportDisplay() {
  return (
    <Flex gap="3" px="2" align="center">
      {[
        { label: "Time", value: "00:00.000" },
        { label: "Pulse", value: "0" },
        { label: "Measure", value: "1:1" },
      ].map((item) => (
        <Flex key={item.label} direction="column" align="center">
          <Text size="1" color="gray">
            {item.label}
          </Text>
          <Text size="2" weight="bold" style={{ fontFamily: "monospace" }}>
            {item.value}
          </Text>
        </Flex>
      ))}
    </Flex>
  );
}

export function Toolbar() {
  return (
    <Box
      style={{
        borderBottom: "1px solid var(--gray-5)",
        padding: "8px 12px",
        flexShrink: 0,
      }}
    >
      <Flex align="center" gap="0">
        {/* Mode group */}
        <ToolbarGroup label="Mode">
          <ToolbarButton icon={<MousePointer2 size={16} />} label="Select" active />
          <ToolbarButton icon={<Pencil size={16} />} label="Pencil" />
          <ToolbarButton icon={<Eraser size={16} />} label="Erase" />
          <ToolbarButton icon={<Hand size={16} />} label="Pan" />
        </ToolbarGroup>

        <Divider />

        {/* History group */}
        <ToolbarGroup label="History">
          <ToolbarButton icon={<Undo2 size={16} />} label="Undo" />
          <ToolbarButton icon={<Redo2 size={16} />} label="Redo" />
          <ToolbarButton icon={<Save size={16} />} label="Save" />
        </ToolbarGroup>

        <Divider />

        {/* Transport group */}
        <ToolbarGroup label="Transport">
          <ToolbarButton icon={<Play size={16} />} label="Play" />
          <ToolbarButton icon={<Pause size={16} />} label="Pause" />
          <TransportDisplay />
        </ToolbarGroup>

        <Divider />

        {/* Snap group */}
        <ToolbarGroup label="Snap">
          <DropdownMenu.Root>
            <DropdownMenu.Trigger>
              <Box
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 2,
                  minWidth: 56,
                  height: 32,
                  borderRadius: 4,
                  background: "var(--gray-3)",
                  color: "var(--gray-11)",
                  cursor: "pointer",
                  padding: "0 8px",
                }}
              >
                <Text size="2" weight="bold" style={{ fontFamily: "monospace" }}>
                  1/16
                </Text>
                <ChevronDown size={12} />
              </Box>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content>
              {["1/1", "1/2", "1/4", "1/8", "1/12", "1/16", "1/32", "1/64"].map((snap) => (
                <DropdownMenu.Item key={snap} onSelect={() => {}}>
                  {snap}
                </DropdownMenu.Item>
              ))}
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        </ToolbarGroup>

        <Divider />

        {/* Zoom group */}
        <ToolbarGroup label="Zoom">
          <ToolbarButton icon={<ZoomOut size={16} />} label="Zoom Out" />
          <DropdownMenu.Root>
            <DropdownMenu.Trigger>
              <Box
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 2,
                  minWidth: 56,
                  height: 32,
                  borderRadius: 4,
                  background: "var(--gray-3)",
                  color: "var(--gray-11)",
                  cursor: "pointer",
                  padding: "0 8px",
                }}
              >
                <Text size="2" weight="bold" style={{ fontFamily: "monospace" }}>
                  100%
                </Text>
                <ChevronDown size={12} />
              </Box>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content>
              {["25%", "50%", "75%", "100%", "125%", "150%", "200%", "400%"].map((zoom) => (
                <DropdownMenu.Item key={zoom} onSelect={() => {}}>
                  {zoom}
                </DropdownMenu.Item>
              ))}
            </DropdownMenu.Content>
          </DropdownMenu.Root>
          <ToolbarButton icon={<ZoomIn size={16} />} label="Zoom In" />
        </ToolbarGroup>
      </Flex>
    </Box>
  );
}
