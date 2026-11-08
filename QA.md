# QA — version 2026-11-06.13.0

Chromium / Playwright over local HTTP, software WebGL (SwiftShader), viewport emulation. No physical device, no WebKit. SwiftShader is slow enough that the watchdog drops the journey to quality 0 (idle motion off); scroll-driven rendering still works. Frame rates on phones are not measured here.

- Journey sampled at 0 / 0.08 / 0.2 / 0.27 / 0.42 / 0.48 / 0.58 / 0.64 / 0.69 / 0.8 / 0.95 on 1440×900 and 0 / 0.2 / 0.45 / 0.6 / 0.68 / 0.8 / 0.97 on 390×844: each beat renders, copy readable, callouts placed beside their objects, numbers clear of the sculpture, finale text fits the phone width. Issues found and fixed on the way: duplicate identifier (page error), stretched edge pixels beyond the photo, giant word clipped by the left building and by the header, objects too close on phones, numbers overlapping the exploded L, finale text overflowing on phones, final CTA under the counter on phones.
- A 330-frame preview video was rendered frame by frame from the real page (1280×720) to check continuity across the cuts.
- Header "หลักสูตร" link from the top lands on #programs past the pinned section (top 105 px). Pin length 7.2 viewports. At 45 %: chapter 3 active, callouts on, back-to-top hidden.
- Keyboard: focusing the final CTA from chapter 1 scrolls to the finale and shows it.
- Reduced Motion: section static and not pinned, all six chapters visible.
- No WebGL (`--disable-webgl --disable-3d-apis`): section still pinned, chapter 4 and the sculpture poster at 62 %, no errors apart from the existing `app.js` sculpture messages.
- Home page at 1440 / 390 / 820 scrolled end to end: no horizontal overflow, no page errors. Intro still completes and unlocks the page.

---

# QA — version 2026-11-05.12.0

Chromium / Playwright over local HTTP, software WebGL (SwiftShader), viewport emulation. No physical device, no WebKit. Under SwiftShader the frame-time watchdog sometimes switches the home display case to its still frame (> 48 ms per frame); that is the intended fallback, not a bug, and says nothing about phone frame rates.

- Model grid render of all 8 objects from two angles (QA page outside the site): geometry, materials, lathe normals (teapot lid and cup interior were inverted in the first pass and fixed), no shader or console errors.
- Home display case: built when the programs section approaches, figure switches to `has-case`; hover on row 7 → fashion model, row 7 highlighted, accent `#9259d8`; keyboard focus on row 2 → digital; mouse drag spins (spin ≈ 2 rad). Phone 390×844 light/dark: model above the group name, polaroid in the corner, auto-advance running.
- Public-information seal: built when near, torn down after scrolling back to the top (context released).
- Programs turntable: next `#business → #digital`, prev wraps to `#logistics`, label link lands on the section (top ≈ 120 px below the header); hero ribbons not mounted on this page; desktop 1440 and phone 390, light and dark.
- Contact pin: terrain rise, pin drop, crest medallion visible, tag visible; light ↔ dark switch recolours the terrain without errors.
- Reduced Motion: contact pin built but static and not looping; aurora animation `none`; accent gradient static.
- No WebGL (`--disable-webgl --disable-3d-apis`): no `__LVC_OBJECTS`, no case/turntable/pin/seal elements, home programs photo at full v11.1 size (560×603). The only console errors are the existing `app.js` sculpture messages (also present in v11.1).
- Intro on a fresh load completes and unlocks the page (9.6 s under SwiftShader), no errors.
- 5 pages × 1440 / 390 / 320 (touch emulation for the phone sizes), scrolled to the end: no horizontal overflow, no page errors.
- Known console noise, same as v11.1 (checked side by side on the v11.1 files): `doc-links.js` HEAD probes for PDFs are reported as `net::ERR_ABORTED` by headless Chromium, and the 404 for the absent `student-handbook-2569.pdf`.
- Contrast: program text colours 5.48–6.71:1 (light) and 8.72–10.35:1 (dark); white/ivory text on the case backgrounds ≥ 12.9:1; every stop of the accent-heading gradient ≥ 3:1 on the light page (large text).

