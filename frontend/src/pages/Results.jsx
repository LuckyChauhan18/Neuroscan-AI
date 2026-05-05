import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  FiDownload, FiStar, FiSend, FiActivity, FiAlertTriangle, FiCheckCircle,
  FiArrowLeft, FiCpu, FiAlertCircle, FiHeart, FiCalendar, FiList,
  FiZap, FiShield, FiBookOpen, FiSun, FiUser, FiMail, FiUsers, FiInfo,
  FiClipboard,
} from 'react-icons/fi';
import { getPredictionDetail, getReport, downloadReport, submitFeedback } from '../api';
import SpectrogramCanvas from '../components/SpectrogramCanvas';
import RealSpectrogramCanvas from '../components/RealSpectrogramCanvas';
import logger from '../utils/logger';

/* ─── Signal stat descriptions ──────────────────────────────────────────── */
const STAT_INFO = {
  // ── Image / pixel stats (spectrogram inputs) ──
  mean_pixel:   { what: 'Average brightness across every pixel in the image. High value = mostly white/light background — typical for EEG spectrograms.', formula: 'Σ pixel_values ÷ N', range: '0 (black) → 255 (white)' },
  std_pixel:    { what: 'How much pixel brightness varies from the mean. Higher std = more contrast between bright and dark regions (signal vs background).', formula: '√( Σ(x − μ)² ÷ N )', range: '0 = uniform image, 127 = max contrast' },
  min_pixel:    { what: 'Darkest pixel found in the image. 0 means at least one pure-black pixel exists (e.g. an EEG trace line).', formula: 'min of all pixel values', range: '0 → 255' },
  max_pixel:    { what: 'Brightest pixel found in the image. 255 means at least one pure-white pixel exists (e.g. the background).', formula: 'max of all pixel values', range: '0 → 255' },
  width:        { what: 'Width of the image in pixels that was fed into the model. The model resizes inputs to a fixed size before inference.', formula: 'image.shape[1]', range: 'pixels' },
  height:       { what: 'Height of the image in pixels. Combined with Width it defines the total spatial resolution of the input.', formula: 'image.shape[0]', range: 'pixels' },
  num_points:   { what: 'Total number of pixels analysed — equal to Width × Height. Each pixel is one data point in the feature space.', formula: 'Width × Height', range: 'e.g. 219 × 230 = 50 370' },
  // ── Raw EEG signal stats (CSV / EDF inputs) ──
  mean:         { what: 'Average amplitude of the EEG signal over the recording window. Values close to zero indicate a well-centred signal.', formula: 'Σ amplitudes ÷ N samples', range: 'μV (microvolts)' },
  std:          { what: 'Standard deviation of EEG amplitude. Higher std = more volatile brain activity. Seizures often show elevated std.', formula: '√( Σ(x − μ)² ÷ N )', range: 'μV' },
  variance:     { what: 'Squared spread of signal amplitude — the square of std. Used in power calculations.', formula: 'std²', range: 'μV²' },
  min:          { what: 'Most negative amplitude in the recording — the deepest trough of the waveform.', formula: 'min(all samples)', range: 'μV' },
  max:          { what: 'Highest amplitude in the recording — the tallest peak of the waveform.', formula: 'max(all samples)', range: 'μV' },
  peak_to_peak: { what: 'Total amplitude swing from the lowest to the highest value. Large peak-to-peak is a hallmark of ictal (seizure) activity.', formula: 'max − min', range: 'μV' },
  rms:          { what: 'Root-mean-square — measures the energy/power of the signal regardless of sign. Higher RMS = more intense neural activity.', formula: '√( Σx² ÷ N )', range: 'μV' },
  skewness:     { what: 'Asymmetry of the amplitude distribution. Seizure discharges often produce a skewed distribution due to sharp spike-wave complexes.', formula: 'E[(x−μ)³] ÷ σ³', range: '0 = symmetric' },
  kurtosis:     { what: 'Sharpness/"peakedness" of amplitude distribution. High kurtosis indicates frequent sharp spikes — common in epileptic activity.', formula: 'E[(x−μ)⁴] ÷ σ⁴', range: '3 = normal distribution' },
  num_samples:  { what: 'Total number of EEG data points (samples) in the uploaded recording.', formula: 'len(signal)', range: 'samples' },
  duration_sec: { what: 'Duration of the EEG recording in seconds.', formula: 'num_samples ÷ sample_rate', range: 'seconds' },
  sample_rate:  { what: 'Number of EEG data points recorded per second. Common values: 256 Hz, 512 Hz.', formula: 'hardware setting', range: 'Hz' },
};

