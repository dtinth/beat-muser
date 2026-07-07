/**
 * @packageDocumentation
 *
 * Decoration system for extension worker decorations. Stores decoration
 * specs produced by extension workers in pulse/lane coordinates with
 * optional anchorX for horizontal offset within a lane (0=left, 1=right).
 * The RenderSlice reads these and converts to pixel positions during frame
 * computation, as specified in ADR 020.
 */

import { atom } from "nanostores";

export interface LineDecorationSpec {
  type: "line";
  from: { pulse: number; lane: number; anchor: "bottom" | "center" | "grid"; anchorX?: number };
  to: { pulse: number; lane: number; anchor: "bottom" | "center" | "grid"; anchorX?: number };
  color: string;
  width: number;
  /**
   * Optional cubic bezier control points in normalized space (0–1).
   * Worker-computed. (0,0) = source endpoint (dec.to), (1,1) = destination endpoint (dec.from).
   */
  cp1?: { x: number; y: number };
  cp2?: { x: number; y: number };
  zIndex: number;
  /** Level ID this decoration belongs to. Used to scope rendering to the correct level. */
  levelId?: string;
}

export interface ArrowDecorationSpec {
  type: "arrow";
  pulse: number;
  lane: number;
  anchor: "bottom" | "center" | "grid";
  angle: number;
  color: string;
  zIndex: number;
  /** Level ID this decoration belongs to. Used to scope rendering to the correct level. */
  levelId?: string;
}

export interface RectDecorationSpec {
  type: "rect";
  from: { pulse: number; lane: number };
  to: { pulse: number; lane: number };
  color: string;
  zIndex: number;
  /** Level ID this decoration belongs to. Used to scope rendering to the correct level. */
  levelId?: string;
}

export interface MarkerDecorationSpec {
  type: "marker";
  pulse: number;
  lane: number;
  anchor: "bottom" | "center" | "grid";
  style: "warning";
  zIndex: number;
  /** Level ID this decoration belongs to. Used to scope rendering to the correct level. */
  levelId?: string;
}

export type DecorationSpec =
  | LineDecorationSpec
  | ArrowDecorationSpec
  | RectDecorationSpec
  | MarkerDecorationSpec;

/** Reactive atom holding all current decoration specs from all workers. */
export const $decorationSpecs = atom<DecorationSpec[]>([]);
