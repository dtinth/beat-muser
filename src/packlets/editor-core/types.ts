/**
 * @packageDocumentation
 *
 * Shared type definitions and constants for the editor core packlet.
 */

import type { Point } from "../geometry";
import type { Entity, EntityManager } from "../entity-manager";
import type { Playback } from "../playback-contract";
import type { EditBatchBuilder } from "./edit-batch-builder";

export interface EditorControllerOptions {
  project: import("../project-format").ProjectFile;
}

export interface ColumnDefinition {
  id: string;
  title: string;
  width: number;
  backgroundColor?: string;
  levelId?: string;
  laneIndex?: number;
  soundLane?: number;
  noteColor?: string;
  affinity?: "gameplay" | "sound";
  placementHandler?: (pulse: number) => Entity | null;
  containsEntity?: (entity: Entity) => boolean;
  moveEntityTo?: (batch: EditBatchBuilder, em: EntityManager, entity: Entity) => void;
}

export interface TimelineColumn extends ColumnDefinition {
  x: number;
}

export interface LevelInfo {
  id: string;
  name: string;
  mode: string;
  sortOrder: number;
  visible: boolean;
}

export interface TimelineRenderSpec {
  key: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  data: Record<string, unknown>;
  testId?: string;
  layer?: "scroll" | "sticky";
  entityId?: string;
  zIndex?: number;
  opacity?: number;
}

export interface EditorOutboxEvents {
  setScroll: (point: Point) => void;
  playbackPlay: (playback: Playback, rate: number) => void;
  playbackStop: (scrollY: number) => void;
}

export const PPQN = 240;

export const QUARTER_NOTE_EXTEND_SIZE = 16;

export const AUTO_EXTEND_THRESHOLD_QN = 4;

export const DEFAULT_CHART_SIZE = 15360;

export const ZOOM_PRESETS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 4];

export const BASE_SCALE_Y = 0.2;

export const PADDING_BOTTOM = 40;

export const HISTORY_LIMIT = 100;

export interface UserAction {
  title: string;
  do(): void;
  undo(): void;
}
