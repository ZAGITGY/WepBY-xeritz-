"""สร้างเสียงเอฟเฟคทั้งคลิป → assets/sfx.wav (สังเคราะห์เองทั้งหมด ไม่ใช้ไฟล์เสียงของใคร)

ใช้จังหวะจริงจากหน้าเว็บที่อัดไว้ (site-events.json จาก capture-site.cjs) จึงตรงกับภาพทุกเฟรม
    python3 make-sfx.py          (ต้องมี numpy)

เสียงที่ใส่: เข็มพิมพ์ "ตริ๊ด" ทุกบรรทัด + หึ่งเบาๆ ตอนกระดาษไหล · ตราประทับ · แตะปุ่ม · ตัดกระดาษ · ฉีก · ลม (มือถือเข้า/ซูม)
ติ๊กตามวินาทีของตัวนับ · เลเซอร์สแกน + บี๊ป · ระฆังตอนข้อความลับขึ้น · เสียงพิมพ์การ์ดเปิด/ปิด · กริ๊งปิดท้าย
"""
import json
import os
import wave

import numpy as np

SR = 44100
DUR = 20.0
SITE = 2.0  # site.mp4 เริ่มที่วินาทีที่ 2 ของคลิป
HERE = os.path.dirname(os.path.abspath(__file__))
ev = json.load(open(os.path.join(HERE, "site-events.json"), encoding="utf-8"))
frames = ev["frames"]
FPS = ev["fps"]
rng = np.random.default_rng(14022024)
out = np.zeros(int(SR * DUR), dtype=np.float64)


def ts(d):
    return np.arange(int(d * SR)) / SR


def add(sig, t, gain_db=0.0):
    i = int(round(t * SR))
    if i >= len(out):
        return
    if i < 0:
        sig, i = sig[-i:], 0
    j = min(len(out), i + len(sig))
    out[i:j] += sig[: j - i] * 10 ** (gain_db / 20)


def band(x, lo, hi):
    """กรองความถี่แบบ FFT ขอบนุ่ม"""
    n = len(x)
    f = np.fft.rfftfreq(n, 1 / SR)
    m = np.clip((f - lo * 0.8) / (lo * 0.4 + 1e-9), 0, 1) * np.clip((hi * 1.2 - f) / (hi * 0.4), 0, 1)
    return np.fft.irfft(np.fft.rfft(x) * m, n)


def mix(*parts):
    """รวมเสียงที่ยาวไม่เท่ากัน"""
    n = max(len(p) for p in parts)
    return sum(np.pad(p, (0, n - len(p))) for p in parts)


def norm(x):
    p = np.max(np.abs(x))
    return x / p if p > 0 else x


def fades(x, a=0.004, r=0.01):
    n = len(x)
    e = np.ones(n)
    na, nr = min(n, int(a * SR)), min(n, int(r * SR))
    if na:
        e[:na] = np.linspace(0, 1, na)
    if nr:
        e[-nr:] *= np.linspace(1, 0, nr)
    return x * e


# ── เสียงแต่ละแบบ ─────────────────────────────────────────
def click(f1=1900, f2=850, d=0.035):
    t = ts(d)
    f = f1 * (f2 / f1) ** (t / d)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.008)
    n = band(rng.standard_normal(len(t)), 2000, 9000) * np.exp(-t / 0.002) * 0.6
    return fades(norm(s + n), 0.0005, 0.005)


def thump(f=85, d=0.09):
    t = ts(d)
    return fades(np.sin(2 * np.pi * f * t) * np.exp(-t / 0.025), 0.001, 0.01)


def cutter():
    s = np.zeros(int(0.16 * SR))
    for k, at in enumerate((0.0, 0.065)):
        c = mix(click(5200, 2600, 0.02) * 0.9, thump(95 - 15 * k) * 0.8)
        i = int(at * SR)
        s[i:i + len(c)] += c
    return norm(s)


def tear(d=0.34):
    t = ts(d)
    env = np.zeros(len(t))
    for _ in range(140):  # เสียงกระดาษขาดเป็นเม็ดๆ ถี่ขึ้นแล้วหาย
        at = d * rng.beta(1.6, 2.4)
        i = int(at * SR)
        k = np.exp(-np.arange(int(0.012 * SR)) / (0.0025 * SR)) * rng.uniform(0.3, 1)
        env[i:i + len(k)] += k[: len(env) - i]
    s = band(rng.standard_normal(len(t)), 900, 7000) * env
    return fades(norm(s), 0.002, 0.04)


