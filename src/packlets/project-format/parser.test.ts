/**
 * Unit tests for the Beat Muser project format schema and parser.
 *
 * These tests verify:
 * - Valid project files parse correctly
 * - Missing required fields are rejected
 * - Wrong types are rejected
 * - Additional properties are allowed (open schema)
 * - Multiple charts are supported
 * - Entity events with plugin-specific attributes pass
 */

import { describe, it, expect } from "vite-plus/test";
import { parseProjectFile } from "./parser";
import { ProjectFileSchema } from "./schema";
import { Build } from "typebox/schema";
import { Value } from "typebox/value";

function makeProject(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    version: 1,
    metadata: {
      title: "Test Song",
      artist: "Test Artist",
      genre: "Test Genre",
    },
    charts: [
      {
        metadata: { name: "Hard", mode: "4k" },
        entities: [{ y: 0, type: "note", lane: 0 }],
      },
    ],
    ...overrides,
  });
}

describe("parseProjectFile", () => {
  it("parses a valid minimal project", () => {
    const result = parseProjectFile(makeProject());
    expect(result.version).toBe(1);
    expect(result.metadata.title).toBe("Test Song");
    expect(result.charts).toHaveLength(1);
    expect(result.charts[0].entities).toHaveLength(1);
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

  it("allows additional properties on all objects (open schema)", () => {
    const result = parseProjectFile(
      makeProject({
        metadata: {
          title: "Test Song",
          artist: "Test Artist",
          genre: "Test Genre",
          bpm: 180,
          previewStart: 30,
        },
        charts: [
          {
            metadata: { name: "Hard", mode: "4k", difficulty: 12 },
            entities: [
              { y: 0, type: "note", lane: 0, channel: "A" },
              { y: 960, type: "bpm-change", bpm: 120 },
              { y: 1920, type: "sound", sound: "audio/kick.wav" },
            ],
            customField: "value",
          },
        ],
        customTopLevel: 42,
      }),
    );
    expect((result.metadata as any).bpm).toBe(180);
    expect((result.charts[0].metadata as any).difficulty).toBe(12);
    expect((result.charts[0].entities[0] as any).channel).toBe("A");
    expect((result.charts[0] as any).customField).toBe("value");
    expect((result as any).customTopLevel).toBe(42);
  });

  it("supports multiple charts", () => {
    const result = parseProjectFile(
      makeProject({
        charts: [
          {
            metadata: { name: "Easy", mode: "4k" },
            entities: [{ y: 0, type: "note", lane: 1 }],
          },
          {
            metadata: { name: "Hard", mode: "4k" },
            entities: [{ y: 0, type: "note", lane: 0 }],
          },
        ],
      }),
    );
    expect(result.charts).toHaveLength(2);
    expect(result.charts[0].metadata.name).toBe("Easy");
    expect(result.charts[1].metadata.name).toBe("Hard");
  });

  it("rejects missing version", () => {
    const { version: _version, ...rest } = JSON.parse(makeProject());
    expect(() => parseProjectFile(JSON.stringify(rest))).toThrow("Invalid project file");
  });

  it("rejects missing metadata", () => {
    const { metadata: _metadata, ...rest } = JSON.parse(makeProject());
    expect(() => parseProjectFile(JSON.stringify(rest))).toThrow("Invalid project file");
  });

  it("rejects missing charts", () => {
    const { charts: _charts, ...rest } = JSON.parse(makeProject());
    expect(() => parseProjectFile(JSON.stringify(rest))).toThrow("Invalid project file");
  });

  it("rejects missing metadata.title", () => {
    const invalid = makeProject({
      metadata: { artist: "Artist", genre: "Genre" },
    });
    expect(() => parseProjectFile(invalid)).toThrow("Invalid project file");
  });

  it("rejects entity without y", () => {
    const invalid = makeProject({
      charts: [
        {
          metadata: { name: "Hard", mode: "4k" },
          entities: [{ type: "note", lane: 0 }],
        },
      ],
    });
    expect(() => parseProjectFile(invalid)).toThrow("Invalid project file");
  });

  it("rejects entity without type", () => {
    const invalid = makeProject({
      charts: [
        {
          metadata: { name: "Hard", mode: "4k" },
          entities: [{ y: 0, lane: 0 }],
        },
      ],
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
    expect(schema.properties as any).toHaveProperty("version");
    expect(schema.properties as any).toHaveProperty("metadata");
    expect(schema.properties as any).toHaveProperty("charts");
  });

  it("includes descriptions in generated schema", () => {
    const result = Build(ProjectFileSchema);
    const schema = result.Schema() as Record<string, unknown>;
    const props = schema.properties as any as Record<string, { description?: string }>;
    expect(props.version.description).toContain("Schema version");
    expect(props.metadata.description).toContain("Additional project-level");
  });
});

describe("Value.Check validates correctly", () => {
  it("accepts a valid project object", () => {
    const valid = JSON.parse(makeProject());
    expect(Value.Check(ProjectFileSchema, valid)).toBe(true);
  });

  it("rejects wrong version type", () => {
    const invalid = JSON.parse(makeProject({ version: "1" }));
    expect(Value.Check(ProjectFileSchema, invalid)).toBe(false);
  });

  it("rejects empty charts array is allowed", () => {
    const valid = JSON.parse(makeProject({ charts: [] }));
    expect(Value.Check(ProjectFileSchema, valid)).toBe(true);
  });
});
