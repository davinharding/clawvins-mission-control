import { describe, expect, it } from 'vitest';
import {
  findEquivalentConsecutiveNightlySyncComment,
  normalizeNightlySyncComment,
} from '../lib/nightly-sync-comments.js';

const comment = (text) => ({ id: `comment-${text}`, text });

describe('nightly sync comment idempotency', () => {
  it('normalizes equivalent nightly sync notes', () => {
    expect(normalizeNightlySyncComment('Updated via nightly sync: Still blocked.')).toBe('still blocked');
    expect(normalizeNightlySyncComment(' updated VIA nightly sync :  Still   blocked! ')).toBe('still blocked');
  });

  it('suppresses only an equivalent consecutive nightly sync note', () => {
    const latest = comment('Updated via nightly sync: Still blocked.');
    expect(
      findEquivalentConsecutiveNightlySyncComment(
        [comment('Earlier context'), latest],
        'Updated via nightly sync: still blocked!',
      ),
    ).toBe(latest);

    expect(
      findEquivalentConsecutiveNightlySyncComment(
        [latest, comment('A legitimate intervening comment')],
        'Updated via nightly sync: Still blocked.',
      ),
    ).toBeNull();
  });

  it('never suppresses legitimate non-sync comments', () => {
    expect(
      findEquivalentConsecutiveNightlySyncComment(
        [comment('Same legitimate comment')],
        'Same legitimate comment',
      ),
    ).toBeNull();
  });
});
