# CBG brand for the LMS site

The sources are the IOSH Level 3 course brochure (`../04_Marketing/Brochure & Flyers/IOSH Level 3 Course Brochure.pdf`), the CBG IOSH PowerPoint template (its palette is captured below), and the CBG logo files. Use these as the starting point for the ui-ux-pro-max and design-taste passes. They are guardrails, not a finished design system.

## Colour
| Token | Hex | Use |
|---|---|---|
| Navy (primary) | #203769 | Brand colour set in course.link: buttons, links, hero bands. The course banner uses this too. |
| Navy (template) | #203869 | Near-identical navy in the PowerPoint template. Treat as the same colour. |
| Gold (accent) | #C9A24B | Accent rules, highlights, "included free" badges, small call-outs. Use sparingly. |
| Brown | #544140 | The "GLOBAL" and "G" in the CBG logo. Secondary accent only. |
| Slate | #5A6275 | Secondary text and muted UI. |
| Light blue tint | #C9D6F0 | Text on navy, soft fills. |
| Off-white | #F5F7FB | Section backgrounds. |
| Risk ramp | green / amber / red | Only for risk-matrix visuals. |

## Type
- The site font in course.link is **Plus Jakarta Sans**. Use it for UI and body text, so our blocks blend with course.link's own header, banner and enrol card.
- The brochure headings are a heavy geometric sans. Plus Jakarta Sans 700/800 matches that well.
- If a display face is wanted for big hero lines, propose one in the spec and get approval. Load fonts through the Custom Script `<link>` (fonts loaded with `@import` inside blocks do not apply).

## Logos and marks (in `brand/assets/`)
- `cbg-full-logo.png`: CBG mark plus the "CARBONBLUEGLOBAL / Experts in Engineering Services" wordmark (transparent, 4151×2069).
- `cbg-mark-512.png`: the round CBG mark only.
- `favicon-32/48/180.png`: favicon set (48 is live in course.link).
- `iosh-1003-colour.png`, `iosh-1003-white.png`: the official IOSH Awarding Organisation "Approved Study Centre 1003" mark.
  - Use it **only** as supplied, unaltered and uncropped, on a clear background.
  - Never use a plain IOSH logo or imply endorsement beyond "IOSH Approved Study Centre".
- `link-preview-1200x630.png`: social and link preview (live in course.link).

## Photography
- The brochure cover uses a real site photo: a worker in a hard hat and hi-vis on a construction site. The brochure PDF is the reference for that look.
- Use royalty-free photos only (Pexels, Unsplash) and record the source of each image in `brand/assets/CREDITS.md`.
- Trainer headshots are in `brand/assets/trainers/`. They are small (about 30 KB each), so display them at small sizes.

## Voice
- **Who it's written for:** enrolled students, many with English as a second language. Use plain English, short sentences and second person ("you").
- **Dale Carnegie tone:** lead with what the student gets and needs to do next. Be warm and encouraging, never pushy.
- **No em-dashes.** Use full stops, commas or colons instead.
- **No invented facts:** no testimonials, statistics or claims that aren't in `content/`.
- See `../09_Brand Assets/Writing Guidelines/Writing-Preferences-Carnegie-Principles.md`.

## Look references
- The brochure: navy bands, numbered section headers ("01 The qualification"), gold accent lines, card grids, a clean A4 rhythm.
- **Motion should feel engineered and calm:** precise reveals, line-drawing, counters and subtle parallax. Avoid gimmicky bounces.
