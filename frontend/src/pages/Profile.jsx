import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiUser, FiMail, FiCalendar, FiEdit2, FiSave, FiX,
  FiLock, FiCheckCircle, FiAlertCircle, FiUsers, FiHash,
} from 'react-icons/fi';
import { updateProfile } from '../api';

/* ─── Small info row used in view mode ──────────────────────────────────── */
function InfoRow({ icon: Icon, label, value }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex items-center gap-4 py-3 border-b border-white/5 last:border-0">
      <div className="w-10 h-10 bg-primary-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
        <Icon className="text-primary-400" size={16} />
      </div>
      <div>
        <p className="text-xs text-gray-500 uppercase tracking-widest mb-0.5">{label}</p>
        <p className="text-white font-medium text-sm">{value}</p>
      </div>
    </div>
  );
}

/* ─── Labelled input used in edit mode ──────────────────────────────────── */
function EditField({ label, icon: Icon, children }) {
  return (
    <div>
      <label className="block text-xs text-gray-400 uppercase tracking-widest mb-1.5">{label}</label>
      <div className="relative">
        {Icon && (
          <Icon className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" size={15} />
        )}
        {children}
      </div>
    </div>
  );
}

/* ─── Main component ─────────────────────────────────────────────────────── */
export default function Profile({ user, onUserUpdate }) {
  const [editing, setEditing]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const [success, setSuccess]   = useState(false);
  const [error, setError]       = useState('');

  const [form, setForm] = useState({
    full_name:   user?.full_name   || '',
    father_name: user?.father_name || '',
    age:         user?.age         || '',
    sex:         user?.sex         || '',
    email:       user?.email       || '',
    password:    '',
    confirm:     '',
  });

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');

    if (form.password) {
      if (form.password.length < 8) {
        setError('Password must be at least 8 characters long.');
        return;
      }
      if (form.password !== form.confirm) {
        setError('Passwords do not match.');
        return;
      }
    }

    setSaving(true);
    try {
      const payload = {
        full_name:   form.full_name   || undefined,
        father_name: form.father_name || undefined,
        age:         form.age ? parseInt(form.age, 10) : undefined,
        sex:         form.sex         || undefined,
        email:       form.email       || undefined,
        password:    form.password    || undefined,
      };
      // Remove undefined keys
      Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);

      const res = await updateProfile(payload);
      if (onUserUpdate) onUserUpdate(res.data);
      setSuccess(true);
      setEditing(false);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Update failed. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditing(false);
    setError('');
    setForm({
      full_name:   user?.full_name   || '',
      father_name: user?.father_name || '',
      age:         user?.age         || '',
      sex:         user?.sex         || '',
      email:       user?.email       || '',
      password:    '',
      confirm:     '',
    });
  };

  const initials = (user?.full_name || user?.username || 'U')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const joinDate = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : 'N/A';

  return (
    <div className="min-h-screen pt-24 pb-16 px-4">
      <div className="max-w-2xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>

          {/* Page title */}
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-heading font-bold text-white">Profile</h1>
            {!editing && (
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setEditing(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary-500/10 border border-primary-400/20 text-primary-400 text-sm font-medium hover:bg-primary-500/20 transition-colors"
              >
                <FiEdit2 size={14} /> Edit Profile
              </motion.button>
            )}
          </div>

          {/* Success toast */}
          <AnimatePresence>
            {success && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3 mb-6 text-green-400 text-sm"
              >
                <FiCheckCircle /> Profile updated successfully!
              </motion.div>
            )}
          </AnimatePresence>

          {/* Error banner */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mb-6 text-red-400 text-sm"
              >
                <FiAlertCircle /> {error}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="glass-card overflow-hidden">

            {/* Avatar header */}
            <div className="p-5 sm:p-8 pb-4 sm:pb-6 flex items-center gap-4 sm:gap-6 border-b border-white/5">
              <div className="w-20 h-20 bg-gradient-to-br from-primary-500 to-primary-700 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg">
                <span className="text-3xl font-heading font-bold text-white">{initials}</span>
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-heading font-bold text-white">{user?.full_name || user?.username}</h2>
                <p className="text-gray-400 text-sm">@{user?.username}</p>
                {user?.sex && (
                  <span className="inline-flex items-center mt-2 px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-400/10 border border-primary-400/20 text-primary-400">
                    {user.sex}
                  </span>
                )}
              </div>
            </div>

            {/* ── VIEW MODE ── */}
            <AnimatePresence mode="wait">
              {!editing ? (
                <motion.div
                  key="view"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="p-5 sm:p-8 space-y-1"
                >
                  <InfoRow icon={FiUser}  label="Full Name"    value={user?.full_name} />
                  <InfoRow icon={FiUsers} label="Father's Name" value={user?.father_name} />
                  <InfoRow icon={FiHash}  label="Age"          value={user?.age ? `${user.age} years` : null} />
                  <InfoRow icon={FiUser}  label="Sex"          value={user?.sex} />
                  <InfoRow icon={FiUser}  label="Username"     value={user?.username} />
                  <InfoRow icon={FiMail}  label="Email"        value={user?.email} />
                  <InfoRow icon={FiCalendar} label="Member Since" value={joinDate} />
                </motion.div>
              ) : (

                /* ── EDIT MODE ── */
                <motion.form
                  key="edit"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onSubmit={handleSave}
                  className="p-5 sm:p-8 space-y-5"
                >
                  <p className="text-xs text-gray-500 uppercase tracking-widest mb-4">Personal Information</p>

                  {/* Full Name */}
                  <EditField label="Full Name" icon={FiUser}>
                    <input
                      type="text"
                      value={form.full_name}
                      onChange={set('full_name')}
                      className="input-field pl-11"
                      placeholder="John Doe"
                    />
                  </EditField>

                  {/* Father's Name */}
                  <EditField label="Father's Name" icon={FiUsers}>
                    <input
                      type="text"
                      value={form.father_name}
                      onChange={set('father_name')}
                      className="input-field pl-11"
                      placeholder="Robert Doe"
                    />
                  </EditField>

                  {/* Age + Sex */}
                  <div className="grid grid-cols-2 gap-4">
                    <EditField label="Age" icon={FiCalendar}>
                      <input
                        type="number"
                        value={form.age}
                        onChange={set('age')}
                        className="input-field pl-11"
                        placeholder="25"
                        min={1}
                        max={120}
                      />
                    </EditField>
                    <EditField label="Sex">
                      <select
                        value={form.sex}
                        onChange={set('sex')}
                        className="input-field w-full appearance-none"
                      >
                        <option value="">Select</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </EditField>
                  </div>

                  {/* Email */}
                  <EditField label="Email" icon={FiMail}>
                    <input
                      type="email"
                      value={form.email}
                      onChange={set('email')}
                      className="input-field pl-11"
                      placeholder="john@example.com"
                    />
                  </EditField>

                  {/* Divider */}
                  <div className="border-t border-white/5 pt-4">
                    <p className="text-xs text-gray-500 uppercase tracking-widest mb-4">Change Password <span className="normal-case text-gray-600">(leave blank to keep current)</span></p>

                    <div className="space-y-4">
                      <EditField label="New Password" icon={FiLock}>
                        <input
                          type="password"
                          value={form.password}
                          onChange={set('password')}
                          className="input-field pl-11"
                          placeholder="New password"
                          minLength={form.password ? 8 : undefined}
                          autoComplete="new-password"
                        />
                      </EditField>
                      <EditField label="Confirm New Password" icon={FiLock}>
                        <input
                          type="password"
                          value={form.confirm}
                          onChange={set('confirm')}
                          className="input-field pl-11"
                          placeholder="Repeat new password"
                          autoComplete="new-password"
                        />
                      </EditField>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-3 pt-2">
                    <motion.button
                      type="submit"
                      disabled={saving}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {saving
                        ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        : <FiSave size={15} />}
                      {saving ? 'Saving...' : 'Save Changes'}
                    </motion.button>
                    <motion.button
                      type="button"
                      onClick={handleCancel}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="btn-secondary flex items-center justify-center gap-2 px-5"
                    >
                      <FiX size={15} /> Cancel
                    </motion.button>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>
          </div>

        </motion.div>
      </div>
    </div>
  );
}
