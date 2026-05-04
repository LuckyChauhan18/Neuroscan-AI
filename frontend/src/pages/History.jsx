import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiClock, FiFile, FiArrowRight, FiActivity } from 'react-icons/fi';
import { getHistory } from '../api';

export default function History() {
  const [predictions, setPredictions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getHistory()
      .then((res) => setPredictions(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen pt-24 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24 pb-12 px-4">
      <div className="max-w-4xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-heading font-bold text-white">Analysis History</h1>
              <p className="text-gray-400 mt-1">{predictions.length} past {predictions.length === 1 ? 'analysis' : 'analyses'}</p>
            </div>
            <Link to="/upload" className="btn-primary py-2 px-5 text-sm">New Analysis</Link>
          </div>

          {predictions.length === 0 ? (
            <div className="glass-card p-16 text-center">
              <FiActivity className="text-5xl text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl text-gray-400 font-heading mb-2">No analyses yet</h3>
              <p className="text-gray-500 mb-6">Upload your first EEG recording to get started.</p>
              <Link to="/upload" className="btn-primary inline-flex items-center gap-2">
                Upload EEG Data
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {predictions.map((p, i) => {
                const isSeizure = p.prediction === 'Seizure';
                return (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <Link to={`/results/${p.id}`}
                      className="glass-card p-5 flex items-center gap-4 hover:border-primary-500/30 transition-all group block">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        isSeizure ? 'bg-red-500/20' : 'bg-green-500/20'
                      }`}>
                        <FiActivity className={isSeizure ? 'text-red-400 text-xl' : 'text-green-400 text-xl'} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3">
                          <p className="text-white font-medium truncate">{p.filename}</p>
                          <span className={isSeizure ? 'badge-seizure' : 'badge-normal'}>
                            {p.prediction}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                          <span className="flex items-center gap-1"><FiFile className="text-xs" /> {p.file_type?.toUpperCase()}</span>
                          <span className="flex items-center gap-1"><FiClock className="text-xs" /> {new Date(p.created_at).toLocaleDateString()}</span>
                          <span>Confidence: {(p.confidence * 100).toFixed(1)}%</span>
                        </div>
                      </div>
                      <FiArrowRight className="text-gray-600 group-hover:text-primary-400 transition-colors flex-shrink-0" />
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
