const NIGHTLY_SYNC_PREFIX = /^updated\s+via\s+nightly\s+sync\s*:\s*/i;

export function normalizeNightlySyncComment(text) {
  if (typeof text !== 'string') {
    return null;
  }

  const trimmed = text.trim();
  if (!NIGHTLY_SYNC_PREFIX.test(trimmed)) {
    return null;
  }

  return trimmed
    .replace(NIGHTLY_SYNC_PREFIX, '')
    .normalize('NFKC')
    .trim()
    .toLocaleLowerCase('en-US')
    .replace(/\s+/g, ' ')
    .replace(/[.!?]+$/g, '')
    .trim();
}

export function findEquivalentConsecutiveNightlySyncComment(comments, text) {
  const normalized = normalizeNightlySyncComment(text);
  if (normalized === null || comments.length === 0) {
    return null;
  }

  const latest = comments[comments.length - 1];
  return normalizeNightlySyncComment(latest.text) === normalized ? latest : null;
}
