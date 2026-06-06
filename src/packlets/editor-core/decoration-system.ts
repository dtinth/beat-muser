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
  /** Optional cubic bezier control points in pulse/lane space. Worker-computed. */
  cp1?: { pulse: number; lane: number };
  cp2?: { pulse: number; lane: number };
  zIndex: number;
}

export interface ArrowDecorationSpec {
  type: "arrow";
  pulse: number;
  lane: number;
  anchor: "bottom" | "center" | "grid";
  angle: number;
  color: string;
  zIndex: number;
}

export type DecorationSpec = LineDecorationSpec | ArrowDecorationSpec;

/** Reactive atom holding all current decoration specs from all workers. */
export const $decorationSpecs = atom<DecorationSpec[]>([]);
