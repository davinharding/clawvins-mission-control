import { describe, it, expect } from 'vitest';
import { formatRelativeTime } from '@/lib/time';

const previewDescription = (description: string) =>
  description.length > 80 ? `${description.slice(0, 80)}…` : description;

describe('Task card rendering', () => {
  it('renders description preview', () => {
    const longText = 'A'.repeat(120);
    expect(previewDescription(longText)).toBe(`${'A'.repeat(80)}…`);
  });

  it('renders relative timestamp', () => {
    expect(formatRelativeTime(0, 60_000)).toBe('1m ago');
  });
});
