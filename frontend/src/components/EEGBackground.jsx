import { useEffect, useRef } from 'react';

const BASE_CHANNELS = [
  { freq1: 0.018, freq2: 0.047, freq3: 0.095, freq4: 0.180, amp: 26, phase: 0.0 },
  { freq1: 0.022, freq2: 0.058, freq3: 0.112, freq4: 0.210, amp: 22, phase: 1.1 },
  { freq1: 0.015, freq2: 0.041, freq3: 0.088, freq4: 0.165, amp: 28, phase: 2.3 },
  { freq1: 0.025, freq2: 0.063, freq3: 0.105, freq4: 0.225, amp: 20, phase: 0.7 },
  { freq1: 0.019, freq2: 0.052, freq3: 0.098, freq4: 0.195, amp: 24, phase: 1.8 },
  { freq1: 0.021, freq2: 0.044, freq3: 0.091, freq4: 0.175, amp: 23, phase: 3.1 },
  { freq1: 0.017, freq2: 0.049, freq3: 0.101, freq4: 0.190, amp: 21, phase: 0.4 },
  { freq1: 0.023, freq2: 0.055, freq3: 0.109, freq4: 0.205, amp: 25, phase: 2.0 },
  { freq1: 0.016, freq2: 0.043, freq3: 0.086, freq4: 0.170, amp: 27, phase: 1.5 },
];

const COLOR_SCHEMES = {
  default:  ['#7C3AED', '#0EA5E9', '#8B5CF6', '#06B6D4', '#3B82F6', '#A78BFA', '#9333EA', '#38BDF8', '#6D28D9'],
  seizure:  ['#EF4444', '#F97316', '#DC2626', '#FB923C', '#F59E0B', '#EF4444', '#B91C1C', '#EA580C', '#991B1B'],
  normal:   ['#10B981', '#22C55E', '#34D399', '#4ADE80', '#059669', '#6EE7B7', '#047857', '#16A34A', '#065F46'],
};

