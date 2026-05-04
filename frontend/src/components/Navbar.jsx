import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiActivity, FiMenu, FiX } from 'react-icons/fi';
import { useState } from 'react';

export default function Navbar({ user, onLogout }) {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const navItems = user
    ? [
        { to: '/upload', label: 'Analyze EEG' },
        { to: '/history', label: 'History' },
        { to: '/profile', label: 'Profile' },
      ]
    : [
        { to: '/login', label: 'Login' },
        { to: '/register', label: 'Sign Up' },
      ];

  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      className="fixed top-0 left-0 right-0 z-50 bg-dark-400/80 backdrop-blur-xl border-b border-white/5"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-9 h-9 bg-gradient-to-br from-primary-500 to-primary-700 rounded-lg flex items-center justify-center">
              <FiActivity className="text-white text-lg" />
            </div>
            <span className="font-heading font-bold text-xl bg-gradient-to-r from-primary-400 to-primary-600 bg-clip-text text-transparent">
              NeuroScan AI
            </span>
          </Link>

          {/* Desktop */}
          <div className="hidden md:flex items-center gap-6">
            {navItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={`nav-link text-sm ${location.pathname === item.to ? 'text-primary-400' : ''}`}
              >
                {item.label}
              </Link>
            ))}
            {user && (
              <button onClick={onLogout} className="text-sm text-gray-500 hover:text-red-400 transition-colors">
                Logout
              </button>
            )}
          </div>

          {/* Mobile toggle */}
          <button className="md:hidden text-gray-400" onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <FiX size={24} /> : <FiMenu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="md:hidden bg-dark-300/95 backdrop-blur-xl border-b border-white/5"
        >
          <div className="px-4 py-4 space-y-3">
            {navItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="block nav-link py-2"
                onClick={() => setMenuOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            {user && (
              <button onClick={() => { onLogout(); setMenuOpen(false); }} className="block text-red-400 py-2">
                Logout
              </button>
            )}
          </div>
        </motion.div>
      )}
    </motion.nav>
  );
}
