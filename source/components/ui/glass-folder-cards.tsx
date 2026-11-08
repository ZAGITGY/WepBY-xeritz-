"use client"

import * as React from "react"
import { ArrowUpRight, Ellipsis, Plus } from "lucide-react"

/** Layered, interactive glass folder. Generated artwork stays local; no image service is required. */
export type ArtPreset = "aurora" | "ember" | "dusk" | "glacier" | "verdant"
export type ArtRecipe = {
  style: "marble" | "streak"
  colors: string[]
  scale?: number
  warp?: number
  angle?: number
  gloss?: number
  veins?: number
}
export type FolderArt = ArtPreset | ArtRecipe | "none"
export type FolderFile = {
  name: string
  meta?: string
  art?: ArtPreset | ArtRecipe
  image?: string
  href?: string
  /** External documents may opt into a separate tab. */
  target?: "_blank" | "_self"
}
export type FolderMenuItem = { label: string; onSelect?: () => void; danger?: boolean }
export type GlassFolderMessages = {
  open: string
  close: string
  add: string
  options: string
  contents: string
  items: string
  untitled: string
  justNow: string
  empty: string
}
export type GlassFolderProps = {
  label?: string
  meta?: string
  tone?: "light" | "dark"
  art?: FolderArt
  seed?: number
  image?: string
  /** Initial contents, owned by the folder after mount. Change its React key to replace them. */
  files?: FolderFile[]
  action?: "add" | "more" | "none"
  onAdd?: (files: FolderFile[]) => FolderFile | void
  onFilesChange?: (files: FolderFile[]) => void
  menu?: FolderMenuItem[]
  labelPlacement?: "bottom-left" | "top-left" | "top-right"
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  onFileSelect?: (file: FolderFile, index: number) => void
  width?: number
  appear?: boolean
  appearDelay?: number
  /** Full readable list beneath the open folder. Always retained when there are >4 files. */
  showFileList?: boolean
  messages?: Partial<GlassFolderMessages>
  className?: string
  style?: React.CSSProperties
}

export const ART_PRESETS: Record<ArtPreset, ArtRecipe> = {
  aurora: { style: "streak", colors: ["#f4efe9", "#e9c2b8", "#c2433f", "#2a1e2a", "#22395e", "#6f97c2", "#e5edf4"], scale: .7, warp: 1.4, angle: -.62, gloss: .18, veins: 0 },
  ember: { style: "marble", colors: ["#07090c", "#16252c", "#3d5f68", "#1a1416", "#a3201a", "#ef4a2b", "#ff8a5c"], scale: .62, warp: 3.2, angle: -.5, gloss: .55, veins: .6 },
  dusk: { style: "marble", colors: ["#120c18", "#3e2850", "#8f6c9c", "#2b1a24", "#b3502f", "#eab08a", "#fbe7d2"], scale: .75, warp: 3.6, angle: .8, gloss: .5, veins: .5 },
  glacier: { style: "streak", colors: ["#f7f8fa", "#d9e2ea", "#9fb4c7", "#e8edf2", "#bccbd8", "#ffffff"], scale: .7, warp: 1.6, angle: .35, gloss: .25, veins: 0 },
  verdant: { style: "marble", colors: ["#070b08", "#173024", "#4f7a5a", "#141812", "#a7843a", "#e9cf87", "#fbf3d6"], scale: .7, warp: 3.4, angle: 2.1, gloss: .5, veins: .5 },
}

/** Ivory, oxblood and champagne, matching the college's existing visual identity. */
export const LVC_ART: ArtRecipe = {
  style: "streak", colors: ["#f9f5ed", "#e9d7b7", "#c8a56e", "#8e2131", "#4a1823", "#bc5461", "#f1e2d0"],
  scale: .66, warp: 1.7, angle: -.55, gloss: .22, veins: .08,
}

export function hexToRgb(hex: string): [number, number, number] {
  let h = hex.trim().replace(/^#/, "")
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]
  const n = /^[0-9a-f]{6}$/i.test(h) ? parseInt(h, 16) : 0x808080
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
export function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
export function hashString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

function makeFbm(seed: number): (x: number, y: number, octaves: number) => number {
  const random = rng(seed)
  const perm = new Uint8Array(512)
  const grad = new Float32Array(512)
  const p: number[] = []
  for (let i = 0; i < 256; i++) p.push(i)
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    const t = p[i]; p[i] = p[j]; p[j] = t
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255]
  for (let i = 0; i < 256; i++) {
    const a = random() * Math.PI * 2
    grad[i * 2] = Math.cos(a); grad[i * 2 + 1] = Math.sin(a)
  }
  const noise = (x: number, y: number): number => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, X = xi & 255, Y = yi & 255
    const h00 = perm[X + perm[Y]] * 2, h10 = perm[X + 1 + perm[Y]] * 2
    const h01 = perm[X + perm[Y + 1]] * 2, h11 = perm[X + 1 + perm[Y + 1]] * 2
    const d00 = grad[h00] * xf + grad[h00 + 1] * yf
    const d10 = grad[h10] * (xf - 1) + grad[h10 + 1] * yf
    const d01 = grad[h01] * xf + grad[h01 + 1] * (yf - 1)
    const d11 = grad[h11] * (xf - 1) + grad[h11 + 1] * (yf - 1)
    const u = xf * xf * xf * (xf * (xf * 6 - 15) + 10)
    const v = yf * yf * yf * (yf * (yf * 6 - 15) + 10)
    return d00 + u * (d10 - d00) + v * (d01 - d00 + u * (d11 - d01 - d10 + d00))
  }
  return (x, y, octaves) => {
    let sum = 0, amp = .5
    for (let i = 0; i < octaves; i++) {
      sum += amp * noise(x, y)
      const nx = 1.6 * x + 1.2 * y + 7.1
      y = -1.2 * x + 1.6 * y + 3.3; x = nx; amp *= .5
    }
    return sum
  }
}

