import { atom } from "nanostores";
import { Slice } from "../slice.ts";
import type { EditorContext } from "../editor-context.ts";
import { ProjectSlice } from "./project-slice.ts";
import { HistorySlice } from "./history-slice.ts";
import { SOUND_GROUP, SOUND_CHANNEL } from "../components.ts";
import { EntityBuilder } from "../../entity-manager/index.ts";
import {
  InsertEntityUserAction,
  DeleteEntityUserAction,
  DeleteEntitiesUserAction,
} from "../user-actions.ts";

export interface SoundGroupInfo {
  id: string;
  name: string;
  sortOrder: number;
  color?: string;
}

export interface SoundChannelInfo {
  id: string;
  path: string;
  groupId: string;
  sortOrder: number;
  /** Computed handle like "GRP1-001" or "PNO-003". */
  handle: string;
  /** 1-based index within the parent group, padded to 3 digits. */
  displayNumber: string;
}

export class SoundChannelSlice extends Slice {
  static readonly sliceKey = "sound-channels";

  $soundGroups = atom<SoundGroupInfo[]>([]);
  $soundChannels = atom<SoundChannelInfo[]>([]);
  $soundFilePaths = atom<string[]>([]);
  $selectedSoundChannelId = atom<string | null>(null);

  constructor(ctx: EditorContext) {
    super(ctx);

    const em = ctx.get(ProjectSlice).entityManager;
    em.$mutationVersion.subscribe(() => {
      this.refresh();
    });
  }

  setSelectedSoundChannelId(id: string | null): void {
    this.$selectedSoundChannelId.set(id);
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
      .toSorted((a, b) => a.sortOrder - b.sortOrder);

    const groupMap = new Map(groups.map((g) => [g.id, g]));

    const rawChannels = em
      .entitiesWithComponent(SOUND_CHANNEL)
      .map((entity) => {
        const channel = em.getComponent(entity, SOUND_CHANNEL);
        return {
          id: entity.id,
          path: channel?.path ?? "",
          groupId: channel?.soundGroupId ?? "",
          sortOrder: channel?.sortOrder ?? 0,
        };
      })
      .toSorted((a, b) => a.sortOrder - b.sortOrder);

    // Compute handle and displayNumber per group
    const groupCounters = new Map<string, number>();
    const channels: SoundChannelInfo[] = rawChannels.map((c) => {
      const group = groupMap.get(c.groupId);
      const prefix = group?.name ?? "GRP";
      const count = (groupCounters.get(c.groupId) ?? 0) + 1;
      groupCounters.set(c.groupId, count);
      const displayNumber = String(count).padStart(3, "0");
      return {
        ...c,
        handle: `${prefix}-${displayNumber}`,
        displayNumber,
      };
    });

    this.$soundGroups.set(groups);
    this.$soundChannels.set(channels);

    const filePaths = [...new Set(rawChannels.map((c) => c.path).filter((p) => p !== ""))];
    this.$soundFilePaths.set(filePaths);
  }

  addSoundGroup(name?: string): string {
    const em = this.ctx.get(ProjectSlice).entityManager;
    const existing = em.entitiesWithComponent(SOUND_GROUP);
    const maxOrder =
      existing.length > 0
        ? Math.max(...existing.map((e) => em.getComponent(e, SOUND_GROUP)?.sortOrder ?? 0))
        : -1;
    const groupName =
      name ??
      (() => {
        const used = new Set(existing.map((e) => em.getComponent(e, SOUND_GROUP)?.name));
        let n = 1;
        while (used.has(`GRP${n}`)) n++;
        return `GRP${n}`;
      })();
    const group = new EntityBuilder()
      .with(SOUND_GROUP, { name: groupName, sortOrder: maxOrder + 1 })
      .build();
    this.ctx.get(HistorySlice).applyAction(new InsertEntityUserAction(this.ctx, group));
    return group.id;
  }

  addSoundChannel(groupId: string): string {
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
        path: "",
        soundGroupId: groupId,
        sortOrder: maxOrder + 1,
      })
      .build();
    this.ctx.get(HistorySlice).applyAction(new InsertEntityUserAction(this.ctx, channel));
    return channel.id;
  }

  removeSoundChannel(id: string): void {
    const em = this.ctx.get(ProjectSlice).entityManager;
    const entity = em.get(id);
    if (!entity) return;
    const previousSelectedId = this.$selectedSoundChannelId.get();
    this.ctx.get(HistorySlice).applyAction(
      new DeleteEntityUserAction(
        this.ctx,
        id,
        structuredClone(entity),
        () => {
          if (this.$selectedSoundChannelId.get() === id) {
            this.$selectedSoundChannelId.set(null);
          }
        },
        () => {
          this.$selectedSoundChannelId.set(previousSelectedId);
        },
      ),
    );
  }

  removeSoundGroup(id: string): void {
    const em = this.ctx.get(ProjectSlice).entityManager;
    const groupEntity = em.get(id);
    if (!groupEntity) return;
    const channels = em
      .entitiesWithComponent(SOUND_CHANNEL)
      .filter((e) => em.getComponent(e, SOUND_CHANNEL)?.soundGroupId === id);
    const snapshots = [structuredClone(groupEntity), ...channels.map((c) => structuredClone(c))];
    const previousSelectedId = this.$selectedSoundChannelId.get();
    this.ctx.get(HistorySlice).applyAction(
      new DeleteEntitiesUserAction(
        this.ctx,
        snapshots,
        () => {
          const channelIds = new Set(channels.map((c) => c.id));
          if (
            this.$selectedSoundChannelId.get() !== null &&
            channelIds.has(this.$selectedSoundChannelId.get()!)
          ) {
            this.$selectedSoundChannelId.set(null);
          }
        },
        () => {
          this.$selectedSoundChannelId.set(previousSelectedId);
        },
      ),
    );
  }
}
