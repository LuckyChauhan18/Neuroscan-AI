import { useEffect, useRef } from 'react';

const FREQ_BINS   = 80;
const SCROLL_SPEED = 2;

// Inferno-style colormap: dark-blue → purple → red → orange → yellow
function heatColor(t) {
  const stops = [
    [8,   8,  40],   // 0.00
    [70,  15, 115],  // 0.25
    [175, 42,  90],  // 0.50
    [245, 130,  40], // 0.75
    [252, 253, 170], // 1.00
  ];
  const n = stops.length - 1;
  const i = Math.min(n - 1, Math.floor(t * n));
  const f = t * n - i;
  return stops[i].map((c, j) => Math.round(c + (stops[i + 1][j] - c) * f));
}

function seizureSample(t, bin) {
  const freq  = bin / FREQ_BINS;
  // Rhythmic ictal spikes ~3 Hz
  const spike = Math.sin(t * 0.09) > 0.55 ? 0.6 * Math.exp(-freq * 1.8) : 0;
  // Broadband activation
  const broad = 0.22 + 0.14 * Math.exp(-freq * 1.3);
  // High-frequency (gamma) burst
  const gamma = 0.18 * Math.exp(-((freq - 0.68) ** 2) * 35);
  return Math.max(0, Math.min(1, broad + spike + gamma + (Math.random() - 0.5) * 0.10));
}

function normalSample(t, bin) {
  const freq  = bin / FREQ_BINS;
  // Delta dominant (low freq)
  const delta = 0.55 * Math.exp(-freq * 18);
  // Alpha peak ~10 Hz (≈ bin 13 out of 80 for 0–60 Hz)
  const alpha = 0.42 * Math.exp(-((freq - 0.165) ** 2) * 620)
              * (0.85 + Math.sin(t * 0.016) * 0.15);
  // Faint beta
  const beta  = 0.08 * Math.exp(-((freq - 0.35) ** 2) * 200);
  return Math.max(0, Math.min(1, delta + alpha + beta + Math.random() * 0.05));
}

// Frequency bands drawn as Y-axis guides
const BANDS = [
  { label: 'γ  30+Hz', frac: 0.02 },
  { label: 'β  13Hz',  frac: 0.30 },
  { label: 'α  8Hz',   frac: 0.74 },
  { label: 'θ  4Hz',   frac: 0.86 },
  { label: 'δ  0.5Hz', frac: 0.96 },
];

export default function SpectrogramCanvas({ isSeizure = false }) {
  const canvasRef    = useRef(null);
  const isSeizureRef = useRef(isSeizure);

  useEffect(() => { isSeizureRef.current = isSeizure; }, [isSeizure]);

  useEffect(() => {
    const canvas   = canvasRef.current;
    const ctx      = canvas.getContext('2d');
    let colBuffer  = [];
    let frame      = 0;
    let animId;
    let startTs    = null;   // wall-clock start for time counter

    const resize = () => {
      const w = canvas.parentElement?.offsetWidth || 600;
      canvas.width  = w;
      canvas.height = 280;
      colBuffer = Array.from({ length: w }, () => new Float32Array(FREQ_BINS));
      startTs = null;
    };

    const ro = new ResizeObserver(resize);
    ro.observe(canvas.parentElement);
    resize();

    const draw = (ts) => {
      if (!startTs) startTs = ts;
      const elapsedSec = (ts - startTs) / 1000;

      frame++;
      const { width: W, height: H } = canvas;

      // Generate new columns
      for (let s = 0; s < SCROLL_SPEED; s++) {
        const t   = frame * SCROLL_SPEED + s;
        const col = new Float32Array(FREQ_BINS);
        for (let bin = 0; bin < FREQ_BINS; bin++) {
          col[bin] = isSeizureRef.current
            ? seizureSample(t, bin)
            : normalSample(t, bin);
        }
        colBuffer.push(col);
        if (colBuffer.length > W) colBuffer.shift();
      }

      // Paint heatmap
      const img = ctx.createImageData(W, H);
      const px  = img.data;
      for (let x = 0; x < W; x++) {
        if (x >= colBuffer.length) continue;
        const col = colBuffer[x];
        for (let y = 0; y < H; y++) {
          const bin   = Math.floor(((H - 1 - y) / H) * (FREQ_BINS - 1));
          const power = col[bin];
          const [r, g, b] = heatColor(power);
          const idx = (y * W + x) * 4;
          px[idx] = r; px[idx+1] = g; px[idx+2] = b;
          px[idx+3] = Math.min(255, Math.round(power * 220 + 30));
        }
      }
      ctx.putImageData(img, 0, 0);

      // Frequency band guide lines + labels
      ctx.font = '9px monospace'; ctx.textAlign = 'left';
      BANDS.forEach(({ label, frac }) => {
        const y = Math.round(frac * H);
        ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(44, y); ctx.lineTo(W, y); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.fillText(label, 2, y + 8);
      });

      // ── Time counter pill — top-right ──
      const secStr  = elapsedSec.toFixed(2);
      const liveStr = ' ● LIVE';

      ctx.font = 'bold 12px monospace';
      const secW = ctx.measureText(`${secStr}s`).width;
      ctx.font = '10px monospace';
      const liveW = ctx.measureText(liveStr).width;

      const pad = 8, gap = 4;
      const boxW = secW + liveW + pad * 2 + gap;
      const boxH = 22;
      const boxX = W - boxW - 10;
      const boxY = 8;

      // Pill background
      ctx.fillStyle = 'rgba(0,0,0,0.60)';
      ctx.beginPath();
      ctx.roundRect(boxX, boxY, boxW, boxH, 5);
      ctx.fill();

      // Elapsed seconds — cyan
      ctx.font = 'bold 12px monospace';
      ctx.fillStyle = '#00D4FF';
      ctx.textAlign = 'left';
      ctx.fillText(`${secStr}s`, boxX + pad, boxY + boxH / 2 + 4);

      // "● LIVE" blinking dot — pulse with sin
      const pulse  = 0.5 + 0.5 * Math.sin(ts * 0.005);
      const dotClr = isSeizureRef.current
        ? `rgba(239,68,68,${0.5 + pulse * 0.5})`
        : `rgba(16,185,129,${0.5 + pulse * 0.5})`;
      ctx.font      = '10px monospace';
      ctx.fillStyle = dotClr;
      ctx.fillText(liveStr, boxX + pad + secW + gap, boxY + boxH / 2 + 3);

      animId = requestAnimationFrame(draw);
    };

    animId = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(animId); ro.disconnect(); };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: 280, display: 'block', borderRadius: '0.75rem' }}
    />
  );
}
