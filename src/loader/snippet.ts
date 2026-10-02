import { COURSE_ROUTE } from '../pages';

// Plus Jakarta Sans is already loaded by course.link (weights 200 to 800), so only Source Sans 3 here.
const FONTS = 'https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;600&display=swap';

export const TIMEOUT_MS = 4000;

// Runs in <head> before the body exists. Plain ES2017, no imports: this is pasted into course.link.
// 1. Mark <html> at once (cbg-js + route class) so pre-animation states and native restyles apply with no flash.
//    On our routes only, add the Source Sans 3 stylesheet from script: script-inserted, so it never blocks rendering.
// 2. Fetch the manifest (10-minute cache bucket), then inject the hashed CSS and JS.
// 3. If anything fails, or the bundle hasn't started within the timeout, drop cbg-js and the route
//    class and add cbg-off: the page shows stock course.link plus our static block HTML in its final
//    state. The route class must go too: navigation is client-side (docs/platform-findings.md), and
//    without the bundle nobody would update it, so the native restyles would follow the wrong page.
export function bootScript(base: string): string {
  return `(function(){var h=document.documentElement;function off(){if(!window.__cbg){h.classList.remove('cbg-js','cbg-route-home','cbg-route-course','cbg-route-none');h.classList.add('cbg-off')}}
try{var p=location.pathname.replace(/\\/+$/,''),r=p===''?'home':${COURSE_ROUTE}.test(p)?'course':'none';h.classList.add('cbg-js','cbg-route-'+r);
if(r!=='none'){var f=document.createElement('link');f.rel='stylesheet';f.href=${JSON.stringify(FONTS)};document.head.appendChild(f)}
var b=${JSON.stringify(base)};setTimeout(off,${TIMEOUT_MS});
fetch(b+'manifest.json?t='+Math.floor(Date.now()/6e5)).then(function(r){if(!r.ok)throw r.status;return r.json()}).then(function(m){
var l=document.createElement('link');l.rel='stylesheet';l.href=b+m.css;document.head.appendChild(l);
var s=document.createElement('script');s.type='module';s.src=b+m.js;s.onerror=off;document.head.appendChild(s)}).catch(off)}catch(e){off()}})();`;
}

export function loaderSnippet(base: string, criticalCss: string, noindex = true): string {
  return [
    '<!-- CBG loader: paste into course.link > Settings > Integrations > Custom Script > All Pages -->',
    noindex ? '<meta name="robots" content="noindex,nofollow">' : '',
    '<link rel="preconnect" href="https://fonts.googleapis.com">',
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
    criticalCss.trim() ? `<style>${criticalCss.trim()}</style>` : '',
    `<script>${bootScript(base)}</script>`,
  ]
    .filter(Boolean)
    .join('\n');
}
