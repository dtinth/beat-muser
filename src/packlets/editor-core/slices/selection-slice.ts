import { atom } from "nanostores";
import { Slice } from "../slice.ts";

export class SelectionSlice extends Slice {
  static readonly sliceKey = "selection";

  $selection = atom<Set<string>>(new Set());
}