export type ArtJob = { width: number; height: number; pixels: Uint8ClampedArray; step: (rows: number) => boolean }

/** Domain-warped liquid artwork, sampled on a half-resolution grid and shaded from its surface normals. */
export function createArtJob(width: number, height: number, recipe: ArtRecipe, seed: number): ArtJob {
  const w = Math.max(1, Math.round(width)), h = Math.max(1, Math.round(height))
  const colors = recipe.colors.length >= 2 ? recipe.colors : ["#111111", "#eeeeee"]
  const stops = colors.map((c, i) => ({ t: i / (colors.length - 1), c: hexToRgb(c) }))
  const scale = recipe.scale ?? .7, warp = recipe.warp ?? 3, gloss = recipe.gloss ?? .4, veins = recipe.veins ?? 0
  const streak = recipe.style === "streak", fbm = makeFbm(seed * 977 + 13), random = rng(seed + 1)
  const ox = random() * 50, oy = random() * 50, angle = (recipe.angle ?? 0) + (random() - .5) * .5
  const ca = Math.cos(angle), sa = Math.sin(angle), m = Math.min(w, h)
  const gw = Math.ceil(w / 2) + 3, gh = Math.ceil(h / 2) + 3
  const G = new Float32Array(gw * gh), GQ = new Float32Array(gw * gh)
  const F = new Float32Array(w * h), Q = new Float32Array(w * h)
  const pixels = new Uint8ClampedArray(w * h * 4)
  let row = 0, phase = 0, lo = 0, contrast = 1, slope = 0
  const T = new Float32Array(w * gh)
  const field = (gy: number) => {
    for (let gx = 0; gx < gw; gx++) {
      const u = ((gx - 1) * 2 - w / 2) / m, v = ((gy - 1) * 2 - h / 2) / m
      let px = (u * ca - v * sa) * scale, py = (u * sa + v * ca) * scale
      if (streak) { px *= .14; py *= 2.2 }
      px += ox; py += oy
      const qx = fbm(px, py, 3), qy = fbm(px + 5.2, py + 1.3, 3)
      const rx = fbm(px + warp * qx + 1.7, py + warp * qy + 9.2, 3)
      const ry = fbm(px + warp * qx + 8.3, py + warp * qy + 2.8, 3)
      G[gy * gw + gx] = fbm(px + warp * rx, py + warp * ry, 4)
      GQ[gy * gw + gx] = Math.sqrt(qx * qx + qy * qy)
    }
  }
  const cr = (a: number, b: number, c: number, d: number) => (-a + 9 * b + 9 * c - d) / 16
  const sampleHorizontal = (gy: number) => {
    const r = gy * gw
    for (let x = 0; x < w; x++) {
      const c = (x >> 1) + 1
      T[gy * w + x] = x & 1 ? cr(G[r + c - 1], G[r + c], G[r + c + 1], G[r + c + 2]) : G[r + c]
    }
  }
  const sampleVertical = (y: number) => {
    const c = (y >> 1) + 1
    for (let x = 0; x < w; x++) {
      F[y * w + x] = y & 1 ? cr(T[(c - 1) * w + x], T[c * w + x], T[(c + 1) * w + x], T[(c + 2) * w + x]) : T[c * w + x]
      const gx = (x >> 1) + 1, q0 = GQ[c * gw + gx], qx = x & 1 ? (q0 + GQ[c * gw + gx + 1]) / 2 : q0
      const q1 = y & 1 ? (x & 1 ? (GQ[(c + 1) * gw + gx] + GQ[(c + 1) * gw + gx + 1]) / 2 : GQ[(c + 1) * gw + gx]) : qx
      Q[y * w + x] = (qx + q1) / 2
    }
  }
  const normalize = () => {
    const sample: number[] = [], stride = Math.max(1, Math.floor(F.length / 4096))
    for (let i = 0; i < F.length; i += stride) sample.push(F[i])
    sample.sort((a, b) => a - b)
    lo = sample[Math.floor(sample.length * .02)]
    contrast = 1 / (sample[Math.floor(sample.length * .98)] - lo || 1)
    slope = contrast * m * .012
  }
  const colorizeRow = (y: number) => {
    const lx = -.55, ly = -.65, lz = .52
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      const t = Math.max(0, Math.min(1, (F[i] - lo) * contrast))
      let j = 1
      while (j < stops.length - 1 && stops[j].t < t) j++
      const a = stops[j - 1], b = stops[j]
      let f = Math.max(0, Math.min(1, (t - a.t) / (b.t - a.t || 1)))
      f = f * f * (3 - 2 * f)
      const gx = (F[x < w - 1 ? i + 1 : i] - F[x > 0 ? i - 1 : i]) * slope
      const gy = (F[y < h - 1 ? i + w : i] - F[y > 0 ? i - w : i]) * slope
      const nd = (-gx * lx - gy * ly + lz) / Math.sqrt(gx * gx + gy * gy + 1)
      const spec = Math.pow(Math.max(0, nd), 24) * gloss * 255
      const silk = 1 + .035 * Math.sin(t * 150 + Q[i] * 24)
      const vein = veins * Math.max(0, 1 - Math.abs(Q[i] - .42) * 14) * .6
      const lit = (.82 + .28 * nd) * silk * (1 - vein)
      pixels[i * 4] = (a.c[0] + (b.c[0] - a.c[0]) * f) * lit + spec
      pixels[i * 4 + 1] = (a.c[1] + (b.c[1] - a.c[1]) * f) * lit + spec
      pixels[i * 4 + 2] = (a.c[2] + (b.c[2] - a.c[2]) * f) * lit + spec
      pixels[i * 4 + 3] = 255
    }
  }
  return { width: w, height: h, pixels, step: (rows) => {
    if (phase >= 4) return true
    const limit = phase < 2 ? gh : h
    const end = Math.min(limit, row + Math.max(1, Math.round(rows)))
    while (row < end) {
      if (phase === 0) field(row++)
      else if (phase === 1) sampleHorizontal(row++)
      else if (phase === 2) sampleVertical(row++)
      else colorizeRow(row++)
    }
    if (row === limit) {
      phase++; row = 0
      if (phase === 3) normalize()
    }
    return phase >= 4
  } }
}
export function fanSlot(index: number, count: number): number { return count <= 1 ? 0 : (index / (count - 1)) * 2 - 1 }
const recipeOf = (art: ArtPreset | ArtRecipe): ArtRecipe => typeof art === "string" ? ART_PRESETS[art] : art

