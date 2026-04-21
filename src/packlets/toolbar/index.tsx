/**
 * Ribbon-style toolbar component.
 *
 * Displays groups of toolbar buttons with labels below each group.
 * Layout: two rows — buttons on top, labels on bottom.
 * Groups are separated by vertical dividers.
 */

import {
  Box,
  Flex,
  Text,
  DropdownMenu,
  SegmentedControl,
  Button,
  Separator,
  Card,
} from "@radix-ui/themes";
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
      <Flex align="center" gap="1" style={{ height: 32 }}>
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
    <Button
      variant="surface"
      size="1"
      color="gray"
      title={label}
      style={{
        width: 32,
        height: 32,
        padding: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: active ? "var(--accent-5)" : undefined,
        color: active ? "var(--accent-11)" : undefined,
      }}
    >
      {icon}
    </Button>
  );
}

function Divider() {
  return <Separator orientation="vertical" style={{ margin: "0 4px" }} />;
}

function TransportDisplay() {
  const items = [
    { label: "Time", value: "00:00.000" },
    { label: "Pulse", value: "0" },
    { label: "Measure", value: "1:1" },
  ];

  return (
    <Card size="1" style={{ height: 32, padding: 0, overflow: "hidden" }}>
      <Flex style={{ height: "100%" }}>
        {items.map((item, i) => (
          <Flex
            key={item.label}
            direction="column"
            align="center"
            justify="center"
            style={{
              flex: 1,
              height: 32,
              padding: "0 8px",
              minWidth: 56,
              borderRight: i < items.length - 1 ? "1px solid var(--gray-5)" : "none",
            }}
          >
            <Text size="1" color="gray" style={{ lineHeight: 1 }}>
              {item.label}
            </Text>
            <Text size="2" weight="bold" style={{ fontFamily: "monospace", lineHeight: 1 }}>
              {item.value}
            </Text>
          </Flex>
        ))}
      </Flex>
    </Card>
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
          <SegmentedControl.Root
            defaultValue="select"
            variant="classic"
            size="1"
            style={{ height: 32 }}
          >
            <SegmentedControl.Item value="select">
              <MousePointer2 size={14} />
            </SegmentedControl.Item>
            <SegmentedControl.Item value="pencil">
              <Pencil size={14} />
            </SegmentedControl.Item>
            <SegmentedControl.Item value="erase">
              <Eraser size={14} />
            </SegmentedControl.Item>
            <SegmentedControl.Item value="pan">
              <Hand size={14} />
            </SegmentedControl.Item>
          </SegmentedControl.Root>
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
