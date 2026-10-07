import { gsap } from 'gsap';
import { DONE } from './reveal';
import { whenSeen } from './seen';
import { reducedMotion } from './tokens';

// Swiss cheese model (hero.visual: swiss-cheese; templates/sections/course-hero-options.ts,
// hero-options.css). The layers fade in, the hazard's ray runs slowly through every hole and reaches the
// incident; then the fixed layer's hole closes, the ray beyond it fades, the incident is struck through
// and the "stopped" line appears: the finished state the markup holds.

export function enhance(fig: HTMLElement): () => void {
  if (matchMedia(reducedMotion).matches || fig.classList.contains(DONE)) return () => {};
  const q = (s: string) => fig.querySelector<HTMLElement>(s)!;
  const slices = [...fig.querySelectorAll<HTMLElement>('.cbg-slice')];
  const fix = q('.cbg-slice.is-fix');
  const rayIn = q('.cbg-cheese__ray--in');
  const rayOut = q('.cbg-cheese__ray--out');
  const incident = q('.cbg-cheese__end--to s');
  const stopped = q('.cbg-cheese__end--to strong');
  const RUN = 2.6; // seconds for the ray to cross every layer

  const ctx = gsap.context(() => {});
  const play = () => ctx.add(() => {
    const share = rayIn.offsetWidth / Math.max(1, rayIn.offsetWidth + rayOut.offsetWidth);
    const tl = gsap.timeline({
      onComplete: () => {
        fig.classList.add(DONE);
        gsap.set([...slices, rayIn, rayOut, incident, stopped], { clearProps: 'opacity,transform,--h,--strike' });
      },
    });
    tl.fromTo(slices, { opacity: 0 }, { opacity: 1, duration: 0.9, ease: 'sine.out', stagger: 0.25 })
      .fromTo(rayIn, { scaleX: 0 }, { scaleX: 1, duration: RUN * share, ease: 'none' }, '+=0.3')
      .fromTo(rayOut, { scaleX: 0, opacity: 1 }, { scaleX: 1, duration: RUN * (1 - share), ease: 'sine.out' })
      .fromTo(incident, { opacity: 0, '--strike': '0%' }, { opacity: 1, duration: 0.8, ease: 'sine.out' }, '-=0.3')
      .addLabel('fix', '+=1')
      .fromTo(fix, { '--h': 1 }, { '--h': 0, duration: 1.4, ease: 'power2.inOut' }, 'fix')
      .to(rayOut, { opacity: 0.18, duration: 1.4, ease: 'sine.inOut' }, 'fix')
      .to(incident, { opacity: 0.6, '--strike': '100%', duration: 1.2, ease: 'sine.inOut' }, 'fix+=0.6')
      .fromTo(stopped, { opacity: 0 }, { opacity: 1, duration: 0.9, ease: 'sine.out' }, 'fix+=1');
  });
  const cancel = whenSeen(fig, play, 0.8);
  return () => {
    cancel();
    ctx.revert();
  };
}
