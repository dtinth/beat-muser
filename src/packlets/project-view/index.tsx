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
import { Flex, Text, Dialog, Button, TextField } from "@radix-ui/themes";
import { useToast } from "../toast";
import { ProjectLayout } from "../project-layout";
import { ModalManager, ModalHost } from "../modal-manager";
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
import {
  EditorController,
  BPM_CHANGE,
  TIME_SIGNATURE,
  CHART,
  EditEntityUserAction,
} from "../editor-core";
import type { ProjectFile } from "../project-format";
import { createTimelineBehaviorFactory } from "./timeline-behavior";
import {
  globalCommandRegistry,
  CommandSet,
  KeyboardShortcutHandler,
  CommandPalette,
} from "../command-registry";

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

function EditableField({
  label,
  value,
  onEdit,
  modalManager,
  validate,
}: {
  label: string;
  value: string;
  onEdit: (value: string) => void;
  modalManager: ModalManager;
  validate?: (value: string) => string | undefined;
}) {
  return (
    <Flex
      direction="column"
      style={{ gap: 2, cursor: "pointer" }}
      onClick={async () => {
        const result = await modalManager.input({
          title: `Edit ${label}`,
          value,
          validate,
        });
        if (result !== undefined) {
          onEdit(result);
        }
      }}
    >
      <Flex justify="between" align="center">
        <Text size="1" color="gray">
          {label}
        </Text>
        <Pencil size={12} />
      </Flex>
      <Text size="2">{value}</Text>
    </Flex>
  );
}

