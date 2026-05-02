# ADR 014: Game Mode Registry

**Status:** Accepted

**Date:** 2026-05-02

---

## Context

Game modes (beat-5k, beat-7k, etc.) define the lane layouts that levels use for gameplay columns. Previously, `lane-layouts.ts` hardcoded a single `beat-7k` mode in a private `Record<string, GameModeLayout>`, and `LevelColumnsSlice` imported `getGameModeLayout` directly. This blocked future plugins from registering custom modes.

## Decision

Introduce a `GameModeRegistrySlice` that acts as the single source of truth for registered game modes. Built-in modes (beat-5k, beat-7k) are pre-registered in the `EditorController` constructor. External code (future plugins) can call `registerGameMode()` at any time.

`LevelColumnsSlice` reads from the registry instead of importing lane layouts directly, and subscribes to the registry's `$modes` nanostore so column layouts refresh automatically when new modes are registered.

## Rationale

- Keeps the editor core mode-agnostic: it doesn't know or care which modes exist; it only queries the registry.
- Pre-registration in the constructor means existing tests and demo projects continue to work without changes.
- The nanostore subscription makes registration reactive — no manual refresh calls needed from plugin code.
- The registry slice is registered before `LevelColumnsSlice` in the controller initialization order, satisfying the dependency.