type Painted = HTMLCanvasElement
const artCache = new Map<string, Promise<Painted>>()
const queue: { job: ArtJob; priority: number; done: (c: Painted) => void }[] = []
let pumping = false
function pump() {
  if (pumping) return
  pumping = true
  const tick = () => {
    const until = performance.now() + 6
    while (queue.length && performance.now() < until) {
      const head = queue[0]
      if (head.job.step(4)) {
        queue.shift()
        const c = document.createElement("canvas")
        c.width = head.job.width; c.height = head.job.height
        const context = c.getContext("2d")
        if (context) {
          const data = context.createImageData(c.width, c.height)
          data.data.set(head.job.pixels)
          context.putImageData(data, 0, 0)
        }
        head.done(c)
      }
    }
    if (queue.length) requestAnimationFrame(tick)
    else pumping = false
  }
  requestAnimationFrame(tick)
}
function paint(recipe: ArtRecipe, seed: number, w: number, h: number, priority: number): Promise<Painted> {
  const key = JSON.stringify([recipe, seed, w, h])
  let p = artCache.get(key)
  if (!p) {
    p = new Promise<Painted>((done) => {
      let at = queue.length
      while (at > 1 && queue[at - 1].priority > priority) at--
      queue.splice(at, 0, { job: createArtJob(w, h, recipe, seed), priority, done }); pump()
    })
    // Keep resize-driven art variants bounded. Active consumers keep their promises.
    if (artCache.size >= 32) artCache.delete(artCache.keys().next().value as string)
    artCache.set(key, p)
  }
  return p
}
function ArtCanvas({ art, seed, w, h, density, priority, className }: {
  art: ArtPreset | ArtRecipe; seed: number; w: number; h: number; density: number; priority: number; className?: string
}) {
  const ref = React.useRef<HTMLCanvasElement>(null)
  const [ready, setReady] = React.useState(false)
  const key = JSON.stringify(recipeOf(art)), pw = Math.round(w * density), ph = Math.round(h * density)
  React.useEffect(() => {
    let live = true
    setReady(false)
    paint(JSON.parse(key) as ArtRecipe, seed, pw, ph, priority).then((source) => {
      const c = ref.current
      if (!live || !c) return
      c.width = source.width; c.height = source.height
      c.getContext("2d")?.drawImage(source, 0, 0); setReady(true)
    })
    return () => { live = false }
  }, [key, seed, pw, ph, priority])
  return <canvas ref={ref} aria-hidden="true" className={className} data-ready={ready || undefined} style={{ width: w, height: h, maxWidth: "none" }} />
}

function useReducedMotion() {
  const [reduced, setReduced] = React.useState(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches)
  React.useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)")
    const update = () => setReduced(query.matches)
    update(); query.addEventListener("change", update)
    return () => query.removeEventListener("change", update)
  }, [])
  return reduced
}

const W = 340, H = 272, HEADROOM = 80, FRONT_H = 198, SHEET_W = 272, SHEET_H = 184, MAX_VISIBLE = 4
const BACK_PATH = "M0 56A22 22 0 0 1 22 34L146 34C170 34 172 0 198 0L318 0A22 22 0 0 1 340 22L340 250A22 22 0 0 1 318 272L22 272A22 22 0 0 1 0 250Z"
const FRONT_PATH = "M0 22A22 22 0 0 1 22 0L118 0C144 0 146 32 172 32L318 32A22 22 0 0 1 340 54L340 176A22 22 0 0 1 318 198L22 198A22 22 0 0 1 0 176Z"
const DEFAULT_MESSAGES: GlassFolderMessages = {
  open: "เปิดแฟ้ม", close: "ปิดแฟ้ม", add: "เพิ่มเอกสารใน", options: "ตัวเลือกของ", contents: "เอกสารในแฟ้ม",
  items: "รายการ", untitled: "เอกสารใหม่", justNow: "เมื่อสักครู่", empty: "ยังไม่มีเอกสารในแฟ้มนี้",
}

