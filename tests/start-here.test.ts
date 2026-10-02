import { describe, expect, it } from 'vitest';
import { findStartTrigger } from '../src/motion/start-here';

const trigger = (text: string, expanded = 'false') => ({ textContent: text, getAttribute: () => expanded });
const content = (triggers: ReturnType<typeof trigger>[]) => ({
  querySelectorAll: (sel: string) => (sel === 'button[aria-expanded]' ? triggers : []),
});

describe('findStartTrigger', () => {
  it('prefers the section titled Start Here, even with its number in front', () => {
    const t = [trigger('2 Day 1 Resources'), trigger('1Start Here3 Lessons')];
    expect(findStartTrigger(content(t))).toBe(t[1]);
  });

  it('falls back to the first section', () => {
    const t = [trigger('1 Welcome'), trigger('2 Unit 1')];
    expect(findStartTrigger(content(t))).toBe(t[0]);
  });

  it('returns undefined when Course Content has no sections', () => {
    expect(findStartTrigger(content([]))).toBeUndefined();
  });
});
