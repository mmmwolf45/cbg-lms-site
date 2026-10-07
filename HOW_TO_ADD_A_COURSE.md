# How to add a course

A course is one file: `content/courses/<slug>.yaml`. No code changes are needed. Every course.link page at `/course/...` already gets the CBG styling and motion.

There are two kinds of course file:
- **Card only:** just a home page card that says "Coming soon" and is not a link. Use this while the course has no page on course.link yet (see "Card-only course" below).
- **Full page:** the card plus the course page sections (steps 1 to 6 below). Its card is a link to the page.

## Card-only course (coming soon)
Make a file with only `slug` and `card`, like `content/courses/bim.yaml`:

```yaml
slug: bim
card:
  title: BIM (Building Information Modelling)
  status: coming soon
  line: Online BIM training in Revit and Navisworks covering 3D modelling, clash detection and project coordination, with live Middle East projects.
  meta: [6 months, Malayalam, Telugu, Online]
  languages: [Malayalam, Telugu]
  image: course-bim
  order: 5
```

- `slug` is the file name without `.yaml`. `title`, `status` and `order` are required; everything else is optional (`content/courses/interior-design.yaml` has only the title, so the card shows just the title and "Coming soon").
- `status` must be `coming soon`, and a card-only file has no `cta`.
- `line` is the course description, `meta` the small chips, `languages` the teaching languages (the home page counts the different languages across all cards). Put the course length in a `meta` chip (for example "6 months").
- `order` sets the card's place on the home page (lowest first). Every course file counts in the home page "courses" number.
- `image` is the card photo's name. Put the photo (3:2, for example 1536 x 1024) in `brand/assets/photos/<image>.png` and run `npm run images`. Until then the card shows a navy blueprint placeholder; `npm run content:check` lists the photos still missing. The names already set up are `course-iosh`, `course-qs`, `course-mep`, `course-structural`, `course-bim` and `course-interior`; for a new name, ask Claude Code to add it to `scripts/images.ts`.
- Then run `npm run build` and re-paste the home page block (step 6). No course page blocks are made for a card-only course.

**When the course page is ready:** add the page sections to the same file (steps 1 and 2), set `status: live now` and add a `cta` (the "Open course" button and its link). The card then becomes a link automatically.

## 1. Copy a course file
Make a copy of `content/courses/iosh-level-3.yaml` in the same folder and name it after the new course, in lower case with dashes, for example `content/courses/nebosh-igc.yaml`.

At the top, set:
- `slug`: the file name without `.yaml` (for example `nebosh-igc`). The build stops if they differ.
- `uniqueId`: the course number course.link uses in the page address (`101` in `/course/101-iosh-level3-certificate`).
- `path`: the course page address on course.link, starting with `/course/`.
- `card`: the course card on the home page (title, status, tag, line, chips, languages, image, order and button). A course with a page is `status: live now` and needs a `cta` (the "Open course" button); see "Card-only course" above for the other fields.

## 2. Fill in the sections
- `hero` is the only section you must keep. Every other section (`bowtie`, `included`, `units`, `how-classes-run`, `assessment`, `trainers`, `bonus`, `field-guides`, `payments`, `faq`, `help`) is optional: delete the whole section and the page simply leaves it out. The rest keep their order.
- Inside a section, the fields you may leave out are the ones ending in `?` in `content/schema.ts` (the comments there explain each one). Everything else must be filled in.
- `hero.visual` picks the picture under the heading:
  - `hazard-scan`: a photo with hazard markers. Needs `image`, `imageAlt`, `hazards` and `tour`. The photo must be 3:2, and new hazard labels need a CBG trainer's sign-off.
  - `photo`: a plain photo. Needs `image` and `imageAlt`.
  - `build-scrub`: footage played by the scroll, with an example take-off beside it (the QS page). Needs `image`, `imageAlt` and `scrub`.
  - `make-it-safe`: a slow wipe turns the site as found into the same site made safe, and each label changes from hazard to control. Needs `image`, `imageAlt` and `safe`. The made-safe photo (`safe.image`) must be the same size as `image`.
  - `risk-matrix`: the hazards move on a 5x5 risk matrix from their rating before controls to their rating after. Needs `matrix`. No photo.
  - `hierarchy`: the hierarchy of control, each tier with an example from the site. Needs `hierarchy`. No photo.
  - `swiss-cheese`: layers of defence; the hazard passes through every hole until one layer's hole is closed. Needs `cheese`. No photo.
  - `none`: no picture.
- To try a hero before it goes live, put it in `content/hero-options/<slug>.yaml` (see the IOSH one). `npm run dev` then shows each option at `http://localhost:4173/course/preview-101-<visual>` without changing the live page. To put one live, copy its fields into the course's `hero`, set `visual`, and delete the old visual's fields (the check names any that are left over).
- Control labels, risk ratings, hierarchy examples and cheese layers are new safety copy: a CBG trainer signs them off before they go live, like hazard labels.
- `image` is a photo name from `src/images.json` (for example `hazard-worksite` or `closing-plate`). `help.image` sets the closing band's photo; if you leave it out, it uses `closing-plate`.
- `bowtie`: one hazard and its top event, 2 to 4 causes (each with its prevention barrier) and 2 to 4 consequences (each with its recovery barrier). New safety copy: a CBG trainer signs it off.
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
`content:check` lists every course it found (for example `content OK: home.yaml (9 sections), 7 course(s): bim (card only), ..., nebosh-igc`) or names the exact field that is wrong. `npm run build` writes the paste-ready blocks to `dist/blocks/`:
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
