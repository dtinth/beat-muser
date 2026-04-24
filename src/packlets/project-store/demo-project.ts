import type { ProjectFile } from "../project-format";
import type { Entity } from "../entity-manager";

export function createDemoProjectFile(): ProjectFile {
  const chartId = crypto.randomUUID();
  const levelId = crypto.randomUUID();
  const entities: Entity[] = [
    {
      id: chartId,
      version: crypto.randomUUID(),
      components: {
        chart: { name: "Hard", size: 15360 },
      },
    },
    {
      id: levelId,
      version: crypto.randomUUID(),
      components: {
        level: { name: "Hard", mode: "beat-7k", sortOrder: 0 },
        chartRef: { chartId },
      },
    },
    {
      id: crypto.randomUUID(),
      version: crypto.randomUUID(),
      components: {
        event: { y: 0 },
        bpmChange: { bpm: 128 },
        chartRef: { chartId },
      },
    },
    {
      id: crypto.randomUUID(),
      version: crypto.randomUUID(),
      components: {
        event: { y: 2880 },
        bpmChange: { bpm: 160 },
        chartRef: { chartId },
      },
    },
    {
      id: crypto.randomUUID(),
      version: crypto.randomUUID(),
      components: {
        event: { y: 0 },
        timeSignature: { numerator: 4, denominator: 4 },
        chartRef: { chartId },
      },
    },
    {
      id: crypto.randomUUID(),
      version: crypto.randomUUID(),
      components: {
        event: { y: 3840 },
        timeSignature: { numerator: 3, denominator: 4 },
        chartRef: { chartId },
      },
    },
    // Sample notes on lane 0 and lane 7 (turntable)
    {
      id: crypto.randomUUID(),
      version: crypto.randomUUID(),
      components: {
        event: { y: 240 },
        note: { lane: 0 },
        levelRef: { levelId },
        chartRef: { chartId },
      },
    },
    {
      id: crypto.randomUUID(),
      version: crypto.randomUUID(),
      components: {
        event: { y: 480 },
        note: { lane: 7 },
        levelRef: { levelId },
        chartRef: { chartId },
      },
    },
    {
      id: crypto.randomUUID(),
      version: crypto.randomUUID(),
      components: {
        event: { y: 960 },
        note: { lane: 3 },
        levelRef: { levelId },
        chartRef: { chartId },
      },
    },
    {
      id: crypto.randomUUID(),
      version: crypto.randomUUID(),
      components: {
        event: { y: 1200 },
        note: { lane: 0 },
        levelRef: { levelId },
        chartRef: { chartId },
      },
    },
    {
      id: crypto.randomUUID(),
      version: crypto.randomUUID(),
      components: {
        event: { y: 1440 },
        note: { lane: 7 },
        levelRef: { levelId },
        chartRef: { chartId },
      },
    },
  ];

  return {
    schemaVersion: 2,
    version: crypto.randomUUID(),
    metadata: {
      title: "Demo Project",
      artist: "Beat Muser",
      genre: "Demo",
    },
    entities,
    deletedEntities: [],
  };
}
