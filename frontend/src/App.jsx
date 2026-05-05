import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import EEGBackground from './components/EEGBackground';
import ErrorBoundary from './components/ErrorBoundary';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import Upload from './pages/Upload';
import Results from './pages/Results';
import History from './pages/History';
import Profile from './pages/Profile';
import { getProfile } from './api';
import logger from './utils/logger';

function App() {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [eegMode, setEegMode] = useState('default');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      getProfile()
        .then((res) => setUser(res.data))
        .catch((err) => {
          logger.warn('Session restore failed — clearing token:', err.userMessage || err.message);
          localStorage.removeItem('token');
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const handleLogin = (userData, token) => {
    localStorage.setItem('token', token);
    setUser(userData);
    logger.info('User session started', { username: userData?.username });
  };

  const handleLogout = () => {
    logger.info('User logged out');
    localStorage.removeItem('token');
    setUser(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-500">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
          <p className="text-primary-400 font-heading">Loading NeuroScan AI...</p>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-dark-500">
        <EEGBackground mode={eegMode} />
        <div className="relative" style={{ zIndex: 1 }}>
          <Navbar user={user} onLogout={handleLogout} />
          <ErrorBoundary>
            <Routes>
              <Route path="/" element={<Landing user={user} />} />
              <Route path="/login"            element={user ? <Navigate to="/upload" /> : <Login onLogin={handleLogin} />} />
              <Route path="/register"         element={user ? <Navigate to="/upload" /> : <Register onLogin={handleLogin} />} />
              <Route path="/forgot-password"  element={user ? <Navigate to="/upload" /> : <ForgotPassword />} />
              <Route path="/upload"   element={user ? <Upload user={user} /> : <Navigate to="/login" />} />
              <Route path="/results/:id" element={user ? <Results user={user} onModeChange={setEegMode} /> : <Navigate to="/login" />} />
              <Route path="/history"  element={user ? <History user={user} /> : <Navigate to="/login" />} />
              <Route path="/profile"  element={user ? <Profile user={user} onUserUpdate={setUser} /> : <Navigate to="/login" />} />
            </Routes>
          </ErrorBoundary>
          <Footer />
        </div>
      </div>
    </BrowserRouter>
  );
}

export default App;
