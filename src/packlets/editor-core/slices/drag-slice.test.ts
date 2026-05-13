import { describe, expect, test } from "vite-plus/test";
import { EditorContext } from "../editor-context";
import { DragSlice } from "./drag-slice";

function makeDragSlice() {
  const ctx = new EditorContext();
  return ctx.register(DragSlice);
}

describe("DragSlice", () => {
  describe("vertical dragging (backward compatible)", () => {
    test("startDrag with only Y-axis parameters", () => {
      const slice = makeDragSlice();
      const originalPulses = new Map([
        ["e1", 100],
        ["e2", 200],
      ]);
      slice.startDrag(400, ["e1", "e2"], originalPulses, 100);
      expect(slice.isActive()).toBe(true);
      expect(slice.isPending()).toBe(true);
      expect(slice.getOriginalPulses()).toEqual(originalPulses);
      expect(slice.getDeltaPulse()).toBe(0);
      expect(slice.getDeltaColumnIndex()).toBe(0);
      expect(slice.getAffinity()).toBeNull();
    });

    test("enters dragging mode on Y movement >= 5px", () => {
      const slice = makeDragSlice();
      slice.startDrag(200, ["e1"], new Map([["e1", 100]]), 100);

      slice.updateDrag(204, 150);
      expect(slice.isDragging()).toBe(false);

      slice.updateDrag(206, 150);
      expect(slice.isDragging()).toBe(true);
    });
  });

  describe("horizontal dragging", () => {
    test("tracks column indices and affinity", () => {
      const slice = makeDragSlice();
      const originalColumnIndices = new Map([
        ["e1", 0],
        ["e2", 2],
      ]);
      slice.startDrag(
        400,
        ["e1", "e2"],
        new Map([
          ["e1", 100],
          ["e2", 200],
        ]),
        100,
        300,
        originalColumnIndices,
        0,
        "gameplay",
      );

      expect(slice.getOriginalColumnIndices()).toEqual(originalColumnIndices);
      expect(slice.getAffinity()).toBe("gameplay");
      expect(slice.getDeltaColumnIndex()).toBe(0);
    });

    test("enters dragging mode on Euclidean distance >= 5", () => {
      const slice = makeDragSlice();
      slice.startDrag(
        400,
        ["e1"],
        new Map([["e1", 100]]),
        100,
        100,
        new Map([["e1", 0]]),
        0,
        "gameplay",
      );

      // 3px right, 3px down: sqrt(18) ≈ 4.24 < 5
      slice.updateDrag(403, 150, 103, 1, 10);
      expect(slice.isDragging()).toBe(false);

      // 7px right only: 7 >= 5
      slice.updateDrag(403, 150, 107, 1, 10);
      expect(slice.isDragging()).toBe(true);
    });

    test("computes deltaColumnIndex from anchor offset", () => {
      const slice = makeDragSlice();
      slice.startDrag(
        400,
        ["e1"],
        new Map([["e1", 100]]),
        100,
        200,
        new Map([["e1", 3]]),
        3,
        "gameplay",
      );

      slice.updateDrag(400, 150, 220, 5, 13);
      expect(slice.getDeltaColumnIndex()).toBe(2); // 5 - 3
    });

    test("clamps deltaColumnIndex so no entity goes outside flat list bounds", () => {
      const slice = makeDragSlice();
      slice.startDrag(
        400,
        ["e1", "e2"],
        new Map([
          ["e1", 100],
          ["e2", 200],
        ]),
        100,
        200,
        new Map([
          ["e1", 0],
          ["e2", 10],
        ]),
        5,
        "gameplay",
      );

      // Target column 20, anchor at 5, raw delta = 15
      // e2 at 10 → 10 + 15 = 25 > maxIndex 13 → clamp to 13 - 10 = 3
      slice.updateDrag(400, 150, 400, 20, 13);
      expect(slice.getDeltaColumnIndex()).toBe(3);
    });

    test("clamps deltaColumnIndex when negative offset would push entity below 0", () => {
      const slice = makeDragSlice();
      slice.startDrag(
        400,
        ["e1", "e2"],
        new Map([
          ["e1", 100],
          ["e2", 200],
        ]),
        100,
        200,
        new Map([
          ["e1", 10],
          ["e2", 5],
        ]),
        7,
        "gameplay",
      );

      // Target column 0, anchor at 7, raw delta = -7
      // e2 at 5 → 5 + (-7) = -2 < 0 → clamp to 0 - 5 = -5
      slice.updateDrag(400, 150, 207, 0, 13);
      expect(slice.getDeltaColumnIndex()).toBe(-5);
    });

    test("null affinity: column offset never changes", () => {
      const slice = makeDragSlice();
      slice.startDrag(400, ["e1"], new Map([["e1", 100]]), 100);

      slice.updateDrag(400, 150, 400, 5, 10);
      expect(slice.getDeltaColumnIndex()).toBe(0);
    });
  });

  describe("endDrag and cancelDrag", () => {
    test("endDrag returns delta when dragging, null otherwise", () => {
      const slice = makeDragSlice();
      slice.startDrag(200, ["e1"], new Map([["e1", 100]]), 100);
      expect(slice.endDrag()).toBeNull();

      slice.startDrag(200, ["e1"], new Map([["e1", 100]]), 100);
      slice.updateDrag(210, 50);
      expect(slice.isDragging()).toBe(true);
      const delta = slice.endDrag();
      expect(delta).not.toBeNull();
    });

    test("cancelDrag resets state", () => {
      const slice = makeDragSlice();
      slice.startDrag(
        200,
        ["e1"],
        new Map([["e1", 100]]),
        100,
        200,
        new Map([["e1", 0]]),
        0,
        "gameplay",
      );
      slice.updateDrag(210, 50, 210, 1, 10);
      expect(slice.isDragging()).toBe(true);

      slice.cancelDrag();
      expect(slice.isActive()).toBe(false);
      expect(slice.getDeltaColumnIndex()).toBe(0);
    });
  });
});
