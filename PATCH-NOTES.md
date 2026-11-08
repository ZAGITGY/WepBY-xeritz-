# Patch 2026-11-08.13.1 — walking pet in the bottom-left corner (Sweetie Belle)

Requested from a game screen recording (a pet roaming the bottom-left of the lobby), using the owner's Blender model (`sweetie-belle.zip`). On every page: index, programs, news, contact, 404.

## New: `lvc-pet.js` + `assets/pet/sweetie-belle.glb`
- Behaviour: idles 2.5–6 s, turns sideways and walks to a random point within ±17% of the viewport width around its home spot, turns back to face the viewer; occasional hop; blinks. Walk speed is matched to the foot slide of the clip (no skating).
- Tap/click: jump with smiling eyes, open laugh, blush and three floating hearts. Drag: picked-up pose (arms up, legs dangling, eyes squeezed), body sways with drag velocity; where it is dropped becomes the new home spot (localStorage `lvc-pet`, kept across pages and reloads, stored relative to the viewport). Hide: × button by the head (hover on desktop, shown for 3.5 s after a tap on touch screens); hidden state is remembered and only a small heart button stays bottom-left to bring the pet back (the model is not downloaded while hidden). Keyboard: the pet is focusable, Enter/Space = play, ←/→ = walk that way.
- Rendering: one small transparent canvas that moves with the pet (CSS transform), three.js r180 from `vendor/three` (same module instance as the home page), orthographic camera tilted 0.2 rad, unlit materials (the model is flat-shaded toon with inverted-hull outlines baked into the mesh), morph targets for the face. Idle renders at ~30 fps, otherwise every frame; the RAF loop does nothing while hidden. WebGL context loss removes the pet.
- Loading: after `load`, after the home intro (`html.lvc-loading`) ends, then on idle. Save-Data → not loaded (heart button only). No WebGL → nothing added. Reduced Motion → stands still (tap changes the expression, drag still works). Print → hidden. z-index 41: above the sticky header (40), below back-to-top (42) and the compare bar (45); the mobile menu is a modal `<dialog>` so it is always above.
- Asset URLs resolve from the module URL (`import.meta.url`), so the 404 page also works.

## Model build (`source/pet/`)
- `build_pet.py` (Blender 5.2 as the `bpy` Python module): removes the "Please delete" duplicates and moves the real head/pupils/highlights (offset 0.7 in the file) back into place; bakes Mirror + Solidify (outline hull) + Subdivision level 1 while keeping 8 shape keys as morph targets (`happyEyes blink smile laugh squeeze open browsUp blush`); converts materials to plain colour/texture (outline materials prefixed `OL_`), textures 1024 px WebP; authors Idle / Walk / Happy / Held by driving the rig's IK controls and exports deform bones with sampled (constraint-baked) animation.
- `make.sh`: gltf-transform dedup → prune → resample → `prune_rest.mjs` (drops channels that stay at the rest pose for the whole clip; `keep_anim_armature=False` was tried and dropped constant non-rest bones, which snapped the arms to T-pose) → meshopt. 5.4 MB raw → 1.41 MB.
- New vendored files: `vendor/three/addons/GLTFLoader.min.js`, `BufferGeometryUtils.min.js` (three.js r180, MIT) and `meshopt_decoder.module.min.js` (meshoptimizer, MIT), imports rewritten to the vendored three build.

## Rights note
The model's root bone reads "本模型由图云制作，免费提供" (made by 图云, free). The character Sweetie Belle belongs to Hasbro (My Little Pony: Equestria Girls); the modeller's "free" does not cover the character. Check before using on the college's public site.

---

# Patch 2026-11-06.13.0 — cinematic scroll journey replaces the LVC showcase

Direction from the reference video the owner sent (a product site where scrolling drives one continuous camera move): dark cinematic grade in LVC colours, the real campus photo as the fly-through scene.

