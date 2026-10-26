/* LVC — stable, one-time section reveals.
 * All initial states are applied together before a timeline can play. Delayed
 * `from()` tweens must not hide content that has already appeared on screen.
 * One viewport check shares ScrollTrigger with the hero; completed reveals are
 * never rebuilt or reversed during refresh, resize or a motion preference change.
 */
(function () {
  "use strict";

  function boot() {
    var L = window.__LVC;
    if (!L || !L.gsap || !L.ScrollTrigger || window.__LVC_SCROLL_READY) return;
    window.__LVC_SCROLL_READY = true;
    var gsap = L.gsap, ST = L.ScrollTrigger;
    var motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    var pending = [], reveals = [], cleanups = [], disposed = false;
    var $ = function (selector, root) { return (root || document).querySelector(selector); };
    var $$ = function (selector, root) { return Array.prototype.slice.call((root || document).querySelectorAll(selector)); };
    var list = function (target, root) {
      if (typeof target === "string") return $$(target, root);
      return target && target.nodeType ? [target] : Array.prototype.slice.call(target || []);
    };
    gsap.registerPlugin(ST);

    function listen(target, name, handler, options) {
      target.addEventListener(name, handler, options);
      cleanups.push(function () { target.removeEventListener(name, handler, options); });
    }

    /* The starting state is separate from the timeline: a staggered child is
     * already prepared before its delay, and a refresh has nothing to rewind. */
    function reveal(box, steps) {
      if (!box || motion.matches) return;
      var viewport = window.innerHeight || document.documentElement.clientHeight;
      var rect = box.getBoundingClientRect();
      // Deep links, restored scroll positions and visible content stay visible.
      if (!rect.width || !rect.height || rect.top < viewport) return;

      var tl = gsap.timeline({ paused: true, defaults: { ease: "power3.out", duration: 0.7 } });
      var targets = [];
      steps.forEach(function (step) {
        var nodes = list(step.target, box);
        if (!nodes.length) return;
        var before = {}, after = {
          duration: step.duration || 0.7,
          stagger: step.stagger || 0,
          overwrite: "auto"
        };
        if (step.draw) {
          before["--draw"] = 0;
          after["--draw"] = 1;
          after.clearProps = "--draw";
        } else {
          // Preserve intentional CSS opacity, such as the quieter row arrows.
          var opacity = nodes.map(function (node) { return Number(getComputedStyle(node).opacity); });
          before.opacity = 0;
          after.opacity = function (index) { return opacity[index]; };
          after.clearProps = "opacity";
          if (step.y) {
            before.y = step.y;
            after.y = 0;
            after.clearProps += ",transform";
          }
        }
        gsap.set(nodes, before);
        tl.to(nodes, after, step.at || 0);
        targets = targets.concat(nodes);
      });
      if (!targets.length) { tl.kill(); return; }

      var item = { box: box, timeline: tl, played: false };
      item.show = function (immediate) {
        if (item.played && !immediate) return;
        item.played = true;
        if (immediate || motion.matches) tl.progress(1).pause();
        else tl.play();
      };
      pending.push(item);
      reveals.push(item);
    }

    function fade(target, at, stagger) { return { target: target, at: at || 0, stagger: stagger || 0 }; }
    function lift(target, at, y) { return { target: target, at: at || 0, y: y || 16, duration: 0.8 }; }
    function draw(target, at) { return { target: target, at: at || 0, draw: true, duration: 0.85 }; }

    reveal($(".services"), [fade(".services-header > *", 0, 0.04), fade(".service-link", 0.08, 0.05)]);
    $$(".section-heading").forEach(function (box) {
      reveal(box, [lift("h2", 0), fade(box.querySelectorAll(":scope > p, :scope > a"), 0.1), draw(box, 0.1)]);
    });
    reveal($(".program-image"), [lift(".program-photo", 0, 20), fade(".photo-caption", 0.12)]);
    $$(".program-row").forEach(function (box) { reveal(box, [fade(box.children, 0, 0.04), draw(box, 0.04)]); });
    reveal($(".program-footer"), [fade($(".program-footer"))]);

    reveal($(".featured-news"), [lift(".image-wrap", 0, 18), fade(".news-meta, h3, .read-more", 0.1, 0.06)]);
    $$(".news-item").forEach(function (box) { reveal(box, [fade(box.children, 0, 0.04), draw(box, 0.04)]); });
    reveal($(".all-news-mobile"), [fade($(".all-news-mobile"))]);

    reveal($(".achievement-layout > div:first-child"), [
      lift("h2", 0), fade(":scope > p, .text-link, .gallery-controls", 0.12, 0.06)
    ]);
    reveal($(".gallery-viewport"), [lift(".poster-button", 0, 18), fade(".poster-caption", 0.12)]);
    reveal($(".public-layout > div:first-child"), [lift("h2", 0), fade(":scope > p", 0.12)]);
    $$(".public-links details").forEach(function (box) { reveal(box, [fade("summary"), draw(box, 0.04)]); });
    $$(".footer-top > div").forEach(function (box) { reveal(box, [fade(box)]); });
    reveal($(".footer-bottom"), [fade(":scope > *", 0, 0.04), draw($(".footer-bottom"), 0.04)]);

    var header = $(".site-header");
    var navs = $$(".desktop-nav a").map(function (link) {
      var section = link.hash && document.getElementById(link.hash.slice(1));
      return section ? { link: link, section: section } : null;
    }).filter(Boolean);
    var current = null, navigation = null, navigationFrame = 0;
    function setCurrent(link) {
      if (link === current) return;
      navs.forEach(function (item) {
        item.link.classList.toggle("is-current", item.link === link);
        if (item.link === link) item.link.setAttribute("aria-current", "location");
        else item.link.removeAttribute("aria-current");
      });
      current = link;
    }

    // Native anchor scrolling keeps browser history, focus and Reduced Motion.
    // While it travels, keep the latest destination selected instead of lighting
    // every section it passes. A single watcher always reads the latest request.
    function watchNavigation() {
      navigationFrame = 0;
      if (disposed || !navigation) return;
      var now = performance.now(), y = window.scrollY;
      if (Math.abs(y - navigation.lastY) > 0.5) {
        navigation.lastY = y;
        navigation.changedAt = now;
      }
      var idle = now - navigation.changedAt > 180 && now - navigation.startedAt > 220;
      var padding = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
      var margin = parseFloat(getComputedStyle(navigation.section).scrollMarginTop) || 0;
      var targetY = Math.max(0, Math.min(
        document.documentElement.scrollHeight - window.innerHeight,
        navigation.section.getBoundingClientRect().top + y - padding - margin
      ));
      if (idle && Math.abs(y - targetY) > 3 && !navigation.retried) {
        // Rapid native fragment changes can cancel a pending scroll before its
        // destination. Resume only the latest request, never an older callback.
        navigation.retried = true;
        navigation.changedAt = now;
        navigation.section.scrollIntoView({ behavior: motion.matches ? "instant" : "smooth", block: "start" });
      } else if ((idle && Math.abs(y - targetY) <= 3) || now - navigation.startedAt > 4000) {
        navigation = null;
        update();
        return;
      }
      navigationFrame = requestAnimationFrame(watchNavigation);
    }
    function selectDestination(section) {
      if (!section) return;
      var item = navs.find(function (entry) { return entry.section === section; });
      var now = performance.now();
      navigation = { section: section, link: item ? item.link : null, startedAt: now, changedAt: now, lastY: window.scrollY, retried: false };
      setCurrent(navigation.link);
      if (!navigationFrame) navigationFrame = requestAnimationFrame(watchNavigation);
    }
    function releaseNavigation() {
      if (!navigation) return;
      navigation = null;
      cancelAnimationFrame(navigationFrame);
      navigationFrame = 0;
      // Stop the in-flight native smooth scroll before the wheel/key/touch
      // default action runs, so it cannot pull the user back to the old target.
      window.scrollTo({ left: window.scrollX, top: window.scrollY, behavior: "instant" });
      update();
    }
    function hashTarget(hash) {
      try { return hash && document.getElementById(decodeURIComponent(hash.slice(1))); }
      catch (error) { return null; }
    }
    function update() {
      if (disposed) return;
      var viewport = window.innerHeight || document.documentElement.clientHeight;
      var remaining = [];
      pending.forEach(function (item) {
        if (item.played) return;
        var rect = item.box.getBoundingClientRect();
        if (rect.top <= viewport * 0.94) item.show(rect.bottom <= 0);
        else remaining.push(item);
      });
      pending = remaining;
      if (header) header.classList.toggle("is-scrolled", window.scrollY > 8);
      if (navigation) { setCurrent(navigation.link); return; }
      var scrollPadding = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
      var readingLine = Math.max(header ? header.getBoundingClientRect().bottom : 0, scrollPadding) + 24;
      var atBottom = window.scrollY + viewport >= document.documentElement.scrollHeight - 2;
      var hit = null;
      navs.forEach(function (item) {
        var rect = item.section.getBoundingClientRect();
        if (rect.top <= readingLine && rect.bottom > readingLine) hit = item.link;
        // A short last section cannot always reach the header before page end.
        if (atBottom && rect.top < viewport && rect.bottom > readingLine) hit = item.link;
      });
      setCurrent(hit);
    }

    var viewportTrigger = ST.create({ start: 0, end: "max", onUpdate: update, onRefresh: update });
    update();
    listen(document, "focusin", function (event) {
      // Keyboard focus must never land on a transparent button or link.
      reveals.forEach(function (item) { if (item.box.contains(event.target)) item.show(true); });
      pending = pending.filter(function (item) { return !item.played; });
    });
    listen(document, "click", function (event) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      var link = event.target.closest && event.target.closest('a[href^="#"]');
      if (!link || link.hasAttribute("download") || (link.target && link.target !== "_self")) return;
      selectDestination(hashTarget(link.hash));
    });
    // A late hashchange from a previous click must not restart its selection.
    listen(window, "hashchange", update);
    listen(window, "popstate", function () {
      // Back to an entry without a fragment must cancel the old destination
      // too, while leaving the browser free to restore its own scroll position.
      navigation = null;
      cancelAnimationFrame(navigationFrame);
      navigationFrame = 0;
      selectDestination(hashTarget(location.hash));
      update();
    });
    listen(window, "wheel", releaseNavigation, { passive: true });
    listen(window, "touchstart", releaseNavigation, { passive: true });
    listen(window, "keydown", function (event) {
      if (!event.defaultPrevented && /^(ArrowUp|ArrowDown|PageUp|PageDown|Home|End| )$/.test(event.key)) releaseNavigation();
    });
    listen(window, "pageshow", update);
    listen(window, "lvc:loaded", update);

    /* The previous gallery wipe hid the image before it had loaded, and old
     * load callbacks could restart it after rapid clicks. Keep the current
     * image visible while loading; only animate the latest completed source. */
    var gallery = $("#gallery-image"), galleryTween = null, cancelGalleryLoad = null;
    if (gallery && window.MutationObserver) {
      var sequence = 0;
      var observer = new MutationObserver(function () {
        var version = ++sequence;
        if (cancelGalleryLoad) cancelGalleryLoad();
        if (galleryTween) { galleryTween.progress(1).kill(); galleryTween = null; }
        function clearLoad() {
          gallery.removeEventListener("load", ready);
          gallery.removeEventListener("error", clearLoad);
          cancelGalleryLoad = null;
        }
        function ready() {
          clearLoad();
          if (disposed || motion.matches || version !== sequence || !gallery.naturalWidth) return;
          galleryTween = gsap.fromTo(gallery, { opacity: 0.72 }, {
            opacity: 1, duration: 0.4, ease: "power2.out", clearProps: "opacity", overwrite: "auto"
          });
        }
        if (gallery.complete && gallery.naturalWidth) ready();
        else {
          gallery.addEventListener("load", ready, { once: true });
          gallery.addEventListener("error", clearLoad, { once: true });
          cancelGalleryLoad = clearLoad;
        }
      });
      observer.observe(gallery, { attributes: true, attributeFilter: ["src"] });
      cleanups.push(function () { observer.disconnect(); if (cancelGalleryLoad) cancelGalleryLoad(); });
    }

    function settleMotion() {
      if (!motion.matches) return;
      reveals.forEach(function (item) { item.show(true); });
      pending = [];
      if (galleryTween) { galleryTween.progress(1).kill(); galleryTween = null; }
    }
    if (motion.addEventListener) listen(motion, "change", settleMotion);
    else if (motion.addListener) {
      motion.addListener(settleMotion);
      cleanups.push(function () { motion.removeListener(settleMotion); });
    }
    listen(window, "pagehide", function (event) {
      // A back/forward cache restore must return to visible, settled content.
      reveals.forEach(function (item) { item.show(true); });
      pending = [];
      navigation = null;
      cancelAnimationFrame(navigationFrame);
      navigationFrame = 0;
      if (event.persisted) return;
      disposed = true;
      viewportTrigger.kill();
      reveals.forEach(function (item) { item.timeline.kill(); });
      if (galleryTween) galleryTween.kill();
      cleanups.forEach(function (cleanup) { cleanup(); });
    });
    // The page sections are injected by app.js. Native fragment navigation can
    // run before those targets exist; resolve the entry link once layout is ready.
    var entryHash = location.hash, entryInterrupted = false;
    function interruptEntry() { entryInterrupted = true; }
    ["pointerdown", "touchstart", "wheel", "keydown"].forEach(function (name) {
      listen(window, name, interruptEntry, { once: true, passive: true });
    });
    function readyLayout() {
      if (disposed) return;
      ST.refresh();
      var target = !entryInterrupted && location.hash === entryHash && hashTarget(entryHash);
      if (!target) return;
      requestAnimationFrame(function () {
        if (disposed || entryInterrupted || location.hash !== entryHash) return;
        selectDestination(target);
        target.scrollIntoView({ behavior: "instant", block: "start" });
        update();
      });
    }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(readyLayout).catch(readyLayout);
    else readyLayout();
  }

  if (window.__LVC) boot();
  else document.addEventListener("DOMContentLoaded", boot, { once: true });
})();
