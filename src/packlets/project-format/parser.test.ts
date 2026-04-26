/**
 * Unit tests for the Beat Muser project format schema and parser.
 *
 * These tests verify:
 * - Valid project files parse correctly
 * - Missing required fields are rejected
 * - Wrong types are rejected
 * - Additional properties are allowed on component objects (open schema)
 * - Multiple entities are supported
 * - Entity components with plugin-specific attributes pass
 */

import { describe, it, expect } from "vite-plus/test";
import { parseProjectFile } from "./parser";
import { ProjectFileSchema } from "./schema";
import { Build } from "typebox/schema";
import { Value } from "typebox/value";

function makeProject(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    schemaVersion: 2,
    version: "01HQABCDEFGHJKMNPQRSTVWXYZ0",
    metadata: {
      title: "Test Song",
      artist: "Test Artist",
      genre: "Test Genre",
    },
    entities: [
      {
        id: "01HQABCDEFGHJKMNPQRSTVWXYZ1",
        version: "01HQABCDEFGHJKMNPQRSTVWXYZ1",
        components: {
          chart: { name: "Hard" },
        },
      },
      {
        id: "01HQABCDEFGHJKMNPQRSTVWXYZ2",
        version: "01HQABCDEFGHJKMNPQRSTVWXYZ2",
        components: {
          event: { y: 0 },
          chartRef: { chartId: "01HQABCDEFGHJKMNPQRSTVWXYZ1" },
          note: { lane: 0 },
        },
      },
    ],
    ...overrides,
  });
}

