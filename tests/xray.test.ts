import { describe, expect, it } from 'vitest';
import type { Section } from '../content/schema';
import { checkXray, xrayMarkup } from '../templates/sections/course-xray';
import { clamp, inBand, keyTarget, valueText } from '../src/motion/xray';

// Fixtures only: the real photos and the QS YAML are checked by the content and image tests.
const S: Section<'xray'> = {
  heading: 'Read the steel: before it is poured.',
  intro: 'Move across the column to see its cage.',
  image: 'fx-concrete',
  xray: 'fx-steel',
  imageAlt: 'A concrete column on its footing at dusk',
  labels: [
    { text: 'Main bars', at: [667, 354] },
    { text: 'Stirrups & ties', at: [798, 491] },
  ],
  caption: 'Module 2: bar bending schedules.',
};
const SIZE = { width: 1536, height: 1024 };
const pic = (name: string) => `<picture><img src="${name}.jpg" width="1536" height="1024" alt=""></picture>`;
const html = xrayMarkup(S, pic('concrete'), pic('steel'), SIZE);

describe('checkXray', () => {
  it('accepts a same-size pair with labels inside it', () => {
    expect(() => checkXray(S, SIZE, { ...SIZE })).not.toThrow();
  });
  it('rejects a pair of different sizes', () => {
    expect(() => checkXray(S, SIZE, { width: 1536, height: 1020 })).toThrow('the pair must be the same size');
  });
  it('rejects a photo missing from the manifest', () => {
    expect(() => checkXray(S, SIZE, undefined)).toThrow('fx-steel is not in src/images.json');
  });
  it('rejects a label outside the photo, or not a point', () => {
    const bad = { ...S, labels: [S.labels[0], { text: 'Lap length', at: [1600, 10] }] };
    expect(() => checkXray(bad, SIZE, SIZE)).toThrow('xray.labels[1].at');
    expect(() => checkXray({ ...S, labels: [{ text: 'x', at: [10] }] }, SIZE, SIZE)).toThrow('xray.labels[0].at');
  });
});

describe('xray markup', () => {
  it('stacks the concrete photo and the steel inside the band, the band hidden from screen readers', () => {
    expect(html).toContain('<section id="cbg-xray" class="cbg-section cbg-c-xray" data-cbg-section="xray">');
    expect(html).toMatch(/<div class="cbg-xray__view">\s*<picture><img src="concrete.jpg"/);
    expect(html).toContain('<div class="cbg-xray__band" aria-hidden="true"><div class="cbg-xray__steel"><picture><img src="steel.jpg"');
  });

  it('places the decorative labels in % of the photo, chips outward from the centre', () => {
    expect(html).toContain('<ul class="cbg-xray__tags" aria-hidden="true">');
    expect(html).toContain('<li class="cbg-xray__tag cbg-xray__tag--l" data-cbg-x="43.42" style="--lx:43.42%;--ly:34.57%"><span>Main bars</span></li>');
    expect(html).toContain('<li class="cbg-xray__tag" data-cbg-x="51.95" style="--lx:51.95%;--ly:47.95%"><span>Stirrups &amp; ties</span></li>');
  });

  it('keeps the labels as a real list the slider points at; the slider waits hidden for the script', () => {
    expect(html).toContain('<ol class="cbg-sr-only" id="cbg-xray-labels"><li>Main bars</li><li>Stirrups &amp; ties</li></ol>');
    const hit = /<div class="cbg-xray__hit"[^>]*>/.exec(html)![0];
    for (const a of ['role="slider"', 'tabindex="0"', 'aria-label="', 'aria-describedby="cbg-xray-labels"', 'aria-valuemin="0"', 'aria-valuemax="100"', ' hidden']) {
      expect(hit).toContain(a);
    }
  });

  it('shows the caption only when there is one', () => {
    expect(html).toContain('<figcaption class="cbg-xray__caption">Module 2: bar bending schedules.</figcaption>');
    expect(xrayMarkup({ ...S, caption: undefined }, '', '', SIZE)).not.toContain('figcaption');
  });
});

describe('xray motion helpers', () => {
  it('lights a label while its point is inside the band', () => {
    expect(inBand(43.4, 50, 22)).toBe(true);
    expect(inBand(38, 50, 22)).toBe(false);
    expect(inBand(61, 50, 22)).toBe(false);
  });
  it('moves by 5 on arrows, 20 on page keys, to the ends on Home/End, inside 0..100', () => {
    expect(keyTarget('ArrowRight', 50)).toBe(55);
    expect(keyTarget('ArrowDown', 50)).toBe(45);
    expect(keyTarget('PageUp', 90)).toBe(100);
    expect(keyTarget('PageDown', 10)).toBe(0);
    expect(keyTarget('Home', 50)).toBe(0);
    expect(keyTarget('End', 50)).toBe(100);
    expect(keyTarget('Tab', 50)).toBeUndefined();
    expect(clamp(-3)).toBe(0);
  });
  it('says where the band is and what it shows', () => {
    expect(valueText(49.6, ['Main bars', 'Stirrups'])).toBe('Scan at 50%: Main bars, Stirrups');
    expect(valueText(3, [])).toBe('Scan at 3%: no labelled steel');
  });
});
