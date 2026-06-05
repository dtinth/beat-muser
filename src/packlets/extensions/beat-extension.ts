import type { GameModeLayout, LaneDefinition } from "../editor-core/lane-layouts.ts";
import type { Extension, ExtensionHost } from ".";

const BEAT_5K_LANES: LaneDefinition[] = [
  {
    laneIndex: 8,
    name: "SC",
    width: 56,
    backgroundColor: "var(--red-2)",
    noteColor: "var(--red-7)",
  },
  {
    laneIndex: 1,
    name: "1",
    width: 36,
    backgroundColor: "var(--gray-2)",
    noteColor: "var(--gray-7)",
  },
  {
    laneIndex: 2,
    name: "2",
    width: 36,
    backgroundColor: "var(--indigo-2)",
    noteColor: "var(--indigo-7)",
  },
  {
    laneIndex: 3,
    name: "3",
    width: 36,
    backgroundColor: "var(--gray-2)",
    noteColor: "var(--gray-7)",
  },
  {
    laneIndex: 4,
    name: "4",
    width: 36,
    backgroundColor: "var(--indigo-2)",
    noteColor: "var(--indigo-7)",
  },
  {
    laneIndex: 5,
    name: "5",
    width: 36,
    backgroundColor: "var(--gray-2)",
    noteColor: "var(--gray-7)",
  },
];

const BEAT_7K_LANES: LaneDefinition[] = [
  {
    laneIndex: 8,
    name: "SC",
    width: 56,
    backgroundColor: "var(--red-2)",
    noteColor: "var(--red-7)",
  },
  {
    laneIndex: 1,
    name: "1",
    width: 36,
    backgroundColor: "var(--gray-2)",
    noteColor: "var(--gray-7)",
  },
  {
    laneIndex: 2,
    name: "2",
    width: 28,
    backgroundColor: "var(--indigo-2)",
    noteColor: "var(--indigo-7)",
  },
  {
    laneIndex: 3,
    name: "3",
    width: 36,
    backgroundColor: "var(--gray-2)",
    noteColor: "var(--gray-7)",
  },
  {
    laneIndex: 4,
    name: "4",
    width: 28,
    backgroundColor: "var(--indigo-2)",
    noteColor: "var(--indigo-7)",
  },
  {
    laneIndex: 5,
    name: "5",
    width: 36,
    backgroundColor: "var(--gray-2)",
    noteColor: "var(--gray-7)",
  },
  {
    laneIndex: 6,
    name: "6",
    width: 28,
    backgroundColor: "var(--indigo-2)",
    noteColor: "var(--indigo-7)",
  },
  {
    laneIndex: 7,
    name: "7",
    width: 36,
    backgroundColor: "var(--gray-2)",
    noteColor: "var(--gray-7)",
  },
];

const BEAT_5K_LAYOUT: GameModeLayout = {
  mode: "beat-5k",
  lanes: BEAT_5K_LANES,
  keysounds: true,
  supportsSoflan: true,
};

const BEAT_7K_LAYOUT: GameModeLayout = {
  mode: "beat-7k",
  lanes: BEAT_7K_LANES,
  keysounds: true,
  supportsSoflan: true,
};

export const BEAT_EXTENSION: Extension = {
  manifest: { id: "builtin.beat", name: "Beat Mode", version: "1.0.0" },
  connect(host: ExtensionHost) {
    host.registerGameMode(BEAT_5K_LAYOUT);
    host.registerGameMode(BEAT_7K_LAYOUT);
  },
};
