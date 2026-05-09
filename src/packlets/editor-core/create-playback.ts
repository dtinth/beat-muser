import type { Playback, PlaybackEvent } from "../playback-contract";
import type { TimingEngine } from "../timing-engine";
import type { SoundEventInput } from "./waveform-slicer";

export interface CreatePlaybackOptions {
  soundEvents: SoundEventInput[];
  timingEngine: TimingEngine;
  cursorPulse: number;
  channels: Map<string, { path: string; durationSec: number }>;
  abortController?: AbortController;
}

export function createPlayback(options: CreatePlaybackOptions): Playback {
  const {
    soundEvents,
    timingEngine,
    cursorPulse,
    channels,
    abortController = new AbortController(),
  } = options;

  const cursorChartSec = timingEngine.pulseToSeconds(cursorPulse);

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
    triggerChartSec: number;
    audioStartSec: number;
    audioEndSec: number;
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

        const chainStartChartSec = timingEngine.pulseToSeconds(chainStartPulseValue);
        const nextPlayChartSec =
          nextEvent && nextEvent.command === "play"
            ? timingEngine.pulseToSeconds(nextEvent.pulse)
            : Number.POSITIVE_INFINITY;
        const chainEndChartSec = Math.min(
          chainStartChartSec + channel.durationSec,
          nextPlayChartSec,
        );

        let triggerChartSec: number;
        let audioStartSec: number;

        if (chainStartPulseValue >= cursorPulse) {
          triggerChartSec = chainStartChartSec - cursorChartSec;
          audioStartSec = 0;
        } else if (cursorChartSec < chainEndChartSec) {
          triggerChartSec = 0;
          audioStartSec = cursorChartSec - chainStartChartSec;
        } else {
          chainStart = -1;
          continue;
        }

        const audioEndSec = chainEndChartSec - chainStartChartSec;
        if (audioStartSec >= audioEndSec) {
          chainStart = -1;
          continue;
        }

        allEvents.push({
          triggerChartSec,
          audioStartSec,
          audioEndSec,
          channelId,
        });

        chainStart = -1;
      }
    }
  }

  allEvents.sort((a, b) => a.triggerChartSec - b.triggerChartSec);

  let dequeIndex = 0;

  function getEvents(lookaheadChartSec: number): PlaybackEvent[] {
    const result: PlaybackEvent[] = [];
    while (dequeIndex < allEvents.length) {
      const event = allEvents[dequeIndex];
      if (event.triggerChartSec > lookaheadChartSec) break;
      const channel = channels.get(event.channelId);
      if (!channel) {
        dequeIndex++;
        continue;
      }
      result.push({
        fileName: channel.path,
        triggerChartSec: event.triggerChartSec,
        audioStartSec: event.audioStartSec,
        audioEndSec: event.audioEndSec,
      });
      dequeIndex++;
    }
    return result;
  }

  return {
    getEvents,
    abortSignal: abortController.signal,
  };
}
