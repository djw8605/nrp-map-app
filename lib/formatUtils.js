/**
 * Shared formatting utilities for the NRP dashboard.
 *
 * Rules:
 * - Use K and M for large values.
 * - Maximum 1 decimal place.
 * - Units styled separately (caller applies `text-gray-500`).
 */

/**
 * Format a number in compact notation (e.g. 1.2K, 3.4M).
 * Values below 1000 are returned as-is with locale formatting.
 *
 * @param {number|null|undefined} value
 * @param {number} [maxDecimals=1] Maximum fractional digits.
 * @returns {string}
 */
export function formatCompactNumber(value, maxDecimals = 1) {
  if (value == null) return '—';
  const abs = Math.abs(value);
  if (abs >= 1_000_000) {
    return (value / 1_000_000).toFixed(maxDecimals).replace(/\.0$/, '') + 'M';
  }
  if (abs >= 1_000) {
    return (value / 1_000).toFixed(maxDecimals).replace(/\.0$/, '') + 'K';
  }
  return value.toLocaleString(undefined, { maximumFractionDigits: maxDecimals });
}

/**
 * Format a decimal ratio as a percentage string (e.g. 0.123 → "12.3%").
 *
 * @param {number|null|undefined} value  Ratio (0–1 or larger).
 * @param {number} [maxDecimals=1]
 * @returns {string}
 */
export function formatPercent(value, maxDecimals = 1) {
  if (value == null) return '—';
  return (value * 100).toFixed(maxDecimals).replace(/\.0$/, '') + '%';
}

/**
 * Format bytes-per-second as human-readable throughput.
 *
 * @param {number|null|undefined} bytes
 * @param {boolean} [si=true] Use SI (powers of 1000) units.
 * @param {number} [dp=1]
 * @returns {string}
 */
export function formatThroughput(bytes, si = true, dp = 1) {
  if (bytes == null) return '—';
  const thresh = si ? 1000 : 1024;
  if (Math.abs(bytes) < thresh) return bytes + ' B/s';

  const units = si
    ? ['kB/s', 'MB/s', 'GB/s', 'TB/s', 'PB/s']
    : ['KiB/s', 'MiB/s', 'GiB/s', 'TiB/s', 'PiB/s'];

  let u = -1;
  const r = 10 ** dp;
  let b = bytes;
  do {
    b /= thresh;
    ++u;
  } while (Math.round(Math.abs(b) * r) / r >= thresh && u < units.length - 1);

  return b.toFixed(dp) + ' ' + units[u];
}
