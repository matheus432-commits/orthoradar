// Common utilities used across functions

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeXml(str) {
  return escapeHtml(str);
}

function truncate(str, length = 100) {
  if (!str || str.length <= length) return str;
  return str.substring(0, length - 1) + '…';
}

function normalize(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

module.exports = {
  escapeHtml,
  escapeXml,
  truncate,
  normalize,
};