def whoosh(d, lo=300, hi=3000, up=True):
    t = ts(d)
    n = rng.standard_normal(len(t))
    lowpart = band(n, lo, lo * 3)
    highpart = band(n, hi / 3, hi)
    k = t / d if up else 1 - t / d
    s = lowpart * (1 - k) + highpart * k
    env = np.sin(np.pi * np.clip(t / d, 0, 1)) ** 2
    return fades(norm(s * env), 0.01, 0.03)


def tick():
    t = ts(0.03)
    s = np.sin(2 * np.pi * 2600 * t) * np.exp(-t / 0.004) + 0.4 * np.sin(2 * np.pi * 5200 * t) * np.exp(-t / 0.002)
    return fades(norm(s), 0.0003, 0.004)


def laser(d=1.0):
    t = ts(d)
    f = 1700 + 700 * np.sin(np.pi * t / d)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * (0.6 + 0.4 * np.sin(2 * np.pi * 28 * t))
    hum = np.sin(2 * np.pi * 110 * t) * 0.5
    env = np.sin(np.pi * t / d) ** 0.6
    return fades(norm((s * 0.5 + hum) * env), 0.02, 0.05)


def beep(d=0.12, f=2730):
    t = ts(d)
    s = np.sin(2 * np.pi * f * t) + 0.18 * np.sin(2 * np.pi * 3 * f * t)
    return fades(norm(s), 0.004, 0.012)


def bell(f, d=1.6, decay=0.45):
    t = ts(d)
    parts = [(1, 1.0, decay), (2.76, 0.32, decay * 0.5), (5.4, 0.12, decay * 0.25), (8.93, 0.05, decay * 0.15)]
    s = sum(a * np.sin(2 * np.pi * f * m * t) * np.exp(-t / dd) for m, a, dd in parts)
    return fades(s, 0.002, 0.05)


def chime():
    s = np.zeros(int(2.0 * SR))
    for k, f in enumerate((1046.5, 1318.5, 1568.0, 2093.0)):
        b = bell(f, 1.6, 0.6) * (1 - 0.12 * k)
        i = int(k * 0.075 * SR)
        s[i:i + len(b)] += b[: len(s) - i]
    return norm(s)


def kaching():
    s = np.zeros(int(1.6 * SR))
    c = mix(click(4200, 1800, 0.03) * 0.7, thump(140, 0.06) * 0.5)
    s[:len(c)] += c
    for at, f in ((0.05, 2637.0), (0.14, 3520.0)):
        b = bell(f, 1.4, 0.35)
        i = int(at * SR)
        s[i:i + len(b)] += b[: len(s) - i]
    return norm(s)


# ── จังหวะจากหน้าเว็บ ─────────────────────────────────────
def first(key, after=0.0):
    for fr in frames:
        if fr["t"] >= after and fr[key]:
            return SITE + fr["t"]
    return None


# ── เสียงพิมพ์แบบใหม่: เข็มพิมพ์ "ติ๊กๆ" ทีละบรรทัด (เหมือนในเว็บ) แทนเสียงหึ่งเดิม ──
def needle(f=2300.0):
    """เข็มพิมพ์ 1 จังหวะ: ติ๊กสั้นๆ ใสๆ"""
    t = ts(0.02)
    s = (rng.uniform(-1, 1, len(t)) * 0.55 + np.sin(2 * np.pi * f * t) * 0.7) * np.exp(-t / 0.0024)
    return norm(s)


def line(base=2100.0):
    """พิมพ์ 1 บรรทัด: "ตริ๊ด" = ติ๊ก 4 ครั้งติดกัน"""
    s = np.zeros(int(0.075 * SR))
    for k, (dt, df, g) in enumerate(((0.0, 0, 1.0), (0.016, 250, 0.9), (0.032, 100, 0.85), (0.048, 350, 0.7))):
        n = needle(base + df) * g
        i = int(dt * SR)
        s[i:i + len(n)] += n[: len(s) - i]
    return norm(s)


def hum(n):
    """กระดาษไหล: หึ่งต่ำๆ เบาๆ"""
    t = np.arange(n) / SR
    return (np.sin(2 * np.pi * 130 * t) * 0.5 + np.sin(2 * np.pi * 260 * t) * 0.25 + np.sin(2 * np.pi * 390 * t) * 0.1) * (0.75 + 0.25 * np.sin(2 * np.pi * 23 * t))


def stamp_thump():
    t = ts(0.24)
    s = np.sin(2 * np.pi * (70 * t + 1.5 * (1 - np.exp(-t / 0.03)))) * np.exp(-t / 0.06) + rng.uniform(-1, 1, len(t)) * 0.45 * np.exp(-t / 0.007)
    return fades(norm(s), 0.0005, 0.02)


