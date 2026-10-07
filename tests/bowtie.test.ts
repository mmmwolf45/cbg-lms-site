import { describe, expect, it } from 'vitest';
import { loadCourse, validateCourse } from '../content/schema';
import { courseMain } from '../templates/course';
import { lines } from '../templates/sections/course-bowtie';

// The 3D bow-tie (templates/sections/course-bowtie.ts), first in the IOSH main block.
const iosh = loadCourse('iosh-level-3.yaml');
const html = courseMain(iosh);
const copy = () => JSON.parse(JSON.stringify(iosh));

describe('bow-tie', () => {
  it('is the first section of the main block', () => {
    expect([...html.matchAll(/data-cbg-section="([^"]+)"/g)].map((m) => m[1])[0]).toBe('bowtie');
  });

  it('puts the hazard and event at the knot, each cause with its prevention barrier, each consequence with its recovery barrier', () => {
    const b = iosh.bowtie!;
    expect(html).toContain(`<p class="cbg-bowtie__knot"><span>${b.hazard}</span> <strong>${b.event}</strong></p>`);
    expect(html).toContain('<li style="--i:0"><span class="cbg-bt-end">No edge protection</span><span class="cbg-bt-barrier"><span class="cbg-sr-only">Prevention barriers: </span>Guardrails and toe boards</span></li>');
    expect(html).toContain('<span class="cbg-bt-barrier"><span class="cbg-sr-only">Recovery barriers: </span>Fall arrest harness</span><span class="cbg-bt-end">Serious injury</span>');
    expect(html).toContain('aria-label="Causes" style="--n:3"');
    expect(html).toContain('aria-label="Consequences" style="--n:3"');
  });

  it('draws one line per cause into the knot and one per consequence out of it', () => {
    const svg = lines(3, 2);
    expect((svg.match(/<path /g) ?? []).length).toBe(5);
    expect(svg).toContain('M17 16.67C30 16.67 36 50 50 50');
    expect(svg).toContain('M50 50C64 50 70 75 83 75');
  });

  it('takes 2 to 4 causes and consequences', () => {
    const c = copy();
    c.bowtie.causes = c.bowtie.causes.slice(0, 1);
    expect(() => validateCourse(c)).toThrow('bowtie.causes: list 2 to 4 causes; got 1');
    const d = copy();
    d.bowtie.consequences = [...d.bowtie.consequences, ...d.bowtie.consequences];
    expect(() => validateCourse(d)).toThrow('bowtie.consequences: list 2 to 4 consequences; got 6');
  });
});
