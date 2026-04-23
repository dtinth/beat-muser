/**
 * @packageDocumentation
 *
 * Test page for the ScrollableCanvas component. Accessible at
 * `/test/scrollable-canvas`. Uses the project layout with description on
 * the left, controls on the right, and the canvas in the center.
 */

import { useState } from "react";
import { ScrollableCanvas } from "../scrollable-canvas";
import type {
  ScrollableCanvasBehavior,
  ScrollableCanvasBehaviorFactory,
  ScrollableCanvasContext,
  RenderObject,
  RenderHandle,
} from "../scrollable-canvas";
import { ProjectLayout } from "../project-layout";
import { Button, Flex, Text } from "@radix-ui/themes";
import { SidebarPanel } from "../sidebar-panel";

// ---------------------------------------------------------------------------
// Demo data
// ---------------------------------------------------------------------------

interface BlockData {
  color: string;
  label: string;
}

const BLOCK_HEIGHT = 40;
const BLOCK_GAP = 8;
const BLOCK_WIDTH = 200;
const INITIAL_CONTENT_HEIGHT = 5000;

function createBlockRenderer(): (data: unknown) => RenderHandle<BlockData> {
  return (data: unknown) => {
    const d = data as BlockData;
    const el = document.createElement("div");
    el.style.backgroundColor = d.color;
    el.style.borderRadius = "4px";
    el.style.display = "flex";
    el.style.alignItems = "center";
    el.style.justifyContent = "center";
    el.style.color = "white";
    el.style.fontSize = "14px";
    el.style.fontWeight = "bold";
    el.style.fontFamily = "sans-serif";
    el.textContent = d.label;

    return {
      dom: el,
      update(newData: unknown) {
        const nd = newData as BlockData;
        el.style.backgroundColor = nd.color;
        el.textContent = nd.label;
      },
    };
  };
}

// ---------------------------------------------------------------------------
// Behavior factory
// ---------------------------------------------------------------------------

function createDemoBehavior(
  contentHeightRef: { value: number },
  scrollLogRef: { value: string },
): ScrollableCanvasBehaviorFactory {
  const blockRenderer = createBlockRenderer();

  const colors = [
    "#e74c3c",
    "#3498db",
    "#2ecc71",
    "#f39c12",
    "#9b59b6",
    "#1abc9c",
    "#e67e22",
    "#34495e",
  ];

  return (ctx: ScrollableCanvasContext): ScrollableCanvasBehavior => {
    return {
      getContentSize() {
        return { width: 400, height: contentHeightRef.value };
      },

      getVisibleObjects(): RenderObject[] {
        const objects: RenderObject[] = [];
        const viewportTop = ctx.scrollTop;
        const viewportBottom = ctx.scrollTop + ctx.viewportHeight;

        const firstVisible = Math.max(0, Math.floor(viewportTop / (BLOCK_HEIGHT + BLOCK_GAP)) - 1);
        const lastVisible = Math.ceil(viewportBottom / (BLOCK_HEIGHT + BLOCK_GAP)) + 1;
        const totalBlocks = Math.floor(contentHeightRef.value / (BLOCK_HEIGHT + BLOCK_GAP));

        for (let i = firstVisible; i <= Math.min(lastVisible, totalBlocks - 1); i++) {
          const y = i * (BLOCK_HEIGHT + BLOCK_GAP);
          objects.push({
            key: `block-${i}`,
            x: 100,
            y,
            width: BLOCK_WIDTH,
            height: BLOCK_HEIGHT,
            renderer: blockRenderer,
            data: {
              color: colors[i % colors.length],
              label: `Block ${i}`,
            },
          });
        }

        return objects;
      },

      onScroll(_scrollLeft, scrollTop) {
        scrollLogRef.value = `scrolled to y=${Math.round(scrollTop)}`;
      },

      onPointerEvent(event, contentX, contentY) {
        if (event.type === "pointerdown") {
          scrollLogRef.value = `click at (${Math.round(contentX)}, ${Math.round(contentY)})`;
        }
      },
    };
  };
}

// ---------------------------------------------------------------------------
// Test page component
// ---------------------------------------------------------------------------

export function ScrollableCanvasTestPage() {
  const [contentHeight, setContentHeight] = useState(INITIAL_CONTENT_HEIGHT);
  const [scrollInfo, setScrollInfo] = useState("ready");
  const [domNodeCount, setDomNodeCount] = useState(0);

  const contentHeightRef = { value: contentHeight };
  const scrollLogRef = { value: scrollInfo };

  const behaviorFactory = createDemoBehavior(contentHeightRef, scrollLogRef);

  const handleExtend = () => {
    setContentHeight((h) => h + 1000);
    setScrollInfo(`extended to ${contentHeight + 1000}px`);
  };

  const handleShrink = () => {
    setContentHeight((h) => Math.max(1000, h - 1000));
    setScrollInfo(`shrunk to ${Math.max(1000, contentHeight - 1000)}px`);
  };

  const handleCountNodes = () => {
    const canvas = document.querySelector('[data-testid="scrollable-canvas"]');
    if (canvas) {
      setDomNodeCount(canvas.childElementCount - 1);
    }
  };

  return (
    <ProjectLayout
      leftPanels={
        <SidebarPanel
          tabs={[
            {
              label: "About",
              content: (
                <Flex direction="column" style={{ gap: 8 }}>
                  <Text size="2" weight="bold">
                    ScrollableCanvas Test
                  </Text>
                  <Text size="1" color="gray">
                    This page tests the ScrollableCanvas component in isolation. It renders colored
                    blocks in a scrollable virtual list.
                  </Text>
                  <Text size="1" color="gray">
                    Only visible blocks are real DOM nodes. Scroll to see virtual rendering in
                    action.
                  </Text>
                  <Text size="1" color="gray">
                    Click "Extend" to add 1000px of content height. This tests content shift without
                    flicker.
                  </Text>
                </Flex>
              ),
            },
          ]}
        />
      }
      rightPanels={
        <SidebarPanel
          tabs={[
            {
              label: "Controls",
              content: (
                <Flex direction="column" style={{ gap: 8 }}>
                  <Button size="1" onClick={handleExtend}>
                    Extend +1000px
                  </Button>
                  <Button size="1" onClick={handleShrink}>
                    Shrink -1000px
                  </Button>
                  <Button size="1" onClick={handleCountNodes}>
                    Count DOM nodes
                  </Button>
                  <Text size="1" color="gray">
                    Content height: {contentHeight}px
                  </Text>
                  <Text size="1" color="gray">
                    {scrollInfo}
                  </Text>
                  {domNodeCount > 0 && (
                    <Text size="1" color="gray">
                      DOM nodes in canvas: {domNodeCount}
                    </Text>
                  )}
                </Flex>
              ),
            },
          ]}
        />
      }
      timeline={
        <div data-testid="scrollable-canvas" style={{ width: "100%", height: "100%" }}>
          <ScrollableCanvas behavior={behaviorFactory} />
        </div>
      }
    />
  );
}
