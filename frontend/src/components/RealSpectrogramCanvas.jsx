import { useEffect, useRef } from 'react';

/* ── Cooley-Tukey radix-2 FFT (in-place) ─────────────────────────────────── */
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const theta = (-2 * Math.PI) / len;
    const dwr = Math.cos(theta), dwi = Math.sin(theta);
    for (let i = 0; i < n; i += len) {
      let wr = 1, wi = 0;
      for (let k = 0; k < len >> 1; k++) {
        const ur = re[i+k], ui = im[i+k];
        const vr = re[i+k+(len>>1)]*wr - im[i+k+(len>>1)]*wi;
        const vi = re[i+k+(len>>1)]*wi + im[i+k+(len>>1)]*wr;
        re[i+k] = ur+vr; im[i+k] = ui+vi;
        re[i+k+(len>>1)] = ur-vr; im[i+k+(len>>1)] = ui-vi;
        const nwr = wr*dwr - wi*dwi; wi = wr*dwi + wi*dwr; wr = nwr;
      }
    }
  }
}

function hannWindow(size) {
  const w = new Float32Array(size);
  for (let i = 0; i < size; i++) w[i] = 0.5*(1-Math.cos((2*Math.PI*i)/(size-1)));
  return w;
}

function computeSTFT(signal, winSize, hopSize) {
  const hann = hannWindow(winSize);
  const numFrames = Math.max(1, Math.floor((signal.length - winSize) / hopSize) + 1);
  const numBins   = winSize >> 1;
  const frames    = new Array(numFrames);
  for (let f = 0; f < numFrames; f++) {
    const start = f * hopSize;
    const re = new Float32Array(winSize), im = new Float32Array(winSize);
    for (let i = 0; i < winSize; i++)
      re[i] = (start+i < signal.length ? signal[start+i] : 0) * hann[i];
    fft(re, im);
    const mags = new Float32Array(numBins);
    for (let k = 0; k < numBins; k++) mags[k] = Math.sqrt(re[k]*re[k]+im[k]*im[k]);
    frames[f] = mags;
  }
  return { frames, numFrames, numBins };
}

/* ── Inferno colormap ────────────────────────────────────────────────────── */
function heatColor(t) {
  const stops = [[8,8,40],[70,15,115],[175,42,90],[245,130,40],[252,253,170]];
  const n = stops.length - 1;
  const i = Math.min(n-1, Math.floor(t*n));
  const f = t*n - i;
  return stops[i].map((c,j) => Math.round(c+(stops[i+1][j]-c)*f));
}

/* ── Layout constants ────────────────────────────────────────────────────── */
const WIN     = 256;
const HOP     = 128;
const MAX_HZ  = 60;
const AXIS_H  = 22;   // bottom time-axis strip
const LABEL_W = 52;   // left freq-label strip

/* ── Build spectrogram data (run once) ───────────────────────────────────── */
function buildData(signal, sampleRate) {
  const { frames, numFrames } = computeSTFT(signal, WIN, HOP);
  const maxBin = Math.min(WIN>>1, Math.round((MAX_HZ/sampleRate)*WIN));
  let gMin = Infinity, gMax = -Infinity;
  const logFrames = frames.map(mags => {
    const lm = new Float32Array(maxBin);
    for (let k = 0; k < maxBin; k++) {
      lm[k] = Math.log1p(mags[k]);
      if (lm[k] < gMin) gMin = lm[k];
      if (lm[k] > gMax) gMax = lm[k];
    }
    return lm;
  });
  const range    = (gMax - gMin) || 1;
  const totalSec = (numFrames * HOP) / sampleRate;
  return { logFrames, numFrames, maxBin, gMin, range, totalSec };
}

/* ── Build heatmap ImageData (run once per canvas size) ──────────────────── */
function buildImageData(data, plotW, plotH) {
  const { logFrames, numFrames, maxBin, gMin, range } = data;
  const img = new ImageData(plotW, plotH);
  const px  = img.data;
  for (let px_x = 0; px_x < plotW; px_x++) {
    const fi = Math.min(numFrames-1, Math.floor((px_x/plotW)*numFrames));
    const lm = logFrames[fi];
    for (let px_y = 0; px_y < plotH; px_y++) {
      const bin = Math.floor(((plotH-1-px_y)/plotH)*(maxBin-1));
      const t   = (lm[bin]-gMin)/range;
      const [r,g,b] = heatColor(Math.max(0,Math.min(1,t)));
      const idx = (px_y*plotW+px_x)*4;
      px[idx]=r; px[idx+1]=g; px[idx+2]=b; px[idx+3]=230;
    }
  }
  return img;
}

/* ── Draw frequency labels + time axis (static) ──────────────────────────── */
function niceInterval(s) {
  if (s<=1) return 0.25; if (s<=2) return 0.5; if (s<=5) return 1;
  if (s<=10) return 2;   if (s<=20) return 5;  if (s<=60) return 10; return 30;
}

