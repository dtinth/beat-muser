import { uuidv7 } from "uuidv7";
import type { ProjectFile } from "../project-format";
import type { Entity } from "../entity-manager";

export function createDemoProjectFile(): ProjectFile {
  const chartId = uuidv7();
  const levelId = uuidv7();
  const entities: Entity[] = [
    {
      id: chartId,
      version: uuidv7(),
      components: {
        chart: { name: "Hard", size: 15360 },
      },
    },
    {
      id: levelId,
      version: uuidv7(),
      components: {
        level: { name: "Hard", mode: "beat-7k", sortOrder: 0 },
        chartRef: { chartId },
      },
    },
    {
      id: uuidv7(),
      version: uuidv7(),
      components: {
        event: { y: 0 },
        bpmChange: { bpm: 128 },
        chartRef: { chartId },
      },
    },
    {
      id: uuidv7(),
      version: uuidv7(),
      components: {
        event: { y: 2880 },
        bpmChange: { bpm: 160 },
        chartRef: { chartId },
      },
    },
    {
      id: uuidv7(),
      version: uuidv7(),
      components: {
        event: { y: 0 },
        timeSignature: { numerator: 4, denominator: 4 },
        chartRef: { chartId },
      },
    },
    {
      id: uuidv7(),
      version: uuidv7(),
      components: {
        event: { y: 3840 },
        timeSignature: { numerator: 3, denominator: 4 },
        chartRef: { chartId },
      },
    },
    // Sample notes across SC and keys 1-7
    {
      id: uuidv7(),
      version: uuidv7(),
      components: {
        event: { y: 240 },
        note: { lane: 8 },
        levelRef: { levelId },
        chartRef: { chartId },
      },
    },
    {
      id: uuidv7(),
      version: uuidv7(),
      components: {
        event: { y: 480 },
        note: { lane: 1 },
        levelRef: { levelId },
        chartRef: { chartId },
      },
    },
    {
      id: uuidv7(),
      version: uuidv7(),
      components: {
        event: { y: 960 },
        note: { lane: 4 },
        levelRef: { levelId },
        chartRef: { chartId },
      },
    },
    {
      id: uuidv7(),
      version: uuidv7(),
      components: {
        event: { y: 1200 },
        note: { lane: 8 },
        levelRef: { levelId },
        chartRef: { chartId },
      },
    },
    {
      id: uuidv7(),
      version: uuidv7(),
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
    version: uuidv7(),
    metadata: {
      title: "Demo Project",
      artist: "Beat Muser",
      genre: "Demo",
    },
    entities,
  };
}