export default function GlassFolder({
  label = "แฟ้มเอกสาร", meta, tone = "light", art = LVC_ART, seed = 3, image, files: initialFiles = [],
  action = "none", onAdd, onFilesChange, menu = [], labelPlacement = "bottom-left", open: openProp,
  defaultOpen = false, onOpenChange, onFileSelect, width = 340, appear = true, appearDelay = 0,
  showFileList = true, messages, className, style,
}: GlassFolderProps) {
  const text = { ...DEFAULT_MESSAGES, ...messages }
  const uid = React.useId().replace(/:/g, "")
  const rootRef = React.useRef<HTMLDivElement>(null), filesRef = React.useRef<HTMLDivElement>(null)
  const hitRef = React.useRef<HTMLButtonElement>(null), keyRef = React.useRef<HTMLButtonElement>(null), menuRef = React.useRef<HTMLDivElement>(null)
  const [files, setFiles] = React.useState<FolderFile[]>(() => [...initialFiles])
  const ids = React.useRef(initialFiles.map((_, i) => i)), nextId = React.useRef(initialFiles.length)
  const [dropped, setDropped] = React.useState<number | null>(null), [bump, setBump] = React.useState(0)
  const [openState, setOpenState] = React.useState(defaultOpen), open = openProp ?? openState
  const setOpen = React.useCallback((next: boolean) => {
    if (openProp === undefined) setOpenState(next)
    onOpenChange?.(next)
  }, [openProp, onOpenChange])
  const reduced = useReducedMotion()
  const [menuOpen, setMenuOpen] = React.useState(false), [entered, setEntered] = React.useState(!appear || reduced)
  const safeWidth = Number.isFinite(width) ? Math.max(180, width) : W, k = safeWidth / W
  const density = Math.min(1.35, Math.max(1, typeof window === "undefined" ? 1 : window.devicePixelRatio || 1)) * k
  const fullList = showFileList || files.length > MAX_VISIBLE

  React.useEffect(() => {
    if (entered) return
    if (!appear || reduced) { setEntered(true); return }
    const el = rootRef.current
    if (!el || typeof IntersectionObserver === "undefined") { setEntered(true); return }
    let timer = 0
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return
      io.disconnect()
      timer = window.setTimeout(() => setEntered(true), Math.max(0, Math.min(1000, appearDelay)))
    }, { threshold: .12 })
    io.observe(el)
    return () => { io.disconnect(); window.clearTimeout(timer) }
  }, [appear, appearDelay, entered, reduced])

  React.useEffect(() => {
    const el = rootRef.current
    if (!el) return
    let raf = 0, px = 0, py = 0
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)")
    const write = () => { raf = 0; el.style.setProperty("--gf-px", px.toFixed(3)); el.style.setProperty("--gf-py", py.toFixed(3)) }
    const move = (event: PointerEvent) => {
      if (reduced || !finePointer.matches || event.pointerType === "touch") return
      const rect = el.getBoundingClientRect()
      px = Math.max(-1, Math.min(1, ((event.clientX - rect.left) / rect.width) * 2 - 1))
      py = Math.max(-1, Math.min(1, ((event.clientY - rect.top) / ((H + HEADROOM) * k)) * 2 - 1))
      if (!raf) raf = requestAnimationFrame(write)
    }
    const reset = () => { px = 0; py = 0; if (!raf) raf = requestAnimationFrame(write) }
    reset()
    el.addEventListener("pointermove", move); el.addEventListener("pointerleave", reset)
    // Scroll never drives the tilt, and immediately recentres the existing pointer pose.
    window.addEventListener("scroll", reset, { passive: true })
    return () => {
      el.removeEventListener("pointermove", move); el.removeEventListener("pointerleave", reset)
      window.removeEventListener("scroll", reset); cancelAnimationFrame(raf)
    }
  }, [k, reduced])

  React.useEffect(() => { filesRef.current?.toggleAttribute("inert", !open) }, [open])
  React.useEffect(() => {
    if (!open && !menuOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      if (menuOpen) { setMenuOpen(false); keyRef.current?.focus() }
      else if (rootRef.current?.contains(document.activeElement)) { setOpen(false); hitRef.current?.focus() }
    }
    const onDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (menuOpen && !menuRef.current?.contains(target) && !keyRef.current?.contains(target)) setMenuOpen(false)
      if (open && !menuOpen && !rootRef.current?.contains(target)) setOpen(false)
    }
    document.addEventListener("keydown", onKey); document.addEventListener("pointerdown", onDown)
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("pointerdown", onDown) }
  }, [open, menuOpen, setOpen])
  React.useEffect(() => {
    if (menuOpen) menuRef.current?.querySelector<HTMLElement>("[role=menuitem]")?.focus()
  }, [menuOpen])
  React.useEffect(() => {
    if (reduced) setDropped(null)
  }, [reduced])

  const addFile = () => {
    const made = onAdd?.(files)
    const file: FolderFile = made || { name: text.untitled + " " + (files.length + 1), meta: text.justNow }
    const next = [...files, file], id = nextId.current++
    ids.current = [...ids.current, id]
    setFiles(next); setDropped(reduced ? null : id); setBump((b) => b + 1); onFilesChange?.(next)
  }
  const menuItems: FolderMenuItem[] = [{ label: open ? text.close : text.open, onSelect: () => setOpen(!open) }, ...menu]
  const onMenuKey = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>("[role=menuitem]:not(:disabled)") ?? [])
    const at = items.indexOf(document.activeElement as HTMLElement)
    const go = (i: number) => { event.preventDefault(); items[(i + items.length) % items.length]?.focus() }
    if (event.key === "ArrowDown") go(at + 1)
    else if (event.key === "ArrowUp") go(at - 1)
    else if (event.key === "Home") go(0)
    else if (event.key === "End") go(items.length - 1)
    else if (event.key === "Tab") setMenuOpen(false)
  }
  const start = Math.max(0, files.length - MAX_VISIBLE), visible = files.slice(start), count = files.length
  const metaLine = meta ?? count + " " + text.items

  return <div ref={rootRef} className={"gf-root" + (className ? " " + className : "")} data-tone={tone}
    data-open={open || undefined} data-entered={entered || undefined} data-place={labelPlacement}
    style={{ width: safeWidth, ...style }}>
    <style>{GF_CSS}</style>
    <div className="gf-stage-space" style={{ height: (H + HEADROOM) * k }}>
      <div className="gf-stage" style={{ transform: `translateY(${HEADROOM * k}px) scale(${k})` }}>
        <div className="gf-tilt">
          <div className="gf-shadow" aria-hidden="true" />
          <div className="gf-back" style={{ clipPath: `path('${BACK_PATH}')` }} aria-hidden="true">
            {image ? <img className="gf-art" src={image} alt="" width={W + 24} height={H + 24} draggable={false} loading="lazy" />
              : art !== "none" ? <ArtCanvas className="gf-art" art={art} seed={seed} w={W + 24} h={H + 24} density={density} priority={0} /> : null}
            <div className="gf-back-sheen" />
          </div>
          <svg className="gf-rim gf-back-rim" viewBox={`0 0 ${W} ${H}`} aria-hidden="true"><path d={BACK_PATH} /></svg>
          <div key={bump} className={"gf-front" + (bump && !reduced ? " gf-front--bump" : "")} style={{ clipPath: `path('${FRONT_PATH}')` }}>
            <div className="gf-tint" aria-hidden="true" /><div className="gf-spec" aria-hidden="true" />
            <svg className="gf-rim gf-front-rim" viewBox={`0 0 ${W} ${FRONT_H}`} aria-hidden="true">
              <defs><linearGradient id={"gf-rim-" + uid} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#fff" stopOpacity=".95" /><stop offset=".35" stopColor="#fff" stopOpacity=".35" /><stop offset="1" stopColor="#fff" stopOpacity=".12" />
              </linearGradient></defs><path d={FRONT_PATH} stroke={`url(#gf-rim-${uid})`} />
            </svg>
            <button ref={hitRef} type="button" className="gf-hit" aria-expanded={open} aria-controls={"gf-content-" + uid}
              aria-label={`${open ? text.close : text.open} ${label}, ${count} ${text.items}`}
              onClick={() => { setMenuOpen(false); setOpen(!open) }} />
            <div className="gf-label"><span className="gf-title">{label}</span><span className="gf-meta" key={metaLine}>{metaLine}</span></div>
          </div>
          <div ref={filesRef} className="gf-files" aria-hidden={!open || undefined}>
            {visible.map((file, v) => {
              const id = ids.current[start + v], slot = fanSlot(v, visible.length), jitter = rng(hashString(file.name) + id)
              const picture = !!(file.art || file.image)
              const inner = <>
                {picture ? file.image ? <img className="gf-sheet-art" src={file.image} alt="" width={SHEET_W} height={SHEET_H} draggable={false} loading="lazy" />
                  : <ArtCanvas className="gf-sheet-art" art={file.art as ArtPreset | ArtRecipe} seed={hashString(file.name) % 997} w={SHEET_W} h={SHEET_H} density={Math.min(density, 1.25)} priority={1} />
                  : <span className="gf-lines" aria-hidden="true">{[86, 92, 64, 88, 42].map((size, i) => <i key={i} style={{ width: size + "%" }} />)}</span>}
                <span className="gf-sheet-head"><span className="gf-sheet-name">{file.name}</span>{file.meta && <span className="gf-sheet-meta">{file.meta}</span>}</span>
              </>
              const common = {
                className: "gf-sheet" + (picture ? " gf-sheet--art" : "") + (id === dropped ? " gf-sheet--drop" : ""),
                style: { "--gf-slot": slot, "--gf-depth": visible.length - 1 - v, "--gf-jx": ((jitter() - .5) * 7).toFixed(2) + "px", "--gf-jr": ((jitter() - .5) * 2).toFixed(2) + "deg", zIndex: v + 1 } as React.CSSProperties,
                tabIndex: open && !fullList ? 0 : -1,
                onAnimationEnd: id === dropped ? () => setDropped(null) : undefined,
                onClick: () => onFileSelect?.(file, start + v),
                title: file.name,
              }
              return <React.Fragment key={id}>{file.href
                ? <a {...common} href={file.href} target={file.target} rel={file.target === "_blank" ? "noopener noreferrer" : undefined}>{inner}</a>
                : <button {...common} type="button" disabled={!onFileSelect}>{inner}</button>}</React.Fragment>
            })}
          </div>
          {action !== "none" && <button ref={keyRef} type="button" className={"gf-key gf-key--" + action}
            aria-label={`${action === "add" ? text.add : text.options} ${label}`} aria-haspopup={action === "more" ? "menu" : undefined}
            aria-expanded={action === "more" ? menuOpen : undefined} aria-controls={action === "more" ? "gf-menu-" + uid : undefined}
            onClick={() => action === "add" ? addFile() : setMenuOpen((value) => !value)}>
            {action === "add" ? <Plus key={bump} className="gf-glyph gf-glyph--plus" aria-hidden="true" />
              : <Ellipsis className="gf-glyph gf-glyph--more" aria-hidden="true" />}
          </button>}
          {action === "more" && <div ref={menuRef} id={"gf-menu-" + uid} role="menu" aria-label={text.options + " " + label}
            className="gf-menu" data-open={menuOpen || undefined} onKeyDown={onMenuKey}>
            {menuItems.map((item, i) => <button key={item.label + i} type="button" role="menuitem" tabIndex={-1}
              disabled={!menuOpen || !item.onSelect} className={"gf-menu-item" + (item.danger ? " gf-menu-item--danger" : "")}
              onClick={() => { setMenuOpen(false); keyRef.current?.focus(); item.onSelect?.() }}>{item.label}</button>)}
          </div>}
        </div>
      </div>
    </div>
    <div id={"gf-content-" + uid} hidden={!open} className="gf-content">
      {fullList && (files.length ? <ul className="gf-file-list" aria-label={text.contents + " " + label}>
        {files.map((file, i) => <li key={ids.current[i]}>{file.href
          ? <a href={file.href} target={file.target} rel={file.target === "_blank" ? "noopener noreferrer" : undefined} onClick={() => onFileSelect?.(file, i)}><span>{file.name}{file.meta && <small>{file.meta}</small>}</span><ArrowUpRight size={18} aria-hidden="true" style={{ flexShrink: 0 }} /></a>
          : onFileSelect ? <button type="button" onClick={() => onFileSelect(file, i)}><span>{file.name}{file.meta && <small>{file.meta}</small>}</span><ArrowUpRight size={18} aria-hidden="true" style={{ flexShrink: 0 }} /></button>
          : <span className="gf-file-info">{file.name}{file.meta && <small>{file.meta}</small>}</span>}</li>)}
      </ul> : <p className="gf-empty">{text.empty}</p>)}
    </div>
  </div>
}

