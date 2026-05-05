import { useRef } from 'react';

export const OTP_DIGITS = 6;
export const OTP_EXPIRE_SECONDS = 10 * 60;

// ── OTP digit boxes ───────────────────────────────────────────────────────────
export function OtpInput({ value, onChange }) {
  const inputRefs = useRef([]);

  const focusAt = (i) => inputRefs.current[i]?.focus();

  const handleKey = (i, e) => {
    if (e.key === 'Backspace') {
      if ((value[i] || '').trim()) {
        const chars = value.split('');
        chars[i] = ' ';
        onChange(chars.join(''));
      } else if (i > 0) {
        focusAt(i - 1);
        const chars = value.split('');
        chars[i - 1] = ' ';
        onChange(chars.join(''));
      }
      return;
    }
    if (e.key === 'ArrowLeft'  && i > 0)              { focusAt(i - 1); return; }
    if (e.key === 'ArrowRight' && i < OTP_DIGITS - 1) { focusAt(i + 1); return; }
  };

  const handleChange = (i, e) => {
    const char = e.target.value.replace(/\D/g, '').slice(-1);
    if (!char) return;
    const chars = value.split('');
    chars[i] = char;
    onChange(chars.join(''));
    if (i < OTP_DIGITS - 1) focusAt(i + 1);
  };

  const handlePaste = (e) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_DIGITS);
    if (pasted) {
      onChange(pasted.padEnd(OTP_DIGITS, ' '));
      focusAt(Math.min(pasted.length, OTP_DIGITS - 1));
    }
    e.preventDefault();
  };

  return (
    <div className="flex gap-2 sm:gap-3 justify-center">
      {Array.from({ length: OTP_DIGITS }).map((_, i) => (
        <input
          key={i}
          ref={(el) => (inputRefs.current[i] = el)}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={(value[i] || '').trim()}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKey(i, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
          className={`w-11 h-14 sm:w-12 sm:h-16 text-center text-xl font-bold rounded-xl border-2 bg-white/5
            text-white caret-primary-400 outline-none transition-all
            ${(value[i] || '').trim()
              ? 'border-primary-500 bg-primary-500/10'
              : 'border-white/15 focus:border-primary-400 focus:bg-primary-500/5'}`}
        />
      ))}
    </div>
  );
}

// ── Countdown timer ───────────────────────────────────────────────────────────
export function Countdown({ seconds }) {
  const m   = String(Math.floor(seconds / 60)).padStart(2, '0');
  const s   = String(seconds % 60).padStart(2, '0');
  const pct = (seconds / OTP_EXPIRE_SECONDS) * 100;
  const color = seconds > 120 ? 'text-green-400' : seconds > 60 ? 'text-yellow-400' : 'text-red-400';
  const bar   = seconds > 120 ? 'bg-green-400'  : seconds > 60 ? 'bg-yellow-400'  : 'bg-red-400';

  return (
    <div className="flex flex-col items-center gap-1 my-4">
      <span className={`font-mono text-2xl font-bold ${color}`}>{m}:{s}</span>
      <div className="w-32 h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-1000 ${bar}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-gray-500 text-xs">Code expires in</span>
    </div>
  );
}
