"""สร้างเสียงเอฟเฟคทั้งคลิป → assets/sfx.wav (สังเคราะห์เองทั้งหมด ไม่ใช้ไฟล์เสียงของใคร)

ใช้จังหวะจริงจากหน้าเว็บที่อัดไว้ (site-events.json จาก capture-site.cjs) จึงตรงกับภาพทุกเฟรม
    python3 make-sfx.py          (ต้องมี numpy)

เสียงที่ใส่: เครื่องพิมพ์หึ่งตอนกระดาษไหล · แตะปุ่ม · ตัดกระดาษ · ฉีก · ลม (มือถือเข้า/ซูม)
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
def motor(gate, fmul, f0=760.0):
    """เครื่องพิมพ์ความร้อน: เสียงหึ่งของสเต็ปมอเตอร์ + ซ่าของหัวพิมพ์ เป็นจังหวะบรรทัด"""
    t = np.arange(len(gate)) / SR
    f = f0 * fmul * (1 + 0.008 * np.sin(2 * np.pi * 6 * t))
    ph = 2 * np.pi * np.cumsum(f) / SR
    tone = sum(np.sin(k * ph) / k ** 1.3 for k in range(1, 7))
    step = 0.55 + 0.45 * np.abs(np.sin(np.pi * 46 * fmul * t)) ** 6
    hiss = band(rng.standard_normal(len(t)), 2500, 7500)
    sig = norm(tone) * 0.8 + norm(hiss) * 0.35
    return sig * step * gate


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


# เครื่องพิมพ์: เปิดเมื่อกระดาษกำลังไหล (ความสูงกระดาษเพิ่ม) ระดับเสียงตามความเร็ว
gate = np.zeros(len(out))
fmul = np.ones(len(out))
for a, b in zip(frames, frames[1:]):
    moving = b["paperH"] - a["paperH"] > 0.05 and a["printing"]
    i0, i1 = int((SITE + a["t"]) * SR), int((SITE + b["t"]) * SR)
    gate[i0:i1] = 1.0 if moving else 0.0
    fmul[i0:i1] = b["mul"]
k = np.ones(int(0.012 * SR)) / int(0.012 * SR)
gate = np.convolve(gate, k, mode="same")
fmul = np.convolve(fmul, k, mode="same")
fmul[fmul < 0.5] = 1.0

# การ์ดเปิด/ปิด: บรรทัดที่พิมพ์ทีละบรรทัด
for a, b in [(0.12, 0.35), (0.40, 0.56), (0.58, 0.85), (0.88, 1.02), (1.05, 1.28),
             (17.18, 17.40), (17.45, 17.57), (17.60, 17.84), (17.87, 18.13), (18.16, 18.30), (18.33, 18.58)]:
    i0, i1 = int(a * SR), int(b * SR)
    seg = np.zeros(len(out))
    seg[i0:i1] = 1
    seg = np.convolve(seg, k, mode="same")
    gate = np.maximum(gate, seg)
    fmul[i0:i1] = 1.25

add(motor(gate, fmul), 0, -13)

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
