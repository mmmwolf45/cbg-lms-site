import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';

describe('repo', () => {
  it('has the brand tokens and content copied in', () => {
    expect(existsSync('brand/tokens.css')).toBe(true);
    expect(existsSync('content/home.yaml')).toBe(true);
  });
});