/* ─── Stat row with hover tooltip ───────────────────────────────────────── */
function StatRow({ statKey, value }) {
  const [open, setOpen] = useState(false);
  const key  = statKey.toLowerCase().replace(/ /g, '_');
  const info = STAT_INFO[key] ?? null;
  const label = statKey.replace(/_/g, ' ');
  const display = typeof value === 'number' ? value.toFixed(3) : value;

  return (
    <div className="relative flex justify-between items-center py-2 border-b border-white/5 group">
      {/* Label + info icon */}
      <div
        className="flex items-center gap-1.5 cursor-help"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        <span className="text-gray-400 text-sm capitalize">{label}</span>
        {info && (
          <FiInfo
            size={11}
            className="text-gray-600 group-hover:text-primary-400 transition-colors flex-shrink-0"
          />
        )}
      </div>

      <span className="text-white font-mono text-sm">{display}</span>

      {/* Tooltip */}
      {open && info && (
        <div className="absolute left-0 bottom-full mb-2 z-50 w-72 bg-[#111420] border border-white/15 rounded-xl p-3.5 shadow-2xl pointer-events-none">
          {/* Arrow */}
          <div className="absolute left-4 top-full w-0 h-0"
            style={{ borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderTop: '6px solid rgba(255,255,255,0.15)' }} />

          <p className="text-primary-400 text-xs font-semibold capitalize tracking-wide mb-1.5">{label}</p>
          <p className="text-gray-300 text-xs leading-relaxed mb-3">{info.what}</p>

          <div className="grid grid-cols-2 gap-2">
            <div className="bg-black/30 rounded-lg px-2.5 py-2">
              <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-0.5">Formula</p>
              <p className="text-primary-300 text-xs font-mono leading-snug">{info.formula}</p>
            </div>
            <div className="bg-black/30 rounded-lg px-2.5 py-2">
              <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-0.5">Unit / Range</p>
              <p className="text-gray-300 text-xs font-mono leading-snug">{info.range}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Risk badge config ─────────────────────────────────────────────────── */
const RISK_CONFIG = {
  Low:      { color: 'text-green-400',  bg: 'bg-green-400/10',  border: 'border-green-400/30',  dot: 'bg-green-400'  },
  Moderate: { color: 'text-yellow-400', bg: 'bg-yellow-400/10', border: 'border-yellow-400/30', dot: 'bg-yellow-400' },
  High:     { color: 'text-orange-400', bg: 'bg-orange-400/10', border: 'border-orange-400/30', dot: 'bg-orange-400' },
  Critical: { color: 'text-red-400',    bg: 'bg-red-400/10',    border: 'border-red-400/30',    dot: 'bg-red-400'    },
  Unknown:  { color: 'text-gray-400',   bg: 'bg-gray-400/10',   border: 'border-gray-400/30',   dot: 'bg-gray-400'   },
};

/* ─── Section wrapper ───────────────────────────────────────────────────── */
function ReportSection({ icon: Icon, title, color = 'text-primary-400', children, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className="space-y-3"
    >
      <h3 className={`flex items-center gap-2 text-sm font-semibold uppercase tracking-widest ${color}`}>
        <Icon size={14} />
        {title}
      </h3>
      {children}
    </motion.div>
  );
}

/* ─── Tag chip ──────────────────────────────────────────────────────────── */
function Chip({ label, color = 'text-primary-400 bg-primary-400/10 border-primary-400/20' }) {
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full border text-xs font-medium ${color}`}>
      {label}
    </span>
  );
}

/* ─── Bullet item ───────────────────────────────────────────────────────── */
function BulletItem({ text, accent = 'bg-primary-400' }) {
  return (
    <li className="flex items-start gap-3 text-gray-300 text-sm leading-relaxed">
      <span className={`w-1.5 h-1.5 rounded-full ${accent} mt-2 flex-shrink-0`} />
      {text}
    </li>
  );
}

/* ─── Main component ────────────────────────────────────────────────────── */
export default function Results({ onModeChange }) {
  const { id } = useParams();
  const [data, setData]               = useState(null);
  const [report, setReport]           = useState(null);
  const [loading, setLoading]         = useState(true);
  const [rating, setRating]           = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment]         = useState('');
  const [feedbackSent, setFeedbackSent]   = useState(false);
  const [downloading, setDownloading]     = useState(null);
  const [downloadError, setDownloadError] = useState(null);
  const [feedbackError, setFeedbackError] = useState(null);
  const [loadError, setLoadError]         = useState(null);
  const [vizTab, setVizTab]               = useState('spectrogram'); // 'spectrogram' | 'signal'

  useEffect(() => {
    Promise.all([getPredictionDetail(id), getReport(id)])
      .then(([pred, rep]) => { setData(pred.data); setReport(rep.data); })
      .catch((err) => {
        logger.error('Failed to load results:', err.userMessage || err.message);
        setLoadError(err.userMessage || 'Failed to load results. Please try again.');
      })
      .finally(() => setLoading(false));
    // Reset EEG background to default when leaving the results page
    return () => onModeChange?.('default');
  }, [id]);

  // Switch EEG background color based on prediction result
  useEffect(() => {
    if (!data) return;
    onModeChange?.(data.prediction === 'Seizure' ? 'seizure' : 'normal');
  }, [data]);

  const handleDownload = async (format) => {
    setDownloading(format);
    setDownloadError(null);
    try {
      const res = await downloadReport(id, format);
      const blob = new Blob([res.data]);
      const url  = window.URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url;
      a.download = `seizure_report_${id}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      logger.info(`Report downloaded: ${format}`);
    } catch (err) {
      logger.error('Report download failed:', err.userMessage || err.message);
      setDownloadError(err.userMessage || 'Download failed. Please try again.');
    } finally {
      setDownloading(null);
    }
  };

  const handleFeedback = async () => {
    if (!rating) return;
    setFeedbackError(null);
    try {
      await submitFeedback({ prediction_id: id, rating, comment });
      setFeedbackSent(true);
      logger.info('Feedback submitted');
    } catch (err) {
      logger.error('Feedback submission failed:', err.userMessage || err.message);
      setFeedbackError(err.userMessage || 'Could not submit feedback. Please try again.');
    }
  };

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="min-h-screen pt-24 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-primary-400 font-heading text-lg">Preparing results...</p>
        </div>
      </div>
    );
  }

  /* ── Load error ── */
  if (loadError) {
    return (
      <div className="min-h-screen pt-24 flex items-center justify-center px-4">
        <div className="glass-card p-8 max-w-md text-center">
          <FiAlertCircle className="text-red-400 text-4xl mx-auto mb-4" />
          <h2 className="text-xl font-heading font-bold text-white mb-2">Failed to Load Results</h2>
          <p className="text-gray-400 text-sm mb-6">{loadError}</p>
          <button onClick={() => window.location.reload()} className="btn-primary py-2 px-6">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!data) return <div className="min-h-screen pt-24 text-center text-gray-400">Prediction not found.</div>;

  const isSeizure  = data.prediction === 'Seizure';
  const eegChartData = (data.eeg_data || []).map((v, i) => ({ point: i + 1, amplitude: v }));
  const confidence   = (data.confidence * 100).toFixed(1);
  const modelUsed    = data.model_used || 'tabular';
  const modelLabel   = modelUsed === 'ensemble'        ? 'EfficientNetB0 + Gemini Vision'
                     : modelUsed === 'image'           ? 'EfficientNetB0 (Image)'
                     : modelUsed === 'gemini-vision'   ? 'Gemini Vision AI'
                     : modelUsed === 'gemini-fallback' ? 'Gemini AI (Fallback)'
                     : modelUsed === 'unavailable'     ? 'Analysis Unavailable'
                     : 'Tabular Model';
  const modelColor   = modelUsed === 'ensemble'        ? 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10'
                     : modelUsed === 'gemini-vision'   ? 'text-blue-400 border-blue-400/30 bg-blue-400/10'
                     : modelUsed === 'gemini-fallback' ? 'text-yellow-400 border-yellow-400/30 bg-yellow-400/10'
                     : modelUsed === 'image'           ? 'text-purple-400 border-purple-400/30 bg-purple-400/10'
                     : modelUsed === 'unavailable'     ? 'text-red-400 border-red-400/30 bg-red-400/10'
                     : 'text-primary-400 border-primary-400/30 bg-primary-400/10';

  /* ── Detailed report sections ── */
  const dr   = report?.detailed_report || {};
  const risk = dr.risk_assessment || {};
  const riskCfg = RISK_CONFIG[risk.level] || RISK_CONFIG.Unknown;

  const confidenceNum = parseFloat(confidence);
  const confidenceLevel = dr.confidence_level ||
    (confidenceNum < 30 ? 'Low' : confidenceNum < 70 ? 'Moderate' : 'High');
  const confidenceLevelColor =
    confidenceLevel === 'High'     ? 'text-green-400 border-green-400/30 bg-green-400/10' :
    confidenceLevel === 'Moderate' ? 'text-yellow-400 border-yellow-400/30 bg-yellow-400/10' :
                                     'text-gray-400 border-gray-400/30 bg-gray-400/10';

  return (
    <div className="min-h-screen pt-24 pb-16 px-4">
      <div className="max-w-6xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>

          {/* Back link */}
          <Link to="/upload" className="inline-flex items-center gap-2 text-gray-400 hover:text-primary-400 mb-6 transition-colors text-sm">
            <FiArrowLeft /> Back to Upload
          </Link>

          {/* ── Prediction Header ── */}
          <div className={`glass-card p-5 sm:p-8 mb-6 border ${isSeizure ? 'border-red-500/30' : 'border-green-500/30'}`}>
            <div className="flex flex-col md:flex-row items-center gap-6">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200 }}
                className={`w-24 h-24 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                  isSeizure ? 'bg-red-500/20 shadow-glow-red' : 'bg-green-500/20 shadow-glow-green'
                }`}
              >
                {isSeizure
                  ? <FiAlertTriangle className="text-red-400 text-4xl" />
                  : <FiCheckCircle  className="text-green-400 text-4xl" />}
              </motion.div>

              <div className="text-center md:text-left flex-1">
                <h1 className="text-3xl font-heading font-bold text-white mb-1">
                  {isSeizure ? 'Seizure Detected' : 'No Seizure Detected'}
                </h1>
                <p className="text-gray-400 text-sm mb-2">
                  {data.filename} &bull; {data.file_type?.toUpperCase()}
                </p>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-medium ${modelColor}`}>
                  <FiCpu size={11} /> {modelLabel}
                </span>
              </div>

              {/* Confidence ring */}
              <div className="text-center flex-shrink-0">
                <div className={`text-4xl sm:text-5xl font-heading font-bold ${isSeizure ? 'text-red-400' : 'text-green-400'}`}>
                  {confidence}%
                </div>
                <p className="text-gray-500 text-xs mt-1 uppercase tracking-widest">AI Confidence</p>
                <span className={`mt-1.5 inline-flex items-center px-2.5 py-0.5 rounded-full border text-[11px] font-semibold ${confidenceLevelColor}`}>
                  {confidenceLevel} Certainty
                </span>
                <p className="text-gray-600 text-[10px] mt-1">Model score, not clinical</p>
              </div>
            </div>
          </div>

          {/* ── EEG Chart + Signal Stats ── */}
          <div className="grid lg:grid-cols-3 gap-6 mb-6">
            <div className="lg:col-span-2 glass-card p-4 sm:p-6">

              {/* Header + tabs */}
              <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                <h2 className="text-xl font-heading font-semibold text-white flex items-center gap-2">
                  <FiActivity className="text-primary-400" />
                  {eegChartData.length > 0 ? 'Signal Analysis' : 'Spectrogram Analysis'}
                </h2>
                {eegChartData.length > 0 && (
                  <div className="flex rounded-lg overflow-hidden border border-white/10 text-xs font-semibold">
                    {[
                      { key: 'spectrogram', label: 'STFT Spectrogram' },
                      { key: 'signal',      label: 'Raw Signal' },
                    ].map(({ key, label }) => (
                      <button
                        key={key}
                        onClick={() => setVizTab(key)}
                        className={`px-3 py-1.5 transition-colors ${
                          vizTab === key
                            ? 'bg-primary-500/20 text-primary-400'
                            : 'text-gray-500 hover:text-gray-300'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {eegChartData.length > 0 ? (
                vizTab === 'spectrogram' ? (
                  <div className="space-y-2">
                    <RealSpectrogramCanvas
                      signal={data.eeg_data}
                      sampleRate={data.sample_rate || 256}
                      isSeizure={isSeizure}
                    />
                    <div className="flex items-center justify-between mt-1.5">
                      <p className="text-xs text-gray-500">Frequency (Hz) ↑  ·  Time (s) →  ·  window 256 pts · hop 128 pts</p>
                      <div className="flex items-center gap-1.5">
                        <div className="h-2 w-20 rounded-full"
                          style={{ background: 'linear-gradient(to right, #08082a, #46107a, #af2a5a, #f58228, #fcfda9)' }} />
                        <p className="text-xs text-gray-600">low → high power</p>
                      </div>
                    </div>
                  </div>
                ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={eegChartData}>
                    <defs>
                      <linearGradient id="colorAmp" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={isSeizure ? '#FF1744' : '#00D4FF'} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={isSeizure ? '#FF1744' : '#00D4FF'} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e2030" />
                    <XAxis dataKey="point" stroke="#4a5568" tick={{ fontSize: 11 }}
                      label={{ value: 'Data Point', position: 'insideBottom', offset: -5, style: { fill: '#718096', fontSize: 12 } }} />
                    <YAxis stroke="#4a5568" tick={{ fontSize: 11 }}
                      label={{ value: 'Amplitude (μV)', angle: -90, position: 'insideLeft', style: { fill: '#718096', fontSize: 12 } }} />
                    <Tooltip
                      contentStyle={{ background: '#1e2030', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#e2e8f0' }}
                      labelStyle={{ color: '#00D4FF' }}
                    />
                    <Area type="monotone" dataKey="amplitude"
                      stroke={isSeizure ? '#FF1744' : '#00D4FF'}
                      fill="url(#colorAmp)" strokeWidth={1.5} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
                )
              ) : (data.spectrogram_url || data.original_img_url) ? (
                <div className="flex flex-col gap-3">
                  <div className={`grid gap-3 ${data.spectrogram_url && data.original_img_url ? 'grid-cols-2' : 'grid-cols-1'}`}>
                    {data.original_img_url && (
                      <div className="flex flex-col gap-1.5">
                        <p className="text-xs text-gray-400 font-medium flex items-center gap-1">
                          <FiActivity size={11} className="text-cyan-400" /> Original Waveform
                        </p>
                        <img
                          src={data.original_img_url}
                          alt="Original EEG waveform"
                          className="w-full h-48 rounded-xl object-cover border border-white/10 bg-white/5"
                        />
                      </div>
                    )}
                    {data.spectrogram_url && (
                      <div className="flex flex-col gap-1.5">
                        <p className="text-xs text-gray-400 font-medium flex items-center gap-1">
                          <FiCpu size={11} className="text-purple-400" /> Generated Spectrogram
                        </p>
                        <img
                          src={data.spectrogram_url}
                          alt="STFT Spectrogram"
                          className="w-full h-48 rounded-xl object-cover border border-white/10 bg-white/5"
                        />
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-gray-600 text-center">
                    EEG image → STFT spectrogram → EfficientNetB0
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-gray-400 font-medium flex items-center gap-1.5">
                      <FiActivity size={11} className="text-purple-400" />
                      STFT Frequency–Time Heatmap
                    </p>
                    <span className={`text-xs px-2.5 py-0.5 rounded-full border font-semibold ${
                      isSeizure
                        ? 'text-red-400 bg-red-400/10 border-red-400/25'
                        : 'text-green-400 bg-green-400/10 border-green-400/25'
                    }`}>
                      {isSeizure ? 'Ictal Pattern' : 'Normal Pattern'}
                    </span>
                  </div>
                  <SpectrogramCanvas isSeizure={isSeizure} />
                  <div className="flex items-center justify-between mt-1.5">
                    <p className="text-xs text-gray-600">Frequency (Hz) ↑ vs Time →</p>
                    <div className="flex items-center gap-1.5">
                      <div className="h-2 w-20 rounded-full"
                        style={{ background: 'linear-gradient(to right, #08082a, #46107a, #af2a5a, #f58228, #fcfda9)' }}
                      />
                      <p className="text-xs text-gray-600">low → high power</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Signal Stats */}
            <div className="glass-card p-4 sm:p-6">
              <h2 className="text-xl font-heading font-semibold text-white mb-4">Signal Statistics</h2>
              <div className="space-y-1">
                {data.signal_stats && Object.entries(data.signal_stats).map(([key, val]) => (
                  <StatRow key={key} statKey={key} value={val} />
                ))}
              </div>
            </div>
          </div>

          {/* ── MEDICAL REPORT ── */}
          {report && (
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="glass-card p-0 mt-6 overflow-hidden"
            >
              {/* Report header bar */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 sm:p-6 border-b border-white/5">
                <div>
                  <h2 className="text-xl font-heading font-semibold text-white">Medical Report</h2>
                  <p className="text-gray-500 text-xs mt-0.5">AI-generated clinical analysis • Always consult a neurologist</p>
                </div>
                <div className="flex flex-col items-start sm:items-end gap-2">
                  <div className="flex gap-2 flex-wrap">
                    {['pdf', 'docx', 'json'].map((fmt) => (
                      <button
                        key={fmt}
                        onClick={() => handleDownload(fmt)}
                        disabled={downloading === fmt}
                        className="btn-secondary py-2 px-4 text-sm inline-flex items-center gap-1.5 disabled:opacity-60"
                      >
                        {downloading === fmt
                          ? <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                          : <FiDownload size={13} />
                        }
                        {fmt.toUpperCase()}
                      </button>
                    ))}
                  </div>
                  {downloadError && (
                    <p className="text-red-400 text-xs flex items-center gap-1">
                      <FiAlertCircle size={11} /> {downloadError}
                    </p>
                  )}
                </div>
              </div>

              {/* ── Patient Info Card ── */}
              {report.patient_info && Object.values(report.patient_info).some(Boolean) && (() => {
                const pi = report.patient_info;
                const initials = (pi.full_name || pi.username || 'P')
                  .split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
                const sexColor = pi.sex === 'Female'
                  ? 'text-pink-400 bg-pink-400/10 border-pink-400/25'
                  : pi.sex === 'Male'
                  ? 'text-sky-400 bg-sky-400/10 border-sky-400/25'
                  : 'text-gray-400 bg-gray-400/10 border-gray-400/25';

                const fields = [
                  { label: 'Patient Name',  value: pi.full_name,   span: false },
                  { label: "Father's Name", value: pi.father_name, span: false },
                  { label: 'Age',           value: pi.age ? `${pi.age} yrs` : null, span: false },
                  { label: 'Email',         value: pi.email,       span: true  },
                ].filter(f => f.value);

                return (
                  <div className="mx-3 sm:mx-6 mt-4 sm:mt-6">
                    {/* Card */}
                    <div className="relative rounded-2xl overflow-hidden border border-white/10">

                      {/* Gradient top strip */}
                      <div className="h-1.5 w-full bg-gradient-to-r from-primary-600 via-primary-400 to-cyan-400" />

                      {/* Body: info LEFT, avatar RIGHT */}
                      <div className="bg-gradient-to-br from-white/[0.04] to-white/[0.01] p-4 sm:p-6 flex flex-col sm:flex-row gap-4 sm:gap-6 sm:items-center">

                        {/* Info section — left, 2-col grid */}
                        <div className="flex-1 min-w-0">
                          {/* Name + label */}
                          <div className="mb-4">
                            <p className="text-[10px] text-primary-400 uppercase tracking-[0.15em] font-medium mb-0.5">Patient</p>
                            <h3 className="text-xl font-heading font-bold text-white leading-tight">
                              {pi.full_name || pi.username}
                            </h3>
                          </div>

                          {/* Field pills — strict 2 columns */}
                          <div className="grid grid-cols-2 gap-3">
                            {fields.map((f, i) => (
                              <div
                                key={i}
                                className="rounded-xl bg-white/5 border border-white/8 px-3 py-2.5"
                              >
                                <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">{f.label}</p>
                                <p className={`text-sm font-semibold truncate ${f.label === 'Email' ? 'text-primary-400' : 'text-white'}`}>
                                  {f.value}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Avatar column — RIGHT */}
                        <div className="flex flex-col items-center gap-2 flex-shrink-0">
                          <div className="relative">
                            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-primary-500/25">
                              <span className="text-2xl font-heading font-bold text-white tracking-wide">{initials}</span>
                            </div>
                            <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-green-400 border-2 border-[#12131a] shadow" />
                          </div>
                          {pi.sex && (
                            <span className={`px-2.5 py-0.5 rounded-full border text-[11px] font-semibold tracking-wide ${sexColor}`}>
                              {pi.sex}
                            </span>
                          )}
                        </div>

                      </div>
                    </div>
                  </div>
                );
              })()}



              {/* ── Executive Summary ── */}
              {(dr.executive_summary || dr.summary) && (
                <div className={`mx-3 sm:mx-6 mt-4 sm:mt-6 rounded-xl px-4 sm:px-5 py-4 border ${
                  isSeizure ? 'bg-red-500/5 border-red-500/15' : 'bg-green-500/5 border-green-500/15'
                }`}>
                  <div className="flex items-start gap-3">
                    <FiClipboard
                      size={15}
                      className={`flex-shrink-0 mt-0.5 ${isSeizure ? 'text-red-400' : 'text-green-400'}`}
                    />
                    <div>
                      <p className={`text-[10px] font-bold uppercase tracking-[0.15em] mb-1.5 ${
                        isSeizure ? 'text-red-400' : 'text-green-400'
                      }`}>
                        Executive Summary
                      </p>
                      <p className="text-gray-300 text-sm leading-relaxed">
                        {dr.executive_summary || dr.summary}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Report body grid ── */}
              <div className="p-4 sm:p-6 grid md:grid-cols-2 gap-6 sm:gap-8">

                {/* LEFT COLUMN */}
                <div className="space-y-8">

                  {/* Risk Assessment */}
                  {risk.level && (
                    <ReportSection icon={FiShield} title="Risk Assessment" color={riskCfg.color} delay={0.05}>
                      <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border ${riskCfg.bg} ${riskCfg.border}`}>
                        <span className={`w-2 h-2 rounded-full ${riskCfg.dot} animate-pulse`} />
                        <span className={`text-sm font-bold ${riskCfg.color}`}>{risk.level} Risk</span>
                      </div>
                      {risk.rationale && (
                        <p className="text-gray-400 text-sm leading-relaxed">{risk.rationale}</p>
                      )}
                      {risk.factors?.length > 0 && (
                        <ul className="space-y-2">
                          {risk.factors.map((f, i) => (
                            <BulletItem key={i} text={f} accent={riskCfg.dot} />
                          ))}
                        </ul>
                      )}
                    </ReportSection>
                  )}

                  {/* EEG Characteristics */}
                  {dr.eeg_characteristics && (
                    <ReportSection icon={FiActivity} title="EEG Characteristics" delay={0.1}>
                      <p className="text-gray-300 text-sm leading-relaxed">{dr.eeg_characteristics}</p>
                    </ReportSection>
                  )}

                  {/* Clinical Interpretation */}
                  {dr.clinical_interpretation && (
                    <ReportSection icon={FiBookOpen} title="Clinical Interpretation" delay={0.15}>
                      <p className="text-gray-300 text-sm leading-relaxed">{dr.clinical_interpretation}</p>
                    </ReportSection>
                  )}

                  {/* Differential Diagnosis */}
                  {dr.differential_diagnosis?.length > 0 && (
                    <ReportSection icon={FiList} title="Differential Diagnosis" delay={0.2}>
                      <div className="flex flex-wrap gap-2">
                        {dr.differential_diagnosis.map((d, i) => (
                          <Chip key={i} label={d} color="text-purple-300 bg-purple-400/10 border-purple-400/20" />
                        ))}
                      </div>
                    </ReportSection>
                  )}
                </div>

                {/* RIGHT COLUMN */}
                <div className="space-y-8">

                  {/* Immediate Actions */}
                  {dr.immediate_actions?.length > 0 && (
                    <ReportSection
                      icon={FiZap}
                      title="Immediate Actions"
                      color={isSeizure ? 'text-red-400' : 'text-yellow-400'}
                      delay={0.1}
                    >
                      <div className={`rounded-xl p-4 space-y-2 ${isSeizure ? 'bg-red-500/5 border border-red-500/10' : 'bg-yellow-500/5 border border-yellow-500/10'}`}>
                        <ul className="space-y-2">
                          {dr.immediate_actions.map((a, i) => (
                            <BulletItem key={i} text={a} accent={isSeizure ? 'bg-red-400' : 'bg-yellow-400'} />
                          ))}
                        </ul>
                      </div>
                    </ReportSection>
                  )}

                  {/* Recommendations */}
                  {report.recommendations?.length > 0 && (
                    <ReportSection icon={FiHeart} title="Recommendations" delay={0.15}>
                      <ul className="space-y-2">
                        {report.recommendations.map((r, i) => (
                          <BulletItem key={i} text={r} />
                        ))}
                      </ul>
                    </ReportSection>
                  )}

                  {/* Follow-Up Plan */}
                  {dr.follow_up_plan && (
                    <ReportSection icon={FiCalendar} title="Follow-Up Plan" delay={0.2}>
                      <p className="text-gray-300 text-sm leading-relaxed">{dr.follow_up_plan}</p>
                    </ReportSection>
                  )}

                  {/* Lifestyle Guidance */}
                  {dr.lifestyle_guidance?.length > 0 && (
                    <ReportSection icon={FiSun} title="Lifestyle Guidance" color="text-yellow-400" delay={0.25}>
                      <ul className="space-y-2">
                        {dr.lifestyle_guidance.map((t, i) => (
                          <BulletItem key={i} text={t} accent="bg-yellow-400" />
                        ))}
                      </ul>
                    </ReportSection>
                  )}
                </div>
              </div>

              {/* ── Confidence note ── */}
              <div className="mx-3 sm:mx-6 mb-4 flex items-start gap-2">
                <FiInfo size={11} className="flex-shrink-0 mt-0.5 text-gray-600" />
                <p className="text-gray-600 text-xs leading-relaxed">
                  AI confidence ({confidence}% — {confidenceLevel} certainty) reflects model certainty,
                  not clinical diagnosis probability. Risk level is derived from both the prediction and
                  confidence score. Always verify findings with a qualified neurologist.
                </p>
              </div>

              {/* Disclaimer */}
              <div className="mx-3 sm:mx-6 mb-4 sm:mb-6 bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-4">
                <p className="text-yellow-400/80 text-xs leading-relaxed flex items-start gap-2">
                  <FiAlertCircle className="flex-shrink-0 mt-0.5" size={13} />
                  {report.disclaimer}
                </p>
              </div>
            </motion.div>
          )}

          {/* ── Feedback ── */}
          <div className="glass-card p-6 mt-6">
            <h2 className="text-xl font-heading font-semibold text-white mb-4">Rate This Analysis</h2>
            {feedbackSent ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="text-center py-4 text-green-400 flex items-center justify-center gap-2">
                <FiCheckCircle /> Thank you for your feedback!
              </motion.div>
            ) : (
              <div className="space-y-4">
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button key={star}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      onClick={() => setRating(star)}
                      className="transition-transform hover:scale-110"
                    >
                      <FiStar
                        size={28}
                        className={`${(hoverRating || rating) >= star ? 'text-yellow-400 fill-yellow-400' : 'text-gray-600'} transition-colors`}
                      />
                    </button>
                  ))}
                </div>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="input-field h-24 resize-none"
                  placeholder="Share your thoughts on the prediction accuracy..."
                />
                <div className="flex flex-col gap-2">
                  <button onClick={handleFeedback} disabled={!rating}
                    className="btn-primary py-2 px-6 inline-flex items-center gap-2 disabled:opacity-50 w-fit">
                    <FiSend /> Submit Feedback
                  </button>
                  {feedbackError && (
                    <p className="text-red-400 text-xs flex items-center gap-1">
                      <FiAlertCircle size={11} /> {feedbackError}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

        </motion.div>
      </div>
    </div>
  );
}
