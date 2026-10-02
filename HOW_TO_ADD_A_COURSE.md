# How to add a course

A course page is built from one file: `content/courses/<slug>.yaml`. No code changes are needed. Every course.link page at `/course/...` already gets the CBG styling and motion.

## 1. Copy a course file
Make a copy of `content/courses/iosh-level-3.yaml` in the same folder and name it after the new course, in lower case with dashes, for example `content/courses/nebosh-igc.yaml`.

At the top, set:
- `slug`: the file name without `.yaml` (for example `nebosh-igc`). The build stops if they differ.
- `uniqueId`: the course number course.link uses in the page address (`101` in `/course/101-iosh-level3-certificate`).
- `path`: the course page address on course.link, starting with `/course/`.
- `card`: the course card on the home page (title, status, tag, line, chips and button).

## 2. Fill in the sections
- `hero` is the only section you must keep. Every other section (`included`, `units`, `how-classes-run`, `assessment`, `trainers`, `bonus`, `field-guides`, `payments`, `faq`, `help`) is optional: delete the whole section and the page simply leaves it out. The rest keep their order.
- Inside a section, the fields you may leave out are the ones ending in `?` in `content/schema.ts` (the comments there explain each one). Everything else must be filled in.
- `hero.visual` picks the picture under the heading:
  - `hazard-scan`: a photo with hazard markers. Needs `image`, `imageAlt`, `hazards` and `tour`. The photo must be 3:2, and new hazard labels need a CBG trainer's sign-off.
  - `photo`: a plain photo. Needs `image` and `imageAlt`.
  - `none`: no picture.
- `image` is a photo name from `src/images.json` (for example `hazard-worksite` or `closing-plate`). `help.image` sets the closing band's photo; if you leave it out, it uses `closing-plate`.
- `units`: from 1 to 6 units works well. If the course does not use guided learning hours, set `hoursLabel` (for example `hours of study`) and `hoursShort` (for example `h`).
- `field-guides`: the shelf holds about 8 covers. The check in step 4 tells you if there are too many.
- `help.logos`: only `cbg-mark-512.png` and `iosh-1003-white.png` are set up. Ask Claude Code to add another logo.
- Plain English, no em-dashes. Links must start with `https://`, `mailto:`, `#` or `/`.

For a short example, see `content/courses/_dummy.yaml` (files starting with `_` are never built or pasted).

## 3. Add photos (only if the course needs new ones)
- Hero or band photo: put the PNG in `brand/assets/photos/`, then ask Claude Code to add it to the list in `scripts/images.ts`. Its name in the YAML is the file name without `.png`.
- Trainer headshots: put the `.jpg` in `brand/assets/trainers/`. These are picked up automatically; in the YAML, `trainers[].photo` is the file name (for example `jane-doe.jpg`).
- Then run:
  ```
  npm run images
  ```

## 4. Check and build
```
npm run content:check
npm run build
```
`content:check` lists every course it found (for example `content OK: home.yaml (7 sections), 2 course(s): iosh-level-3, nebosh-igc`) or names the exact field that is wrong. `npm run build` writes the paste-ready blocks to `dist/blocks/`:
- `<slug>-top.html` and `<slug>-main.html` for the course page
- `home.html` for the home page (now with the new course card)

If you added photos, ask Claude Code to push the code and wait for the deploy before pasting: the blocks load photos from the published site.

## 5. Paste the course page blocks (course.link)
1. Courses > the new course > **Landing page**.
2. **Add section** > Custom Block: paste `dist/blocks/<slug>-top.html`. Drag it **above Course Content**.
3. **Add section** > Custom Block: paste `dist/blocks/<slug>-main.html`. Drag it **below Course Content**.
4. In each block, check line 1 starts with `<div data-cbg=` and the last line ends with `</div>` with nothing added after it (the editor sometimes auto-closes tags).
5. Keep **Course Content** on. Switch **off** Overview, Learn, Testimonials, FAQ and Reviews.
6. Check the draft at `/course/preview-<uniqueId>` on a laptop and a phone.
7. **Publish changes**.

## 6. Re-paste the home page block
The home page course card comes from the new file's `card` automatically, so the home block must be pasted again:
Website > Home page > open the Custom Block, select all, paste `dist/blocks/home.html` (same line 1 and last line check), **Save**.

## Later: changing the wording
Edit the YAML, run `npm run content:check` and `npm run build`, then paste the changed block again (course page: **Publish changes**; home page: **Save**).
