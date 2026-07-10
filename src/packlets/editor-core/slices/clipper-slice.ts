import { uuidv7 } from "uuidv7";
import { Slice } from "../slice.ts";
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

function hasKey<K extends string>(value: unknown, key: K): value is Record<K, unknown> {
  return typeof value === "object" && value !== null && key in value;
}

function isClipboardEntry(value: unknown): value is ClipboardEntry {
  return (
    hasKey(value, "$schema") &&
    value["$schema"] === CLIPBOARD_SCHEMA &&
    hasKey(value, "e") &&
    Array.isArray(value["e"])
  );
}

export class ClipperSlice extends Slice {
  static readonly sliceKey = "clipper";

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
    if (entry.e.length === 0) return;

    const cursorPulse = this.ctx.get(CursorSlice).$cursorPulse.get();

    let minPulse = Infinity;
    for (const components of entry.e) {
      const event = components["event"];
      if (hasKey(event, "y")) {
        const y = event["y"];
        if (typeof y === "number" && y < minPulse) {
          minPulse = y;
        }
      }
    }
    if (!isFinite(minPulse)) return;

    const delta = cursorPulse - minPulse;

    const previousSelection = this.ctx.get(SelectionSlice).$selection.get();

    const newEntities = entry.e
      .filter((components) => this.hasValidColumn(components))
      .map((components) => {
        const cloned = structuredClone(components);
        const event = cloned["event"];
        if (hasKey(event, "y")) {
          const y = event["y"];
          if (typeof y === "number") {
            cloned["event"] = { ...event, y: y + delta };
          }
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
    const note = components["note"];
    const levelRef = components["levelRef"];
    if (hasKey(note, "lane") && hasKey(levelRef, "levelId")) {
      return columns.some(
        (col) => col.levelId === levelRef["levelId"] && col.laneIndex === note["lane"],
      );
    }
    const soundEvent = components["soundEvent"];
    if (hasKey(soundEvent, "soundLane")) {
      return columns.some((col) => col.soundLane === soundEvent["soundLane"]);
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
      const textItems = items.filter((item) => item.types.includes("text/plain"));
      const blobs = await Promise.all(textItems.map((item) => item.getType("text/plain")));
      const texts = await Promise.all(blobs.map((blob) => blob.text()));
      for (const text of texts) {
        const data: unknown = JSON.parse(text);
        if (isClipboardEntry(data)) {
          return data;
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
