import { useEffect } from "react";
import { useParams, useRouteError } from "react-router";
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
  ZoomOut,
  ZoomIn,
} from "lucide-react";
import { useToast } from "../toast";
import { ProjectLayout } from "../project-layout";
import {
  Toolbar,
  ToolbarGroup,
  ToolbarDivider,
  ToolbarButton,
  ToolbarDropdown,
  TransportDisplay,
} from "../toolbar";

export function ProjectViewPage() {
  const { slug: _slug } = useParams<{ slug: string }>();
  const error = useRouteError() as Error | undefined;
  const { showError } = useToast();

  useEffect(() => {
    if (error) {
      showError({
        title: "Failed to load project",
        description: error.message,
      });
    }
  }, [error, showError]);

  return (
    <ProjectLayout
      toolbar={
        <Toolbar>
          <ToolbarGroup label="Mode">
            <ToolbarButton icon={<MousePointer2 size={16} />} label="Select" active />
            <ToolbarButton icon={<Pencil size={16} />} label="Pencil" />
            <ToolbarButton icon={<Eraser size={16} />} label="Erase" />
            <ToolbarButton icon={<Hand size={16} />} label="Pan" />
          </ToolbarGroup>

          <ToolbarDivider />

          <ToolbarGroup label="History">
            <ToolbarButton icon={<Undo2 size={16} />} label="Undo" />
            <ToolbarButton icon={<Redo2 size={16} />} label="Redo" />
            <ToolbarButton icon={<Save size={16} />} label="Save" />
          </ToolbarGroup>

          <ToolbarDivider />

          <ToolbarGroup label="Transport">
            <ToolbarButton icon={<Play size={16} />} label="Play" />
            <ToolbarButton icon={<Pause size={16} />} label="Pause" />
            <TransportDisplay />
          </ToolbarGroup>

          <ToolbarDivider />

          <ToolbarGroup label="Snap">
            <ToolbarDropdown
              value="1/16"
              options={["1/1", "1/2", "1/4", "1/8", "1/12", "1/16", "1/32", "1/64"]}
            />
          </ToolbarGroup>

          <ToolbarDivider />

          <ToolbarGroup label="Zoom">
            <ToolbarButton icon={<ZoomOut size={16} />} label="Zoom Out" />
            <ToolbarDropdown
              value="100%"
              options={["25%", "50%", "75%", "100%", "125%", "150%", "200%", "400%"]}
            />
            <ToolbarButton icon={<ZoomIn size={16} />} label="Zoom In" />
          </ToolbarGroup>
        </Toolbar>
      }
    />
  );
}
