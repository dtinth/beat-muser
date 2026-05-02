import { atom } from "nanostores";
import { Slice } from "../slice";
import type { EditorContext } from "../editor-context";
import { ProjectSlice } from "./project-slice";
import { ViewportSlice } from "./viewport-slice";
import { ColumnsSlice } from "./columns-slice";
import { CursorSlice } from "./cursor-slice";
import { SelectionSlice } from "./selection-slice";
import { BoxSelectionSlice } from "./box-selection-slice";
import { ToolSlice } from "./tool-slice";
import { SnapSlice } from "./snap-slice";
import { RenderSlice } from "./render-slice";
import { HistorySlice } from "./history-slice";
import { TimingSlice } from "./timing-slice";
import { DragSlice } from "./drag-slice";
import { EVENT } from "../components";
import { Point, Rect } from "../../geometry";
import {
  EraseUserAction,
  PlaceEntityUserAction,
  BatchEditEntitiesUserAction,
} from "../user-actions";

export class PointerInteractionSlice extends Slice {
  static readonly sliceKey = "pointer-interaction";

  $lastPlacedEntityInfo = atom<{ entityId: string; columnId: string } | null>(null);

  constructor(ctx: EditorContext) {
    super(ctx);
  }

  hitTest(point: Point): string | null {
    const scroll = this.ctx.get(ViewportSlice).$scroll.get();
    const contentX = point.x + scroll.x;
    const contentY = point.y + scroll.y;

    const specs = this.ctx.get(RenderSlice).$visibleRenderObjects.get();
    const HIT_TOLERANCE = 4;

    let bestId: string | null = null;
    let bestDistance = Infinity;

    for (const spec of specs) {
      if (!spec.entityId) continue;

      const hitRect = Rect.expand(
        { x: spec.x, y: spec.y, width: spec.width, height: spec.height },
        HIT_TOLERANCE,
      );
      if (!Rect.contains(hitRect, { x: contentX, y: contentY })) continue;

      const center = Rect.center({ x: spec.x, y: spec.y, width: spec.width, height: spec.height });
      const distance = Point.distance({ x: contentX, y: contentY }, center);

      if (distance < bestDistance) {
        bestDistance = distance;
        bestId = spec.entityId;
      }
    }

    return bestId;
  }

  getColumnIndexFromViewportX(viewportX: number): number {
    const contentX = viewportX + this.ctx.get(ViewportSlice).$scroll.get().x;
    const columns = this.ctx.get(ColumnsSlice).$columns.get();
    if (columns.length === 0) return 0;
    if (contentX < columns[0]!.x) return 0;
    for (let i = 0; i < columns.length; i++) {
      const col = columns[i]!;
      if (contentX >= col.x && contentX < col.x + col.width) {
        return i;
      }
    }
    return columns.length - 1;
  }

  computePulseFromViewportY(viewportY: number): number {
    const scrollTop = this.ctx.get(ViewportSlice).$scroll.get().y;
    const contentY = viewportY + scrollTop;
    const trackHeight = this.ctx.get(ViewportSlice).getTrackHeight();
    const scaleY = this.ctx.get(ViewportSlice).getScaleY();
    return (trackHeight - contentY) / scaleY;
  }

  recomputeCursorPulse(): void {
    const viewportY = this.ctx.get(CursorSlice).$cursorViewportPos.get().y;
    if (viewportY < 0) return;
    const scrollTop = this.ctx.get(ViewportSlice).$scroll.get().y;
    const contentY = viewportY + scrollTop;
    const trackHeight = this.ctx.get(ViewportSlice).getTrackHeight();
    const scaleY = this.ctx.get(ViewportSlice).getScaleY();
    const rawPulse = (trackHeight - contentY) / scaleY;
    const snappedPulse = this.snapToGrid(rawPulse);
    this.ctx.get(CursorSlice).$cursorPulse.set(snappedPulse);
  }

  private snapToGrid(pulse: number): number {
    return this.ctx
      .get(TimingSlice)
      .getTimingEngine()
      .snapPulse(pulse, this.ctx.get(SnapSlice).$snap.get());
  }