---

# QA — version 2026-10-26.10.0

Chromium 153 / Playwright 1.63 over local HTTP, software WebGL (SwiftShader: 0.6–0.9 s per frame while the intro, two sculptures and the backdrop run), viewport emulation. No physical device, no WebKit. v9.4 served side by side as the baseline.

- Entry scene filmed in slow motion on desktop and phone, light and dark: pale ghost → colour bleeding from the sign → full colour with the title → glide into the hero frame → curtain fade. The last intro frame and the first backdrop frame come from the same pose function, so the fade happens over an identical picture.
- Skip: real mouse click on "ข้ามฉากเปิด" during play → page unlocked in 4.0–4.9 s here (v10 before tuning: 5.5 s from click to unlock in the same environment). Hero headline, CTAs and logo fully opaque afterwards. Escape works. With `intro.js` held back by the network, a press is recorded (`aria-busy`), and the intro ends 3.0 s after the script arrives with result "กดข้าม". Reload in the same tab: measured speed 1.60×.
- Failsafes: with `intro.js` blocked the inline guard opened the page at 15.1 s and the hero was visible. A skip before the photo is ready makes the backdrop bloom in (enter 0 → 1) instead of popping in.
- WebGL: the intro context is released at the end (`WEBGL_lose_context`); 4 live contexts afterwards (2 sculptures, backdrop, metal button).
- Backdrop: draws while the hero is on screen (6–7 draws/s here, capped at 30 fps idle), 0 draws while scrolled to the news section, resumes on return, fades out during the desktop story and returns at the top, parallax on phones, tap bloom on the picture (not on text, links, buttons or the tester pill), stage colour follows light/dark, return visit from another page draws without the intro, `?no-webgl` uses the CSS picture, Reduced Motion draws once and never again.
- Showcase: active chapter copy fully on screen below the header at the centre of all six chapters on phone portrait 390×664, phone landscape 844×390, small landscape 740×360, iPad 820×1180 / 1180×820, laptop 1366×768 and 1280×720, desktop 1440×900, plus a portrait ↔ landscape rotation sequence (53 checks, 0 failures). Dial arc end vs dot: 0.0000 at every sample.
- Alive widgets: ticker next / auto-advance / pause / only the current story focusable; ribbon rows move while visible; gallery autoplay every ~6 s, ring animates, pause stops it; showcase facts count up to 8 and 3.
- v10 feature suite (intro, backdrop, theme, return visit, no-WebGL, Reduced Motion, ticker, ribbon, gallery, count-up, watchdog): 30 checks, all pass. Pre-load skip and failsafe suite: 4 checks, all pass.
- Interaction suite, 44 checks, all pass: mobile menu (rapid toggles, 5 destinations, Escape), anchors, theme, poster dialog, glass folders, rotation, programs search / empty state, desktop nav, footer back to top, keyboard Tab order (every focus target visible within 4 s; v9.4 behaves the same).
- Full audit, 4 pages × desktop / iPhone 13 / iPad portrait × light / dark: no uncaught errors, no failed requests, no horizontal overflow, no invisible content after scrolling to the end, hero visible again after Home. 0 of 24 with problems, run twice (before and after the last fixes).
- Home key from the page end, desktop: hero headline back to full opacity after ~2.1 s in both v9.4 and v10.
- Static check: every local `src` / `href` / `url()` resolves except `documents/student-handbook-2569.pdf`, absent by design since v9.2 (`doc-links.js` opens the official URL).
- Content: ticker titles, dates and links re-read on lvc.ac.th on 26 Oct 2026; the three extra service links are the ones on the college homepage (E-Service and ITA blocks). The external government sites could not be opened from this test environment.

---

# QA — version 2026-10-25.9.4

Chromium 153 / Playwright over local HTTP, software WebGL (SwiftShader), viewport emulation. No physical device, no WebKit. v9.3 was served side by side as a baseline for every comparison below.

