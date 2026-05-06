# ADR 015: Sound Channel Management

**Status:** Accepted

**Date:** 2026-05-02

---

## Context

Sound channels (`SOUND_CHANNEL` entities) represent audio files that can be triggered by sound events on the timeline. The data model and rendering already exist, but there is no UI to create, organize, or manage them. This ADR records the decisions for the sound channel management feature.

## Decision 1: Channels Must Belong to a Group

Every sound channel belongs to exactly one sound group (`SOUND_GROUP` entity). Groups are created before channels. The `soundGroupId` field on `SOUND_CHANNEL` is required (not optional).

**Rationale:** Sound groups are the primary organizational unit. In a typical rhythm game project, channels are naturally grouped ("Drums", "Vocals", "FX"). Requiring a group avoids a messy flat list and gives the UI a clear hierarchy.

## Decision 2: Blank Channels Are Allowed

A sound channel can be created with an empty `path`. The display name still derives from the path (or shows a placeholder like "Untitled" if empty). The path is assigned later via a file picker command or drag-and-drop.

**Rationale:** Users often want to sketch out the sound structure before importing files. This matches how other DAWs handle empty audio tracks.

## Decision 3: File Assignment Is a UI Concern

The editor controller and slices are unaware of file system operations. The UI layer handles file picker dialogs, drag-and-drop, and path validation (ensuring files are within the project directory). The slice only receives a path string.

**Rationale:** Keeps the core domain pure and testable. File system access is a browser/platform concern that belongs in React components.

## Decision 4: Sidebar Panel with Collapsible Groups

The Sounds panel lives in the right sidebar. Groups are collapsible sections. Each section shows its channels, a color indicator, an "Add Channel" button, and acts as a drag-and-drop zone for audio files.

**Rationale:** Right sidebar has space. Collapsible groups give clear hierarchy without nested navigation. Drag-and-drop on the group is the fastest way to bulk-import sounds.

## Decision 5: sortOrder for Future Reordering

Both `SOUND_GROUP` and `SOUND_CHANNEL` components carry a `sortOrder` number. For now, items appear in creation order (incrementing sortOrder). The field exists so drag-to-reorder can be added later without a schema migration.

**Rationale:** Cheap future-proofing. Adding a field later would require a schema version bump and migration logic.

## Decision 6: Minimal Command Palette Integration

Only "Add Sound Group" and "Add Sound Channel" commands are registered in the palette. No delete/edit commands — those live in the sidebar UI.

**Rationale:** The sidebar is the primary interface. Palette shortcuts are nice-to-have for power users but not critical.