  handlePointerDown(point: Point, shiftKey: boolean = false): void {
    const activeTool = this.ctx.get(ToolSlice).$activeTool.get();

    if (activeTool === "pencil") {
      const contentX = point.x + this.ctx.get(ViewportSlice).$scroll.get().x;
      const columns = this.ctx.get(ColumnsSlice).$columns.get();
      const column = columns.find((c) => contentX >= c.x && contentX < c.x + c.width);
      if (!column?.placementHandler) return;

      const pulse = this.snapToGrid(this.computePulseFromViewportY(point.y));
      const entity = column.placementHandler(pulse);
      if (!entity) return;

      const previousSelection = new Set(this.ctx.get(SelectionSlice).$selection.get());
      this.ctx
        .get(HistorySlice)
        .applyAction(
          new PlaceEntityUserAction(
            this.ctx,
            entity,
            column.id,
            previousSelection,
            this.$lastPlacedEntityInfo,
          ),
        );
      return;
    }

    if (activeTool === "erase") {
      const hit = this.hitTest(point);
      if (hit) {
        const entity = this.ctx.get(ProjectSlice).entityManager.get(hit);
        if (entity) {
          this.ctx
            .get(HistorySlice)
            .applyAction(new EraseUserAction(this.ctx, hit, structuredClone(entity)));
        }
      }
      return;
    }

    const hit = this.hitTest(point);
    if (hit) {
      const currentSelection = this.ctx.get(SelectionSlice).$selection.get();
      const em = this.ctx.get(ProjectSlice).entityManager;

      // Determine the selection that will be dragged
      let dragSelection: Set<string>;
      if (shiftKey) {
        if (currentSelection.has(hit)) {
          // Shift+click on a selected event preserves selection (preparing to drag)
          dragSelection = currentSelection;
        } else {
          // Shift+click on an unselected event adds it to selection
          const next = new Set(currentSelection);
          next.add(hit);
          this.ctx.get(SelectionSlice).$selection.set(next);
          dragSelection = next;
        }
      } else {
        if (currentSelection.has(hit)) {
          // Clicked a selected event — preserve selection
          dragSelection = currentSelection;
        } else {
          // Clicked an unselected event — select it
          dragSelection = new Set([hit]);
          this.ctx.get(SelectionSlice).$selection.set(dragSelection);
        }
      }

      // Enter drag-pending state for the drag selection
      const originalPulses = new Map<string, number>();
      for (const entityId of dragSelection) {
        const entity = em.get(entityId);
        if (entity) {
          const event = entity.components[EVENT.key];
          if (event) {
            originalPulses.set(entityId, (event as { y: number }).y);
          }
        }
      }
      const hitEntity = em.get(hit);
      const hitEvent = hitEntity?.components[EVENT.key] as { y: number } | undefined;
      const startPulse = hitEvent?.y ?? this.snapToGrid(this.computePulseFromViewportY(point.y));
      this.ctx
        .get(DragSlice)
        .startDrag(point.y, Array.from(dragSelection), originalPulses, startPulse);
    } else {
      const colIndex = this.getColumnIndexFromViewportX(point.x);
      const pulse = this.computePulseFromViewportY(point.y);
      this.ctx.get(BoxSelectionSlice).start(colIndex, pulse);
      if (!shiftKey) {
        this.ctx.get(SelectionSlice).$selection.set(new Set());
      }
    }
  }

  handlePointerMove(viewportX: number, viewportY: number): void {
    const dragSlice = this.ctx.get(DragSlice);
    if (dragSlice.isActive()) {
      const currentPulse = this.snapToGrid(this.computePulseFromViewportY(viewportY));
      dragSlice.updateDrag(viewportY, currentPulse);
      this.ctx.get(RenderSlice).refresh();
    } else if (this.ctx.get(BoxSelectionSlice).isActive()) {
      this.ctx
        .get(BoxSelectionSlice)
        .update(
          this.getColumnIndexFromViewportX(viewportX),
          this.computePulseFromViewportY(viewportY),
        );
    }
    this.ctx.get(CursorSlice).$cursorViewportPos.set({ x: viewportX, y: viewportY });
    this.recomputeCursorPulse();
  }

  handlePointerUp(): void {
    const dragSlice = this.ctx.get(DragSlice);
    const delta = dragSlice.getDeltaPulse();
    const originalPulses = dragSlice.getOriginalPulses();
    const wasDragging = dragSlice.isDragging();
    dragSlice.endDrag();

    if (wasDragging && delta !== 0) {
      const em = this.ctx.get(ProjectSlice).entityManager;
      const edits: {
        entityId: string;
        oldComponents: Record<string, unknown>;
        newComponents: Record<string, unknown>;
      }[] = [];

      for (const [entityId, originalPulse] of originalPulses) {
        const entity = em.get(entityId);
        if (!entity) continue;
        const newComponents = structuredClone(entity.components);
        const event = newComponents[EVENT.key] as { y: number };
        event.y = originalPulse + delta;
        edits.push({ entityId, oldComponents: structuredClone(entity.components), newComponents });
      }

      if (edits.length > 0) {
        this.ctx.get(HistorySlice).applyAction(new BatchEditEntitiesUserAction(this.ctx, edits));
      }
    }

    if (!this.ctx.get(BoxSelectionSlice).isActive()) return;
    this.ctx
      .get(BoxSelectionSlice)
      .finalize(this.ctx.get(ProjectSlice).entityManager.entitiesWithComponent(EVENT));
  }
}
