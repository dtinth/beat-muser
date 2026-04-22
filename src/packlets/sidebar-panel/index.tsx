/**
 * @packageDocumentation
 *
 * Tabbed panel component for the editor sidebars. Renders a gradient
 * header with clickable tabs and a content area that switches between
 * the active tab's children.
 */

import { Flex } from "@radix-ui/themes";
import { useState, type ReactNode } from "react";

interface TabDef {
  label: string;
  content: ReactNode;
}

interface SidebarPanelProps {
  tabs: TabDef[];
}

export function SidebarPanel({ tabs }: SidebarPanelProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  return (
    <Flex direction="column" style={{ marginBottom: 16 }}>
      {/* Panel header with gradient */}
      <Flex
        style={{
          padding: "8px 8px 0",
          background: "linear-gradient(to bottom, var(--gray-3), var(--gray-4))",
        }}
      >
        {tabs.map((tab, i) => {
          const isActive = i === activeIndex;
          return (
            <button
              key={tab.label}
              type="button"
              onClick={() => setActiveIndex(i)}
              style={{
                padding: "6px 12px",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                cursor: "pointer",
                border: isActive ? "1px solid var(--gray-4)" : "1px solid transparent",
                borderBottom: "none",
                borderRadius: "4px 4px 0 0",
                background: isActive
                  ? "linear-gradient(to bottom, var(--gray-3), var(--gray-1))"
                  : "transparent",
                color: isActive ? "var(--accent-9)" : "var(--gray-11)",
                outline: "none",
                fontFamily: "inherit",
                lineHeight: 1,
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </Flex>

      {/* Content area */}
      <div
        style={{
          padding: "12px 8px",
          background: "var(--gray-1)",
          borderTop: "1px solid var(--gray-4)",
        }}
      >
        {tabs.map((tab, i) => (
          <div key={i} style={{ display: i === activeIndex ? undefined : "none" }}>
            {tab.content}
          </div>
        ))}
      </div>
    </Flex>
  );
}
