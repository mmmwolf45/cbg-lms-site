# Art direction: the CBG photo series

**Task:** T8 in `PLAN.md`. **For:** Maasoom, generating images in ChatGPT.
**Goal:** a small set of AI images that look like one deliberate series, the way The Generalist's marble statues do. Every image shares one look, so the site feels art-directed rather than assembled from stock.

## The look: "Engineered dusk"

| | Direction |
|---|---|
| **World** | Gulf industrial and construction sites: steel frames, pipe racks, scaffolding, refinery towers. The same world as the brochure cover, but shot as cinema rather than as an advert. |
| **Time and light** | Blue hour, just after sunset. A deep navy sky does most of the work. The only warm light comes from work lights and sodium lamps, which glow gold. Navy plus gold is our brand. |
| **Colour** | Almost monochrome navy and slate, with gold highlights. No other strong colours. Hi-vis vests read as muted yellow-green, not neon. |
| **Composition** | Precise and architectural. Strong straight lines, clear silhouettes, lots of empty sky or shadow for text to sit on. |
| **People** | Optional, small in the frame, seen from behind or in silhouette. No close-up faces. This keeps the series calm and avoids anyone looking like a real, identifiable person. |
| **Mood** | Calm, competent, quietly impressive. Never dramatic disaster imagery. |
| **Never** | Text, signs, logos, company names, brand marks, watermarks, lens flare, HDR haze, fantasy elements, unsafe practice (except in the Hazard Scan image, where it is the point). |

## How to generate (read once)
1. Use **one ChatGPT conversation** for the whole series, so it stays consistent. Paste the **style block** first, then each image prompt in turn.
2. Choose **landscape (1536 × 1024)** for every image. I make the phone crops, so you only generate each image once.
3. If an image comes back with text, signs or logos, reply "Remove all text, signs and logos, keep everything else identical."
4. Download the PNG at full size and save it in `brand/assets/photos/` with the exact file name given below. Put them in that folder, or send them in chat and I'll file them.
5. Generate two or three versions of each image if you like, and send the best. I'll check each one for alignment and readability before we use it.

## Style block (paste this first)

```
For this whole conversation, every image must follow this style exactly.

Style: cinematic architectural photography, shot on a full-frame camera with a 35mm lens, at blue hour just after sunset in the Gulf (Qatar). The sky is a deep, clean navy blue gradient. The scene is lit only by warm golden work lights and sodium lamps, which create gold highlights on steel and concrete. Overall palette: deep navy, slate grey and warm gold; muted and premium, no other strong colours. Sharp, precise, calm and quietly impressive. Strong straight lines and clear silhouettes. Natural, realistic detail, no HDR look, no haze, no lens flare.

Never include: any text, letters, numbers, signs, logos, brand names, watermarks or flags. No close-up faces; any people are small, seen from behind or in silhouette.

Reply "Ready" and wait for my first image prompt.
```

---

## Image 1: Home hero, "the structure"
**File name:** `hero-structure.png` · **Used on:** home page hero ("Blueprint to built"). I trace gold blueprint lines over this photo, so its edges must be crisp and readable.

```
Image 1 of the series, landscape 1536 x 1024.

A steel-frame building under construction, about eight storeys tall, standing alone on a clean, flat, finished site. Show the exposed structural steel grid (columns, beams and a few diagonal braces) as a clear, crisp geometric silhouette against the navy blue-hour sky. Two or three floors near the bottom have concrete slabs and warm golden work lights glowing inside; the upper floors are bare steel frame. One tower crane stands beside it, also a clean silhouette.

Camera: a slightly low, three-quarter view from the front-left, so two faces of the building are visible with straight, readable perspective lines. The whole building and crane sit in the right two-thirds of the frame, fully inside the image with clear sky around them. The left third is mostly calm, empty navy sky and dark ground, with no objects, so text can sit there.

The ground is dark, clean and uncluttered. No people, no vehicles, no scaffolding sheeting, no clutter in front of the structure.
```

