/**
 * @packageDocumentation
 *
 * Shared type definitions and constants for the editor core packlet.
 */

import type { Point } from "../geometry";
import type { Entity } from "../entity-manager";

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
  placementHandler?: (pulse: number) => Entity | null;
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
}

export interface EditorOutboxEvents {
  setScroll: (point: Point) => void;
}

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
