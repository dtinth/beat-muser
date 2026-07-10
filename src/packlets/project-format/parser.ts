/**
 * Parser for Beat Muser project files.
 *
 * Parses a JSON string into a validated `ProjectFile` object.
 * Throws a descriptive error if the data does not conform to the schema.
 */

import { Check, Errors } from "typebox/value";
import { ProjectFileSchema } from "./schema.ts";
import type { ProjectFile } from "./types.ts";

export function parseProjectFile(json: string): ProjectFile {
  const parsed: unknown = JSON.parse(json);
  if (parsed === null || typeof parsed !== "object") {
    throw new Error("Invalid project file: expected a JSON object");
  }
  if (!Check(ProjectFileSchema, parsed)) {
    const details = Errors(ProjectFileSchema, parsed)
      .map((e) => `${e.instancePath || "/"}: ${e.message}`)
      .join(", ");
    throw new Error(`Invalid project file: ${details}`);
  }
  return parsed;
}