function drawStaticOverlay(ctx, W, H, totalSec) {
  const plotH = H - AXIS_H;

  // ── Freq guide lines + labels ──
  const freqTicks = [
    {hz:60,label:'60Hz'},{hz:30,label:'30Hz γ'},{hz:13,label:'13Hz β'},
    {hz:8, label:' 8Hz α'},{hz:4, label:' 4Hz θ'},{hz:0, label:' 0Hz δ'},
  ];
  ctx.font='9px monospace'; ctx.textAlign='right';
  freqTicks.forEach(({hz,label}) => {
    const y = plotH - Math.round((hz/MAX_HZ)*plotH);
    ctx.strokeStyle='rgba(255,255,255,0.12)'; ctx.lineWidth=0.8;
    ctx.beginPath(); ctx.moveTo(LABEL_W,y); ctx.lineTo(W,y); ctx.stroke();
    ctx.fillStyle='rgba(255,255,255,0.60)';
    ctx.fillText(label, LABEL_W-4, Math.max(9, Math.min(plotH-2, y+4)));
  });

  // ── Separator ──
  ctx.strokeStyle='rgba(255,255,255,0.18)'; ctx.lineWidth=0.8;
  ctx.beginPath(); ctx.moveTo(LABEL_W,plotH); ctx.lineTo(W,plotH); ctx.stroke();

  // ── Time ticks ──
  const plotW    = W - LABEL_W;
  const interval = niceInterval(totalSec);
  ctx.font='9px monospace'; ctx.textAlign='center';
  for (let t=0; t<=totalSec+1e-9; t+=interval) {
    if (t/totalSec > 1.001) break;
    const x = LABEL_W + Math.round((t/totalSec)*plotW);
    ctx.strokeStyle='rgba(255,255,255,0.30)'; ctx.lineWidth=0.8;
    ctx.beginPath(); ctx.moveTo(x,plotH); ctx.lineTo(x,plotH+5); ctx.stroke();
    const lbl = Number.isInteger(t) ? `${t}s` : `${t.toFixed(1)}s`;
    ctx.fillStyle='rgba(255,255,255,0.50)';
    const clampX = Math.max(LABEL_W+14, Math.min(W-14, x));
    ctx.fillText(lbl, clampX, plotH+15);
  }
}

/* ── Animated time counter (top-right) ───────────────────────────────────── */
function drawTimeCounter(ctx, W, currentSec, totalSec) {
  const cur   = currentSec.toFixed(2);
  const total = totalSec.toFixed(1);

  ctx.font = 'bold 12px monospace';
  const curW = ctx.measureText(`${cur}s`).width;
  ctx.font = '10px monospace';
  const sepW = ctx.measureText(` / ${total}s`).width;

  const pad = 8, gap = 4;
  const boxW = curW + sepW + pad*2 + gap;
  const boxH = 22;
  const boxX = W - boxW - 10;
  const boxY = 8;

  // Pill background
  ctx.fillStyle = 'rgba(0,0,0,0.60)';
  ctx.beginPath();
  ctx.roundRect(boxX, boxY, boxW, boxH, 5);
  ctx.fill();

  // Pulse dot
  ctx.fillStyle = '#00D4FF';
  ctx.beginPath();
  ctx.arc(boxX + pad - 2, boxY + boxH/2, 3, 0, Math.PI*2);
  ctx.fill();

  // Current time — cyan
  ctx.font = 'bold 12px monospace';
  ctx.fillStyle = '#00D4FF';
  ctx.textAlign = 'left';
  ctx.fillText(`${cur}s`, boxX + pad + gap, boxY + boxH/2 + 4);

  // Total — dim
  ctx.font = '10px monospace';
  ctx.fillStyle = 'rgba(255,255,255,0.38)';
  ctx.fillText(` / ${total}s`, boxX + pad + gap + curW, boxY + boxH/2 + 4);
}

/* ── React component ─────────────────────────────────────────────────────── */
export default function RealSpectrogramCanvas({ signal, sampleRate = 256 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!signal || signal.length < 32) return;

    const canvas = canvasRef.current;
    let animId;
    let startTs  = null;

    // Holds precomputed data & cached ImageData
    const cache = { data: null, img: null, W: 0, H: 0 };

    const setup = () => {
      const W = canvas.parentElement?.offsetWidth || 800;
      const H = 280;
      canvas.width  = W;
      canvas.height = H;
      const plotW = W - LABEL_W;
      const plotH = H - AXIS_H;

      if (!cache.data) cache.data = buildData(signal, sampleRate);
      // Rebuild ImageData only when size changes
      if (cache.W !== plotW || cache.H !== plotH) {
        cache.img = buildImageData(cache.data, plotW, plotH);
        cache.W = plotW;
        cache.H = plotH;
      }
      startTs = null; // reset timer on resize
    };

    setup();

    const ro = new ResizeObserver(setup);
    ro.observe(canvas.parentElement);

    const animate = (ts) => {
      const { data, img } = cache;
      if (!data || !img) { animId = requestAnimationFrame(animate); return; }

      if (!startTs) startTs = ts;
      const currentSec = ((ts - startTs) / 1000) % data.totalSec;

      const ctx = canvas.getContext('2d');
      const W   = canvas.width, H = canvas.height;

      ctx.clearRect(0, 0, W, H);
      ctx.putImageData(img, LABEL_W, 0);        // fast static heatmap
      drawStaticOverlay(ctx, W, H, data.totalSec); // freq labels + time ticks
      drawTimeCounter(ctx, W, currentSec, data.totalSec); // animated counter

      animId = requestAnimationFrame(animate);
    };

    animId = requestAnimationFrame(animate);

    return () => { cancelAnimationFrame(animId); ro.disconnect(); };
  }, [signal, sampleRate]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: 280, display: 'block', borderRadius: '0.75rem' }}
    />
  );
}
