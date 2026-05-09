import { describe, expect, test } from "vite-plus/test";
import { computeWaveformOffsets } from "./waveform-slicer";

function pulseToSeconds(pulse: number): number {
  return (pulse / 240) * (60 / 120);
}

describe("computeWaveformOffsets", () => {
  test("single play event starts at sample offset 0", () => {
    const result = computeWaveformOffsets(
      [
        {
          entityId: "e1",
          pulse: 0,
          soundLane: 0,
          soundChannelId: "ch1",
          command: "play",
        },
      ],
      new Map([["ch1", { durationSec: 2 }]]),
      pulseToSeconds,
    );

    expect(result.get("e1")?.sampleOffsetSeconds).toBe(0);
  });

  test("continue event picks up where previous play left off", () => {
    const result = computeWaveformOffsets(
      [
        {
          entityId: "e1",
          pulse: 0,
          soundLane: 0,
          soundChannelId: "ch1",
          command: "play",
        },
        {
          entityId: "e2",
          pulse: 480,
          soundLane: 0,
          soundChannelId: "ch1",
          command: "continue",
        },
      ],
      new Map([["ch1", { durationSec: 2 }]]),
      pulseToSeconds,
    );

    expect(result.get("e1")?.sampleOffsetSeconds).toBe(0);
    expect(result.get("e2")?.sampleOffsetSeconds).toBe(1);
  });

  test("multiple continues accumulate offset", () => {
    const result = computeWaveformOffsets(
      [
        {
          entityId: "e1",
          pulse: 0,
          soundLane: 0,
          soundChannelId: "ch1",
          command: "play",
        },
        {
          entityId: "e2",
          pulse: 480,
          soundLane: 0,
          soundChannelId: "ch1",
          command: "continue",
        },
        {
          entityId: "e3",
          pulse: 960,
          soundLane: 0,
          soundChannelId: "ch1",
          command: "continue",
        },
      ],
      new Map([["ch1", { durationSec: 2 }]]),
      pulseToSeconds,
    );

    expect(result.get("e1")?.sampleOffsetSeconds).toBe(0);
    expect(result.get("e2")?.sampleOffsetSeconds).toBe(1);
    expect(result.get("e3")?.sampleOffsetSeconds).toBe(2);
  });

  test("play resets the chain", () => {
    const result = computeWaveformOffsets(
      [
        {
          entityId: "e1",
          pulse: 0,
          soundLane: 0,
          soundChannelId: "ch1",
          command: "play",
        },
        {
          entityId: "e2",
          pulse: 480,
          soundLane: 0,
          soundChannelId: "ch1",
          command: "continue",
        },
        {
          entityId: "e3",
          pulse: 960,
          soundLane: 0,
          soundChannelId: "ch1",
          command: "play",
        },
        {
          entityId: "e4",
          pulse: 1440,
          soundLane: 0,
          soundChannelId: "ch1",
          command: "continue",
        },
      ],
      new Map([["ch1", { durationSec: 2 }]]),
      pulseToSeconds,
    );

    expect(result.get("e1")?.sampleOffsetSeconds).toBe(0);
    expect(result.get("e2")?.sampleOffsetSeconds).toBe(1);
    expect(result.get("e3")?.sampleOffsetSeconds).toBe(0);
    expect(result.get("e4")?.sampleOffsetSeconds).toBe(1);
  });

  test("events on different lanes are independent", () => {
    const result = computeWaveformOffsets(
      [
        {
          entityId: "e1",
          pulse: 0,
          soundLane: 0,
          soundChannelId: "ch1",
          command: "play",
        },
        {
          entityId: "e2",
          pulse: 0,
          soundLane: 1,
          soundChannelId: "ch1",
          command: "play",
        },
        {
          entityId: "e3",
          pulse: 480,
          soundLane: 0,
          soundChannelId: "ch1",
          command: "continue",
        },
        {
          entityId: "e4",
          pulse: 960,
          soundLane: 1,
          soundChannelId: "ch1",
          command: "continue",
        },
      ],
      new Map([["ch1", { durationSec: 2 }]]),
      pulseToSeconds,
    );

    expect(result.get("e3")?.sampleOffsetSeconds).toBe(1);
    expect(result.get("e4")?.sampleOffsetSeconds).toBe(2);
  });

  test("events on different channels on same lane are independent", () => {
    const result = computeWaveformOffsets(
      [
        {
          entityId: "e1",
          pulse: 0,
          soundLane: 0,
          soundChannelId: "ch1",
          command: "play",
        },
        {
          entityId: "e2",
          pulse: 0,
          soundLane: 0,
          soundChannelId: "ch2",
          command: "play",
        },
        {
          entityId: "e3",
          pulse: 480,
          soundLane: 0,
          soundChannelId: "ch1",
          command: "continue",
        },
        {
          entityId: "e4",
          pulse: 960,
          soundLane: 0,
          soundChannelId: "ch2",
          command: "continue",
        },
      ],
      new Map([
        ["ch1", { durationSec: 2 }],
        ["ch2", { durationSec: 3 }],
      ]),
      pulseToSeconds,
    );

    expect(result.get("e3")?.sampleOffsetSeconds).toBe(1);
    expect(result.get("e4")?.sampleOffsetSeconds).toBe(2);
  });

  test("continue without preceding play starts at offset 0", () => {
    const result = computeWaveformOffsets(
      [
        {
          entityId: "e1",
          pulse: 480,
          soundLane: 0,
          soundChannelId: "ch1",
          command: "continue",
        },
      ],
      new Map([["ch1", { durationSec: 2 }]]),
      pulseToSeconds,
    );

    expect(result.get("e1")?.sampleOffsetSeconds).toBe(0);
  });
});
