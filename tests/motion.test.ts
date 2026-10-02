import { describe, expect, it } from 'vitest';
import { countText } from '../src/motion/counters';
import { litCount, nodeFractions } from '../src/motion/thread';

describe('countText', () => {
  it('writes whole numbers on the way up', () => {
    expect(countText(0, 80, '80')).toBe('0');
    expect(countText(41.7, 80, '80')).toBe('41');
    expect(countText(79.99, 80, '80')).toBe('79');
  });

  it('ends on exactly the final text', () => {
    expect(countText(80, 80, '80')).toBe('80');
    expect(countText(80.0001, 80, ' 80 ')).toBe(' 80 ');
  });

  it('groups thousands when the final text does', () => {
    expect(countText(1234.5, 2500, '2,500')).toBe('1,234');
    expect(countText(1234.5, 2500, '2500')).toBe('1234');
  });

  it('never shows a negative number', () => {
    expect(countText(-0.4, 10, '10')).toBe('0');
  });
});

describe('thread nodes', () => {
  // .cbg-steps on a phone: 40px nodes at the top of each step, line inset 20px at both ends.
  const vertical = nodeFractions([20, 220, 420], 600);

  it('places nodes along the line, first at 0', () => {
    expect(vertical).toEqual([0, 200 / 560, 400 / 560]);
  });

  it('works across too (laptop row) and clamps to 0..1', () => {
    expect(nodeFractions([20, 420, 820], 1200)).toEqual([0, 400 / 1160, 800 / 1160]);
    expect(nodeFractions([20, 700], 100)).toEqual([0, 1]);
    expect(nodeFractions([], 100)).toEqual([]);
    expect(nodeFractions([50], 100)).toEqual([0]);
  });

  it('lights nothing before the line starts, then each node as the line reaches it', () => {
    expect(litCount(0, vertical)).toBe(0);
    expect(litCount(0.01, vertical)).toBe(1);
    expect(litCount(0.35, vertical)).toBe(1);
    expect(litCount(200 / 560, vertical)).toBe(2);
    expect(litCount(0.9, vertical)).toBe(3);
    expect(litCount(1, vertical)).toBe(3);
  });
});
