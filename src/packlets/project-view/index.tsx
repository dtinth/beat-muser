/**
 * @packageDocumentation
 *
 * Main editor page for a loaded project. Wraps `ProjectLayout` with the
 * editor toolbar, chart panels, and a ScrollableCanvas timeline.
 */

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouteError, useLoaderData } from "react-router";
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
  Plus,
  Eye,
  EyeOff,
  Trash2,
} from "lucide-react";
import { Flex, Text } from "@radix-ui/themes";
import { useToast } from "../toast";
import { ProjectLayout } from "../project-layout";
import {
  Toolbar,
  ToolbarGroup,
  ToolbarDivider,
  ToolbarButton,
  ToolbarDropdown,
  TransportDisplay,
} from "../toolbar";
import { SidebarPanel } from "../sidebar-panel";
import { ScrollableCanvas } from "../scrollable-canvas";
import { EditorController } from "../editor-core";
import type { ProjectFile } from "../project-format";
import { createTimelineBehaviorFactory } from "./timeline-behavior";
import { globalCommandRegistry, CommandSet, KeyboardShortcutHandler } from "../command-registry";

function Field({ label, value }: { label: string; value: string }) {
  return (
    <Flex direction="column" style={{ gap: 2 }}>
      <Text size="1" color="gray">
        {label}
      </Text>
      <Text size="2">{value}</Text>
    </Flex>
  );
}

const mockCharts = [
  { name: "ANOTHER", level: "12" },
  { name: "HYPER", level: "10" },
  { name: "NORMAL", level: "7" },
];

const mockChartInfo = {
  difficulty: "ANOTHER",
  level: "12",
  charter: "@vexcalibur",
};

const mockChartStats = {
  totalNotes: "2,418",
  longNotes: "142",
  peakNPS: "18.4",
  measures: "082",
  bpmRange: "96 — 384",
};

function RightPanels({ controller }: { controller: EditorController }) {
  const [levels, setLevels] = useState(() =>
    controller.getLevelsForChart(controller.$selectedChartId.get() ?? ""),
  );
  const [visibleIds, setVisibleIds] = useState(() => controller.$visibleLevelIds.get());

  useEffect(() => {
    const unsub = controller.$visibleLevelIds.subscribe((ids) => {
      setVisibleIds(ids);
      setLevels(controller.getLevelsForChart(controller.$selectedChartId.get() ?? ""));
    });
    return unsub;
  }, [controller]);

  const chartId = controller.$selectedChartId.get();

  return (
    <Flex direction="column">
      <SidebarPanel
        tabs={[
          {
            label: "Levels",
            content: (
              <>
                <Flex direction="column" style={{ gap: 4 }}>
                  {levels.map((level) => (
                    <Flex
                      key={level.id}
                      justify="between"
                      align="center"
                      style={{
                        padding: "4px 8px",
                        borderRadius: 4,
                        backgroundColor: level.visible ? "var(--accent-3)" : "transparent",
                      }}
                    >
                      <Flex align="center" style={{ gap: 8 }}>
                        <Text size="2">{level.name}</Text>
                        <Text size="1" color="gray">
                          {level.mode}
                        </Text>
                      </Flex>
                      <Flex align="center" style={{ gap: 4 }}>
                        <div
                          style={{ cursor: "pointer" }}
                          onClick={() => controller.toggleLevelVisibility(level.id)}
                        >
                          {visibleIds.has(level.id) ? <Eye size={14} /> : <EyeOff size={14} />}
                        </div>
                        <div
                          style={{ cursor: "pointer" }}
                          onClick={() => controller.removeLevel(level.id)}
                        >
                          <Trash2 size={14} />
                        </div>
                      </Flex>
                    </Flex>
                  ))}
                </Flex>
                {chartId && (
                  <Flex
                    justify="center"
                    align="center"
                    style={{
                      marginTop: 8,
                      padding: "4px 8px",
                      borderRadius: 4,
                      cursor: "pointer",
                      border: "1px dashed var(--gray-6)",
                    }}
                    onClick={() => controller.addLevel(chartId, "New Level", "beat-7k")}
                  >
                    <Plus size={14} style={{ marginRight: 4 }} />
                    <Text size="1" color="gray">
                      Add Level
                    </Text>
                  </Flex>
                )}
              </>
            ),
          },
        ]}
      />
    </Flex>
  );
}

function LeftPanels({ project }: { project: ProjectFile }) {
  return (
    <Flex direction="column">
      <SidebarPanel
        tabs={[
          {
            label: "Project Information",
            content: (
              <>
                <Field label="Title" value={project.metadata.title} />
                <Field label="Artist" value={project.metadata.artist} />
                <Field label="Genre" value={project.metadata.genre} />
              </>
            ),
          },
        ]}
      />

      <SidebarPanel
        tabs={[
          {
            label: "Chart List",
            content: (
              <>
                <Flex direction="column" style={{ gap: 4 }}>
                  {mockCharts.map((chart) => (
                    <Flex
                      key={chart.name}
                      justify="between"
                      align="center"
                      style={{
                        padding: "4px 8px",
                        borderRadius: 4,
                        cursor: "pointer",
                        backgroundColor:
                          chart.name === mockChartInfo.difficulty
                            ? "var(--accent-3)"
                            : "transparent",
                      }}
                    >
                      <Text size="2">{chart.name}</Text>
                      <Text size="1" color="gray">
                        Lv. {chart.level}
                      </Text>
                    </Flex>
                  ))}
                </Flex>
                <Flex
                  justify="center"
                  style={{
                    marginTop: 8,
                    padding: "4px 8px",
                    borderRadius: 4,
                    cursor: "pointer",
                    border: "1px dashed var(--gray-6)",
                  }}
                >
                  <Plus size={14} style={{ marginRight: 4 }} />
                  <Text size="1" color="gray">
                    Add Chart
                  </Text>
                </Flex>
              </>
            ),
          },
        ]}
      />

      <SidebarPanel
        tabs={[
          {
            label: "Chart Info",
            content: (
              <>
                <Field label="Difficulty" value={mockChartInfo.difficulty} />
                <Field label="Level" value={mockChartInfo.level} />
                <Field label="Charter" value={mockChartInfo.charter} />
              </>
            ),
          },
          {
            label: "Stats",
            content: (
              <>
                <Field label="Total notes" value={mockChartStats.totalNotes} />
                <Field label="Long notes" value={mockChartStats.longNotes} />
                <Field label="Peak NPS" value={mockChartStats.peakNPS} />
                <Field label="Measures" value={mockChartStats.measures} />
                <Field label="BPM range" value={mockChartStats.bpmRange} />
              </>
            ),
          },
        ]}
      />
    </Flex>
  );
}

