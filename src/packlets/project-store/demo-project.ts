import type { ProjectFile } from "../project-format";
import type { Entity } from "../entity-manager";

export function createDemoProjectFile(): ProjectFile {
  const chartId = crypto.randomUUID();
  const entities: Entity[] = [
    {
      id: chartId,
      version: crypto.randomUUID(),
      components: {
        chart: { name: "Hard", mode: "beat-7k", size: 15360 },
      },
    },
    {
      id: crypto.randomUUID(),
      version: crypto.randomUUID(),
      components: {
        event: { y: 0 },
        bpmChange: { bpm: 128 },
      },
    },
    {
      id: crypto.randomUUID(),
      version: crypto.randomUUID(),
      components: {
        event: { y: 2880 },
        bpmChange: { bpm: 160 },
      },
    },
    {
      id: crypto.randomUUID(),
      version: crypto.randomUUID(),
      components: {
        event: { y: 0 },
        timeSignature: { numerator: 4, denominator: 4 },
      },
    },
    {
      id: crypto.randomUUID(),
      version: crypto.randomUUID(),
      components: {
        event: { y: 3840 },
        timeSignature: { numerator: 3, denominator: 4 },
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