describe("parseProjectFile", () => {
  it("parses a valid minimal project", () => {
    const result = parseProjectFile(makeProject());
    expect(result.schemaVersion).toBe(2);
    expect(result.metadata.title).toBe("Test Song");
    expect(result.entities).toHaveLength(2);
    expect(result.entities[0].components.chart).toEqual({ name: "Hard" });
    expect(result.entities[1].components.note).toEqual({ lane: 0 });
  });

  it("parses a project with $schema field", () => {
    const result = parseProjectFile(
      makeProject({
        $schema: "https://beat-muser.pages.dev/schemas/beat-muser-project.schema.json",
      }),
    );
    expect(result.$schema).toBe(
      "https://beat-muser.pages.dev/schemas/beat-muser-project.schema.json",
    );
  });

  it("allows additional properties on component objects (open schema)", () => {
    const result = parseProjectFile(
      makeProject({
        metadata: {
          title: "Test Song",
          artist: "Test Artist",
          genre: "Test Genre",
          bpm: 180,
          previewStart: 30,
        },
        entities: [
          {
            id: "01HQABCDEFGHJKMNPQRSTVWXYZ1",
            version: "01HQABCDEFGHJKMNPQRSTVWXYZ1",
            components: {
              chart: { name: "Hard", difficulty: 12 },
            },
          },
          {
            id: "01HQABCDEFGHJKMNPQRSTVWXYZ3",
            version: "01HQABCDEFGHJKMNPQRSTVWXYZ3",
            components: {
              event: { y: 240 },
              chartRef: { chartId: "01HQABCDEFGHJKMNPQRSTVWXYZ1" },
              note: { lane: 0, channel: "A" },
            },
          },
          {
            id: "01HQABCDEFGHJKMNPQRSTVWXYZ4",
            version: "01HQABCDEFGHJKMNPQRSTVWXYZ4",
            components: {
              event: { y: 1920 },
              chartRef: { chartId: "01HQABCDEFGHJKMNPQRSTVWXYZ1" },
              bpmChange: { bpm: 120 },
            },
          },
          {
            id: "01HQABCDEFGHJKMNPQRSTVWXYZ5",
            version: "01HQABCDEFGHJKMNPQRSTVWXYZ5",
            components: {
              event: { y: 2880 },
              chartRef: { chartId: "01HQABCDEFGHJKMNPQRSTVWXYZ1" },
              sound: { path: "audio/kick.wav" },
            },
          },
        ],
        customTopLevel: 42,
      }),
    );
    expect((result.metadata as any).bpm).toBe(180);
    expect((result.entities[0].components.chart as any).difficulty).toBe(12);
    expect((result.entities[1].components.note as any).channel).toBe("A");
    expect((result as any).customTopLevel).toBe(42);
  });

  it("supports multiple entities", () => {
    const result = parseProjectFile(
      makeProject({
        entities: [
          {
            id: "01HQABCDEFGHJKMNPQRSTVWXYZ1",
            version: "01HQABCDEFGHJKMNPQRSTVWXYZ1",
            components: {
              chart: { name: "Easy" },
            },
          },
          {
            id: "01HQABCDEFGHJKMNPQRSTVWXYZ2",
            version: "01HQABCDEFGHJKMNPQRSTVWXYZ2",
            components: {
              chart: { name: "Hard" },
            },
          },
        ],
      }),
    );
    expect(result.entities).toHaveLength(2);
    expect(result.entities[0].components.chart.name).toBe("Easy");
    expect(result.entities[1].components.chart.name).toBe("Hard");
  });

  it("rejects missing schemaVersion", () => {
    const { schemaVersion: _schemaVersion, ...rest } = JSON.parse(makeProject());
    expect(() => parseProjectFile(JSON.stringify(rest))).toThrow("Invalid project file");
  });

  it("rejects missing metadata", () => {
    const { metadata: _metadata, ...rest } = JSON.parse(makeProject());
    expect(() => parseProjectFile(JSON.stringify(rest))).toThrow("Invalid project file");
  });

  it("rejects missing entities", () => {
    const { entities: _entities, ...rest } = JSON.parse(makeProject());
    expect(() => parseProjectFile(JSON.stringify(rest))).toThrow("Invalid project file");
  });

  it("rejects missing metadata.title", () => {
    const invalid = makeProject({
      metadata: { artist: "Artist", genre: "Genre" },
    });
    expect(() => parseProjectFile(invalid)).toThrow("Invalid project file");
  });

  it("rejects entity without id", () => {
    const invalid = makeProject({
      entities: [{ version: "01HQABCDEFGHJKMNPQRSTVWXYZ1", components: {} }],
    });
    expect(() => parseProjectFile(invalid)).toThrow("Invalid project file");
  });

  it("rejects entity without version", () => {
    const invalid = makeProject({
      entities: [{ id: "01HQABCDEFGHJKMNPQRSTVWXYZ1", components: {} }],
    });
    expect(() => parseProjectFile(invalid)).toThrow("Invalid project file");
  });

  it("rejects entity without components", () => {
    const invalid = makeProject({
      entities: [{ id: "01HQABCDEFGHJKMNPQRSTVWXYZ1", version: "01HQABCDEFGHJKMNPQRSTVWXYZ1" }],
    });
    expect(() => parseProjectFile(invalid)).toThrow("Invalid project file");
  });

  it("rejects non-object JSON", () => {
    expect(() => parseProjectFile('"just a string"')).toThrow("Invalid project file");
    expect(() => parseProjectFile("[1, 2, 3]")).toThrow("Invalid project file");
  });

  it("rejects empty string", () => {
    expect(() => parseProjectFile("")).toThrow();
  });
});

describe("schema generates valid JSON Schema", () => {
  it("produces a schema with $schema draft", () => {
    const result = Build(ProjectFileSchema);
    const schema = result.Schema() as Record<string, unknown>;
    expect(schema).toHaveProperty("type", "object");
    expect(schema).toHaveProperty("properties");
    expect(schema.properties as any).toHaveProperty("schemaVersion");
    expect(schema.properties as any).toHaveProperty("metadata");
    expect(schema.properties as any).toHaveProperty("entities");
  });

  it("includes descriptions in generated schema", () => {
    const result = Build(ProjectFileSchema);
    const schema = result.Schema() as Record<string, unknown>;
    const props = schema.properties as any as Record<string, { description?: string }>;
    expect(props.schemaVersion.description).toContain("Schema version");
    expect(props.metadata.description).toContain("Additional project-level");
  });
});

describe("Value.Check validates correctly", () => {
  it("accepts a valid project object", () => {
    const valid = JSON.parse(makeProject());
    expect(Value.Check(ProjectFileSchema, valid)).toBe(true);
  });

  it("rejects wrong schemaVersion type", () => {
    const invalid = JSON.parse(makeProject({ schemaVersion: "2" }));
    expect(Value.Check(ProjectFileSchema, invalid)).toBe(false);
  });

  it("allows empty entities array", () => {
    const valid = JSON.parse(makeProject({ entities: [] }));
    expect(Value.Check(ProjectFileSchema, valid)).toBe(true);
  });
});
