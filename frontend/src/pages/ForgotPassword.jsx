import { useState, useEffect, useRef } from 'react'; // useRef kept for timerRef
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiMail, FiLock, FiAlertCircle, FiCheckCircle,
  FiArrowLeft, FiRefreshCw, FiEye, FiEyeOff, FiShield,
} from 'react-icons/fi';
import { forgotPassword, verifyResetOtp, resetPassword } from '../api';
import { PASSWORD_RULES } from './Register';
import { OtpInput, Countdown, OTP_DIGITS, OTP_EXPIRE_SECONDS } from '../components/OtpVerify';

// ── Step indicator ─────────────────────────────────────────────────────────────
function Steps({ current }) {
  const steps = ['Email', 'Verify OTP', 'New Password'];
  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {steps.map((label, i) => {
        const done   = i < current;
        const active = i === current;
        return (
          <div key={label} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all
                ${done   ? 'bg-primary-500 border-primary-500 text-white'
                : active ? 'bg-primary-500/20 border-primary-400 text-primary-400'
                :          'bg-white/5 border-white/15 text-gray-600'}`}
              >
                {done ? <FiCheckCircle size={14} /> : i + 1}
              </div>
              <span className={`text-[10px] font-medium hidden sm:block ${active ? 'text-primary-400' : done ? 'text-gray-400' : 'text-gray-600'}`}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`w-12 sm:w-16 h-px mx-1 mb-4 transition-colors ${done ? 'bg-primary-500' : 'bg-white/10'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep]           = useState(0); // 0=email, 1=otp, 2=new-password, 3=done
  const [email, setEmail]         = useState('');
  const [otp, setOtp]             = useState(' '.repeat(OTP_DIGITS));
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword]         = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass]   = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [countdown, setCountdown] = useState(OTP_EXPIRE_SECONDS);
  const timerRef = useRef(null);

  // Start countdown when OTP step begins
  useEffect(() => {
    if (step !== 1) return;
    setCountdown(OTP_EXPIRE_SECONDS);
    timerRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { clearInterval(timerRef.current); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [step]);

  const otpValue = otp.trimEnd();
  const otpComplete = otpValue.length === OTP_DIGITS && !/\s/.test(otpValue);

  const pwRulesPassed = PASSWORD_RULES.filter((r) => r.test(newPassword)).length;
  const pwValid       = pwRulesPassed === PASSWORD_RULES.length;
  const pwMatch       = newPassword === confirmPassword && confirmPassword.length > 0;

  // ── Step 0: request OTP ──────────────────────────────────────────────────
  const handleRequestOtp = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await forgotPassword(email.trim());
      setOtp(' '.repeat(OTP_DIGITS));
      setStep(1);
    } catch (err) {
      setError(err.userMessage || 'Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Step 1: verify OTP ───────────────────────────────────────────────────
  const handleVerifyOtp = async () => {
    if (!otpComplete) return;
    setError('');
    setLoading(true);
    try {
      const res = await verifyResetOtp(email.trim(), otpValue);
      setResetToken(res.data.reset_token);
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.detail || err.userMessage || 'Invalid OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: set new password ─────────────────────────────────────────────
  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!pwValid || !pwMatch) return;
    setError('');
    setLoading(true);
    try {
      await resetPassword(resetToken, newPassword);
      setStep(3);
    } catch (err) {
      setError(err.response?.data?.detail || err.userMessage || 'Reset failed. Please start over.');
    } finally {
      setLoading(false);
    }
  };

  const resendOtp = async () => {
    setError('');
    setOtp(' '.repeat(OTP_DIGITS));
    setLoading(true);
    try {
      await forgotPassword(email.trim());
      setCountdown(OTP_EXPIRE_SECONDS);
      clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setCountdown((c) => {
          if (c <= 1) { clearInterval(timerRef.current); return 0; }
          return c - 1;
        });
      }, 1000);
    } catch (err) {
      setError('Could not resend OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen pt-16 flex items-center justify-center px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="glass-card p-8">

          {/* Header */}
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-primary-500 to-primary-700 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary-500/25">
              <FiShield className="text-white text-2xl" />
            </div>
            <h1 className="text-2xl font-heading font-bold text-white">
              {step === 3 ? 'Password Reset!' : 'Forgot Password'}
            </h1>
            <p className="text-gray-400 mt-1.5 text-sm">
              {step === 0 && 'Enter your registered email to receive an OTP'}
              {step === 1 && `OTP sent to ${email}`}
              {step === 2 && 'Create a new strong password'}
              {step === 3 && 'You can now sign in with your new password'}
            </p>
          </div>

          {step < 3 && <Steps current={step} />}

          {/* Global error */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mb-5 text-red-400 text-sm"
              >
                <FiAlertCircle className="flex-shrink-0" /> {error}
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Step 0: Email ── */}
          {step === 0 && (
            <form onSubmit={handleRequestOtp} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Registered Email</label>
                <div className="relative">
                  <FiMail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={15} />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setError(''); }}
                    required
                    autoFocus
                    className="input-field pl-11"
                    placeholder="you@example.com"
                    autoComplete="email"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={!email.trim() || loading}
                className="btn-primary w-full flex items-center justify-center gap-2 py-3 disabled:opacity-50"
              >
                {loading
                  ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <FiMail size={15} />}
                {loading ? 'Sending OTP…' : 'Send OTP'}
              </button>
            </form>
          )}

          {/* ── Step 1: OTP ── */}
          {step === 1 && (
            <div className="space-y-4">
              <Countdown seconds={countdown} />

              <OtpInput value={otp} onChange={setOtp} />

              <button
                onClick={handleVerifyOtp}
                disabled={!otpComplete || loading || countdown === 0}
                className="btn-primary w-full flex items-center justify-center gap-2 py-3 disabled:opacity-50 mt-2"
              >
                {loading
                  ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <FiCheckCircle size={15} />}
                {loading ? 'Verifying…' : 'Verify OTP'}
              </button>

              <div className="flex items-center justify-between text-sm">
                <button
                  onClick={() => { setStep(0); setError(''); }}
                  className="text-gray-500 hover:text-gray-300 flex items-center gap-1 transition-colors"
                >
                  <FiArrowLeft size={13} /> Change email
                </button>
                <button
                  onClick={resendOtp}
                  disabled={loading || countdown > OTP_EXPIRE_SECONDS - 30}
                  className="text-primary-400 hover:text-primary-300 flex items-center gap-1 transition-colors disabled:opacity-40"
                >
                  <FiRefreshCw size={13} /> Resend OTP
                </button>
              </div>
            </div>
          )}

          {/* ── Step 2: New password ── */}
          {step === 2 && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              {/* New password */}
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">New Password</label>
                <div className="relative">
                  <FiLock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={15} />
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => { setNewPassword(e.target.value); setError(''); }}
                    required
                    autoFocus
                    className="input-field pl-11 pr-11"
                    placeholder="Create a strong password"
                    autoComplete="new-password"
                  />
                  <button type="button" onClick={() => setShowPass((v) => !v)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors" tabIndex={-1}>
                    {showPass ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                  </button>
                </div>
                {/* Strength rules */}
                {newPassword && (
                  <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
                    {PASSWORD_RULES.map((r) => {
                      const ok = r.test(newPassword);
                      return (
                        <div key={r.id} className={`flex items-center gap-1.5 text-xs transition-colors ${ok ? 'text-green-400' : 'text-gray-500'}`}>
                          <FiCheckCircle size={10} className={ok ? 'text-green-400' : 'text-gray-600'} />
                          {r.label}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Confirm password */}
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Confirm Password</label>
                <div className="relative">
                  <FiLock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={15} />
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); setError(''); }}
                    required
                    className={`input-field pl-11 pr-11 ${confirmPassword && !pwMatch ? 'border-red-500/50 focus:border-red-400' : ''}`}
                    placeholder="Re-enter new password"
                    autoComplete="new-password"
                  />
                  <button type="button" onClick={() => setShowConfirm((v) => !v)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors" tabIndex={-1}>
                    {showConfirm ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                  </button>
                </div>
                {confirmPassword && !pwMatch && (
                  <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                    <FiAlertCircle size={11} /> Passwords do not match
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={!pwValid || !pwMatch || loading}
                className="btn-primary w-full flex items-center justify-center gap-2 py-3 disabled:opacity-50"
              >
                {loading
                  ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <FiLock size={15} />}
                {loading ? 'Resetting…' : 'Reset Password'}
              </button>
            </form>
          )}

          {/* ── Step 3: Success ── */}
          {step === 3 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center space-y-5"
            >
              <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
                <FiCheckCircle className="text-green-400 text-4xl" />
              </div>
              <div>
                <p className="text-white font-semibold text-lg mb-1">Password Updated!</p>
                <p className="text-gray-400 text-sm">Your password has been reset successfully.</p>
              </div>
              <button
                onClick={() => navigate('/login')}
                className="btn-primary w-full flex items-center justify-center gap-2 py-3"
              >
                Sign In Now
              </button>
            </motion.div>
          )}

          {/* Bottom link */}
          {step !== 3 && (
            <p className="text-center text-gray-500 mt-6 text-sm">
              Remember your password?{' '}
              <Link to="/login" className="text-primary-400 hover:text-primary-300 font-medium">Sign in</Link>
            </p>
          )}
        </div>
      </motion.div>
    </div>
  );
}
