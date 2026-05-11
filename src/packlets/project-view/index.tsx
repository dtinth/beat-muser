/**
 * @packageDocumentation
 *
 * Main editor page for a loaded project. Wraps `ProjectLayout` with the
 * editor toolbar, chart panels, and a ScrollableCanvas timeline.
 */

import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useRouteError, useLoaderData } from "react-router";
import { Pencil, Plus, Eye, EyeOff, Trash2, ChevronRight, ChevronDown } from "lucide-react";
import { Flex, Text, Dialog, Button, TextField } from "@radix-ui/themes";
import { useToast } from "../toast";
import { ProjectLayout } from "../project-layout";
import { ModalManager, ModalHost } from "../modal-manager";
import { SidebarPanel } from "../sidebar-panel";
import { perf } from "../perf";
import { useInView } from "react-intersection-observer";
import { ScrollableCanvas } from "../scrollable-canvas";
import {
  EditorController,
  BPM_CHANGE,
  TIME_SIGNATURE,
  CHART,
  LEVEL,
  SOUND_GROUP,
  SOUND_CHANNEL,
  SoundChannelSlice,
  EditEntityUserAction,
  ProjectSlice,
} from "../editor-core";
import type { ProjectFile } from "../project-format";
import type { ProjectSource } from "../project-store/types";
import { createProjectFileSystem } from "../file-system";
import { createAudioEngine, startAudioPlayback } from "../audio-engine";
import { createTimelineBehaviorFactory } from "./timeline-behavior";
import { ProjectToolbar } from "./project-toolbar";
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

function DebugContent() {
  const { ref, inView } = useInView();
  const [events, setEvents] = useState(() => perf.$state.get().events);
  const [counters, setCounters] = useState(() => perf.$state.get().counters);

  useEffect(() => {
    if (!inView) return;
    const unsub = perf.$state.subscribe((state) => {
      setEvents([...state.events]);
      setCounters({ ...state.counters });
    });
    return unsub;
  }, [inView]);

  const statsByType = useMemo(() => {
    const groups = new Map<string, number[]>();
    for (const e of events) {
      let list = groups.get(e.type);
      if (!list) {
        list = [];
        groups.set(e.type, list);
      }
      list.push(e.duration);
    }
    const result: { type: string; count: number; min: number; avg: number; max: number }[] = [];
    for (const [type, durations] of groups) {
      const sorted = [...durations].sort((a, b) => a - b);
      result.push({
        type,
        count: sorted.length,
        min: sorted[0]!,
        avg: sorted.reduce((a, b) => a + b, 0) / sorted.length,
        max: sorted[sorted.length - 1]!,
      });
    }
    return result.sort((a, b) => a.type.localeCompare(b.type));
  }, [events]);

  return (
    <Flex ref={ref} direction="column" style={{ gap: 8 }}>
      <Text size="1" color="gray">
        Frame {counters.renderNumber} / Reconcile {counters.reconcileNumber}
      </Text>
      <Flex direction="column" style={{ gap: 2 }}>
        {statsByType.map((s) => (
          <Flex key={s.type} justify="between" align="center">
            <Text size="1" style={{ fontFamily: "monospace" }}>
              {s.type}
            </Text>
            <Text size="1" color="gray">
              {s.min.toFixed(2)} / {s.avg.toFixed(2)} / {s.max.toFixed(2)}ms
            </Text>
          </Flex>
        ))}
      </Flex>
      <Text size="1" color="gray">
        {events.length} events
      </Text>
    </Flex>
  );
}