export default function EEGBackground({ mode = 'default' }) {
  const canvasRef = useRef(null);
  const colorsRef = useRef(COLOR_SCHEMES[mode] ?? COLOR_SCHEMES.default);

  useEffect(() => {
    colorsRef.current = COLOR_SCHEMES[mode] ?? COLOR_SCHEMES.default;
  }, [mode]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx    = canvas.getContext('2d');
    const N      = BASE_CHANNELS.length;

    // ── Per-band phase accumulators (independent random-walk) ─────────────────
    const phases = BASE_CHANNELS.map(ch => ({
      alpha: ch.phase,
      beta:  ch.phase * 1.7  + 0.5,
      theta: ch.phase * 0.6  + 1.2,
      delta: ch.phase * 0.3  + 0.8,
    }));

    // ── Amplitude envelopes — slow random drift ───────────────────────────────
    const envs       = Array.from({ length: N }, () => 0.8 + Math.random() * 0.4);
    const envTargets = Array.from({ length: N }, () => 0.6 + Math.random() * 0.8);
    const envSpeeds  = Array.from({ length: N }, () => 0.0008 + Math.random() * 0.0012);

    // ── Burst-suppression: channels independently go quiet ────────────────────
    const burstState = Array.from({ length: N }, () => ({
      active:      true,
      timer:       Math.random() * 300,
      burstDur:    200 + Math.random() * 400,
      suppressDur: 80  + Math.random() * 160,
      suppressAmp: 0.05 + Math.random() * 0.08,
    }));

    // ── Spike state: sharp-wave + slow-wave complex (realistic morphology) ────
    const spikeState = Array.from({ length: N }, () => ({
      countdown:   120 + Math.random() * 300,
      firing:      false,
      firingFrame: 0,
      firingDur:   0,
      direction:   1,
      afterjitter: 0,
    }));

    // ── Very-slow background drift (unique per channel) ───────────────────────
    const driftPhase = Array.from({ length: N }, () => Math.random() * Math.PI * 2);
    const driftFreq  = Array.from({ length: N }, () => 0.0003 + Math.random() * 0.0004);

    // ── Correlated slow noise walkers ─────────────────────────────────────────
    const noiseWalkers = Array.from({ length: N }, () => ({
      val:    0,
      target: (Math.random() - 0.5) * 2,
      speed:  0.04 + Math.random() * 0.04,
    }));

    let buffers = null;
    let frame   = 0;
    let animId;
    const SCROLL_SPEED = 5;

    const initBuffers = () => {
      buffers = BASE_CHANNELS.map(() => new Float32Array(canvas.width));
    };

    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
      initBuffers();
    };

    resize();
    window.addEventListener('resize', resize);

    const draw = () => {
      const { width: W, height: H } = canvas;
      const colors = colorsRef.current;

      ctx.clearRect(0, 0, W, H);
      frame++;

      BASE_CHANNELS.forEach((ch, i) => {
        const buf = buffers[i];

        // ── Envelope drift ────────────────────────────────────────────────────
        envs[i] += (envTargets[i] - envs[i]) * envSpeeds[i] * SCROLL_SPEED;
        if (Math.abs(envs[i] - envTargets[i]) < 0.02) {
          envTargets[i] = 0.5 + Math.random() * 1.1;
          envSpeeds[i]  = 0.0006 + Math.random() * 0.0014;
        }

        // ── Burst-suppression toggle ──────────────────────────────────────────
        const bs = burstState[i];
        bs.timer -= SCROLL_SPEED;
        if (bs.timer <= 0) {
          bs.active = !bs.active;
          bs.timer  = bs.active
            ? (bs.burstDur    = 180 + Math.random() * 380)
            : (bs.suppressDur = 60  + Math.random() * 140);
        }
        const burstFactor = bs.active ? envs[i] : bs.suppressAmp;

        // ── Noise walker ──────────────────────────────────────────────────────
        const nw = noiseWalkers[i];
        nw.val += (nw.target - nw.val) * nw.speed;
        if (Math.abs(nw.val - nw.target) < 0.05) {
          nw.target = (Math.random() - 0.5) * 3;
          nw.speed  = 0.03 + Math.random() * 0.06;
        }

        buf.copyWithin(0, SCROLL_SPEED);

        for (let s = 0; s < SCROLL_SPEED; s++) {
          // ── Random-walk each band's phase (breaks periodicity) ────────────
          phases[i].alpha += ch.freq1 * (0.90 + Math.random() * 0.20);
          phases[i].beta  += ch.freq2 * (0.85 + Math.random() * 0.30);
          phases[i].theta += ch.freq3 * (0.92 + Math.random() * 0.16);
          phases[i].delta += ch.freq4 * (0.88 + Math.random() * 0.24);

          // ── Very-slow drift baseline ──────────────────────────────────────
          const drift = Math.sin(
            driftPhase[i] + (frame * SCROLL_SPEED + s) * driftFreq[i]
          ) * ch.amp * 0.22;

          // ── Alpha spindle (waxes/wanes — 0.5 s bursts realistic) ─────────
          const alphaEnv = 0.55 + 0.45 * Math.sin(frame * 0.003 + i * 0.7);
          const alpha    = Math.sin(phases[i].alpha) * ch.amp * 0.38 * alphaEnv;

          // ── Beta (fast, low amplitude) ────────────────────────────────────
          const beta  = Math.sin(phases[i].beta)  * ch.amp * 0.14;

          // ── Theta ─────────────────────────────────────────────────────────
          const theta = Math.sin(phases[i].theta) * ch.amp * 0.22;

          // ── Delta (slow large waves, like sleep) ──────────────────────────
          const delta = Math.sin(phases[i].delta) * ch.amp * 0.30;

          // ── EMG-like micro-noise + occasional burst ───────────────────────
          const emgBurst = Math.random() > 0.88 ? 4 : 1;
          const emg = (Math.random() - 0.5) * ch.amp * 0.09 +
                      (Math.random() - 0.5) * ch.amp * 0.05 * emgBurst;

          // ── Correlated slow noise ─────────────────────────────────────────
          const slowNoise = nw.val * ch.amp * 0.06;

          let sample = (alpha + beta + theta + delta + emg + slowNoise + drift)
                       * burstFactor;

          // ── Realistic spike: sharp-wave + trailing slow-wave complex ──────
          const sp = spikeState[i];
          sp.countdown--;

          if (!sp.firing && sp.countdown <= 0) {
            sp.firing      = true;
            sp.firingFrame = 0;
            // Mainly negative deflection (like real epileptic spikes)
            sp.direction  = Math.random() > 0.45 ? -1 : 1;
            sp.firingDur  = 6 + Math.floor(Math.random() * 8);
            sp.afterjitter = 0;
            // Longer inter-spike interval during suppression
            sp.countdown  = 140 + Math.random() * 280 + (bs.active ? 0 : 200);
          }

          if (sp.firing) {
            const f  = sp.firingFrame;
            const fd = sp.firingDur;

            if (f < fd) {
              // Gaussian sharp spike
              const peak = sp.direction * ch.amp * (2.4 + Math.random() * 0.8);
              sample += peak * Math.exp(-Math.pow((f - fd * 0.35) / (fd * 0.25), 2));
            } else if (f < fd * 3.5) {
              // Slow wave (opposite polarity, broad, decaying)
              const slowPos  = (f - fd) / (fd * 2.5);
              const slowPeak = -sp.direction * ch.amp * (0.7 + Math.random() * 0.3);
              sample += slowPeak * Math.sin(slowPos * Math.PI) * Math.exp(-slowPos * 1.8);
              // Afterdischarge micro-jitter
              sp.afterjitter = (Math.random() - 0.5) * ch.amp * 0.18;
              sample += sp.afterjitter;
            } else {
              sp.firing      = false;
              sp.firingFrame = -1;
            }
            sp.firingFrame++;
          }

          buf[W - SCROLL_SPEED + s] = sample;
        }

        const yBase = (H / (N + 1)) * (i + 1);
        const color = colors[i];

        // Wide soft glow
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth   = 3.5;
        ctx.globalAlpha = 0.18;
        for (let x = 0; x < W; x++) {
          x === 0 ? ctx.moveTo(x, yBase + buf[x]) : ctx.lineTo(x, yBase + buf[x]);
        }
        ctx.stroke();

        // Bright centre line
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth   = 0.9;
        ctx.globalAlpha = 0.65;
        for (let x = 0; x < W; x++) {
          x === 0 ? ctx.moveTo(x, yBase + buf[x]) : ctx.lineTo(x, yBase + buf[x]);
        }
        ctx.stroke();

        ctx.globalAlpha = 1;
      });

      animId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        opacity: 0.70,
      }}
    />
  );
}
