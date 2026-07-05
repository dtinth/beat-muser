import { atom } from "nanostores";
import { Slice } from "../slice.ts";
import type { EditorContext } from "../editor-context.ts";
import { ProjectSlice } from "./project-slice.ts";
import { ViewportSlice } from "./viewport-slice.ts";
import { ColumnsSlice } from "./columns-slice.ts";
import { CursorSlice } from "./cursor-slice.ts";
import { SelectionSlice } from "./selection-slice.ts";
import { BoxSelectionSlice } from "./box-selection-slice.ts";
import { ToolSlice } from "./tool-slice.ts";
import { SnapSlice } from "./snap-slice.ts";
import { RenderSlice } from "./render-slice.ts";
import { HistorySlice } from "./history-slice.ts";
import { TimingSlice } from "./timing-slice.ts";
import { DragSlice } from "./drag-slice.ts";
import { PlaybackSlice } from "./playback-slice.ts";
import { LevelSlice } from "./level-slice.ts";
import { EVENT, LEVEL_REF } from "../components.ts";
import { Point, Rect } from "../../geometry/index.ts";
import { EraseUserAction, PlaceEntityUserAction } from "../user-actions.ts";
import { EditBatchBuilder } from "../edit-batch-builder.ts";
import { buildFlatList, findFlatIndex } from "./column-flat-list.ts";
import type { TimelineColumn } from "../types.ts";
import { getPulse } from "../entity-accessors.ts";

export class PointerInteractionSlice extends Slice {
  static readonly sliceKey = "pointer-interaction";

  $lastPlacedEntityInfo = atom<{ entityId: string; columnId: string } | null>(null);

  private lastCompatibleColumnIndex: number | null = null;
  private dragFlatList: TimelineColumn[] = [];

  constructor(ctx: EditorContext) {
    super(ctx);
  }

  hitTest(point: Point): string | null {
    const scroll = this.ctx.get(ViewportSlice).$scroll.get();
    const contentX = point.x + scroll.x;
    const contentY = point.y + scroll.y;

    const specs = this.ctx.get(RenderSlice).getVisibleRenderObjects();
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

  placeAtCursor(): void {
    if (this.ctx.get(PlaybackSlice).$transportState.get() === "playing") return;
    const columnId = this.ctx.get(CursorSlice).$cursorColumnId.get();
    if (!columnId) return;
    const columns = this.ctx.get(ColumnsSlice).$columns.get();
    const column = columns.find((c) => c.id === columnId);
    if (!column?.placementHandler) return;
    const pulse = this.ctx.get(CursorSlice).$cursorPulse.get();
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
          // Clicked an unselected event — select it and switch to its level
          dragSelection = new Set([hit]);
          this.ctx.get(SelectionSlice).$selection.set(dragSelection);
          const hitEntity = em.get(hit);
          if (hitEntity) {
            const lr = em.getComponent(hitEntity, LEVEL_REF);
            if (lr) this.ctx.get(LevelSlice).setSelectedLevelId(lr.levelId);
          }
        }
      }

      // Enter drag-pending state for the drag selection
      const originalPulses = new Map<string, number>();
      for (const entityId of dragSelection) {
        const entity = em.get(entityId);
        if (!entity) continue;
        const pulse = getPulse(entity);
        if (pulse !== undefined) originalPulses.set(entityId, pulse);
      }
      const hitEntity = em.get(hit);
      const startPulse =
        getPulse(hitEntity!) ?? this.snapToGrid(this.computePulseFromViewportY(point.y));

      // ---------- horizontal dragging support ----------
      const columns = this.ctx.get(ColumnsSlice).$columns.get();
      const anchorColumn = columns.find((c) => c.containsEntity?.(hitEntity!));
      const flatList = anchorColumn ? buildFlatList(columns, anchorColumn) : [];
      const startColumnIndex = anchorColumn ? (findFlatIndex(flatList, anchorColumn.id) ?? 0) : 0;

      const originalColumnIndices = new Map<string, number>();
      for (const entityId of dragSelection) {
        const entity = em.get(entityId);
        if (!entity) continue;
        const col = flatList.find((c) => c.containsEntity?.(entity));
        if (col) {
          const idx = findFlatIndex(flatList, col.id);
          if (idx !== undefined) originalColumnIndices.set(entityId, idx);
        }
      }

      this.dragFlatList = flatList;
      this.lastCompatibleColumnIndex = startColumnIndex;

