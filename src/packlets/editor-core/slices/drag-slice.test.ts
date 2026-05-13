import { describe, expect, test } from "vite-plus/test";
import { EditorContext } from "../editor-context";
import { DragSlice, type StartDragParams, type UpdateDragParams } from "./drag-slice";

function makeDragSlice() {
  const ctx = new EditorContext();
  return ctx.register(DragSlice);
}

function startDrag(
  slice: DragSlice,
  overrides: Partial<StartDragParams> & {
    viewportY: number;
    entityIds: string[];
    originalPulses: Map<string, number>;
    startPulse: number;
  },
) {
  slice.startDrag({
    viewportX: undefined,
    originalColumnIndices: undefined,
    startColumnIndex: undefined,
    affinity: undefined,
    ...overrides,
  });
}

function updateDrag(slice: DragSlice, overrides: UpdateDragParams) {
  slice.updateDrag(overrides);
}

describe("DragSlice", () => {
  describe("vertical dragging", () => {
    test("startDrag with only Y-axis parameters", () => {
      const slice = makeDragSlice();
      const originalPulses = new Map([
        ["e1", 100],
        ["e2", 200],
      ]);
      startDrag(slice, {
        viewportY: 400,
        entityIds: ["e1", "e2"],
        originalPulses,
        startPulse: 100,
      });
      expect(slice.isActive()).toBe(true);
      expect(slice.isPending()).toBe(true);
      expect(slice.getOriginalPulses()).toEqual(originalPulses);
      expect(slice.getDeltaPulse()).toBe(0);
      expect(slice.getDeltaColumnIndex()).toBe(0);
      expect(slice.getAffinity()).toBeNull();
    });

    test("enters dragging mode on Y movement >= 5px", () => {
      const slice = makeDragSlice();
      startDrag(slice, {
        viewportY: 200,
        entityIds: ["e1"],
        originalPulses: new Map([["e1", 100]]),
        startPulse: 100,
      });
      updateDrag(slice, { viewportY: 204, pulse: 150 });
      expect(slice.isDragging()).toBe(false);
      updateDrag(slice, { viewportY: 206, pulse: 150 });
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
      startDrag(slice, {
        viewportY: 400,
        entityIds: ["e1", "e2"],
        originalPulses: new Map([
          ["e1", 100],
          ["e2", 200],
        ]),
        startPulse: 100,
        viewportX: 300,
        originalColumnIndices,
        startColumnIndex: 0,
        affinity: "gameplay",
      });
      expect(slice.getOriginalColumnIndices()).toEqual(originalColumnIndices);
      expect(slice.getAffinity()).toBe("gameplay");
      expect(slice.getDeltaColumnIndex()).toBe(0);
    });

    test("enters dragging mode on Euclidean distance >= 5", () => {
      const slice = makeDragSlice();
      startDrag(slice, {
        viewportY: 400,
        entityIds: ["e1"],
        originalPulses: new Map([["e1", 100]]),
        startPulse: 100,
        viewportX: 100,
        originalColumnIndices: new Map([["e1", 0]]),
        startColumnIndex: 0,
        affinity: "gameplay",
      });
      // 3px right, 3px down: sqrt(18) ≈ 4.24 < 5
      updateDrag(slice, {
        viewportY: 403,
        pulse: 150,
        viewportX: 103,
        columnIndex: 1,
        maxColumnIndex: 10,
      });
      expect(slice.isDragging()).toBe(false);
      // 7px right only: 7 >= 5
      updateDrag(slice, {
        viewportY: 403,
        pulse: 150,
        viewportX: 107,
        columnIndex: 1,
        maxColumnIndex: 10,
      });
      expect(slice.isDragging()).toBe(true);
    });

    test("computes deltaColumnIndex from anchor offset", () => {
      const slice = makeDragSlice();
      startDrag(slice, {
        viewportY: 400,
        entityIds: ["e1"],
        originalPulses: new Map([["e1", 100]]),
        startPulse: 100,
        viewportX: 200,
        originalColumnIndices: new Map([["e1", 3]]),
        startColumnIndex: 3,
        affinity: "gameplay",
      });
      updateDrag(slice, {
        viewportY: 400,
        pulse: 150,
        viewportX: 220,
        columnIndex: 5,
        maxColumnIndex: 13,
      });
      expect(slice.getDeltaColumnIndex()).toBe(2);
    });

    test("clamps deltaColumnIndex so no entity goes outside flat list bounds", () => {
      const slice = makeDragSlice();
      startDrag(slice, {
        viewportY: 400,
        entityIds: ["e1", "e2"],
        originalPulses: new Map([
          ["e1", 100],
          ["e2", 200],
        ]),
        startPulse: 100,
        viewportX: 200,
        originalColumnIndices: new Map([
          ["e1", 0],
          ["e2", 10],
        ]),
        startColumnIndex: 5,
        affinity: "gameplay",
      });
      updateDrag(slice, {
        viewportY: 400,
        pulse: 150,
        viewportX: 400,
        columnIndex: 20,
        maxColumnIndex: 13,
      });
      expect(slice.getDeltaColumnIndex()).toBe(3);
    });

    test("clamps deltaColumnIndex when negative offset would push entity below 0", () => {
      const slice = makeDragSlice();
      startDrag(slice, {
        viewportY: 400,
        entityIds: ["e1", "e2"],
        originalPulses: new Map([
          ["e1", 100],
          ["e2", 200],
        ]),
        startPulse: 100,
        viewportX: 200,
        originalColumnIndices: new Map([
          ["e1", 10],
          ["e2", 5],
        ]),
        startColumnIndex: 7,
        affinity: "gameplay",
      });
      updateDrag(slice, {
        viewportY: 400,
        pulse: 150,
        viewportX: 207,
        columnIndex: 0,
        maxColumnIndex: 13,
      });
      expect(slice.getDeltaColumnIndex()).toBe(-5);
    });

    test("null affinity: column offset never changes", () => {
      const slice = makeDragSlice();
      startDrag(slice, {
        viewportY: 400,
        entityIds: ["e1"],
        originalPulses: new Map([["e1", 100]]),
        startPulse: 100,
      });
      updateDrag(slice, {
        viewportY: 400,
        pulse: 150,
        viewportX: 400,
        columnIndex: 5,
        maxColumnIndex: 10,
      });
      expect(slice.getDeltaColumnIndex()).toBe(0);
    });
  });

  describe("endDrag and cancelDrag", () => {
    test("endDrag returns delta when dragging, null otherwise", () => {
      const slice = makeDragSlice();
      startDrag(slice, {
        viewportY: 200,
        entityIds: ["e1"],
        originalPulses: new Map([["e1", 100]]),
        startPulse: 100,
      });
      expect(slice.endDrag()).toBeNull();

      startDrag(slice, {
        viewportY: 200,
        entityIds: ["e1"],
        originalPulses: new Map([["e1", 100]]),
        startPulse: 100,
      });
      updateDrag(slice, { viewportY: 210, pulse: 50 });
      expect(slice.isDragging()).toBe(true);
      const delta = slice.endDrag();
      expect(delta).not.toBeNull();
    });

    test("cancelDrag resets state", () => {
      const slice = makeDragSlice();
      startDrag(slice, {
        viewportY: 200,
        entityIds: ["e1"],
        originalPulses: new Map([["e1", 100]]),
        startPulse: 100,
        viewportX: 200,
        originalColumnIndices: new Map([["e1", 0]]),
        startColumnIndex: 0,
        affinity: "gameplay",
      });
      updateDrag(slice, {
        viewportY: 210,
        pulse: 50,
        viewportX: 210,
        columnIndex: 1,
        maxColumnIndex: 10,
      });
      expect(slice.isDragging()).toBe(true);
      slice.cancelDrag();
      expect(slice.isActive()).toBe(false);
      expect(slice.getDeltaColumnIndex()).toBe(0);
    });
  });
});
