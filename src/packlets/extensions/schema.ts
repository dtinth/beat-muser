import { Type } from "typebox";

export const ExtensionManifestSchema = Type.Object(
  {
    $schema: Type.Optional(
      Type.String({
        description: "URL to the JSON Schema for validation.",
      }),
    ),
    id: Type.String({
      description: 'Unique extension identifier, e.g. "com.example.touch".',
    }),
    name: Type.String({
      description: "Display name of the extension.",
    }),
    version: Type.String({
      description: "Semantic version string.",
    }),
    gameModes: Type.Optional(
      Type.Array(
        Type.Object({
          mode: Type.String({
            description: 'Game mode identifier, e.g. "touch-4k".',
          }),
          lanes: Type.Array(
            Type.Object({
              laneIndex: Type.Number({
                description: "Lane index used in note entities.",
              }),
              name: Type.String({
                description: "Display name for the lane.",
              }),
              width: Type.Number({
                description: "Width of the lane in pixels.",
              }),
              backgroundColor: Type.Optional(
                Type.String({
                  description: "Background color CSS variable or value.",
                }),
              ),
              noteColor: Type.String({
                description: "Note color CSS variable or value.",
              }),
            }),
            { description: "Ordered lane definitions from left to right." },
          ),
          keysounds: Type.Optional(
            Type.Boolean({
              description: "Whether this mode supports keysounding.",
            }),
          ),
        }),
        { description: "Game modes contributed by this extension." },
      ),
    ),
    components: Type.Optional(
      Type.Record(
        Type.String(),
        Type.Object(
          {
            type: Type.String({
              description: 'Value type ("number", "string", "boolean", "object").',
            }),
            description: Type.Optional(
              Type.String({
                description: "Human-readable description of the component.",
              }),
            ),
            properties: Type.Optional(
              Type.Record(
                Type.String(),
                Type.Object({
                  type: Type.String({
                    description: "Property value type.",
                  }),
                }),
              ),
            ),
          },
          {
            additionalProperties: true,
            description: "Schema for a custom entity component.",
          },
        ),
        { description: "Custom entity component schemas declared by this extension." },
      ),
    ),
    commands: Type.Optional(
      Type.Array(
        Type.Object({
          id: Type.String({
            description: "Unique command identifier.",
          }),
          title: Type.String({
            description: "Display name shown in the command palette.",
          }),
        }),
        { description: "Commands contributed by this extension." },
      ),
    ),
    exporters: Type.Optional(
      Type.Array(
        Type.Object({
          id: Type.String({
            description: "Unique exporter identifier.",
          }),
          gameModes: Type.Array(
            Type.String({
              description: "Game modes this exporter applies to.",
            }),
            {
              description:
                "Export triggers when a saved project contains a level matching any of these modes.",
            },
          ),
          commandId: Type.String({
            description: "Command to execute during export.",
          }),
        }),
        { description: "Exporters contributed by this extension." },
      ),
    ),
  },
  {
    additionalProperties: false,
    description: "Extension manifest for beat-muser.",
    title: "Beat Muser Extension Manifest",
  },
);
