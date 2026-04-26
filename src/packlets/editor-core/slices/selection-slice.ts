import { atom } from "nanostores";
import { Slice } from "../slice";

export class SelectionSlice extends Slice {
  static readonly sliceKey = "selection";

  $selection = atom<Set<string>>(new Set());
}
