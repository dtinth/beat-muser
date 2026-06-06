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
    worker: Type.Optional(
      Type.String({
        description:
          "URL to the extension's Web Worker script (resolved relative to the manifest).",
      }),
    ),
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
          propertySets: Type.Optional(
            Type.Array(Type.String(), {
              description:
                "IDs of property sets whose editable properties apply to this game mode.",
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
    propertySets: Type.Optional(
      Type.Record(
        Type.String(),
        Type.Object({
          label: Type.String({
            description: "Display label for the property set in the inspector.",
          }),
          properties: Type.Record(
            Type.String(),
            Type.Object({
              component: Type.String({
                description: "Component key in entity.components that this property targets.",
              }),
              default: Type.Unknown(),
              label: Type.String({
                description: "Display label shown in the property inspector.",
              }),
              ui: Type.Optional(
                Type.Object(
                  {
                    control: Type.Optional(
                      Type.String({
                        description:
                          'Control type: "text", "number", "segmented", "slider", or "select".',
                      }),
                    ),
                    options: Type.Optional(
                      Type.Array(
                        Type.Object({
                          value: Type.Unknown(),
                          label: Type.String({
                            description: "Option label.",
                          }),
                        }),
                        {
                          description: "Options for segmented/select controls.",
                        },
                      ),
                    ),
                    min: Type.Optional(
                      Type.Number({
                        description: "Min value for number/slider controls.",
                      }),
                    ),
                    max: Type.Optional(
                      Type.Number({
                        description: "Max value for number/slider controls.",
                      }),
                    ),
                    step: Type.Optional(
                      Type.Number({
                        description: "Step value for number/slider controls.",
                      }),
                    ),
                  },
                  {
                    description: "Optional UI configuration for the inspector control.",
                  },
                ),
              ),
            }),
            {
              description: "Map of property key to property definition.",
            },
          ),
        }),
        {
          description: "Named groups of editable note attributes declared by this extension.",
        },
      ),
    ),
    coloringRules: Type.Optional(
      Type.Array(
        Type.Object({
          id: Type.String({
            description: "Unique rule identifier within the extension.",
          }),
          priority: Type.Number({
            description: "Higher values override lower. Ties break by registration order.",
          }),
          match: Type.Record(Type.String(), Type.Unknown(), {
            description:
              "MongoDB-style query against entity.components. Supports $eq, $ne, $in, $nin, $gt, $gte, $lt, $lte, $and, $or, $not.",
          }),
          apply: Type.Object({
            noteColor: Type.String({
              description: "CSS color value to use for the note when this rule matches.",
            }),
          }),
          gameModes: Type.Optional(
            Type.Array(Type.String(), {
              description:
                "Game mode IDs this rule applies to. If omitted, applies to all modes in the extension.",
            }),
          ),
        }),
        { description: "Declarative coloring rules contributed by this extension." },
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
          shortcut: Type.Optional(
            Type.String({
              description: "Keyboard shortcut, e.g. 'T', 'D', 'F', 'A', 'S'.",
            }),
          ),
          applyProperty: Type.Optional(
            Type.Object(
              {
                key: Type.String({
                  description: "Component key to set when this command is executed.",
                }),
                value: Type.Unknown(),
              },
              {
                description:
                  "If set, the command directly applies a property without needing a worker.",
              },
            ),
          ),
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
