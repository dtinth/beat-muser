import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { Build } from "typebox/schema";
import { Type } from "typebox";
import { ExtensionManifestSchema } from "../src/packlets/extensions/schema.ts";
import { ProjectFileSchema } from "../src/packlets/project-format/schema.ts";

const OUT_DIR = resolve(import.meta.dirname, "..", "ci-reports", "schemas");
mkdirSync(OUT_DIR, { recursive: true });

function write(name: string, schema: unknown) {
  const outPath = resolve(OUT_DIR, name);
  writeFileSync(outPath, JSON.stringify(schema, null, 2));
  console.log(`Generated ${outPath.replace(resolve(import.meta.dirname, "..") + "/", "")}`);
}

// Extension manifest schema
write("extension.schema.json", Build(ExtensionManifestSchema).Schema());

// Project file schema
write("beat-muser-project.schema.json", Build(ProjectFileSchema).Schema());

// Clipboard schema
const ClipboardSchema = Type.Object(
  {
    $schema: Type.String({
      description: "Schema identifier for clipboard validation.",
    }),
    e: Type.Array(Type.Record(Type.String(), Type.Unknown()), {
      description: "Array of entity component maps.",
    }),
  },
  {
    title: "Beat Muser Clipboard",
    description: "Clipboard data format for copy/paste operations.",
  },
);
write("beat-muser-clipboard.schema.json", Build(ClipboardSchema).Schema());
