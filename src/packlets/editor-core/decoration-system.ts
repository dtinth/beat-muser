/**
 * @packageDocumentation
 *
 * Decoration system for extension worker decorations. Stores decoration
 * specs produced by extension workers in pulse/lane coordinates. The
 * RenderSlice reads these and converts to pixel positions during frame
 * computation, as specified in ADR 020.
 */

import { atom } from "nanostores";

/**
 * A decoration spec in pulse/lane coordinates, matching ADR 020 format.
 */
export interface DecorationSpec {
  type: "line";
  from: { pulse: number; lane: number; anchor: "bottom" | "center" | "grid" };
  to: { pulse: number; lane: number; anchor: "bottom" | "center" | "grid" };
  color: string;
  width: number;
  zIndex: number;
}

/** Reactive atom holding all current decoration specs from all workers. */
export const $decorationSpecs = atom<DecorationSpec[]>([]);