function RightPanels({
  controller,
  modalManager,
}: {
  controller: EditorController;
  modalManager: ModalManager;
}) {
  const [levels, setLevels] = useState(() =>
    controller.getLevelsForChart(controller.$selectedChartId.get() ?? ""),
  );
  const [selectedLevelId, setSelectedLevelId] = useState(() => controller.$selectedLevelId.get());

  const [soundGroups, setSoundGroups] = useState(() =>
    controller.ctx.get(SoundChannelSlice).$soundGroups.get(),
  );
  const [soundChannels, setSoundChannels] = useState(() =>
    controller.ctx.get(SoundChannelSlice).$soundChannels.get(),
  );
  const [selectedSoundChannelId, setSelectedSoundChannelId] = useState(() =>
    controller.ctx.get(SoundChannelSlice).$selectedSoundChannelId.get(),
  );
  const [collapsedGroupIds, setCollapsedGroupIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const unsubHidden = controller.$hiddenLevelIds.subscribe(() => {
      setLevels(controller.getLevelsForChart(controller.$selectedChartId.get() ?? ""));
    });
    const unsubSelected = controller.$selectedLevelId.subscribe((id) => {
      setSelectedLevelId(id);
    });
    const unsubMutations = controller.getEntityManager().$mutationVersion.subscribe(() => {
      setLevels(controller.getLevelsForChart(controller.$selectedChartId.get() ?? ""));
    });
    const unsubSoundGroups = controller.ctx
      .get(SoundChannelSlice)
      .$soundGroups.subscribe((v) => setSoundGroups([...v]));
    const unsubSoundChannels = controller.ctx
      .get(SoundChannelSlice)
      .$soundChannels.subscribe((v) => setSoundChannels([...v]));
    const unsubSelectedChannel = controller.ctx
      .get(SoundChannelSlice)
      .$selectedSoundChannelId.subscribe((v) => setSelectedSoundChannelId(v));
    return () => {
      unsubHidden();
      unsubSelected();
      unsubMutations();
      unsubSoundGroups();
      unsubSoundChannels();
      unsubSelectedChannel();
    };
  }, [controller]);

  const chartId = controller.$selectedChartId.get();
  const selectedLevelEntity = selectedLevelId
    ? controller.getEntityManager().get(selectedLevelId)
    : undefined;
  const selectedLevelComponent = selectedLevelEntity
    ? controller.getEntityManager().getComponent(selectedLevelEntity, LEVEL)
    : undefined;

  return (
    <Flex direction="column">
      <SidebarPanel
        tabs={[
          {
            label: "Levels",
            content: (
              <>
                <Flex direction="column" style={{ gap: 4 }}>
                  {levels.map((level) => {
                    const isSelected = level.id === selectedLevelId;
                    return (
                      <Flex
                        key={level.id}
                        justify="between"
                        align="center"
                        style={{
                          padding: "4px 8px",
                          borderRadius: 4,
                          cursor: "pointer",
                          backgroundColor: isSelected ? "var(--accent-3)" : "transparent",
                        }}
                        onClick={() => controller.setSelectedLevelId(level.id)}
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
                            onClick={(e) => {
                              e.stopPropagation();
                              controller.toggleLevelVisibility(level.id);
                            }}
                          >
                            {level.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                          </div>
                          <div
                            style={{ cursor: "pointer" }}
                            onClick={(e) => {
                              e.stopPropagation();
                              controller.removeLevel(level.id);
                            }}
                          >
                            <Trash2 size={14} />
                          </div>
                        </Flex>
                      </Flex>
                    );
                  })}
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
                    onClick={async () => {
                      const modes = controller.getGameModes();
                      const selected = await modalManager.select({
                        title: "Select Game Mode",
                        items: modes.map((m) => ({
                          id: m.mode,
                          label: m.mode,
                          detail: `${m.lanes.length} lanes${m.keysounds ? ", keysounds" : ""}`,
                          value: m.mode,
                        })),
                      });
                      if (selected) {
                        const modeName = selected.value;
                        const existingNames = new Set(levels.map((l) => l.name));
                        let name = modeName;
                        if (existingNames.has(name)) {
                          let n = 2;
                          while (existingNames.has(`${name} #${n}`)) {
                            n++;
                          }
                          name = `${name} #${n}`;
                        }
                        controller.addLevel(chartId, name, modeName);
                      }
                    }}
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

      <SidebarPanel
        tabs={[
          {
            label: "Level Info",
            content: selectedLevelEntity ? (
              <>
                <EditableField
                  label="Name"
                  value={selectedLevelComponent?.name ?? ""}
                  modalManager={modalManager}
                  onEdit={(v) => {
                    if (!selectedLevelEntity || v.trim() === "") return;
                    const oldComponents = structuredClone(selectedLevelEntity.components);
                    const newComponents = {
                      ...oldComponents,
                      level: { ...(oldComponents.level as object), name: v.trim() },
                    };
                    controller.applyAction(
                      new EditEntityUserAction(
                        controller.ctx,
                        selectedLevelEntity.id,
                        oldComponents,
                        newComponents,
                      ),
                    );
                  }}
                  validate={(v) => (v.trim() === "" ? "Name is required" : undefined)}
                />
                <Field label="Mode" value={selectedLevelComponent?.mode ?? ""} />
                <Field label="Sort Order" value={String(selectedLevelComponent?.sortOrder ?? 0)} />
              </>
            ) : (
              <Text size="2" color="gray">
                No level selected
              </Text>
            ),
          },
        ]}
      />

      <SidebarPanel
        tabs={[
          {
            label: "Sounds",
            content: (
              <Flex direction="column" style={{ gap: 8 }}>
                {soundGroups.map((group) => {
                  const groupChannels = soundChannels.filter((c) => c.groupId === group.id);
                  const isCollapsed = collapsedGroupIds.has(group.id);
                  return (
                    <Flex key={group.id} direction="column" style={{ gap: 2 }}>
                      <Flex
                        justify="between"
                        align="center"
                        style={{ padding: "4px 8px", borderRadius: 4 }}
                      >
                        <Flex align="center" style={{ gap: 8 }}>
                          <div
                            style={{ cursor: "pointer" }}
                            onClick={() => {
                              const next = new Set(collapsedGroupIds);
                              if (next.has(group.id)) {
                                next.delete(group.id);
                              } else {
                                next.add(group.id);
                              }
                              setCollapsedGroupIds(next);
                            }}
                          >
                            {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                          </div>
                          {group.color && (
                            <div
                              style={{
                                width: 8,
                                height: 8,
                                borderRadius: "50%",
                                backgroundColor: group.color,
                              }}
                            />
                          )}
                          <Text size="2">{group.name}</Text>
                          <Text size="1" color="gray">
                            ({groupChannels.length})
                          </Text>
                        </Flex>
                        <Flex align="center" style={{ gap: 4 }}>
                          <div
                            style={{ cursor: "pointer" }}
                            onClick={async () => {
                              const entity = controller.getEntityManager().get(group.id);
                              if (!entity) return;
                              const result = await modalManager.input({
                                title: "Edit Group Name",
                                value: group.name,
                              });
                              if (result !== undefined && result.trim() !== "") {
                                const oldComponents = structuredClone(entity.components);
                                const newComponents = {
                                  ...oldComponents,
                                  [SOUND_GROUP.key]: {
                                    ...(oldComponents[SOUND_GROUP.key] as object),
                                    name: result.trim(),
                                  },
                                };
                                controller.applyAction(
                                  new EditEntityUserAction(
                                    controller.ctx,
                                    group.id,
                                    oldComponents,
                                    newComponents,
                                  ),
                                );
                              }
                            }}
                          >
                            <Pencil size={12} />
                          </div>
                          <div
                            style={{ cursor: "pointer" }}
                            onClick={() => controller.addSoundChannel(group.id)}
                          >
                            <Plus size={14} />
                          </div>
                          <div
                            style={{ cursor: "pointer" }}
                            onClick={() => controller.removeSoundGroup(group.id)}
                          >
                            <Trash2 size={14} />
                          </div>
                        </Flex>
                      </Flex>
                      {!isCollapsed && (
                        <Flex direction="column" style={{ gap: 2, paddingLeft: 32 }}>
                          {groupChannels.map((channel) => {
                            const isSelected = channel.id === selectedSoundChannelId;
                            return (
                              <Flex
                                key={channel.id}
                                justify="between"
                                align="center"
                                style={{
                                  padding: "2px 8px",
                                  borderRadius: 4,
                                  cursor: "pointer",
                                  backgroundColor: isSelected ? "var(--accent-3)" : "transparent",
                                }}
                                onClick={() =>
                                  controller.setSelectedSoundChannelId(
                                    isSelected ? null : channel.id,
                                  )
                                }
                              >
                                <Text size="1" color={channel.path ? undefined : "gray"}>
                                  {channel.displayNumber}:{" "}
                                  {channel.path ? channel.path.split("/").pop() : "(blank)"}
                                </Text>
                                <Flex align="center" style={{ gap: 4 }}>
                                  <div
                                    style={{ cursor: "pointer" }}
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      const entity = controller.getEntityManager().get(channel.id);
                                      if (!entity) return;
                                      const result = await modalManager.input({
                                        title: "Edit File Path",
                                        value: channel.path,
                                      });
                                      if (result !== undefined) {
                                        const oldComponents = structuredClone(entity.components);
                                        const newComponents = {
                                          ...oldComponents,
                                          [SOUND_CHANNEL.key]: {
                                            ...(oldComponents[SOUND_CHANNEL.key] as object),
                                            path: result,
                                          },
                                        };
                                        controller.applyAction(
                                          new EditEntityUserAction(
                                            controller.ctx,
                                            channel.id,
                                            oldComponents,
                                            newComponents,
                                          ),
                                        );
                                      }
                                    }}
                                  >
                                    <Pencil size={12} />
                                  </div>
                                  <div
                                    style={{ cursor: "pointer" }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      controller.removeSoundChannel(channel.id);
                                    }}
                                  >
                                    <Trash2 size={12} />
                                  </div>
                                </Flex>
                              </Flex>
                            );
                          })}
                        </Flex>
                      )}
                    </Flex>
                  );
                })}
                <Flex
                  justify="center"
                  align="center"
                  style={{
                    marginTop: 4,
                    padding: "4px 8px",
                    borderRadius: 4,
                    cursor: "pointer",
                    border: "1px dashed var(--gray-6)",
                  }}
                  onClick={() => controller.addSoundGroup()}
                >
                  <Plus size={14} style={{ marginRight: 4 }} />
                  <Text size="1" color="gray">
                    Add Group
                  </Text>
                </Flex>
              </Flex>
            ),
          },
          {
            label: "Debug",
            content: <DebugContent />,
          },
        ]}
      />
    </Flex>
  );
}

function LeftPanels({
  modalManager,
  controller,
}: {
  modalManager: ModalManager;
  controller: EditorController;
}) {
  const [metadata, setMetadata] = useState(() => controller.getMetadata());

  useEffect(() => {
    const unsub = controller.ctx.get(ProjectSlice).$metadata.subscribe((newMetadata) => {
      setMetadata(newMetadata);
    });
    return () => unsub();
  }, [controller]);

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
                  value={metadata.title}
                  modalManager={modalManager}
                  onEdit={(v) => controller.setMetadataField("title", v)}
                  validate={(v) => (v.trim() === "" ? "Title is required" : undefined)}
                />
                <EditableField
                  label="Artist"
                  value={metadata.artist}
                  modalManager={modalManager}
                  onEdit={(v) => controller.setMetadataField("artist", v)}
                  validate={(v) => (v.trim() === "" ? "Artist is required" : undefined)}
                />
                <EditableField
                  label="Genre"
                  value={metadata.genre}
                  modalManager={modalManager}
                  onEdit={(v) => controller.setMetadataField("genre", v)}
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
                        <div
                          style={{ cursor: "pointer" }}
                          onClick={(e) => {
                            e.stopPropagation();
                            controller.removeChart(chart.id);
                          }}
                        >
                          <Trash2 size={14} />
                        </div>
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
                  onClick={() => controller.addChart()}
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
  const { projectFile: loadedProject, source } = useLoaderData() as {
    projectFile: ProjectFile;
    source: ProjectSource;
  };
  const [fileSystem] = useState(() => createProjectFileSystem(source));
  const error = useRouteError() as Error | undefined;
  const { showError, showSuccess } = useToast();

  const [controller] = useState(() => new EditorController({ project: loadedProject }));
  const [modalManager] = useState(() => new ModalManager());
  const audioEngineRef = useRef<ReturnType<typeof createAudioEngine> | null>(null);
  const stopPlaybackRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const engine = createAudioEngine({
      fileSystem,
      delegate: {
        onWaveformStatus(path, status) {
          controller.waveform.setWaveformStatus(path, status);
        },
        onWaveformReady(path, data) {
          controller.waveform.setWaveformData(path, data);
        },
        onWaveformError(path, error) {
          console.error(`Waveform error for ${path}:`, error);
        },
      },
    });

    audioEngineRef.current = engine;

    const soundChannelSlice = controller.ctx.get(SoundChannelSlice);
    let previousPaths = new Set<string>();
    const unsub = soundChannelSlice.$soundFilePaths.subscribe((paths) => {
      const nextPaths = new Set(paths);
      for (const oldPath of previousPaths) {
        if (!nextPaths.has(oldPath)) {
          controller.waveform.removeWaveformData(oldPath);
        }
      }
      previousPaths = nextPaths;
      engine.setFilePaths([...paths]);
    });

    const initialPaths = soundChannelSlice.$soundFilePaths.get();
    previousPaths = new Set(initialPaths);
    if (initialPaths.length > 0) {
      engine.setFilePaths([...initialPaths]);
    }

    return () => {
      unsub();
      const s = stopPlaybackRef.current;
      if (s) s();
      stopPlaybackRef.current = null;
      audioEngineRef.current = null;
      engine.destroy();
    };
  }, [fileSystem, controller]);

  useEffect(() => {
    const unsub1 = controller.outbox.on("playbackPlay", async (playback, rate) => {
      const engine = audioEngineRef.current;
      if (!engine) return;
      if (engine.audioContext.state === "suspended") {
        await engine.audioContext.resume();
      }
      if (playback.abortSignal.aborted) return;
      const stop = startAudioPlayback({
        playback,
        rate,
        audioContext: engine.audioContext,
        buffers: engine.buffers,
        masterGain: engine.masterGain,
        channelGains: engine.channelGains,
      });
      stopPlaybackRef.current = stop;
    });

    const unsub2 = controller.outbox.on("playbackStop", (scrollY) => {
      const s = stopPlaybackRef.current;
      if (s) s();
      stopPlaybackRef.current = null;
      controller.outbox.emit("setScroll", { x: 0, y: scrollY });
    });

    return () => {
      unsub1();
      unsub2();
    };
  }, [controller]);

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
      execute: () => {
        const commands = globalCommandRegistry.getAll().filter((c) => c.title);
        void modalManager
          .select({
            title: "Commands",
            items: commands.map((c) => ({
              id: c.id,
              label: c.title,
              detail: c.shortcut,
              testId: `palette-item-${c.id}`,
              value: c,
            })),
            placeholder: "Type a command...",
          })
          .then((selected) => {
            if (selected) selected.value.execute();
          });
      },
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
    commands.add({
      id: "addSoundGroup",
      title: "Add Sound Group",
      execute: () => controller.addSoundGroup(),
    });
    commands.add({
      id: "addSoundChannel",
      title: "Add Sound Channel",
      execute: async () => {
        const groups = controller.ctx.get(SoundChannelSlice).$soundGroups.get();
        if (groups.length === 0) return;
        const selected = await modalManager.select({
          title: "Select Sound Group",
          items: groups.map((g) => ({
            id: g.id,
            label: g.name,
            value: g.id,
          })),
        });
        if (selected) {
          controller.addSoundChannel(selected.value);
        }
      },
    });
    commands.add({
      id: "saveProject",
      title: "Save Project",
      shortcut: "$mod+KeyS",
      execute: async () => {
        try {
          const projectFile = controller.serialize();
          const json = JSON.stringify(projectFile, null, 2);
          await fileSystem.writeFile("beat-muser-project.json", json);
          showSuccess({ title: "Project saved" });
        } catch (error) {
          console.error(error);
          showError({
            title: "Failed to save project",
            description: (error as Error).message,
          });
        }
      },
    });
    commands.add({
      id: "playPause",
      title: "Play / Pause",
      shortcut: "Space",
      execute: () => {
        const state = controller.playback.$transportState.get();
        if (state === "playing") {
          controller.pausePlayback();
        } else {
          controller.playChart(controller.$cursorPulse.get(), controller.getScrollY());
        }
      },
    });
    commands.add({
      id: "stop",
      title: "Stop",
      shortcut: "Escape",
      execute: () => {
        const state = controller.playback.$transportState.get();
        if (state === "playing" || state === "paused") {
          controller.stopPlayback();
        }
      },
    });
    const unregister = commands.registerTo(globalCommandRegistry);
    const handler = new KeyboardShortcutHandler({
      registry: globalCommandRegistry,
    });

    const onKeyDown = (e: KeyboardEvent) => {
      if (modalManager.$stack.get().length > 0) return;
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
  }, [controller, modalManager]);

  const behaviorFactory = useMemo(() => createTimelineBehaviorFactory(controller), [controller]);

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

  useEffect(() => {
    if (error) {
      console.error(error);
      showError({
        title: "Failed to load project",
        description: error.message,
      });
    }
  }, [error, showError]);

  return (
    <>
      <ProjectLayout
        leftPanels={<LeftPanels modalManager={modalManager} controller={controller} />}
        rightPanels={<RightPanels controller={controller} modalManager={modalManager} />}
        toolbar={<ProjectToolbar controller={controller} />}
        timeline={<ScrollableCanvas behavior={behaviorFactory} />}
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
