import { describe, expect, test } from "vite-plus/test";
import { createPlayback } from "./create-playback.ts";
import { createTimingEngine } from "../timing-engine/index.ts";
import type { PlaybackEvent } from "../playback-contract/index.ts";

function makeChannel(
  channelId: string,
  filePath: string,
  durationSec = 2,
): [string, { path: string; durationSec: number }] {
  return [channelId, { path: filePath, durationSec }];
}

function collectAllEvents(playback: ReturnType<typeof createPlayback>): PlaybackEvent[] {
  const events: PlaybackEvent[] = [];
  let newEvents = playback.getEvents(999);
  while (newEvents.length > 0) {
    events.push(...newEvents);
    newEvents = playback.getEvents(events[events.length - 1]!.triggerPlaybackSec + 999);
  }
  return events;
}

function makeSoundEvent(
  overrides: Partial<{
    entityId: string;
    pulse: number;
    soundLane: number;
    soundChannelId: string;
    command: "play" | "continue";
  }> = {},
) {
  return {
    entityId: overrides.entityId ?? "e1",
    pulse: overrides.pulse ?? 0,
    soundLane: overrides.soundLane ?? 0,
    soundChannelId: overrides.soundChannelId ?? "ch1",
    command: overrides.command ?? "play",
  };
}

