# Architecture Decision Records (ADRs)

This directory contains Architecture Decision Records for the Beat Muser project.

## Policy: ADRs Are Permanent Historical Records

**ADRs are kept in the repository permanently.** They are not deleted after implementation.

An ADR captures a decision at a specific point in time — the problem, the options considered, the trade-offs, and the rationale. It is a historical document, not a living specification. It is expected and acceptable for ADRs to become outdated as the codebase evolves.

## Why Keep Them?

- **Traceability:** `git log -- docs/adr/` shows how the architecture evolved over time.
- **Context Recovery:** When reading code, an ADR explains _why_ something was done, not just _what_ was done. Code comments explain the implementation; ADRs explain the reasoning.
- **Onboarding:** New contributors (and AI agents) can understand the thought process behind architectural choices without reconstructing it from code alone.

## Status Conventions

- **Accepted** — The decision was made and implemented (or is being implemented).
- **Superseded by NNN** — A later ADR overrides this one. The old ADR remains for historical context.
- **Deprecated** — The decision was reversed or abandoned. The ADR explains what changed.

## Format

Use sequential numbering: `001-`, `002-`, etc.

Each ADR should be focused and scoped to a single architectural concern. A one-paragraph ADR is valid if it captures a meaningful decision.

## When to Write an ADR

Write an ADR when:

- A significant architectural choice is made (technology, pattern, data flow)
- Multiple options were considered and one was selected
- The reasoning is non-obvious and would be hard to recover from code alone

Do not write an ADR for trivial decisions or implementation details that are self-evident from the code.
