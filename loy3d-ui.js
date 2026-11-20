/* ============================================================================
 * loy3d-ui.js — ปุ่ม/แผงควบคุมของแม่น้ำ 3D (โหลดพร้อม loy3d.js ตอนเลื่อนใกล้ section)
 *   แม่น้ำ: ปุ่ม "แต่งกระทงของคุณ" · การ์ดคำอธิษฐาน + แจ้งซ่อน
 *   หน้าแต่งกระทง = โหมดเต็มจอ (ล็อกการเลื่อน · ซ่อนน้องและเนื้อหาเว็บข้างหลังด้วย inert) เข้า/ออกด้วย GSAP ~0.5 วิ
 *     ครึ่งบน: กระทงบนน้ำมืด ลากหมุนดูได้ · ครึ่งล่าง: bottom sheet สูงคงที่ (กระทงไม่ขยับตอนเปลี่ยนขั้น)
 *     ขั้น 1 ฐาน (+ เริ่มจากไอเดีย) → 2 แต่ง (ถาดของแต่งเลื่อนแนวนอน · แตะชิ้นที่วางแล้ว = จุดสี + ขนาด + หมุน + ลบ) → 3 ลอย
 *   คีย์บอร์ด: ปุ่มของแต่ง = วางทันที · ฉากกระทงรับ Tab ได้ (ลูกศรซ้าย/ขวาเลือกชิ้น · Delete ลบ) · Esc ปิด
 * ============================================================================ */
import { createRiver3D } from "./loy3d.js?v=2026-11-22.2";
import * as M from "./loy-models.js?v=2026-11-22.1";

const L = window.__LVC || {};
const gsap = L.gsap || null;
const reduceQ = matchMedia("(prefers-reduced-motion: reduce)");
const DUR = 0.5;                                   // เข้า/ออกโหมดเต็มจอ
// ลำดับในถาด: ดอกไม้ก่อน (ใช้บ่อย) · เทียน/ธูปมีให้ตั้งแต่เริ่มอยู่แล้ว ไว้ท้ายถาด
const TRAY = ["marigold", "chrysanthemum", "orchid", "rose", "jasmine", "lotus_bud", "candle", "incense"].map((id) => M.ITEM_INDEX[id]);
const BASE_ORDER = [1, 0, 2];                      // ดอกบัวก่อน (สวยสุด) · เลขฐานยังเป็นเลขเดิมที่บันทึก
const ICON = {
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>',
  next: '<path d="M4 12h15M13 5l7 7-7 7"/>',
  flame: '<path d="M12 3c3.2 3.6 4.6 6.6 4.6 9.4A4.6 4.6 0 0 1 12 17a4.6 4.6 0 0 1-4.6-4.6C7.4 9.6 8.8 6.6 12 3Z"/><path d="M12 17v4"/>',
};
const svg = (k) => `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICON[k]}</svg>`;

