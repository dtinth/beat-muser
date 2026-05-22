import { uuidv7 } from "uuidv7";
import { Slice } from "../slice.ts";
import type { EditorContext } from "../editor-context.ts";
import { SelectionSlice } from "./selection-slice.ts";
import { ProjectSlice } from "./project-slice.ts";
import { CursorSlice } from "./cursor-slice.ts";
import { HistorySlice } from "./history-slice.ts";
import { ColumnsSlice } from "./columns-slice.ts";
import { EditorCommandSlice } from "./editor-command-slice.ts";
import { PasteEntitiesUserAction } from "../user-actions.ts";

export interface ClipboardEntry {
  $schema: string;
  e: Record<string, unknown>[];
}

export const CLIPBOARD_SCHEMA =
  "https://dtinth.github.io/beat-muser/schemas/beat-muser-clipboard.schema.json";

export class ClipperSlice extends Slice {
  static readonly sliceKey = "clipper";

  constructor(ctx: EditorContext) {
    super(ctx);
  }

  getClipboardEntry(): ClipboardEntry | null {
    const selection = this.ctx.get(SelectionSlice).$selection.get();
    if (selection.size === 0) return null;

    const entityManager = this.ctx.get(ProjectSlice).entityManager;
    const components: Record<string, unknown>[] = [];

    for (const id of selection) {
      const entity = entityManager.get(id);
      if (!entity) continue;
      components.push(structuredClone(entity.components));
    }

    if (components.length === 0) return null;

    return {
      $schema: CLIPBOARD_SCHEMA,
      e: components,
    };
  }

  pasteFromEntry(entry: ClipboardEntry): void {
    if (!entry.e || entry.e.length === 0) return;

    const cursorPulse = this.ctx.get(CursorSlice).$cursorPulse.get();

    let minPulse = Infinity;
    for (const components of entry.e) {
      const event = components["event"] as { y: number } | undefined;
      if (event && event.y < minPulse) {
        minPulse = event.y;
      }
    }
    if (!isFinite(minPulse)) return;

    const delta = cursorPulse - minPulse;

    const previousSelection = this.ctx.get(SelectionSlice).$selection.get();

    const newEntities = entry.e
      .filter((components) => this.hasValidColumn(components))
      .map((components) => {
        const cloned = structuredClone(components) as Record<string, unknown>;
        const event = cloned["event"] as { y: number };
        if (event) {
          cloned["event"] = { ...event, y: event.y + delta };
        }
        return {
          id: uuidv7(),
          version: uuidv7(),
          components: cloned,
        };
      });

    if (newEntities.length === 0) return;

    this.ctx
      .get(HistorySlice)
      .applyAction(new PasteEntitiesUserAction(this.ctx, newEntities, previousSelection));
  }

  private hasValidColumn(components: Record<string, unknown>): boolean {
    const columns = this.ctx.get(ColumnsSlice).$columns.get();
    const note = components["note"] as { lane: number } | undefined;
    const levelRef = components["levelRef"] as { levelId: string } | undefined;
    if (note && levelRef) {
      return columns.some((col) => col.levelId === levelRef.levelId && col.laneIndex === note.lane);
    }
    const soundEvent = components["soundEvent"] as { soundLane: number } | undefined;
    if (soundEvent) {
      return columns.some((col) => col.soundLane === soundEvent.soundLane);
    }
    return true;
  }

  private async writeToClipboard(entry: ClipboardEntry): Promise<void> {
    try {
      const content = JSON.stringify(entry);
      await navigator?.clipboard?.write?.([
        new ClipboardItem({ "text/plain": new Blob([content], { type: "text/plain" }) }),
      ]);
    } catch {
      // Clipboard write may fail in non-secure contexts or test environments
    }
  }

  private async readFromClipboard(): Promise<ClipboardEntry | null> {
    try {
      const items = await navigator?.clipboard?.read?.();
      if (!items) return null;
      for (const item of items) {
        if (item.types.includes("text/plain")) {
          const blob = await item.getType("text/plain");
          const text = await blob.text();
          const data = JSON.parse(text);
          if (data && data.$schema === CLIPBOARD_SCHEMA && Array.isArray(data.e)) {
            return data as ClipboardEntry;
          }
        }
      }
    } catch {
      // Clipboard read may fail
    }
    return null;
  }

  async copySelection(): Promise<void> {
    const entry = this.getClipboardEntry();
    if (!entry) return;
    await this.writeToClipboard(entry);
  }

  async paste(): Promise<void> {
    const entry = await this.readFromClipboard();
    if (!entry) return;
    this.pasteFromEntry(entry);
  }

  async cutSelection(): Promise<void> {
    await this.copySelection();
    this.ctx.get(EditorCommandSlice).deleteSelection();
  }
}