## New: `lvc-journey.js` + `journey.css` (replaces `lvc-showcase.js` + `showcase.css` on the home page; old files kept for rollback)
- Pinned section (7.2 viewport heights desktop, 6.2 phone) driven by the existing GSAP ScrollTrigger (`window.__LVC`); progress is damped (exp, k = 7) and jumps larger than 0.22 snap (menu links, anchors, keyboard focus) so the camera never flies the whole path off-screen.
- Beats: (1) campus photo at dusk with a giant "VOCATIONAL" between the buildings and the sky; (2) low fly-over of the forecourt to the college sign, light dust stretched into streaks by camera velocity, black veil cut; (3) the eight program objects from `lvc-objects.js` floating above the forecourt with projected DOM callouts and SVG leader lines (callouts link to programs.html#group); (4) ivory flash, giant grey "LVC" behind a procedural LVC sculpture (red caps, porcelain sides, red/ivory base): turn, close-up, exploded letters, 8 / 3 figures; (5) dark room: floor, light pool, back-wall light slits, additive spotlight cone, SpotLight, porcelain pedestal; sculpture lands; (6) giant layered Thai "ลงมือทำ" (canvas text slices, 22 desktop / 12 phone) rises behind; CTAs.
- Campus photo depth: camera projection. A projector camera matching the photo (height 1.6, pitch 0.36 rad, vertical FOV 58°, horizon at v ≈ 0.16) casts rays; three meshes are built along those rays with depth from simple proxies (ground-plane intersection, wall depth by image region, far backdrop) and `uv` = image coordinate, so the start pose reproduces the photo exactly and parallax appears as the camera moves. A building/tree silhouette polygon (image pixels) becomes a two-channel mask (sharp / wide blur) for the sky cut, backlight glow and rim light. Outside the photo the image fades to the fog colour instead of stretching edge pixels. On screens wider than 3:2 the vertical FOV shrinks so the photo still fills the width.
- Grade (shader): split-tone (oxblood shadows, warm mids, champagne highlights) mixed with a desaturated photo, darkened sky with a warm glow behind the gap between the buildings, distance fog.
- Overlays: vignette, animated SVG film grain, black and ivory veils hiding the camera cuts, chapter copy (real DOM text, focusable; focusing a hidden chapter scrolls to it), 01–06 counter and progress bar. Back-to-top still hides during the section via `window.__LVC_SHOWCASE.trigger`.
- Performance: WebGL built within 120% of the viewport, released beyond 250%; renders only while the progress moves or idle motion is on; frame-time watchdog (> 30 ms → pixel ratio 1, > 48 ms → idle motion off); phone: pixel ratio ≤ 1.5, fewer dust particles and text slices, smaller objects.
- Fallbacks: no WebGL → still pinned, CSS-graded campus photo and the existing sculpture poster carry the story; Reduced Motion (or switching it on) → not pinned, all six chapters stacked and readable; print → hidden.
- Tester report adds the journey state (3D / still / static, quality level, position).

---

# Patch 2026-11-05.12.0 — procedural 3D models, program colours, aurora backgrounds

## New: procedural three.js models (`lvc-objects.js`, styles in `v12.css`)
- Eight program-group objects built in code (no model files): business (bars, coins, rising arrow), digital (laptop with a canvas-drawn code screen, floating cubes), arts (pen-tool nib drawing a Bézier curve), home economics (teapot, cup, saucer, steam), tourism (hotel bell, paper plane in orbit), food (red bowl, broth, chopsticks, steam), fashion (dress form, tape, spool), logistics (parcels on a pallet, looping arrow). Shared materials: porcelain/ivory clearcoat, red lacquer, champagne metal, plus one accent colour per group. Lighting is a PMREM environment built from a small emissive "softbox" scene (RoomEnvironment is not in the vendored build) plus one key light; contact shadows are radial-gradient planes (no shadow maps). Neutral tone mapping keeps the brand reds.
- Home, programs section: a "display case" replaces the photo when WebGL is ready. The case background is the group's deep colour; big outline number, group name, dots. Desktop: hovering/focusing a row swaps the model (spin out / spin in with overshoot); while scrolling, the row nearest the viewport centre drives the case; the pointer tilts the model; drag to spin with inertia. Phone/tablet (case not sticky): advances every ~4.2 s, tap = next, horizontal drag spins (vertical drag still scrolls, `touch-action: pan-y`). The real photo stays as a tilted polaroid ("ชีวิตที่ LVC") in the corner. The active row gets the group colour wash and bar.
- Programs page hero: turntable of all 8 objects (replaces the hero ribbons there via `body[data-hero3d]`). Prev/next buttons and a real link to the active group's section; auto-advance every ~4.6 s, paused while hovered/focused or for 7 s after any interaction; drag to rotate with snap; tapping an object brings it to the front, tapping the front one scrolls to its section.
- Contact page hero: a contour-line mountain relief (vertex-shader fbm ridges with a flat valley in the middle, contour lines from `fwidth`, every 5th line red) rises, then a red lacquer pin with the college crest on a champagne medallion drops in and bounces; ripples spread from its base; the camera orbits slowly and follows the pointer. Labelled on the page as an illustration, not a map. Replaces the hero ribbons on that page.
- Home, public information (≥ 901px): document stack, sweeping magnifier and a red wax seal with the crest, in the empty space beside the heading.
- Same lifecycle as the ribbons: built within 25% of the viewport, render loop only while visible and the tab is visible, everything disposed and the context released beyond 2 viewports; frame-time watchdog (90 frames: > 30 ms → pixel ratio 1, > 48 ms → still frame). Save-Data / deviceMemory ≤ 1 / Reduced Motion → still frame, no auto-advance or auto-rotation (buttons still work). No WebGL → nothing is added and the page is exactly v11.1.

## Colour (`v12.css`)
- Eight program accent colours (amber, sapphire, orchid, rose, jade, persimmon, amethyst, ocean) with separate text shades for light and dark themes, all ≥ 5.4:1 against the page background. Used in the case, turntable, row numbers and hover/active wash, programs-page index numbers, level headings and list dashes, and the separators in the home program-name marquee.
- Aurora layers (three radial-gradient blobs drifting slowly, no `filter: blur`) in Services, Public information and the sub-page intros.
- Accent heading lines (home "ที่เลือกได้", sub-page second lines) use a slowly moving red → rose → copper gradient; every stop is ≥ 3:1 on the light page (large text). Dark theme has its own lighter gradient. Print and forced-colors fall back to solid text.
- News: pointer-following glare on the featured card; secondary thumbnails zoom/tilt slightly on hover.

## Other
- `lvc-ribbons.js`: hero ribbons skip pages with `body[data-hero3d]` (programs, contact); news keeps them.
- Asset version `2026-11-05.12.0` on every page.

## Bug fixed: hero ribbons "shot upward" after tapping สมัครเรียน (reported on iPad, screen recording 2 Nov)
- Cause: `contact.html#admissions` rendered the sub-page hero ribbons at scroll 0 and started unfurling them; the browser then jumped to `#admissions` during the cross-document fade, so the half-drawn ribbons visibly slid up and away. The scroll-linked phase (`uScroll`) also jumped with the anchor scroll.
- Fix (`lvc-ribbons.js`): reveal is gated on a "settled" page (window load + ribbon transition opened + 2 frames, +450 ms without a ribbon transition) and requires ≥30% of the stage (or ¼ viewport) actually on screen. The scroll-linked phase is now damped (exponential, capped at 0.5/s), so anchor jumps and back-to-top no longer make the ribbons race.
- Second bug found while testing: at `#admissions` ~24% of the hero stage stays visible, above the old 0.2 IntersectionObserver threshold, so scrolling back up never re-fired the observer and the ribbons never unfurled. The render loop now re-checks the reveal condition every frame until it starts; thresholds widened to [0, .2, .5, .8, 1].
- Verified: home → สมัครเรียน and a direct load of `contact.html#admissions` both keep reveal = 0 through the jump; scrolling to the top afterwards unfurls once.

## Ribbon page transitions (new: `tx-head.js`, `transition.css`, `lvc-transition.js`)
- Same-origin `.html` links: a light slash crosses the screen, then 7 satin bands (ivory, champagne, red, oxblood) slide in alternately from both sides, centre first (0.85 s, staggered 65 ms), crest appears; navigation after ~1.15 s.
- Arrival: `tx-head.js` (sync in `<head>`) reads a sessionStorage flag (fresh < 8 s, matching path, not a reload) and the first `<body>` script mounts the covered state before first paint; the browser view transition is skipped. When fonts and content are ready (≥380 ms hold), the centre band slides out along the diagonal and the others part perpendicular with a soft ease (1.6 s, staggered 125 ms). `lvc:tx-open` lets `page-fx.js` and the home `lvc-return` entrance start as the bands open.
- Overlay uses `popover="manual"` when leaving so it also covers the mobile menu `<dialog>`.
- Not intercepted: same-page `#` links, external, PDF/images (doc-links.js keeps handling PDFs), `target`, `download`, modifier keys, Reduced Motion.
- Safety: bfcache `pageshow` restores (parts) a page left covered; failed navigation restores after 8 s; arrival opens itself after 6 s whatever happens.

## Touch / pointer feedback (new: `lvc-interact.js`, styles in `refine.css`)
- Ripple from the touch point on buttons, cards, rows, nav and menu items (brand red tint; light tint on red buttons).
- Touch: card tilt toward the finger while pressed; image nudge on tap; footer LVC letters wave on tap. Removed the old 0.6 opacity dim on press for those cards so the ripple reads.
- Mouse: magnetic small/primary buttons, image parallax inside frames, footer letters lean toward the pointer, sheen across primary buttons, cursor ring (difference blend) that grows over interactive elements.
- Uses individual `translate` / `rotate` / `scale` properties driven by one rAF lerp, so existing GSAP/CSS transforms and transitions are untouched. Reduced Motion: only a short static ripple.

## Checked
- Chromium (SwiftShader) recordings of home→contact (desktop), contact→programs, programs→news and phone-size touch; menu dialog → contact; Back/Forward; reload; Reduced Motion; dark; external/PDF/_blank/mailto/same-page links; ripple, tilt, magnet, parallax, cursor; text-size floor; heading reveals with wheel scrolling and instant jumps; 5 pages × 2 viewports × 2 themes with no page errors.
- Not checked on a real iPad/iPhone. iOS Safari's own view transition is skipped on arrival, which is the path the reported bug went through.

---

# Patch 2026-11-01.11.0 — new type system, layout pass, three.js silk ribbons

## Type (replaces Kanit everywhere)
- Display: Noto Serif Thai (variable wght 300–700, wdth 75–100%). Headings use weight ~460–520 at 87.5% width; accent lines (e.g. "ที่เลือกได้") switch to a light, 75%-width cut in red. Latin display words (LOEI / VOCATIONAL / COLLEGE, LEARN, the footer LVC) use the same family.
- Text and UI: IBM Plex Sans Thai 400/500/600.
- Self-hosted in `fonts/` with thai + latin unicode-range subsets (`fonts/fonts.css`), ~210 KB total. Index preloads the Thai subsets. Kanit is no longer requested on any page (checked via network log, intro included); the Kanit files stay for rollback. `404.html` moved to the new fonts.
- Visible text floor is 12px on all pages at 1440 and 390 widths (measured), except the 10px "LOEI VOCATIONAL COLLEGE" logo tagline.

## Layout (`refine.css`, loaded last on every page; no existing file rewritten)
- Home section headers: index number · label · rule that draws in with the existing `--draw` tween (re-uses the eyebrow text v9 hid). Heading left, description bottom-right; single column ≤720px.
- Programs: photo is sticky while the 8 rows scroll (desktop); serif row numbers; hover thickens the name (variable weight) and nudges it 10px. Single column ≤760px.
- Achievements: deeper oxblood, extra bottom space as a stage for the ribbons. Footer: large condensed serif LVC mark.
- Sub-pages: larger intro headings, ribbons on the right, red dashes instead of bullets in program levels.

## three.js silk ribbons (`lvc-ribbons.js`, new)
- Ribbons in the LVC sculpture materials (ivory / red / champagne) in three places: achievements (champagne on oxblood), footer (through the LVC mark), sub-page intros. One InstancedBufferGeometry + ShaderMaterial per place (one draw call); the shape is computed in the vertex shader (centre-line waves, twist, finite-difference normals), satin shading with warm shadow tint and separate front/back colours.
- Unfurls when ~20% on screen (2.8 s), flows with scroll, bulges away from the pointer / touch point.
- three.js r180 ES module in `vendor/three/` is imported only when a ribbon place is within 20% of the viewport.
- Render loop only while visible and the tab is visible; renderer disposed + context released beyond 2 viewports. Frame-time watchdog (90 frames): >30 ms → pixel ratio 1, >45 ms → still frame. Save-Data / deviceMemory ≤ 1 / Reduced Motion → one still, fully unfurled frame. No WebGL or module import failure → nothing is added. Palette follows `data-theme` live.

## Reveals
- `refine.js` (home only): section headings get a clip-path curtain on top of the existing `scroll-fx.js` lift; programs/featured-news photos open from the bottom with a slow zoom-out. Only elements below the fold at start are armed; elements passed by an anchor jump open immediately; focus, print and Reduced Motion show everything.
- Sub-pages: CSS-only curtain added to `page-fx.js` image items.

## Checked
- Chromium (SwiftShader WebGL) 1440×900 and 390×844, light and dark, all four pages: no page errors. Ribbon lifecycle verified (built/running only near the viewport, torn down far away; static under Reduced Motion). No heading stays clipped after scrolling the whole page, including anchor jumps.
- Not checked on real iOS/Android hardware.

---

# Patch 2026-10-26.10.0 — campus entry scene, living home backdrop, dial fix

## Entry scene (replaces the spinning-logo loader)
- New `intro.js`, `campus-gl.js`, `campus.css`. On a first visit or reload the home page opens on the supplied campus photo drawn as a pale "white architectural model" on paper. Colour then bleeds in like watercolour, first from the college sign, then the garden, tiled wall, left trees, flag poles and forecourt, until the whole photo is in colour. The college name rises bottom-left, a light sweep passes once, and the photo glides into the hero frame where it becomes the backdrop. The curtain fades; header, headline and LVC sculpture enter.
- One WebGL1 fragment shader on a single quad. Ghost: desaturated, frosted photo with sky tint and drifting clouds. Colour: union of up to 10 noise-warped seed blobs (domain warp, ragged edge, vertical streaks, fine feathering, pigment pooling, edge halo). Seeds grow with ease-out, then a flood stage fills the frame. The glide interpolates the intro seeds into the hero patch, so the curtain fades over an identical image.
- The percent counter follows real readiness (fonts, window load, photo, sculpture ready, backdrop drawn), not a timer. The full-colour frame holds until everything is ready, at most 9 s after the script starts.
- Skip with the "ข้ามฉากเปิด" button or Escape. The button also works before the scripts have loaded (an inline flag is picked up at start). Skipping shortens the glide, fades in 0.3 s and plays the hero entrance 2.5× faster.
- Reload in the same tab plays 1.6× faster (sessionStorage). Not shown when arriving from another page of the site, with a `#fragment`, with `?noloader`, or under Reduced Motion (same rules as the v9.2 loader).
- No WebGL, a lost context, or the photo not ready within 3.5 s: CSS version (filtered ghost image plus a circular colour reveal from the sign).
- Failsafes: `intro.js` skips itself 13 s after it starts; the inline guard in `index.html` asks for a graceful skip at 15 s and removes the curtain outright 3 s later if the intro script is stuck or never ran.
- Removed `loader.js`, the `.lvc-loader*` / loading CSS in `enhance.css` and `theme.css`, and the dark `theme-color` swap that only the old loader needed. `images/campus.webp` (1536×1024, 341 KB) is preloaded with high priority.

## Living home backdrop (`campus-backdrop.js`)
- The empty paper behind the hero now carries the campus photo as a watercolour patch behind the sculpture (right side on desktop, lower part on portrait phones). The text side stays the pale ghost so copy keeps its contrast.
- Moves all the time, gently: edges breathe, clouds drift, the photo drifts slowly, a light sweep every ~14 s. Desktop: colour bleeds around the mouse pointer. Touch: tapping empty space blooms colour from that point. Layouts without the pinned story get a slight parallax while scrolling.
- Fades out as the desktop story moves to its next scene and returns when scrolling back. Stops drawing off-screen, in hidden tabs and once fully faded. 30 fps while idle, full rate while the pointer or a tap is animating.
- Watchdog on measured frame time instead of `hardwareConcurrency` (Safari under-reports cores): average above 46 ms for 3 s or more → resolution ×0.7 at 20 fps → still image. Save-Data, `deviceMemory ≤ 1` or Reduced Motion: still image. No WebGL: CSS image with a gradient veil.
- A theme switch redraws inside the View Transition update, so the circular reveal already shows the new palette.

## Dial fix (LVC showcase finale)
- The dial line and the dot at its tip were driven by separate tweens, and Safari drew the arc wrongly (`pathLength` + `stroke-dasharray` + `vector-effect: non-scaling-stroke`). The arc path, two gold tail segments and the dot are now computed from one angle every frame (`setDial` in `lvc-showcase.js`, quantised to 0.05°). Measured gap between arc end and dot: 0.0000 px at every sampled frame. The dot has a soft pulsing halo.
- Back-to-top ring had the same Safari pattern; it now uses the real circumference (150.8) without `pathLength` or non-scaling stroke.

## The home page keeps moving after load (`alive.js` + `alive.css`, each part switchable in `CFG`)
- "ล่าสุดจากวิทยาลัย" ticker above online services: 5 items from lvc.ac.th/www2026 (checked 26 Oct 2026), next item every 4.6 s with a time bar, pause and next buttons, link to all activities. Pauses on hover, focus, off-screen and hidden tab. Only the current item is focusable.
- Three more official links under online services (ศธ.02 ออนไลน์, ศูนย์กำลังคนอาชีวศึกษา, หลักสูตรต้านทุจริตศึกษา), as linked from the college homepage.
- Program ribbon: the 8 program groups and the level words run in opposite directions; scrolling speeds them up and skews them slightly. Decorative (`aria-hidden`).
- Achievement gallery advances every 6 s with a progress ring and play/pause; pauses on hover, focus and off-screen.
- Showcase facts (8 groups, 3 levels) count up when that chapter enters.
- Reduced Motion: nothing advances by itself; the buttons still work.

## Other
- Floating back-to-top (added in v9.4) covered the "ก้าวต่อไป" chapter label in the bottom-right corner of the desktop hero story. It now stays hidden while those labels are on screen, as it already did during the showcase.
- Intro skipped before the photo was ready: the backdrop blooms in (`lvc:reveal` carries `detail.handoff`) instead of appearing at full colour.
- Backdrop redraws requested while off-screen or in a hidden tab (mobile URL-bar resizes, theme switch) are deferred to one redraw when the hero is visible again.
- `images/og-cover.jpg` (1200×630) redrawn from the campus photo with the intro shader and the site's own text.
- Feedback kit: with `CFG.lineAdmin` set (the owner's LINE add-friend link), the green button becomes "ส่งให้ผู้ดูแลทาง LINE". It copies the report inside the click and opens that LINE profile; the tester pastes it into the chat (a personal account cannot receive prefilled text). Empty `lineAdmin` restores the generic LINE share button.
- Feedback-kit reports now include how the intro ended (played / skipped / failsafe / CSS version / not shown) and the backdrop state (moving or still, quality level, average frame time).
- Asset version `2026-10-26.10.0` on every page.

---

# Patch 2026-10-25.9.4 — pre-test fixes, extra motion, tester feedback kit

## Bugs fixed
- **Logo / "กลับด้านบน" did not return to the top** (home, desktop and mobile). The three links targeted `#top`, the sticky header. Its rect top is always 0, so native anchor scrolling plus the `scroll-fx.js` destination watcher computed `scrollY - scroll-padding` and stopped ~105px up. `app.js` now links to `#app` (3 occurrences, string replacement in the bundle). Verified: footer link, header logo and floating button all reach `scrollY = 0` from the page end.
- **Landscape phones: showcase chapter copy rendered below the fold.** `.lvc-show__stage { min-height: 560px }` on a 360–390px tall viewport plus the ≤900px top/bottom layout put L/V/C copy at y≈400–530. `narrow` in `lvc-showcase.js` and the matching `showcase.css` queries are now `(max-width: 900px) and (orientation: portrait)`; a new `(orientation: landscape) and (max-height: 560px)` block removes the min-height and scales the copy. Dial finale position uses function values so it is recomputed on refresh (rotation).
- **Sticky :hover on touch devices** (gallery arrows stayed gold, program rows shifted 8px and turned red, save buttons kept a red border). `extras.css` resets those under `(hover: none)` and adds `:active` press feedback instead. Verified with forced `:hover` on touch emulation: v9.3 gold/8px/red, v9.4 unchanged base styles.
- Document-folder note said PDFs open "from the downloaded files" (wrong once hosted). Text and icon changed in `documents.js` and `source/components/lvc-documents.tsx`.
- `scroll-behavior: smooth` ignored Reduced Motion; now `auto` under `prefers-reduced-motion: reduce`.

## Performance
- Kanit 300/400/500/600 converted to WOFF2 (171 KB → 49 KB each; glyph order, cmap and every outline identical to the TTF). `@font-face` lists woff2 first with the TTF fallback; index preloads woff2.

## New
- `extras.js` / `extras.css` (each feature switchable in `CFG`): reading-progress hairline in the header; floating back-to-top with progress ring (hidden during the pinned showcase, lifted above the programs compare bar); touch press feedback; image fade-in on load (Web Animations, so existing image transitions are untouched; 9 s safety timeout); outlined "LVC" footer mark with staggered rise; desktop pointer spotlight in the achievements section; crest tilt on hover; rotating search examples on the programs page; same-origin `.html` prefetch on hover/touch (skipped on Save-Data / 2G).
- `preview-kit.js`: "ฉบับทดลอง · แจ้งปัญหา" pill and dialog. Captures `error` / `unhandledrejection` from page start (loaded synchronously in `<head>`), attaches device/browser/viewport/theme/Reduced Motion/WebGL state, copies to clipboard (with execCommand fallback for non-secure origins) or opens LINE share. Optional email / Google Form buttons via `CFG`. Nothing is sent automatically.
- `<meta name="robots" content="noindex, nofollow">`, Open Graph / Twitter card tags, `images/og-cover.jpg` (1200×630), `images/apple-touch-icon.png`, self-contained `404.html`.
- Asset version `2026-10-25.9.4` everywhere, including `style.css` which had no query string.

---

# Patch 2026-10-25.9.3 — LVC sculpture showcase and iPad transition fix

## Bug fixed
- **iPad/iPhone Safari played the subpage intro twice** when moving between programs, news and contact. Safari restarts CSS transitions that began during a cross-document View Transition when that transition ends; the reporter's iPad recording showed the heading rise, vanish and rise again. `page-fx.js` now waits for `pagereveal` → `viewTransition.finished` before revealing content (1.6 s fallback), so the page fades in once and the content enters once.
- Arriving on the home page skips the page cross-fade (`pagereveal` → `skipTransition()`, rejections silenced); the home page keeps its own entrance.

## New: LVC showcase (`lvc-showcase.js` + `showcase.css`)
A pinned, scroll-driven section between the hero story and online services, modelled on product-story sites: one object carries the whole sequence.
1. Arrival — giant LOEI / VOCATIONAL / COLLEGE rows slide in opposite directions; the sculpture turns from edge-on to front; an outline copy of VOCATIONAL passes in front of it; a thin dial draws around it.
2–4. L · LEARN, V · VOCATION, C · CREATE — each letter alone in close-up, turning with the scroll to show its depth and champagne bevel; giant outline word behind; letters change with an edge-on flip.
5. Dark room — an iris opens from the sculpture; letters, red face plates, ivory bodies and the two base plates separate like an exploded watch; structure lines glow; champagne/red silk ribbons orbit; 8 program groups / 3 levels (from the 2569 handbook data already on the programs page).
6. Reassembly — the iris closes, parts lock back, finale copy with "สำรวจหลักสูตร" and "สอบถามการสมัคร".

- Uses a second instance of the existing sculpture (`window.__LVC.createSculpture`), created only when the section is near and after the loader finishes; off-screen it does not render. Per-letter motion rotates each letter about its own centre without changing `app.js`. The instance re-applies its pose whenever the sculpture resets itself on resize.
- Desktop: copy left, object right. ≤900px (phones, iPad portrait): object top, copy bottom. Scroll length 5.4 / 4.6 viewport heights (`LENGTH`).
- Reduced Motion: no pinning; a still sculpture with all six chapters as a readable grid. No WebGL: poster image with the full text sequence. Keyboard focus on a hidden chapter scrolls to it. Not printed.
- Letter meanings and chapter copy are suggested wording built from phrases already on the site; edit them in section 1 of `lvc-showcase.js`.

Files: new `lvc-showcase.js`, `showcase.css`; edited `index.html` (assets, pagereveal), `page-fx.js`; asset version `2026-10-25.9.3`.

---

# Patch 2026-10-25.9.2 — bug fixes and motion for every page

## Bugs fixed
- **Student handbook links returned 404.** `documents/student-handbook-2569.pdf` (25.5 MB) is missing from this package, but 13 links pointed to it (home service strip, mobile menu, document folder, 9 links on the programs page). New `doc-links.js` checks each local document once (HEAD request) and, when a file is absent, opens the official college URL from `documents/sources.json` instead, including `#page=31`. Putting the PDF back into `documents/` makes every link local and offline again with no code change. Under `file://` the links stay local.
- **Returning to the home page replayed the 3D loader** (brand link, footer "กลับหน้าหลัก"). Same-site navigation now skips it and plays a short heading/menu entrance. A reload, first visit or `?loader` still shows the loader.
- **Light theme loader showed a dark mobile browser bar.** The loader colour (`#150d10`) is now applied to `theme-color` only in dark mode.
- **Mobile comparison table hid the second program** off-screen (`min-width: 510px`). Both columns now fit at 320–600px.
- **6px "LOEI VOCATIONAL COLLEGE"** under the logo at ≤360px is now hidden instead of unreadable.
- Thai headings broke awkwardly on phones ("…และความ / โปร่งใส", "…ให้ / จดจำ"). `h1`/`h2` use `text-wrap: balance` (long news titles keep normal wrapping).
- Document folders at 700–1179px left the third folder alone on the left; it is now centred.
- Link-underline sweep and a few hover transitions now respect Reduced Motion.

## Motion added (same vocabulary as the home page: drawn lines, headings rising from a cut line, short fade + lift)
- `page-fx.js` + `motion.css` section E: programs, news and contact pages had no motion. They now open with a staged intro (heading lines rise from a mask), and each section appears once while scrolling: separators draw left→right, items lift in sequence, photos settle from a slight zoom. Content passed over or focused by keyboard appears immediately. Final layout is pixel-identical to v9.1.
- Page-to-page transition (View Transitions): the page cross-fades while the header stays in place. Chrome/Edge 126+ and Safari 18.2+; other browsers change pages as before.
- Light/dark switch: the new palette spreads as a circle from the button (`theme.js` + `motion.css` section B).
- Mobile menu drops in like a curtain with staggered links, the menu button morphs into ×, the theme menu, poster and comparison dialogs ease in.
- Programs page: compare bar slides up, saved button shows an animated ✓, groups shown again after search/filter fade in, result count fades.
- Reduced Motion disables all of it. Print output is unchanged.

## Implementation notes
- Never animate elements that the desktop GSAP story also tweens (`.scene-opening h1 span`, `.scene-opening`, `.headline-line` …). GSAP records starting values when the story is built; a CSS animation in progress at that moment leaves the heading transparent. The return entrance animates the `h1` element as a whole for this reason.
- New files: `motion.css`, `page-fx.js`, `doc-links.js`. Edited: four HTML files (asset version `2026-10-25.9.2`), `theme.js`, `theme.css`, `pages.css`, `enhance.css` (v9.2 block at the end).
- A browser console may show one `404` for the handbook HEAD check while the PDF is absent; this is the availability check, not a broken page.

---

# Patch 2026-10-15.9.1 — glass document library and appearance settings

- Added the supplied React Glass Folder component as a self-hosted island in public information, with three real document groups, generated LVC artwork, Lucide icons and accessible full document names.
- Shared incremental art queue and lazy mounting keep the folder painter out of the initial hero load. One-time entrance, restrained pointer motion and live Reduced Motion preserve the existing scroll behavior.
- Added Light / Dark / System controls on all four pages, immediate preference bootstrap, persisted overrides, live system updates, cross-tab synchronization and accessible keyboard menus. Print output remains light.
- Bundled six original official documents (39,075,991 bytes) with source URLs and SHA-256 records; homepage and curriculum document links open the bundled originals.
- Included the React/TypeScript/Tailwind v4 source project, shadcn/ui configuration, component demo, locked dependencies and build instructions. The ready-to-use static website still opens through Spck Preview.
- Repaired entry fragments that were resolved before dynamically rendered sections existed. Entry positioning is cancelled if the user starts interacting.
- Preserved the existing sculpture, loader, navigation, curriculum discovery and news behavior.

---

# Patch 2026-10-14.9 — verified content and program discovery

- Replaced unfinished department destinations with a real local curriculum overview based on the college's 2569 handbook.
- Added searchable program groups, level filtering, two-group comparison, browser-local saved selections and a print/PDF notebook.
- Added static contact and news pages. No account, remote submission or fabricated registration form.
- Curated homepage actions and public documents; excluded contradictory news and placeholder destination listings. Contact and map data match the official contact page.
- Preserved v8 sculpture/scroll/navigation fixes and local poster fallback. New pages expose their content without JavaScript.
- Added source audit and a scoped roadmap from the supplied idea document. No unverified campus rooms or buildings created.

# Patch 2026-10-13.8 — navigation state and sculpture stability

- `enhance.css`: selected-only underline, immediate previous-line removal, shorter entrance, separate hover text color, and one header offset for services.
- `scroll-fx.js`: latest anchor destination stays selected during native smooth scrolling. One temporary watcher handles arrival; late hashchange cannot restart old selection. Manual wheel/key/touch cancels the previous smooth scroll. Normal scroll highlighting follows the reading line beneath the header.
- `app.js`: stable conservative sculpture framing replaces rotation-dependent per-frame bounding-box corrections. Continuous yaw and steady pitch/roll/scale retain chapter panning and the technical exploded view.
- `hero-motion.js`: pointer tilt returns toward neutral while scrolling, and applies before the renderer.
- `index.html`: asset cache version .8. All .7 repairs remain included.

# Patch 2026-10-13.7 — stable scroll and welcome motion

- `app.js`: bundled photo masks now defer to the custom scroll effects, avoiding two animations writing the same clip-path.
- `scroll-fx.js`: explicit initial states with one-time fades/lifts; one shared viewport trigger; no scrolling photo masks/parallax or achievement clipping. Visible content stays visible through refresh, resize, focus and motion preference changes. Gallery load callbacks are cancelled when superseded.
- `loader.js`: calmer sculpture entrance, shorter handoff, hero entrance prepared under the curtain, readiness-based progress, and cleanup on skip, motion changes and timeout. Restores scroll restoration after loading.
- `index.html`: welcome text, 12-second script failure recovery, cache version .7.
- `enhance.css`: welcome typography, transform-based progress sweep, stable scrollbar space and no CSS transform transition competing with the magnetic buttons.
- `hero-motion.js`, `metal-button.js`: live Reduced Motion preference handling without duplicate listeners or shader mounts.

The original content, local images/fonts, links, desktop story chapters and Spck-compatible static structure are retained. No dependencies or build step added.

---

## Historical notes for earlier releases

# PATCH-NOTES — สิ่งที่เพิ่ม/แก้จากรุ่น v4 (รุ่น 2026-10-13.6)

เว็บชุดนี้เป็นไฟล์ที่ build แล้ว (`app.js` ถูกย่อโดย Vite) ไม่มี source project แนบมา การเพิ่มทั้งหมดจึงทำเป็น **ไฟล์แยก** วางทับ/ต่อท้ายของเดิม และมี **hook เล็ก ๆ ใน `app.js` รวม 6 จุด** (เพิ่มประมาณ +700 ตัวอักษร) ถ้าต้องการย้ายไปใส่ใน source project (TypeScript) ให้ทำตามตารางนี้

## ไฟล์

| ไฟล์ | หน้าที่ | ถ้าลบออก |
|------|---------|----------|
| `loader.js` | หน้าโหลด 3D (โมเดลวิ่งเข้า → วิ่งกลับที่เดิม → หน้าเว็บค่อย ๆ โชว์) | ลบ `<div id="lvc-loader">` และสคริปต์นี้ออกจาก `index.html` เว็บเปิดตรงเลย |
| `scroll-fx.js` | อนิเมชันตอนเลื่อน (เส้นลากเข้า / หัวข้อไหลขึ้น / รูปเปิดแบบม่านยก / เมนูขีดเส้นใต้ / รูปผลงานปาดเปลี่ยน) | เว็บกลับไปใช้อนิเมชันเดิมของ `app.js` |
| `metal-button.js` + `vendor/paper-liquid-metal.js` | ปุ่มโลหะเหลว (พอร์ตจาก React component ที่ส่งมา เป็น JavaScript ล้วน) | ปุ่มกลับเป็นปุ่มเดิม |
| `hero-motion.js` | โมเดลหน้าแรกเอียงตามเมาส์ + แสงขยับตาม (เมาส์จริงเท่านั้น) | โมเดลนิ่งเหมือนเดิม |
| `enhance.css` | ทุกสไตล์ของข้างบน + งานตัดของตกแต่ง/ปรับความเรียบหรู (ไม่ได้แก้ `style.css` เดิม) | หน้าตากลับเป็นรุ่น v4 |
| `fonts/kanit-300.ttf` | Kanit น้ำหนักเบา สำหรับหัวข้อใหญ่ | หัวข้อจะใช้น้ำหนัก 400 แทน |

## hook ใน `app.js` (ทุกจุดเป็นการค้นหา-แทนที่ข้อความแบบตรงตัว ต้องเจอจุดละ 1 ที่)

| # | อยู่ที่ | ทำอะไร |
|---|---------|--------|
| 1 | ฟังก์ชัน resize/`be()` ใน `createSculpture(container)` | ถ้า `container.__lvcFrame` ถูกตั้งไว้ ให้คำนวณ "ขนาดโลก 3D" จากกรอบนั้น (กรอบของโมเดลหน้าแรก) แต่ตั้งขนาด canvas ตาม container แล้วเลื่อน frustum ของกล้อง orthographic ให้พิกเซลตรงกับของหน้าแรกเป๊ะ → canvas เต็มจอของหน้าโหลดจึงแสดงโมเดลขนาด/ตำแหน่งเดียวกับหน้าแรก ถ้าไม่ได้ตั้ง `__lvcFrame` พฤติกรรมเดิมทุกอย่าง |
| 2 | ค่าที่ `createSculpture` คืนกลับ | เพิ่ม `root` (Group หลักของโมเดล), `camera`, `invalidate()` (บังคับ render เฟรมถัดไป) |
| 3 | ท้ายโมดูล ก่อนส่งออก `createSculpture` | `window.__LVC = { gsap, ScrollTrigger, createSculpture }` |
| 4 | ฟังก์ชัน `l` ในอนิเมชัน reveal ตอนเลื่อน (`n0`) | `if (!d.length \|\| window.__LVC_FX) return;` — ถ้า `scroll-fx.js` ทำงาน (ธง `__LVC_FX` = 1 ที่ตั้งใน `index.html`) ให้ข้าม reveal ตัวเดิมเพื่อไม่ให้ซ้อนกัน |
| 5 | จุดสร้างโมเดลหน้าแรก `Wi=await r(Fs),…` | หลังสร้างเสร็จ: `window.__LVC.hero = Wi` และส่งอีเวนต์ `lvc:hero` (ให้ `hero-motion.js` เอาไปเอียงโมเดล) |
| 6 | ค่าที่ `createSculpture` คืนกลับ (ต่อจากข้อ 2) | เพิ่ม `lights: { key, fill, rim }` — ไฟสามดวงของฉาก (`hero-motion.js` ใช้ขยับไฟหลัก) |

`index.html` ตั้ง `window.__LVC_FX = 1` ก่อนโหลดสคริปต์ และ `<script src="scroll-fx.js" onerror="window.__LVC_FX=0">` จะรีเซ็ตเป็น 0 ถ้าไฟล์โหลดไม่สำเร็จ → `app.js` จะใช้อนิเมชันเดิมแทน

## อีเวนต์/ตัวแปรที่ส่วนต่าง ๆ ใช้คุยกัน

- `lvc:hero` — โมเดลหน้าแรกพร้อมแล้ว · `lvc:reveal` — หน้าโหลดเริ่มจางออก (ปุ่มโลหะเริ่มติด shader) · `lvc:loaded` — หน้าโหลดจบแล้ว
- `window.__LVC_LOADER` (อ่านอย่างเดียว) ท่า/เฟสของหน้าโหลด · `window.__LVC_LOADER_DONE` · `window.__LVC_METAL` · `window.__LVC_HERO_MOTION` — ใช้ในการทดสอบ

## ปุ่มโลหะเหลว: ต่างจากคอมโพเนนต์ต้นฉบับอย่างไร

คอมโพเนนต์ที่ส่งมาเป็น React + Tailwind + shadcn + lucide ซึ่งเว็บนี้ไม่ได้ใช้ จึงพอร์ตเป็น JavaScript ล้วนโดยใช้ไลบรารีเดียวกัน (`@paper-design/shaders` — บันเดิลเป็น `vendor/paper-liquid-metal.js` ด้วย bun, Apache-2.0)

- ยังเป็นลิงก์ `<a>` เดิม (เปิดลิงก์/คีย์บอร์ด/screen reader เหมือนเดิม) ไม่ได้เปลี่ยนเป็น `<button>`
- สีเปลี่ยนจากเทาดำ → ขอบโลหะแชมเปญ (สีเดียวกับขอบตัวอักษร 3 มิติ) + หน้าปุ่มแดงเคลือบ (ปุ่มหลักหน้าแรก) หรือสีงาช้าง (ปุ่มสมัครเรียนบน header)
- ขนาดตามความยาวข้อความ (ต้นฉบับตายตัว 142×46) · ตัดลูกศรท้ายปุ่มหลัก · ไม่มีเอฟเฟกต์เอียง 3 มิติของต้นฉบับ
- shader ติดเฉพาะตอนปุ่มเข้ามาใกล้จอ (IntersectionObserver) และหยุดเองเมื่อออกนอกจอ/แท็บถูกซ่อน
- Reduced Motion = ขอบนิ่ง ไม่ไหล · ไม่มี WebGL = ขอบไล่สีแชมเปญนิ่ง ๆ ของ CSS (ทดสอบด้วย `?no-webgl`)
- ปรับหน้าตา: ค่า `LOOK` ใน `metal-button.js` และส่วน "4) ปุ่มโลหะเหลว" ใน `enhance.css`

## ตัดอะไรออกเพื่อไม่ให้ดูเป็น "AI slop" (ทำใน `enhance.css` ไม่ได้ลบข้อความใน `app.js`)

ป้ายเล็กเหนือหัวข้อทุกที่ (ที่มีเส้น/เลข 01·02·03), ข้อความคั่นด้วยจุดกลาง (`วิทยาลัย · จังหวัดเลย`, `เรียนรู้ · ลงมือทำ · เติบโต` ที่ซ้ำ 4 ที่), ตัวหนังสือ LVC โครงเส้นและวงกลมลอยหลังโมเดล, ตารางกริด, เส้นไล่สีเหลืองแนวตั้ง, ตัวนับ 01—04 ซ้ำกับแถบบอกตอน, เลขลำดับหน้าแถวหลักสูตร (หลักสูตรไม่ใช่ลำดับขั้น), วงกลมรอบลูกศรบริการ, เหลืองสด `#f5c518` → ทองเหลืองอ่อน `#b79c5f`, คำเน้นสีเฉพาะคำเดียวในหัวข้อหลัก

ถ้าอยากเอาตัวไหนกลับ ให้ลบชื่อคลาสนั้นออกจากบล็อก "ตัดของตกแต่งที่ไม่ได้บอกข้อมูลอะไร" ใน `enhance.css` (เนื้อหายังอยู่ใน `app.js` ครบ)

## ถ้าจะ build ใหม่จาก `LVC-v4-source.zip`

1. ย้าย hook 1–6 ไปใส่ใน source (`createSculpture` ใน TypeScript และจุดสร้างโมเดลหน้าแรก)
2. คัดลอก `loader.js`, `scroll-fx.js`, `metal-button.js`, `hero-motion.js`, `enhance.css`, `vendor/`, `fonts/kanit-300.ttf` และส่วน `<head>`/`<div id="lvc-loader">` ใน `index.html` ไปไว้ใน `public/`
3. ไม่ย้าย hook = หน้าโหลด ปุ่มโลหะ และเอียงตามเมาส์ไม่ทำงาน แต่เว็บเดิมยังใช้ได้ปกติ