export function mount(stage, data, S) {
  const $ = (s, el = stage) => el.querySelector(s);
  const startBtn = $(".loy3d__start"), startLabel = $(".loy3d__start .loy__send-label");
  const panel = $(".loy3d__panel"), poster = $(".loy3d__poster"), canvas = $(".loy3d__gl");
  let step = 1;

  /* ---------- การ์ดคำอธิษฐาน ---------- */
  function fillCard(el, k) {
    el.querySelector(".loy__card-mine").hidden = !k.mine;
    el.querySelector(".loy__card-wish").textContent = k.wish;
    el.querySelector(".loy__card-name").textContent = "— " + (k.name || "ไม่ระบุชื่อ");
    el.querySelector(".loy__card-time").textContent = S.ago(k.at);
    el.querySelector('[data-act="report"]').hidden = !!(k.mine || k.local);
    el.querySelector(".loy__card-confirm").hidden = true;
    el.querySelector(".loy__card-main").hidden = false;
  }
  function bindCard(el, getBoat, close) {
    el.addEventListener("click", (e) => {
      const act = e.target.closest("[data-act]");
      if (!act) return;
      const b = getBoat();
      if (act.dataset.act === "close") close(true);
      else if (act.dataset.act === "report") { el.querySelector(".loy__card-confirm").hidden = false; el.querySelector(".loy__card-main").hidden = true; el.querySelector('[data-act="report-yes"]').focus(); }
      else if (act.dataset.act === "report-no") { el.querySelector(".loy__card-confirm").hidden = true; el.querySelector(".loy__card-main").hidden = false; el.querySelector('[data-act="report"]').focus(); }
      else if (act.dataset.act === "report-yes" && b) { close(false); data.report(b.k.id); startBtn.focus({ preventScroll: true }); }
    });
    document.addEventListener("pointerdown", (e) => { const b = getBoat(); if (b && !el.contains(e.target) && !b.el.contains(e.target) && !canvas.contains(e.target)) close(false); });
  }

  /* ---------- bottom sheet ---------- */
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "true");
  panel.setAttribute("aria-label", "แต่งกระทง");
  panel.innerHTML = `
  <div class="lb__top">
    <ol class="lb__steps" aria-label="ขั้นตอนแต่งกระทง">
      <li data-step="1">ฐาน</li><li data-step="2">แต่ง</li><li data-step="3">ลอย</li>
    </ol>
    <div class="lb__icons">
      <button class="lb__icon" type="button" data-act="undo" aria-label="ย้อนกลับ" disabled>${svg("undo")}</button>
      <button class="lb__icon" type="button" data-act="close-builder" aria-label="ปิดการแต่งกระทง">${svg("close")}</button>
    </div>
  </div>
  <div class="lb__body">
    <section class="lb__step" data-step="1" aria-labelledby="lb-h1">
      <h3 class="lb__h" id="lb-h1">เลือกฐานกระทง</h3>
      <div class="lb__bases" role="radiogroup" aria-labelledby="lb-h1">
        ${BASE_ORDER.map((i) => { const b = M.BASES[i]; return `<button type="button" role="radio" aria-checked="${i === 1}" data-base="${i}"><img src="${M.thumb("base-" + b.id)}" alt="" width="72" height="72" decoding="async"><b>${b.name}</b><small>${b.note}</small></button>`; }).join("")}
      </div>
      <p class="lb__hint lb__hint--left">ยังไม่รู้จะแต่งแบบไหน กด “เริ่มจากไอเดีย” แล้วปรับต่อได้</p>
    </section>
    <section class="lb__step" data-step="2" aria-labelledby="lb-h2" hidden>
      <h3 class="lb__h" id="lb-h2">แต่งกระทง <span class="lb__count"></span></h3>
      <div class="lb__tray" role="group" aria-label="ของแต่ง แตะเพื่อวางบนกระทง">
        ${TRAY.map((k) => `<button type="button" data-item="${k}"><img src="${M.thumb(M.ITEMS[k].id)}" alt="" width="48" height="48" decoding="async"><span>${M.ITEMS[k].name}</span></button>`).join("")}
      </div>
      <div class="lb__edit">
        <p class="lb__hint">แตะของแต่งเพื่อวางบนกระทง<br>แตะชิ้นบนกระทงเพื่อเปลี่ยนสี ขนาด หรือมุม</p>
        <div class="lb__sel" hidden>
          <div class="lb__sel-row">
            <div class="lb__swatches" role="radiogroup" aria-label="สี"></div>
            <b class="lb__sel-name"></b>
            <button type="button" class="lb__icon lb__del" data-act="delete" aria-label="ลบชิ้นนี้">${svg("trash")}</button>
          </div>
          <label class="lb__slider"><span>ขนาด</span><input type="range" data-edit="s" min="60" max="160" step="5"></label>
          <label class="lb__slider"><span>หมุน</span><input type="range" data-edit="r" min="-180" max="180" step="5"></label>
        </div>
      </div>
    </section>
    <section class="lb__step" data-step="3" aria-labelledby="lb-h3" hidden>
      <h3 class="lb__h" id="lb-h3">ฝากคำอธิษฐาน</h3>
      <div class="loy__field lb__field">
        <label for="lb-wish">คำอธิษฐาน</label>
        <textarea id="lb-wish" maxlength="80" rows="2" placeholder="ขอให้…" aria-describedby="lb-wish-n"></textarea>
        <span class="loy__n" id="lb-wish-n" aria-hidden="true">0/80</span>
      </div>
      <div class="loy__field lb__field">
        <label for="lb-name">ชื่อ <small>(ไม่ใส่ก็ได้)</small></label>
        <input id="lb-name" maxlength="20" autocomplete="nickname" aria-describedby="lb-name-n">
        <span class="loy__n" id="lb-name-n" aria-hidden="true">0/20</span>
      </div>
      <p class="loy__error lb__err" role="alert"></p>
      <div class="lb__rite">
        ${svg("flame")}
        <span class="lb__rite-text">แตะไส้เทียนบนกระทงเพื่อจุดไฟ</span>
        <button type="button" class="lb__light" data-act="light">จุดเทียน</button>
      </div>
    </section>
  </div>
  <div class="lb__nav">
    <button type="button" class="lb__btn lb__idea" data-act="idea"><img alt="" width="32" height="32" decoding="async"><span>เริ่มจากไอเดีย</span></button>
    <button type="button" class="lb__btn lb__back" data-act="back">ย้อน</button>
    <button type="button" class="loy__send lb__next" data-act="next-step"><span class="loy__send-label">ถัดไป</span>${svg("next")}</button>
    <button type="button" class="loy__send lb__pray" hidden aria-describedby="lb-pray-help">
      <svg class="lb__ring" viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="15"/><circle class="lb__ring-fill" cx="18" cy="18" r="15" pathLength="1"/></svg>
      <span class="loy__send-label">กดค้างไว้เพื่ออธิษฐาน</span>
    </button>
    <span class="lb__sr" id="lb-pray-help">กดปุ่มนี้ค้างไว้ (หรือกด Space ค้างไว้) จนวงเต็ม แล้วปล่อยเพื่อลอยกระทง</span>
  </div>
  <p class="lb__msg" role="status" aria-live="polite"></p>`;
  const msgEl = $(".lb__msg", panel), countEl = $(".lb__count", panel), selBox = $(".lb__sel", panel), hintEl = $(".lb__edit .lb__hint", panel);
  const swatches = $(".lb__swatches", panel), selName = $(".lb__sel-name", panel), ideaImg = $(".lb__idea img", panel);
  const sizeIn = $('[data-edit="s"]', panel), rotIn = $('[data-edit="r"]', panel);
  let msgT = 0;
  function say(t) {
    msgEl.textContent = t;
    msgEl.classList.toggle("is-on", !!t);
    clearTimeout(msgT);
    if (t) msgT = setTimeout(() => { msgEl.textContent = ""; msgEl.classList.remove("is-on"); }, 3200);
  }
  const syncIdea = () => { ideaImg.src = M.thumb("preset-" + M.BASES[R.build.base].id); };

  const api = {
    fillCard, bindCard,
    canMove: () => step === 2,
    onParts(n) {
      countEl.textContent = `${n}/${M.MAX_PARTS} ชิ้น`;
      panel.querySelectorAll("[data-item]").forEach((b) => { b.disabled = n >= M.MAX_PARTS; });
    },
    onHistory(n) { $('[data-act="undo"]', panel).disabled = !n; },
    onLimit() { say(`วางได้ไม่เกิน ${M.MAX_PARTS} ชิ้น ลบบางชิ้นก่อนนะ`); },
    onSelect(info) {
      selBox.hidden = !info; hintEl.hidden = !!info;
      if (!info) return;
      const p = info.part, it = M.ITEMS[p.k];
      swatches.innerHTML = it.colors.map((c, i) => `<button type="button" role="radio" aria-checked="${c === p.c}" aria-label="${it.name} สีที่ ${i + 1}" data-color="${c}" style="--c:${c}"></button>`).join("");
      swatches.hidden = !it.colors.length;
      selName.textContent = it.colors.length ? "" : it.name;           // ธูปไม่มีสีให้เลือก → แสดงชื่อแทน
      $('[data-act="delete"]', panel).setAttribute("aria-label", `ลบ${it.name}`);
      sizeIn.value = Math.round(p.s * 100); sizeIn.setAttribute("aria-valuetext", `${Math.round(p.s * 100)} เปอร์เซ็นต์`); sizeIn.setAttribute("aria-label", `ขนาด${it.name}`);
      rotIn.value = p.r; rotIn.setAttribute("aria-valuetext", `${p.r} องศา`); rotIn.setAttribute("aria-label", `มุม${it.name}`);
      canvas.setAttribute("aria-label", `กระทงที่กำลังแต่ง เลือก${it.name}อยู่ (ชิ้นที่ ${info.index + 1} จาก ${info.count}) ลูกศรซ้าย/ขวาเลือกชิ้นอื่น Delete ลบ`);
    },
    onLost() { if (ui.onLost) ui.onLost(); },
    more: () => data.more(),
  };
  const R = createRiver3D(stage, api);
  if (!R) return null;
  R.ready.then(() => {
    startBtn.disabled = false; startLabel.textContent = "แต่งกระทงของคุณ";
    if (gsap) gsap.to(poster, { autoAlpha: 0, duration: 0.8, delay: 0.2 }); else poster.hidden = true;
    // ?debug=1&n=300: กระทงทดสอบ n ใบ (ไอเดียของแต่ละฐาน + ดอกไม้สุ่ม อยู่ในเครื่องนี้เท่านั้น ไม่บันทึก) ใช้วัดความลื่น
    const q = new URLSearchParams(location.search), testN = q.get("debug") === "1" ? +q.get("n") | 0 : 0;
    for (let i = 0; i < testN; i++) {
      const base = i % 3, parts = M.presetParts(R.man, base), pl = M.placeOf(R.man, base);
      for (let j = 0, m = (i * 7) % 6; j < m; j++) {
        const k = TRAY[(i + j) % 6], a = j * 2.4 + i, r = pl.radius * (0.3 + (j % 3) * 0.3), it = M.ITEMS[k];
        parts.push({ k, x: Math.cos(a) * r, y: pl.y, z: Math.sin(a) * r, r: (i * 37 + j * 53) % 360 - 180, s: 0.8 + (j % 3) * 0.2, c: it.colors[(i + j) % it.colors.length] });
      }
      R.feed({ id: "test" + i, name: "ทดสอบ", wish: `กระทงทดสอบใบที่ ${i + 1}`, base, parts, at: Date.now() - i * 1000, test: true }, "page");
    }
    // โมเดลเต็มของหน้าแต่ง: โหลดล่วงหน้าตอนว่าง (กดแต่งแล้วขึ้นทันที)
    setTimeout(() => R.prepare().catch(() => {}), 2500);
  }).catch((e) => { if (window.console) console.warn("[loy] โหลดโมเดลกระทงไม่สำเร็จ:", e.message); if (ui.onLost) ui.onLost(); });

  /* ---------- โหมดเต็มจอ: ล็อกการเลื่อน + ซ่อนเนื้อหาข้างหลัง (inert) ---------- */
  const spacer = document.createElement("div");
  spacer.className = "loy3d__spacer"; spacer.setAttribute("aria-hidden", "true");
  let inerted = [];
  function setInert(on) {
    if (!on) { inerted.forEach((el) => { el.inert = false; }); inerted = []; return; }
    for (let el = stage; el && el !== document.body; el = el.parentElement) {
      for (const sib of el.parentElement.children) if (sib !== el && !sib.inert && sib.tagName !== "SCRIPT") { sib.inert = true; inerted.push(sib); }
    }
  }
  const still = () => !gsap || reduceQ.matches;
  const inset = (r) => { const c = (v) => Math.max(0, v).toFixed(0) + "px"; return `inset(${c(r.top)} ${c(innerWidth - r.right)} ${c(innerHeight - r.bottom)} ${c(r.left)} round 0px)`; };
  function enterFull() {
    const r = stage.getBoundingClientRect();
    spacer.style.height = stage.offsetHeight + "px";
    stage.before(spacer);
    stage.classList.add("is-full");
    document.documentElement.classList.add("loy-building");
    setInert(true);
    if (still()) return;
    // ขยายจากกรอบเดิมบนหน้าเว็บไปเต็มจอ (clip-path) · แผงล่างเลื่อนขึ้นตาม
    gsap.fromTo(stage, { clipPath: inset(r) }, { clipPath: "inset(0px 0px 0px 0px round 0px)", duration: DUR, ease: "power3.inOut", clearProps: "clipPath" });
    gsap.fromTo(panel, { yPercent: 100 }, { yPercent: 0, duration: DUR, ease: "power3.out", delay: 0.08, clearProps: "transform" });
  }
  function exitFull(done) {
    const end = () => {
      stage.classList.remove("is-full");
      document.documentElement.classList.remove("loy-building");
      spacer.remove();
      setInert(false);
      panel.hidden = true;
      if (gsap) gsap.set([stage, panel], { clearProps: "clipPath,transform" });
      if (done) done();
    };
    if (still()) return end();
    gsap.to(panel, { yPercent: 100, duration: DUR * 0.7, ease: "power2.in" });
    gsap.to(stage, { clipPath: inset(spacer.getBoundingClientRect()), duration: DUR, ease: "power3.inOut", delay: 0.1, onComplete: end });
  }

  /* ---------- เปิด/ปิด/ขั้นตอน ---------- */
  function layoutPanel() {
    if (panel.hidden) return;
    R.setPanel(0, panel.offsetHeight / 2);          // กระทงอยู่กลางพื้นที่เหนือแผง
  }
  function showStep(n) {
    step = n;
    panel.querySelectorAll(".lb__step").forEach((s) => { s.hidden = +s.dataset.step !== n; });
    panel.querySelectorAll(".lb__steps li").forEach((li) => {
      const k = +li.dataset.step;
      li.classList.toggle("is-done", k < n);
      if (k === n) li.setAttribute("aria-current", "step"); else li.removeAttribute("aria-current");
    });
    $('[data-act="idea"]', panel).hidden = n !== 1;
    $('[data-act="back"]', panel).hidden = n === 1;
    $('[data-act="undo"]', panel).hidden = n !== 2;
    $(".lb__next", panel).hidden = n === 3;
    $(".lb__pray", panel).hidden = n !== 3;
    canvas.tabIndex = n === 2 ? 0 : -1;
    if (n !== 2) R.select(-1);
    enterRite(n === 3);
    if (ui.onStep) ui.onStep(n);
    const h = panel.querySelector(`.lb__step[data-step="${n}"] .lb__h`);
    if (h) { h.tabIndex = -1; h.focus({ preventScroll: true }); }
  }
  let opening = false;
  async function openBuilder() {
    if (opening) return;
    opening = true;
    startBtn.setAttribute("aria-busy", "true"); startLabel.textContent = "กำลังเตรียมกระทง…";
    try { await R.prepare(); }
    catch (e) { opening = false; startBtn.removeAttribute("aria-busy"); startLabel.textContent = "โหลดไม่สำเร็จ ลองอีกครั้ง"; return; }
    opening = false;
    startBtn.removeAttribute("aria-busy"); startLabel.textContent = "แต่งกระทงของคุณ";
    panel.hidden = false;
    stage.classList.add("is-building");
    canvas.removeAttribute("aria-hidden");
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", "กระทงที่กำลังแต่ง ลากเพื่อหมุนดู");
    enterFull();
    syncIdea();
    showStep(step);
    layoutPanel();
    R.openBuilder();
  }
  function leaveCanvas() { canvas.setAttribute("aria-hidden", "true"); canvas.removeAttribute("role"); canvas.removeAttribute("aria-label"); canvas.tabIndex = -1; }
  function closeBuilder(focus = true) {
    if (releasing) return;
    enterRite(false);
    stage.classList.remove("is-building");
    leaveCanvas();
    R.closeBuilder();
    exitFull(() => R.setPanel(0, 0));
    if (focus) startBtn.focus({ preventScroll: true });
  }
  startBtn.addEventListener("click", () => { if (!releasing) openBuilder(); });

  panel.addEventListener("click", (e) => {
    const t = e.target.closest("button");
    if (!t || t.disabled) return;
    if (t.dataset.base != null) {
      panel.querySelectorAll("[data-base]").forEach((b) => b.setAttribute("aria-checked", String(b === t)));
      R.setBase(+t.dataset.base, true);
      syncIdea();
      return;
    }
    if (t.dataset.item != null) {
      const k = +t.dataset.item;
      if (R.addPart(k)) say(`วาง${M.ITEMS[k].name}แล้ว ลากเพื่อย้ายได้`);
      return;
    }
    if (t.dataset.color) { R.setSelColor(t.dataset.color); return; }
    switch (t.dataset.act) {
      case "close-builder": closeBuilder(); break;
      case "next-step": if (step < 3) showStep(step + 1); break;
      case "back": if (step > 1) showStep(step - 1); break;
      case "idea": R.loadPreset(); showStep(2); say("ใส่ของแต่งตามไอเดียแล้ว ปรับต่อได้เลย"); break;
      case "delete": { const n = R.build.sel >= 0 ? M.ITEMS[R.build.parts[R.build.sel].k].name : ""; R.removeSel(); say(`ลบ${n}แล้ว`); break; }
      case "undo": if (R.undo()) say("ย้อนกลับแล้ว"); break;
      case "light": light(); (wishEl.value.trim() ? prayBtn : wishEl).focus({ preventScroll: true }); break;   // ปุ่มถูกปิดหลังจุด → ย้ายโฟกัสไปขั้นถัดไป
    }
  });
  // slider: เก็บประวัติครั้งเดียวต่อการลาก 1 ครั้ง (ย้อนกลับได้ทีเดียว)
  let sliding = false;
  for (const el of [sizeIn, rotIn]) {
    el.addEventListener("input", () => {
      if (!sliding) { R.snapshot(); sliding = true; }
      const v = +el.value;
      R.editSel((p) => { if (el === sizeIn) p.s = v / 100; else p.r = v; }, false);
    });
    el.addEventListener("change", () => { sliding = false; });
  }
  panel.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.stopPropagation(); closeBuilder(); } });
  canvas.addEventListener("keydown", (e) => {
    if (step !== 2 || !stage.classList.contains("is-building")) return;
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") { e.preventDefault(); R.selectStep(e.key === "ArrowRight" ? 1 : -1); }
    else if ((e.key === "Delete" || e.key === "Backspace") && R.build.sel >= 0) { e.preventDefault(); R.removeSel(); say("ลบแล้ว"); }
    else if (e.key === "Escape") closeBuilder();
  });

  /* ---------- ขั้น 3: เขียนคำอธิษฐาน → แตะไส้เทียนจุดไฟ → กดค้างอธิษฐาน → ปล่อยมือ กระทงลงน้ำ ---------- */
  const B = R.build;
  const wishEl = $("#lb-wish", panel), nameEl = $("#lb-name", panel), errEl = $(".lb__err", panel);
  const lightBtn = $(".lb__light", panel), riteEl = $(".lb__rite", panel), riteText = $(".lb__rite-text", panel), prayBtn = $(".lb__pray", panel), prayLabel = $(".loy__send-label", prayBtn), ringFill = $(".lb__ring-fill", prayBtn);
  const wick = Object.assign(document.createElement("span"), { className: "lb__wick", hidden: true });
  wick.setAttribute("aria-hidden", "true");
  stage.appendChild(wick);
  let releasing = false, waitT = 0, lastKey = 0, auto = false;
  const hold = { state: "idle", p: 0, tw: null };      // idle → holding → ready → (ปล่อย) busy
  const HOLD_S = 1.6;
  const counter = (el, out, max) => { const f = () => { out.textContent = `${el.value.length}/${max}`; }; el.addEventListener("input", f); f(); };
  counter(wishEl, $("#lb-wish-n", panel), 80);
  counter(nameEl, $("#lb-name-n", panel), 20);
  [nameEl, wishEl].forEach((el) => el.addEventListener("input", () => { if (errEl.textContent) { errEl.textContent = ""; el.removeAttribute("aria-invalid"); } }));
  function fail(msg, field) {
    errEl.textContent = msg;
    [nameEl, wishEl].forEach((el) => el.toggleAttribute("aria-invalid", el === field));
    if (field) field.focus();
  }
  const candles = () => B.parts.reduce((a, p, i) => { if (p.k === M.CANDLE) a.push(i); return a; }, []);
  function syncRite() {
    const lit = B.lit.size > 0;
    riteEl.classList.toggle("is-done", lit);
    lightBtn.disabled = lit;
    lightBtn.textContent = lit ? "จุดแล้ว" : "จุดเทียน";
    riteText.textContent = lit ? "เทียนติดแล้ว อธิษฐานได้เลย" : "แตะไส้เทียนบนกระทงเพื่อจุดไฟ";
    syncPray();
  }
  // ปุ่มอธิษฐาน: ต้องจุดเทียนก่อน · ระหว่างรอ 30 วินาทีแสดงเวลานับถอยหลัง
  function syncPray() {
    clearTimeout(waitT);
    if (hold.state !== "idle") return;
    const left = data.waitLeft();
    if (left) {
      prayBtn.disabled = true;
      prayLabel.textContent = `ลอยใบต่อไปได้ใน ${Math.ceil(left / 1000)} วินาที`;
      waitT = setTimeout(syncPray, 1000 - (left % 1000) + 20);
      return;
    }
    prayBtn.disabled = !B.lit.size || releasing;
    prayLabel.textContent = B.lit.size ? "กดค้างไว้เพื่ออธิษฐาน" : "จุดเทียนก่อนนะ";
  }
  function light() {
    if (B.lit.size || releasing) return;
    candles().forEach((i) => B.lit.add(i));
    if (gsap) gsap.to(B, { litAmp: 1, duration: 0.9, ease: "power2.out", overwrite: true }); else B.litAmp = 1;
    say("จุดเทียนแล้ว");
    syncRite();
  }
  function unlight() {
    if (gsap) gsap.killTweensOf(B);
    B.lit.clear(); B.litAmp = 0; B.lift = 0;
  }
  // จุดชี้ไส้เทียน (ให้รู้ว่าแตะตรงไหน) ตามตำแหน่งเทียนบนจอ
  function wickTick() {
    const at = step === 3 && !B.lit.size && !releasing && !panel.hidden ? R.wickOnScreen() : null;
    wick.hidden = !at;
    if (at) wick.style.translate = `${at.x.toFixed(1)}px ${at.y.toFixed(1)}px`;   // translate แยกจาก scale ของแอนิเมชันกะพริบ
  }
  let ticking = false;
  function enterRite(on) {
    api.onWickTap = on ? light : null;          // นอกขั้น 3 การแตะเทียน = เลือกชิ้นตามปกติ
    if (on) {
      if (!candles().length && R.addPart(M.CANDLE)) { R.select(-1); say("เพิ่มเทียนให้ 1 เล่ม แตะไส้เทียนเพื่อจุดไฟ"); }
      syncRite();
    } else if (!releasing) { unlight(); resetHold(); }
    if (on !== ticking) {
      ticking = on;
      if (gsap) gsap.ticker[on ? "add" : "remove"](wickTick);
      if (!on) wick.hidden = true;
    }
  }
  function setRing(p) {
    hold.p = p;
    ringFill.style.strokeDashoffset = String(1 - p);
    B.lift = p;                                  // ยกกระทงขึ้นเหนือน้ำนิด ๆ ระหว่างอธิษฐาน
    B.litAmp = 1 + p * 0.6;
  }
  function resetHold() {
    if (hold.tw) hold.tw.kill();
    hold.state = "idle"; auto = false;
    prayBtn.classList.remove("is-holding", "is-ready");
    ringFill.style.strokeDashoffset = "1";
    hold.p = 0; B.lift = 0;
    syncPray();
  }
  function holdStart() {
    if (prayBtn.disabled || hold.state !== "idle" || releasing) return;
    const bad = data.check(nameEl.value, wishEl.value);
    if (bad) { if (!bad.field) syncPray(); return fail(bad.msg, bad.field === "name" ? nameEl : bad.field === "wish" ? wishEl : null); }
    hold.state = "holding";
    say("");
    prayBtn.classList.add("is-holding");
    prayLabel.textContent = "อธิษฐานในใจ…";
    if (!gsap) { setRing(1); return holdReady(); }
    const o = { p: hold.p };
    hold.tw = gsap.to(o, { p: 1, duration: HOLD_S * (1 - o.p), ease: "none", overwrite: true, onUpdate: () => setRing(o.p), onComplete: holdReady });
  }
  function holdReady() {
    hold.state = "ready";
    prayBtn.classList.add("is-ready");
    prayLabel.textContent = "ปล่อยมือเพื่อลอยกระทง";
    if (auto) launch();
  }
  function holdEnd(cancel) {
    if (hold.state === "ready" && !cancel) return launch();
    if (hold.state !== "holding" && hold.state !== "ready") return;
    if (hold.tw) hold.tw.kill();
    hold.state = "idle"; auto = false;
    prayBtn.classList.remove("is-holding", "is-ready");
    const o = { p: hold.p };
    if (gsap) hold.tw = gsap.to(o, { p: 0, duration: 0.35, ease: "power2.out", onUpdate: () => setRing(o.p) }); else setRing(0);
    say("กดค้างไว้จนวงเต็ม แล้วค่อยปล่อยนะ");
    syncPray();
  }
  prayBtn.addEventListener("pointerdown", (e) => {
    if (e.button) return;
    try { prayBtn.setPointerCapture(e.pointerId); } catch (err) { /* ไม่เป็นไร */ }
    holdStart();
  });
  prayBtn.addEventListener("pointerup", () => holdEnd(false));
  prayBtn.addEventListener("pointercancel", () => holdEnd(true));
  prayBtn.addEventListener("contextmenu", (e) => e.preventDefault());
  prayBtn.addEventListener("keydown", (e) => {
    if (e.key !== " " && e.key !== "Enter") return;
    e.preventDefault(); lastKey = Date.now();
    if (!e.repeat) holdStart();
  });
  prayBtn.addEventListener("keyup", (e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); lastKey = Date.now(); holdEnd(false); } });
  prayBtn.addEventListener("blur", () => { if (hold.state === "holding") holdEnd(true); });
  // screen reader (แตะสองครั้ง = click เดียว กดค้างไม่ได้) → อธิษฐานให้ครบวงเองแล้วลอย
  prayBtn.addEventListener("click", (e) => {
    if (e.detail === 0 && Date.now() - lastKey > 800 && hold.state === "idle") { auto = true; holdStart(); }
  });
  wishEl.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); nameEl.focus(); } });

  async function launch() {
    hold.state = "busy";
    prayBtn.disabled = true;
    prayLabel.textContent = "กำลังลอยกระทง…";
    releasing = true;                           // ระหว่างนี้ data.add ส่งเหตุการณ์ add (own) มา → ฉากรับช่วงเองตอนส่งต่อ
    const st = R.state();
    const res = await data.add({ name: nameEl.value, wish: wishEl.value, base: st.base, parts: st.parts });
    if (res.error) { releasing = false; resetHold(); return fail(res.error, wishEl); }
    // เก็บแผง + ออกจากเต็มจอ → กระทงลงน้ำ น้ำกระเพื่อม กล้องตามไปสักพัก → กลับมุมแม่น้ำ
    wick.hidden = true;
    stage.classList.remove("is-building");
    leaveCanvas();
    startBtn.disabled = true;
    exitFull();
    R.release(res.k, () => {
      releasing = false;
      R.setPanel(0, 0);
      unlight();
      R.resetBuild();
      wishEl.value = ""; wishEl.dispatchEvent(new Event("input"));
      resetHold();
      panel.querySelectorAll("[data-base]").forEach((b) => b.setAttribute("aria-checked", String(+b.dataset.base === 1)));
      step = 1;
      enterRite(false);
      startBtn.disabled = false;
      startLabel.textContent = "แต่งกระทงอีกใบ";
      startBtn.focus({ preventScroll: true });
    });
  }
  new ResizeObserver(layoutPanel).observe(panel);

  /* ---------- เหตุการณ์จากข้อมูล ---------- */
  const ui = {
    R, panel, step: () => step, showStep, openBuilder, closeBuilder, say,
    // กระทงประดับ (decor) จัดการใน pool ของฉากเอง ไม่ต้องรับเหตุการณ์ decor/undecor
    event(type, d) {
      if (type === "add") { if (!(d.how === "own" && releasing)) R.feed(d.k, d.how); }
      else if (type === "remove") R.drop(d.id);
    },
    visible: () => R.active,
    dispose: () => R.dispose(),
    onLost: null, onStep: null,
  };
  return ui;
}
