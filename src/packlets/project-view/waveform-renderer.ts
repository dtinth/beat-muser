import type { RenderHandle } from "../scrollable-canvas";

interface WaveformRendererData {
  peak: Float32Array;
  rms: Float32Array;
  color: string;
  width: number;
}

export function createWaveformRenderer(): (data: unknown) => RenderHandle<WaveformRendererData> {
  return (data: unknown) => {
    const d = data as WaveformRendererData;
    const canvas = document.createElement("canvas");
    canvas.style.pointerEvents = "none";
    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.imageRendering = "auto";

    drawWaveform(canvas, d);
    let last = d;

    return {
      dom: canvas,
      update(newData: unknown) {
        const nd = newData as WaveformRendererData;
        if (
          nd.peak === last.peak &&
          nd.rms === last.rms &&
          nd.color === last.color &&
          nd.width === last.width
        )
          return;
        last = nd;
        drawWaveform(canvas, nd);
      },
    };
  };
}

function drawWaveform(canvas: HTMLCanvasElement, data: WaveformRendererData): void {
  const { peak, rms, color, width } = data;
  const rpLength = peak.length;

  const dpr = window.devicePixelRatio || 1;
  canvas.width = width * dpr;
  canvas.height = rpLength * dpr;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, width, rpLength);

  const centerX = width / 2;
  const maxBarHalfWidth = (width / 2) * 0.9;

  for (let py = 0; py < rpLength; py++) {
    const audioIdx = rpLength - 1 - py;
    const rmsVal = Math.min(rms[audioIdx], 1);
    const peakVal = Math.min(peak[audioIdx], 1);

    const rmsHalfWidth = rmsVal * maxBarHalfWidth;
    const peakHalfWidth = peakVal * maxBarHalfWidth;

    ctx.fillStyle = color;
    ctx.globalAlpha = 0.65;
    ctx.fillRect(centerX - rmsHalfWidth, py, rmsHalfWidth * 2, 1);

    ctx.globalAlpha = 0.35;
    ctx.fillRect(centerX - peakHalfWidth, py, peakHalfWidth * 2, 1);
  }

  ctx.setTransform(1, 0, 0, 1, 0, 0);
}