- Back to top: from the page end, footer "กลับด้านบน", the header logo and the new floating button reach `scrollY = 0` on desktop 1440×900 and iPhone 13 emulation (v9.3: stopped at 12280 / 9823 after moving ~105px). Hero copy visible afterwards.
- Showcase chapter copy fully on screen below the header at six timeline points for phone portrait 390×664, phone landscape 844×390, small landscape 740×360, iPad 820×1180 / 1180×820, laptop 1366×768 and 1280×720, desktop 1440×900; plus a portrait↔landscape rotation sequence. v9.3 fails phone landscape, small landscape and rotation in the same script (copy at y≈400–535 on a 360–390px viewport).
- Touch :hover (forced via CDP on touch emulation, light and dark): v9.3 gallery arrow gold, program row padding 8px + red; v9.4 base styles.
- Fonts: only `.woff2` requested; `document.fonts.check` passes for Thai at 300/500.
- Full walk of 4 pages × desktop / iPhone 13 / iPad portrait: no uncaught errors, no horizontal overflow, no transparent content left in view after scrolling down and jumping back up. Mobile menu (rapid toggles, 5 destinations, Escape), theme switch, poster dialog (Escape, backdrop), glass folders (open, Escape), programs search/filter/compare, browser Back to home (no loader replay, content revealed within ~0.8 s), keyboard Tab order, Reduced Motion.
- Feedback kit: dialog opens, report copied with version/device/page, closes with Escape; pill hides and back-to-top lifts while the programs compare bar is shown.
- Loader timing identical to v9.3 (WebGL path ~14–16 s under SwiftShader for both; `?no-webgl` path 3.3 s for both). These numbers reflect software rendering, not phones.
- Known console noise kept from v9.3: one 404 from `doc-links.js` probing the absent `student-handbook-2569.pdf` (by design; it then opens the official URL).

---

# QA — version 2026-10-25.9.3

Chromium 153 / Playwright over local HTTP with software WebGL; viewport emulation only. WebKit is not available here, so the Safari fix is verified by its mechanism (timing of `pagereveal`/`viewTransition.finished`), not on an iPad.

- Reporter's iPad recording (1180×820, Spck preview, dark theme): news → programs heading rose, disappeared at the end of the page transition and rose again; same for contact. After the fix, programs/news/contact reveal only after the transition finishes (≈0.5 s after `pagereveal`); direct loads reveal immediately; arriving on home skips the transition without unhandled rejections.
- Showcase sampled at 12 timeline points at 1440×900, 1280×800, 1180×820, 820×1180 and 390×844, light and dark: correct chapter text, solo letters fully inside the frame below the header, exploded parts inside the frame, iris open/close, finale CTAs reachable. Jumping past it via the menu lands on Programs/Services correctly.
- Reduced Motion: not pinned, still sculpture centred, six chapters readable. `?no-webgl`: poster plus text sequence. Loader on desktop/mobile completes with the showcase present (second sculpture created only after it). No horizontal overflow at 320px; no uncaught errors on all four pages ×2 sizes ×2 themes.

---

# QA — version 2026-10-25.9.2

Checked with Chromium 153 / Playwright, served over local HTTP. Viewport emulation, not physical devices; software WebGL verifies state, not frame rate.

- Bugs reproduced before fixing: 13 links to the absent `student-handbook-2569.pdf` returned 404; same-site return to the home page replayed the loader; light loader set a dark `theme-color`; mobile comparison table needed horizontal scrolling to see the second program; 6px brand text at 320px.
- Handbook fallback: clicking before the availability check finishes and after it both open the official URL (with `#page=31` on the programs page); home service link and mobile menu link follow it; existing local PDFs stay local. Five present documents still match their SHA-256 records.
- Loader: first visit and reload show it (light and dark complete without errors, overlay/inert removed, theme colour restored); link from news → home skips it and plays the short entrance; desktop story scroll down/up afterwards keeps the hero heading visible.
- Subpages at 1440 and 390px, light and dark: intro and scroll reveals play once; jumping with End/Home leaves no transparent content; keyboard focus reveals immediately; Reduced Motion shows everything statically with no `pfx-on`. Final full-page screenshots match v9.1 in height (contact pixel-identical; remaining differences are balanced heading wraps).
- Theme switch circle on home (WebGL) and contact; cross-document transition programs → news with the header held in place; mobile menu curtain/×; compare bar, ✓ and mobile dialog.
- No horizontal overflow at 320px on all four pages. No uncaught JavaScript errors. JS syntax checked.