**What I check:** every edge of the frame is distinct (not blurred or hidden by lights); the building is fully in frame; the left third is empty; a 4:3 crop around the building still works for phones.

---

## Image 2: Course page hero, "the worksite" (Hazard Scan)
**File name:** `hazard-worksite.png` · **Used on:** IOSH course page hero. A gold scan line sweeps this image and tags each hazard, so each hazard must be **obvious at phone size** and in **its own area of the frame**.

```
Image 2 of the series, landscape 1536 x 1024. Same style, but the site is well lit by bright golden floodlights so every detail is clearly visible.

A busy but tidy construction site at the ground floor and first floor of a concrete building, seen from a slightly raised, wide view. The scene must contain exactly these six safety hazards, each clearly visible and each in a different part of the image, not overlapping:
1. Top left: a raised first-floor slab edge with no guardrail, and a worker seen from behind standing close to the open edge.
2. Top right: an aluminium ladder leaning against the slab, set at a steep, unsafe angle and not tied off, with no one holding it.
3. Centre: an orange extension cable lying across the main walkway, trailing loosely across the path.
4. Bottom left: a tall, uneven stack of cement bags and timber on a pallet, leaning noticeably as if it could topple.
5. Bottom centre: an open, unprotected trench in the ground with no barrier or cover around it.
6. Bottom right: a worker, seen from the side or behind, cutting with an angle grinder while wearing a hard hat but no eye protection, sparks flying.

Everything else on the site looks orderly. People are small, seen from behind or the side, faces not visible. All hard hats are plain white with no markings. No text, signs, logos or numbers anywhere.
```

**What I check:** all six hazards are present, separated and readable when the image is only 390px wide.
**Then:** I draft a short label for each hazard. Those labels go to a CBG trainer for sign-off before launch.
**If ChatGPT can't get all six right:** four clear ones are enough. Tell me which four came out well.

---

## Image 3: Closing band, "the plate"
**File name:** `closing-plate.png` · **Used on:** the closing "help" band on the course page and behind the support section on the home page. It sits behind text, so it must be calm and mostly empty.

```
Image 3 of the series, landscape 1536 x 1024.

A wide, calm view across a finished industrial site at blue hour: the silhouette of a pipe rack and a row of distant process towers runs low along the bottom fifth of the frame, with a few small golden lights. Everything above that is open, deep navy sky with a very soft gradient, completely empty: no birds, no clouds with strong shapes, no stars, no aircraft.

Very low contrast and calm, so white text can sit on top of the sky. No people, no text, no signs, no logos.
```

**What I check:** white text over the top four-fifths passes contrast. I'll also darken it slightly in code if needed.

---

## Optional, Image 4: Course card, "the classroom"
**File name:** `course-card-iosh.png` · **Used on:** the IOSH card in "Your courses" on the home page. Only needed if the chosen visual direction in T7 uses card images. **Wait for my go-ahead before making this one.**

```
Image 4 of the series, landscape 1536 x 1024.

A close, quiet still life on a steel site table at blue hour: a plain white hard hat with no markings, a folded hi-vis vest, a clipboard with a blank page, and a laptop with its screen glowing softly (screen content blurred and unreadable). Warm golden light from one side, deep navy shadows. Shallow depth of field. No text, letters, logos or readable screens anywhere.
```

---

## After you generate
| File | Where | What happens next |
|---|---|---|
| `hero-structure.png` | `brand/assets/photos/` | I check it, trace the blueprint lines, make the phone crop (T15) |
| `hazard-worksite.png` | `brand/assets/photos/` | I check it, map the hotspots, draft the hazard labels for trainer sign-off (T22) |
| `closing-plate.png` | `brand/assets/photos/` | Used in the support and help bands |

Each image gets a row in `brand/assets/CREDITS.md`: "Generated with ChatGPT for CBG". The image pipeline (T10) makes AVIF, WebP and JPEG versions within the size budget, so the PNG sizes don't matter.
