import { Flex, Text } from "@radix-ui/themes";
import type { ReactNode } from "react";

interface SidebarPanelProps {
  title: string;
  children: ReactNode;
}

export function SidebarPanel({ title, children }: SidebarPanelProps) {
  return (
    <Flex direction="column" style={{ gap: 8 }}>
      <Text
        size="1"
        weight="bold"
        style={{
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          padding: "6px 8px",
          backgroundColor: "var(--gray-3)",
          borderRadius: 4,
        }}
      >
        {title}
      </Text>
      {children}
    </Flex>
  );
}
