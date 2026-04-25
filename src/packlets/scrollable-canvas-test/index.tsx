/**
 * @packageDocumentation
 *
 * Test page for the ScrollableCanvas component. Accessible at
 * `/test/scrollable-canvas`. Uses a controller + nanostores pattern so
 * the behavior factory is stable and the canvas never remounts.
 *
 * Arrangement mimics VSRG: blocks stack from bottom to top, content
 * height is the bottom edge of the bottommost block, and scroll starts
 * at the bottom.
 */

import { useEffect, useRef, useState } from "react";
import { atom } from "nanostores";
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
// Constants
// ---------------------------------------------------------------------------

const BLOCK_HEIGHT = 40;
const BLOCK_GAP = 8;
const BLOCK_WIDTH = 200;
const INITIAL_BLOCK_COUNT = 125;
const BLOCK_COLORS = [
  "#e74c3c",
  "#3498db",
  "#2ecc71",
  "#f39c12",
  "#9b59b6",
  "#1abc9c",
  "#e67e22",
  "#34495e",
];

// ---------------------------------------------------------------------------
// Renderer
// ---------------------------------------------------------------------------

interface BlockData {
  color: string;
  label: string;
  index: number;
}

function createBlockRenderer(): (data: unknown) => RenderHandle<BlockData> {
  return (data: unknown) => {
    const d = data as BlockData;
    const el = document.createElement("div");
    el.dataset.testid = "test-block";
    el.dataset.index = String(d.index);
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

function getContentHeight(blockCount: number): number {
  if (blockCount <= 0) return 0;
  return blockCount * BLOCK_HEIGHT + (blockCount - 1) * BLOCK_GAP;
}

// ---------------------------------------------------------------------------
// Controller
// ---------------------------------------------------------------------------

class ScrollableCanvasTestController {
  $blockCount = atom(INITIAL_BLOCK_COUNT);
  $scrollInfo = atom("ready");
  $domNodeCount = atom(0);
  $pendingScrollDelta = atom(0);

  behaviorFactory: ScrollableCanvasBehaviorFactory;

  constructor() {
    this.behaviorFactory = this.createBehaviorFactory();
  }

  extend() {
    const delta = 20 * (BLOCK_HEIGHT + BLOCK_GAP);
    this.$blockCount.set(this.$blockCount.get() + 20);
    this.$pendingScrollDelta.set(delta);
    this.$scrollInfo.set(`Extended by 20 blocks (+${delta}px)`);
  }

  shrink() {
    const current = this.$blockCount.get();
    const removeCount = Math.min(20, current);
    if (removeCount === 0) return;
    const delta = -removeCount * (BLOCK_HEIGHT + BLOCK_GAP);
    this.$blockCount.set(current - removeCount);
    this.$pendingScrollDelta.set(delta);
    this.$scrollInfo.set(`Shrunk by ${removeCount} blocks (${delta}px)`);
  }

  countNodes(wrapperEl: HTMLElement | null) {
    if (!wrapperEl) return;
    // wrapperEl -> ScrollableCanvas root -> [sticky layer, scroll layer]
    const root = wrapperEl.firstElementChild as HTMLElement | null;
    if (!root) return;
    const scrollLayer = root.children[1] as HTMLElement | null;
    if (!scrollLayer) return;
    this.$domNodeCount.set(scrollLayer.childElementCount);
  }

  private createBehaviorFactory(): ScrollableCanvasBehaviorFactory {
    const blockRenderer = createBlockRenderer();

    return (ctx: ScrollableCanvasContext): ScrollableCanvasBehavior => {
      const unsubCount = this.$blockCount.subscribe(() => {
        ctx.refresh();
      });

      const unsubDelta = this.$pendingScrollDelta.subscribe((delta: number) => {
        if (delta !== 0) {
          ctx.setScroll({ x: ctx.scrollLeft, y: ctx.scrollTop + delta });
          this.$pendingScrollDelta.set(0);
        }
      });

      return {
        getContentSize: () => {
          const count = this.$blockCount.get();
          return { width: 400, height: getContentHeight(count) };
        },

        onConnected: () => {
          const count = this.$blockCount.get();
          const height = getContentHeight(count);
          if (height > ctx.viewportHeight) {
            ctx.setScroll({ x: ctx.scrollLeft, y: height - ctx.viewportHeight });
          }
        },

        getVisibleObjects: (): RenderObject[] => {
          const count = this.$blockCount.get();
          const height = getContentHeight(count);

          const viewportTop = ctx.scrollTop;
          const viewportBottom = ctx.scrollTop + ctx.viewportHeight;
          const blockSpan = BLOCK_HEIGHT + BLOCK_GAP;

          const objects: RenderObject[] = [];

          // Over-estimate visible range; exact filtering happens below
          const firstVisible = Math.max(0, Math.floor((height - viewportBottom) / blockSpan) - 1);
          const lastVisible = Math.min(
            count - 1,
            Math.ceil((height - viewportTop) / blockSpan) + 1,
          );

          for (let i = firstVisible; i <= lastVisible; i++) {
            const y = height - (i + 1) * BLOCK_HEIGHT - i * BLOCK_GAP;
            if (y + BLOCK_HEIGHT > viewportTop && y < viewportBottom) {
              objects.push({
                key: `block-${i}`,
                x: 100,
                y,
                width: BLOCK_WIDTH,
                height: BLOCK_HEIGHT,
                renderer: blockRenderer,
                data: {
                  color: BLOCK_COLORS[i % BLOCK_COLORS.length],
                  label: `Block ${i}`,
                  index: i,
                },
              });
            }
          }

          return objects;
        },

        onScroll: (_scrollLeft, scrollTop) => {
          this.$scrollInfo.set(`scrolled to y=${Math.round(scrollTop)}`);
        },

        onPointerEvent: (event, contentX, contentY) => {
          if (event.type === "pointerdown") {
            this.$scrollInfo.set(`click at (${Math.round(contentX)}, ${Math.round(contentY)})`);
          }
        },

        [Symbol.dispose]: () => {
          unsubCount();
          unsubDelta();
        },
      };
    };
  }
}

// ---------------------------------------------------------------------------
// React page
// ---------------------------------------------------------------------------

export function ScrollableCanvasTestPage() {
  const [controller] = useState(() => new ScrollableCanvasTestController());
  const wrapperRef = useRef<HTMLDivElement>(null);

  const handleCountNodes = () => controller.countNodes(wrapperRef.current);

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
                    This page tests the ScrollableCanvas component in isolation. Blocks stack from
                    bottom to top like a VSRG timeline.
                  </Text>
                  <Text size="1" color="gray">
                    Only visible blocks are real DOM nodes. Scroll to see virtual rendering in
                    action.
                  </Text>
                  <Text size="1" color="gray">
                    Extend appends 20 blocks at the top; shrink removes 20. Scroll compensation
                    keeps the current view stable.
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
              content: <Controls controller={controller} onCountNodes={handleCountNodes} />,
            },
          ]}
        />
      }
      timeline={
        <div
          ref={wrapperRef}
          data-testid="scrollable-canvas"
          style={{ width: "100%", height: "100%" }}
        >
          <ScrollableCanvas behavior={controller.behaviorFactory} />
        </div>
      }
    />
  );
}

function Controls({
  controller,
  onCountNodes,
}: {
  controller: ScrollableCanvasTestController;
  onCountNodes: () => void;
}) {
  const [scrollInfo, setScrollInfo] = useState(controller.$scrollInfo.get());
  const [domNodeCount, setDomNodeCount] = useState(controller.$domNodeCount.get());

  useEffect(() => {
    const unsubInfo = controller.$scrollInfo.subscribe((v) => setScrollInfo(v));
    const unsubCount = controller.$domNodeCount.subscribe((v) => setDomNodeCount(v));
    return () => {
      unsubInfo();
      unsubCount();
    };
  }, [controller]);

  return (
    <Flex direction="column" style={{ gap: 8 }}>
      <Button size="1" onClick={() => controller.extend()}>
        Extend +20 blocks
      </Button>
      <Button size="1" onClick={() => controller.shrink()}>
        Shrink -20 blocks
      </Button>
      <Button size="1" onClick={onCountNodes}>
        Count DOM nodes
      </Button>
      <Text size="1" color="gray">
        {scrollInfo}
      </Text>
      <Text size="1" color="gray">
        DOM nodes in canvas: {domNodeCount}
      </Text>
    </Flex>
  );
}