const GF_CSS = `
.gf-root{--gf-px:0;--gf-py:0;--gf-ease:cubic-bezier(.2,.8,.2,1);--gf-spring:cubic-bezier(.22,.8,.25,1);--gf-hinge:0deg;--gf-lift:42px;--gf-spread:0px;--gf-fan:0deg;--gf-stack:15px;--gf-ink:#28201e;--gf-ink-soft:#6a5d55;--gf-focus:#a62c40;position:relative;display:inline-block;flex:none;vertical-align:top;max-width:100%;font-family:inherit;-webkit-font-smoothing:antialiased;-webkit-tap-highlight-color:transparent;isolation:isolate;text-align:left}
.gf-root[data-tone=dark]{--gf-ink:#f9f2e7;--gf-ink-soft:#c6b7aa;--gf-focus:#f3bf9f}
@media(hover:hover) and (pointer:fine){.gf-root:hover{--gf-hinge:-9deg;--gf-lift:-22px;--gf-spread:6px;--gf-fan:1.2deg;--gf-stack:10px}}
.gf-root:focus-within{--gf-hinge:-9deg;--gf-lift:-22px;--gf-spread:6px;--gf-fan:1.2deg;--gf-stack:10px}
.gf-root[data-open]{--gf-hinge:-22deg;--gf-lift:-60px;--gf-spread:23px;--gf-fan:3deg;--gf-stack:24px;z-index:2}
.gf-stage-space{position:relative}.gf-stage{position:absolute;left:0;top:0;width:340px;height:272px;transform-origin:0 0}.gf-tilt{position:absolute;inset:0;transform:perspective(1400px) rotateX(calc(var(--gf-py)*-2deg)) rotateY(calc(var(--gf-px)*2.5deg));transition:transform .65s var(--gf-ease)}
.gf-shadow{position:absolute;left:18px;right:18px;bottom:-6px;height:52px;border-radius:40px;background:rgba(53,32,27,.23);filter:blur(20px);transform:translateX(calc(var(--gf-px)*-5px));transition:transform .7s var(--gf-ease),opacity .7s var(--gf-ease)}.gf-root[data-tone=dark] .gf-shadow{background:rgba(0,0,0,.55)}
.gf-back{position:absolute;inset:0;overflow:hidden;background:linear-gradient(180deg,#f3eee4,#e1d8c9)}.gf-root[data-tone=dark] .gf-back{background:linear-gradient(180deg,#352b2c,#1a1519)}
.gf-art{position:absolute;left:-12px;top:-12px;max-width:none;object-fit:cover;transform:translate(calc(var(--gf-px)*-5px),calc(var(--gf-py)*-4px)) scale(1.02);transition:transform .8s var(--gf-ease),opacity .8s var(--gf-ease),filter .8s var(--gf-ease)}canvas.gf-art{opacity:0;filter:blur(12px) saturate(.6)}canvas.gf-art[data-ready]{opacity:1;filter:none}
.gf-back-sheen{position:absolute;inset:0;background:linear-gradient(180deg,rgba(255,255,255,.22),rgba(255,255,255,0) 22%),radial-gradient(120% 80% at 80% 0%,rgba(255,255,255,.16),rgba(255,255,255,0) 60%);pointer-events:none}
.gf-rim{position:absolute;left:0;top:0;max-width:none;overflow:visible;pointer-events:none;fill:none}.gf-back-rim{width:340px;height:272px}.gf-back-rim path{stroke:rgba(255,255,255,.45);stroke-width:1}.gf-root[data-tone=dark] .gf-back-rim path{stroke:rgba(255,255,255,.2)}
.gf-files{position:absolute;inset:0;z-index:5;pointer-events:none;clip-path:inset(-160px -35px 10px -35px)}
.gf-sheet{all:unset;box-sizing:border-box;position:absolute;left:34px;top:96px;width:272px;height:184px;border-radius:16px;overflow:hidden;cursor:pointer;pointer-events:auto;background:linear-gradient(180deg,#fffefb,#f4f0e9);box-shadow:inset 0 1px 0 rgba(255,255,255,.9),0 0 0 .5px rgba(0,0,0,.1),0 10px 26px -8px rgba(30,20,15,.28);transform-origin:50% 100%;transform:translate(calc(var(--gf-jx) + var(--gf-slot)*var(--gf-spread)),calc(var(--gf-lift) + var(--gf-depth)*var(--gf-stack)*-1)) rotate(calc(var(--gf-jr) + var(--gf-slot)*var(--gf-fan)));transition:transform .65s var(--gf-spring) calc(var(--gf-depth)*28ms),box-shadow .35s var(--gf-ease),translate .7s var(--gf-ease),opacity .7s var(--gf-ease)}
.gf-sheet:disabled{cursor:default}.gf-root:not([data-open]) .gf-sheet{pointer-events:none}.gf-root[data-tone=dark] .gf-sheet{background:linear-gradient(180deg,#363033,#211c20);box-shadow:inset 0 1px 0 rgba(255,255,255,.14),0 0 0 .5px rgba(255,255,255,.08),0 12px 28px -8px rgba(0,0,0,.7)}.gf-sheet--art{background:#1a1a1d}
@media(hover:hover) and (pointer:fine){.gf-root[data-open] .gf-sheet:hover{transform:translate(calc(var(--gf-jx) + var(--gf-slot)*var(--gf-spread)),calc(var(--gf-lift) + var(--gf-depth)*var(--gf-stack)*-1 - 10px)) rotate(calc(var(--gf-slot)*var(--gf-fan)*.6));box-shadow:0 22px 40px -12px rgba(30,20,15,.35);transition-delay:0s}}
.gf-sheet:focus-visible{outline:3px solid var(--gf-focus);outline-offset:2px}.gf-sheet-art{position:absolute;left:0;top:0;width:272px;height:184px;max-width:none;object-fit:cover;transition:opacity .7s var(--gf-ease),filter .7s var(--gf-ease)}canvas.gf-sheet-art{opacity:0;filter:blur(10px)}canvas.gf-sheet-art[data-ready]{opacity:1;filter:none}.gf-sheet--art::after{content:"";position:absolute;inset:0;border-radius:inherit;background:linear-gradient(180deg,rgba(0,0,0,.6),transparent 45%);box-shadow:inset 0 0 0 1px rgba(255,255,255,.2);pointer-events:none}
.gf-sheet-head{position:absolute;left:14px;right:14px;top:10px;z-index:1;display:flex;align-items:baseline;justify-content:space-between;gap:8px;white-space:nowrap}.gf-sheet-name{overflow:hidden;text-overflow:ellipsis;font-size:13px;font-weight:500;line-height:1.8;color:#28201e}.gf-sheet-meta{flex:none;font-size:10px;letter-spacing:.02em;color:#74675f}.gf-root[data-tone=dark] .gf-sheet-name,.gf-sheet--art .gf-sheet-name{color:#fffaf3}.gf-root[data-tone=dark] .gf-sheet-meta,.gf-sheet--art .gf-sheet-meta{color:#e0d1c4}
.gf-lines{position:absolute;left:14px;right:14px;top:44px;display:flex;flex-direction:column;gap:9px}.gf-lines i{display:block;height:5px;border-radius:3px;background:rgba(65,43,30,.08)}.gf-lines i:first-child{height:9px;margin-bottom:4px;background:rgba(65,43,30,.14)}.gf-root[data-tone=dark] .gf-lines i{background:rgba(255,255,255,.08)}.gf-root[data-tone=dark] .gf-lines i:first-child{background:rgba(255,255,255,.16)}
.gf-sheet--drop{animation:gf-drop .7s var(--gf-ease) both}@keyframes gf-drop{0%{translate:0 -110px;rotate:-5deg;opacity:0}35%{opacity:1}80%{translate:0 3px;rotate:.5deg}100%{translate:0 0;rotate:0deg;opacity:1}}
.gf-front{position:absolute;left:0;top:74px;width:340px;height:198px;z-index:10;-webkit-backdrop-filter:blur(20px) saturate(1.3);backdrop-filter:blur(20px) saturate(1.3);transform-origin:50% 100%;transform:perspective(760px) rotateX(var(--gf-hinge));transition:transform .65s var(--gf-spring),translate .8s var(--gf-ease),opacity .8s var(--gf-ease)}.gf-front--bump{animation:gf-bump .6s var(--gf-ease) .3s both}@keyframes gf-bump{0%{scale:1}40%{scale:1.008 .987}100%{scale:1}}
.gf-tint{position:absolute;inset:0;background:linear-gradient(180deg,rgba(255,251,243,.2),rgba(255,249,237,.58) 42%,rgba(251,246,236,.96))}.gf-root[data-tone=dark] .gf-tint{background:linear-gradient(180deg,rgba(37,24,29,.2),rgba(27,20,24,.72) 46%,rgba(23,18,21,.97))}
.gf-spec{position:absolute;inset:0;background:radial-gradient(260px 200px at calc(50% + var(--gf-px)*46%) calc(30% + var(--gf-py)*40%),rgba(255,255,255,.5),transparent 70%);mix-blend-mode:soft-light;opacity:.9;pointer-events:none}.gf-root[data-tone=dark] .gf-spec{mix-blend-mode:screen;opacity:.16}.gf-front-rim{width:340px;height:198px}.gf-front-rim path{stroke-width:2.4;transition:stroke-width .25s var(--gf-ease)}.gf-root[data-tone=dark] .gf-front-rim{opacity:.55}
.gf-hit{all:unset;position:absolute;inset:0;z-index:1;cursor:pointer}.gf-hit:focus-visible ~ .gf-label .gf-title{text-decoration:underline;text-decoration-thickness:2px;text-underline-offset:5px}.gf-front:has(.gf-hit:focus-visible) .gf-front-rim path{stroke:var(--gf-focus);stroke-width:5}
.gf-label{position:absolute;z-index:2;display:flex;flex-direction:column;gap:4px;max-width:220px;pointer-events:none;color:var(--gf-ink)}.gf-root[data-place=bottom-left] .gf-label{left:26px;bottom:28px}.gf-root[data-place=top-left] .gf-label{left:26px;top:27px}.gf-root[data-place=top-right] .gf-label{right:28px;top:50px;align-items:flex-start}.gf-title{font-size:20px;font-weight:500;line-height:1.5;letter-spacing:-.012em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.gf-meta{font-size:12px;line-height:1.7;letter-spacing:.01em;color:var(--gf-ink-soft);white-space:nowrap;animation:gf-roll .4s var(--gf-ease) both}@keyframes gf-roll{from{opacity:0;translate:0 5px}to{opacity:1;translate:0 0}}
.gf-key{all:unset;box-sizing:border-box;position:absolute;right:22px;bottom:22px;z-index:12;width:58px;height:58px;border-radius:18px;display:grid;place-items:center;cursor:pointer;transition:transform .3s var(--gf-spring),box-shadow .3s var(--gf-ease),background .3s var(--gf-ease),opacity .5s var(--gf-ease) .45s,scale .5s var(--gf-spring) .45s}.gf-key:active{transform:scale(.95);transition-duration:.12s}.gf-key:focus-visible{outline:3px solid var(--gf-focus);outline-offset:3px}.gf-key--add{color:#fff7eb;background:radial-gradient(120% 90% at 50% 0%,#b54353,#8b2135 55%,#65182a);box-shadow:inset 0 1px 0 rgba(255,255,255,.22),inset 0 -3px 8px rgba(0,0,0,.3),0 0 0 1px rgba(65,16,30,.5),0 14px 22px -8px rgba(65,16,30,.45)}.gf-root[data-tone=dark] .gf-key--add{color:#32171b;background:radial-gradient(120% 90% at 50% 0%,#fff7e7,#e5c9a6 55%,#c4a37c)}
.gf-key--more{color:#442b26;background:linear-gradient(180deg,rgba(255,252,243,.92),rgba(227,216,196,.82));-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);box-shadow:inset 0 1px 0 #fff,0 0 0 1px rgba(65,43,30,.16),0 10px 18px -8px rgba(0,0,0,.3)}.gf-root[data-tone=dark] .gf-key--more{color:#f5ece0;background:linear-gradient(180deg,rgba(255,240,220,.16),rgba(255,240,220,.06));box-shadow:inset 0 1px 0 rgba(255,255,255,.22),0 0 0 1px rgba(255,255,255,.1),0 10px 18px -8px rgba(0,0,0,.6)}.gf-key--more[aria-expanded=true]{transform:scale(.96)}
.gf-glyph{display:block;max-width:none;fill:none;stroke:currentColor;stroke-linecap:round}.gf-glyph--plus{width:26px;height:26px;stroke-width:1.6;animation:gf-turn .5s var(--gf-spring)}.gf-glyph--more{width:24px;height:24px;stroke-width:1.7}@keyframes gf-turn{from{rotate:-90deg}to{rotate:0deg}}
.gf-menu{position:absolute;right:22px;bottom:90px;z-index:20;min-width:176px;max-width:290px;padding:6px;border-radius:16px;display:flex;flex-direction:column;background:rgba(252,247,237,.94);-webkit-backdrop-filter:blur(20px) saturate(1.3);backdrop-filter:blur(20px) saturate(1.3);box-shadow:inset 0 1px 0 rgba(255,255,255,.9),0 0 0 .5px rgba(0,0,0,.14),0 24px 48px -16px rgba(10,12,20,.4);transform-origin:100% 100%;opacity:0;visibility:hidden;transform:translateY(6px) scale(.96);transition:opacity .2s var(--gf-ease),transform .25s var(--gf-spring),visibility 0s .25s}.gf-menu[data-open]{opacity:1;visibility:visible;transform:none;transition-delay:0s}.gf-root[data-tone=dark] .gf-menu{background:rgba(38,28,32,.95);box-shadow:inset 0 1px 0 rgba(255,255,255,.1),0 0 0 .5px rgba(255,255,255,.1),0 24px 48px -16px rgba(0,0,0,.8)}
.gf-menu-item{all:unset;box-sizing:border-box;min-height:44px;padding:9px 12px;border-radius:10px;font-size:14px;line-height:1.6;font-weight:400;color:var(--gf-ink);cursor:pointer}.gf-menu-item:disabled{opacity:.45;cursor:default}.gf-menu-item:hover,.gf-menu-item:focus-visible{background:rgba(90,40,35,.08)}.gf-menu-item:focus-visible{outline:2px solid var(--gf-focus);outline-offset:-2px}.gf-root[data-tone=dark] .gf-menu-item:hover,.gf-root[data-tone=dark] .gf-menu-item:focus-visible{background:rgba(255,255,255,.09)}.gf-menu-item--danger{color:#a52939}.gf-root[data-tone=dark] .gf-menu-item--danger{color:#ffa99c}
.gf-root:not([data-entered]) .gf-back,.gf-root:not([data-entered]) .gf-back-rim{translate:0 18px;opacity:0}.gf-root:not([data-entered]) .gf-sheet{translate:0 -60px;opacity:0}.gf-root:not([data-entered]) .gf-front{translate:0 26px;opacity:0}.gf-root:not([data-entered]) .gf-key{opacity:0;scale:.85}.gf-root:not([data-entered]) .gf-shadow{opacity:0}.gf-back,.gf-back-rim{transition:translate .8s var(--gf-ease),opacity .7s var(--gf-ease)}.gf-root[data-entered] .gf-sheet{transition-delay:calc(var(--gf-depth)*28ms),0s,calc(.1s + var(--gf-depth)*50ms),calc(.1s + var(--gf-depth)*50ms)}.gf-root[data-entered] .gf-front{transition-delay:0s,.2s,.2s}
.gf-content[hidden]{display:none}.gf-file-list{list-style:none;margin:20px 0 0;padding:0;border-top:1px solid color-mix(in srgb,var(--gf-ink) 20%,transparent)}.gf-file-list li{margin:0;padding:0;border-bottom:1px solid color-mix(in srgb,var(--gf-ink) 15%,transparent)}.gf-file-list a,.gf-file-list button{all:unset;box-sizing:border-box;display:flex;width:100%;min-height:52px;align-items:center;justify-content:space-between;gap:12px;padding:12px 4px;font-family:inherit;font-size:14px;line-height:1.65;color:var(--gf-ink);cursor:pointer;text-decoration:none;overflow-wrap:anywhere}.gf-file-list a:hover,.gf-file-list button:hover{color:var(--gf-focus)}.gf-file-list a:focus-visible,.gf-file-list button:focus-visible{outline:2px solid var(--gf-focus);outline-offset:3px;border-radius:3px}.gf-file-list small,.gf-file-info small{display:block;color:var(--gf-ink-soft);font-size:12px;line-height:1.8}.gf-file-info{display:block;padding:12px 4px;color:var(--gf-ink);font-size:14px}.gf-empty{margin:20px 0 0;padding:12px 4px;color:var(--gf-ink-soft);font-size:14px}
@supports not (backdrop-filter:blur(1px)){.gf-tint{background:linear-gradient(180deg,rgba(255,251,243,.65),#fbf6ec)}.gf-root[data-tone=dark] .gf-tint{background:linear-gradient(180deg,rgba(37,24,29,.8),#171215)}}
@media(prefers-reduced-motion:reduce){.gf-root *,.gf-root *::before,.gf-root *::after{transition-duration:0s!important;transition-delay:0s!important;animation:none!important}.gf-tilt{transform:none}.gf-art{transform:none}.gf-root:not([data-entered]) .gf-back,.gf-root:not([data-entered]) .gf-back-rim,.gf-root:not([data-entered]) .gf-sheet,.gf-root:not([data-entered]) .gf-front,.gf-root:not([data-entered]) .gf-key,.gf-root:not([data-entered]) .gf-shadow{opacity:1;translate:0 0;scale:1}}
`