# กระดาษไหล (หึ่งเบาๆ) เฉพาะตอนที่กระดาษขยับจริง
gate = np.zeros(len(out))
for a, b in zip(frames, frames[1:]):
    if b["paperH"] - a["paperH"] > 0.05 and a["printing"]:
        gate[int((SITE + a["t"]) * SR):int((SITE + b["t"]) * SR)] = 1.0
k = np.ones(int(0.03 * SR)) / int(0.03 * SR)
gate = np.convolve(gate, k, mode="same")
add(hum(len(out)) * gate, 0, -27)

# ทุกบรรทัดที่พิมพ์ออกมาในเว็บ → "ตริ๊ด" · เส้นประ → ติ๊กเดียว · รูป/บาร์โค้ด → ติ๊กถี่ๆ ตลอดตอนพิมพ์รูป
photos_total = max(fr["onPhoto"] for fr in frames)
for a, b in zip(frames, frames[1:]):
    t = SITE + b["t"]
    for j in range(b["onText"] - a["onText"]):
        add(line(rng.uniform(2000, 2250)), t + j * 0.03, -12)
    for j in range(b["onRule"] - a["onRule"]):
        add(needle(2500), t + j * 0.03, -16)
    for j in range(b["onPhoto"] - a["onPhoto"]):
        dur = 0.25 if b["onPhoto"] == photos_total else 0.5
        for x in np.arange(0, dur, 0.055):
            add(needle(rng.uniform(2100, 2500)), t + x, -16)

# การ์ดเปิด/ปิด: ตัวหนังสือขึ้นทีละขั้น (steps 10) → ติ๊กทุกขั้น เหมือนพิมพ์ดีด
for at, d, rule in [(0.12, 0.25, False), (0.28, 0.28, False), (0.52, 0.34, False), (0.86, 0.18, True), (0.98, 0.30, False),
                    (17.18, 0.22, False), (17.32, 0.25, False), (17.52, 0.32, False), (17.85, 0.30, False), (18.15, 0.18, True), (18.30, 0.30, False)]:
    for x in range(10):
        add(needle(rng.uniform(2000, 2600)), at + x * d / 10, -19 if rule else -14)

# ตราประทับ "ชำระแล้ว"
tst = first("stamp")
if tst:
    add(stamp_thump(), tst, -8)

# แตะปุ่ม / แตะบาร์โค้ด
add(click(), SITE + ev["tapPrint"], -11)
add(click(), SITE + ev["tapBarcode"], -11)
# ตัดกระดาษ + ฉีก
tc = first("cut")
tt = first("torn")
if tc:
    add(cutter(), tc, -9)
if tt:
    add(tear(), tt, -8)
# ลม: การ์ดเปิดเข้า/ออก มือถือเข้า ซูมเข้า ซูมออก มือถือออก
for at, d, up, g in [(0.0, 0.35, True, -24), (1.9, 0.4, False, -22), (2.0, 0.5, True, -20),
                     (10.45, 0.75, True, -21), (13.45, 0.6, False, -23), (16.8, 0.4, False, -22), (17.08, 0.45, True, -22)]:
    add(whoosh(d, up=up), at, g)
# ติ๊กตามวินาทีของตัวนับ ตอนซูมดูยอดรวม
prev = None
for fr in frames:
    t = SITE + fr["t"]
    if prev is not None and fr["sec"] != prev and 10.9 <= t <= 13.5:
        add(tick(), t, -13)
    prev = fr["sec"]
# สแกน
ts_ = first("scanning")
tb = first("beep")
if ts_:
    add(laser(1.0), ts_, -16)
if tb:
    add(beep(), tb, -16)
# ข้อความลับขึ้น
tsec = first("secret")
if tsec:
    add(chime(), tsec + 0.05, -11)
# ปิดท้าย: "By xeritz" พิมพ์เสร็จ
add(kaching(), 18.62, -13)

peak = np.max(np.abs(out))
out *= 10 ** (-3 / 20) / peak  # เผื่อพื้นที่ไว้ -3 dBFS
stereo = np.stack([out, out], axis=1)
pcm = (np.clip(stereo, -1, 1) * 32767).astype("<i2")
os.makedirs(os.path.join(HERE, "assets"), exist_ok=True)
with wave.open(os.path.join(HERE, "assets", "sfx.wav"), "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print("cut", tc, "torn", tt, "scan", ts_, "beep", tb, "secret", tsec)
