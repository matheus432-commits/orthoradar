const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const MIN_LEVEL = LEVELS[process.env.LOG_LEVEL] ?? 1;

function log(level, message, data) {
  if ((LEVELS[level] ?? 1) < MIN_LEVEL) return;
  const entry = { ts: new Date().toISOString(), level, message };
  if (data && typeof data === 'object') {
    for (const [k, v] of Object.entries(data)) {
      if (v !== undefined) entry[k] = v;
    }
  }
  const output = JSON.stringify(entry);
  if (level === 'error') console.error(output);
  else if (level === 'warn') console.warn(output);
  else console.log(output);
}

module.exports = {
  debug: (msg, data) => log('debug', msg, data),
  info:  (msg, data) => log('info',  msg, data),
  warn:  (msg, data) => log('warn',  msg, data),
  error: (msg, data) => log('error', msg, data),
};
