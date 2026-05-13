import { describe, expect, test } from "vite-plus/test";
import { entity } from "../entity-manager";
import { EVENT, NOTE, LEVEL_REF, SOUND_EVENT } from "./components";
import { getPulse, getNoteColumn, getSoundLane, getDragAffinity } from "./entity-accessors";

describe("entity-accessors", () => {
  test("getPulse returns event y from entity", () => {
    const e = entity((b) => b.with(EVENT, { y: 500 }));
    expect(getPulse(e)).toBe(500);
  });

  test("getPulse returns undefined when no EVENT component", () => {
    const e = entity((b) =>
      b.with(SOUND_EVENT, { soundLane: 0, soundChannelId: "x", command: "play" }),
    );
    expect(getPulse(e)).toBeUndefined();
  });

  test("getNoteColumn returns levelId and laneIndex", () => {
    const e = entity((b) =>
      b.with(EVENT, { y: 100 }).with(NOTE, { lane: 3 }).with(LEVEL_REF, { levelId: "l1" }),
    );
    expect(getNoteColumn(e)).toEqual({ levelId: "l1", laneIndex: 3 });
  });

  test("getNoteColumn returns null without LEVEL_REF", () => {
    const e = entity((b) => b.with(EVENT, { y: 100 }).with(NOTE, { lane: 3 }));
    expect(getNoteColumn(e)).toBeNull();
  });

  test("getSoundLane returns sound lane index", () => {
    const e = entity((b) =>
      b
        .with(EVENT, { y: 200 })
        .with(SOUND_EVENT, { soundLane: 1, soundChannelId: "x", command: "play" }),
    );
    expect(getSoundLane(e)).toBe(1);
  });

  test("getSoundLane returns null without SOUND_EVENT", () => {
    const e = entity((b) => b.with(EVENT, { y: 200 }));
    expect(getSoundLane(e)).toBeNull();
  });

  test("getDragAffinity returns gameplay for notes", () => {
    const e = entity((b) =>
      b.with(EVENT, { y: 100 }).with(NOTE, { lane: 3 }).with(LEVEL_REF, { levelId: "l1" }),
    );
    expect(getDragAffinity(e)).toBe("gameplay");
  });

  test("getDragAffinity returns sound for sound events", () => {
    const e = entity((b) =>
      b
        .with(EVENT, { y: 200 })
        .with(SOUND_EVENT, { soundLane: 0, soundChannelId: "x", command: "play" }),
    );
    expect(getDragAffinity(e)).toBe("sound");
  });

  test("getDragAffinity returns null for timing entities", () => {
    const e = entity((b) => b.with(EVENT, { y: 100 }));
    expect(getDragAffinity(e)).toBeNull();
  });
});
