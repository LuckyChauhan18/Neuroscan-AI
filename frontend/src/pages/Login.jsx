import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiLogIn, FiUser, FiLock, FiAlertCircle, FiEye, FiEyeOff,
} from 'react-icons/fi';
import { login } from '../api';

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError]       = useState('');
  const [touched, setTouched]   = useState({ username: false, password: false });
  const [loading, setLoading]   = useState(false);
  const navigate = useNavigate();

  const fieldError = {
    username: touched.username && !username.trim() ? 'Username is required' : '',
    password: touched.password && !password        ? 'Password is required'  : '',
  };

  const canSubmit = username.trim() && password && !loading;

  const touch = (key) => () => setTouched((t) => ({ ...t, [key]: true }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setTouched({ username: true, password: true });
    if (!username.trim() || !password) return;

    setError('');
    setLoading(true);
    try {
      const res = await login(username.trim(), password);
      onLogin(res.data.user, res.data.access_token);
      navigate('/upload');
    } catch (err) {
      setError(err.userMessage || err.response?.data?.detail || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen pt-16 flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="glass-card p-8">

          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-primary-500 to-primary-700 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary-500/25">
              <FiLogIn className="text-white text-2xl" />
            </div>
            <h1 className="text-2xl font-heading font-bold text-white">Welcome Back</h1>
            <p className="text-gray-400 mt-1.5 text-sm">Sign in to continue to NeuroScan AI</p>
          </div>

          {/* Server error */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mb-6 text-red-400 text-sm"
              >
                <FiAlertCircle className="flex-shrink-0" /> {error}
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>

            {/* Username */}
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Username</label>
              <div className="relative">
                <FiUser className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={15} />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => { setUsername(e.target.value); setError(''); }}
                  onBlur={touch('username')}
                  className={`input-field pl-11 ${fieldError.username ? 'border-red-500/50 focus:border-red-400' : ''}`}
                  placeholder="Enter your username"
                  autoComplete="username"
                  autoFocus
                />
              </div>
              <AnimatePresence>
                {fieldError.username && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="flex items-center gap-1 text-red-400 text-xs mt-1"
                  >
                    <FiAlertCircle size={11} /> {fieldError.username}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Password</label>
              <div className="relative">
                <FiLock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={15} />
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(''); }}
                  onBlur={touch('password')}
                  className={`input-field pl-11 pr-11 ${fieldError.password ? 'border-red-500/50 focus:border-red-400' : ''}`}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                  tabIndex={-1}
                >
                  {showPass ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                </button>
              </div>
              <AnimatePresence>
                {fieldError.password && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="flex items-center gap-1 text-red-400 text-xs mt-1"
                  >
                    <FiAlertCircle size={11} /> {fieldError.password}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            <button
              type="submit"
              disabled={!canSubmit}
              className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50 py-3"
            >
              {loading
                ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <FiLogIn size={16} />
              }
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <p className="text-center text-gray-500 mt-6 text-sm">
            Don't have an account?{' '}
            <Link to="/register" className="text-primary-400 hover:text-primary-300 font-medium">Create one</Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
