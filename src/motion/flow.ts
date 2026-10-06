// The page background's flowing navy and blue waves (home and course pages; "Flow on scroll", 3 Oct 2026). They
// move only while the page scrolls (scroll position is the clock), so nothing moves while the reader is still,
// and they stay still under reduced motion. The still gradient on body::before (critical.css) is the first paint
// and the fallback. Since 6 Oct 2026 the night sky's canvas draws them (sky.ts): one opaque canvas for waves and
// stars, where two stacked full-screen canvases each cost the Intel UHD laptop a slice of every frame.

export const SPEED = 0.0016; // wave time per scrolled pixel
const TAU = 0.13; // s: the waves glide to a stop (0.12 of the way per 60 Hz frame)

// The waves at fragment f of a canvas r px: a GLSL function for sky.ts's fragment shader.
// Colours are the brand navy family; COBALT and the gold glint are capped so the muted text colour
// (#8F96A5) keeps at least 4.5:1 against the brightest pixel (measured 4.8:1, 3 Oct 2026).
export const WAVES = `const vec3 DEEP=vec3(.016,.039,.09),NAVY = vec3(.031, .071, .149),BRAND=vec3(.125,.216,.412),
COBALT = vec3(.052, .118, .265),GOLD=vec3(.839,.694,.376);
vec3 waves(vec2 f,vec2 r,float t){vec2 uv=f/r,p=(f-.5*r)/r.y;
vec2 q=p+.35*vec2(sin(1.7*p.y+t*.6),sin(1.3*p.x-t*.5));q+=.20*vec2(sin(2.9*q.y-t*.4+1.3),sin(2.3*q.x+t*.7));
float w=.5+.5*sin(2.2*q.x+1.6*q.y+t*.3),w2=.5+.5*sin(-1.4*q.x+2.6*q.y-t*.25+2.);
vec3 c=mix(DEEP,NAVY,w);c=mix(c,COBALT,smoothstep(.55,1.,w*w2)*.8);c=mix(c,BRAND,smoothstep(.6,1.,w2)*.28);
c+=GOLD*pow(smoothstep(.75,1.,w*w2),3.)*.035;
return c*mix(.45,1.,smoothstep(.95,.2,length((uv-vec2(.5,.58))*vec2(1.1,1.))));}
`;

// One step of the glide toward the scroll position over dt seconds; lands exactly once close enough.
export const glide = (shown: number, target: number, dt: number) => {
  const next = shown + (target - shown) * (1 - Math.exp(-Math.min(0.05, dt) / TAU));
  return Math.abs(target - next) < 0.0005 ? target : next;
};
