// อัดหน้าเว็บใบเสร็จรักทีละเฟรม (จอมือถือ 390x844 ความละเอียด 3 เท่า) → site.mp4 สำหรับใส่ในคลิปโปรโมต
// วิธีใช้:  1) เปิดเว็บที่โฟลเดอร์ love-receipt ด้วย  python3 -m http.server 8765  (ความเร็วพิมพ์ในคลิป = ?speed=1.8)
//           2) node capture-site.cjs        (ต้องมี Playwright และ ffmpeg)
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const URL = process.env.SITE_URL || 'http://127.0.0.1:8765/index.html?speed=1.8';
const FPS = 30;
const DUR = 15.6; // วินาทีของคลิปหน้าเว็บ (คลิปเต็มใช้ช่วง 2–17.6 วิ)
const OUT = path.join(__dirname, 'site.mp4');
const FRAMES = path.join(process.env.FRAMES_DIR || path.join(__dirname, '.frames'));

// ไทม์ไลน์ (วินาทีของคลิปหน้าเว็บ · บวก 2 = เวลาในคลิปเต็ม)
const T = {
  tapPrint: 0.5,     // แตะ "พิมพ์ใบเสร็จ"
  toTotal: 8.0,      // พิมพ์เสร็จแล้ว เลื่อนขึ้นไปที่ยอดรวม (ต้องเสร็จก่อนเวลานี้)
  toBarcode: 11.4,   // เลื่อนลงไปที่บาร์โค้ด
  tapBarcode: 11.9,  // แตะบาร์โค้ด
};

(async () => {
  fs.mkdirSync(FRAMES, { recursive: true });
  for (const f of fs.readdirSync(FRAMES)) if (f.endsWith('.png')) fs.unlinkSync(path.join(FRAMES, f));

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await ctx.addInitScript({ path: path.join(__dirname, 'virtual-time.js') });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error('pageerror', e.message));
  await page.goto(URL, { waitUntil: 'networkidle' });
  // รอฟอนต์กับรูป (ใช้เวลาจริง)
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => [...document.querySelectorAll('.r-photo img')].every((i) => i.src.startsWith('data:') || i.classList.contains('raw')));
  // ข้อความลับในคลิปขึ้นเร็วขึ้นนิดนึง ให้ทันก่อนการ์ดปิด
  await page.addStyleTag({ content: ':root { --stagger: 90ms !important; } .secret .ln { transition-duration: .55s !important; }' });
  await page.evaluate(() => window.__vt.advance(50));

  const log = {};
  const center = (sel) => page.evaluate((s) => { const r = document.querySelector(s).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, sel);
  const did = new Set();
  const once = (k) => (did.has(k) ? false : (did.add(k), true));

  const total = Math.round(DUR * FPS);
  for (let f = 0; f < total; f++) {
    const t = f / FPS;
    if (t >= T.tapPrint && once('tapPrint')) {
      const [x, y] = await center('#printBtn');
      await page.evaluate(([x, y]) => { window.__vt.tap(x, y); setTimeout(() => document.getElementById('printBtn').click(), 140); }, [x, y]);
    }
    if (!log.done && (await page.evaluate(() => document.documentElement.dataset.state === 'done'))) log.done = +t.toFixed(2);
    if (t >= T.toTotal && once('toTotal')) {
      if (!log.done) console.warn('!! ยังพิมพ์ไม่เสร็จตอนเลื่อนไปยอดรวม — เพิ่ม speed');
      await page.evaluate(() => {
        const a = document.querySelector('.r-counter-label').getBoundingClientRect();
        const b = document.querySelector('.r-total').getBoundingClientRect();
        const mid = scrollY + (a.top + b.bottom) / 2;
        window.__vt.scrollTo(Math.round(mid - 400), 650);
      });
    }
    if (t >= T.toBarcode && once('toBarcode')) {
      await page.evaluate(() => {
        const r = document.querySelector('.r-barcode').getBoundingClientRect();
        window.__vt.scrollTo(Math.round(scrollY + r.top + r.height / 2 - 470), 420);
      });
    }
    if (t >= T.tapBarcode && once('tapBarcode')) {
      const [x, y] = await center('.r-barcode');
      log.barcodeAt = [Math.round(x), Math.round(y)];
      await page.evaluate(([x, y]) => { window.__vt.tap(x, y); setTimeout(() => document.querySelector('.r-barcode').click(), 100); }, [x, y]);
    }
    await page.screenshot({ path: path.join(FRAMES, String(f).padStart(5, '0') + '.png') });
    await page.evaluate((ms) => window.__vt.advance(ms), 1000 / FPS);
    if (f % 60 === 0) process.stdout.write(`frame ${f}/${total}\n`);
  }
  await browser.close();
  console.log('events', JSON.stringify(log));

  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(FRAMES, '%05d.png'),
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '12', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', OUT], { stdio: 'inherit' });
  console.log('wrote', OUT);
})();