      this.ctx.get(DragSlice).startDrag({
        viewportY: point.y,
        entityIds: Array.from(dragSelection),
        originalPulses,
        startPulse,
        viewportX: point.x,
        originalColumnIndices,
        startColumnIndex,
      });
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
    const playbackSlice = this.ctx.get(PlaybackSlice);

    if (dragSlice.isActive()) {
      const currentPulse = this.snapToGrid(this.computePulseFromViewportY(viewportY));

      let currentColumnIndex: number | undefined;
      let maxColumnIndex: number | undefined;
      const columns = this.ctx.get(ColumnsSlice).$columns.get();
      const colIdx = this.getColumnIndexFromViewportX(viewportX);
      const targetCol = columns[colIdx];
      const flatList = this.dragFlatList;

      if (flatList.length > 0) {
        maxColumnIndex = flatList.length - 1;
        const idx = findFlatIndex(flatList, targetCol?.id ?? "");
        if (idx !== undefined) {
          currentColumnIndex = idx;
          this.lastCompatibleColumnIndex = idx;
        } else if (this.lastCompatibleColumnIndex !== null) {
          currentColumnIndex = this.lastCompatibleColumnIndex;
        }
      }

      dragSlice.updateDrag({
        viewportY,
        pulse: currentPulse,
        viewportX,
        columnIndex: currentColumnIndex,
        maxColumnIndex,
      });
      this.ctx.get(RenderSlice).requestRerender();
    } else if (this.ctx.get(BoxSelectionSlice).isActive()) {
      this.ctx
        .get(BoxSelectionSlice)
        .update(
          this.getColumnIndexFromViewportX(viewportX),
          this.computePulseFromViewportY(viewportY),
        );
    }
    const contentX = viewportX + this.ctx.get(ViewportSlice).$scroll.get().x;
    const columns = this.ctx.get(ColumnsSlice).$columns.get();
    const hoveredColumn = columns.find((c) => contentX >= c.x && contentX < c.x + c.width);
    this.ctx.get(CursorSlice).$cursorColumnId.set(hoveredColumn?.id ?? null);
    if (playbackSlice.$transportState.get() === "playing") return;
    this.ctx.get(CursorSlice).$cursorViewportPos.set({ x: viewportX, y: viewportY });
    this.recomputeCursorPulse();
  }

  handlePointerUp(): void {
    const dragSlice = this.ctx.get(DragSlice);
    const delta = dragSlice.getDeltaPulse();
    const originalPulses = dragSlice.getOriginalPulses();
    const wasDragging = dragSlice.isDragging();
    const deltaColumnIndex = dragSlice.getDeltaColumnIndex();
    const originalColumnIndices = dragSlice.getOriginalColumnIndices();
    const flatList = this.dragFlatList;
    dragSlice.endDrag();
    this.dragFlatList = [];

    if (wasDragging && (delta !== 0 || deltaColumnIndex !== 0)) {
      const em = this.ctx.get(ProjectSlice).entityManager;
      const batch = new EditBatchBuilder(em);

      for (const [entityId, originalPulse] of originalPulses) {
        const entity = em.get(entityId);
        if (!entity) continue;
        batch.setPulse(entityId, originalPulse + delta);

        if (deltaColumnIndex !== 0 && originalColumnIndices.has(entityId)) {
          const newIndex = originalColumnIndices.get(entityId)! + deltaColumnIndex;
          if (newIndex >= 0 && newIndex < flatList.length) {
            flatList[newIndex]!.moveEntityTo?.(batch, em, entity);
          }
        }
      }

      if (batch.getModifiedEntityIds().size > 0) {
        this.ctx.get(HistorySlice).applyAction(batch.toUserAction(this.ctx));
      }
    }

    if (!this.ctx.get(BoxSelectionSlice).isActive()) return;
    this.ctx
      .get(BoxSelectionSlice)
      .finalize(this.ctx.get(ProjectSlice).entityManager.entitiesWithComponent(EVENT));
  }

  /**
   * Abort the in-progress interaction without committing it. Fired when the
   * browser takes over the pointer (e.g. a touch-scroll starts), which emits a
   * `pointercancel` and no matching `pointerup`. Discards any pending drag or
   * box selection so the editor doesn't get stuck in a dragging state.
   */
  handlePointerCancel(): void {
    this.ctx.get(DragSlice).cancelDrag();
    this.dragFlatList = [];
    this.ctx.get(BoxSelectionSlice).cancel();
    this.ctx.get(RenderSlice).requestRerender();
  }
}