---

# QA — version 2026-10-15.9.1

Checked with TypeScript, Vite and Chromium/Playwright. Visual inspection used the actual compiled files served locally; responsive checks emulate viewport sizes rather than physical devices.

- `npm run build`: strict TypeScript checks and production Vite build passed. React and Lucide are bundled locally; the website needs no CDN or runtime npm installation. Vite source preview at `/source/` rendered three folders without missing requests or page errors.
- Glass folders at 1440, 1024, 390 and 320px: three groups/nine actions, one open folder at a time, all full document names, closed files outside the tab order, keyboard open/close, menu Home/End/Enter/Escape, theme tone updates, one-time entrance and live Reduced Motion passed. No horizontal overflow or uncaught JavaScript errors.
- Generated artwork is queued incrementally and folder mounting is deferred until near the document section. All original art presets plus the LVC recipe passed deterministic incremental generation checks.
- A blocked React bundle leaves the original working document accordions available.
- Theme tests passed 20 page/viewport combinations (four pages ×320/390/768/1024/1440px), including keyboard controls, menu bounds, live operating-system changes, manual override/reload, navigation, cross-tab sync and blocked localStorage.
- Navigation regression:32 rapid switches across363 sampled frames with no duplicate underline or wrong selected menu; hover, keyboard Enter, browser Back, manual interruption and Reduced Motion passed.
- Entry fragments for Programs, News and Public Information were checked at desktop/mobile widths after repairing late target creation. User input cancels the pending initial positioning.
- Actual software-WebGL integration in dark mode: normal loader completes and unlocks the page, hero/sculpture renders, pinned desktop scene and Programs navigation work, theme color returns to the selected dark palette, and no uncaught errors occur. This is not a real-device frame-rate measurement.
- 111 local file references resolved. All six original document files match the recorded sizes and SHA-256 hashes in `documents/sources.json`.
- The saved-program notebook is checked in print mode from a dark screen: white page, black text, no theme control or catalog toolbar. Print media disables color transitions so the preview cannot capture an intermediate theme color.
- JavaScript syntax and release ZIP contents/integrity checked.

The earlier sculpture/reveal and curriculum tests are retained below. No physical Spck/iOS device was available. Source evidence for external services remains dated in `CONTENT-SOURCES.json`; online forms and third-party services still need internet access.

---

# QA — version 2026-10-14.9

Checked with Chromium/Playwright on 2026-10-14. The v9 release keeps the v8 motion implementation and adds verified information pages and program discovery.

- All four pages at 1440, 390 and 320 CSS pixels: no horizontal overflow, empty/placeholder anchor destinations, broken loaded images or uncaught JavaScript errors.
- All 61 local link occurrences resolve to existing pages and fragment targets. Local scripts, styles and images resolved without HTTP errors. External destinations and their source evidence are recorded in `CONTENT-SOURCES.json`; the local link audit is not a guarantee of external service availability.
- Curriculum: eight groups, Thai keyword search, level filtering, empty/reset states, saved-only filtering, persistence after reload, two-group comparison, Escape close, clear selection and direct fragment links passed. A fragment target hidden by a filter is revealed before scrolling to it.
- Saved notebook: generated an A4 PDF containing only the saved digital group, its actual branches/levels, source reference and contact details. The catalog controls are excluded from print. Static curriculum remains readable when JavaScript is disabled.
- Mobile menu open/select/close, public-information accordion, gallery next/previous, full-size poster dialog, source link and Escape passed.
- Navigation: 32 rapid switches over 531 sampled frames in the isolated regression run produced no wrong active link or duplicate underline. Hover, keyboard Enter, browser Back, manual interruption and Reduced Motion passed. An earlier run alongside software WebGL hit a timing-sensitive assertion about the section reached by one wheel event; the isolated complete regression passed.
- Scroll reveals: walked all content at desktop 1440 and mobile 390 widths, then refreshed layout, resized, returned to the top and toggled Reduced Motion. No completed content became transparent; no uncaught errors.
- Actual software WebGL: normal loader completed, removed its overlay/inert lock, restored scroll behavior, revealed the hero and rendered the sculpture. The desktop pinned scene and navigation to Programs passed without uncaught JavaScript errors.
- JavaScript syntax and release ZIP integrity checked.

