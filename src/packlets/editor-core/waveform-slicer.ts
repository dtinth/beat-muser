export interface SoundEventInput {
  entityId: string;
  pulse: number;
  soundLane: number;
  soundChannelId: string;
  command: "play" | "continue";
}

export interface WaveformOffsetInfo {
  sampleOffsetSeconds: number;
}

export function computeWaveformOffsets(
  events: SoundEventInput[],
  _channels: Map<string, { durationSec: number }>,
  pulseToSeconds: (pulse: number) => number,
): Map<string, WaveformOffsetInfo> {
  const result = new Map<string, WaveformOffsetInfo>();

  const groups = new Map<string, SoundEventInput[]>();
  for (const event of events) {
    const key = `${event.soundLane}:${event.soundChannelId}`;
    const group = groups.get(key);
    if (group) {
      group.push(event);
    } else {
      groups.set(key, [event]);
    }
  }

  for (const group of groups.values()) {
    group.sort((a, b) => a.pulse - b.pulse);

    let cumulativeSeconds = 0;
    for (let i = 0; i < group.length; i++) {
      const event = group[i];
      const nextEvent = group[i + 1];

      if (event.command === "play") {
        cumulativeSeconds = 0;
      }

      result.set(event.entityId, { sampleOffsetSeconds: cumulativeSeconds });

      if (nextEvent) {
        const playedSeconds = pulseToSeconds(nextEvent.pulse) - pulseToSeconds(event.pulse);
        cumulativeSeconds += playedSeconds;
      }
    }
  }

  return result;
}
