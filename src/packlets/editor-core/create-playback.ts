import type { Playback, PlaybackEvent } from "../playback-contract";
import type { TimingEngine } from "../timing-engine";
import type { SoundEventInput } from "./waveform-slicer";

export interface CreatePlaybackOptions {
  soundEvents: SoundEventInput[];
  timingEngine: TimingEngine;
  cursorPulse: number;
  channels: Map<string, { path: string; durationSec: number }>;
}

export function createPlayback(options: CreatePlaybackOptions): Playback {
  const { soundEvents, timingEngine, cursorPulse, channels } = options;

  const cursorChartTime = timingEngine.pulseToSeconds(cursorPulse);

  const groups = new Map<string, SoundEventInput[]>();
  for (const event of soundEvents) {
    const key = `${event.soundLane}:${event.soundChannelId}`;
    const group = groups.get(key);
    if (group) {
      group.push(event);
    } else {
      groups.set(key, [event]);
    }
  }

  interface ScheduledEvent {
    triggerChartTime: number;
    audioStartTime: number;
    audioEndTime: number;
    channelId: string;
  }

  const allEvents: ScheduledEvent[] = [];

  for (const [groupKey, group] of groups) {
    const channelId = groupKey.split(":")[1];
    const channel = channels.get(channelId);
    if (!channel) continue;

    group.sort((a, b) => a.pulse - b.pulse);

    let chainStartPulse: number | null = null;
    let chainStart = -1;

    for (let i = 0; i < group.length; i++) {
      const event = group[i];
      const nextEvent = group[i + 1] ?? null;

      if (event.command === "play" || chainStart === -1) {
        chainStartPulse = event.pulse;
      }

      if (chainStart === -1) {
        chainStart = i;
      }

      const isLastInChain = !nextEvent || nextEvent.command === "play";

      if (isLastInChain) {
        const chainStartPulseValue = chainStartPulse!;

        // Chain end as chart time (when audio would stop playing)
        const chainEndChartTime =
          timingEngine.pulseToSeconds(chainStartPulseValue) + channel.durationSec;

        let triggerChartTime: number;
        let audioStartTime: number;

        if (chainStartPulseValue >= cursorPulse) {
          triggerChartTime = timingEngine.pulseToSeconds(chainStartPulseValue) - cursorChartTime;
          audioStartTime = 0;
        } else if (cursorChartTime < chainEndChartTime) {
          triggerChartTime = 0;
          audioStartTime = cursorChartTime - timingEngine.pulseToSeconds(chainStartPulseValue);
        } else {
          chainStart = -1;
          continue;
        }

        allEvents.push({
          triggerChartTime,
          audioStartTime,
          audioEndTime: channel.durationSec,
          channelId,
        });

        chainStart = -1;
      }
    }
  }

  // Sort by triggerChartTime
  allEvents.sort((a, b) => a.triggerChartTime - b.triggerChartTime);

  // Second pass: merge overlapping events on the same channel
  // If two events on the same channel overlap (their play durations overlap in chart time),
  // the second event should start playing in its own chain
  // For now, we trust the chain logic handles this correctly for most cases.
  // The key insight: events on the same (soundLane, soundChannelId) key should
  // not overlap because a new `play` ends the previous chain.

  let dequeIndex = 0;

  function getEvents(lookaheadChartTime: number): PlaybackEvent[] {
    const result: PlaybackEvent[] = [];
    while (dequeIndex < allEvents.length) {
      const event = allEvents[dequeIndex];
      if (event.triggerChartTime > lookaheadChartTime) break;
      const channel = channels.get(event.channelId);
      if (!channel) {
        dequeIndex++;
        continue;
      }
      result.push({
        fileName: channel.path,
        triggerChartTime: event.triggerChartTime,
        audioStartTime: event.audioStartTime,
        audioEndTime: event.audioEndTime,
      });
      dequeIndex++;
    }
    return result;
  }

  const abortController = new AbortController();

  return {
    getEvents,
    abortSignal: abortController.signal,
  };
}