Physical phones, iOS Safari and Spck itself were not available for testing. Software WebGL results verify rendering and state transitions, not real-device frame rates. Information is a dated snapshot of the listed official sources; no application submission or external account operation was performed.

---

# QA — version 2026-10-13.8

Checked with Chromium/Playwright on 2026-10-13. These are browser viewport tests, not a claim of measured frame rates on physical devices.

- Navigation: all four menu destinations settle correctly. 32 rapid switches over 553 sampled animation frames produced no incorrect active link and no overlapping underline.
- Hovering other links cannot add a second underline. Keyboard Enter, browser Back, manual wheel interruption and Reduced Motion passed.
- Sculpture: scene-transform tests at 1440/1024 desktop, 390 mobile and 1100 coarse-pointer widths checked 1001 forward/reverse poses, 24 rapid scroll reversals, pointer events, bounds and Reduced Motion. Renderer calls were stubbed for these deterministic tests; the actual Three.js scene graph and scroll logic remained in use.
- At identical scroll progress, pointer-induced root shift went from up to about 10px to 0 in the transform test. Chapter holds no longer drift, and forward scroll yaw no longer reverses direction.
- Actual WebGL smoke at 1200×800 rendered opening and technical scenes successfully without uncaught JavaScript errors. Normal loader integration also passed: page unlocked, home visible, scroll restoration auto, and Programs settled at 105px below the 88px header with the desktop story pinned.
- Browser Back to an entry without a fragment cancels the old pending destination rather than retrying it.
- JavaScript syntax and release ZIP integrity checked.

Earlier .7 verification is retained below for the existing reveal, loader and interaction fixes.

---

# QA — version 2026-10-13.7

Checked 2026-10-13 with Chromium/Playwright. Tests used desktop and mobile viewport emulation; they are not physical-device Safari testing.

## Passed

- JavaScript syntax: app, scroll-fx, loader, hero-motion, metal-button, plus inline index scripts.
- Desktop 1440px and mobile 390px: scroll through services, programs, news, achievements, public information and footer; no visible-layout content remains transparent.
- Completed section reveals stay visible after ScrollTrigger refresh, resize, return to top, and Reduced Motion on/off.
- Service opacity rose monotonically from 0 to 1 over 62 sampled frames, with zero backward steps.
- Loader handoff: hero text/button opacity had zero downward jumps over 86 sampled frames. The poster-path normal load completed in about 3.4 seconds in this test environment.
- Loader: normal completion, Escape, delayed poster decode, dynamic Reduced Motion, missing loader script recovery; page unlocked, inert removed, scroll restoration reset to auto.
- WebGL desktop/mobile completed without uncaught page errors. GPU timing is not representative: this environment uses software rendering, so smoothness measurements used the poster path.
- 320px viewport and direct #programs link: no horizontal overflow, heading visible, loader skipped.
- Mobile menu, accordion, rapid gallery navigation, full-image dialog and Escape close.
- Reduced Motion at startup and five repeated live preference toggles: no duplicate listeners/shader mounts in the lifecycle checks.
- Blocked scroll-fx.js: bundled animation fallback works.
- Local asset references and ZIP integrity checked.

## Intended behavior

Ordinary page content reveals once and remains visible. Desktop hero chapters still transition with scroll by design. The local sculpture poster remains the fallback when WebGL is unavailable. Loading progress reflects readiness milestones, not downloaded bytes.

---

## Historical QA for earlier releases

# Verification — version 2026-10-11.4

## Build and files

`npm run build` passed TypeScript checking and the Vite production build. `npm run export:preview` produced the static classic-script folder and a self-contained HTML. The existing dependency set remains Vite, TypeScript, Three.js and GSAP; no React or marketplace component package was added. Vite reports the lazy sculpture chunk at 531 kB / 137 kB gzip, above its 500 kB advisory threshold. Header and Thai copy render before WebGL.

