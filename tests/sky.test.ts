import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { LAT, LST0, decode, lens, tint, turn, view } from '../src/motion/sky';

const DEG = Math.PI / 180;
const eq = (raDeg: number, decDeg: number) => [
  Math.cos(decDeg * DEG) * Math.cos(raDeg * DEG), Math.cos(decDeg * DEG) * Math.sin(raDeg * DEG), Math.sin(decDeg * DEG),
];
// p * M as GLSL does it: dot with each column.
const project = (m: Float32Array, p: number[]) => [0, 1, 2].map((c) => p[0] * m[3 * c] + p[1] * m[3 * c + 1] + p[2] * m[3 * c + 2]);

describe('night sky', () => {
  it('projects the real sky over Doha: the pole due north at 25.3 degrees, the meridian straight ahead', () => {
    const m = view(LST0, 40 * DEG);
    const zenith = m.subarray(9);
    const altitude = (p: number[]) => Math.asin(p[0] * zenith[0] + p[1] * zenith[1] + p[2] * zenith[2]) / DEG;
    expect(altitude([0, 0, 1])).toBeCloseTo(LAT / DEG, 4); // the celestial pole
    // A star on the meridian at Dec 0 (RA = sidereal time) stands due south at 90 - 25.3 degrees, mid-screen (x = 0).
    const south = eq(LST0 / DEG, 0);
    expect(altitude(south)).toBeCloseTo(64.7, 4);
    expect(project(m, south)[0]).toBeCloseTo(0, 6);
    // Later in the night (higher sidereal time) it has moved west, which is screen right.
    expect(project(view(LST0 + 10 * DEG, 40 * DEG), south)[0]).toBeGreaterThan(0);
    // The view axes stay orthonormal.
    for (const [a, b] of [[0, 1], [1, 2], [0, 2]]) expect(project(m, Array.from(m.subarray(3 * a, 3 * a + 3)))[b]).toBeCloseTo(0, 6);
  });

  it('fits a wide lens: horizon just under the bottom edge, phones look higher', () => {
    const [s, alt] = lens(1440, 900);
    expect(s).toBeGreaterThan(500);
    expect(alt / DEG).toBeGreaterThan(30);
    expect(alt / DEG).toBeLessThan(50);
    expect(lens(390, 844)[1]).toBeGreaterThan(alt);
  });

  it('turns slowly: damped, capped, never overshooting, lands exactly', () => {
    let shown = 0;
    let steps = 0;
    for (; shown !== 0.3 && steps < 2000; steps++) {
      const next = turn(shown, 0.3, 1 / 30);
      expect(next).toBeGreaterThanOrEqual(shown);
      expect(next - shown).toBeLessThanOrEqual((2 * DEG) / 30 + 1e-9); // the speed cap
      shown = next;
    }
    expect(shown).toBe(0.3);
    // Frame-rate independent: 60 fps and 30 fps reach the same place after one second.
    let a = 0, b = 0;
    for (let i = 0; i < 60; i++) a = turn(a, 0.01, 1 / 60);
    for (let i = 0; i < 30; i++) b = turn(b, 0.01, 1 / 30);
    expect(a).toBeCloseTo(b, 6);
  });

  it('colours stars by B-V: blue-white hot stars, orange cool ones', () => {
    const [r1, , b1] = tint(-0.2), [r2, , b2] = tint(1.85); // Rigel-ish, Betelgeuse
    expect(b1).toBeGreaterThan(r1);
    expect(r2).toBeGreaterThan(b2);
    expect(tint(9)).toEqual(tint(2));
    expect(tint(-9)).toEqual(tint(-0.4));
  });

  it('ships a real catalogue: about 3,900 stars to magnitude 5.8, Sirius brightest, figures on real stars', () => {
    const buf = readFileSync('public/sky/stars.bin');
    const { stars, lines } = decode(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length));
    expect(stars.length / 7).toBeGreaterThan(2500);
    expect(stars.length / 7).toBeLessThan(4500);
    expect(stars[3]).toBeCloseTo(-1.46, 1); // brightest first: Sirius, V = -1.46
    const sirius = eq(101.287, -16.716);
    expect(stars[0] * sirius[0] + stars[1] * sirius[1] + stars[2] * sirius[2]).toBeGreaterThan(Math.cos(0.05 * DEG));
    expect(lines.length / 14).toBeGreaterThan(200); // segments
  });
});
