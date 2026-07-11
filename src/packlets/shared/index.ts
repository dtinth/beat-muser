/**
 * @packageDocumentation
 *
 * Small, dependency-free helpers shared across packlets that don't belong to
 * any single domain.
 */

/**
 * Normalizes an unknown thrown value into a human-readable message string —
 * the `.message` of a real `Error`, or its `String()` form otherwise. Handy for
 * `catch (error: unknown)` blocks feeding toast descriptions.
 */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
