/**
 * @packageDocumentation
 *
 * Ribbon-style toolbar components for the editor. Provides `Toolbar`,
 * `ToolbarGroup`, `ToolbarButton`, `ToolbarDropdown`, `ToolbarDivider`,
 * and `TransportDisplay`.
 */

import { Box, Flex, Text, DropdownMenu, Button, Separator, Card } from "@radix-ui/themes";
import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

interface ToolbarProps {
  children: ReactNode;
}

export function Toolbar({ children }: ToolbarProps) {
  return (
    <Box
      style={{
        borderBottom: "1px solid var(--gray-5)",
        padding: "8px 12px",
        flexShrink: 0,
      }}
    >
      <Flex align="center" gap="0">
        {children}
      </Flex>
    </Box>
  );
}

interface ToolbarGroupProps {
  label: string;
  children: ReactNode;
}

export function ToolbarGroup({ label, children }: ToolbarGroupProps) {
  return (
    <Flex direction="column" align="center" gap="1" px="3">
      <Flex align="center" gap="1" style={{ height: 32 }}>
        {children}
      </Flex>
      <Text size="1" color="gray" weight="medium" style={{ opacity: 0.5, fontSize: 9 }}>
        {label}
      </Text>
    </Flex>
  );
}

export function ToolbarDivider() {
  return <Separator orientation="vertical" style={{ margin: "0 4px" }} />;
}

interface ToolbarButtonProps {
  icon: ReactNode;
  label?: string;
  active?: boolean;
}

export function ToolbarButton({ icon, label, active }: ToolbarButtonProps) {
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

interface DropdownSelectProps {
  value: string;
  options: string[];
  onSelect?: (value: string) => void;
}

export function ToolbarDropdown({ value, options, onSelect }: DropdownSelectProps) {
  return (
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
            {value}
          </Text>
          <ChevronDown size={12} />
        </Box>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content>
        {options.map((option) => (
          <DropdownMenu.Item key={option} onSelect={() => onSelect?.(option)}>
            {option}
          </DropdownMenu.Item>
        ))}
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
}

interface TransportDisplayProps {
  time: string;
  pulse: string;
  measure: string;
}

export function TransportDisplay({ time, pulse, measure }: TransportDisplayProps) {
  const items = [
    { label: "Time", value: time, minWidth: 72 },
    { label: "Pulse", value: pulse, minWidth: 48 },
    { label: "Measure", value: measure, minWidth: 48 },
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
              minWidth: item.minWidth,
              borderRight: i < items.length - 1 ? "1px solid var(--gray-5)" : "none",
            }}
          >
            <Text size="1" color="gray" style={{ lineHeight: 1, opacity: 0.4, fontSize: 9 }}>
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
