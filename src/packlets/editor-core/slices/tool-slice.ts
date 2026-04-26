import { atom } from "nanostores";
import { createNanoEvents } from "nanoevents";
import { Slice } from "../slice";

export class ToolSlice extends Slice {
  static readonly sliceKey = "tool";

  $activeTool = atom<"select" | "pencil" | "erase" | "pan">("select");
  private events = createNanoEvents<{ toolChanged: () => void }>();

  setTool(tool: "select" | "pencil" | "erase" | "pan"): void {
    this.$activeTool.set(tool);
    this.events.emit("toolChanged");
  }

  onToolChanged(cb: () => void): () => void {
    return this.events.on("toolChanged", cb);
  }
}
