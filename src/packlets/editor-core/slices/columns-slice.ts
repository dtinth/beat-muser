import { atom } from "nanostores";
import { Slice } from "../slice";
import type { ColumnDefinition, TimelineColumn } from "../types";

export class ColumnsSlice extends Slice {
  static readonly sliceKey = "columns";

  $columns = atom<TimelineColumn[]>([]);
  $timelineWidth = atom<number>(0);

  private providers: { priority: number; provider: () => ColumnDefinition[] }[] = [];

  registerColumnProvider(priority: number, provider: () => ColumnDefinition[]): void {
    this.providers.push({ priority, provider });
    this.providers.sort((a, b) => a.priority - b.priority);
  }

  refreshColumns(): void {
    let x = 0;
    const columns: TimelineColumn[] = [];
    for (const { provider } of this.providers) {
      for (const def of provider()) {
        columns.push({ ...def, x });
        x += def.width;
      }
    }
    this.$columns.set(columns);
    this.$timelineWidth.set(x + 1);
  }
}
