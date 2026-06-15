/**
 * @packageDocumentation
 *
 * Decoration system for extension worker decorations. Stores decoration
 * specs produced by extension workers in pulse/lane coordinates. The
 * RenderSlice reads these and converts to pixel positions during frame
 * computation, as specified in ADR 020.
 */

import { atom } from "nanostores";

export interface LineDecorationSpec {
  type: "line";
  from: { pulse: number; lane: number; anchor: "bottom" | "center" | "grid" };
  to: { pulse: number; lane: number; anchor: "bottom" | "center" | "grid" };
  color: string;
  width: number;
  /** Optional cubic bezier control points in normalized space (0–1). Worker-computed. (0,0) = from endpoint, (1,1) = to endpoint. */
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

export type DecorationSpec = LineDecorationSpec | ArrowDecorationSpec;

/** Reactive atom holding all current decoration specs from all workers. */
export const $decorationSpecs = atom<DecorationSpec[]>([]);
