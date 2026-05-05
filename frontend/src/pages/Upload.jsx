import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import { FiUploadCloud, FiFile, FiX, FiCpu, FiCheckCircle, FiAlertTriangle, FiEye, FiMaximize2, FiZap, FiDatabase, FiBarChart2, FiFileText, FiList, FiImage } from 'react-icons/fi';
import { uploadEEG } from '../api';

export default function Upload() {
  const [file, setFile] = useState(null);
  const [uploadMode, setUploadMode] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (!file) { setPreviewUrl(null); return; }
    const isImage = file.type.startsWith('image/');
    if (!isImage) { setPreviewUrl(null); return; }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const onDrop = useCallback((acceptedFiles) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
      setError('');
    }
  }, []);

  const acceptConfig = uploadMode === 'csv' 
    ? { 'text/csv': ['.csv'], 'text/plain': ['.txt'] }
    : { 'image/png': ['.png'], 'image/jpeg': ['.jpg', '.jpeg'], 'image/svg+xml': ['.svg'], 'image/bmp': ['.bmp'], 'image/tiff': ['.tiff', '.tif'] };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: acceptConfig,
    maxFiles: 1,
    maxSize: 50 * 1024 * 1024,
  });

  const handleModeSelect = (mode) => {
    setUploadMode(mode);
    setFile(null);
    setError('');
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setUploading(true);
    setError('');

    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= 90) { clearInterval(interval); return 90; }
        return p + Math.random() * 15;
      });
    }, 300);

    try {
      const res = await uploadEEG(file);
      clearInterval(interval);
      setProgress(100);
      setTimeout(() => navigate(`/results/${res.data.id}`), 500);
    } catch (err) {
      clearInterval(interval);
      setProgress(0);
      setError(err.response?.data?.detail || 'Upload failed. Please try again.');
      setUploading(false);
    }
  };

  const fileSize = file ? (file.size / 1024).toFixed(1) + ' KB' : '';
  const fileIcon = file?.name?.endsWith('.csv') ? '📊' : file?.name?.match(/\.(png|jpg|jpeg)$/i) ? '🖼️' : '📄';

  const isImageFile = uploadMode === 'image';
  const modelInfo = isImageFile
    ? { name: 'Gemini Vision + EfficientNetB0', tag: 'Visual AI · Image Analysis', color: 'purple' }
    : { name: 'LSTM Tabular Model', tag: 'Deep Learning · Signal Model', color: 'cyan' };

  const pipeline = isImageFile
    ? [
        { icon: FiUploadCloud, label: 'Uploading',    threshold: 0  },
        { icon: FiDatabase,    label: 'Preprocessing', threshold: 25 },
        { icon: FiCpu,         label: 'EfficientNetB0',threshold: 50 },
        { icon: FiBarChart2,   label: 'Report',        threshold: 80 },
      ]
    : [
        { icon: FiUploadCloud, label: 'Uploading',    threshold: 0  },
        { icon: FiDatabase,    label: 'Parsing CSV',  threshold: 25 },
        { icon: FiZap,         label: 'LSTM Inference',threshold: 50 },
        { icon: FiFileText,    label: 'Report',        threshold: 80 },
      ];

  return (
    <div className="min-h-screen pt-24 pb-12 px-4">
      <div className="max-w-3xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="text-center mb-10">
            <h1 className="text-3xl sm:text-4xl font-heading font-bold text-white mb-3">Upload EEG Data</h1>
            <p className="text-gray-400 text-lg">Select a mode and upload your recording for AI-powered detection</p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 mb-8">
            <button onClick={() => handleModeSelect('csv')} className={`glass-card p-4 flex items-start gap-3 text-left transition-all ${uploadMode === 'csv' ? 'border-cyan-500/50 bg-cyan-500/5' : 'hover:border-white/20'}`}>
              <FiList className="text-cyan-400 text-xl mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm text-white font-medium">CSV / TXT (Tabular)</p>
                <p className="text-xs text-gray-500">178 EEG data points → LSTM tabular model</p>
              </div>
            </button>
            <button onClick={() => handleModeSelect('image')} className={`glass-card p-4 flex items-start gap-3 text-left transition-all ${uploadMode === 'image' ? 'border-purple-500/50 bg-purple-500/5' : 'hover:border-white/20'}`}>
              <FiImage className="text-purple-400 text-xl mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm text-white font-medium">PNG / JPG (Spectrogram)</p>
                <p className="text-xs text-gray-500">EEG spectrogram image → EfficientNetB0 CNN</p>
              </div>
            </button>
          </div>

          {uploadMode && (
            <div
              {...getRootProps()}
              className={`glass-card p-6 text-center cursor-pointer transition-all duration-300
                ${isDragActive ? 'border-primary-500 bg-primary-500/5 shadow-glow-cyan' : 'hover:border-primary-500/30'}
                ${file ? 'border-green-500/30' : ''}`}
            >
              <input {...getInputProps()} />
              <AnimatePresence mode="wait">
                {file ? (
                  <motion.div key="file" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                    className="flex flex-col items-center w-full">
                    {previewUrl ? (
                      <div className="relative w-full mb-4">
                        <img src={previewUrl} alt="Waveform preview" className="w-full h-64 rounded-xl object-cover border border-white/10" />
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent rounded-b-xl px-4 py-3">
                          <p className="text-white font-semibold text-sm">{file.name}</p>
                          <p className="text-gray-300 text-xs">{fileSize}</p>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); setLightboxOpen(true); }} className="absolute top-3 right-3 bg-black/50 hover:bg-black/80 text-white rounded-lg px-3 py-1.5 text-xs inline-flex items-center gap-1.5 backdrop-blur-sm border border-white/10 transition-colors">
                          <FiMaximize2 size={12} /> Preview
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="text-5xl mb-4">{fileIcon}</div>
                        <p className="text-white font-semibold text-lg">{file.name}</p>
                        <p className="text-gray-400 text-sm mt-1">{fileSize}</p>
                      </>
                    )}
                    <button onClick={(e) => { e.stopPropagation(); setFile(null); setError(''); }} className="text-red-400 hover:text-red-300 inline-flex items-center gap-1 text-sm mt-2">
                      <FiX /> Remove file
                    </button>
                  </motion.div>
                ) : (
                  <motion.div key="dropzone" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <FiUploadCloud className="text-5xl text-primary-400 mx-auto mb-4" />
                    <p className="text-white text-lg font-medium mb-2">{isDragActive ? 'Drop file here' : 'Drag & drop file'}</p>
                    <p className="text-gray-500 text-sm">or click to browse {uploadMode === 'csv' ? '(.csv, .txt)' : '(.png, .jpg, .svg, .bmp, .tiff)'}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {error && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-6 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm">
              {error}
            </motion.div>
          )}

          <AnimatePresence>
            {uploading && (
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} className="mt-6 glass-card p-4 sm:p-6 border border-white/10">
                <div className="flex items-center justify-between gap-2 mb-5">
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                    <motion.div animate={{ rotate: progress < 100 ? 360 : 0 }} transition={{ repeat: progress < 100 ? Infinity : 0, duration: 1.4, ease: 'linear' }} className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${modelInfo.color === 'purple' ? 'bg-purple-500/20' : 'bg-cyan-500/20'}`}>
                      <FiCpu className={modelInfo.color === 'purple' ? 'text-purple-400' : 'text-cyan-400'} size={17} />
                    </motion.div>
                    <div className="min-w-0">
                      <p className={`font-heading font-bold text-xs sm:text-sm truncate ${modelInfo.color === 'purple' ? 'text-purple-300' : 'text-cyan-300'}`}>{modelInfo.name}</p>
                      <p className="text-gray-500 text-xs truncate">{modelInfo.tag}</p>
                    </div>
                  </div>
                  <motion.span className={`text-xl sm:text-2xl font-heading font-bold flex-shrink-0 ${modelInfo.color === 'purple' ? 'text-purple-400' : 'text-cyan-400'}`}>{Math.round(progress)}%</motion.span>
                </div>
                <div className="flex items-center justify-between mb-5">
                  {pipeline.map((step, i) => {
                    const done = progress > step.threshold + 22;
                    const active = progress >= step.threshold && !done;
                    const Icon = step.icon;
                    return (
                      <div key={i} className="flex items-center flex-1">
                        <div className="flex flex-col items-center gap-1">
                          <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center border transition-all duration-500 ${done ? 'bg-green-500/20 border-green-500/40' : active ? (modelInfo.color === 'purple' ? 'bg-purple-500/25 border-purple-400/60' : 'bg-cyan-500/25 border-cyan-400/60') : 'bg-white/5 border-white/10'}`}>
                            {done ? <FiCheckCircle className="text-green-400" size={14} /> : <Icon size={13} className={active ? (modelInfo.color === 'purple' ? 'text-purple-300' : 'text-cyan-300') : 'text-gray-600'} />}
                          </div>
                          <span className={`text-[10px] sm:text-xs hidden min-[375px]:block ${done ? 'text-green-400' : active ? (modelInfo.color === 'purple' ? 'text-purple-300' : 'text-cyan-300') : 'text-gray-600'}`}>{step.label}</span>
                        </div>
                        {i < pipeline.length - 1 && <div className="flex-1 mx-0.5 sm:mx-1 mb-4 sm:mb-5"><div className="h-px bg-white/10 relative overflow-hidden rounded-full"><motion.div className={`absolute inset-y-0 left-0 ${modelInfo.color === 'purple' ? 'bg-purple-400' : 'bg-cyan-400'}`} animate={{ width: done ? '100%' : active ? '60%' : '0%' }} transition={{ duration: 0.6 }} /></div></div>}
                      </div>
                    );
                  })}
                </div>
                <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden">
                  <motion.div className={`h-2 rounded-full ${modelInfo.color === 'purple' ? 'bg-gradient-to-r from-purple-600 via-purple-400 to-pink-400' : 'bg-gradient-to-r from-cyan-600 via-cyan-400 to-blue-400'}`} initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 0.4 }} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {file && !uploading && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-8 text-center">
              <button onClick={handleAnalyze} className="btn-primary text-lg inline-flex items-center gap-2">
                <FiCpu /> Start AI Analysis
              </button>
            </motion.div>
          )}
        </motion.div>
      </div>

      <AnimatePresence>
        {lightboxOpen && previewUrl && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4" onClick={() => setLightboxOpen(false)}>
            <motion.div initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.85, opacity: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 22 }} className="relative max-w-5xl w-full" onClick={(e) => e.stopPropagation()}>
              <img src={previewUrl} alt="Full waveform" className="w-full max-h-[80vh] object-contain rounded-2xl border border-white/10 shadow-2xl" />
              <div className="absolute top-3 right-3 flex items-center gap-2">
                <span className="bg-black/60 text-gray-300 text-xs px-3 py-1.5 rounded-lg backdrop-blur-sm border border-white/10">{file?.name} · {fileSize}</span>
                <button onClick={() => setLightboxOpen(false)} className="bg-black/60 hover:bg-red-500/80 text-white rounded-lg p-2 backdrop-blur-sm border border-white/10 transition-colors"><FiX size={16} /></button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
