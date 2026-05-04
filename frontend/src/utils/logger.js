/**
 * Client-side logger for NeuroScan AI.
 *
 * In production (PROD) only WARN and ERROR are emitted.
 * In development all levels are emitted.
 *
 * Usage:
 *   import logger from '../utils/logger';
 *   logger.info('Upload started', { filename });
 *   logger.error('Request failed', err);
 */

const LEVELS = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };
const MIN_LEVEL = import.meta.env.PROD ? LEVELS.WARN : LEVELS.DEBUG;
const APP = '[NeuroScan]';

function emit(level, args) {
  if (LEVELS[level] < MIN_LEVEL) return;
  const ts = new Date().toISOString();
  const prefix = `${APP}[${level}][${ts}]`;
  const method = level === 'ERROR' ? 'error' : level === 'WARN' ? 'warn' : 'log';
  // eslint-disable-next-line no-console
  console[method](prefix, ...args);
}

const logger = {
  debug: (...args) => emit('DEBUG', args),
  info:  (...args) => emit('INFO',  args),
  warn:  (...args) => emit('WARN',  args),
  error: (...args) => emit('ERROR', args),
};

export default logger;
