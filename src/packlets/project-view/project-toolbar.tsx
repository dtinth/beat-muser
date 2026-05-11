/**
 * @packageDocumentation
 *
 * Toolbar component for the project view. Owns all toolbar-related
 * nanostores subscriptions (cursor pulse, transport state, snap, zoom,
 * active tool) so that the parent page does not re-render on every
 * scroll event or cursor movement.
 */

import { useState, useEffect, type FC } from "react";
import { useStore } from "@nanostores/react";
import {
  MousePointer2,
  Pencil,
  Eraser,
  Hand,
  Undo2,
  Redo2,
  Save,
  Play,
  Pause,
  StopCircle,
  ZoomOut,
  ZoomIn,
} from "lucide-react";
import {
  Toolbar,
  ToolbarGroup,
  ToolbarDivider,
  ToolbarButton,
  ToolbarDropdown,
  TransportDisplay,
} from "../toolbar";
import { globalCommandRegistry } from "../command-registry";
import type { EditorController } from "../editor-core";

const TransportGroup: FC<{ controller: EditorController }> = ({ controller }) => {
  const cursorPulse = useStore(controller.$cursorPulse);
  const transportState = useStore(controller.playback.$transportState);
  const playbackPulse = useStore(controller.playback.$playbackPulse);

  const displayPulse = transportState === "playing" ? playbackPulse : cursorPulse;

  const engine = controller.getTimingEngine();
  const timeStr = engine.formatTime(engine.pulseToSeconds(displayPulse));

  const measureInfo = engine.getMeasureAtPulse(displayPulse);
  const beatLength = 240;
  const beat = Math.floor((displayPulse - measureInfo.measureStart) / beatLength) + 1;
  const measureStr = `${measureInfo.measureIndex + 1}:${beat}`;

  return (
    <ToolbarGroup label="Transport">
      <ToolbarButton
        icon={<Play size={16} />}
        label="Play"
        onClick={() => controller.playChart(cursorPulse, controller.getScrollY())}
      />
      <ToolbarButton
        icon={<Pause size={16} />}
        label="Pause"
        onClick={() => controller.pausePlayback()}
      />
      <ToolbarButton
        icon={<StopCircle size={16} />}
        label="Stop"
        onClick={() => controller.stopPlayback()}
      />
      <TransportDisplay time={timeStr} pulse={String(displayPulse)} measure={measureStr} />
    </ToolbarGroup>
  );
};

export const ProjectToolbar: FC<{ controller: EditorController }> = ({ controller }) => {
  const snap = useStore(controller.$snap);

  const [zoom, setZoom] = useState(controller.$zoom.get());
  useEffect(() => {
    const unsub = controller.$zoom.subscribe(setZoom);
    return unsub;
  }, [controller]);

  const [activeTool, setActiveTool] = useState(controller.$activeTool.get());
  useEffect(() => {
    const unsub = controller.$activeTool.subscribe(setActiveTool);
    return unsub;
  }, [controller]);

  const zoomPercent = `${Math.round(zoom * 100)}%`;

  return (
    <Toolbar>
      <ToolbarGroup label="Mode">
        <ToolbarButton
          icon={<MousePointer2 size={16} />}
          label="Select"
          active={activeTool === "select"}
          onClick={() => controller.setTool("select")}
        />
        <ToolbarButton
          icon={<Pencil size={16} />}
          label="Pencil"
          active={activeTool === "pencil"}
          onClick={() => controller.setTool("pencil")}
        />
        <ToolbarButton
          icon={<Eraser size={16} />}
          label="Erase"
          active={activeTool === "erase"}
          onClick={() => controller.setTool("erase")}
        />
        <ToolbarButton
          icon={<Hand size={16} />}
          label="Pan"
          active={activeTool === "pan"}
          onClick={() => controller.setTool("pan")}
        />
      </ToolbarGroup>

      <ToolbarDivider />

      <ToolbarGroup label="History">
        <ToolbarButton icon={<Undo2 size={16} />} label="Undo" onClick={() => controller.undo()} />
        <ToolbarButton icon={<Redo2 size={16} />} label="Redo" onClick={() => controller.redo()} />
        <ToolbarButton
          icon={<Save size={16} />}
          label="Save"
          onClick={() => {
            globalCommandRegistry.get("saveProject")?.execute();
          }}
        />
      </ToolbarGroup>

      <ToolbarDivider />

      <TransportGroup controller={controller} />

      <ToolbarDivider />

      <ToolbarGroup label="Snap">
        <ToolbarDropdown
          value={snap}
          options={["1/4", "1/8", "1/12", "1/16", "1/24", "1/32", "1/48", "1/64"]}
          onSelect={(value) => controller.setSnap(value)}
        />
      </ToolbarGroup>

      <ToolbarDivider />

      <ToolbarGroup label="Zoom">
        <ToolbarButton
          icon={<ZoomOut size={16} />}
          label="Zoom Out"
          onClick={() => globalCommandRegistry.execute("zoomOut")}
        />
        <ToolbarDropdown
          value={zoomPercent}
          options={["25%", "50%", "75%", "100%", "125%", "150%", "200%", "400%"]}
          onSelect={(value) => {
            const pct = parseInt(value.replace("%", ""), 10);
            controller.setZoom(pct / 100);
          }}
          testId="zoom-dropdown"
        />
        <ToolbarButton
          icon={<ZoomIn size={16} />}
          label="Zoom In"
          onClick={() => globalCommandRegistry.execute("zoomIn")}
        />
      </ToolbarGroup>
    </Toolbar>
  );
};
