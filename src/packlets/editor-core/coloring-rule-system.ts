/**
 * @packageDocumentation
 *
 * Coloring rule system for extension-declared declarative note coloring.
 *
 * Extensions declare coloring rules in their manifest — MongoDB-style queries
 * against entity components that override the note color when matched.
 * Rules are scoped to specific game modes and ordered by priority.
 */

import sift from "sift";
import type { ColoringRule } from "../extensions/index.ts";

export interface CompiledColoringRule {
  id: string;
  priority: number;
  matches: (obj: Record<string, unknown>) => boolean;
  apply: { noteColor: string };
}

export function compileQuery(
  query: Record<string, unknown>,
): (obj: Record<string, unknown>) => boolean {
  return sift(query) as (obj: Record<string, unknown>) => boolean;
}

export function compileColoringRule(rule: ColoringRule): CompiledColoringRule {
  return {
    id: rule.id,
    priority: rule.priority,
    matches: compileQuery(rule.match),
    apply: { noteColor: rule.apply.noteColor },
  };
}

export function findMatchingRule(
  rules: CompiledColoringRule[],
  components: Record<string, unknown>,
): { noteColor: string } | null {
  const sorted = [...rules].sort((a, b) => b.priority - a.priority);
  for (const rule of sorted) {
    if (rule.matches(components)) {
      return rule.apply;
    }
  }
  return null;
}