function RightPanels({ controller }: { controller: EditorController }) {
  const [levels, setLevels] = useState(() =>
    controller.getLevelsForChart(controller.$selectedChartId.get() ?? ""),
  );

  useEffect(() => {
    const unsub = controller.$hiddenLevelIds.subscribe(() => {
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
                          {level.visible ? <Eye size={14} /> : <EyeOff size={14} />}
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

function LeftPanels({
  project,
  onProjectChange,
  modalManager,
  controller,
}: {
  project: ProjectFile;
  onProjectChange: (project: ProjectFile) => void;
  modalManager: ModalManager;
  controller: EditorController;
}) {
  const updateMetadata = (field: "title" | "artist" | "genre", value: string) => {
    onProjectChange({
      ...project,
      metadata: { ...project.metadata, [field]: value },
    });
  };

  const [charts, setCharts] = useState(() => controller.getCharts());
  const [selectedChartId, setSelectedChartId] = useState(() => controller.$selectedChartId.get());
  const [selectedChart, setSelectedChart] = useState(() =>
    controller.getEntityManager().get(selectedChartId ?? ""),
  );

  useEffect(() => {
    const unsubCharts = controller.getEntityManager().$mutationVersion.subscribe(() => {
      setCharts(controller.getCharts());
      setSelectedChart(controller.getEntityManager().get(controller.$selectedChartId.get() ?? ""));
    });
    const unsubSelected = controller.$selectedChartId.subscribe((id) => {
      setSelectedChartId(id);
      setSelectedChart(controller.getEntityManager().get(id ?? ""));
    });
    return () => {
      unsubCharts();
      unsubSelected();
    };
  }, [controller]);

  const chartComponent = selectedChart
    ? controller.getEntityManager().getComponent(selectedChart, CHART)
    : undefined;
  const soundLanes = chartComponent?.soundLanes ?? 1;

  return (
    <Flex direction="column">
      <SidebarPanel
        tabs={[
          {
            label: "Project Information",
            content: (
              <>
                <EditableField
                  label="Title"
                  value={project.metadata.title}
                  modalManager={modalManager}
                  onEdit={(v) => updateMetadata("title", v)}
                  validate={(v) => (v.trim() === "" ? "Title is required" : undefined)}
                />
                <EditableField
                  label="Artist"
                  value={project.metadata.artist}
                  modalManager={modalManager}
                  onEdit={(v) => updateMetadata("artist", v)}
                  validate={(v) => (v.trim() === "" ? "Artist is required" : undefined)}
                />
                <EditableField
                  label="Genre"
                  value={project.metadata.genre}
                  modalManager={modalManager}
                  onEdit={(v) => updateMetadata("genre", v)}
                />
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
                  {charts.map((chart) => {
                    const chartComponent = controller.getEntityManager().getComponent(chart, CHART);
                    const isSelected = chart.id === selectedChartId;
                    return (
                      <Flex
                        key={chart.id}
                        justify="between"
                        align="center"
                        style={{
                          padding: "4px 8px",
                          borderRadius: 4,
                          cursor: "pointer",
                          backgroundColor: isSelected ? "var(--accent-3)" : "transparent",
                        }}
                        onClick={() => controller.setSelectedChartId(chart.id)}
                      >
                        <Text size="2">{chartComponent?.name ?? "Untitled"}</Text>
                      </Flex>
                    );
                  })}
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
                <EditableField
                  label="Name"
                  value={chartComponent?.name ?? ""}
                  modalManager={modalManager}
                  onEdit={(v) => {
                    if (!selectedChart || v.trim() === "") return;
                    const oldComponents = structuredClone(selectedChart.components);
                    const newComponents = {
                      ...oldComponents,
                      chart: { ...(oldComponents.chart as object), name: v.trim() },
                    };
                    controller.applyAction(
                      new EditEntityUserAction(
                        controller.ctx,
                        selectedChart.id,
                        oldComponents,
                        newComponents,
                      ),
                    );
                  }}
                  validate={(v) => (v.trim() === "" ? "Name is required" : undefined)}
                />
                <EditableField
                  label="Sound Lanes"
                  value={String(soundLanes)}
                  modalManager={modalManager}
                  onEdit={(v) => {
                    const num = parseInt(v, 10);
                    if (Number.isNaN(num) || num < 1 || !selectedChart) return;
                    const oldComponents = structuredClone(selectedChart.components);
                    const newComponents = {
                      ...oldComponents,
                      chart: { ...(oldComponents.chart as object), soundLanes: num },
                    };
                    controller.applyAction(
                      new EditEntityUserAction(
                        controller.ctx,
                        selectedChart.id,
                        oldComponents,
                        newComponents,
                      ),
                    );
                  }}
                  validate={(v) => {
                    const num = parseInt(v, 10);
                    if (Number.isNaN(num) || num < 1) return "Must be a positive integer";
                    return undefined;
                  }}
                />
              </>
            ),
          },
          {
            label: "Stats",
            content: (
              <>
                <Field label="Total notes" value="" />
                <Field label="Long notes" value="" />
                <Field label="Peak NPS" value="" />
                <Field label="Measures" value="" />
                <Field label="BPM range" value="" />
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
  const loadedProject = useLoaderData() as ProjectFile;
  const [project, setProject] = useState(loadedProject);
  const error = useRouteError() as Error | undefined;
  const { showError } = useToast();

  const [controller] = useState(() => new EditorController({ project: loadedProject }));
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [modalManager] = useState(() => new ModalManager());

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
    commands.add({
      id: "openCommandPalette",
      title: "Open Command Palette",
      shortcut: "$mod+KeyK",
      execute: () => setPaletteOpen(true),
    });
    commands.add({
      id: "deleteSelection",
      title: "Delete Selection",
      shortcut: "Delete",
      execute: () => controller.deleteSelection(),
    });
    commands.add({
      id: "undo",
      title: "Undo",
      shortcut: "$mod+KeyZ",
      execute: () => controller.undo(),
    });
    commands.add({
      id: "redo",
      title: "Redo",
      shortcut: "$mod+Shift+KeyZ",
      execute: () => controller.redo(),
    });
    commands.add({
      id: "navigateUp",
      title: "Navigate Up",
      shortcut: "ArrowUp",
      execute: () => controller.navigateSnap("up"),
    });
    commands.add({
      id: "navigateDown",
      title: "Navigate Down",
      shortcut: "ArrowDown",
      execute: () => controller.navigateSnap("down"),
    });
    commands.add({
      id: "toolSelect",
      title: "Select Tool",
      shortcut: "KeyQ",
      execute: () => controller.setTool("select"),
    });
    commands.add({
      id: "toolPencil",
      title: "Pencil Tool",
      shortcut: "KeyW",
      execute: () => controller.setTool("pencil"),
    });
    commands.add({
      id: "toolErase",
      title: "Erase Tool",
      shortcut: "KeyE",
      execute: () => controller.setTool("erase"),
    });
    commands.add({
      id: "toolPan",
      title: "Pan Tool",
      shortcut: "KeyR",
      execute: () => controller.setTool("pan"),
    });
    const unregister = commands.registerTo(globalCommandRegistry);
    const handler = new KeyboardShortcutHandler({
      registry: globalCommandRegistry,
    });

    const onKeyDown = (e: KeyboardEvent) => {
      if (paletteOpen) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.closest("[contenteditable='true']"))
      ) {
        return;
      }
      handler.onKeyDown(e);
    };
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

  const [activeTool, setActiveTool] = useState(controller.$activeTool.get());
  useEffect(() => {
    const unsub = controller.$activeTool.subscribe(setActiveTool);
    return unsub;
  }, [controller]);

  const [bpmEditOpen, setBpmEditOpen] = useState(false);
  const [bpmEditEntityId, setBpmEditEntityId] = useState<string | null>(null);
  const [bpmValue, setBpmValue] = useState("");

  const [timeSigEditOpen, setTimeSigEditOpen] = useState(false);
  const [timeSigEditEntityId, setTimeSigEditEntityId] = useState<string | null>(null);
  const [timeSigNumerator, setTimeSigNumerator] = useState("");
  const [timeSigDenominator, setTimeSigDenominator] = useState("");

  useEffect(() => {
    const unsub = controller.$lastPlacedEntityInfo.subscribe((info) => {
      if (!info) return;
      if (info.columnId === "bpm") {
        const entity = controller.getEntityManager().get(info.entityId);
        const bpm = entity
          ? (controller.getEntityManager().getComponent(entity, BPM_CHANGE)?.bpm ?? 120)
          : 120;
        setBpmEditEntityId(info.entityId);
        setBpmValue(String(bpm));
        setBpmEditOpen(true);
      } else if (info.columnId === "time-sig") {
        const entity = controller.getEntityManager().get(info.entityId);
        const ts = entity
          ? controller.getEntityManager().getComponent(entity, TIME_SIGNATURE)
          : undefined;
        setTimeSigEditEntityId(info.entityId);
        setTimeSigNumerator(String(ts?.numerator ?? 4));
        setTimeSigDenominator(String(ts?.denominator ?? 4));
        setTimeSigEditOpen(true);
      }
      controller.$lastPlacedEntityInfo.set(null);
    });
    return unsub;
  }, [controller]);

  const handleBpmConfirm = () => {
    if (!bpmEditEntityId) return;
    const entity = controller.getEntityManager().get(bpmEditEntityId);
    if (!entity) return;
    const newBpm = parseFloat(bpmValue);
    if (Number.isNaN(newBpm) || newBpm <= 0) return;
    const oldComponents = structuredClone(entity.components);
    const newComponents = {
      ...oldComponents,
      [BPM_CHANGE.key]: { bpm: newBpm },
    };
    controller.applyAction(
      new EditEntityUserAction(controller.ctx, bpmEditEntityId, oldComponents, newComponents),
    );
    setBpmEditOpen(false);
    setBpmEditEntityId(null);
  };

  const handleTimeSigConfirm = () => {
    if (!timeSigEditEntityId) return;
    const entity = controller.getEntityManager().get(timeSigEditEntityId);
    if (!entity) return;
    const num = parseInt(timeSigNumerator, 10);
    const den = parseInt(timeSigDenominator, 10);
    if (Number.isNaN(num) || num <= 0 || Number.isNaN(den) || den <= 0) return;
    const oldComponents = structuredClone(entity.components);
    const newComponents = {
      ...oldComponents,
      [TIME_SIGNATURE.key]: { numerator: num, denominator: den },
    };
    controller.applyAction(
      new EditEntityUserAction(controller.ctx, timeSigEditEntityId, oldComponents, newComponents),
    );
    setTimeSigEditOpen(false);
    setTimeSigEditEntityId(null);
  };

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
    <>
      <ProjectLayout
        leftPanels={
          <LeftPanels
            project={project}
            onProjectChange={setProject}
            modalManager={modalManager}
            controller={controller}
          />
        }
        rightPanels={<RightPanels controller={controller} />}
        toolbar={
          <Toolbar>
            <ToolbarGroup label="Mode">
              <ToolbarButton
                icon={<MousePointer2 size={16} />}
                label="Select"
                active={activeTool === "select"}
                onClick={() => controller.setTool("select")}
              />
              <ToolbarButton
                icon={<Pencil size={16} />}
                label="Pencil"
                active={activeTool === "pencil"}
                onClick={() => controller.setTool("pencil")}
              />
              <ToolbarButton
                icon={<Eraser size={16} />}
                label="Erase"
                active={activeTool === "erase"}
                onClick={() => controller.setTool("erase")}
              />
              <ToolbarButton
                icon={<Hand size={16} />}
                label="Pan"
                active={activeTool === "pan"}
                onClick={() => controller.setTool("pan")}
              />
            </ToolbarGroup>

            <ToolbarDivider />

            <ToolbarGroup label="History">
              <ToolbarButton
                icon={<Undo2 size={16} />}
                label="Undo"
                onClick={() => controller.undo()}
              />
              <ToolbarButton
                icon={<Redo2 size={16} />}
                label="Redo"
                onClick={() => controller.redo()}
              />
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
                testId="zoom-dropdown"
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
      <CommandPalette
        registry={globalCommandRegistry}
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
      />
      <Dialog.Root open={bpmEditOpen} onOpenChange={setBpmEditOpen}>
        <Dialog.Content maxWidth="300px">
          <Dialog.Title>Edit BPM</Dialog.Title>
          <TextField.Root
            type="number"
            value={bpmValue}
            onChange={(e) => setBpmValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleBpmConfirm();
            }}
          />
          <Flex gap="2" mt="3" justify="end">
            <Button variant="soft" onClick={() => setBpmEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleBpmConfirm}>OK</Button>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>
      <Dialog.Root open={timeSigEditOpen} onOpenChange={setTimeSigEditOpen}>
        <Dialog.Content maxWidth="300px">
          <Dialog.Title>Edit Time Signature</Dialog.Title>
          <Flex gap="2" align="center">
            <TextField.Root
              type="number"
              value={timeSigNumerator}
              onChange={(e) => setTimeSigNumerator(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleTimeSigConfirm();
              }}
            />
            <Text size="2">/</Text>
            <TextField.Root
              type="number"
              value={timeSigDenominator}
              onChange={(e) => setTimeSigDenominator(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleTimeSigConfirm();
              }}
            />
          </Flex>
          <Flex gap="2" mt="3" justify="end">
            <Button variant="soft" onClick={() => setTimeSigEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleTimeSigConfirm}>OK</Button>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>
      <ModalHost manager={modalManager} />
    </>
  );
}
