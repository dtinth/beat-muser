import { atom } from "nanostores";
import { Slice } from "../slice";
import type { EditorContext } from "../editor-context";
import { ProjectSlice } from "./project-slice";
import { SOUND_GROUP, SOUND_CHANNEL } from "../components";
import { EntityBuilder } from "../../entity-manager";

export interface SoundGroupInfo {
  id: string;
  name: string;
  sortOrder: number;
  color?: string;
}

export interface SoundChannelInfo {
  id: string;
  name: string;
  path: string;
  groupId: string;
  sortOrder: number;
}

export class SoundChannelSlice extends Slice {
  static readonly sliceKey = "sound-channels";

  $soundGroups = atom<SoundGroupInfo[]>([]);
  $soundChannels = atom<SoundChannelInfo[]>([]);

  constructor(ctx: EditorContext) {
    super(ctx);

    const em = ctx.get(ProjectSlice).entityManager;
    em.$mutationVersion.subscribe(() => {
      this.refresh();
    });
  }

  private refresh(): void {
    const em = this.ctx.get(ProjectSlice).entityManager;

    const groups = em
      .entitiesWithComponent(SOUND_GROUP)
      .map((entity) => {
        const group = em.getComponent(entity, SOUND_GROUP);
        return {
          id: entity.id,
          name: group?.name ?? "Untitled",
          sortOrder: group?.sortOrder ?? 0,
          color: group?.color,
        };
      })
      .sort((a, b) => a.sortOrder - b.sortOrder);

    const channels = em
      .entitiesWithComponent(SOUND_CHANNEL)
      .map((entity) => {
        const channel = em.getComponent(entity, SOUND_CHANNEL);
        return {
          id: entity.id,
          name: channel?.name ?? "Untitled",
          path: channel?.path ?? "",
          groupId: channel?.soundGroupId ?? "",
          sortOrder: channel?.sortOrder ?? 0,
        };
      })
      .sort((a, b) => a.sortOrder - b.sortOrder);

    this.$soundGroups.set(groups);
    this.$soundChannels.set(channels);
  }

  addSoundGroup(name: string): string {
    const em = this.ctx.get(ProjectSlice).entityManager;
    const existing = em.entitiesWithComponent(SOUND_GROUP);
    const maxOrder =
      existing.length > 0
        ? Math.max(...existing.map((e) => em.getComponent(e, SOUND_GROUP)?.sortOrder ?? 0))
        : -1;
    const group = new EntityBuilder().with(SOUND_GROUP, { name, sortOrder: maxOrder + 1 }).build();
    em.insert(group);
    this.refresh();
    return group.id;
  }

  addSoundChannel(groupId: string, name?: string): string {
    const em = this.ctx.get(ProjectSlice).entityManager;
    const existing = em
      .entitiesWithComponent(SOUND_CHANNEL)
      .filter((e) => em.getComponent(e, SOUND_CHANNEL)?.soundGroupId === groupId);
    const maxOrder =
      existing.length > 0
        ? Math.max(...existing.map((e) => em.getComponent(e, SOUND_CHANNEL)?.sortOrder ?? 0))
        : -1;
    const channel = new EntityBuilder()
      .with(SOUND_CHANNEL, {
        name: name ?? "Untitled",
        path: "",
        soundGroupId: groupId,
        sortOrder: maxOrder + 1,
      })
      .build();
    em.insert(channel);
    this.refresh();
    return channel.id;
  }

  removeSoundChannel(id: string): void {
    this.ctx.get(ProjectSlice).entityManager.remove(id);
    this.refresh();
  }

  removeSoundGroup(id: string): void {
    const em = this.ctx.get(ProjectSlice).entityManager;
    const channels = em
      .entitiesWithComponent(SOUND_CHANNEL)
      .filter((e) => em.getComponent(e, SOUND_CHANNEL)?.soundGroupId === id);
    for (const channel of channels) {
      em.remove(channel.id);
    }
    em.remove(id);
    this.refresh();
  }
}