describe("createPlayback", () => {
  test("single sound event at cursor produces one event at triggerPlaybackSec 0", () => {
    const playback = createPlayback({
      soundEvents: [makeSoundEvent()],
      timingEngine: createTimingEngine(
        [{ pulse: 0, bpm: 120 }],
        [{ pulse: 0, numerator: 4, denominator: 4 }],
      ),
      cursorPulse: 0,
      channels: new Map([makeChannel("ch1", "drums.wav")]),
    });

    const events = collectAllEvents(playback);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      fileName: "drums.wav",
      triggerPlaybackSec: 0,
      audioStartSec: 0,
      audioEndSec: 2,
    });
  });

  test("sound event after cursor has correct triggerPlaybackSec offset", () => {
    const playback = createPlayback({
      soundEvents: [makeSoundEvent({ pulse: 240 })],
      timingEngine: createTimingEngine(
        [{ pulse: 0, bpm: 120 }],
        [{ pulse: 0, numerator: 4, denominator: 4 }],
      ),
      cursorPulse: 0,
      channels: new Map([makeChannel("ch1", "drums.wav")]),
    });

    const events = collectAllEvents(playback);
    expect(events[0].triggerPlaybackSec).toBeCloseTo(0.5, 2);
  });

  test("multiple events on same channel produce correct times", () => {
    const playback = createPlayback({
      soundEvents: [
        makeSoundEvent({ entityId: "e1", pulse: 0 }),
        makeSoundEvent({ entityId: "e2", pulse: 480 }),
      ],
      timingEngine: createTimingEngine(
        [{ pulse: 0, bpm: 120 }],
        [{ pulse: 0, numerator: 4, denominator: 4 }],
      ),
      cursorPulse: 0,
      channels: new Map([makeChannel("ch1", "drums.wav")]),
    });

    const events = collectAllEvents(playback);
    expect(events).toHaveLength(2);
    expect(events[0].triggerPlaybackSec).toBe(0);
    expect(events[1].triggerPlaybackSec).toBeCloseTo(1, 2);
  });

  test("continue coalesced into preceding play", () => {
    const playback = createPlayback({
      soundEvents: [
        makeSoundEvent({ entityId: "e1", pulse: 0, command: "play" }),
        makeSoundEvent({ entityId: "e2", pulse: 480, command: "continue" }),
      ],
      timingEngine: createTimingEngine(
        [{ pulse: 0, bpm: 120 }],
        [{ pulse: 0, numerator: 4, denominator: 4 }],
      ),
      cursorPulse: 0,
      channels: new Map([makeChannel("ch1", "drums.wav", 5)]),
    });

    const events = collectAllEvents(playback);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      triggerPlaybackSec: 0,
      audioStartSec: 0,
      audioEndSec: 5,
    });
  });

  test("play after continue resets the chain", () => {
    const playback = createPlayback({
      soundEvents: [
        makeSoundEvent({ entityId: "e1", pulse: 0, command: "play" }),
        makeSoundEvent({ entityId: "e2", pulse: 480, command: "continue" }),
        makeSoundEvent({ entityId: "e3", pulse: 960, command: "play" }),
      ],
      timingEngine: createTimingEngine(
        [{ pulse: 0, bpm: 120 }],
        [{ pulse: 0, numerator: 4, denominator: 4 }],
      ),
      cursorPulse: 0,
      channels: new Map([makeChannel("ch1", "drums.wav", 5)]),
    });

    const events = collectAllEvents(playback);
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ triggerPlaybackSec: 0, audioStartSec: 0 });
    expect(events[1]).toMatchObject({ triggerPlaybackSec: 2, audioStartSec: 0, audioEndSec: 5 });
  });

  test("different sound lanes are independent", () => {
    const playback = createPlayback({
      soundEvents: [
        makeSoundEvent({ entityId: "e1", pulse: 0, soundLane: 0, command: "play" }),
        makeSoundEvent({ entityId: "e2", pulse: 0, soundLane: 1, command: "play" }),
        makeSoundEvent({ entityId: "e3", pulse: 480, soundLane: 0, command: "continue" }),
        makeSoundEvent({ entityId: "e4", pulse: 960, soundLane: 1, command: "continue" }),
      ],
      timingEngine: createTimingEngine(
        [{ pulse: 0, bpm: 120 }],
        [{ pulse: 0, numerator: 4, denominator: 4 }],
      ),
      cursorPulse: 0,
      channels: new Map([makeChannel("ch1", "drums.wav", 5)]),
    });

    const events = collectAllEvents(playback);
    // lane 0: play at 0 + continue at 480 → coalesced into one
    // lane 1: play at 0 + continue at 960 → coalesced into one
    expect(events).toHaveLength(2);
    const sorted = [...events].sort((a, b) => a.triggerPlaybackSec - b.triggerPlaybackSec);
    expect(sorted[0].triggerPlaybackSec).toBe(0);
    expect(sorted[1].triggerPlaybackSec).toBe(0);
  });

  test("join mid-stream: cursor starts between play and continue", () => {
    const playback = createPlayback({
      soundEvents: [
        makeSoundEvent({ entityId: "e1", pulse: 0, command: "play" }),
        makeSoundEvent({ entityId: "e2", pulse: 480, command: "continue" }),
      ],
      timingEngine: createTimingEngine(
        [{ pulse: 0, bpm: 120 }],
        [{ pulse: 0, numerator: 4, denominator: 4 }],
      ),
      cursorPulse: 240, // midpoint between pulse 0 and 480
      channels: new Map([makeChannel("ch1", "drums.wav", 5)]),
    });

    const events = collectAllEvents(playback);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      triggerPlaybackSec: 0,
      audioStartSec: 0.5, // halfway through the file
      audioEndSec: 5,
    });
  });

  test("no events before cursor when audio has ended", () => {
    const playback = createPlayback({
      soundEvents: [makeSoundEvent({ pulse: 0 })],
      timingEngine: createTimingEngine(
        [{ pulse: 0, bpm: 120 }],
        [{ pulse: 0, numerator: 4, denominator: 4 }],
      ),
      cursorPulse: 9600, // cursor far past the event (chart time 20s, audio only 2s)
      channels: new Map([makeChannel("ch1", "drums.wav")]),
    });

    const events = playback.getEvents(999);
    expect(events).toHaveLength(0);
  });

  test("join mid-stream for long audio that extends past last event", () => {
    const playback = createPlayback({
      soundEvents: [makeSoundEvent({ entityId: "e1", pulse: 0, command: "play" })],
      timingEngine: createTimingEngine(
        [{ pulse: 0, bpm: 120 }],
        [{ pulse: 0, numerator: 4, denominator: 4 }],
      ),
      cursorPulse: 480, // chart time 1s, audio is 10s long so still playing
      channels: new Map([makeChannel("ch1", "drums.wav", 10)]),
    });

    const events = collectAllEvents(playback);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      triggerPlaybackSec: 0,
      audioStartSec: 1, // 1s of the 10s audio has already "played"
      audioEndSec: 10,
    });
  });

  test("incremental getEvents dequeues correctly", () => {
    const playback = createPlayback({
      soundEvents: [
        makeSoundEvent({ entityId: "e1", pulse: 0, command: "play" }),
        makeSoundEvent({ entityId: "e2", pulse: 240, command: "continue" }),
        makeSoundEvent({ entityId: "e3", pulse: 480, command: "play" }),
      ],
      timingEngine: createTimingEngine(
        [{ pulse: 0, bpm: 120 }],
        [{ pulse: 0, numerator: 4, denominator: 4 }],
      ),
      cursorPulse: 0,
      channels: new Map([makeChannel("ch1", "drums.wav")]),
    });

    // First chain (play at 0 + continue at 240) coalesced at triggerPlaybackSec 0
    const batch1 = playback.getEvents(0.6);
    expect(batch1).toHaveLength(1);

    // Second chain (play at 480) at triggerPlaybackSec 1.0
    const batch2 = playback.getEvents(2);
    expect(batch2).toHaveLength(1);

    const batch3 = playback.getEvents(10);
    expect(batch3).toHaveLength(0);
  });
});