export function ProjectViewPage() {
  const { slug: _slug } = useParams<{ slug: string }>();
  const project = useLoaderData() as ProjectFile;
  const error = useRouteError() as Error | undefined;
  const { showError } = useToast();

  const [controller] = useState(() => new EditorController({ project }));

  useEffect(() => {
    const commands = new CommandSet();
    commands.add({
      id: "zoomIn",
      title: "Zoom In",
      shortcut: "Equal",
      execute: () => controller.zoomIn(),
    });
    commands.add({
      id: "zoomOut",
      title: "Zoom Out",
      shortcut: "Minus",
      execute: () => controller.zoomOut(),
    });
    const unregister = commands.registerTo(globalCommandRegistry);
    const handler = new KeyboardShortcutHandler({
      registry: globalCommandRegistry,
    });

    const onKeyDown = (e: KeyboardEvent) => handler.onKeyDown(e);
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      handler.dispose();
      unregister();
    };
  }, [controller]);

  const behaviorFactory = useMemo(() => createTimelineBehaviorFactory(controller), [controller]);

  const [cursorPulse, setCursorPulse] = useState(controller.$cursorPulse.get());
  useEffect(() => {
    const unsub = controller.$cursorPulse.subscribe(setCursorPulse);
    return unsub;
  }, [controller]);

  const [snap, setSnap] = useState(controller.$snap.get());
  useEffect(() => {
    const unsub = controller.$snap.subscribe(setSnap);
    return unsub;
  }, [controller]);

  const [zoom, setZoom] = useState(controller.$zoom.get());
  useEffect(() => {
    const unsub = controller.$zoom.subscribe(setZoom);
    return unsub;
  }, [controller]);

  const zoomPercent = `${Math.round(zoom * 100)}%`;

  const engine = controller.getTimingEngine();
  const timeStr = engine.formatTime(engine.pulseToSeconds(cursorPulse));

  const measureInfo = engine.getMeasureAtPulse(cursorPulse);
  const beatLength = 240; // 1 quarter note = PPQN
  const beat = Math.floor((cursorPulse - measureInfo.measureStart) / beatLength) + 1;
  const measureStr = `${measureInfo.measureIndex + 1}:${beat}`;

  useEffect(() => {
    if (error) {
      showError({
        title: "Failed to load project",
        description: error.message,
      });
    }
  }, [error, showError]);

  return (
    <ProjectLayout
      leftPanels={<LeftPanels project={project} />}
      rightPanels={<RightPanels controller={controller} />}
      toolbar={
        <Toolbar>
          <ToolbarGroup label="Mode">
            <ToolbarButton icon={<MousePointer2 size={16} />} label="Select" active />
            <ToolbarButton icon={<Pencil size={16} />} label="Pencil" />
            <ToolbarButton icon={<Eraser size={16} />} label="Erase" />
            <ToolbarButton icon={<Hand size={16} />} label="Pan" />
          </ToolbarGroup>

          <ToolbarDivider />

          <ToolbarGroup label="History">
            <ToolbarButton icon={<Undo2 size={16} />} label="Undo" />
            <ToolbarButton icon={<Redo2 size={16} />} label="Redo" />
            <ToolbarButton icon={<Save size={16} />} label="Save" />
          </ToolbarGroup>

          <ToolbarDivider />

          <ToolbarGroup label="Transport">
            <ToolbarButton icon={<Play size={16} />} label="Play" />
            <ToolbarButton icon={<Pause size={16} />} label="Pause" />
            <TransportDisplay time={timeStr} pulse={String(cursorPulse)} measure={measureStr} />
          </ToolbarGroup>

          <ToolbarDivider />

          <ToolbarGroup label="Snap">
            <ToolbarDropdown
              value={snap}
              options={["1/4", "1/8", "1/12", "1/16", "1/24", "1/32", "1/48", "1/64"]}
              onSelect={(value) => controller.setSnap(value)}
            />
          </ToolbarGroup>

          <ToolbarDivider />

          <ToolbarGroup label="Zoom">
            <ToolbarButton
              icon={<ZoomOut size={16} />}
              label="Zoom Out"
              onClick={() => globalCommandRegistry.execute("zoomOut")}
            />
            <ToolbarDropdown
              value={zoomPercent}
              options={["25%", "50%", "75%", "100%", "125%", "150%", "200%", "400%"]}
              onSelect={(value) => {
                const pct = parseInt(value.replace("%", ""), 10);
                controller.setZoom(pct / 100);
              }}
            />
            <ToolbarButton
              icon={<ZoomIn size={16} />}
              label="Zoom In"
              onClick={() => globalCommandRegistry.execute("zoomIn")}
            />
          </ToolbarGroup>
        </Toolbar>
      }
      timeline={<ScrollableCanvas behavior={behaviorFactory} />}
    />
  );
}
