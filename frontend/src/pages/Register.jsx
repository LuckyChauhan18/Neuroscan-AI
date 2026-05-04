import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiUserPlus, FiUser, FiLock, FiMail, FiAlertCircle,
  FiEye, FiEyeOff, FiCheck, FiX, FiCalendar,
} from 'react-icons/fi';
import { register } from '../api';

// ── Validation helpers ────────────────────────────────────────────────────────

const EMAIL_RE    = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const USERNAME_RE = /^[a-zA-Z0-9._-]{3,20}$/;    // 3-20 chars: letters, digits, _ . -
const SPECIAL_RE  = /[._-]/;                        // username must contain ≥1 of these

export const PASSWORD_RULES = [
  { id: 'len',     label: 'At least 8 characters',         test: (p) => p.length >= 8           },
  { id: 'upper',   label: 'One uppercase letter (A–Z)',     test: (p) => /[A-Z]/.test(p)         },
  { id: 'number',  label: 'One number (0–9)',               test: (p) => /[0-9]/.test(p)         },
  { id: 'special', label: 'One special character (!@#…)',   test: (p) => /[^A-Za-z0-9]/.test(p) },
];

function ageFromDob(dob) {
  if (!dob) return null;
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age >= 1 ? age : null;
}

function maxDob() {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  return d.toISOString().split('T')[0];
}

function minDob() {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 120);
  return d.toISOString().split('T')[0];
}

function validateField(key, value, form) {
  switch (key) {
    case 'full_name':
      if (!value.trim()) return 'Full name is required';
      if (value.trim().length < 2) return 'Full name must be at least 2 characters';
      return '';
    case 'username':
      if (!value) return 'Username is required';
      if (!USERNAME_RE.test(value)) return 'Must be 3–20 chars using letters, numbers, _ . or -';
      if (!SPECIAL_RE.test(value))  return 'Username must contain at least one _ . or -';
      return '';
    case 'email':
      if (!value) return 'Email is required';
      if (!EMAIL_RE.test(value)) return 'Enter a valid email address';
      return '';
    case 'password':
      if (!value) return 'Password is required';
      if (PASSWORD_RULES.some((r) => !r.test(value))) return 'Password does not meet all requirements';
      return '';
    case 'confirm_password':
      if (!value) return 'Please confirm your password';
      if (value !== form.password) return 'Passwords do not match';
      return '';
    default:
      return '';
  }
}

// ── Strength bar ──────────────────────────────────────────────────────────────