## Browser results

- **110 production checks passed** across desktop 1440×1000, tablet/touch 768×1024, mobile/touch 390×844, narrow mobile 320×812, reduced motion and WebGL fallback. Covers Thai fonts, images, one H1, no horizontal overflow, menu keyboard/focus/Escape, gallery/dialog, disclosures, anchors, all four forward/reverse scenes, pin release, console and local resource failures. See `qa/v4-production/report.json`.
- **60 rendered-motion checks passed** across mobile, tablet, wide touch, mobile reduced motion and mobile fallback. Real screenshots compare the same canvas-local area at scroll 0 → 180 → 0. Each normal touch layout changed after scrolling and returned exactly to the initial pixels on reverse. Reduced-motion and fallback images stayed stable. See `qa/v4-motion/report.json`.
- **89 portable checks passed** across static root/subfolder hosting, standard Vite subfolder hosting, standalone desktop/mobile, standalone reduced motion and standalone fallback. Standalone tests allow only the initial HTML, block all resource requests and then disable networking. Additional checks verify CTA displacement stays within 4 px, keyboard focus restores its position, and photo apertures respond to scroll. See `qa/v4-portable/report.json`.

## Visual review and focused correction

The initial desktop, tablet and mobile captures are in `qa/v4-first/`. Compared with v3, the red enamel faces, deep ivory bodies and champagne bevels give the sculpture substantially stronger contrast. A centered close-up, controlled rotation and reversible separation of its construction layers now connect the light/dark/light narrative. Compact screens retain normal document flow.

The first screenshots exposed triangular reflection streaks on the red C/L/V faces. The polish pass keeps cap normals planar while retaining smooth curved walls and bevels. It also brings all three technical themes into view sooner and coordinates intro text with the model's move to the left. The matching fallback poster was regenerated from the corrected mesh. Final screenshots and a second independent visual review found no blocking text overlap, clipped Thai marks, cropped 3D silhouettes or distorted informational posters.

Hero/background lettering share the scroll timeline. Lower sections use grouped entrances, two restrained photographic apertures and fine-pointer CTA feedback. There is no continuous decorative spin, wheel interception or extra smooth-scroll library.

## Design sources

The requested Astra Frontend Design skill was found publicly, read and applied: https://github.com/Enixes/astra-frontend-design . Applicable references were art direction, redesign, motion/interaction and quality gates.

The 21st.dev Scroll Reveal Image and Magnetic Button examples informed the interaction direction. No marketplace code/assets were copied; the implementation uses the existing TypeScript/GSAP stack. See `design-refs/v4-research.md` for exact links. The supplied MP4 reference was inspected through `design-refs/video-contact-sheet.jpg`; no watch or recording assets are used in the website.

## Reproduce

```bash
npm ci
npm run build
npm run preview
# Separate terminal; Python Playwright, Pillow and Chromium needed only for QA:
python qa/check.py --base-url http://127.0.0.1:4173 --output qa/v4-production
python qa/check-motion.py --base-url http://127.0.0.1:4173 --output qa/v4-motion
npm run export:preview
python qa/check-portable.py
```

## Genuine limits

- Physical Spck, iOS and Android devices were unavailable. Headless Chromium uses software WebGL here; no measured 60fps claim is made.
- Direct `file://` navigation was rechecked for v4 and blocked by managed Chromium with `ERR_BLOCKED_BY_ADMINISTRATOR`. No policy override was attempted. See `qa/v4-file/report.json`; standalone HTTP with all additional requests blocked passed instead.
- Reduced Motion deliberately disables animated poses/pinning. WebGL unavailability displays the matching poster. Use a modern JavaScript-capable browser or WebView.
- The procedural sculpture is conceptual, not a reconstruction of the actual campus. No campus GLB was supplied.
- Admissions links to the verified official contact page. News/program information remains a sourced snapshot; external authenticated workflows and future official-link availability are outside local checks.
- No public deployment was created and the official college website has not been changed. Upload the static ZIP contents to obtain a shareable hosted URL.


---

# Addendum — version 2026-10-11.5 (3D loader + scroll animations)

