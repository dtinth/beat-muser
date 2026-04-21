import type { Static } from "typebox";
import type {
  EntitySchema,
  DeletedEntitySchema,
  EventComponentSchema,
  ChartComponentSchema,
  ChartRefComponentSchema,
  NoteComponentSchema,
  BpmChangeComponentSchema,
  SoundComponentSchema,
  SoundRefComponentSchema,
  ProjectMetadataSchema,
  ProjectFileSchema,
} from "./schema";

export type Entity = Static<typeof EntitySchema>;
export type DeletedEntity = Static<typeof DeletedEntitySchema>;
export type EventComponent = Static<typeof EventComponentSchema>;
export type ChartComponent = Static<typeof ChartComponentSchema>;
export type ChartRefComponent = Static<typeof ChartRefComponentSchema>;
export type NoteComponent = Static<typeof NoteComponentSchema>;
export type BpmChangeComponent = Static<typeof BpmChangeComponentSchema>;
export type SoundComponent = Static<typeof SoundComponentSchema>;
export type SoundRefComponent = Static<typeof SoundRefComponentSchema>;
export type ProjectMetadata = Static<typeof ProjectMetadataSchema>;
export type ProjectFile = Static<typeof ProjectFileSchema>;
