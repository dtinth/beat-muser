# Beat Muser

A rhythm game notechart/beatmap editor web app.

## Language

**Game mode**:
A named configuration of gameplay lanes (e.g. beat-5k, beat-7k). Defines lane count, widths, colors, and indices. Game modes are registered at runtime via the {@link GameModeRegistrySlice}; the editor core does not hardcode them.
_Avoid_: mode, layout (without "game mode" qualifier)

**Lane definition**:
A single lane within a game mode: its index (stored in note entities), display name, pixel width, background color, and note color.

**Game mode registry**:
The {@link GameModeRegistrySlice} that holds all registered game modes. Editor core queries it to build timeline columns. Future plugins register modes here.

**Level**:
A playable difficulty within a chart. Each level references a game mode by identifier (e.g. "beat-7k"). Multiple levels can coexist on the same chart with different modes.

**Column definition**:
A timeline column, which may be a gameplay lane, timing lane, sound lane, or spacer. Generated dynamically by column provider slices and assembled by {@link ColumnsSlice}.

**Sound group**:
A project-global grouping for related sound channels (e.g., "Drums", "Vocals"). Carries a display name and optional color. Every **Sound channel** belongs to exactly one group; groups are created before channels.

**Sound channel**:
A project-global audio file reference that belongs to exactly one **Sound group**. Identified by its file path relative to the project directory. The display name is derived from the path (basename without extension). Can be created blank (no path assigned yet) and populated later via file picker or drag-and-drop. Sound events on the timeline trigger sound channels.
_Avoid_: sample, audio file (without "channel" qualifier)

**Sound event**:
A timed entity on a chart's sound lane that triggers a **Sound channel** at a specific pulse. Has a command (`play` or `continue`).

## Relationships

- A **Chart** contains one or more **Levels**
- A **Level** references exactly one **Game mode** by identifier
- A **Game mode** contains one or more **Lane definitions**
- The **Game mode registry** holds zero or more **Game modes**
- **Column definitions** are derived from visible **Levels** + their referenced **Game mode** layouts
- A **Project** contains zero or more **Sound groups**
- A **Sound group** contains one or more **Sound channels**
- A **Sound event** references exactly one **Sound channel**

## Example dialogue

> **Dev:** "If a plugin registers a new game mode after the timeline is already visible, do the columns update automatically?"
> **Domain expert:** "Yes — the {@link LevelColumnsSlice} subscribes to the {@link GameModeRegistrySlice}'s `$modes` atom, so registering a mode triggers a column refresh."

> **Dev:** "Can I create a sound channel without assigning a file?"
> **Domain expert:** "Yes — you create a blank channel inside a group, then assign the file later via the file picker command or by dragging an audio file into the group."

## Flagged ambiguities

- "Mode" was used ambiguously to mean both game mode and tool mode (select/pencil/erase/pan). Resolved: "game mode" always refers to lane layouts; "tool" refers to the active editor tool.