Only the loader and scroll animations were tested for this version; the earlier v4 results above were not re-run.

## What was verified (headless Chromium 141, software WebGL, virtual clock)

Because software WebGL is far too slow for real-time capture, animations were stepped with a frozen `requestAnimationFrame`/`Date.now` clock (33–50 ms steps) so every pose is deterministic.

- **35 functional checks passed, 0 failed**: loader present/inert/scroll-locked while loading (wheel and PageDown cannot scroll), finishes by itself (~5.5 s virtual), page scrolls and hero canvas shows afterwards; Skip button and Esc finish in ~1.4 s; `?noloader` and `#hash` skip the loader; Reduced Motion shows no loader / no progress bar / no marquee / no split headings and every element has opacity 1; a hidden row becomes visible when it receives keyboard focus; heading text is identical to the original at 320 / 390 / 768 / 1024 / 1440 px; no console or page errors at those widths; no horizontal overflow at those widths; a window resize during the loader still finishes; `?no-webgl` runs the poster loader and finishes; blocking `scroll-fx.js` falls back to the original built-in reveals.
- **Hand-off pixel check** (loader canvas on top of hero canvas, curtain fully transparent, 960×600): 99.8 % of pixels differed by no more than 24/255 (1,018 of 576,000 differed more, max 50/255); the differences are 1-px silhouette anti-aliasing and the ground shadow, which is double-composited while both canvases overlap. A 0.35 s cross-fade of the loader canvas was added so the shadow no longer jumps; the final cross-fade was exercised by the functional run but not re-measured pixel by pixel.
- Screenshots reviewed by eye: desktop 960×600 and 1280×800, phone 390×844, poster fallback, full-page scroll on desktop and phone, mid-animation heading masks (Thai tone marks not clipped), marquee band, achievement expansion.

## Fixes found by this testing
- News items initially slid in from the right and made the page 8 px wider than the viewport (768 px) before reveal; they now slide up instead.
- The original footer overflowed horizontally at 320 px (24 px, also present in the 2026-10-11.4 files); a small rule in `enhance.css` now lets the "follow us" row wrap.
- A safety timer (0.7 s) plays any reveal whose element has been scrolled past if ScrollTrigger misses it (e.g. End-key jump, very fast flick), so content cannot stay transparent. Checked: after an End-key jump nothing above the fold is left hidden; after a jump to mid-page only elements below the viewport are still hidden.

## Genuine limits
- No physical phone / Spck / iOS testing and **no frame-rate measurement**. The loader renders a second full-screen WebGL canvas for about 5 seconds (disposed afterwards); on very weak GPUs use `?noloader` or lower `CFG.bigScale`.
- `app.js` was patched in the build output (4 hooks, see `PATCH-NOTES.md`). The source ZIP was not supplied, so the hooks are not in any source project.
- Parallax uses the CSS `translate`/`scale` properties (Chrome/Edge 104+, Safari 14.1+, Firefox 72+); older WebViews simply skip the parallax.
- Software-WebGL timing cannot show perceived smoothness; judge the feel on a real device.



---

# Addendum — version 2026-10-13.6 (calmer loader, liquid-metal buttons, refined look, new scroll animations)

Only the work of this version was tested; the v4 results above were not re-run. Earlier .5 results that this version changed (marquee, progress bar) no longer apply.

## What was verified (headless Chromium, software WebGL)

Software WebGL is far too slow for real-time capture, so most checks use a virtual clock (frozen `requestAnimationFrame` / `performance.now` / `Date.now`, 33 ms steps). Checks that depend on real scroll events (nav highlight) run in plain real time.

