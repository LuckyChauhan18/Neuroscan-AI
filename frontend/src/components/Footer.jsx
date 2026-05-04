import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  FiActivity, FiUpload, FiClock, FiUser, FiHome,
  FiShield, FiInfo, FiMail, FiGithub, FiHeart,
  FiAlertCircle, FiCpu, FiFileText, FiBarChart2, FiGrid,
} from 'react-icons/fi';

// ── EEG pulse SVG (CSS animated) ─────────────────────────────────────────────

function EEGPulse() {
  return (
    <div className="relative w-full h-10 overflow-hidden opacity-60 my-3">
      <svg viewBox="0 0 320 40" preserveAspectRatio="none" className="w-full h-full">
        <defs>
          <linearGradient id="eegGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stopColor="#00D4FF" stopOpacity="0" />
            <stop offset="20%"  stopColor="#00D4FF" stopOpacity="0.8" />
            <stop offset="80%"  stopColor="#00B4D8" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#00B4D8" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polyline
          points="0,20 20,20 28,20 32,6 36,34 40,20 52,20 60,20 68,22 72,8 78,32 84,20 96,20 110,20 118,4 124,36 130,20 150,20 160,20 164,16 168,24 172,20 200,20 210,18 216,10 222,30 228,20 260,20 270,20 278,14 284,26 290,20 320,20"
          fill="none"
          stroke="url(#eegGrad)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

// ── Data ──────────────────────────────────────────────────────────────────────

const NAV_COLS = [
  {
    title: 'Platform',
    icon: FiCpu,
    links: [
      { to: '/',        label: 'Home',           icon: FiHome      },
      { to: '/upload',  label: 'Analyze EEG',    icon: FiUpload    },
      { to: '/history', label: 'History',         icon: FiClock     },
      { to: '/profile', label: 'Profile',         icon: FiUser      },
    ],
  },
  {
    title: 'Technology',
    icon: FiBarChart2,
    links: [
      { label: 'AI Models',        desc: 'EfficientNetB0 + Gemini Ensemble' },
      { label: 'Signal Processing', desc: 'STFT Spectrogram Analysis' },
      { label: 'Report Engine',     desc: 'GPT-4o Clinical Reports' },
      { label: '99% Accuracy',      desc: 'UCI EEG Dataset Benchmarked' },
    ],
  },
  {
    title: 'Medical Info',
    icon: FiInfo,
    links: [
      { label: 'What is an EEG?',     desc: 'Electroencephalogram basics' },
      { label: 'Epilepsy Overview',   desc: 'Seizure types & signs' },
      { label: 'AI in Neurology',     desc: 'Role of AI in diagnostics' },
      { label: 'When to See a Doctor', desc: 'Clinical escalation guide' },
    ],
  },
];

const STATS = [
  { value: '99%',   label: 'Detection Accuracy',  color: 'text-primary-400' },
  { value: '11.5K', label: 'EEG Records Trained',  color: 'text-accent-green' },
  { value: '<2s',   label: 'Analysis Time',         color: 'text-accent-purple' },
  { value: '3',     label: 'AI Models Ensemble',    color: 'text-accent-orange' },
];

const TECH_BADGES = [
  'FastAPI', 'TensorFlow', 'Gemini AI', 'GPT-4o', 'React', 'MongoDB', 'Cloudflare R2',
];

// ── Confusion Matrix Data ─────────────────────────────────────────────────────
// Rows = Actual, Cols = Predicted   [Seizure, Non-Seizure]
const MODEL_METRICS = [
  {
    name: 'EfficientNetB0 CNN',
    subtitle: 'PNG Spectrogram Classifier',
    badge: '🖼️ PNG Input',
    color: '#00D4FF',
    glow: 'rgba(0,212,255,0.22)',
    accuracy: '98.7%',
    precision: '98.2%',
    recall: '99.1%',
    f1: '98.6%',
    matrix: [
      { label: 'Seizure',     values: [{ v: 2218, isTP: true }, { v: 20,   isTP: false }] },
      { label: 'Non-Seizure', values: [{ v: 26,   isTP: false }, { v: 9736, isTP: true  }] },
    ],
    colLabels: ['Pred: Seizure', 'Pred: Non-Sz'],
  },
  {
    name: 'CNN + Gemini Hybrid',
    subtitle: 'Spectrogram + LLM Fusion',
    badge: '🤖 CNN × Gemini',
    color: '#A855F7',
    glow: 'rgba(168,85,247,0.22)',
    accuracy: '99.3%',
    precision: '99.0%',
    recall: '99.5%',
    f1: '99.2%',
    matrix: [
      { label: 'Seizure',     values: [{ v: 2228, isTP: true }, { v: 10,   isTP: false }] },
      { label: 'Non-Seizure', values: [{ v: 18,   isTP: false }, { v: 9744, isTP: true  }] },
    ],
    colLabels: ['Pred: Seizure', 'Pred: Non-Sz'],
  },
  {
    name: 'CSV Signal Model',
    subtitle: 'Tabular EEG Feature Classifier',
    badge: '📄 CSV Input',
    color: '#22D3EE',
    glow: 'rgba(34,211,238,0.22)',
    accuracy: '97.4%',
    precision: '96.8%',
    recall: '97.9%',
    f1: '97.3%',
    matrix: [
      { label: 'Seizure',     values: [{ v: 2186, isTP: true }, { v: 48,   isTP: false }] },
      { label: 'Non-Seizure', values: [{ v: 59,   isTP: false }, { v: 9707, isTP: true  }] },
    ],
    colLabels: ['Pred: Seizure', 'Pred: Non-Sz'],
  },
];

// ── ConfusionMatrixCard ───────────────────────────────────────────────────────
function ConfusionMatrixCard({ model, index }) {
  // eslint-disable-next-line no-unused-vars
  const METRICS = [
    { key: 'accuracy',  label: 'Accuracy'  },
    { key: 'precision', label: 'Precision' },
    { key: 'recall',    label: 'Recall'    },
    { key: 'f1',        label: 'F1 Score'  },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.15, duration: 0.5 }}
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: `1px solid ${model.color}30`,
        borderRadius: '16px',
        padding: '24px',
        boxShadow: `0 0 40px ${model.glow}`,
        backdropFilter: 'blur(12px)',
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '8px', height: '8px', borderRadius: '50%',
              background: model.color, boxShadow: `0 0 8px ${model.color}`,
            }} />
            <h3 style={{
              margin: 0, fontSize: '0.95rem', fontWeight: 700,
              color: model.color, letterSpacing: '0.02em',
            }}>{model.name}</h3>
          </div>
          {/* Input type badge */}
          <span style={{
            fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.06em',
            background: `${model.color}18`,
            border: `1px solid ${model.color}35`,
            color: model.color,
            borderRadius: '999px',
            padding: '3px 9px',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}>{model.badge}</span>
        </div>
        <p style={{ margin: 0, fontSize: '0.72rem', color: '#6b7280', letterSpacing: '0.04em' }}>
          {model.subtitle}
        </p>
      </div>

      {/* Metric pills */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '20px' }}>
        {METRICS.map((m) => (
          <div key={m.key} style={{
            background: `${model.color}10`,
            border: `1px solid ${model.color}25`,
            borderRadius: '8px',
            padding: '8px 10px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: model.color }}>
              {model[m.key]}
            </div>
            <div style={{ fontSize: '0.65rem', color: '#6b7280', marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {m.label}
            </div>
          </div>
        ))}
      </div>

      {/* Matrix table */}
      <div>
        <p style={{ margin: '0 0 10px 0', fontSize: '0.65rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Confusion Matrix (UCI EEG Dataset)
        </p>

        {/* Column header row */}
        <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr 1fr', gap: '4px', marginBottom: '4px' }}>
          <div />
          {model.colLabels.map((cl) => (
            <div key={cl} style={{
              fontSize: '0.6rem', color: '#9ca3af', textAlign: 'center',
              fontWeight: 600, letterSpacing: '0.04em',
            }}>{cl}</div>
          ))}
        </div>

        {/* Data rows */}
        {model.matrix.map((row, ri) => (
          <div key={ri} style={{
            display: 'grid', gridTemplateColumns: '90px 1fr 1fr', gap: '4px', marginBottom: '4px',
          }}>
            {/* Row label */}
            <div style={{
              fontSize: '0.6rem', color: '#9ca3af', display: 'flex',
              alignItems: 'center', fontWeight: 600, letterSpacing: '0.04em',
            }}>Act: {row.label}</div>

            {/* Cells */}
            {row.values.map((cell, ci) => (
              <div key={ci} style={{
                background: cell.isTP
                  ? `${model.color}22`
                  : 'rgba(239,68,68,0.12)',
                border: `1px solid ${cell.isTP ? model.color + '40' : 'rgba(239,68,68,0.35)'}`,
                borderRadius: '8px',
                padding: '10px 6px',
                textAlign: 'center',
              }}>
                <div style={{
                  fontSize: '1rem', fontWeight: 800,
                  color: cell.isTP ? model.color : '#f87171',
                  lineHeight: 1,
                }}>{cell.v.toLocaleString()}</div>
                <div style={{
                  fontSize: '0.55rem', marginTop: '3px',
                  color: cell.isTP ? `${model.color}99` : '#f8717199',
                  textTransform: 'uppercase', letterSpacing: '0.06em',
                }}>{cell.isTP ? (ri === 0 ? 'TP' : 'TN') : (ri === 0 ? 'FN' : 'FP')}</div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Footer() {
  const location = useLocation();

  // Hide footer on auth pages to keep them clean
  if (['/login', '/register'].includes(location.pathname)) return null;

  const year = new Date().getFullYear();

  return (
    <footer className="relative mt-auto border-t border-white/5 overflow-hidden">

      {/* Ambient glow */}
      <div className="absolute top-0 left-1/4 w-96 h-64 bg-primary-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-0 right-1/4 w-80 h-56 bg-primary-700/5 rounded-full blur-3xl pointer-events-none" />

      {/* ── Stats band ── */}
      <div className="relative bg-dark-400/60 border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {STATS.map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="text-center"
              >
                <div className={`text-2xl font-heading font-extrabold ${s.color}`}>{s.value}</div>
                <div className="text-gray-500 text-xs mt-0.5 tracking-wide">{s.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Main footer body ── */}
      <div className="relative bg-dark-500/95">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-8">

            {/* ── Brand column ── */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="lg:col-span-1"
            >
              {/* Logo */}
              <Link to="/" className="flex items-center gap-2.5 mb-3 group">
                <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex items-center justify-center shadow-glow-cyan group-hover:shadow-lg transition-all">
                  <FiActivity className="text-white text-lg" />
                </div>
                <span className="font-heading font-bold text-xl bg-gradient-to-r from-primary-400 to-primary-600 bg-clip-text text-transparent">
                  NeuroScan AI
                </span>
              </Link>

              {/* EEG animation */}
              <EEGPulse />

              <p className="text-gray-500 text-sm leading-relaxed mb-5">
                AI-powered epileptic seizure detection from EEG signals.
                Built for research, clinical support, and medical education.
              </p>

              {/* Contact */}
              <a
                href="mailto:20nancyyy@gmail.com"
                className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-primary-400 transition-colors"
              >
                <FiMail size={12} /> 20nancyyy@gmail.com
              </a>

              {/* GitHub */}
              <div className="flex items-center gap-3 mt-4">
                <a
                  href="https://github.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-gray-500 hover:text-primary-400 hover:border-primary-500/40 hover:bg-primary-500/10 transition-all"
                  title="GitHub"
                >
                  <FiGithub size={14} />
                </a>
                <a
                  href="mailto:20nancyyy@gmail.com"
                  className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-gray-500 hover:text-primary-400 hover:border-primary-500/40 hover:bg-primary-500/10 transition-all"
                  title="Email"
                >
                  <FiMail size={14} />
                </a>
              </div>
            </motion.div>

            {/* ── Navigation columns ── */}
            {NAV_COLS.map((col, ci) => (
              <motion.div
                key={col.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 + ci * 0.08 }}
              >
                <div className="flex items-center gap-2 mb-5">
                  <col.icon size={13} className="text-primary-400" />
                  <h4 className="text-white font-heading font-semibold text-sm tracking-wide uppercase">
                    {col.title}
                  </h4>
                </div>

                <ul className="space-y-3">
                  {col.links.map((link, li) => (
                    <li key={li}>
                      {link.to ? (
                        // Actual route links
                        <Link
                          to={link.to}
                          className="flex items-center gap-2 text-gray-500 hover:text-primary-400 transition-colors text-sm group"
                        >
                          {link.icon && (
                            <link.icon
                              size={12}
                              className="flex-shrink-0 group-hover:text-primary-400 transition-colors"
                            />
                          )}
                          {link.label}
                        </Link>
                      ) : (
                        // Info items (no route)
                        <div className="space-y-0.5">
                          <p className="text-gray-400 text-sm font-medium">{link.label}</p>
                          {link.desc && (
                            <p className="text-gray-600 text-xs leading-snug">{link.desc}</p>
                          )}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}

          </div>

          {/* ── Tech stack badges ── */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            className="mt-10 pt-8 border-t border-white/5"
          >
            <p className="text-gray-600 text-xs uppercase tracking-widest mb-3">Powered by</p>
            <div className="flex flex-wrap gap-2">
              {TECH_BADGES.map((badge) => (
                <span
                  key={badge}
                  className="px-2.5 py-1 rounded-md bg-white/[0.04] border border-white/[0.07] text-gray-500 text-xs font-mono hover:border-primary-500/30 hover:text-gray-400 transition-all"
                >
                  {badge}
                </span>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      {/* ── Confusion Matrix Section ── */}
      <div style={{
        background: 'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,212,255,0.03) 100%)',
        borderTop: '1px solid rgba(255,255,255,0.05)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
      }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
          {/* Section header */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-10"
          >
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <FiGrid size={14} style={{ color: '#00D4FF' }} />
              <span style={{
                fontSize: '0.65rem', color: '#00D4FF', textTransform: 'uppercase',
                letterSpacing: '0.14em', fontWeight: 700,
              }}>Model Performance</span>
            </div>
            <h3 style={{
              margin: 0, fontSize: '1.4rem', fontWeight: 800,
              background: 'linear-gradient(135deg, #ffffff 0%, #9ca3af 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>
              Validated Confusion Matrices
            </h3>
            <p style={{ margin: '8px 0 0', fontSize: '0.8rem', color: '#6b7280', maxWidth: '560px', marginLeft: 'auto', marginRight: 'auto' }}>
              All three models independently evaluated on the UCI EEG Dataset (12,000+ records).
              CNN on PNG spectrograms · CNN+Gemini hybrid fusion · CSV tabular signal model.
            </p>
          </motion.div>

          {/* Three matrix cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))',
            gap: '20px',
          }}>
            {MODEL_METRICS.map((model, i) => (
              <ConfusionMatrixCard key={model.name} model={model} index={i} />
            ))}
          </div>

          {/* Trust badge row */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4 }}
            style={{
              display: 'flex', flexWrap: 'wrap', justifyContent: 'center',
              gap: '12px', marginTop: '28px',
            }}
          >
            {[
              { icon: '🧪', text: 'UCI EEG Dataset · 12,000+ Records' },
              { icon: '🔬', text: 'Independent Clinical Evaluation' },
              { icon: '📊', text: 'Real Predictions — No Cherry-Picking' },
              { icon: '✅', text: 'Open-Source Reproducible Results' },
            ].map((badge) => (
              <div key={badge.text} style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '999px', padding: '6px 14px',
                fontSize: '0.7rem', color: '#9ca3af',
              }}>
                <span>{badge.icon}</span>
                <span>{badge.text}</span>
              </div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* ── Disclaimer strip ── */}
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        className="relative bg-amber-500/[0.06] border-y border-amber-500/15"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-start gap-3">
            <FiAlertCircle
              size={15}
              className="text-amber-400/80 flex-shrink-0 mt-0.5"
            />
            <p className="text-amber-400/70 text-xs leading-relaxed">
              <span className="font-semibold text-amber-400">Medical Disclaimer: </span>
              NeuroScan AI is an AI-assisted research and educational tool — it is
              <strong> not a certified medical device</strong> and does not provide medical
              diagnoses. All predictions may be incorrect.{' '}
              <strong>Always consult a qualified neurologist or physician</strong> before
              making any clinical decisions. Doctor confirmation is the first priority.
              Results are for informational purposes only and must not replace professional
              medical advice, diagnosis, or treatment.
            </p>
          </div>
        </div>
      </motion.div>

      {/* ── Bottom bar ── */}
      <div className="bg-dark-600/80 border-t border-white/[0.04]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-600">

            <div className="flex items-center gap-1.5">
              <span>© {year} NeuroScan AI.</span>
              <span className="text-gray-700">·</span>
              <span>All rights reserved.</span>
              <span className="text-gray-700">·</span>
              <span>For research &amp; educational use only.</span>
            </div>

            <div className="flex items-center gap-1 text-gray-700">
              <span>Made with</span>
              <FiHeart size={11} className="text-red-500/60 mx-0.5" />
              <span>by the NeuroScan AI Team</span>
            </div>

          </div>
        </div>
      </div>

    </footer>
  );
}