function StrengthBar({ password }) {
  const passed = PASSWORD_RULES.filter((r) => r.test(password)).length;
  const colors  = ['bg-red-500', 'bg-orange-400', 'bg-yellow-400', 'bg-yellow-300', 'bg-green-400'];
  const labels  = ['', 'Weak', 'Fair', 'Good', 'Strong'];
  const color   = colors[passed];
  const label   = labels[passed];

  return (
    <div className="mt-2 space-y-2">
      {/* Bar */}
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
              i < passed ? color : 'bg-white/10'
            }`}
          />
        ))}
        <span className={`text-xs font-medium ml-1 ${color.replace('bg-', 'text-')} w-12 text-right`}>
          {label}
        </span>
      </div>
      {/* Rules checklist */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
        {PASSWORD_RULES.map((r) => {
          const ok = r.test(password);
          return (
            <div key={r.id} className={`flex items-center gap-1.5 text-xs transition-colors ${ok ? 'text-green-400' : 'text-gray-500'}`}>
              {ok ? <FiCheck size={10} /> : <FiX size={10} />}
              {r.label}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Field wrapper ─────────────────────────────────────────────────────────────

function Field({ label, icon: Icon, error, children }) {
  return (
    <div>
      <label className="block text-sm text-gray-400 mb-1.5">{label}</label>
      <div className="relative">
        {Icon && (
          <Icon className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" size={15} />
        )}
        {children}
      </div>
      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="flex items-center gap-1 text-red-400 text-xs mt-1"
          >
            <FiAlertCircle size={11} /> {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Register({ onLogin }) {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    username:         '',
    email:            '',
    full_name:        '',
    father_name:      '',
    dob:              '',
    sex:              '',
    password:         '',
    confirm_password: '',
  });

  const [touched, setTouch] = useState({});
  const [serverError, setServerError] = useState('');
  const [loading, setLoading]         = useState(false);
  const [showPass, setShowPass]       = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwFocus, setPwFocus]         = useState(false);

  // Derived age shown next to DOB
  const derivedAge = useMemo(() => ageFromDob(form.dob), [form.dob]);

  // Per-field errors (only shown for touched fields)
  const errors = useMemo(() => {
    const keys = ['full_name', 'username', 'email', 'password', 'confirm_password'];
    return Object.fromEntries(keys.map((k) => [k, validateField(k, form[k], form)]));
  }, [form]);

  const hasErrors = Object.values(errors).some(Boolean);

  const set = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setServerError('');
  };

  const touch = (key) => () => setTouch((t) => ({ ...t, [key]: true }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Mark all required fields as touched to surface any hidden errors
    setTouch({ full_name: true, username: true, email: true, password: true, confirm_password: true });
    if (hasErrors) return;

    setServerError('');
    setLoading(true);
    try {
      const payload = {
        username:    form.username,
        email:       form.email,
        full_name:   form.full_name,
        father_name: form.father_name || undefined,
        age:         derivedAge,
        sex:         form.sex || undefined,
        password:    form.password,
      };
      const res = await register(payload);
      onLogin(res.data.user, res.data.access_token);
      navigate('/upload');
    } catch (err) {
      setServerError(err.userMessage || err.response?.data?.detail || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen pt-16 flex items-center justify-center px-4 py-10">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-lg">
        <div className="glass-card p-8">

          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-primary-500 to-primary-700 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary-500/25">
              <FiUserPlus className="text-white text-2xl" />
            </div>
            <h1 className="text-2xl font-heading font-bold text-white">Create Account</h1>
            <p className="text-gray-400 mt-1.5 text-sm">Join NeuroScan AI for free</p>
          </div>

          {/* Server error */}
          <AnimatePresence>
            {serverError && (
              <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mb-6 text-red-400 text-sm">
                <FiAlertCircle className="flex-shrink-0" /> {serverError}
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>

            {/* Full Name */}
            <Field label="Full Name *" icon={FiUser} error={touched.full_name && errors.full_name}>
              <input
                type="text" value={form.full_name} onChange={set('full_name')} onBlur={touch('full_name')}
                className={`input-field pl-11 ${touched.full_name && errors.full_name ? 'border-red-500/50 focus:border-red-400' : ''}`}
                placeholder="John Doe"
              />
            </Field>

            {/* Father's Name */}
            <Field label="Father's Name" icon={FiUser}>
              <input
                type="text" value={form.father_name} onChange={set('father_name')}
                className="input-field pl-11" placeholder="Robert Doe (optional)"
              />
            </Field>

            {/* DOB + Sex row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Date of Birth</label>
                <div className="relative">
                  <FiCalendar className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" size={15} />
                  <input
                    type="date"
                    value={form.dob}
                    onChange={set('dob')}
                    min={minDob()}
                    max={maxDob()}
                    className="input-field pl-11 [color-scheme:dark]"
                  />
                </div>
                {derivedAge !== null && (
                  <p className="text-primary-400 text-xs mt-1 pl-1">Age: {derivedAge} years</p>
                )}
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Sex</label>
                <select value={form.sex} onChange={set('sex')} className="input-field w-full appearance-none">
                  <option value="">Select</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            {/* Username */}
            <Field label="Username *" icon={FiUser} error={touched.username && errors.username}>
              <input
                type="text" value={form.username} onChange={set('username')} onBlur={touch('username')}
                className={`input-field pl-11 ${touched.username && errors.username ? 'border-red-500/50 focus:border-red-400' : ''}`}
                placeholder="john_doe  or  john.doe"
                autoComplete="username"
              />
              {!errors.username && form.username && (
                <FiCheck className="absolute right-4 top-1/2 -translate-y-1/2 text-green-400" size={14} />
              )}
            </Field>
            {!errors.username && (
              <p className="text-gray-600 text-xs -mt-2 pl-1">
                3–20 chars · letters, digits, and <span className="text-gray-400 font-mono">_ . -</span> · must include one of <span className="text-gray-400 font-mono">_ . -</span>
              </p>
            )}

            {/* Email */}
            <Field label="Email *" icon={FiMail} error={touched.email && errors.email}>
              <input
                type="email" value={form.email} onChange={set('email')} onBlur={touch('email')}
                className={`input-field pl-11 ${touched.email && errors.email ? 'border-red-500/50 focus:border-red-400' : ''}`}
                placeholder="john@example.com"
                autoComplete="email"
              />
              {!errors.email && form.email && (
                <FiCheck className="absolute right-4 top-1/2 -translate-y-1/2 text-green-400" size={14} />
              )}
            </Field>

            {/* Password */}
            <Field label="Password *" icon={FiLock} error={touched.password && errors.password}>
              <input
                type={showPass ? 'text' : 'password'}
                value={form.password}
                onChange={set('password')}
                onBlur={() => { touch('password')(); setPwFocus(false); }}
                onFocus={() => setPwFocus(true)}
                className={`input-field pl-11 pr-11 ${touched.password && errors.password ? 'border-red-500/50 focus:border-red-400' : ''}`}
                placeholder="Create a strong password"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                tabIndex={-1}
              >
                {showPass ? <FiEyeOff size={16} /> : <FiEye size={16} />}
              </button>
            </Field>
            {/* Strength bar — shown when field has content */}
            {form.password && <StrengthBar password={form.password} />}

            {/* Confirm Password */}
            <Field label="Confirm Password *" icon={FiLock} error={touched.confirm_password && errors.confirm_password}>
              <input
                type={showConfirm ? 'text' : 'password'}
                value={form.confirm_password}
                onChange={set('confirm_password')}
                onBlur={touch('confirm_password')}
                className={`input-field pl-11 pr-11 ${touched.confirm_password && errors.confirm_password ? 'border-red-500/50 focus:border-red-400' : ''}`}
                placeholder="Re-enter your password"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                tabIndex={-1}
              >
                {showConfirm ? <FiEyeOff size={16} /> : <FiEye size={16} />}
              </button>
              {/* Match tick */}
              {form.confirm_password && !errors.confirm_password && (
                <FiCheck className="absolute right-10 top-1/2 -translate-y-1/2 text-green-400" size={14} />
              )}
            </Field>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50 mt-2 py-3"
            >
              {loading
                ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <FiUserPlus size={16} />
              }
              {loading ? 'Creating account…' : 'Create Account'}
            </button>
          </form>

          <p className="text-center text-gray-500 mt-6 text-sm">
            Already have an account?{' '}
            <Link to="/login" className="text-primary-400 hover:text-primary-300 font-medium">Sign in</Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