**72 automated checks passed, 0 failed** (`tools/qa.py` in the working copy, not shipped in the ZIP). The final run was made against the extracted contents of the delivered ZIP; in that run one fallback-path check (scroll-fx blocked) failed because it did not wait in real time for ScrollTrigger, which lags under the virtual clock — after adding the real-time wait it passed, and the same fallback was also confirmed in a plain real-time browser run:
- **Loader:** dark screen present, `#app` inert and wheel blocked while loading; finishes by itself (~5.3 s virtual); phase order run-in → hold → return → done; ends at exactly the hero pose; theme-colour restored; page scrolls afterwards; Skip button and Esc finish in ~1.4 s; `?noloader` and `#hash` skip it; Reduced Motion shows no loader; `?no-webgl` runs the poster loader and finishes.
- **Spin amount (the "just right" request):** the model's total rotation during the whole loader is ≈ 1.9 rad ≈ 0.30 turn (the v5 loader spun about 0.76 turn per second). Test fails if it exceeds 0.6 turn or drops below 0.15 turn.
- **Metal buttons:** all three CTAs are still `<a>` links with their original `href` and label; a WebGL canvas is mounted in each (header CTA + hero CTA; the finale CTA when it nears the viewport); visible keyboard focus ring; hover state; with `?no-webgl` the shader is not mounted and the CSS rim is shown; with Reduced Motion the ripple layer is hidden.
- **Hero tilt:** the model turns toward the pointer (−0.069 / 0 / +0.076 rad, i.e. ≤ 4.4°), returns to exactly 0 when the pointer leaves, absent for Reduced Motion.
- **Scroll animations:** after jumping straight to the bottom and after a slow walk down the page, no element is left transparent, shifted or clipped; heading text is unchanged after the line split; the nav underline follows the section being read (checked in real time, including large jumps, 0.01–0.07 s latency) and clears in the hero; the gallery arrow wipe plays and finishes clean; blocking `scroll-fx.js` falls back to the original reveals with all content visible.
- **No slop left behind:** marquee, progress bar, eyebrow labels, hero breadcrumb, ghost "LVC", orbit rings, grid, 01–04 counter are all absent/`display:none`.
- **Layout:** no horizontal scrolling and no console errors at 320, 375, 390, 768, 1024, 1280 and 1440 px while walking the whole page.

## Visual review
Screenshots were reviewed at 1280×800 and 390×844 (full page walk, pinned hero scenes, loader frames, zoomed buttons, mid-animation heading masks — Thai tone marks were not clipped). An independent reviewer (a separate agent that had not seen the work being built) looked at the same images; the points it raised and that were fixed: right-hand news column left a large empty gap; "ดูภาพเต็ม" pill covered text on the poster; inactive hero chapter labels too faint (≈1.8:1); repeated placeholder sub-lines under the programme rows; footer arrows ragged; copyright text orphaning on mobile; dark crescent on the CTA rim and heavy header-button shadow; a darker strip at the right edge of the loader where a classic scrollbar gutter is reserved (verified by pixel sampling: edge colour now identical across the width); loader counter showing `0 %` then `052 %`. Points left as they are on purpose: the circular ‹ › gallery buttons and hero chapter row (functional), "+" accordion marks, the tracked small brand line (original logo lock-up, tracking reduced), external-link arrows (they mark links that leave the site).

## Fixes found by this testing
- The first nav-underline version used per-section enter/leave callbacks; jumping across several sections at once could clear the highlight (found in a real-time run). It now computes the current section from positions on every scroll update.
- The scroll-reveal safety timer (0.7 s real time) is what plays elements that a very fast jump skips; the virtual-time harness needs a real-time pause for it, which the tests now include.
- Loader background edge colour, counter padding, poster card spacing and the items in "Visual review" above.

## Genuine limits
- No physical phone / Spck / iOS / Windows testing and **no frame-rate measurement**. The loader renders a second full-screen WebGL canvas for about 5 seconds and each metal button has its own small canvas; on a very weak GPU use `?noloader` or remove `metal-button.js`.
- The scrollbar-gutter fix was verified in headless Chromium (which reserves a classic gutter), not on a real Windows machine.
- `app.js` was patched in the build output (6 hooks, see `PATCH-NOTES.md`); the source ZIP was not supplied, so the hooks are not in any source project.
- The ported button is not pixel-identical to the supplied React component by design (different colours, sizing, no 3D tilt, `<a>` instead of `<button>`).
- Copy (slogans, headings, descriptions) was not rewritten; only presentation changed.
- Software-WebGL timing cannot show perceived smoothness; judge the feel of the loader and the pointer tilt on a real device.
