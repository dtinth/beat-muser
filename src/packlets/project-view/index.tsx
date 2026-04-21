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
  Plus,
} from "lucide-react";
import { Flex, Text } from "@radix-ui/themes";
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
import { SidebarPanel } from "../sidebar-panel";

function Field({ label, value }: { label: string; value: string }) {
  return (
    <Flex direction="column" style={{ gap: 2 }}>
      <Text size="1" color="gray">
        {label}
      </Text>
      <Text size="2">{value}</Text>
    </Flex>
  );
}

const mockProject = {
  title: "Nocturne in E♭ Minor",
  artist: "Aethelgard",
  genre: "SYMPHONIC TRANCE",
};

const mockCharts = [
  { name: "ANOTHER", level: "12" },
  { name: "HYPER", level: "10" },
  { name: "NORMAL", level: "7" },
];

const mockChartInfo = {
  difficulty: "ANOTHER",
  level: "12",
  charter: "@vexcalibur",
};

const mockChartStats = {
  totalNotes: "2,418",
  longNotes: "142",
  peakNPS: "18.4",
  measures: "082",
  bpmRange: "96 — 384",
};

function LeftPanels() {
  return (
    <Flex direction="column">
      <SidebarPanel
        tabs={[
          {
            label: "Project Information",
            content: (
              <>
                <Field label="Title" value={mockProject.title} />
                <Field label="Artist" value={mockProject.artist} />
                <Field label="Genre" value={mockProject.genre} />
              </>
            ),
          },
        ]}
      />

      <SidebarPanel
        tabs={[
          {
            label: "Chart List",
            content: (
              <>
                <Flex direction="column" style={{ gap: 4 }}>
                  {mockCharts.map((chart) => (
                    <Flex
                      key={chart.name}
                      justify="between"
                      align="center"
                      style={{
                        padding: "4px 8px",
                        borderRadius: 4,
                        cursor: "pointer",
                        backgroundColor:
                          chart.name === mockChartInfo.difficulty
                            ? "var(--accent-3)"
                            : "transparent",
                      }}
                    >
                      <Text size="2">{chart.name}</Text>
                      <Text size="1" color="gray">
                        Lv. {chart.level}
                      </Text>
                    </Flex>
                  ))}
                </Flex>
                <Flex
                  justify="center"
                  style={{
                    marginTop: 8,
                    padding: "4px 8px",
                    borderRadius: 4,
                    cursor: "pointer",
                    border: "1px dashed var(--gray-6)",
                  }}
                >
                  <Plus size={14} style={{ marginRight: 4 }} />
                  <Text size="1" color="gray">
                    Add Chart
                  </Text>
                </Flex>
              </>
            ),
          },
        ]}
      />

      <SidebarPanel
        tabs={[
          {
            label: "Chart Info",
            content: (
              <>
                <Field label="Difficulty" value={mockChartInfo.difficulty} />
                <Field label="Level" value={mockChartInfo.level} />
                <Field label="Charter" value={mockChartInfo.charter} />
              </>
            ),
          },
          {
            label: "Stats",
            content: (
              <>
                <Field label="Total notes" value={mockChartStats.totalNotes} />
                <Field label="Long notes" value={mockChartStats.longNotes} />
                <Field label="Peak NPS" value={mockChartStats.peakNPS} />
                <Field label="Measures" value={mockChartStats.measures} />
                <Field label="BPM range" value={mockChartStats.bpmRange} />
              </>
            ),
          },
        ]}
      />
    </Flex>
  );
}

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
      leftPanels={<LeftPanels />}
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
