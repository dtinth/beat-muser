/**
 * Path/name helpers for the project file system.
 */

/**
 * Returns `name` if it is not already in `existing`, otherwise the first
 * `name-N` variant (suffix inserted before the final extension) that is free.
 * Used by the file manager's "keep both" collision option.
 */
export function nextAvailableName(existing: ReadonlySet<string>, name: string): string {
  if (!existing.has(name)) return name;

  const dot = name.lastIndexOf(".");
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : "";

  let n = 1;
  let candidate = `${stem}-${n}${ext}`;
  while (existing.has(candidate)) {
    n++;
    candidate = `${stem}-${n}${ext}`;
  }
  return candidate;
}
