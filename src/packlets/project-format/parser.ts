/**
 * Parser for Beat Muser project files.
 *
 * Parses a JSON string into a validated `ProjectFile` object.
 * Throws a descriptive error if the data does not conform to the schema.
 */

import { Errors } from "typebox/value";
import { ProjectFileSchema } from "./schema";
import type { ProjectFile } from "./types";

export function parseProjectFile(json: string): ProjectFile {
  const parsed = JSON.parse(json);
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Invalid project file: expected a JSON object");
  }
  const errors = Errors(ProjectFileSchema, parsed);
  if (errors.length > 0) {
    const details = errors.map((e) => `${e.instancePath || "/"}: ${e.message}`).join(", ");
    throw new Error(`Invalid project file: ${details}`);
  }
  return parsed;
}
