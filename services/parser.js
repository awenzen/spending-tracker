/**
 * Parses spending messages.
 * Supports formats:
 *   "50k kopi"      → 50,000
 *   "50000 kopi"    → 50,000
 *   "50rb kopi"     → 50,000
 *   "Rp 50.000 kopi"→ 50,000 (Indonesian thousands separator)
 *   "2.5jt sewa"    → 2,500,000
 *   "2,5jt sewa"    → 2,500,000
 *   "kopi 50k"      → 50,000 (amount can come second)
 *   "/help"         → command
 */

const SUFFIX_MULTIPLIERS = {
  k: 1_000, rb: 1_000, ribu: 1_000,
  jt: 1_000_000, juta: 1_000_000, m: 1_000_000, million: 1_000_000,
};

function parseAmount(numStr, suffix) {
  // If a suffix exists, dot/comma is a decimal point: "2.5jt" = 2.5M
  if (suffix) {
    const normalized = numStr.replace(',', '.');
    const value = parseFloat(normalized);
    return Math.round(value * SUFFIX_MULTIPLIERS[suffix.toLowerCase()]);
  }

  // No suffix. Indonesian thousands separator convention:
  // "50.000" or "1.250.000" → strip separators
  // Pattern: digits + groups of (. or , followed by exactly 3 digits)
  if (/^\d{1,3}([.,]\d{3})+$/.test(numStr)) {
    return parseInt(numStr.replace(/[.,]/g, ''), 10);
  }

  // Otherwise treat as plain number (e.g. "50000" or "2.5" with no suffix → 2.5 rupiah, which is silly but...)
  return Math.round(parseFloat(numStr.replace(',', '.')));
}

export function parseMessage(text) {
  const trimmed = text.trim();

  // Commands
  if (trimmed.startsWith('/')) {
    const [cmd, ...args] = trimmed.slice(1).split(/\s+/);
    return { type: 'command', command: cmd.toLowerCase(), args };
  }

  // Strip "Rp" prefix variations
  const cleaned = trimmed.replace(/\bRp\.?\s*/gi, '');

  // Match: digits with thousands separators OR plain digits with optional decimal, then optional suffix
  // Examples matched: "50000", "50.000", "1.250.000", "2.5jt", "50k", "2,5juta"
  const amountRegex = /\b(\d{1,3}(?:[.,]\d{3})+|\d+(?:[.,]\d+)?)\s*(k|rb|ribu|jt|juta|m|million)?\b/i;
  const match = cleaned.match(amountRegex);

  if (!match) {
    return { type: 'invalid', reason: 'no_amount' };
  }

  const [fullMatch, numStr, suffix] = match;
  const amount = parseAmount(numStr, suffix);

  if (!amount || amount <= 0 || isNaN(amount)) {
    return { type: 'invalid', reason: 'invalid_amount' };
  }

  // Description = everything else
  const description = cleaned.replace(fullMatch, '').trim().replace(/\s+/g, ' ');

  if (!description) {
    return { type: 'invalid', reason: 'no_description' };
  }

  return {
    type: 'spending',
    amount,
    description,
    raw: text,
  };
}

export function formatIDR(amount) {
  return 'Rp ' + amount.toLocaleString('id-ID');
}
