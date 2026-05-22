import type { TimelineColumn } from "../types.ts";

export function buildFlatList(
  columns: TimelineColumn[],
  anchorColumn: TimelineColumn,
): TimelineColumn[] {
  if (!anchorColumn.affinity) return [];
  return columns.filter((c) => c.affinity === anchorColumn.affinity);
}

export function findFlatIndex(flatList: TimelineColumn[], columnId: string): number | undefined {
  const idx = flatList.findIndex((c) => c.id === columnId);
  return idx >= 0 ? idx : undefined;
}
