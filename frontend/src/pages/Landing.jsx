import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiUpload, FiCpu, FiFileText, FiShield, FiActivity, FiZap, FiExternalLink, FiHeart, FiBook, FiUser } from 'react-icons/fi';

const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: (i) => ({ opacity: 1, y: 0, transition: { delay: i * 0.15, duration: 0.6 } }),
};

const features = [
  { icon: FiUpload, title: 'Multi-Format Upload', desc: 'Upload EEG data as CSV, images, or PDF reports for instant analysis.' },
  { icon: FiCpu, title: 'AI-Powered Detection', desc: 'LSTM neural network trained on 11,500 EEG recordings with 99% accuracy.' },
  { icon: FiFileText, title: 'Detailed Reports', desc: 'Generate professional medical reports in PDF, DOCX, or JSON format.' },
  { icon: FiShield, title: 'Secure & Private', desc: 'Your medical data is encrypted and never shared with third parties.' },
  { icon: FiActivity, title: 'Signal Visualization', desc: 'Interactive EEG signal charts with amplitude and frequency analysis.' },
  { icon: FiZap, title: 'Instant Results', desc: 'Get seizure detection results in seconds with detailed confidence scores.' },
];

export default function Landing({ user }) {
  return (
    <div className="pt-16">
      {/* Hero */}
      <section className="relative min-h-[90vh] flex items-center overflow-hidden">
        {/* Animated background */}
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary-500/10 rounded-full blur-3xl animate-pulse-slow" />
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-primary-700/10 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '1s' }} />
          <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-accent-purple/5 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '2s' }} />
        </div>

        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'linear-gradient(rgba(0,212,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,255,0.3) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div initial="hidden" animate="visible" className="space-y-8">
            <motion.div variants={fadeUp} custom={0} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-500/10 border border-primary-500/20 text-primary-400 text-sm font-medium">
              <FiActivity className="animate-pulse" /> AI-Powered Medical Analysis
            </motion.div>

            <motion.h1 variants={fadeUp} custom={1} className="text-5xl sm:text-6xl lg:text-7xl font-heading font-extrabold leading-tight">
              <span className="text-white">Epileptic Seizure</span>
              <br />
              <span className="bg-gradient-to-r from-primary-400 via-primary-500 to-primary-600 bg-clip-text text-transparent">
                Detection AI
              </span>
            </motion.h1>

            <motion.p variants={fadeUp} custom={2} className="text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed">
              Advanced deep learning analysis of EEG signals to detect epileptic seizures
              with <span className="text-primary-400 font-semibold">99% accuracy</span>. Upload your EEG data and get instant AI-powered diagnosis.
            </motion.p>

            <motion.div variants={fadeUp} custom={3} className="flex flex-col sm:flex-row justify-center gap-4 pt-4">
              <Link to={user ? '/upload' : '/register'} className="btn-primary text-lg inline-flex items-center justify-center gap-2">
                <FiUpload /> Start Analysis
              </Link>
              <a href="#features" className="btn-secondary text-lg inline-flex items-center justify-center gap-2">
                Learn More
              </a>
            </motion.div>

            {/* Stats */}
            <motion.div variants={fadeUp} custom={4} className="flex flex-wrap justify-center gap-8 sm:gap-16 pt-8">
              {[
                { val: '99%', label: 'Accuracy' },
                { val: '11.5K', label: 'EEG Records' },
                { val: '<2s', label: 'Analysis Time' },
              ].map((s) => (
                <div key={s.label} className="text-center">
                  <div className="text-2xl sm:text-3xl font-heading font-bold text-primary-400">{s.val}</div>
                  <div className="text-sm text-gray-500">{s.label}</div>
                </div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-center mb-16">
            <h2 className="text-4xl font-heading font-bold text-white mb-4">Powerful Features</h2>
            <p className="text-gray-400 text-lg max-w-xl mx-auto">Everything you need for advanced EEG seizure analysis in one platform.</p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                whileHover={{ y: -5, scale: 1.02 }}
                className="glass-card p-8 group cursor-pointer hover:border-primary-500/30 transition-all duration-500"
              >
                <div className="w-14 h-14 bg-gradient-to-br from-primary-500/20 to-primary-700/20 rounded-xl flex items-center justify-center mb-6 group-hover:from-primary-500/30 group-hover:to-primary-700/30 transition-all">
                  <f.icon className="text-primary-400 text-2xl" />
                </div>
                <h3 className="text-xl font-heading font-semibold text-white mb-3">{f.title}</h3>
                <p className="text-gray-400 leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 bg-dark-300/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-center mb-16">
            <h2 className="text-4xl font-heading font-bold text-white mb-4">How It Works</h2>
            <p className="text-gray-400 text-lg">Three simple steps to detect seizures from EEG signals.</p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: '01', title: 'Upload EEG Data', desc: 'Upload your EEG recording as a CSV file, image, or PDF report.' },
              { step: '02', title: 'AI Analysis', desc: 'Our LSTM neural network processes your data and detects seizure patterns.' },
              { step: '03', title: 'Get Results', desc: 'Receive instant prediction with confidence score and downloadable report.' },
            ].map((item, i) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.2 }}
                className="text-center"
              >
                <div className="text-6xl font-heading font-extrabold text-primary-500/20 mb-4">{item.step}</div>
                <h3 className="text-xl font-heading font-semibold text-white mb-3">{item.title}</h3>
                <p className="text-gray-400">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Trusted Resources */}
      <section className="py-24 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-4xl font-heading font-bold text-white mb-4">Trusted Medical Resources</h2>
            <p className="text-gray-400 text-lg max-w-xl mx-auto">
              NeuroScan AI is a research tool — always verify findings with qualified medical professionals.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: FiHeart,
                color: 'from-red-500/20 to-red-700/20',
                iconColor: 'text-red-400',
                borderHover: 'hover:border-red-500/30',
                badge: 'Epilepsy & Seizures',
                badgeColor: 'text-red-400 bg-red-400/10 border-red-400/20',
                title: 'Epilepsy Foundation',
                desc: 'Patient-friendly information on seizure types, EEG basics, treatment options, and first-aid guidance. Trusted globally by patients and caregivers.',
                cta: 'Learn about seizures',
                href: 'https://www.epilepsy.com/',
              },
              {
                icon: FiBook,
                color: 'from-blue-500/20 to-blue-700/20',
                iconColor: 'text-blue-400',
                borderHover: 'hover:border-blue-500/30',
                badge: 'Medical Reference',
                badgeColor: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
                title: 'MedlinePlus',
                desc: 'Government-backed medical encyclopedia covering EEG tests, seizure causes, medications, and clinical guidelines in clear, accurate language.',
                cta: 'Read medical details',
                href: 'https://medlineplus.gov/epilepsy.html',
              },
              {
                icon: FiUser,
                color: 'from-emerald-500/20 to-emerald-700/20',
                iconColor: 'text-emerald-400',
                borderHover: 'hover:border-emerald-500/30',
                badge: 'Doctor Consultation',
                badgeColor: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
                title: 'Practo',
                desc: 'Book a verified neurologist online for a professional consultation. Relevant for Indian users with Q&A, doctor profiles, and appointment booking.',
                cta: 'Consult a doctor',
                href: 'https://www.practo.com/',
              },
            ].map((res, i) => (
              <motion.a
                key={res.title}
                href={res.href}
                target="_blank"
                rel="noopener noreferrer"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.12 }}
                whileHover={{ y: -6 }}
                className={`glass-card p-7 flex flex-col gap-4 border border-white/10 ${res.borderHover} transition-all duration-300 group cursor-pointer`}
              >
                {/* Icon */}
                <div className={`w-12 h-12 bg-gradient-to-br ${res.color} rounded-xl flex items-center justify-center`}>
                  <res.icon className={`${res.iconColor} text-xl`} />
                </div>

                {/* Badge + title */}
                <div>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full border text-[11px] font-semibold mb-2 ${res.badgeColor}`}>
                    {res.badge}
                  </span>
                  <h3 className="text-lg font-heading font-bold text-white">{res.title}</h3>
                </div>

                {/* Description */}
                <p className="text-gray-400 text-sm leading-relaxed flex-1">{res.desc}</p>

                {/* CTA row */}
                <div className={`flex items-center gap-1.5 text-sm font-semibold ${res.iconColor} group-hover:gap-2.5 transition-all`}>
                  {res.cta}
                  <FiExternalLink size={13} />
                </div>
              </motion.a>
            ))}
          </div>

          {/* Disclaimer note */}
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center text-gray-600 text-xs mt-8 max-w-2xl mx-auto leading-relaxed"
          >
            ⚠️ NeuroScan AI predictions are for research and educational purposes only and do not constitute medical advice.
            Always consult a qualified neurologist before making any clinical decisions.
          </motion.p>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="glass-card p-6 sm:p-12 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary-500/10 rounded-full blur-3xl" />
            <h2 className="text-3xl sm:text-4xl font-heading font-bold text-white mb-4 relative">
              Ready to Analyze Your EEG Data?
            </h2>
            <p className="text-gray-400 text-lg mb-8 relative">
              Start using NeuroScan AI today for instant seizure detection.
            </p>
            <Link to={user ? '/upload' : '/register'} className="btn-primary text-lg relative inline-flex items-center gap-2">
              <FiUpload /> Get Started Free
            </Link>
          </motion.div>
        </div>
      </section>

    </div>
  );
}
